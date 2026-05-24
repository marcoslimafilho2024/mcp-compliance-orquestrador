import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TEMPLATES_CATALOG = {
  parecer_padrao: {
    arquivo: 'PARECER CONTÁBIL E TRIBUTÁRIO - MODELO.docx',
    caminho: '00_Genesis/_layouts/PARECER CONTÁBIL E TRIBUTÁRIO - MODELO.docx',
    tipo: 'docx',
    proposito: 'Modelo padrão de parecer técnico contábil e tributário',
    quando_usar: 'Pareceres para clientes genéricos, sem identidade visual da Compliance-CE',
    ja_formatado: true,
  },
  parecer_compliance: {
    arquivo: 'PARECER CONTÁBIL E TRIBUTÁRIO - MODELO-COMPLIANCE.docx',
    caminho: '00_Genesis/_layouts/PARECER CONTÁBIL E TRIBUTÁRIO - MODELO-COMPLIANCE.docx',
    tipo: 'docx',
    proposito: 'Parecer com identidade visual da Compliance-CE',
    quando_usar: 'Clientes atendidos diretamente pela Compliance-CE (Fortaleza/CE)',
    ja_formatado: true,
  },
  parecer_guerra: {
    arquivo: 'PARECER CONTÁBIL E TRIBUTÁRIO - MODELO.docx',
    caminho: '00_Genesis/_layouts/PARECER CONTÁBIL E TRIBUTÁRIO - MODELO.docx',
    tipo: 'docx',
    proposito: 'Parecer com identidade visual da Guerra Advogados',
    quando_usar:
      'Pareceres emitidos sob a marca Guerra Advogados (consultoria Fortes Tecnologia, Thompson Reuters, Contabilizei e similares)',
    ja_formatado: true,
  },
  book_demonstracoes: {
    arquivo: 'EMPRESA MODELO - BOOK DAS DEMONSTRAÇÕES CONTÁBEIS.docx',
    caminho: '00_Genesis/_layouts/EMPRESA MODELO - BOOK DAS DEMONSTRAÇÕES CONTÁBEIS.docx',
    tipo: 'docx',
    proposito: 'Book modelo de demonstrações contábeis',
    quando_usar: 'Elaboração de BP, DRE, DLPA, DFC e notas explicativas',
    ja_formatado: true,
  },
  tabela_simples_nacional: {
    arquivo: 'TABELA SIMPLES NACIONAL.xlsx',
    caminho: '00_Genesis/_layouts/TABELA SIMPLES NACIONAL.xlsx',
    tipo: 'xlsx',
    proposito: 'Alíquotas e faixas vigentes do Simples Nacional — todos os anexos',
    quando_usar: 'Consulta de alíquotas para apuração DAS ou planejamento tributário',
    ja_formatado: true,
  },
};

const ESTRUTURA_PARECER = {
  secoes: [
    {
      numero: 1,
      titulo: 'Cabeçalho',
      conteudo: 'Data, razão social e CNPJ do cliente, identificação do solicitante e do parecerista',
    },
    {
      numero: 2,
      titulo: 'Questionamento',
      conteudo: 'Contexto da consulta, base legal citada pelo cliente, perguntas ou dúvidas levantadas',
    },
    {
      numero: 3,
      titulo: 'Base Legal Atualizada',
      conteudo: "Artigos, incisos e alíneas aplicáveis. Formato: 'LC 214/2025, art. 27, § 3º, inciso II, alínea a'",
    },
    {
      numero: 4,
      titulo: 'Interpretação Normativa',
      conteudo: 'Análise técnica da norma, hermenêutica jurídico-contábil, posicionamento doutrinário quando relevante',
    },
    {
      numero: 5,
      titulo: 'Implicações Práticas',
      conteudo: 'Consequências concretas para o contribuinte: impacto fiscal, operacional e contábil',
    },
    {
      numero: 6,
      titulo: 'Orientações Operacionais',
      conteudo: 'O que o cliente deve fazer: prazos, procedimentos, ajustes em sistemas e documentos',
    },
    {
      numero: 7,
      titulo: 'Vedações ou Exceções',
      conteudo: 'Restrições legais, exceções à regra geral, riscos de autuação fiscal',
    },
    {
      numero: 8,
      titulo: 'Citações Complementares',
      conteudo: 'Jurisprudência (STJ, TRFs, CARF), Soluções de Consulta RFB, manifestações SEFAZ, doutrina',
    },
    {
      numero: 9,
      titulo: 'Conclusão',
      conteudo: 'Síntese objetiva do posicionamento — resposta direta à pergunta do cliente',
    },
    {
      numero: 10,
      titulo: 'Assinatura Técnica',
      conteudo: 'Nome completo, número CRC, data e qualificação do responsável técnico',
    },
  ],
  instrucoes_gerais: [
    'Copiar o template para a pasta do projeto antes de editar — NUNCA editar o arquivo original',
    'Sempre citar o dispositivo legal completo (artigo, parágrafo, inciso, alínea)',
    'Revisar pareceres trimestralmente — legislação tributária muda com frequência',
    'Usar versão -COMPLIANCE para clientes da Compliance-CE',
    "Usar versão 'guerra' para pareceres emitidos sob a marca Guerra Advogados",
  ],
};

