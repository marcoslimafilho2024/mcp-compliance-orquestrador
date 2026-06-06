import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TEMPLATE_MENTORIA = {
  arquivo: 'MODELO DE ENTREGA MENTORIA FG.docx',
  caminho_windows: 'G:\\Meu Drive\\Projetos de Execução\\_Dados_Base\\Genesis\\_layouts\\ENTREGAS MENTORIA FG\\MODELO DE ENTREGA MENTORIA FG.docx',
  tipo: 'docx',
  proposito: 'Template de entrega de encontro de mentoria individual — Prof. Fellipe Guerra',
  quando_usar: 'Cada encontro mensal da mentoria individual. Gera dois documentos por sessão: Alinhamento (entrega ao cliente) e Nota Técnica (parecer formal de consultoria).',
  script_gerador: 'C:\\Users\\Administrador\\gerar_entrega_mentoria_mq.py',
  ja_formatado: true,
  documentos_gerados: [
    '{YYYYMMDD}_Encontro{N:02d}_{Tema}_Alinhamento_VF.docx',
    '{YYYYMMDD}_Encontro{N:02d}_{Tema}_NotaTecnica_VF.docx',
  ],
  pasta_destino: 'G:\\Meu Drive\\Projetos de Execução\\Consultorias\\Guerra\\09_Mentorias Individuais\\{cliente}\\01_Sessoes\\{YYYYMMDD}_Encontro{N:02d}\\_entrega',
};

