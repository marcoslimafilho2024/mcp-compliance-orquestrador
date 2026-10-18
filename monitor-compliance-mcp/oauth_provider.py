"""OAuth 2.1 do MCP; Supabase valida a identidade, o SDK processa PKCE."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
import httpx
import jwt
from mcp.server.auth.provider import AccessToken, AuthorizationCode, AuthorizationParams, RefreshToken, RegistrationError, AuthorizeError, TokenError
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from auth import SCOPE, https_env


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Identity:
    def __init__(self):
        self.url = https_env('SUPABASE_URL').rstrip('/')
        self.key = os.environ['SUPABASE_PUBLISHABLE_KEY']
        self.subjects = {x.strip() for x in os.environ['OAUTH_ALLOWED_SUBJECTS'].split(',') if x.strip()}
        if not self.subjects:
            raise ValueError('Nenhum usuário autorizado.')
        self.jwks = jwt.PyJWKClient(self.url+'/auth/v1/.well-known/jwks.json',timeout=10)

    async def verify(self, token):
        try:
            key = await asyncio.to_thread(self.jwks.get_signing_key_from_jwt, token)
            claims = jwt.decode(token,key.key,algorithms=['ES256'],issuer=self.url+'/auth/v1',audience='authenticated',options={'require':['exp','iss','aud','sub']})
            if claims['sub'] not in self.subjects:
                return None
            async with httpx.AsyncClient(timeout=15,follow_redirects=False) as client:
                r = await client.get(self.url+'/auth/v1/user',headers={'apikey':self.key,'Authorization':'Bearer '+token})
            if r.status_code != 200:
                return None
            user = r.json()
            if user.get('id') != claims['sub'] or not user.get('email_confirmed_at'):
                return None
            return claims['sub']
        except Exception:
            return None


class Provider:
    def __init__(self, resource=None, db_path=None, identity=None):
        self.resource = resource or https_env('MCP_RESOURCE_URL')
        u = urlsplit(self.resource)
        self.origin = f'{u.scheme}://{u.netloc}'
        self.identity = identity or Identity()
        self.path = db_path or os.environ.get('OAUTH_DB_PATH','/data/oauth.sqlite')
        Path(self.path).parent.mkdir(parents=True,exist_ok=True)
        with self.db() as db:
            db.execute('create table if not exists objects (kind text not null, key text not null, payload text not null, expires integer not null, family text, primary key(kind,key))')
            db.execute('create index if not exists objects_family on objects(family)')
        os.chmod(self.path,0o600)

    def db(self):
        db=sqlite3.connect(self.path,timeout=5,isolation_level='IMMEDIATE')
        db.row_factory=sqlite3.Row
        return db

    def put(self,kind,key,value,expires,family=None):
        with self.db() as db:
            db.execute('delete from objects where expires < ?', (int(time.time()),))
            db.execute('insert or replace into objects values (?,?,?,?,?)',(kind,digest(key),json.dumps(value),expires,family))

    def get(self,kind,key):
        with self.db() as db:
            row=db.execute('select payload from objects where kind=? and key=? and expires>?',(kind,digest(key),int(time.time()))).fetchone()
        return json.loads(row['payload']) if row else None

    async def get_client(self,client_id):
        data=self.get('client',client_id)
        return OAuthClientInformationFull.model_validate(data) if data else None

    async def register_client(self,client_info):
        if client_info.token_endpoint_auth_method != 'none' or client_info.client_secret:
            raise RegistrationError('invalid_client_metadata','Usar cliente público com PKCE e token_endpoint_auth_method none.')
        if not client_info.redirect_uris or len(client_info.redirect_uris)>5:
            raise RegistrationError('invalid_redirect_uri','Informar callbacks do ChatGPT.')
        for uri in client_info.redirect_uris:
            u=urlsplit(str(uri))
            if u.scheme!='https' or u.hostname!='chatgpt.com' or u.username or u.password or u.fragment:
                raise RegistrationError('invalid_redirect_uri','Apenas callbacks HTTPS do ChatGPT são aceitos.')
        self.put('client',client_info.client_id,client_info.model_dump(mode='json'),int(time.time())+365*86400)

    async def authorize(self,client,params):
        if params.resource not in (None,self.resource):
            raise AuthorizeError('invalid_request','Recurso OAuth inválido.')
        if not params.code_challenge or len(params.code_challenge)<40:
            raise AuthorizeError('invalid_request','PKCE obrigatório.')
        if set(params.scopes or [SCOPE])!={SCOPE}:
            raise AuthorizeError('invalid_scope','Apenas consultas monitor:read são permitidas.')
        transaction=secrets.token_urlsafe(32)
        self.put('pending',transaction,{'client_id':client.client_id,'client_name':(client.client_name or 'ChatGPT')[:200],
            'params':params.model_dump(mode='json'),'expires':int(time.time())+600,'csrf':None},int(time.time())+600)
        return self.origin+'/oauth/consent?'+urlencode({'transaction':transaction})

    def begin(self,transaction):
        data=self.get('pending',transaction)
        if not data:
            return None
        csrf=secrets.token_urlsafe(32)
        data['csrf']=digest(csrf)
        self.put('pending',transaction,data,data['expires'])
        return csrf

    def details(self,transaction,csrf):
        data=self.get('pending',transaction)
        if not data or not csrf or not data.get('csrf') or not secrets.compare_digest(data['csrf'],digest(csrf)):
            return None
        return {'client_name':data['client_name'],'scope':SCOPE,'redirect_uri':data['params']['redirect_uri']}

    async def decide(self,transaction,csrf,decision,token):
        data=self.get('pending',transaction)
        if not self.details(transaction,csrf):
            raise ValueError('Solicitação expirada ou inválida.')
        if decision not in ('approve','deny'):
            raise ValueError('Decisão inválida.')
        subject=await self.identity.verify(token) if decision=='approve' else None
        if decision=='approve' and not subject:
            raise ValueError('Conta Supabase não autorizada ou sessão inválida.')
        params=AuthorizationParams.model_validate(data['params'])
        code=secrets.token_urlsafe(32)
        grant=AuthorizationCode(code=code,scopes=[SCOPE],expires_at=time.time()+120,client_id=data['client_id'],
             code_challenge=params.code_challenge,redirect_uri=params.redirect_uri,
             redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,resource=self.resource,subject=subject)
        # Consumir transação e produzir código em uma só transação evita reuso.
        with self.db() as db:
            changed=db.execute('delete from objects where kind=? and key=? and expires>?',('pending',digest(transaction),int(time.time()))).rowcount
            if not changed:
                raise ValueError('Solicitação já utilizada.')
            if decision=='approve':
                db.execute('insert into objects values (?,?,?,?,?)',('code',digest(code),json.dumps(grant.model_dump(mode='json',exclude={'code'})),int(grant.expires_at),None))
        u=urlsplit(str(params.redirect_uri))
        query=list(parse_qsl(u.query,keep_blank_values=True))
        query.append(('code',code) if decision=='approve' else ('error','access_denied'))
        if params.state is not None:
            query.append(('state',params.state))
        return urlunsplit((u.scheme,u.netloc,u.path,urlencode(query),u.fragment))

    async def load_authorization_code(self,client,authorization_code):
        data=self.get('code',authorization_code)
        if not data or data['client_id']!=client.client_id:
            return None
        return AuthorizationCode(code=authorization_code,**data)

    def issue(self,db,client_id,subject,scopes):
        now=int(time.time()); family=secrets.token_urlsafe(16)
        access,refresh=secrets.token_urlsafe(32),secrets.token_urlsafe(48)
        for kind,token,expiry in [('access',access,now+3600),('refresh',refresh,now+7*86400)]:
            data={'client_id':client_id,'subject':subject,'scopes':scopes,'expires_at':expiry,'resource':self.resource}
            db.execute('insert into objects values (?,?,?,?,?)',(kind,digest(token),json.dumps(data),expiry,family))
        return OAuthToken(access_token=access,refresh_token=refresh,expires_in=3600,scope=' '.join(scopes))

    async def exchange_authorization_code(self,client,authorization_code):
        with self.db() as db:
            changed=db.execute('delete from objects where kind=? and key=? and expires>?',('code',digest(authorization_code.code),int(time.time()))).rowcount
            if not changed or authorization_code.client_id!=client.client_id:
                raise TokenError('invalid_grant','Código expirado ou já utilizado.')
            return self.issue(db,client.client_id,authorization_code.subject,authorization_code.scopes)

    async def load_refresh_token(self,client,refresh_token):
        data=self.get('refresh',refresh_token)
        if not data or data['client_id']!=client.client_id or data['subject'] not in self.identity.subjects:
            return None
        return RefreshToken(token=refresh_token,**data)

    async def exchange_refresh_token(self,client,refresh_token,scopes):
        if not set(scopes).issubset(refresh_token.scopes):
            raise TokenError('invalid_scope','Escopos adicionais não são permitidos.')
        with self.db() as db:
            row=db.execute('select family from objects where kind=? and key=? and expires>?',('refresh',digest(refresh_token.token),int(time.time()))).fetchone()
            if not row or refresh_token.client_id!=client.client_id:
                raise TokenError('invalid_grant','Refresh token inválido.')
            db.execute('delete from objects where family=?',(row['family'],))
            return self.issue(db,client.client_id,refresh_token.subject,scopes or refresh_token.scopes)

    async def load_access_token(self,token):
        data=self.get('access',token)
        if not data or data['resource']!=self.resource or data['subject'] not in self.identity.subjects:
            return None
        return AccessToken(token=token,**data)

    async def revoke_token(self,token):
        with self.db() as db:
            row=db.execute('select family from objects where kind in (?,?) and key=?',('access','refresh',digest(token.token))).fetchone()
            if row:
                db.execute('delete from objects where family=?',(row['family'],))
