import asyncio
import copy
import json
import time
from types import SimpleNamespace
from pathlib import Path
import sys
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from adapter import period, ranking, MonitorError
from server import create_server
from auth import Verifier
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa


def run(coro):
    return asyncio.run(coro)

@pytest.mark.parametrize('a,b', [('2026-02-30','2026-03-01'),('2026-10-02','2026-10-01'),('2020-01-01','2026-01-01'),('2099-01-01','2099-01-02')])
def test_invalid_period(a,b):
    with pytest.raises(MonitorError):
        period(a,b)


def test_ranking_keeps_auxiliary_hours_and_missing_data():
    row=['','','Pessoa Exemplo #7 AUTO • Fiscal','98% 07:48 de 08:00 h','07:48 h 00:12 h','07:40 h 00:12 h','00:08 h','00:00 h','00:11 h','1','0 0 0','57.84','offline']
    data=ranking([row])[0]
    assert data['id']=='7'
    assert data['captadas']=='07:48 h 00:12 h'
    assert data['status_atual']=='offline'
    with pytest.raises(MonitorError):
        ranking([row[:12]])

class Backend:
    async def snapshot(self,a,b):
        return {'inicio':a,'fim':b,'consultado_em':'2026-10-17T20:00:00-03:00','escopo_portal':'2 colaboradores selecionados', 'total_colaboradores':2,
                'colaboradores':[{'id':'1','nome':'Ana Exemplo','identificacao_portal':'Ana #1','produtivas':'01:00 h'}, {'id':'2','nome':'Bia Exemplo','identificacao_portal':'Bia #2','produtivas':'02:00 h'}], 'departamentos':[]}


def test_tool_contract_filter_and_comparison():
    async def check():
        mcp=create_server(Backend(),local=True)
        tools=await mcp.list_tools()
        assert {t.name for t in tools}=={'status_integracao','consultar_produtividade','listar_colaboradores','comparar_periodos'}
        assert all(t.annotations.readOnlyHint for t in tools)
        _,data=await mcp.call_tool('consultar_produtividade',{'inicio':'2026-10-01','fim':'2026-10-02','colaborador':'Ana'})
        assert len(data['colaboradores'])==1
        assert data['total_colaboradores']==2
        assert data['departamentos_referem_se_ao_escopo_completo'] is True
        _,comparison=await mcp.call_tool('comparar_periodos',{'inicio_a':'2026-10-01','fim_a':'2026-10-02','inicio_b':'2026-10-03','fim_b':'2026-10-04'})
        assert comparison['periodo_a']['inicio']=='2026-10-01'
        assert comparison['periodo_b']['inicio']=='2026-10-03'
    run(check())


def verifier(monkeypatch):
    monkeypatch.setenv('OAUTH_ISSUER','https://identity.example.invalid/')
    monkeypatch.setenv('OAUTH_JWKS_URL','https://identity.example.invalid/keys')
    monkeypatch.setenv('MCP_RESOURCE_URL','https://monitor.example.invalid/mcp')
    monkeypatch.setenv('OAUTH_ALLOWED_SUBJECTS','marcos-test-subject')
    v=Verifier()
    private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    v.keys=SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private.public_key()))
    return v, private

@pytest.mark.parametrize('override', [{'aud':'wrong'}, {'iss':'https://evil.invalid/'},{'sub':'other'},{'exp':1},{'scope':'other:scope'}])
def test_tokens_reject_wrong_audience_issuer_subject_expiry_scope(monkeypatch,override):
    v,private=verifier(monkeypatch)
    claims={'iss':v.issuer,'aud':v.resource,'sub':'marcos-test-subject','exp':int(time.time())+300,'scope':'monitor:read'}|override
    token=jwt.encode(claims,private,algorithm='RS256')
    assert run(v.verify_token(token)) is None


def test_token_accepts_only_authorized_subject(monkeypatch):
    v,private=verifier(monkeypatch)
    token=jwt.encode({'iss':v.issuer,'aud':v.resource,'sub':'marcos-test-subject','exp':int(time.time())+300,'scope':'monitor:read'},private,algorithm='RS256')
    assert run(v.verify_token(token)).resource==v.resource


