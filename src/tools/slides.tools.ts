import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Template: "Modelo Padrão — Contabilidade, Tributário e Ciência de Dados.pptx"
// Localização: G:\Meu Drive\000_PROJETO CLAUDE\00_Genesis\_layouts\SLIDE PADRÃO\
// 12 slides extraídos e catalogados.

const SLIDES_CATALOGO = {
  slide_01_capa: {
    numero: 1,
    nome: 'Capa',
    descricao: 'Slide de abertura com título da apresentação e identidade visual',
    campos_obrigatorios: ['titulo_apresentacao', 'subtitulo_opcional', 'data_ou_evento'],
    regra: 'Nunca adicionar texto corrido na capa. Apenas título, subtítulo e identificação.',
  },
  slide_02_professor: {
    numero: 2,
    nome: 'Professor / Apresentador',
    descricao: 'Slide de apresentação da autoridade do apresentador',
    campos_obrigatorios: ['nome', 'titulacao', 'areas_de_atuacao', 'foto_opcional'],
    regra: 'Manter conciso. Autoridade se demonstra com credenciais, não com texto longo.',
  },
  slide_03_agenda: {
    numero: 3,
    nome: 'Agenda / Roteiro',
    descricao: 'Visão geral da jornada de aprendizagem em até 6 blocos numerados',
    campos_obrigatorios: [
      'titulo_bloco_01',
      'titulo_bloco_02',
      'titulo_bloco_03',
      'titulo_bloco_04',
      'titulo_bloco_05',
      'titulo_bloco_06',
    ],
    estrutura_padrao: [
      { numero: '01', label: 'CONTEXTO', descricao: 'Abertura do tema — contexto, problema gerencial e objetivo da aula' },
      { numero: '02', label: 'FUNDAMENTO', descricao: 'Conceito central — definição, lógica de uso e principais componentes' },
      { numero: '03', label: 'APLICAÇÃO', descricao: 'Ferramenta ou método — como aplicar na rotina de controladoria' },
      { numero: '04', label: 'GESTÃO', descricao: 'Indicadores e análise — KPIs, métricas, leitura crítica e tomada de decisão' },
      { numero: '05', label: 'PRÁTICA', descricao: 'Caso prático — premissas, cálculo, interpretação e conclusão aplicada' },
      { numero: '06', label: 'FECHAMENTO', descricao: 'Síntese final — aprendizados, recomendações e próximos passos' },
    ],
    regra: 'Máximo 6 blocos. Substituir textos por títulos curtos. Manter ordem lógica e progressiva.',
  },
  slide_04_conceito: {
    numero: 4,
    nome: 'Conceito Central',
    descricao: 'Slide de apresentação da ideia-chave com definição e 3 blocos de leitura gerencial',
    campos_obrigatorios: ['titulo_conceito', 'definicao_frase_unica', 'contextualizacao', 'mensagem_essencial'],
    blocos: [
      { id: '01', label: 'Onde aparece', orientacao: 'DRE, orçamento, fluxo de caixa, valuation, KPIs ou processos internos' },
      { id: '02', label: 'Como interpretar', orientacao: 'Sinal de alerta, leitura gerencial ou critério de análise' },
      { id: '03', label: 'Qual decisão apoia', orientacao: 'Preço, margem, investimento, corte de custos, captação ou priorização' },
    ],
    regra: 'O conceito deve orientar uma decisão, não apenas informar. Transformar técnico em gerencial.',
  },
  slide_05_comparacao: {
    numero: 5,
    nome: 'Comparação em Colunas',
    descricao: 'Contraste entre dois cenários, métodos, períodos ou níveis de maturidade gerencial',
    campos_obrigatorios: ['titulo_coluna_a', 'titulo_coluna_b', 'mensagem_decisao'],
    colunas: {
      coluna_a: {
        label: 'SITUAÇÃO ATUAL',
        subcampos: ['FOCO', 'BASE', 'LIMITE', 'USO IDEAL'],
      },
      coluna_b: {
        label: 'EVOLUÇÃO PROPOSTA',
        subcampos: ['FOCO', 'BASE', 'FORÇA', 'USO IDEAL'],
      },
    },
    usos_tipicos: [
      'Antes versus depois',
      'Cenário base versus otimista',
      'Método contábil versus gerencial',
      'Diagnóstico versus recomendação',
    ],
    regra: 'Finalizar com frase objetiva: qual alternativa escolher, em qual contexto e com qual impacto.',
  },
  slide_06_processo: {
    numero: 6,
    nome: 'Processo ou Fluxo',
    descricao: 'Sequência lógica de etapas com ação, evidência e saída para cada passo',
    campos_obrigatorios: ['titulo_processo', 'etapas'],
    estrutura_etapa: {
      campos: ['numero', 'verbo_acao', 'descricao_curta', 'saida_entregavel'],
      regra: 'Cada etapa: verbo curto + evidência + saída em destaque (ex: SAÍDA: BASE VALIDADA)',
    },
    etapas_padrao: [
      { numero: '01', acao: 'Coletar dados', saida: 'BASE VALIDADA' },
      { numero: '02', acao: 'Organizar informações', saida: 'ESTRUTURA ANALÍTICA' },
      { numero: '03', acao: 'Calcular indicadores', saida: 'KPIS E ACHADOS' },
      { numero: '04', acao: 'Interpretar desvios', saida: 'DIAGNÓSTICO' },
      { numero: '05', acao: 'Decidir ação', saida: 'DECISÃO GERENCIAL' },
    ],
    regra: 'Ideal para aulas práticas, implantação de rotinas e fluxos de controladoria.',
  },
  slide_07_tabela: {
    numero: 7,
    nome: 'Tabela Financeira',
    descricao: 'DRE, orçamento, caixa ou projeções com leitura gerencial por linha',
    campos_obrigatorios: ['titulo_demonstracao', 'unidade_valores', 'linhas'],
    colunas_padrao: ['LINHA', 'REALIZADO', 'ORÇADO', 'PROJETADO', 'VAR. R$', 'VAR. %', 'LEITURA'],
    exemplo_linhas: [
      { linha: 'Receita bruta', realizado: 2400, orcado: 2550, projetado: 2680, var_r: '+280', var_pct: '+11,7%', leitura: 'acima' },
      { linha: 'Receita líquida', realizado: 2040, orcado: 2167, projetado: 2278, var_r: '+238', var_pct: '+11,7%', leitura: 'expansão' },
      { linha: 'EBITDA', realizado: 440, orcado: 497, projetado: 543, var_r: '+103', var_pct: '+23,4%', leitura: 'ganho operacional' },
      { linha: 'Resultado líquido', realizado: 286, orcado: 323, projetado: 353, var_r: '+67', var_pct: '+23,4%', leitura: 'valor gerado' },
    ],
    regras_visuais: [
      'Cabeçalho: fundo preto, texto branco, negrito',
      'Linha crítica (EBITDA, Resultado): destacar em amarelo #FFC000',
      'Texto secundário em cinza #A5A5A5',
      'Nunca apresentar tabela sem coluna LEITURA',
    ],
    regra: 'Toda tabela deve ter coluna LEITURA com interpretação gerencial. Proibido apresentar número sem conclusão.',
  },
  slide_08_formula: {
    numero: 8,
    nome: 'Fórmula e Cálculo',
    descricao: 'Apresentação de fórmulas, KPIs e métricas com leitura gerencial em 3 passos',
    campos_obrigatorios: ['nome_indicador', 'formula_expressa', 'componentes', 'passos'],
    componentes: [
      { id: 'A', label: 'Variável principal', orientacao: 'Origem do dado, unidade e premissa usada' },
      { id: 'B', label: 'Dedução ou ajuste', orientacao: 'O que deve ser removido, ajustado ou normalizado' },
      { id: 'C', label: 'Base de comparação', orientacao: 'Denominador, capital investido, receita, volume ou taxa' },
      { id: 'R', label: 'Resultado esperado', orientacao: 'Como interpretar o número final e sua faixa de atenção' },
    ],
    passos: [
      { numero: '01', titulo: 'Calcular', orientacao: 'Apresentar fórmula, substituir valores e mostrar resultado com unidade clara' },
      { numero: '02', titulo: 'Interpretar', orientacao: 'Explicar se indica eficiência, risco, retorno, equilíbrio ou destruição de valor' },
      { numero: '03', titulo: 'Decidir', orientacao: 'Converter cálculo em ação: revisar preço, margem, custo, capital, investimento ou cenário' },
    ],
    regra: 'Toda fórmula deve terminar com frase de gestão: o que esse número muda na decisão?',
  },
  slide_09_dashboard: {
    numero: 9,
    nome: 'Dashboard / Indicadores',
    descricao: 'Painel executivo com até 4 KPIs e 3 alertas gerenciais',
    campos_obrigatorios: ['kpis', 'alertas', 'leitura_executiva'],
    estrutura_kpi: {
      campos: ['numero', 'label', 'valor', 'variacao', 'descricao'],
      maximo: 4,
      exemplo: [
        { numero: 'KPI 01', label: 'RECEITA', valor: 'R$ 2,68 mi', variacao: '+11,7% vs. realizado' },
        { numero: 'KPI 02', label: 'MARGEM', valor: '45,3%', variacao: '+2,1 p.p.' },
        { numero: 'KPI 03', label: 'CAIXA', valor: 'R$ 410 mil', variacao: 'saldo positivo' },
        { numero: 'KPI 04', label: 'RISCO', valor: 'Médio', variacao: 'monitorar 30 dias' },
      ],
    },
    estrutura_alerta: {
      niveis: ['ALTO', 'MÉDIO', 'BAIXO'],
      maximo: 3,
    },
    regra: 'Máximo 4 KPIs e 3 alertas. O slide deve facilitar decisão, não acumular dados.',
  },
  slide_10_caso_pratico: {
    numero: 10,
    nome: 'Caso Prático',
    descricao: 'Estrutura completa de caso com contexto, roteiro, conclusão e entregáveis',
    campos_obrigatorios: ['contexto', 'roteiro_5_passos', 'conclusao_aplicada', 'entregaveis'],
    campos_contexto: ['empresa_problema', 'setor', 'problema', 'objetivo', 'base_dados'],
    roteiro_padrao: [
      { numero: 1, titulo: 'Definir premissas', orientacao: 'Variáveis de receita, custos, despesas, investimento, capital de giro ou taxa de desconto' },
      { numero: 2, titulo: 'Montar a base de cálculo', orientacao: 'Organizar dados em tabela, fórmula, fluxo de caixa, DRE projetada ou matriz comparativa' },
      { numero: 3, titulo: 'Calcular indicadores', orientacao: 'Aplicar KPIs, margem, ponto de equilíbrio, valuation, EVA, WACC ou variações gerenciais' },
      { numero: 4, titulo: 'Interpretar resultados', orientacao: 'Comparar cenários, identificar desvio crítico, explicar causa, impacto e prioridade' },
      { numero: 5, titulo: 'Recomendar decisão', orientacao: 'Concluir com ação proposta, justificativa técnica e indicador que comprova a escolha' },
    ],
    entregaveis_padrao: [
      { id: 'PRODUTO 01', titulo: 'Diagnóstico', orientacao: 'Problema central, causa provável e evidência numérica' },
      { id: 'PRODUTO 02', titulo: 'Cálculo', orientacao: 'Tabela, fórmula ou indicador que sustenta a análise' },
      { id: 'PRODUTO 03', titulo: 'Decisão', orientacao: 'Recomendação objetiva, impacto esperado e métrica de controle' },
    ],
    frase_final: 'Recomendamos X porque Y gera Z de impacto gerencial.',
    regra: 'A conclusão deve traduzir números em decisão: o que fazer, por que fazer, qual impacto e como acompanhar.',
  },
  slide_11_exercicio: {
    numero: 11,
    nome: 'Exercício / Dinâmica',
    descricao: 'Atividade prática com objetivo, 3 etapas e critérios de avaliação',
    campos_obrigatorios: ['objetivo_atividade', 'produto_esperado', 'etapas', 'criterios'],
    etapas: [
      { numero: '01', titulo: 'Preparar', pergunta: 'Qual é o problema gerencial que precisa ser resolvido?' },
      { numero: '02', titulo: 'Discutir', pergunta: 'Que evidência confirma ou rejeita a hipótese inicial?' },
      { numero: '03', titulo: 'Entregar', pergunta: 'Qual decisão deve ser tomada e por qual motivo?' },
    ],
    regras_conducao: [
      'Definir grupo, papel e forma de execução',
      'Exigir conta, indicador ou premissa explícita',
      'Limitar entrega a diagnóstico, cálculo e recomendação',
      'Encerrar conectando a resposta ao método',
    ],
    criterios_avaliacao: [
      { id: 'CRITÉRIO 01', titulo: 'Raciocínio técnico', orientacao: 'Uso correto de conceitos, fórmulas e indicadores' },
      { id: 'CRITÉRIO 02', titulo: 'Clareza gerencial', orientacao: 'Explicar impacto e prioridade' },
      { id: 'CRITÉRIO 03', titulo: 'Decisão recomendada', orientacao: 'Conclusão objetiva sustentada por evidência' },
    ],
    regra: 'Dinâmica curta, evidência clara, decisão objetiva.',
  },
  slide_12_encerramento: {
    numero: 12,
    nome: 'Encerramento',
    descricao: 'Slide final com síntese, mensagem e identidade visual',
    campos_obrigatorios: ['mensagem_final', 'contato_opcional'],
    regra: 'Encerrar com aprendizado central, recomendação prática e próximo passo concreto.',
  },
};