const REGRAS_DOCX = {
  espacamento_linhas: 1.5,
  alinhamento: 'justificado',
  paragrafos: {
    espaco_antes_pt: 0,
    espaco_depois_pt: 6,
    regra: 'Parágrafos separados pelo space_after (6pt). Não usar linha em branco entre parágrafos normais. Seções e subtítulos podem ter space_before maior (8-12pt).',
    implementacao: 'pf.line_spacing = 1.5 | pf.space_before = Pt(0) | pf.space_after = Pt(6)',
  },
  cores_permitidas: ['preto #000000', 'branco #FFFFFF', 'cinza escuro #808080', 'cinza claro #D3D3D3', 'cinza muito claro #F0F0F0'],
  cores_proibidas: [
    'azul (qualquer tom)',
    'vermelho (qualquer tom)',
    'verde (qualquer tom)',
    'amarelo (reservado para XLSX)',
    'qualquer outra cor',
  ],
  tabelas: 'Dados sempre em tabela — nunca em parágrafos corridos',
  titulos: 'Podem ter alinhamento diferente do justificado',
  implementacao_python: {
    biblioteca: 'python-docx',
    codigo: [
      'from docx.shared import Pt',
      'from docx.enum.text import WD_ALIGN_PARAGRAPH',
      'for p in doc.paragraphs:',
      '    pf = p.paragraph_format',
      '    pf.line_spacing = 1.5',
      '    pf.space_before = Pt(0)',
      '    pf.space_after  = Pt(6)',
      '    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY',
    ].join('\n'),
  },
  erros_comuns: [
    'Espaçamento simples (1.0) — proibido',
    'Texto alinhado à esquerda — proibido',
    'Linhas em branco extras entre parágrafos — usar space_after ao invés',
    'Dados em parágrafos corridos sem tabela — proibido',
    'Qualquer cor além de preto/branco/cinza — proibido',
  ],
};

const REGRAS_XLSX = {
  grid: 'desabilitado — ws.sheet_view.showGridLines = False',
  formato_numerico: 'padrão brasileiro: ponto milhar, vírgula decimal. Exemplo: 1.000,00',
  formato_openpyxl: '#,##0.00',
  cores_permitidas: {
    preto: '#000000',
    branco: '#FFFFFF',
    cinza_escuro: '#808080',
    cinza_claro: '#D3D3D3',
    cinza_muito_claro: '#F0F0F0',
    amarelo_destaque: '#FFFF00',
    amarelo_claro: '#FFFACD',
  },
  cores_proibidas: ['vermelho (mesmo para valores negativos)', 'verde (mesmo para valores positivos)', 'azul (qualquer uso)'],
  cabecalhos: 'Cinza claro #D3D3D3, negrito, texto preto, alinhamento centralizado',
  destaques: 'Amarelo #FFFF00 — única cor de destaque permitida',
  formulas_complexas: 'Documentar com openpyxl.comments.Comment antes de salvar',
  implementacao_python: {
    biblioteca: 'openpyxl',
    codigo: [
      'ws.sheet_view.showGridLines = False',
      "for row in ws.iter_rows():",
      '    for cell in row:',
      '        if isinstance(cell.value, (int, float)):',
      "            cell.number_format = '#,##0.00'",
      "            cell.alignment = Alignment(horizontal='right')",
      'for cell in ws[1]:  # cabecalho',
      "    cell.fill = PatternFill(start_color='D3D3D3', end_color='D3D3D3', fill_type='solid')",
      "    cell.font = Font(bold=True, color='000000')",
    ].join('\n'),
  },
  erros_comuns: [
    'Grid visível — proibido',
    'Formato americano 1,000.00 — proibido',
    'Vermelho para negativos — proibido',
    'Verde para positivos — proibido',
    'Fórmulas complexas sem comentário — proibido',
  ],
};