def test_http_rejects_anonymous_and_publishes_discovery(monkeypatch):
    from starlette.testclient import TestClient
    v,_=verifier(monkeypatch)
    mcp=create_server(Backend(),verifier=v)
    with TestClient(mcp.streamable_http_app(),base_url='https://monitor.example.invalid') as client:
        response=client.post('/mcp',json={'jsonrpc':'2.0','id':1,'method':'tools/list'})
        assert response.status_code==401
        assert 'resource_metadata' in response.headers['www-authenticate']
        discovery=client.get('/.well-known/oauth-protected-resource/mcp')
        assert discovery.status_code==200
        assert discovery.json()['resource']==v.resource
        assert client.get('/health').json()['status']=='ok'


def test_stdio_real_protocol():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    async def check():
        params=StdioServerParameters(command=sys.executable,args=[str(Path(__file__).resolve().parents[1]/'server.py'),'--stdio'])
        async with stdio_client(params) as (read,write):
            async with ClientSession(read,write) as client:
                info=await client.initialize()
                assert info.serverInfo.name=='Monitor Compliance'
                tools=await client.list_tools()
                assert len(tools.tools)==4
                status=await client.call_tool('status_integracao',{})
                assert not status.isError
                assert status.structuredContent['monitoramento_continuo'] is False
    run(check())


def test_http_authenticated_initialization_and_tools(monkeypatch):
    from starlette.testclient import TestClient
    v,private=verifier(monkeypatch)
    token=jwt.encode({'iss':v.issuer,'aud':v.resource,'sub':'marcos-test-subject','exp':int(time.time())+300,'scope':'monitor:read'},private,algorithm='RS256')
    mcp=create_server(Backend(),verifier=v)
    headers={'Authorization':'Bearer '+token,'Accept':'application/json, text/event-stream'}
    with TestClient(mcp.streamable_http_app(),base_url='https://monitor.example.invalid',headers=headers) as client:
        response=client.post('/mcp',json={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'test-client','version':'1'}}})
        assert response.status_code==200
        assert response.json()['result']['serverInfo']['name']=='Monitor Compliance'
        headers['MCP-Protocol-Version']=response.json()['result']['protocolVersion']
        response=client.post('/mcp',headers=headers,json={'jsonrpc':'2.0','id':2,'method':'tools/list'})
        assert response.status_code==200
        assert len(response.json()['result']['tools'])==4
        response=client.post('/mcp',headers=headers,json={'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'consultar_produtividade','arguments':{'inicio':'2026-10-01','fim':'2026-10-02'}}})
        assert response.status_code==200
        result=response.json()['result']
        assert not result['isError']
        assert result['structuredContent']['total_colaboradores']==2


def test_missing_credentials_fails_without_browser(monkeypatch):
    from adapter import WorkMonitor
    monkeypatch.delenv('WORKMONITOR_USER',raising=False)
    monkeypatch.delenv('WORKMONITOR_PASSWORD',raising=False)
    with pytest.raises(MonitorError,match='credenciais'):
        run(WorkMonitor().snapshot('2026-10-01','2026-10-02'))


def test_supabase_requires_specific_client_and_user(monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import ec
    monkeypatch.setenv('OAUTH_MODE','supabase')
    v,_=verifier(monkeypatch)
    private=ec.generate_private_key(ec.SECP256R1())
    v.keys=SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private.public_key()))
    def mint(**extra):
        claims={'iss':v.issuer,'aud':'authenticated','sub':'marcos-test-subject','exp':int(time.time())+300}|extra
        return jwt.encode(claims,private,algorithm='ES256')
    assert run(v.verify_token(mint())) is None
    assert run(v.verify_token(mint(client_id='dedicated'))) is None
    v.clients={'dedicated'}
    assert run(v.verify_token(mint(client_id='dedicated'))).client_id=='dedicated'
    assert run(v.verify_token(mint(client_id='other'))) is None
    assert run(v.verify_token(mint(client_id='dedicated',sub='other'))) is None
    assert run(v.verify_token(mint(client_id='dedicated',aud='other'))) is None


def test_consent_serves_no_secrets(monkeypatch):
    from starlette.testclient import TestClient
    monkeypatch.setenv('WORKMONITOR_PASSWORD','test-secret-never-render')
    v,_=verifier(monkeypatch)
    mcp=create_server(Backend(),verifier=v)
    with TestClient(mcp.streamable_http_app(),base_url='https://monitor.example.invalid') as client:
        config=client.get('/oauth/config')
        page=client.get('/oauth/consent')
        assert 'test-secret-never-render' not in config.text+page.text
        assert "frame-ancestors 'none'" in page.headers['content-security-policy']
        assert config.headers['cache-control']=='no-store'