const REGRAS_VISUAIS_SLIDES = {
  template_arquivo: 'Modelo Padrão — Contabilidade, Tributário e Ciência de Dados.pptx',
  template_caminho: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\00_Genesis\\_layouts\\SLIDE PADRÃO\\',
  regra_uso_template: 'SEMPRE copiar o template antes de criar slides. NUNCA editar o original.',
  cores: {
    preto: { hex: '#000000', uso: 'Títulos principais, cabeçalhos de tabela, texto-âncora' },
    amarelo_destaque: { hex: '#FFC000', uso: 'Linha crítica de tabela, KPI em destaque, resultado final — única cor quente permitida' },
    cinza_claro: { hex: '#E7E6E6', uso: 'Fundo de blocos secundários, separadores, áreas neutras' },
    cinza_medio: { hex: '#A5A5A5', uso: 'Texto secundário, rótulos, números de suporte' },
    azul_escuro: { hex: '#44546A', uso: 'Elementos de identidade visual, rodapés, número do slide' },
    branco: { hex: '#FFFFFF', uso: 'Fundo do slide e texto sobre fundo escuro' },
  },
  cores_proibidas: [
    'Vermelho (qualquer tom)',
    'Verde (qualquer tom)',
    'Azul vivo (exceto #44546A da identidade)',
    'Cores adicionais não listadas acima',
  ],
  tipografia: {
    fonte_titulo: 'Calibri Light',
    fonte_corpo: 'Calibri',
    tamanhos_referencia: {
      titulo_slide: '28-32pt',
      subtitulo: '18-22pt',
      texto_bloco: '14-16pt',
      legenda_rodape: '10-12pt',
    },
  },
  hierarquia_visual: [
    'Preto: informação principal e decisão',
    'Amarelo #FFC000: dado crítico ou resultado em destaque',
    'Cinza #A5A5A5: contexto e suporte',
    'Branco sobre fundo escuro: cabeçalhos de tabela e blocos principais',
  ],
  regras_conteudo: [
    'Cada slide = uma ideia principal = uma decisão gerencial',
    'Máximo 6 blocos na agenda',
    'Máximo 4 KPIs e 3 alertas no dashboard',
    'Toda tabela deve ter coluna LEITURA com interpretação gerencial',
    'Toda fórmula deve terminar com frase de decisão gerencial',
    'Nunca apresentar número sem conclusão ou contexto',
    'Evitar texto corrido — preferir blocos, bullets e tabelas',
  ],
  erros_comuns: [
    'Slide com texto corrido sem estrutura visual',
    'Tabela sem coluna de leitura/interpretação',
    'Fórmula sem conclusão gerencial',
    'Dashboard com mais de 4 KPIs (poluição visual)',
    'Uso de vermelho/verde para positivos e negativos',
    'Editar o arquivo original em vez de copiar',
  ],
};