const REGRAS_LINGUAGEM = {
  idioma: 'Português brasileiro, registro formal-técnico',
  pontuacao: {
    travessao: {
      regra: 'PROIBIDO usar travessão (—) em texto corrido de pareceres e relatórios.',
      substituicoes: [
        'Travessão explicativo: use vírgula ou dois-pontos',
        'Travessão de ênfase: reescreva a frase sem ele',
        'Travessão de enumeração: use dois-pontos',
      ],
      exemplos: {
        errado: 'O prazo — previsto no art. 3º — é de 30 dias.',
        certo: 'O prazo previsto no art. 3º é de 30 dias.',
        errado2: 'Três situações — entrada, saída e devolução.',
        certo2: 'Três situações: entrada, saída e devolução.',
      },
    },
    seta: {
      regra: 'Seta (>) ou (→) só em lançamentos contábeis e diagramas técnicos. Nunca em texto corrido.',
    },
  },
  linguagem_proibida: {
    regra: 'Evitar termos que soam artificiais, pomposos ou gerados por IA.',
    palavras_e_frases: [
      'cumpre salientar',
      'destarte',
      'outrossim',
      'no que tange',
      'consoante',
      'mister se faz',
      'forçoso reconhecer',
      'afigura-se',
      'urge destacar',
      'ressalte-se que',
      'importa destacar',
      'em que pese',
      'de plano',
      'a toda evidência',
      'resta consignado',
      'de logo',
      'em síntese apertada',
      'assim sendo',
      'nesse diapasão',
      'precipuamente',
      'sobremodo',
      'é forçoso concluir',
      'nesse passo',
      'ab initio',
      'ex vi',
      'verifica-se que',
      'nota-se que',
      'observa-se que',
    ],
    substituicoes: [
      "'cumpre salientar' → 'vale destacar' ou suprimir",
      "'destarte' → 'portanto' ou 'assim'",
      "'outrossim' → 'além disso' ou 'também'",
      "'no que tange' → 'quanto a' ou 'sobre'",
      "'consoante' → 'conforme' ou 'segundo'",
      "'em que pese' → 'apesar de' ou 'embora'",
      "'assim sendo' → 'portanto' ou remover",
      "'nesse diapasão' → 'nesse sentido' ou remover",
      "'verifica-se que' → afirmação direta sem introdução",
    ],
  },
  estilo: {
    frases: 'Curtas e diretas. Máximo de 2 orações subordinadas por frase.',
    paragrafos: 'Um parágrafo = uma ideia. Evitar parágrafos com mais de 6 linhas.',
    voz: 'Preferir voz ativa. Evitar construções passivas longas.',
    tom: "Técnico e objetivo. Sem adjetivos desnecessários ('extremamente importante', 'absolutamente necessário').",
    numeracao: 'Seções numeradas com algarismo romano (I, II, III). Subseções com número decimal (1.1, 1.2).',
    listas: 'Bullet (•) para itens sem ordem. Número para sequência ou prioridade.',
  },
  checklist_revisao: [
    'Há travessões (—) no texto? Substituir.',
    'Há palavras da lista de linguagem proibida? Substituir.',
    'Frases com mais de 3 orações subordinadas? Quebrar.',
    'Parágrafos com mais de 6 linhas? Dividir.',
    "Adjetivos desnecessários ('muito', 'extremamente')? Remover.",
    'Voz passiva excessiva? Reescrever em ativa.',
    'Texto soando artificial ou gerado por IA? Reescrever com naturalidade.',
  ],
};