const SCHEMA_MENTORIA = {
  _meta: {
    schema_version: '1.0.0',
    template: 'MODELO DE ENTREGA MENTORIA FG.docx',
    mcp_tool: 'Compliance > mentoria_fg_schema',
    descricao: 'Schema de dados para preenchimento dinâmico do documento de encontro de mentoria. Todos os campos com valor null são obrigatoriamente preenchidos pelo usuário ou calculados pelo servidor MCP antes da renderização.',
  },

  cliente: {
    razao_social: null,
    cnpj: null,
    solicitante: null,
    mentor: 'Prof. Fellipe Guerra',
    apoio_estrategico: 'Marcos Lima',
  },

  mentoria: {
    data_inicio: null,
    duracao_meses: 6,
    mes_atual: '__calculado: Math.ceil(daysDiff(data_inicio, today) / 30)__',
  },

  encontro: {
    numero: null,
    titulo: null,
    data: null,
    data_formatada_ptBR: "__calculado: encontro.data.toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})__",
  },

  diagnostico_escritorio: {
    _preenchimento: 'UMA VEZ na abertura da mentoria — reutilizado em todos os encontros',
    clientes_total: null,
    clientes_bpo: null,
    colaboradores: null,
    clientes_lp: null,
    pct_lp: null,
    clientes_sn: null,
    pct_sn: null,
    clientes_lr: null,
    pct_lr: null,
    food_service_total: null,
    food_restaurantes: null,
    food_lanchonetes: null,
    regimes_proprios_total: null,
    construcao: null,
    imobiliario: null,
    saude: null,
    equipe_tecnica_total: null,
    equipe_fiscal: null,
    equipe_contabil: null,
    sistemas: [],
    conclusao_narrativa: '__template: se null, usar texto padrão do documento__',
  },

  meta_mentoria: {
    _preenchimento: 'Primeiro encontro — persiste em toda a trilha',
    meta_projetos_6meses: null,
    meta_receita_alvo: null,
    foco_inicial: null,
    _referencia_parecer: {
      projecao_conservadora_min: 25000,
      projecao_conservadora_max: 40000,
      ciclo_validacao_dias: 90,
    },
  },

  frentes_trabalho: [
    {
      id: 'destino',
      indice: 1,
      titulo: 'Destino — a meta dos seis meses',
      descricao_template: 'Definir o resultado concreto: quantos projetos de Reforma Tributária vender, quanta receita gerar e o foco inicial — começando pela própria carteira, onde a autoridade já existe.',
      firmado: '__sugerido: `Meta: ${meta_projetos_6meses} projetos · R$ ${meta_receita_alvo} · Foco: ${foco_inicial}`__',
    },
    {
      id: 'produto',
      indice: 2,
      titulo: 'Produto — a jornada do serviço',
      descricao_template: 'O coração do trabalho. Jornada: Raio-X de Impacto → Implementação → Acompanhamento → Suporte recorrente.',
      firmado: null,
      servico_prioritario_1: null,
      servico_prioritario_2: null,
      _sugestao_parecer: 'Diagnóstico LP (R$ 1.200) + Planejamento Tributário Recorrente LP (R$ 700/mês)',
    },
    {
      id: 'capacidade',
      indice: 3,
      titulo: 'Capacidade — quem entrega',
      descricao_template: 'A tecnologia escala a execução, mas todo projeto de alto valor precisa de um dono técnico.',
      firmado: null,
      lider_tecnico_rt: null,
      time_apoio: [],
      capacidade_projetos_simultaneos: null,
      _base: 'diagnostico_escritorio.equipe_fiscal + equipe_contabil',
    },
    {
      id: 'plano',
      indice: 4,
      titulo: 'Plano — os próximos 30 dias',
      descricao_template: 'Saímos do encontro com três entregáveis: estrutura do produto, mapeamento da carteira e seleção dos três clientes-piloto.',
      firmado: null,
      _sincronizado_com: 'compromissos[0,1,2]',
    },
  ],

  pilotos: [
    {
      indice: 1,
      nome_empresa: null,
      regime: null,
      regime_enum: ['LP', 'SN', 'LR'],
      segmento: null,
      motivo_escolha: null,
      urgencia: null,
      urgencia_enum: ['Alta', 'Média', 'Baixa'],
      data_contato_prevista: null,
    },
    {
      indice: 2,
      nome_empresa: null,
      regime: null,
      regime_enum: ['LP', 'SN', 'LR'],
      segmento: null,
      motivo_escolha: null,
      urgencia: null,
      urgencia_enum: ['Alta', 'Média', 'Baixa'],
      data_contato_prevista: null,
    },
    {
      indice: 3,
      nome_empresa: null,
      regime: null,
      regime_enum: ['LP', 'SN', 'LR'],
      segmento: null,
      motivo_escolha: null,
      urgencia: null,
      urgencia_enum: ['Alta', 'Média', 'Baixa'],
      data_contato_prevista: null,
    },
  ],
  _validacao_pilotos: "ao menos 1 piloto deve ter regime === 'LR' antes de habilitar 'Confirmar Pilotos'",

  compromissos: [
    {
      id: 1,
      titulo: 'Estrutura preliminar do produto',
      descricao: 'Prova de conceito + implementação + entregáveis + prazo',
      responsavel: null,
      prazo: null,
      status: 'Pendente',
      status_enum: ['Pendente', 'Em andamento', 'Concluído', 'Bloqueado'],
      _referencia_parecer: 'Seção 5, item 3 — definir 2 serviços prioritários em 30 dias',
    },
    {
      id: 2,
      titulo: 'Mapeamento da carteira por potencial',
      descricao: 'Maiores clientes, Lucro Real, múltiplos estabelecimentos',
      responsavel: null,
      prazo: null,
      status: 'Pendente',
      status_enum: ['Pendente', 'Em andamento', 'Concluído', 'Bloqueado'],
      _criterio_priorizacao: 'LP: 32 aptos (30%) · LR: 8 aptos (70%) · SN: 12 aptos (15%)',
    },
    {
      id: 3,
      titulo: 'Seleção dos três clientes-piloto',
      descricao: 'As três empresas definidas na seção 04',
      responsavel: null,
      prazo: null,
      status: 'Pendente',
      status_enum: ['Pendente', 'Em andamento', 'Concluído', 'Bloqueado'],
      _gatilho: "quando pilotos[0,1,2].nome_empresa estiverem preenchidos → status muda para 'Em andamento'",
    },
  ],

  proximo_encontro: {
    numero: '__calculado: encontro.numero + 1__',
    data: null,
    foco: 'Prospecção, proposta comercial e fechamento',
    pauta_prevista: [],
  },

  trilha_mentoria: {
    mes_atual_marcador: '__calculado: mentoria.mes_atual__',
    meses: [
      { mes: 1, label: 'Estruturação do produto',         ciclo: 'validacao', status: 'atual' },
      { mes: 2, label: 'Proposta comercial e vendas',     ciclo: 'validacao', status: 'futuro' },
      { mes: 3, label: 'Prospecção da carteira',          ciclo: 'validacao', status: 'futuro' },
      { mes: 4, label: 'Execução dos primeiros projetos', ciclo: 'escala',    status: 'futuro' },
      { mes: 5, label: 'Ajustes operacionais e escala',   ciclo: 'escala',    status: 'futuro' },
      { mes: 6, label: 'Reforma como unidade permanente', ciclo: 'escala',    status: 'futuro' },
    ],
    _logica_marcador: "status: meses < mes_atual → 'concluido' | === mes_atual → 'atual' | > mes_atual → 'futuro'",
  },

  parecer_tecnico: {
    _tipo: 'somente_leitura — dados de referência do Parecer Técnico emitido em 2026-06-05',
    projecao_receita: [
      { segmento: 'Lucro Presumido', clientes: 108, pct_aptos: 30, aptos: 32, vlr_diagnostico: 1200, receita_piloto: 38400, recorrente_mes: 22400 },
      { segmento: 'Lucro Real',      clientes: 11,  pct_aptos: 70, aptos: 8,  vlr_diagnostico: 2000, receita_piloto: 16000, recorrente_mes: 12000 },
      { segmento: 'Simples Nacional',clientes: 80,  pct_aptos: 15, aptos: 12, vlr_diagnostico: 800,  receita_piloto: 9600,  recorrente_mes: 6000  },
    ],
    total_receita_piloto: 64000,
    total_recorrente_mes: 40400,
    riscos: [
      { id: 'R1', titulo: 'Escala prematura',    descricao: 'Oferecer consultoria para toda a carteira antes de testar o modelo', mitigado: false },
      { id: 'R2', titulo: 'Ausência de contrato','descricao': 'Executar consultoria sem documento específico',                     mitigado: false },
      { id: 'R3', titulo: 'Subprecificação',     descricao: 'Definir valor abaixo do mercado',                                   mitigado: false },
    ],
    base_legal: [
      { norma: 'NBC PG 100 — CFC',        descricao: 'Ética e responsabilidade do contador na prestação de serviços' },
      { norma: 'Resolução CFC 987/2003',  descricao: 'Honorários profissionais contábeis: modalidades e formalização contratual' },
      { norma: 'NBC TP 01 — CFC',         descricao: 'Qualificação técnica para prestação de serviços especializados' },
      { norma: 'CTN, arts. 149–150',      descricao: 'Legalidade do planejamento tributário preventivo' },
      { norma: 'CC/2002, arts. 593–609',  descricao: 'Prestação de serviços: contrato, escopo e responsabilidade civil' },
    ],
  },
};

