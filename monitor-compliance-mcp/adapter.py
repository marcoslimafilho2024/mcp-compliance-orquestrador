"""Adaptador de consulta à interface WorkMonitor; nenhuma API privada presumida."""
import asyncio
import os
import re
from datetime import date, datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit

ORIGIN = 'https://web.workmonitor.com'
HOME = ORIGIN + '/spa/dash/production/index.php'
TZ = ZoneInfo('America/Sao_Paulo')

class MonitorError(Exception):
    pass


def period(start: str, end: str) -> tuple[date, date]:
    try:
        a, b = date.fromisoformat(start), date.fromisoformat(end)
    except (ValueError, TypeError):
        raise MonitorError('Use datas no formato AAAA-MM-DD.') from None
    if a > b or (b-a).days > 365 or b > datetime.now(TZ).date():
        raise MonitorError('Intervalo inválido: início até fim, máximo 366 dias, sem datas futuras.')
    return a, b


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def ranking(rows):
    """Preservar rótulos, tempos e subvalores; não inventar denominadores."""
    result = []
    for cells in rows:
        if len(cells) != 13:
            raise MonitorError('O formato do ranking mudou; revisar o adaptador antes de consultar.')
        identity = clean(cells[2])
        match = re.search(r'^(.*?)\s*#(\d+)\b', identity)
        if not match:
            raise MonitorError('Colaborador sem identificação reconhecível no ranking.')
        names = ['atividade', 'captadas', 'produtivas', 'neutras', 'indevidas', 'ocio', 'dias', 'alertas', 'score_genia']
        result.append({'id': match[2], 'nome': match[1], 'identificacao_portal': identity,
                       **{k: clean(v) for k, v in zip(names, cells[3:12])}, 'status_atual':clean(cells[12])})
    return result


class WorkMonitor:
    def __init__(self):
        self.lock = asyncio.Lock()

    async def snapshot(self, start: str, end: str) -> dict:
        period(start, end)
        if not os.getenv('WORKMONITOR_USER') or not os.getenv('WORKMONITOR_PASSWORD'):
            raise MonitorError('Configurar as credenciais WorkMonitor no gerenciador de segredos do servidor.')
        async with self.lock:
            from playwright.async_api import async_playwright, TimeoutError as PWTimeout
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True, args=['--disable-dev-shm-usage'])
                    try:
                        context = await browser.new_context(locale='pt-BR', timezone_id='America/Sao_Paulo', accept_downloads=False)
                        page = await context.new_page()
                        page.set_default_timeout(20000)
                        await page.goto(HOME, wait_until='domcontentloaded')
                        if urlsplit(page.url).netloc != 'web.workmonitor.com':
                            raise MonitorError('Destino de autenticação inesperado; consulta interrompida.')
                        if 'login.php' in page.url:
                            if await page.locator('input[name="usuario"]').count() != 1:
                                raise MonitorError('Formulário de acesso alterado; revisar o adaptador.')
                            await page.locator('input[name="usuario"]').fill(os.environ['WORKMONITOR_USER'])
                            await page.locator('input[name="senha"]').fill(os.environ['WORKMONITOR_PASSWORD'])
                            await page.get_by_role('link', name='Entrar', exact=True).click()
                            try:
                                await page.wait_for_url(HOME, timeout=20000)
                            except PWTimeout:
                                raise MonitorError('WorkMonitor não confirmou o acesso. Verificar conta, senha ou verificação manual; sem novas tentativas automáticas.') from None
                        await page.get_by_role('heading', name='Marcos', exact=True).wait_for()
                        await page.get_by_role('heading', name=re.compile('Complian.*Contabilidade', re.I)).wait_for()
                        close = page.get_by_role('button', name='Close', exact=True)
                        if await close.is_visible():
                            await close.click()
                        scope = page.get_by_role('button', name=re.compile(r'\d+ colaboradores'))
                        scope_text = clean(await scope.inner_text())
                        expected = re.search(r'(\d+) colaboradores', scope_text)
                        if not expected:
                            raise MonitorError('Não foi possível determinar o escopo da consulta.')
                        date_button = page.get_by_role('button', name=re.compile(r'\d{2}/\d{2}/\d{4} - \d{2}/\d{2}/\d{4}'))
                        await date_button.click()
                        await page.locator('#wmDashDateStart').fill(start)
                        await page.locator('#wmDashDateEnd').fill(end)
                        await page.get_by_role('button', name='Aplicar', exact=True).click()
                        # Esperar a requisição disparada pelo Buscar finalizar; nunca ler só o rótulo.
                        async with page.expect_response(lambda r: urlsplit(r.url).netloc == 'web.workmonitor.com' and r.request.resource_type in ('xhr', 'fetch')) as pending:
                            await page.locator('#wmDashSearchBtn').click()
                        response = await pending.value
                        await response.finished()
                        if not response.ok:
                            raise MonitorError('Falha ao carregar os dados filtrados no WorkMonitor.')
                        # Aguardar conclusão de requisições e renderização da interface.
                        await page.wait_for_load_state('networkidle', timeout=20000)
                        await page.locator('#data-ranking tbody tr').first.wait_for()
                        select = page.get_by_role('combobox', name='Mostrar registros')
                        options = await select.locator('option').evaluate_all('(es) => es.map(e => ({text:e.textContent,value:e.value}))')
                        all_option = next((x for x in options if clean(x['text']) == 'Todos'), None)
                        if all_option:
                            await select.select_option(all_option['value'])
                        rows = await page.locator('#data-ranking tbody tr').evaluate_all('(rs) => rs.map(r => Array.from(r.querySelectorAll("td"), c => c.innerText))')
                        employees = ranking(rows)
                        if len(employees) != int(expected[1]):
                            raise MonitorError('Cobertura incompleta do ranking; não retornar resultado parcial como total.')
                        departments = await page.get_by_role('table').filter(has_text='Atual/Selecionado').locator('tbody tr').evaluate_all('(rs) => rs.map(r=>Array.from(r.querySelectorAll("td"), c=>c.innerText.trim()))')
                        label = clean(await date_button.inner_text())
                        if date.fromisoformat(start).strftime('%d/%m/%Y') not in label or date.fromisoformat(end).strftime('%d/%m/%Y') not in label:
                            raise MonitorError('O portal não confirmou o período solicitado.')
                        return {'fonte': HOME, 'consultado_em': datetime.now(TZ).isoformat(),
                                'inicio': start, 'fim': end, 'escopo_portal': scope_text,
                                'total_colaboradores': len(employees), 'colaboradores': employees,
                                'departamentos': [{'departamento':clean(r[0]), 'referencia_30d_anterior':clean(r[1]), 'atual_selecionado':clean(r[2])} for r in departments if len(r)==3],
                                'observacoes': ['Valores textuais preservados como exibidos no portal.', 'Escopo corresponde aos colaboradores selecionados na conta.', 'Atividade, performance e score Gen.IA são indicadores distintos.', 'Sem captura não comprova falta ou baixo desempenho.']}
                    finally:
                        await browser.close()
            except MonitorError:
                raise
            except Exception:
                # Exceções do navegador podem carregar dados sensíveis ou URLs internos.
                raise MonitorError('Consulta não concluída: carregamento, sessão ou estrutura do portal requer validação. Nenhum resultado parcial foi retornado.') from None
