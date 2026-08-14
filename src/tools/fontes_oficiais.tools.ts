/**
 * tools/fontes_oficiais.tools.ts
 * Fontes oficiais da Reforma Tributária — LC 214/2025, LC 227/2025, LC 224/2025
 * Notas Técnicas NF-e, RFB CETAD e portais complementares.
 *
 * Foco: substância técnico-jurídica. Mapeia temas a artigos específicos e
 * fornece URLs diretas para fetch do texto legal consolidado.
 *
 * Tools:
 *   fonte_catalogo           — catálogo de todas as fontes oficiais com URLs
 *   fonte_lc214_mapa_temas   — mapa tema → artigos da LC 214/2025
 *   fonte_artigo_url         — URL direta para artigo específico de uma LC
 *   fonte_nt_catalogo        — catálogo de Notas Técnicas NF-e disponíveis
 *   fonte_rfb_cetad          — notas técnicas CETAD da Receita Federal
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ─── CATÁLOGO DE FONTES ───────────────────────────────────────────────────────

const FONTES_CATALOGO = {
  legislacao_federal: [
    {
      id: 'lcp214',
      nome: 'LC 214/2025 — IBS, CBS e Imposto Seletivo',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm',
      descricao: 'Lei principal da Reforma Tributária do Consumo. Institui IBS, CBS e IS. Revoga ICMS/ISS/PIS/COFINS a partir de 2033.',
      vigencia: '16/01/2025',
      status: 'VIGENTE — fase teste 2026',
      total_artigos_aprox: 500,
      temas_principais: ['IBS', 'CBS', 'IS', 'Split Payment', 'Simples Nacional', 'Não cumulatividade', 'Transição 2026-2033'],
    },
    {
      id: 'lcp227',
      nome: 'LC 227/2025 — CGIBS e alterações à LC 214',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm',
      descricao: 'Cria o Comitê Gestor do IBS (CGIBS). Altera dispositivos da LC 214/2025. Define administração, fiscalização e contencioso administrativo do IBS.',
      vigencia: '2025',
      status: 'VIGENTE',
      temas_principais: ['CGIBS', 'Administração do IBS', 'Fiscalização', 'Contencioso', 'Compensação e restituição'],
    },
    {
      id: 'lcp224',
      nome: 'LC 224/2025 — Redução de incentivos fiscais federais',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp224.htm',
      descricao: 'Redução linear de 10% em incentivos fiscais federais durante a transição. Exclui: Simples Nacional, Zona Franca de Manaus, imunidades constitucionais, cesta básica, programas sociais.',
      vigencia: '2025',
      status: 'VIGENTE',
      temas_principais: ['Incentivos fiscais', 'Benefícios tributários', 'Ajuste fiscal', 'Transição'],
    },
    {
      id: 'ec132',
      nome: 'EC 132/2023 — Emenda Constitucional da Reforma Tributária',
      url: 'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm',
      descricao: 'Base constitucional da Reforma. Insere o IBS e a CBS na CF/1988. Art. 149-B: tributação por fora, não cumulatividade plena, tributação no destino.',
      vigencia: '20/12/2023',
      status: 'VIGENTE',
      artigos_chave: ['Art. 149-B CF (IBS/CBS)', 'Art. 153 §5º (IS)'],
    },
    {
      id: 'lc123',
      nome: 'LC 123/2006 — Simples Nacional',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
      descricao: 'Estatuto Nacional da Microempresa e Empresa de Pequeno Porte. Parcialmente alterada pela LC 214/2025.',
      vigencia: '14/12/2006',
      status: 'VIGENTE (parcialmente alterada)',
      artigos_relevantes_reforma: ['Art. 18 §§14-15 (regime de caixa DAS)', 'Arts. 12-15 (apuração)'],
    },
  ],
  portais_tecnicos: [
    {
      id: 'nfe_portal',
      nome: 'Portal NF-e — Documentação Técnica',
      url: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=',
      descricao: 'Catálogo de Notas Técnicas NF-e, esquemas XML, Manuais de Orientação ao Contribuinte (MOC) e pacotes de liberação SEFAZ.',
      tipo_conteudo: 'Notas Técnicas NF-e',
      ultima_atualizacao: 'v1.34 (dez/2025)',
    },
    {
      id: 'dfe_portal',
      nome: 'DFe Portal — Documentos Fiscais Eletrônicos (RS/SVRS)',
      url: 'https://dfe-portal.svrs.rs.gov.br/Cff',
      descricao: 'Portal do ambiente nacional de DFe gerenciado pela SEFAZ-RS. Acesso a status de serviços, consultas de NF-e, NFC-e, CT-e, NFS-e.',
      tipo_conteudo: 'Consultas e serviços DFe',
    },
    {
      id: 'reforma_gov',
      nome: 'Reforma Tributária — Portal Oficial',
      url: 'https://www.reformatributaria.com/',
      descricao: 'Portal centralizador com notícias, regulamentações, FAQ, simuladores e materiais educativos sobre a Reforma Tributária.',
      tipo_conteudo: 'Portal institucional',
    },
    {
      id: 'rfb_cetad',
      nome: 'RFB — Notas Técnicas CETAD',
      url: 'https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/estudos/notas-cetad/notas-tecnicas',
      descricao: 'Notas técnicas do Centro de Estudos Tributários e Aduaneiros da Receita Federal. Estudos fiscais, projeções de arrecadação e análises técnicas.',
      tipo_conteudo: 'Estudos e análises RFB',
    },
  ],
  atos_regulamentadores: [
    {
      id: 'regulamento_cbs',
      nome: 'Regulamento da CBS',
      url: 'G:\\Meu Drive\\Projetos de Execução\\Consultorias\\Guerra\\00_Modelos\\REGULAMENTO DA CBS.pdf',
      descricao: 'Regulamento infralegal da Contribuição sobre Bens e Serviços',
      tipo: 'PDF local',
    },
    {
      id: 'regulamento_ibs',
      nome: 'Regulamento do IBS',
      url: 'G:\\Meu Drive\\Projetos de Execução\\Consultorias\\Guerra\\00_Modelos\\REGULAMENTO DO IBS.pdf',
      descricao: 'Regulamento infralegal do Imposto sobre Bens e Serviços',
      tipo: 'PDF local',
    },
    {
      id: 'ato_conjunto_rfb_cgibs_1_2025',
      nome: 'Ato Conjunto RFB/CGIBS nº 1/2025',
      descricao: 'Suspende penalidades na fase teste (2026). Alíquotas fase teste: CBS 0,9% + IBS 0,1%.',
      status: 'VIGENTE em 2026',
    },
    {
      id: 'resolucao_cgsb_6_2026',
      nome: 'Resolução CGSB nº 6/2026',
      descricao: 'Regulamento do IBS aprovado pelo Comitê Gestor',
      vigencia: '30/04/2026',
    },
    {
      id: 'decreto_12955_2026',
      nome: 'Decreto nº 12.955/2026',
      descricao: 'Regulamentação do Split Payment e outras disposições operacionais',
      vigencia: '29/04/2026',
    },
  ],
};

// ─── MAPA DE TEMAS → ARTIGOS LC 214 ──────────────────────────────────────────

const LC214_MAPA_TEMAS = {
  lei: 'LC 214/2025',
  url_base: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm',
  como_citar: 'LC 214/2025, art. [N], § [X], inciso [Y], alínea "[z]"',
  instrucao_fetch: 'Para obter o texto de um artigo específico, fazer fetch de: {url_base}#art{N}',
  temas: [
    {
      tema: 'Fato Gerador do IBS e CBS',
      artigos: ['6', '7', '8', '9'],
      descricao: 'Hipóteses de incidência: operações com bens e serviços no território nacional. Operações onerosas, com habitualidade ou volume, sobre bens corpóreos/incorpóreos e serviços.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art6',
    },
    {
      tema: 'Sujeito Passivo — Contribuinte',
      artigos: ['10', '11'],
      descricao: 'Quem paga: fornecedores de bens e serviços. Contribuinte é quem realiza operações com habitualidade ou em volume que configure atividade econômica.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art10',
    },
    {
      tema: 'Base de Cálculo do IBS e CBS',
      artigos: ['12', '13', '14', '15'],
      descricao: 'Valor da operação. Inclusão e exclusões da base. Valor de mercado para operações entre partes relacionadas. Regras para operações com descontos.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art12',
    },
    {
      tema: 'Alíquotas do IBS e CBS',
      artigos: ['16', '17', '18', '19', '20', '21', '22', '23'],
      descricao: 'Alíquotas padrão, reduzidas, zero e majoradas. Faixa de alíquota-padrão será fixada por resolução (estimativa: IBS ~8,9% + CBS ~8,8% = ~17,7% total). Reduções para: saúde, educação, transporte, agronegócio, produtor rural.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art16',
    },
    {
      tema: 'Não Cumulatividade — Creditamento Pleno',
      artigos: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
      descricao: 'Mecanismo de não cumulatividade plena: crédito sobre todas as aquisições vinculadas à atividade econômica. Distinção ativo imobilizado, estoques, serviços. Vedações ao creditamento (uso pessoal, gorjetas, benefícios a funcionários).',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art28',
    },
    {
      tema: 'Split Payment',
      artigos: ['34'],
      descricao: 'Pagamento com retenção automática de IBS/CBS na origem. Banco integrado retém e repassa ao erário sem intervenção do contribuinte. B2B a partir de 2027. Parcelamento: split na liquidação de cada parcela.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art34',
      artigos_relacionados: ['10 (sujeito)', '27 (apuração)', '31 §3º II (parcelamento)'],
    },
    {
      tema: 'Apuração do IBS e CBS',
      artigos: ['27', '28'],
      descricao: 'Período de apuração mensal. Regime de competência: tributo reconhecido na data do fato gerador (emissão do documento fiscal), não no recebimento. Obrigações acessórias.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art27',
    },
    {
      tema: 'Imposto Seletivo (IS)',
      artigos: ['153', '154', '155', '156', '157', '158', '159', '160', '161', '162', '163', '164', '165', '166'],
      descricao: 'IS sobre produtos e serviços prejudiciais à saúde ou ao meio ambiente. Lista de produtos: cigarros, bebidas alcoólicas, armas, veículos, etc. Alíquotas específicas por produto. Vigência: 2027.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art153',
    },
    {
      tema: 'Simples Nacional — IBS e CBS',
      artigos: ['99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127'],
      descricao: 'Regime específico do Simples Nacional na Reforma. Recolhimento pelo DAS/PGDAS-D durante transição. Destaque facultativo de IBS/CBS na NF-e. Art. 127: direito ao crédito restrito pelo tomador. Vedação ao aproveitamento de créditos plenos.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art99',
      artigos_destaque: ['127 (creditamento pelo tomador)', '108 (destaque facultativo NF-e)', '100 (tributação no SN)'],
    },
    {
      tema: 'Produtor Rural e Agronegócio',
      artigos: ['128', '129', '130', '131', '132', '133', '134', '135', '136', '137'],
      descricao: 'Regime especial para produtor rural pessoa física e jurídica. Alíquotas reduzidas para operações agrícolas. Creditamento para adquirentes de produtos agropecuários.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art128',
    },
    {
      tema: 'Imunidades e Isenções',
      artigos: ['49', '50', '51', '52', '53', '54', '55', '56'],
      descricao: 'Operações imunes: exportações (alíquota zero), serviços ao exterior. Isenções específicas: cesta básica nacional, medicamentos, dispositivos médicos. Reduções de 60% para saúde, educação, cultura, transporte.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art49',
    },
    {
      tema: 'Cesta Básica Nacional e Alíquota Zero',
      artigos: ['63', '64', '65', '66'],
      descricao: 'Lista de produtos com alíquota zero de IBS e CBS. Inclui alimentos essenciais, produtos de higiene básica. Lista completa no Anexo da LC 214.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art63',
    },
    {
      tema: 'Regime de Transição 2026-2033',
      artigos: ['337', '338', '339', '340', '341', '342', '343', '344', '345', '346', '347', '348', '349', '350', '351', '352', '353', '354', '355', '356', '357', '358', '359', '360', '361', '362', '363', '364', '365', '366', '367', '368', '369', '370'],
      descricao: 'Regras de coexistência entre tributos antigos (ICMS/ISS/PIS/COFINS) e novos (IBS/CBS). Cronograma de redução gradual: 10 pp/ano de 2027 a 2032. Extinção em 2033.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art337',
    },
    {
      tema: 'Obrigações Acessórias — NF-e e Documentos Fiscais',
      artigos: ['222', '223', '224', '225', '226', '227', '228'],
      descricao: 'Obrigatoriedade de emissão de documento fiscal eletrônico. Grupo RTC (Registro de Cálculo de Tributos) na NF-e. Integração com Split Payment.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art222',
      referencias_tecnicas: ['NT 2025.002 v1.34 (grupo RTC)', 'NT 2025.001 (NFC-e QR Code v3)'],
    },
    {
      tema: 'Contabilização — Regime de Competência',
      artigos: ['27', '33'],
      descricao: 'IBS e CBS reconhecidos pelo regime de competência: na data do fato gerador (emissão da NF-e), não no recebimento. LACUNA: CPC e CFC não emitiram norma específica sobre contabilização de IBS/CBS — usar CPC 51 + NBC TG 51 + CPC 00 (R2) por analogia.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art27',
      normas_contabeis: ['CPC 51 (jan/2026)', 'NBC TG 51 (fev/2026)', 'CPC 00 (R2) — Capítulo 5'],
    },
    {
      tema: 'Serviços Financeiros',
      artigos: ['167', '168', '169', '170', '171', '172', '173', '174', '175', '176', '177', '178', '179', '180', '181', '182'],
      descricao: 'Regime específico para serviços financeiros: instituições financeiras, seguros, administração de fundos. Diferenças no fato gerador e base de cálculo.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art167',
    },
    {
      tema: 'Bens Imóveis e Construção Civil',
      artigos: ['183', '184', '185', '186', '187', '188', '189', '190', '191', '192', '193', '194', '195', '196', '197', '198'],
      descricao: 'Regime de IBS/CBS sobre operações imobiliárias. Incorporação, construção civil, locação. Créditos sobre materiais de construção.',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art183',
    },
  ],
};

// ─── CATÁLOGO DE NOTAS TÉCNICAS NF-e ─────────────────────────────────────────

const NT_CATALOGO = {
  portal_url: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=',
  descricao: 'Notas Técnicas do Portal NF-e — adequações de layout e regras de validação SEFAZ',
  notas: [
    {
      codigo: 'NT 2025.002',
      versao_atual: 'v1.34',
      titulo: 'NF-e — Adequações para Reforma Tributária do Consumo (IBS/CBS/IS)',
      descricao: 'Adiciona grupo RTC (Registro de Cálculo de Tributos) à NF-e 4.0. Novos campos: vBC_IBS, pIBS, vIBS, vBC_CBS, pCBS, vCBS, vIS. Regras de validação para alíquotas por NCM.',
      vigencia: '2026',
      impacto: 'CRÍTICO — afeta todos os emissores de NF-e',
      campos_novos: ['RTC/vBC_IBS', 'RTC/pIBS', 'RTC/vIBS', 'RTC/vBC_CBS', 'RTC/pCBS', 'RTC/vCBS', 'RTC/vIS'],
      url_referencia: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=',
    },
    {
      codigo: 'NT 2025.001',
      versao_atual: 'v1.03',
      titulo: 'NFC-e — QR Code v3 e adequações para Reforma Tributária',
      descricao: 'Atualiza o QR Code da NFC-e para a versão 3, compatível com IBS/CBS. Novas regras de validação para ambiente de produção restrito.',
      vigencia: '2026',
      impacto: 'ALTO — afeta emissores de NFC-e (varejo)',
      url_referencia: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=',
    },
    {
      codigo: 'NT 2024.003',
      versao_atual: 'v1.07',
      titulo: 'NF-e — Produtos Agro',
      descricao: 'Adequações para produtos agropecuários: NCM específicos, codificação de produto animal/vegetal, integração com tabela ABNT.',
      vigencia: '2024-2026',
      impacto: 'MÉDIO — afeta setor agropecuário',
    },
    {
      codigo: 'NT 2024.002',
      versao_atual: 'v1.10',
      titulo: 'NF-e 4.0 — Estrutura geral',
      descricao: 'Documentação base da estrutura da NF-e 4.0. Referência para todos os campos do XML.',
      vigencia: '2024',
      impacto: 'REFERÊNCIA GERAL',
    },
    {
      codigo: 'NT 003 NFS-e',
      versao_atual: 'NT 003',
      titulo: 'NFS-e — Nota Fiscal de Serviços Eletrônica',
      descricao: 'Padrão nacional da NFS-e. Campos específicos para serviços, ISS e adequação para IBS/CBS municipal.',
      vigencia: '2024-2026',
      impacto: 'ALTO — afeta prestadores de serviços',
    },
    {
      codigo: 'BPe NT 2025.001',
      versao_atual: 'v1.10',
      titulo: 'BP-e — Bilhete de Passagem Eletrônico',
      descricao: 'Adequações do BP-e para IBS/CBS. Relevante para transportes de passageiros.',
      vigencia: '2025-2026',
      impacto: 'MÉDIO — setor de transporte de passageiros',
    },
  ],
  pacotes_liberacao: [
    {
      codigo: 'PL 010b v1.30',
      descricao: 'Consolida NT 2025.002 v1.34, NT 2025.001 v1.03 e NT 2024.003 v1.07. Ambiente de homologação SEFAZ.',
    },
  ],
  url_esquemas_xml: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w=',
  url_informes_tecnicos: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=hXzemuyNHW4=',
};

// ─── PADRÃO DE CITAÇÃO POR FONTE ─────────────────────────────────────────────

const PADROES_CITACAO = {
  lcp214: {
    formato: 'LC 214/2025, art. {N}, § {X}º, inciso {Y}, alínea "{z}"',
    exemplos: [
      'LC 214/2025, art. 34 — Split Payment',
      'LC 214/2025, art. 27, § 1º — apuração mensal',
      'LC 214/2025, arts. 99-127 — Simples Nacional',
    ],
    url_padrao: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art{N}',
  },
  lcp227: {
    formato: 'LC 227/2025, art. {N}',
    url_padrao: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm#art{N}',
  },
  ec132: {
    formato: 'EC 132/2023, art. {N} — CF/1988, art. {M}',
    exemplos: ['EC 132/2023, que acrescenta o art. 149-B à CF/1988'],
  },
  nt_nfe: {
    formato: 'NT {ANO}.{NRO} v{X}.{YY} — {grupo XML}/{campo}',
    exemplos: [
      'NT 2025.002 v1.34, grupo RTC, campo vIBS',
      'NT 2025.001 v1.03, QR Code v3',
    ],
  },
  cpc_nbc: {
    formato: '{CPC/NBC} {código} — {título}: {referência específica}',
    exemplos: [
      'CPC 51 — Apresentação e Divulgação nas Demonstrações Contábeis (vigência jan/2026)',
      'NBC TG 51 — Apresentação e Divulgação (vigência fev/2026, CFC)',
      'CPC 00 (R2), Capítulo 5 — Reconhecimento e Desreconhecimento',
    ],
    aviso: 'LACUNA: CPC e CFC não emitiram norma específica para contabilização de IBS/CBS. Declarar explicitamente no parecer.',
  },
};

// ─── TOOLS ───────────────────────────────────────────────────────────────────

export function registerFontesOficiaisTools(server: McpServer): void {

  // ── fonte_catalogo ──────────────────────────────────────────────────────────
  server.registerTool(
    'fonte_catalogo',
    {
      description:
        'Catálogo completo de fontes oficiais da Reforma Tributária: ' +
        'LC 214/2025, LC 227/2025, LC 224/2025, EC 132/2023, LC 123/2006, ' +
        'Portal NF-e, DFe Portal, Reforma Tributária Gov, RFB CETAD. ' +
        'Retorna URLs, status de vigência e temas cobertos por cada fonte. ' +
        'Consultar antes de iniciar qualquer pesquisa técnica sobre IBS/CBS.',
      inputSchema: {
        tipo: z
          .enum(['legislacao', 'portais', 'atos', 'todos'])
          .optional()
          .default('todos')
          .describe('"legislacao" (LCs e EC), "portais" (NF-e, DFe, RFB), "atos" (decretos e resoluções), ou "todos".'),
      },
    },
    async ({ tipo = 'todos' }) => {
      const resultado: Record<string, unknown> = {};
      if (tipo === 'todos' || tipo === 'legislacao') resultado.legislacao_federal = FONTES_CATALOGO.legislacao_federal;
      if (tipo === 'todos' || tipo === 'portais') resultado.portais_tecnicos = FONTES_CATALOGO.portais_tecnicos;
      if (tipo === 'todos' || tipo === 'atos') resultado.atos_regulamentadores = FONTES_CATALOGO.atos_regulamentadores;
      return {
        content: [{ type: 'text', text: JSON.stringify({ instrucao: 'Usar fetch na URL indicada para obter o texto integral. Citar sempre artigo, parágrafo, inciso e alínea.', ...resultado }, null, 2) }],
      };
    },
  );

  // ── fonte_lc214_mapa_temas ──────────────────────────────────────────────────
  server.registerTool(
    'fonte_lc214_mapa_temas',
    {
      description:
        'Mapa completo de temas da LC 214/2025 com os artigos correspondentes e URL direta para cada seção. ' +
        'Usar para localizar rapidamente quais artigos regulam um tema específico (Split Payment, Simples Nacional, ' +
        'não cumulatividade, fato gerador, alíquotas, transição, etc.) antes de fazer fetch do texto legal.',
      inputSchema: {
        tema: z
          .string()
          .optional()
          .describe('Filtrar por tema (ex: "split", "simples", "aliquota", "transicao", "nao cumul"). Se omitido, retorna mapa completo.'),
      },
    },
    async ({ tema }) => {
      const temas = tema
        ? LC214_MAPA_TEMAS.temas.filter(
            (t) =>
              t.tema.toLowerCase().includes(tema.toLowerCase()) ||
              t.descricao.toLowerCase().includes(tema.toLowerCase()),
          )
        : LC214_MAPA_TEMAS.temas;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                lei: LC214_MAPA_TEMAS.lei,
                url_base: LC214_MAPA_TEMAS.url_base,
                como_citar: LC214_MAPA_TEMAS.como_citar,
                instrucao_fetch: LC214_MAPA_TEMAS.instrucao_fetch,
                total_temas: temas.length,
                temas,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── fonte_artigo_url ────────────────────────────────────────────────────────
  server.registerTool(
    'fonte_artigo_url',
    {
      description:
        'Gera a URL direta para fetch de um artigo específico de uma Lei Complementar. ' +
        'Use para obter o texto exato do artigo antes de citá-lo em um parecer ou resposta técnica. ' +
        'Suporta: LC 214/2025, LC 227/2025, LC 224/2025, LC 123/2006, EC 132/2023.',
      inputSchema: {
        lei: z
          .enum(['lcp214', 'lcp227', 'lcp224', 'lcp123', 'ec132'])
          .describe('Identificador da lei'),
        artigo: z
          .string()
          .describe('Número do artigo (ex: "34", "127", "337"). Sem o "art." — apenas o número.'),
      },
    },
    async ({ lei, artigo }) => {
      const urls: Record<string, string> = {
        lcp214: `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art${artigo}`,
        lcp227: `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm#art${artigo}`,
        lcp224: `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp224.htm#art${artigo}`,
        lcp123: `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm#art${artigo}`,
        ec132: `https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm#art${artigo}`,
      };
      const nomes: Record<string, string> = {
        lcp214: 'LC 214/2025',
        lcp227: 'LC 227/2025',
        lcp224: 'LC 224/2025',
        lcp123: 'LC 123/2006',
        ec132: 'EC 132/2023',
      };
      const url = urls[lei];
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                lei: nomes[lei],
                artigo: `art. ${artigo}`,
                url_fetch: url,
                citacao_padrao: `${nomes[lei]}, art. ${artigo}`,
                instrucao: `Fazer fetch desta URL para obter o texto exato do artigo antes de citar no parecer.`,
                padroes_citacao: PADROES_CITACAO[lei as keyof typeof PADROES_CITACAO] ?? null,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── fonte_nt_catalogo ───────────────────────────────────────────────────────
  server.registerTool(
    'fonte_nt_catalogo',
    {
      description:
        'Catálogo das Notas Técnicas NF-e disponíveis no Portal da Fazenda. ' +
        'Retorna código, versão, título, campos XML novos e URL de referência. ' +
        'Fundamental para pareceres sobre emissão de NF-e com IBS/CBS (grupo RTC) e NFC-e.',
      inputSchema: {
        nota: z
          .string()
          .optional()
          .describe('Filtrar por código da nota (ex: "2025.002", "2025.001"). Se omitido, retorna todas.'),
      },
    },
    async ({ nota }) => {
      const notas = nota
        ? NT_CATALOGO.notas.filter((n) => n.codigo.includes(nota))
        : NT_CATALOGO.notas;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                portal_url: NT_CATALOGO.portal_url,
                url_esquemas_xml: NT_CATALOGO.url_esquemas_xml,
                url_informes_tecnicos: NT_CATALOGO.url_informes_tecnicos,
                pacotes_liberacao: NT_CATALOGO.pacotes_liberacao,
                total: notas.length,
                notas,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── fonte_rfb_cetad ─────────────────────────────────────────────────────────
  server.registerTool(
    'fonte_rfb_cetad',
    {
      description:
        'Informações sobre o portal de Notas Técnicas CETAD da Receita Federal do Brasil. ' +
        'Contém estudos fiscais, projeções de arrecadação, análises sobre alíquotas e impactos da Reforma. ' +
        'Usar quando precisar de dados quantitativos (alíquotas estimadas, impacto fiscal) para fundamentar pareceres.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              portal_url: 'https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/estudos/notas-cetad/notas-tecnicas',
              descricao: 'Centro de Estudos Tributários e Aduaneiros da RFB. Publica notas técnicas com análises quantitativas sobre alíquotas, arrecadação e impactos da Reforma Tributária.',
              instrucao: 'Fazer fetch da URL para obter a lista de notas disponíveis. Filtrar pela data mais recente.',
              notas_relevantes_conhecidas: [
                { titulo: 'Projeção de alíquotas de referência IBS/CBS', descricao: 'Estimativa: IBS ~8,9% + CBS ~8,8% = total ~17,7% (alíquota padrão)' },
                { titulo: 'Impacto fiscal da transição 2026-2032', descricao: 'Análise de arrecadação durante coexistência dos regimes' },
                { titulo: 'Notas sobre Simples Nacional e Reforma', descricao: 'Impacto nos microempreendedores e estratégia de migração' },
              ],
              aviso: 'Verificar sempre a data de publicação. Alíquotas definitivas dependem de resolução do CGIBS e do Senado ainda não publicada.',
            },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