const FLUXO_MENTORIA = {
  descricao: 'Fluxo obrigatório para preparação e geração de entrega de cada encontro de mentoria.',
  passos: [
    {
      numero: 1,
      titulo: 'Coleta de dados do encontro',
      instrucao: 'Chamar mentoria_fg_schema() para obter o schema. Preencher todos os campos null com dados reais do encontro.',
      bloqueante: true,
    },
    {
      numero: 2,
      titulo: 'Pesquisa de conteúdo (se houver tema de Reforma Tributária)',
      instrucao: 'fonte_lc214_mapa_temas() → identificar artigos relevantes para o encontro. Opcional se o encontro for estratégico/operacional.',
      bloqueante: false,
    },
    {
      numero: 3,
      titulo: 'Geração dos documentos',
      instrucao: 'Executar gerar_entrega_mentoria_mq.py com os dados do schema preenchido. Gera Alinhamento_VF.docx + NotaTecnica_VF.docx.',
      bloqueante: true,
    },
    {
      numero: 4,
      titulo: 'Revisão de linguagem',
      instrucao: 'revisao_linguagem(texto_completo) sobre o conteúdo da Nota Técnica antes de entregar.',
      bloqueante: true,
    },
    {
      numero: 5,
      titulo: 'Atualização do painel (CLAUDE.md)',
      instrucao: 'Após o encontro: atualizar CLAUDE.md no Drive com pendências, status da sessão e próxima data.',
      bloqueante: false,
    },
  ],
};

export function registerMentoriaTools(server: McpServer): void {
  server.registerTool(
    'mentoria_fg_schema',
    {
      description:
        'Retorna o schema de dados para preenchimento dinâmico do documento de entrega de encontro de mentoria individual (Prof. Fellipe Guerra). ' +
        'Chamar antes de gerar qualquer documento de sessão. ' +
        'modo="schema": retorna o schema em branco para uma nova sessão. ' +
        'modo="fluxo": retorna o fluxo de passos obrigatórios antes de gerar os DOCXs. ' +
        'modo="template": retorna metadados do template DOCX e caminho no Drive.',
      inputSchema: {
        modo: z
          .enum(['schema', 'fluxo', 'template'])
          .optional()
          .default('schema')
          .describe(
            "'schema': schema em branco para preencher | 'fluxo': passos obrigatórios antes de gerar os DOCXs | 'template': metadados do template DOCX",
          ),
        cliente: z
          .string()
          .optional()
          .describe('Razão social do cliente da mentoria (ex: "MQ Governança Contábil"). Quando fornecido, pré-preenche o campo cliente.razao_social no schema.'),
        encontro_numero: z
          .number()
          .optional()
          .describe('Número do encontro (1–6). Quando fornecido, pré-preenche encontro.numero no schema.'),
      },
    },
    async ({ modo, cliente, encontro_numero }) => {
      if (modo === 'template') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(TEMPLATE_MENTORIA, null, 2),
            },
          ],
        };
      }

      if (modo === 'fluxo') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(FLUXO_MENTORIA, null, 2),
            },
          ],
        };
      }

      // modo === 'schema' (default)
      const schema = JSON.parse(JSON.stringify(SCHEMA_MENTORIA));

      if (cliente) {
        schema.cliente.razao_social = cliente;
      }
      if (encontro_numero !== undefined) {
        schema.encontro.numero = encontro_numero;
        // atualizar trilha: marcar mes atual
        const mes = encontro_numero;
        schema.trilha_mentoria.mes_atual_marcador = mes;
        schema.trilha_mentoria.meses = schema.trilha_mentoria.meses.map((m: { mes: number; status: string }) => ({
          ...m,
          status: m.mes < mes ? 'concluido' : m.mes === mes ? 'atual' : 'futuro',
        }));
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                instrucao: 'Preencha todos os campos null com os dados reais do encontro antes de executar o script gerador.',
                template: TEMPLATE_MENTORIA,
                schema,
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
