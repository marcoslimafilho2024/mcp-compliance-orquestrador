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
    arquivo: 'PARECER TÉCNICO - MODELO.docx',
    caminho: 'Consultorias Guerra/00_Modelos/PARECER TÉCNICO - MODELO.docx',
    caminho_windows: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\Consultorias Guerra\\00_Modelos\\PARECER TÉCNICO - MODELO.docx',
    tipo: 'docx',
    proposito: 'Template de Parecer Técnico com identidade visual da Guerra Advogados',
    quando_usar:
      'Pareceres emitidos sob a marca Guerra Advogados (clientes: Contabilizei, Fortes Tecnologia, Thompson/Domínio Sistemas, São Geraldo)',
    ja_formatado: true,
    pareceristas: [
      'Prof. Fellipe Guerra — Contador e Advogado Tributarista — CRC/CE nº 21.074 | OAB/CE nº 49.759',
      'Prof. Marcos Lima — Contador e Cientista de Dados — CRC/CE nº 23.224',
      'Prof. Mathaus Pordeus — Advogado Tributarista — OAB/CE nº 52.206',
    ],
    assinatura_formato: 'É o parecer, s.m.j. | Fortaleza, [DATA POR EXTENSO]. | [Bloco de cada parecerista]',
    assinatura_obs: 'Vedada qualquer alteração nos dados dos pareceristas. Não inserir assinaturas digitais, não alterar registros profissionais, não incluir outros profissionais além dos três listados.',
    email_templates: {
      perguntas: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\Consultorias Guerra\\00_Modelos\\Fellipe Guerra - Modelo de Email Perguntas.pdf',
      respostas: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\Consultorias Guerra\\00_Modelos\\Fellipe Guerra - Modelo de Email Resposta.pdf',
    },
  },
  book_demonstracoes: {
    arquivo: 'EMPRESA MODELO - BOOK DAS DEMONSTRAÇÕES CONTÁBEIS.docx',
    caminho: '00_Genesis/_layouts/EMPRESA MODELO - BOOK DAS DEMONSTRAÇÕES CONTÁBEIS.docx',
    caminho_windows: 'G:\\Meu Drive\\000_PROJETO CLAUDE\\00_Genesis\\_layouts\\EMPRESA MODELO - BOOK DAS DEMONSTRAÇÕES CONTÁBEIS.docx',
    tipo: 'docx',
    proposito: 'Book modelo de demonstrações contábeis: BP Ativo, BP Passivo, DRE e 19 notas explicativas',
    quando_usar: 'Elaboração de BP, DRE e notas explicativas para clientes com dois exercícios completos disponíveis',
    ja_formatado: true,
    pre_condicao_obrigatoria: 'VERIFICAR ANTES DE INICIAR: o book exige dados comparativos de DOIS exercícios (ano atual e ano anterior). Se não houver dados do exercício anterior: NÃO executar. Solicitar os dados faltantes.',
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
      titulo: 'Interpretação Normativa',
      conteudo: 'Análise técnica da norma, hermenêutica jurídico-contábil, posicionamento doutrinário quando relevante',
    },
    {
      numero: 4,
      titulo: 'Implicações Práticas',
      conteudo: 'Consequências concretas para o contribuinte: impacto fiscal, operacional e contábil',
    },
    {
      numero: 5,
      titulo: 'Orientações Operacionais',
      conteudo: 'O que o cliente deve fazer: prazos, procedimentos, ajustes em sistemas e documentos',
    },
    {
      numero: 6,
      titulo: 'Vedações ou Exceções',
      conteudo: 'Restrições legais, exceções à regra geral, riscos de autuação fiscal',
    },
    {
      numero: 7,
      titulo: 'Citações Complementares',
      conteudo: 'Jurisprudência (STJ, TRFs, CARF), Soluções de Consulta RFB, manifestações SEFAZ, doutrina',
    },
    {
      numero: 8,
      titulo: 'Conclusão',
      conteudo: 'Síntese objetiva do posicionamento — resposta direta à pergunta do cliente',
    },
    {
      numero: 9,
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

const DADOS_OBRIGATORIOS_PRE_PARECER = {
  instrucao: 'BLOQUEANTE: coletar TODOS os dados abaixo antes de chamar qualquer ferramenta MCP. Se algum dado não for fornecido, interromper e solicitar ao usuário. Nunca assumir dados não informados.',
  campos: [
    { id: 1, campo: 'Razão social e CNPJ da consulente' },
    { id: 2, campo: 'Nome do solicitante' },
    { id: 3, campo: 'Data do questionamento' },
    { id: 4, campo: 'Texto integral do questionamento (perguntas formuladas)' },
    { id: 5, campo: 'Normas ou documentos mencionados pelo cliente (se houver)' },
  ],
};

const FLUXO_9_FASES = {
  descricao: 'Fluxo obrigatório e sequencial para elaboração de Parecer Técnico — Guerra Advogados (Diretrizes v3.0 jun/2026). Nenhuma fase pode ser omitida.',
  fases: [
    { numero: 1, titulo: 'Identificação e Seleção do Modo', tools: ['layout_estrutura_parecer(versao="guerra", modo=?)'], obs: 'Coletar DADOS_OBRIGATORIOS_PRE_PARECER antes de chamar a tool' },
    { numero: 2, titulo: 'Pesquisa Legal (antes de escrever qualquer linha)', tools: ['fonte_lc214_mapa_temas', 'fonte_artigo_url', 'buscar_legisweb', 'buscar_carf', 'buscar_sijut', 'buscar_taxpratico', 'buscar_youtube(@ProfessorFellipeGuerra, @institutoect, @profpinzon, @contabilidadefacilitada)', 'revisao_normas_vigentes'] },
    { numero: 3, titulo: 'Estrutura Metodológica', tools: ['alegacao_estrutura_resposta', 'alegacao_hierarquia_fontes', 'alegacao_cronograma_transicao (se tema envolve transição)', 'alegacao_glossario', 'alegacao_boas_praticas'] },
    { numero: 4, titulo: 'Elaboração do Conteúdo (9 seções)', obs: 'Claude elabora com base nas fases 2 e 3. Aplicar restrições do modo selecionado seção por seção.' },
    { numero: 5, titulo: 'Revisão de Linguagem', tools: ['revisao_linguagem(texto_completo)'], obs: 'Status APROVADO = zero violações críticas. Status REPROVADO = corrigir TODAS as críticas antes de prosseguir.' },
    { numero: 6, titulo: 'Checklist de Qualidade', tools: ['revisao_checklist_parecer(categoria="todas")', 'revisao_normas_vigentes(grupo="todos")'], obs: 'Todos os itens críticos devem estar APROVADOS antes de avançar.' },
    { numero: 7, titulo: 'Revalidação Técnica Final (NOVO — OBRIGATÓRIO)', tools: ['revisao_checklist_parecer(categoria="revalidacao_tecnica")'], obs: 'Valida conteúdo jurídico, coerência e aplicabilidade. Complementa Fase 6 — nenhuma substitui a outra. Nota de Confiabilidade mínima 8,0.' },
    { numero: 8, titulo: 'Geração do DOCX', obs: 'Somente após aprovação na Fase 7. Script Python com python-docx a partir do template Guerra. Preservar script ao lado do DOCX.' },
    { numero: 9, titulo: 'Entrega', obs: 'Salvar na pasta do cliente → Renomear [RESPONDER] para [ENTREGUE] → gmail_criar_rascunho com DOCX anexo.' },
  ],
};

const PERGUNTA_MODO = {
  instrucao: 'OBRIGATÓRIO: antes de iniciar qualquer parecer, confirmar com o usuário qual modo usar. A seleção define profundidade técnica, título e extensão máxima.',
  pergunta: 'Qual modo utilizar: Compliance Geral (parecer técnico completo, base legal detalhada, máx. 5 páginas) ou Compliance Empresarial (nota resumida, máx. 3 páginas, linguagem direta para o empresário)?',
  opcoes: {
    geral: {
      label: 'Compliance Geral',
      titulo_documento: 'PARECER TÉCNICO-TRIBUTÁRIO',
      paginas_max: 5,
      descricao: 'Parecer técnico completo com todas as 9 seções em extensão integral, base legal explícita artigo por artigo, linguagem técnica formal',
      quando_usar: 'Defesa fiscal, arquivamento permanente, terceiros técnicos (advogados, auditores, SEFAZ, CARF)',
      restricoes: ['Máximo 5 páginas — inegociável', '9 seções obrigatórias em extensão integral', 'Base legal: citar artigo, §, inciso, alínea em cada afirmação', 'Uma ideia por parágrafo, máx. 4 parágrafos por subseção'],
    },
    empresarial: {
      label: 'Compliance Empresarial',
      titulo_documento: 'NOTA TÉCNICA TRIBUTÁRIA',
      paginas_max: 3,
      descricao: 'Nota técnica condensada, máx. 3 páginas, linguagem acessível ao empresário, resposta direta ao ponto',
      quando_usar: 'Decisão operacional rápida, comunicação ao cliente empresário, gestor não especialista',
      restricoes: ['Máximo 3 páginas — inegociável', '9 seções obrigatórias, mas condensadas ao essencial (nunca omitidas)', 'Base legal apenas na tabela da seção 7 — NÃO citar artigos no corpo do texto', 'Terminologia simples: "boleto" em vez de "DAE", "imposto" em vez de "tributo", "nota fiscal" em vez de "NF-e"'],
    },
  },
};

const ESTRUTURA_PARECER_EMPRESARIAL = {
  titulo_documento: 'NOTA TÉCNICA TRIBUTÁRIA',
  paginas_max: 3,
  linguagem: 'Direta e acessível ao empresário. Sem jargão técnico excessivo. Frases curtas. Respostas diretas. Usar "boleto" em vez de "DAE", "imposto" em vez de "tributo", "nota fiscal" em vez de "NF-e".',
  secoes: [
    { numero: 1, titulo: 'Cabeçalho', conteudo: 'Empresa (razão social e CNPJ), solicitante, responsável técnico, data e assunto resumido', condensado: 'Tabela compacta — máx. 5 linhas' },
    { numero: 2, titulo: 'A Situação', conteudo: 'O que aconteceu, em linguagem simples. 1-2 parágrafos. Sem base legal no corpo.', condensado: 'Substitui "I. QUESTIONAMENTO"' },
    { numero: 3, titulo: 'A Resposta', conteudo: 'Resposta direta à pergunta principal: sim ou não, e por quê em linguagem simples. Cálculo em tabela quando relevante.', condensado: 'Substitui "II. INTERPRETAÇÃO NORMATIVA" — condensada e sem artigos no corpo' },
    { numero: 4, titulo: 'Implicações Práticas', conteudo: 'Custo real, impacto no preço, comparativos. Tabelas curtas.', condensado: 'Condensado' },
    { numero: 5, titulo: 'O que fazer', conteudo: 'Passos numerados, máx. 3-5 itens. Linguagem imperativa e direta.', condensado: 'Engloba "ORIENTAÇÕES OPERACIONAIS" e principais "VEDAÇÕES"' },
    { numero: 6, titulo: 'Riscos Principais', conteudo: 'Máx. 2-3 riscos críticos em linguagem simples, sem citação de artigos.', condensado: 'Condensado de "V. VEDAÇÕES"' },
    { numero: 7, titulo: 'Base Legal Resumida', conteudo: 'Tabela com máx. 5 normas essenciais. Sem citação artigo por artigo no corpo do texto.', condensado: 'Condensado de "VI. CITAÇÕES COMPLEMENTARES"' },
    { numero: 8, titulo: 'Conclusão', conteudo: 'Resposta final em 3-5 linhas. Ação imediata recomendada.', condensado: 'Presente e obrigatória' },
    { numero: 9, titulo: 'Assinatura Técnica', conteudo: 'Nome, CRC, data. Parecerista responsável. Tabela compacta.', condensado: 'Idêntica ao modo Geral' },
  ],
  instrucoes_gerais: [
    'Usar o mesmo template DOCX do modo Geral — identidade visual idêntica',
    'Máximo 3-5 páginas — condensar sem omitir as 9 seções',
    'Linguagem do dia a dia: "boleto" em vez de "DAE", "imposto" em vez de "tributo exigido", "nota fiscal" em vez de "NF-e"',
    'Todas as 9 seções são obrigatórias — podem ser mais curtas, mas não podem ser omitidas',
    'Tabelas são recomendadas para comparativos e custos',
    'Reservar citações de artigos de lei para a tabela da seção 7 — não citar no corpo do texto',
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
  cor_texto_principal: '#1A1A1A (Guerra dark) — NÃO usar preto puro #000000',
  cores_permitidas: ['cinza escuro (texto) #1A1A1A', 'branco #FFFFFF', 'cinza bordas #808080', 'cinza header tabela #C8C8C8', 'cinza zebra #F0F0F0'],
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

const ESTRUTURA_BOOK_DEMONSTRACOES = {
  regra_comparativo: {
    obrigatorio: true,
    bloqueante: true,
    descricao: 'O book DEVE apresentar dados de DOIS exercícios: ANO_ATUAL e ANO_ANTERIOR (comparativo obrigatório). Sem os dois conjuntos de dados: NÃO executar.',
    formato_periodo: 'Para os Exercícios findos em 31 de dezembro de [ANO_ATUAL] e [ANO_ANTERIOR]',
    formato_colunas: 'Descrição | [ANO_ATUAL] | [ANO_ANTERIOR]',
    acao_sem_comparativo: 'Interromper e solicitar ao usuário os dados do exercício anterior antes de prosseguir.',
  },
  capa: {
    obrigatorio: true,
    campos: [
      'Razão social da empresa',
      'CNPJ',
      'Cidade/UF',
      'Título: "Demonstrações Financeiras"',
      'Período: "Exercícios findos em 31 de dezembro de [ANO_ATUAL] e [ANO_ANTERIOR]"',
    ],
  },
  demonstracoes: [
    {
      id: 'BP_ATIVO',
      titulo: 'BALANÇO PATRIMONIAL — ATIVO',
      obrigatorio: true,
      cabecalho: 'Para os Exercícios findos em 31 de dezembro de [ANO_ATUAL] e [ANO_ANTERIOR]\n(Valores expressos em Reais)',
      estrutura_tabela: '3 colunas: Descrição | [ANO_ATUAL] | [ANO_ANTERIOR]',
      rodape: 'As notas explicativas são parte integrante das demonstrações financeiras.',
      assinaturas: 'Local, data, Sócio-Administrador + dados da empresa',
    },
    {
      id: 'BP_PASSIVO',
      titulo: 'BALANÇO PATRIMONIAL — PASSIVO',
      obrigatorio: true,
      cabecalho: 'Para os Exercícios findos em 31 de dezembro de [ANO_ATUAL] e [ANO_ANTERIOR]\n(Valores expressos em Reais)',
      estrutura_tabela: '3 colunas: Descrição | [ANO_ATUAL] | [ANO_ANTERIOR]',
      rodape: 'As notas explicativas são parte integrante das demonstrações financeiras.',
      assinaturas: 'Local, data, Sócio-Administrador + dados da empresa',
    },
    {
      id: 'DRE',
      titulo: 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO',
      obrigatorio: true,
      cabecalho: 'Para os Exercícios findos em 31 de dezembro de [ANO_ATUAL] e [ANO_ANTERIOR]\n(Valores expressos em Reais)',
      estrutura_tabela: '3 colunas: Descrição | [ANO_ATUAL] | [ANO_ANTERIOR]',
      rodape: 'As notas explicativas são parte integrante das demonstrações financeiras.',
      assinaturas: 'Local, data, Sócio-Administrador + dados da empresa',
    },
  ],
  notas_explicativas: {
    cabecalho_pagina: [
      'Razão social + "NOTAS EXPLICATIVAS ÀS DEMONSTRAÇÕES FINANCEIRAS"',
      'Para os exercícios findos em 31 de dezembro de [ANO_ATUAL] e [ANO_ANTERIOR]',
      '(Valores expressos em Reais, exceto quando indicado de outra forma)',
    ],
    notas: [
      {
        numero: 1,
        titulo: 'CONTEXTO OPERACIONAL',
        obrigatorio: true,
        tem_tabela: false,
        conteudo: 'Qualificação jurídica: CNPJ, tipo societário, sede. Principais atividades (serviços, locação, produção).',
      },
      {
        numero: 2,
        titulo: 'BASE DE PREPARAÇÃO E DECLARAÇÃO DE CONFORMIDADE',
        obrigatorio: true,
        tem_tabela: false,
        conteudo: 'Práticas contábeis adotadas no Brasil, CPCs e NBCs aplicáveis. Se o Balancete de [ANO_ATUAL] for provisório: informar explicitamente e mencionar o ajuste de equalização.',
      },
      {
        numero: 3,
        titulo: 'PRINCIPAIS POLÍTICAS CONTÁBEIS',
        obrigatorio: true,
        tem_tabela: false,
        subitens: [
          { id: '3.1', titulo: 'Regime de Competência', norma: 'CPC 26 (R1), item 27' },
          { id: '3.2', titulo: 'Caixa e Equivalentes de Caixa', norma: 'CPC 03 (R2) — prazo de resgate até 90 dias' },
          { id: '3.3', titulo: 'Contas a Receber de Clientes', norma: 'Valor original deduzido de provisão para perdas esperadas quando aplicável' },
          { id: '3.4', titulo: 'Estoques', norma: 'CPC 16 (R1) — custo médio de aquisição/produção, não superior ao VLR' },
          { id: '3.5', titulo: 'Ativo Imobilizado', norma: 'CPC 27 — custo de aquisição menos depreciação acumulada, método linear. Revisão anual de valor recuperável.' },
          { id: '3.6', titulo: 'Fornecedores e Obrigações', norma: 'Valores das obrigações assumidas, sem encargos financeiros exceto quando pactuado' },
          { id: '3.7', titulo: 'Receitas', norma: 'CPC 47 — serviços: quando o controle é transferido ao cliente; locação: linearmente ao longo do período' },
        ],
      },
      { numero: 4, titulo: 'CAIXA E EQUIVALENTES DE CAIXA', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Numerários em espécie, depósitos bancários à vista e aplicações financeiras de alta liquidez com prazo até 90 dias.' },
      { numero: 5, titulo: 'CLIENTES — CONTAS A RECEBER', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Composição do saldo. Análise de variação. Política de provisão para perdas esperadas.' },
      { numero: 6, titulo: 'CRÉDITOS — IMPOSTOS A RECUPERAR E ADIANTAMENTOS', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'ICMS, PIS e COFINS a recuperar. Adiantamentos a fornecedores ou empregados. Variação explicada.' },
      { numero: 7, titulo: 'ESTOQUES', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Composição por tipo de estoque. Método de avaliação declarado (custo médio). Variação explicada.' },
      { numero: 8, titulo: 'ATIVO NÃO CIRCULANTE', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Créditos com sócios, depósitos judiciais, outros realizáveis de longo prazo. Condições e encargos.' },
      { numero: 9, titulo: 'IMOBILIZADO — MOVIMENTAÇÃO DO EXERCÍCIO', obrigatorio: true, tem_tabela: true, colunas_tabela: 'Grupo de bens | Saldo inicial | Adições | Baixas | Depreciação | Saldo final', conteudo: 'Movimentação por grupo de bens (equipamentos, veículos, instalações). Taxa de depreciação declarada.' },
      { numero: 10, titulo: 'FORNECEDORES', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Obrigações por aquisição de insumos, materiais, mercadorias e serviços operacionais. Prazo e encargos.' },
      { numero: 11, titulo: 'OBRIGAÇÕES TRIBUTÁRIAS', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Composição por tributo (ICMS, PIS, COFINS, INSS, IRRF, outros). Saldo devedor ou credor explicado.' },
      {
        numero: 12,
        titulo: 'PATRIMÔNIO LÍQUIDO',
        obrigatorio: true,
        tem_tabela: true,
        colunas_tabela: 3,
        subitens: [
          { id: '12.1', titulo: 'Capital Social', conteudo: 'Valor total, totalmente subscrito e integralizado, composição de quotas/ações.' },
          { id: '12.2', titulo: 'Lucros ou Prejuízos Acumulados', conteudo: 'Saldo do período, variação em relação ao exercício anterior, destinação.' },
          { id: '12.3', titulo: 'Ponto de Atenção — Movimentação Analítica', conteudo: 'Ajustes de exercícios anteriores, ajustes de equalização (balancete provisório), variações relevantes com justificativa detalhada.' },
        ],
      },
      { numero: 13, titulo: 'RECEITA BRUTA E DEDUÇÕES', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Composição da receita bruta por atividade (serviços, locação, venda de produtos). Deduções: impostos sobre vendas, devoluções, abatimentos.' },
      { numero: 14, titulo: 'CUSTO DOS SERVIÇOS E PRODUTOS VENDIDOS', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Insumos, materiais, mão de obra direta e demais gastos operacionais de produção e prestação de serviços.' },
      { numero: 15, titulo: 'DESPESAS OPERACIONAIS', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Despesas administrativas: pessoal, serviços de terceiros, aluguéis, outras despesas gerais. Variação explicada.' },
      { numero: 16, titulo: 'RESULTADO DO EXERCÍCIO — ANÁLISE COMPARATIVA', obrigatorio: true, tem_tabela: true, colunas_tabela: 3, conteudo: 'Síntese: lucro ou prejuízo do exercício. Variação em relação ao exercício anterior com análise das principais causas.' },
      { numero: 17, titulo: 'PARTES RELACIONADAS', obrigatorio: true, tem_tabela: false, conteudo: 'Transações com sócios, administradores e empresas do grupo. Natureza, valores e condições. Se não houver: declarar explicitamente.' },
      { numero: 18, titulo: 'PASSIVOS CONTINGENTES', obrigatorio: true, tem_tabela: false, conteudo: 'Avaliação de passivos prováveis, possíveis e remotos (trabalhistas, fiscais, cíveis). Se não houver: declarar explicitamente.' },
      { numero: 19, titulo: 'EVENTOS SUBSEQUENTES', obrigatorio: true, tem_tabela: false, conteudo: 'Eventos relevantes ocorridos entre 31/12/[ANO_ATUAL] e a data de autorização para emissão das demonstrações. Se não houver: declarar explicitamente.' },
    ],
    encerramento: 'Local, data e assinaturas dos responsáveis técnicos',
  },
  instrucoes_gerais: [
    'PRÉ-CONDIÇÃO BLOQUEANTE: verificar ANTES de iniciar se há dados dos dois exercícios (ANO_ATUAL e ANO_ANTERIOR). Sem comparativo: NÃO executar.',
    'Todas as tabelas de notas: 3 colunas (Descrição, ANO_ATUAL, ANO_ANTERIOR), exceto Nota 9 (movimentação do imobilizado).',
    'Todas as 19 notas são obrigatórias. Adaptar o conteúdo à realidade da empresa — não suprimir notas.',
    'Conta com saldo zero: registrar R$ 0,00 e explicar na nota correspondente (ex.: sem estoques em 2024).',
    'Copiar o template para a pasta do projeto antes de editar — NUNCA editar o arquivo original.',
    'Normas aplicáveis: CPC 26 (R1), CPC 27, CPC 16 (R1), CPC 03 (R2), CPC 47 e NBC TGs correlatas.',
    'Usar revisao_checklist_parecer(categoria: "book_demonstracoes") antes de entregar.',
  ],
};

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
      description:
        "Estrutura completa do parecer técnico (9 seções). " +
        "IMPORTANTE: antes de iniciar qualquer parecer, perguntar ao usuário qual modo usar: " +
        "'Compliance Geral' (técnico completo) ou 'Compliance Empresarial' (resumido, 3-5 páginas, linguagem direta). " +
        "versao: 'padrao' | 'compliance' | 'guerra'. modo: 'geral' | 'empresarial'.",
      inputSchema: {
        versao: z
          .enum(['padrao', 'compliance', 'guerra'])
          .optional()
          .default('padrao')
          .describe(
            "Versão do template: 'padrao' (sem identidade visual) | 'compliance' (Compliance-CE) | 'guerra' (Guerra Advogados)",
          ),
        modo: z
          .enum(['geral', 'empresarial'])
          .optional()
          .default('geral')
          .describe(
            "Modo do parecer: 'geral' (técnico completo, 9 seções extensas) | 'empresarial' (condensado, máx. 3-5 páginas, linguagem simples). SEMPRE perguntar ao usuário antes de iniciar.",
          ),
      },
    },
    async ({ versao, modo }) => {
      const mapa: Record<string, keyof typeof TEMPLATES_CATALOG> = {
        compliance: 'parecer_compliance',
        guerra: 'parecer_guerra',
      };
      const chave = mapa[versao ?? 'padrao'] ?? 'parecer_padrao';
      const estrutura = modo === 'empresarial' ? ESTRUTURA_PARECER_EMPRESARIAL : null;
      const modoConfig = modo === 'empresarial' ? PERGUNTA_MODO.opcoes.empresarial : PERGUNTA_MODO.opcoes.geral;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                fase_1_dados_obrigatorios: DADOS_OBRIGATORIOS_PRE_PARECER,
                pergunta_inicial: PERGUNTA_MODO,
                modo_selecionado: modo ?? 'geral',
                titulo_documento: modoConfig.titulo_documento,
                paginas_max: modoConfig.paginas_max,
                restricoes_ativas: modoConfig.restricoes,
                template_a_usar: TEMPLATES_CATALOG[chave],
                fluxo_9_fases: FLUXO_9_FASES,
                estrutura_9_secoes: estrutura ? estrutura.secoes : ESTRUTURA_PARECER.secoes,
                instrucoes_gerais: estrutura ? estrutura.instrucoes_gerais : ESTRUTURA_PARECER.instrucoes_gerais,
                ...(estrutura ? { linguagem: estrutura.linguagem } : {}),
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
    'layout_estrutura_book',
    {
      description:
        'Estrutura completa do Book das Demonstrações Contábeis (BP Ativo, BP Passivo, DRE e 19 notas). ' +
        'ATENÇÃO: verificar ANTES de iniciar se há dados de DOIS exercícios (ano atual E ano anterior). ' +
        'Sem dados comparativos do ano anterior = NÃO executar o book. ' +
        'Retorna pré-condições, estrutura das 3 demonstrações e das 19 notas explicativas obrigatórias.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              template: TEMPLATES_CATALOG.book_demonstracoes,
              estrutura: ESTRUTURA_BOOK_DEMONSTRACOES,
            },
            null,
            2,
          ),
        },
      ],
    }),
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