const CHECKLIST_SLIDES = [
  'Template copiado para a pasta do projeto (não editou o original)?',
  'Cada slide tem apenas uma ideia principal?',
  'Cores respeitam a paleta (#000000, #FFC000, #E7E6E6, #A5A5A5, #44546A, #FFFFFF)?',
  'Tabelas possuem coluna LEITURA com interpretação gerencial?',
  'Fórmulas terminam com frase de decisão gerencial?',
  'Dashboard respeita limite de 4 KPIs e 3 alertas?',
  'Agenda tem no máximo 6 blocos?',
  'Fluxos têm ação + evidência + saída em cada etapa?',
  'Casos práticos encerram com recomendação objetiva?',
  'Capa tem apenas título, subtítulo e identificação?',
];

const TIPOS_SLIDE = Object.keys(SLIDES_CATALOGO) as Array<keyof typeof SLIDES_CATALOGO>;

export function registerSlidesTools(server: McpServer): void {
  server.registerTool(
    'layout_regras_slides',
    {
      description:
        'Regras obrigatórias de formatação e conteúdo para slides do modelo padrão (Calibri, cores #000000/#FFC000/#E7E6E6, hierarquia visual). Chamar sempre antes de criar ou montar qualquer apresentação.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(REGRAS_VISUAIS_SLIDES, null, 2) }],
    }),
  );

  server.registerTool(
    'layout_estrutura_slides',
    {
      description:
        'Catálogo completo dos 12 tipos de slide do modelo padrão: capa, professor, agenda, conceito, comparação, processo, tabela, fórmula, dashboard, caso prático, exercício e encerramento. Retorna todos os tipos com campos obrigatórios.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              total_slides: 12,
              template: REGRAS_VISUAIS_SLIDES.template_arquivo,
              caminho: REGRAS_VISUAIS_SLIDES.template_caminho,
              catalogo: SLIDES_CATALOGO,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    'layout_slide_modelo',
    {
      description:
        "Retorna estrutura detalhada de um tipo específico de slide com campos obrigatórios, exemplos e regras de conteúdo. Usar ao montar um slide específico: 'slide_03_agenda', 'slide_07_tabela', 'slide_09_dashboard', etc.",
      inputSchema: {
        tipo: z
          .enum([
            'slide_01_capa',
            'slide_02_professor',
            'slide_03_agenda',
            'slide_04_conceito',
            'slide_05_comparacao',
            'slide_06_processo',
            'slide_07_tabela',
            'slide_08_formula',
            'slide_09_dashboard',
            'slide_10_caso_pratico',
            'slide_11_exercicio',
            'slide_12_encerramento',
          ])
          .describe('Tipo do slide a montar'),
      },
    },
    async ({ tipo }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              slide: SLIDES_CATALOGO[tipo],
              regras_visuais: REGRAS_VISUAIS_SLIDES.cores,
              hierarquia: REGRAS_VISUAIS_SLIDES.hierarquia_visual,
              checklist: CHECKLIST_SLIDES,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    'layout_checklist_slides',
    {
      description: 'Checklist de validação antes de entregar ou exportar a apresentação. Aplicar após montar todos os slides.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ itens: CHECKLIST_SLIDES, total: CHECKLIST_SLIDES.length }, null, 2),
        },
      ],
    }),
  );
}
