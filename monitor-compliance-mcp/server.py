import os
from typing import Any
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit
from mcp.server.fastmcp import FastMCP
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions, RevocationOptions
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from starlette.responses import JSONResponse, FileResponse
from pathlib import Path
from adapter import WorkMonitor, MonitorError, period
from auth import Verifier, SCOPE
from oauth_provider import Provider


def create_server(backend=None, *, local=False, verifier=None, provider=None):
    backend = backend or WorkMonitor()
    settings = {}
    facade = not local and (provider is not None or os.getenv('OAUTH_MODE') == 'supabase-login')
    if not local:
        if facade:
            # SDK 1.30: corrige somente o default do campo opcional; o
            # autenticador do SDK continua validando o cliente antes da revogação.
            from mcp.server.auth.handlers.revoke import RevocationRequest
            RevocationRequest.model_fields['client_secret'].default = None
            RevocationRequest.model_rebuild(force=True)
            provider = provider or Provider()
            host = urlsplit(provider.resource).netloc
            settings = dict(auth_server_provider=provider,
                 auth=AuthSettings(issuer_url=provider.origin, resource_server_url=provider.resource,
                     required_scopes=[SCOPE], validate_token_resource=True,
                     client_registration_options=ClientRegistrationOptions(enabled=True, valid_scopes=[SCOPE], default_scopes=[SCOPE]),
                     revocation_options=RevocationOptions(enabled=True)))
        else:
            verifier = verifier or Verifier()
            host = urlsplit(verifier.resource).netloc
            settings = dict(token_verifier=verifier,
                auth=AuthSettings(issuer_url=verifier.issuer, resource_server_url=verifier.resource,
                     required_scopes=verifier.public_scopes if getattr(verifier,'supabase',False) else [SCOPE], validate_token_resource=True))
        settings['transport_security']=TransportSecuritySettings(enable_dns_rebinding_protection=True,
              allowed_hosts=[host,'127.0.0.1:*','localhost:*'],allowed_origins=['https://'+host])
    mcp = FastMCP('Monitor Compliance', host='0.0.0.0' if not local else '127.0.0.1',
                  port=int(os.environ.get('PORT','8000')), stateless_http=True, json_response=True,
                  instructions='Consultar apenas os dados solicitados. Preservar datas, escopo, nomes e unidades do portal. Não inferir faltas ou dedicação por telemetria.', **settings)
    annotations = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True)
    metadata = {'securitySchemes':[{'type':'oauth2','scopes':[SCOPE] if facade else verifier.public_scopes}]} if not local else {}

    @mcp.tool(annotations=annotations, meta=metadata, structured_output=True)
    async def status_integracao() -> dict[str, Any]:
        """Informar configuração do servidor, sem testar login nem retornar segredos."""
        return {'servidor':'Monitor Compliance','versao':'0.3.0','transporte':'stdio' if local else 'streamable-http',
                'modo':'consulta ao portal','credenciais_configuradas':bool(os.getenv('WORKMONITOR_USER') and os.getenv('WORKMONITOR_PASSWORD')),
                'autenticacao_workmonitor':'nao_verificada_por_esta_ferramenta',
                'monitoramento_continuo':False}

    async def snapshot(inicio, fim):
        period(inicio, fim)
        try:
            return await backend.snapshot(inicio,fim)
        except MonitorError as exc:
            raise ValueError(str(exc)) from None

    @mcp.tool(annotations=annotations, meta=metadata, structured_output=True)
    async def consultar_produtividade(inicio: str, fim: str, colaborador: str | None = None) -> dict[str, Any]:
        """Consultar atividade, horas, ócio e departamentos em AAAA-MM-DD. Nome opcional filtra localmente o ranking do escopo selecionado."""
        data = await snapshot(inicio, fim)
        if colaborador:
            if len(colaborador.strip()) < 2:
                raise ValueError('Informar ao menos dois caracteres do nome.')
            data = dict(data)
            data['colaboradores'] = [x for x in data['colaboradores'] if colaborador.casefold() in x['nome'].casefold()]
            data['filtro_colaborador'] = colaborador
            data['quantidade_filtrada'] = len(data['colaboradores'])
            data['departamentos_referem_se_ao_escopo_completo'] = True
        return data

    @mcp.tool(annotations=annotations, meta=metadata, structured_output=True)
    async def listar_colaboradores(inicio: str, fim: str) -> dict[str, Any]:
        """Listar colaboradores e identificação no escopo selecionado do portal para o período informado."""
        data = await snapshot(inicio, fim)
        return {k:data[k] for k in ['inicio','fim','consultado_em','escopo_portal','total_colaboradores']} | {
            'colaboradores':[{k:r[k] for k in ['id','nome','identificacao_portal']} for r in data['colaboradores']]}

    @mcp.tool(annotations=annotations, meta=metadata, structured_output=True)
    async def comparar_periodos(inicio_a: str, fim_a: str, inicio_b: str, fim_b: str) -> dict[str, Any]:
        """Consultar dois períodos com as bases preservadas, sem misturar métricas nem calcular médias indevidas."""
        period(inicio_a,fim_a)
        period(inicio_b,fim_b)
        a, b = await snapshot(inicio_a,fim_a), await snapshot(inicio_b,fim_b)
        if a['escopo_portal'] != b['escopo_portal']:
            raise ValueError('O escopo mudou entre as consultas; comparação interrompida.')
        return {'periodo_a':a,'periodo_b':b,'observacao':'Comparar indicadores de mesmo nome e considerar diferenças de dias e cobertura.'}

    @mcp.custom_route('/health', methods=['GET'])
    async def health(request):
        return JSONResponse({'status':'ok','service':'monitor-compliance'})

    @mcp.custom_route('/oauth/consent', methods=['GET'])
    async def consent(request):
        response=FileResponse(Path(__file__).parent/'web'/'consent.html',headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"})
        if facade:
            csrf=provider.begin(request.query_params.get('transaction',''))
            if csrf:
                response.set_cookie('monitor_oauth_csrf',csrf,secure=True,httponly=True,samesite='lax',max_age=600,path='/oauth')
        return response

    @mcp.custom_route('/assets/consent.js', methods=['GET'])
    async def consent_js(request):
        return FileResponse(Path(__file__).parent/'web'/'dist'/'consent.js',media_type='text/javascript',headers={'X-Content-Type-Options':'nosniff'})

    @mcp.custom_route('/oauth/config', methods=['GET'])
    async def oauth_config(request):
        return JSONResponse({'url':os.environ.get('SUPABASE_URL',''),
             'publishableKey':os.environ.get('SUPABASE_PUBLISHABLE_KEY',''),
             'allowedUserId':os.environ.get('OAUTH_ALLOWED_SUBJECTS','').split(',')[0]},headers={'Cache-Control':'no-store'})
    @mcp.custom_route('/oauth/transaction', methods=['GET'])
    async def transaction(request):
        if not facade:
            return JSONResponse({'error':'not_supported'},status_code=400)
        csrf=request.cookies.get('monitor_oauth_csrf','')
        data=provider.details(request.query_params.get('transaction',''),csrf)
        if not data:
            return JSONResponse({'error':'expired_request'},status_code=400)
        return JSONResponse(data|{'csrf':csrf},headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'})

    @mcp.custom_route('/oauth/decision', methods=['POST'])
    async def decision(request):
        if not facade or request.headers.get('origin')!=provider.origin:
            return JSONResponse({'error':'invalid_origin'},status_code=403)
        cookie=request.cookies.get('monitor_oauth_csrf','')
        if not cookie or request.headers.get('x-csrf-token')!=cookie:
            return JSONResponse({'error':'invalid_request'},status_code=403)
        try:
            body=await request.body()
            if len(body)>16384:
                return JSONResponse({'error':'request_too_large'},status_code=413)
            import json
            data=json.loads(body)
            redirect=await provider.decide(data['transaction'],cookie,data['decision'],data.get('access_token',''))
            response=JSONResponse({'redirect_url':redirect},headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'})
            response.delete_cookie('monitor_oauth_csrf',path='/oauth')
            return response
        except (ValueError,KeyError,TypeError):
            return JSONResponse({'error':'Sessão ou solicitação inválida. Reinicie a conexão pelo ChatGPT.'},status_code=400)

    return mcp

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--stdio', action='store_true', help='Modo local; não publicar sem autenticação.')
    args = parser.parse_args()
    create_server(local=args.stdio).run(transport='stdio' if args.stdio else 'streamable-http')