const CHECKLIST_DOCX = [
  'Espaçamento 1,5 em todos os parágrafos?',
  'space_before=0pt e space_after=6pt em parágrafos normais?',
  'Texto justificado (exceto títulos)?',
  'Dados em tabelas (não parágrafos corridos)?',
  'Apenas preto/branco/cinza (sem azul/vermelho/verde/amarelo)?',
  'Iniciado a partir do template (não criado do zero)?',
  'Travessões (—) removidos do texto corrido?',
  'Palavras de linguagem IA revisadas e substituídas?',
  'Frases curtas e diretas (máximo 2 subordinadas)?',
];

const CHECKLIST_XLSX = [
  'Grid desabilitado?',
  'Números no padrão BR (1.000,00)?',
  'Cores: preto/branco/cinza/amarelo apenas?',
  'Cabeçalhos em cinza claro com negrito?',
  'Fórmulas complexas com comentário?',
  'Destaques em amarelo (não vermelho/verde)?',
];

export function registerLayoutTools(server: McpServer): void {
  server.registerTool(
    'layouts_listar',
    {
      description: 'Lista todos os templates disponíveis em 00_Genesis/_layouts/. Chamar antes de criar qualquer DOCX ou XLSX.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              templates: TEMPLATES_CATALOG,
              regra: 'Copiar o template para a pasta do projeto. NUNCA editar o original.',
              pasta_base_windows: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\00_Genesis\\_layouts\\',
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerTool(
    'layout_regras_docx',
    {
      description: 'Regras obrigatórias de formatação para .docx. Aplicar em todos os documentos Word do workspace.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(REGRAS_DOCX, null, 2) }],
    }),
  );

  server.registerTool(
    'layout_regras_xlsx',
    {
      description: 'Regras obrigatórias de formatação para .xlsx. Aplicar em todas as planilhas Excel do workspace.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(REGRAS_XLSX, null, 2) }],
    }),
  );

  server.registerTool(
    'layout_regras_linguagem',
    {
      description:
        'Regras de escrita para documentos do workspace: proibição de travessões, lista de palavras-IA proibidas com substitutos, estilo de frases e parágrafos. Aplicar SEMPRE antes de finalizar qualquer parecer, relatório ou análise.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(REGRAS_LINGUAGEM, null, 2) }],
    }),
  );

  server.registerTool(
    'layout_estrutura_parecer',
    {
      description: "Estrutura completa do parecer técnico (10 seções). versao: 'padrao', 'compliance' ou 'guerra'",
      inputSchema: {
        versao: z
          .enum(['padrao', 'compliance', 'guerra'])
          .optional()
          .default('padrao')
          .describe(
            "Versão do template: 'padrao' (sem identidade visual) | 'compliance' (Compliance-CE) | 'guerra' (Guerra Advogados)",
          ),
      },
    },
    async ({ versao }) => {
      const mapa: Record<string, keyof typeof TEMPLATES_CATALOG> = {
        compliance: 'parecer_compliance',
        guerra: 'parecer_guerra',
      };
      const chave = mapa[versao ?? 'padrao'] ?? 'parecer_padrao';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                template_a_usar: TEMPLATES_CATALOG[chave],
                estrutura_10_secoes: ESTRUTURA_PARECER.secoes,
                instrucoes_gerais: ESTRUTURA_PARECER.instrucoes_gerais,
                versao_solicitada: versao,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'layout_checklist',
    {
      description: "Checklist de validação antes de salvar o documento. tipo: 'docx' ou 'xlsx'",
      inputSchema: {
        tipo: z.enum(['docx', 'xlsx']).describe("Tipo do documento: 'docx' para Word, 'xlsx' para Excel"),
      },
    },
    async ({ tipo }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tipo, itens: tipo === 'docx' ? CHECKLIST_DOCX : CHECKLIST_XLSX }, null, 2),
        },
      ],
    }),
  );
}
