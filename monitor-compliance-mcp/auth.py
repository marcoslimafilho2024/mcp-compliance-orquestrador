"""JWT com emissor, assinatura e autorização de usuário/cliente verificadas."""
import asyncio
import os
from urllib.parse import urlsplit
import jwt
from mcp.server.auth.provider import AccessToken

SCOPE = 'monitor:read'

def https_env(name):
    value = os.environ.get(name, '')
    u = urlsplit(value)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.query or u.fragment:
        raise ValueError(f'{name} exige URL HTTPS canônica, sem credenciais, consulta ou fragmento.')
    return value

class Verifier:
    def __init__(self):
        self.issuer = https_env('OAUTH_ISSUER')
        self.resource = https_env('MCP_RESOURCE_URL')
        self.supabase = os.getenv('OAUTH_MODE') == 'supabase'
        self.algorithm = 'ES256' if self.supabase else 'RS256'
        self.subjects = {x.strip() for x in os.environ.get('OAUTH_ALLOWED_SUBJECTS', '').split(',') if x.strip()}
        self.clients = {x.strip() for x in os.environ.get('OAUTH_ALLOWED_CLIENT_IDS', '').split(',') if x.strip()}
        if not self.subjects:
            raise ValueError('Configurar OAUTH_ALLOWED_SUBJECTS para restringir acesso à conta Compliance.')
        # Supabase não implementa RFC 8707. Exigir um cliente OAuth exclusivo além
        # do usuário, sem aceitar sessões normais ou tokens de outros aplicativos.
        self.public_scopes = ['openid', 'email'] if self.supabase else [SCOPE]
        self.keys = jwt.PyJWKClient(https_env('OAUTH_JWKS_URL'), timeout=10)

    async def verify_token(self, token: str):
        try:
            key = await asyncio.to_thread(self.keys.get_signing_key_from_jwt, token)
            claims = jwt.decode(token, key.key, algorithms=[self.algorithm], issuer=self.issuer,
                                audience='authenticated' if self.supabase else self.resource,
                                options={'require':['exp','iss','aud','sub']})
            if claims['sub'] not in self.subjects:
                return None
            raw_scopes = claims.get('scope', '')
            scopes = raw_scopes.split() if isinstance(raw_scopes,str) else []
            if self.supabase:
                client_id = claims.get('client_id')
                if not client_id or client_id not in self.clients:
                    return None
                # Permissão interna, concedida pelas duas listas administrativas;
                # não se apresenta monitor:read como escopo nativo do Supabase.
                scopes = [SCOPE] + self.public_scopes
            else:
                if SCOPE not in scopes:
                    return None
                client_id = str(claims.get('azp',claims['sub']))
            return AccessToken(token=token, client_id=client_id, scopes=scopes,
                               expires_at=int(claims['exp']), resource=self.resource, subject=claims['sub'])
        except Exception:
            return None
