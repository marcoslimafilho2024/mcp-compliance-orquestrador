/**
 * tools/alegacoes.tools.ts
 * Metodologia para elaboração de alegações e respostas técnicas tributárias
 * Baseado nos modelos e pareceres da Consultoria Guerra Advogados
 *
 * Tools:
 *   alegacao_estrutura_resposta   — 7 tópicos obrigatórios para respostas técnicas
 *   alegacao_hierarquia_fontes    — ordem de prioridade de fontes legais
 *   alegacao_glossario            — termos IBS/CBS/IS/Simples Nacional
 *   alegacao_cronograma_transicao — cronograma Reforma Tributária 2026-2033
 *   alegacao_boas_praticas        — exemplos de boas e más práticas
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ─── ESTRUTURA DE RESPOSTA TÉCNICA ───────────────────────────────────────────

const ESTRUTURA_RESPOSTA_TECNICA = {
  descricao:
    'Formato padrão para respostas técnicas e alegações tributárias (Consultorias Guerra). ' +
    'Aplicar em toda resposta a questionamento de cliente sobre IBS/CBS, Simples Nacional ou Reforma Tributária.',
  formato: 'Dissertativo, profissional. Sem numeração de parágrafos. Tópicos claros no início de cada parágrafo.',
  topicos: [
    {
      numero: 1,
      titulo: 'Contexto do Questionamento',
      descricao:
        'Reapresentar o questionamento do cliente com clareza. ' +
        'Identificar a situação fática, o período de referência e as perguntas formuladas. ' +
        'Não responder ainda — apenas contextualizar.',
      exemplo:
        'A consulente indaga sobre o tratamento tributário do Split Payment em operações B2B parceladas, ' +
        'tendo em vista a previsão da LC 214/2025 e as orientações da AFRAC em live de 07/05/2025.',
    },
    {
      numero: 2,
      titulo: 'Base Legal Atualizada',
      descricao:
        'Citar expressamente todos os dispositivos legais aplicáveis: artigo, parágrafo, inciso, alínea. ' +
        'Seguir a hierarquia normativa. Nunca mencionar norma sem indicar o dispositivo específico.',
      formato_citacao: 'LC 214/2025, art. 27, § 3º, inciso II, alínea "a"',
      exemplo:
        'A matéria é regulada pela Lei Complementar nº 214, de 16 de janeiro de 2025, ' +
        'especialmente em seus artigos 10, 27, 31, § 3º, inciso II, e 34, que disciplinam ' +
        'o Split Payment e o regime de apuração do IBS e da CBS.',
    },
    {
      numero: 3,
      titulo: 'Interpretação Normativa',
      descricao:
        'Analisar tecnicamente o dispositivo legal. ' +
        'Explicar o que a norma diz, seu alcance e limites. ' +
        'Indicar, quando houver, posicionamento doutrinário ou manifestação oficial. ' +
        'Se a norma não trata o ponto expressamente, declarar isso: "A legislação não trata expressamente deste ponto."',
      proibido: 'Nunca emitir opinião pessoal sem base normativa. Nunca afirmar que a RFB "provavelmente" interpretará de tal forma.',
    },
    {
      numero: 4,
      titulo: 'Implicações Práticas',
      descricao:
        'Consequências concretas para o contribuinte: impacto fiscal, operacional e contábil. ' +
        'Usar exemplos numéricos quando relevante. Tabelas para dados comparativos.',
      exemplo:
        'Em uma venda de R$ 10.000 parcelada em 5x, com IBS 10% e CBS 8,8%: ' +
        'a apuração do período (competência) reconhece R$ 1.880 de tributos na data da NF-e; ' +
        'o fluxo de caixa, porém, é liquidado proporcionalmente a cada parcela via Split Payment.',
    },
    {
      numero: 5,
      titulo: 'Orientações Operacionais',
      descricao:
        'O que o cliente deve fazer concretamente: procedimentos, prazos, ajustes em sistemas, ' +
        'campos a preencher no XML da NF-e, registros contábeis a efetuar. ' +
        'Linguagem imperativa e direta.',
      exemplo:
        'Operacionalmente, a empresa deverá: (1) emitir a NF-e com valor integral da operação; ' +
        '(2) informar no grupo RTC os valores de IBS e CBS devidos; ' +
        '(3) registrar contabilmente o tributo pelo regime de competência na data da emissão.',
    },
    {
      numero: 6,
      titulo: 'Vedações ou Exceções',
      descricao:
        'Restrições legais expressas, casos excluídos da regra geral, riscos de autuação fiscal. ' +
        'Alertar para práticas que possam configurar infração ou autuação.',
    },
    {
      numero: 7,
      titulo: 'Citações Complementares',
      descricao:
        'Jurisprudência (STF, STJ, TRFs, CARF), Soluções de Consulta RFB, ' +
        'manifestações SEFAZ, doutrina especializada, lives AFRAC, atos normativos secundários. ' +
        'Incluir somente quando aplicável ao tema.',
    },
  ],
  instrucoes_redacao: [
    'Formato dissertativo — sem numeração de parágrafos',
    'Cada tópico identificado no início do parágrafo correspondente',
    'Tom profissional, assertivo e pedagógico',
    'Evitar juridiquês desnecessário e ambiguidades',
    'Preferir clareza, objetividade e exemplos práticos',
    'Indicar sempre o ano de referência em questões de transição (2026, 2027, 2033...)',
  ],
  checklist_antes_de_finalizar: [
    'Base legal citada expressamente (art., inciso, alínea)?',
    'Interpretação clara e fundamentada?',
    'Implicações práticas explicadas?',
    'Orientações operacionais objetivas?',
    'Vedações/exceções indicadas (se houver)?',
    'Citações complementares incluídas (se aplicável)?',
    'Formato dissertativo, sem numeração de parágrafos?',
    'Tom profissional e pedagógico?',
    'Português correto, sem travessões, sem palavras-IA?',
  ],
};

// ─── HIERARQUIA DE FONTES ─────────────────────────────────────────────────────

const HIERARQUIA_FONTES = {
  descricao:
    'Ordem de prioridade para buscar e citar fundamentação em pareceres e respostas técnicas. ' +
    'Norma superior prevalece sobre inferior.',
  niveis: [
    {
      nivel: 1,
      tipo: 'Constituição Federal',
      exemplos: ['EC 132/2023 — Reforma Tributária', 'CF/1988, art. 149-B — tributação por fora e não cumulatividade'],
    },
    {
      nivel: 2,
      tipo: 'Leis Complementares',
      exemplos: [
        'LC 214/2025 — IBS, CBS e Imposto Seletivo',
        'LC 123/2006 — Simples Nacional',
        'LC 227/2026 — alterações na LC 214',
      ],
    },
    {
      nivel: 3,
      tipo: 'Leis Ordinárias e Decretos',
      exemplos: [
        'Lei 9.249/1995 — Lucro Presumido',
        'Lei 9.430/1996 — Lucro Real',
        'Decreto 9.580/2018 — RIR (Regulamento do IR)',
      ],
    },
    {
      nivel: 4,
      tipo: 'Notas Técnicas SEFAZ/RFB',
      exemplos: [
        'NT 2025.002 v1.30 — NF-e com IBS/CBS (grupo RTC)',
        'NT 2025.001 — NFC-e QR Code v3',
        'NT 2024.003 — Produtos Agro NF-e',
      ],
    },
    {
      nivel: 5,
      tipo: 'Resoluções e Atos Conjuntos',
      exemplos: [
        'Resolução CGSN 140/2018 — Simples Nacional (PGDAS-D)',
        'Resolução CGSB nº 6/2026 — Regulamento IBS',
        'Ato Conjunto RFB/CGIBS nº 1/2025 — penalidades fase teste',
      ],
    },
    {
      nivel: 6,
      tipo: 'Manifestações Oficiais',
      exemplos: [
        'Lives AFRAC — posicionamentos SEFAZ',
        'Informe Técnico 2026.002 — alíquotas CBS 0,9% + IBS 0,1%',
        'Webinars RFB — esclarecimentos operacionais',
      ],
    },
    {
      nivel: 7,
      tipo: 'Jurisprudência',
      exemplos: ['STF', 'STJ', 'TRFs', 'CARF — acórdãos e súmulas'],
    },
    {
      nivel: 8,
      tipo: 'Doutrina Especializada',
      exemplos: [
        'CPC 00 (R2) — Estrutura Conceitual',
        'CPC 51 / NBC TG 51 — Apresentação e Divulgação (2026)',
        'Manual FIPECAFI',
        'Artigos acadêmicos e comentários de especialistas',
      ],
    },
  ],
  regra_lacuna:
    'Se a legislação não trata expressamente o ponto, declarar: ' +
    '"A legislação não trata expressamente deste ponto. ' +
    'Recomenda-se acompanhar a publicação de Instrução Normativa ou Solução de Consulta sobre o tema."',
  proibido: [
    'Afirmar que a RFB "provavelmente vai interpretar" sem ato normativo',
    'Emitir opinião pessoal como se fosse posicionamento legal',
    'Citar norma revogada sem indicar a norma revogadora',
  ],
};

// ─── GLOSSÁRIO IBS/CBS/SN ─────────────────────────────────────────────────────

const GLOSSARIO = {
  descricao: 'Termos técnicos da Reforma Tributária e do Simples Nacional com base legal.',
  termos: [
    { sigla: 'IBS', nome: 'Imposto sobre Bens e Serviços', descricao: 'Substitui ICMS (estadual) e ISS (municipal) a partir de 2033', base_legal: 'LC 214/2025' },
    { sigla: 'CBS', nome: 'Contribuição sobre Bens e Serviços', descricao: 'Substitui PIS e COFINS (federais) a partir de 2033', base_legal: 'LC 214/2025' },
    { sigla: 'IS', nome: 'Imposto Seletivo', descricao: 'Incide sobre produtos e serviços considerados nocivos (cigarro, bebidas, etc.)', base_legal: 'LC 214/2025' },
    {
      sigla: 'Split Payment',
      nome: 'Pagamento com Retenção Automática',
      descricao:
        'Sistema em que o banco retém automaticamente IBS/CBS no momento do pagamento, ' +
        'repassando ao erário sem intervenção do contribuinte. B2B a partir de 2027.',
      base_legal: 'LC 214/2025, art. 34',
    },
    { sigla: 'RTC', nome: 'Registro de Cálculo de Tributos', descricao: 'Grupo XML obrigatório na NF-e 4.0 para informar IBS, CBS e IS', base_legal: 'NT 2025.002 v1.30' },
    { sigla: 'PGDAS-D', nome: 'Programa Gerador do Documento de Arrecadação do Simples Nacional', descricao: 'Sistema de apuração e recolhimento unificado do Simples Nacional', base_legal: 'Resolução CGSN 140/2018' },
    { sigla: 'RBT12', nome: 'Receita Bruta Total dos últimos 12 meses', descricao: 'Base de cálculo da alíquota progressiva do Simples Nacional', base_legal: 'LC 123/2006' },
    { sigla: 'Fator R', nome: 'Relação Folha/Receita Bruta', descricao: 'Define se empresa de serviços aplica Anexo III ou V do Simples Nacional', base_legal: 'LC 123/2006, Anexo V' },
    { sigla: 'AFRAC', nome: 'Associação Brasileira das Secretarias de Finanças das Capitais', descricao: 'Entidade que representa as Secretarias de Finanças municipais e publica orientações sobre IBS/CBS', base_legal: null },
    { sigla: 'CGIBS', nome: 'Comitê Gestor do IBS', descricao: 'Órgão responsável pela administração do IBS nos âmbitos estadual e municipal', base_legal: 'LC 214/2025, art. 56' },
    { sigla: 'CGSN', nome: 'Comitê Gestor do Simples Nacional', descricao: 'Órgão responsável pela regulamentação do Simples Nacional', base_legal: 'LC 123/2006' },
    { sigla: 'DAS', nome: 'Documento de Arrecadação do Simples Nacional', descricao: 'Guia unificada de recolhimento do Simples Nacional, gerada pelo PGDAS-D', base_legal: 'LC 123/2006' },
    { sigla: 'NF-e', nome: 'Nota Fiscal Eletrônica', descricao: 'Modelo 55 — obrigatória para operações de venda de mercadorias B2B', base_legal: 'NT 2025.002' },
    { sigla: 'NFC-e', nome: 'Nota Fiscal de Consumidor Eletrônica', descricao: 'Modelo 65 — obrigatória para operações B2C (varejo)', base_legal: 'NT 2025.001' },
    { sigla: 'BP-e', nome: 'Bilhete de Passagem Eletrônico', descricao: 'Documento fiscal para transporte de passageiros', base_legal: 'BPe NT 2025.001' },
    { sigla: 'CPC 51', nome: 'Apresentação e Divulgação nas Demonstrações Contábeis', descricao: 'Nova norma contábil em vigor desde 01/01/2026, obrigatória para DRE com IBS/CBS', base_legal: 'CPC 51, vigência: 07/01/2026' },
    { sigla: 'NBC TG 51', nome: 'Apresentação e Divulgação nas Demonstrações Contábeis (CFC)', descricao: 'Equivalente ao CPC 51 emitido pelo Conselho Federal de Contabilidade', base_legal: 'NBC TG 51, vigência: 25/02/2026' },
    { sigla: 'DAE', nome: 'Documento de Arrecadação do e-Social', descricao: 'Guia de recolhimento de contribuições previdenciárias — NÃO confundir com DAS do Simples', base_legal: null },
  ],
};

// ─── CRONOGRAMA DE TRANSIÇÃO ──────────────────────────────────────────────────

const CRONOGRAMA_TRANSICAO = {
  descricao: 'Cronograma oficial de implementação da Reforma Tributária. Sempre indicar o ano de referência nas respostas técnicas.',
  vigencia_plena: 2033,
  fases: [
    {
      periodo: '2026',
      titulo: 'Fase de Testes',
      descricao: 'Participação facultativa. Alíquotas teste: CBS 0,9% + IBS 0,1%. Penalidades suspensas até 31/05/2026.',
      tributos_antigos: 'ICMS/ISS/PIS/COFINS integrais — sem redução ainda',
      obrigacoes: ['Informar grupo RTC na NF-e (facultativo em 2026)', 'PGDAS-D continua para Simples Nacional'],
      base_legal: ['LC 214/2025', 'Ato Conjunto RFB/CGIBS nº 1/2025', 'Informe Técnico 2026.002'],
    },
    {
      periodo: '2027',
      titulo: 'Início da Transição',
      descricao: 'Início da cobrança efetiva de IBS e CBS. Split Payment B2B implementado. Imposto Seletivo (IS) entra em vigor.',
      tributos_antigos: 'Redução de 10 pp nos tributos antigos (ICMS/ISS/PIS/COFINS)',
      obrigacoes: [
        'Grupo RTC na NF-e obrigatório',
        'Split Payment B2B obrigatório nas operações com pagamento bancário integrado',
        'IS incide sobre produtos nocivos',
      ],
      base_legal: ['LC 214/2025', 'art. 34 — Split Payment'],
    },
    {
      periodo: '2028-2032',
      titulo: 'Redução Gradual',
      descricao: 'Redução progressiva de 10 pp/ano nos tributos antigos. Coexistência entre regimes antigo e novo.',
      tributos_antigos: 'Redução de 10 pp/ano: 20% em 2028, 30% em 2029... até 80% em 2032',
      obrigacoes: ['Apuração paralela dos dois sistemas durante a transição'],
      base_legal: ['LC 214/2025, arts. de transição'],
    },
    {
      periodo: '2033',
      titulo: 'Vigência Plena',
      descricao: 'IBS e CBS substituem integralmente ICMS, ISS, PIS e COFINS. Extinção dos tributos antigos.',
      tributos_antigos: 'Extintos: ICMS, ISS, PIS, COFINS',
      tributos_novos: 'IBS + CBS + IS em vigor pleno',
      base_legal: ['LC 214/2025'],
    },
  ],
  simples_nacional: {
    transicao: [
      '2026-2028: recolhimento exclusivo pelo PGDAS-D (Simples mantém separação)',
      '2029+: integração progressiva do IBS/CBS ao DAS (aguardando regulamentação CGIBS/RFB)',
      'Destaque de IBS/CBS na NF-e: facultativo para empresas do Simples em 2026',
    ],
    credito_restrito: 'Tomadores de serviços de empresas do Simples terão crédito restrito de IBS/CBS — percentual exato aguarda regulamentação do CGIBS',
  },
  aviso_atualidade:
    'Este cronograma reflete a LC 214/2025 consolidada até jun/2026. ' +
    'Verificar se houve publicação de LC, PLP ou regulamento subsequente antes de responder ao cliente.',
};

// ─── BOAS PRÁTICAS ────────────────────────────────────────────────────────────

const BOAS_PRATICAS = {
  descricao: 'Exemplos de boas e más práticas na elaboração de respostas técnicas e alegações.',
  regras_fundamentais: [
    'Sempre citar dispositivo legal completo (art., §, inciso, alínea)',
    'Nunca afirmar sem amparo normativo',
    'Indicar sempre o ano de referência em questões de transição',
    'Declarar expressamente a lacuna quando a lei não tratar o ponto',
    'Diferenciar "o que a lei diz" de "como pode ser interpretado"',
    'Alertar para risco de autuação quando houver incerteza',
    'Sugerir consulta formal à RFB/SEFAZ em casos muito complexos',
    'Revisar pareceres a cada trimestre — a legislação muda com frequência',
  ],
  exemplos: [
    {
      categoria: 'citacao',
      bom: 'Conforme disposto na Lei Complementar nº 214, de 16 de janeiro de 2025, em seu artigo 27, § 3º, inciso II, o Split Payment em operações B2B com parcelamento incidirá sobre cada parcela no momento de sua liquidação efetiva.',
      ruim: 'A lei prevê que o Split Payment funciona no parcelamento.',
      por_que: 'Citação genérica não permite ao cliente verificar a fonte nem sustentar a posição em defesa fiscal.',
    },
    {
      categoria: 'orientacao',
      bom: 'A empresa deverá: (1) emitir a NF-e com valor integral da operação; (2) informar no grupo RTC (Registro de Cálculo de Tributos) os valores de IBS e CBS devidos; (3) no momento da liquidação de cada parcela, o adquirente retém automaticamente a proporção correspondente de IBS/CBS via Split Payment; (4) a apuração mensal considera o regime de competência (data da emissão da NF-e), não o regime de caixa.',
      ruim: 'A empresa deve emitir nota fiscal e recolher os tributos conforme a lei.',
      por_que: 'Orientação vaga não ajuda o cliente a agir. Orientação operacional tem que ser executável.',
    },
    {
      categoria: 'lacuna',
      bom: 'Importante ressaltar que, até a presente data (jun/2026), não há regulamentação específica por parte do CGIBS sobre o percentual exato do crédito restrito para tomadores de serviços de empresas do Simples Nacional. Recomenda-se acompanhar a publicação de Resolução do Comitê Gestor do IBS sobre o tema.',
      ruim: 'Entende-se que o CGIBS provavelmente vai regulamentar da seguinte forma...',
      por_que: 'Antecipar regulamentação sem base normativa expõe o cliente a risco de autuação.',
    },
    {
      categoria: 'generalizacao',
      bom: 'No caso concreto da Empresa X (Mentoria Cataratas), Lucro Presumido apresentou carga de 6,72% vs. 10,70% do Simples, pois a margem real (42%) é muito superior à presumida de comércio (8%). Cada caso deve ser simulado individualmente.',
      ruim: 'Lucro Presumido é sempre melhor que Simples Nacional.',
      por_que: 'Cada empresa tem perfil tributário próprio. Generalizações podem levar a decisões equivocadas.',
    },
    {
      categoria: 'transicao',
      bom: 'O ICMS será gradualmente extinto entre 2027 e 2032, com redução de 10 p.p./ano. Em 2026 haverá regime de testes (CBS 0,9% + IBS 0,1%), e somente em 2033 o IBS substituirá integralmente ICMS e ISS (LC 214/2025, arts. de transição).',
      ruim: 'A partir de 2026 não existe mais ICMS.',
      por_que: 'Afirmação falsa. O ICMS coexiste com o IBS até 2032. Erro com consequências fiscais graves.',
    },
  ],
  o_que_nao_fazer: [
    'Emitir opinião pessoal sem base legal',
    'Copiar literalmente texto de lei sem interpretar',
    'Afirmar algo sem citar a fonte',
    'Recomendar práticas que configurem elisão ou evasão fiscal',
    'Responder sobre temas fora da especialidade sem ressalva',
    'Ignorar o período de transição 2026-2032',
    'Tratar regulamentação futura como certa quando não há norma publicada',
  ],
  pareceres_modelo_referencia: {
    descricao: 'Biblioteca de Pareceres Técnicos modelo elaborados pela Consultoria Guerra.',
    caminho: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\Consultorias Guerra\\00_Modelos\\',
    lista: [
      { numero: 'PT 01', tema: 'Conceito de Receita para fins de RBT12 (Simples Nacional)' },
      { numero: 'PT 02', tema: 'Multa por Atraso na Entrega do PGDAS-D' },
      { numero: 'PT 03', tema: 'Fragmentação de Negócios — riscos e vedações' },
      { numero: 'PT 04', tema: 'Cálculo de RBT12 e Fator R — Simples Nacional' },
      { numero: 'PT 05', tema: 'Opção pelo Simples Nacional e recolhimento do IVA (IBS/CBS)' },
      { numero: 'PT 06', tema: 'Destaque de IVA (IBS/CBS) na NF-e por empresas do Simples' },
      { numero: 'PT 07', tema: 'Emissão de NF-e a partir de 2026 — novas exigências' },
      { numero: 'PT 08', tema: 'Classificação de Bens e Serviços na NF-e com IBS/CBS' },
      { numero: 'PT 09', tema: 'Diversos questionamentos — compilação de temas frequentes' },
      { numero: 'PT 10', tema: 'Art. 127 e 277 da LC 214/2025 — destaque e creditamento no Simples' },
    ],
    instrucao: 'Consultar o PT modelo antes de elaborar resposta sobre tema já coberto. Referenciar o PT na citação complementar quando aplicável.',
  },
};

// ─── TOOLS ───────────────────────────────────────────────────────────────────

export function registerAlegacoesTools(server: McpServer): void {

  // ── alegacao_estrutura_resposta ─────────────────────────────────────────────
  server.registerTool(
    'alegacao_estrutura_resposta',
    {
      description:
        'Retorna a estrutura de 7 tópicos obrigatórios para elaboração de respostas técnicas e alegações tributárias. ' +
        'Usar SEMPRE ao iniciar uma resposta técnica a questionamento de cliente sobre IBS/CBS, Simples Nacional, Reforma Tributária ou qualquer tema tributário. ' +
        'Inclui formato dissertativo, exemplos e checklist de qualidade.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(ESTRUTURA_RESPOSTA_TECNICA, null, 2) }],
    }),
  );

  // ── alegacao_hierarquia_fontes ──────────────────────────────────────────────
  server.registerTool(
    'alegacao_hierarquia_fontes',
    {
      description:
        'Retorna a hierarquia de 8 níveis de fontes legais para fundamentação de pareceres e respostas técnicas. ' +
        'Consultar ao pesquisar base legal — norma superior prevalece sobre inferior. ' +
        'Inclui regra de lacuna normativa e o que é proibido afirmar.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(HIERARQUIA_FONTES, null, 2) }],
    }),
  );

  // ── alegacao_glossario ──────────────────────────────────────────────────────
  server.registerTool(
    'alegacao_glossario',
    {
      description:
        'Glossário de termos técnicos da Reforma Tributária (IBS, CBS, IS, Split Payment, RTC, PGDAS-D, Fator R, etc.) com base legal. ' +
        'Usar para verificar definições antes de citar termos em pareceres e respostas técnicas.',
      inputSchema: {
        sigla: z
          .string()
          .optional()
          .describe('Filtrar por sigla específica (ex: "IBS", "Split Payment"). Se omitido, retorna todos os termos.'),
      },
    },
    async ({ sigla }) => {
      const termos = sigla
        ? GLOSSARIO.termos.filter((t) => t.sigla.toLowerCase().includes(sigla.toLowerCase()))
        : GLOSSARIO.termos;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ descricao: GLOSSARIO.descricao, total: termos.length, termos }, null, 2),
          },
        ],
      };
    },
  );

  // ── alegacao_cronograma_transicao ───────────────────────────────────────────
  server.registerTool(
    'alegacao_cronograma_transicao',
    {
      description:
        'Cronograma oficial de implementação da Reforma Tributária 2026-2033. ' +
        'Consultar SEMPRE ao responder questões sobre vigência de IBS/CBS, datas de obrigatoriedade e coexistência com tributos antigos. ' +
        'Inclui regras específicas do Simples Nacional na transição.',
      inputSchema: {
        ano: z
          .string()
          .optional()
          .describe('Filtrar por ano ou período (ex: "2026", "2027", "2033"). Se omitido, retorna o cronograma completo.'),
      },
    },
    async ({ ano }) => {
      const fases = ano
        ? CRONOGRAMA_TRANSICAO.fases.filter((f) => f.periodo.includes(ano))
        : CRONOGRAMA_TRANSICAO.fases;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                descricao: CRONOGRAMA_TRANSICAO.descricao,
                vigencia_plena: CRONOGRAMA_TRANSICAO.vigencia_plena,
                aviso: CRONOGRAMA_TRANSICAO.aviso_atualidade,
                fases,
                simples_nacional: CRONOGRAMA_TRANSICAO.simples_nacional,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── alegacao_boas_praticas ──────────────────────────────────────────────────
  server.registerTool(
    'alegacao_boas_praticas',
    {
      description:
        'Exemplos de boas e más práticas na elaboração de respostas técnicas tributárias (metodologia Guerra Advogados). ' +
        'Inclui exemplos de citação legal, orientações operacionais, indicação de lacunas e o que NUNCA fazer. ' +
        'Também retorna a biblioteca de 10 Pareceres Técnicos modelo como referência.',
      inputSchema: {
        categoria: z
          .enum(['citacao', 'orientacao', 'lacuna', 'generalizacao', 'transicao', 'todas'])
          .optional()
          .default('todas')
          .describe('Filtrar por categoria de exemplo. Use "todas" para retornar tudo.'),
      },
    },
    async ({ categoria = 'todas' }) => {
      const exemplos =
        categoria === 'todas'
          ? BOAS_PRATICAS.exemplos
          : BOAS_PRATICAS.exemplos.filter((e) =>
              e.categoria.toLowerCase().includes(categoria.toLowerCase()),
            );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                regras_fundamentais: BOAS_PRATICAS.regras_fundamentais,
                o_que_nao_fazer: BOAS_PRATICAS.o_que_nao_fazer,
                exemplos,
                pareceres_modelo: BOAS_PRATICAS.pareceres_modelo_referencia,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
