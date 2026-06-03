/**
 * tools/revisao.tools.ts
 * MCP de Revisão — Marcos Lima / Guerra Advogados
 * Garante que todo parecer elaborado passe pela revisão padrão antes de ser entregue.
 *
 * Tools:
 *   revisao_checklist_parecer  — checklist completo por categoria (estático)
 *   revisao_normas_vigentes    — status das normas CPC/NBC/LC para IBS/CBS (estático)
 *   revisao_linguagem          — análise dinâmica de texto: aponta violações de escrita
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ─── DADOS ESTÁTICOS ──────────────────────────────────────────────────────────

const CHECKLIST: Record<string, { descricao: string; itens: Array<{ id: string; item: string; como_verificar: string; critico: boolean }> }> = {
  template: {
    descricao: 'Modelo visual Guerra Advogados',
    itens: [
      { id: 'T1', item: 'Documento gerado a partir do template oficial (PARECER CONTÁBIL E TRIBUTÁRIO - MODELO.docx)', como_verificar: 'Verificar se o script usa Document(TEMPLATE) e clear_body()', critico: true },
      { id: 'T2', item: 'Header Guerra Advogados preservado (logo e identidade visual)', como_verificar: 'Confirmar section.header tem pelo menos 1 parágrafo com conteúdo', critico: true },
      { id: 'T3', item: 'Margens: top 3,5 cm | bottom 4,5 cm | left 3,0 cm | right 2,5 cm', como_verificar: 'Conferir doc.sections[0].top_margin.cm == 3.5', critico: true },
      { id: 'T4', item: 'Cor do texto: #1A1A1A (Guerra dark) em corpo, títulos e células', como_verificar: 'Verificar RGBColor(0x1A, 0x1A, 0x1A) em todos os run.font.color.rgb', critico: false },
      { id: 'T5', item: 'Bordas de tabelas: cinza #808080 via set_table_borders()', como_verificar: 'Confirmar ausência de "Table Grid" e presença de set_table_borders', critico: false },
    ],
  },
  formatacao: {
    descricao: 'Regras de formatação DOCX (Genesis)',
    itens: [
      { id: 'F1', item: 'Espaçamento 1,5 em todos os parágrafos', como_verificar: 'paragraph_format.line_spacing = 1.5 em todos os add_text/add_heading', critico: true },
      { id: 'F2', item: 'Texto justificado (exceto títulos)', como_verificar: 'WD_ALIGN_PARAGRAPH.JUSTIFY em todos os parágrafos de corpo', critico: true },
      { id: 'F3', item: 'Dados sempre em tabela — nunca em parágrafos corridos', como_verificar: 'Verificar se há listas de itens comparativos sem tabela', critico: true },
      { id: 'F4', item: 'Lançamentos contábeis em fonte Courier New 9pt', como_verificar: "run.font.name = 'Courier New' nos add_lancamentos", critico: false },
      { id: 'F5', item: 'Cabeçalho de tabela cinza #C8C8C8 | zebraçado #F0F0F0/#FFFFFF', como_verificar: "shade_cell(cell, 'C8C8C8') nos headers", critico: false },
      { id: 'F6', item: 'Nenhuma cor além de preto/cinza (sem azul, vermelho, verde)', como_verificar: 'Verificar ausência de cores não permitidas em run.font.color', critico: true },
    ],
  },
  estrutura: {
    descricao: 'Estrutura obrigatória — 9 seções',
    itens: [
      { id: 'E1', item: 'Cabeçalho: tabela com CONSULENTE, DATA, ASSUNTO, LEGISLAÇÃO (4 linhas)', como_verificar: 'Confirmar presença das 4 linhas no tbl_cab — sem PARECERISTAS nem EMITIDO POR', critico: true },
      { id: 'E2', item: 'I. QUESTIONAMENTO — contexto e perguntas enumeradas', como_verificar: 'Seção presente e com as perguntas do solicitante', critico: true },
      { id: 'E3', item: 'II. INTERPRETAÇÃO NORMATIVA — análise com subseções numeradas', como_verificar: 'Subseções 3.1, 3.2... presentes', critico: true },
      { id: 'E4', item: 'III. IMPLICAÇÕES PRÁTICAS — lançamentos e exemplos numéricos', como_verificar: 'Pelo menos uma tabela e um bloco de lançamentos', critico: true },
      { id: 'E5', item: 'IV. ORIENTAÇÕES OPERACIONAIS — o que o cliente deve fazer', como_verificar: 'Itens numerados a), b), c)...', critico: true },
      { id: 'E6', item: 'V. VEDAÇÕES E EXCEÇÕES — riscos e restrições legais', como_verificar: 'Pelo menos 3 vedações específicas ao assunto', critico: true },
      { id: 'E7', item: 'VI. CITAÇÕES COMPLEMENTARES — jurisprudência, doutrina, normas', como_verificar: 'Inclui RE 574.706 e Informe Técnico quando relevante', critico: false },
      { id: 'E8', item: 'VIII. CONCLUSÃO — resposta direta às perguntas, numerada', como_verificar: 'Cada conclusão responde a uma pergunta do Questionamento', critico: true },
      { id: 'E9', item: 'ASSINATURA — tabela com os 3 pareceristas', como_verificar: 'Fellipe Guerra CRC 21.074 | Marcos Lima CRC 23.224 | Mathaus Pordeus OAB 52.206', critico: true },
    ],
  },
  base_legal_ibs_cbs: {
    descricao: 'Base legal mínima para pareceres IBS/CBS (reforma tributária)',
    itens: [
      { id: 'BL1', item: 'LC 214/2025 citada com artigos específicos (nunca apenas "LC 214/2025")', como_verificar: 'Cada referência tem art. Xº identificado', critico: true },
      { id: 'BL2', item: 'EC 132/2023, art. 149-B, CF — tributação "por fora" e não cumulatividade', como_verificar: 'Presente no cabeçalho (LEGISLAÇÃO) e/ou Citações Complementares', critico: true },
      { id: 'BL3', item: 'CPC 00 (R2), Capítulo 5 (Reconhecimento e Desreconhecimento)', como_verificar: 'Citado como "CPC 00 (R2), Capítulo 5" — NÃO "itens 4.26-4.36" (numeração R1 obsoleta)', critico: true },
      { id: 'BL4', item: 'CPC 51 — Apresentação e Divulgação (jan/2026)', como_verificar: 'Presente em Base Legal e Citações', critico: true },
      { id: 'BL5', item: 'NBC TG 51 — Apresentação e Divulgação (fev/2026, CFC)', como_verificar: 'Presente em Base Legal e Citações', critico: true },
      { id: 'BL6', item: 'NBC TG 32 (R4) citada como referência POR ANALOGIA — não como norma direta', como_verificar: 'Texto deve conter "(por analogia)" ou "referência por analogia"', critico: true },
      { id: 'BL7', item: 'Ato Conjunto RFB/CGIBS nº 1/2025 — ATENÇÃO: penalidades vigentes desde 01/06/2026 (prazo de suspensão expirou em 31/05/2026)', como_verificar: 'Se o parecer mencionar suspensão de penalidades, corrigir: prazo expirou. Citar obrigatoriedade integral a partir de jun/2026', critico: true },
      { id: 'BL8', item: 'Informe Técnico 2026.002 v.1.00 — alíquotas CBS 0,9% + IBS 0,1% para 2026 (fase teste)', como_verificar: 'Presente quando há menção de alíquotas de 2026. Alertar que alíquotas padrão definitivas aguardam resolução.', critico: false },
      { id: 'BL9', item: 'LACUNA NORMATIVA declarada — nenhum CPC/NBC específico sobre IBS/CBS', como_verificar: 'Texto menciona ausência de pronunciamento específico do CPC/CFC', critico: true },
      { id: 'BL10', item: 'Reconhecimento contábil: regime de competência declarado explicitamente (IBS/CBS reconhecido quando ocorre o fato gerador, não no pagamento)', como_verificar: 'Parecer menciona regime de competência e cita CPC 00 (R2) Capítulo 5 como fundamento; distingue da base de caixa do DAS/Simples quando aplicável', critico: true },
      { id: 'BL11', item: 'LC 227/2025 (CGIBS) citada quando o tema envolve administração, fiscalização, contencioso ou compensação do IBS', como_verificar: 'Verificar se o tema é sobre gestão do IBS — se sim, citar LC 227/2025', critico: false },
      { id: 'BL12', item: 'NT 2025.002 v1.34 citada (versão atual) quando o tema envolve NF-e, grupo RTC ou campos IBS/CBS no XML', como_verificar: 'Verificar se está citando versão atualizada (v1.34) — v1.00 está desatualizada', critico: true },
      { id: 'BL13', item: 'Decreto nº 12.955/2026 citado quando o tema envolve Split Payment operacional', como_verificar: 'Para pareceres sobre Split Payment publicados após abr/2026: citar o Decreto 12.955/2026', critico: false },
    ],
  },
  linguagem: {
    descricao: 'Regras de escrita — proibições e estilo (Fase 5: revisao_linguagem)',
    itens: [
      { id: 'L1', item: 'ZERO travessões (—) em todo o texto corrido', como_verificar: 'Buscar "—" no texto. Substituir por vírgula ou dois-pontos. ERRADO: "O prazo — previsto no art. 3º — é de 30 dias." CERTO: "O prazo previsto no art. 3º é de 30 dias."', critico: true },
      { id: 'L2', item: 'Nenhuma das 50+ palavras proibidas (destarte, outrossim, consoante, nortear, robusto, expertise, pari passu, ab initio, ex vi...)', como_verificar: 'Usar revisao_linguagem(texto) — retorna cada ocorrência com substituto sugerido', critico: true },
      { id: 'L3', item: 'Nenhum erro gramatical ("a nível de", "ao meu ver")', como_verificar: 'Verificar na lista de violações retornada pela ferramenta. "a nível de" → "no âmbito de" / "em termos de"', critico: true },
      { id: 'L4', item: 'Sem gerundismo em escrita técnica formal ("estaremos analisando", "iremos verificando")', como_verificar: 'Substituir por forma verbal direta: "analisaremos", "verificará", "será enviado"', critico: true },
      { id: 'L5', item: 'Sem seta (→) em texto corrido — apenas em lançamentos contábeis e diagramas técnicos', como_verificar: 'Verificar se há "→" fora de blocos de lançamentos contábeis', critico: false },
      { id: 'L6', item: 'Sem "através de" com sentido de instrumento ou método', como_verificar: 'Substituir por "por meio de" (instrumento/método) ou "mediante" (formalidade)', critico: false },
      { id: 'L7', item: 'Colocação pronominal correta — pronome oblíquo não inicia frase', como_verificar: 'Reorganizar: "Cabe-nos", "Foi-lhe informado", ou usar sujeito explícito', critico: false },
      { id: 'L8', item: 'Sem "onde" referindo-se a pessoas, entidades ou conceitos abstratos (não-lugar)', como_verificar: 'Substituir por "em que", "no qual", "na qual", "nos quais"', critico: false },
      { id: 'L9', item: 'Sem redundâncias clássicas ("há anos atrás", "certeza absoluta", "breve resumo")', como_verificar: 'Verificar lista de redundâncias retornada pela ferramenta', critico: false },
      { id: 'L10', item: 'Sem palavras repetidas em sequência ("que que", "de de", "a a")', como_verificar: 'Remover a repetição', critico: false },
      { id: 'L11', item: 'Sem espaço duplo entre palavras', como_verificar: 'Substituir por espaço simples', critico: false },
      { id: 'L12', item: 'Frases com no máximo 65 palavras', como_verificar: 'Dividir frases longas em duas ou três menores. Verificado automaticamente por revisao_linguagem(texto)', critico: false },
    ],
  },
  entrega: {
    descricao: 'Checklist final antes de enviar',
    itens: [
      { id: 'EN1', item: 'DOCX salvo na pasta correta do cliente (Parecer 01 ou 02)', como_verificar: 'Confirmar DESTINO no script aponta para a pasta certa', critico: true },
      { id: 'EN2', item: 'Script Python preservado ao lado do DOCX (rastreabilidade)', como_verificar: 'gerar_parecer.py ou gerar_parecer_02.py presente na pasta', critico: true },
      { id: 'EN3', item: 'E-mail de solicitação (PDF) presente na mesma pasta', como_verificar: 'E-mail ... .pdf ao lado do DOCX', critico: false },
      { id: 'EN4', item: 'Pasta nomeada com "RESPONDER" removido após entrega', como_verificar: 'Renomear "Parecer 02 - Simples Nacional [RESPONDER]" → "Parecer 02 - Simples Nacional [ENTREGUE]"', critico: false },
    ],
  },
  modo_parecer: {
    descricao: 'Verificação do modo de parecer (Geral ou Empresarial) — Fase 1 obrigatória',
    itens: [
      { id: 'M1', item: 'Modo confirmado com o usuário ANTES de iniciar a elaboração — nunca assumir modo sem confirmar', como_verificar: 'Verificar se houve confirmação explícita do usuário antes de escrever qualquer linha de conteúdo', critico: true },
      { id: 'M2', item: 'Modo Geral: extensão máxima de 5 páginas', como_verificar: 'Contar páginas do DOCX gerado ou estimar — N/A se modo=empresarial. Ao completar cada seção, estimar acumulado e ajustar profundidade das próximas.', critico: true },
      { id: 'M3', item: 'Modo Empresarial: extensão máxima de 3 páginas', como_verificar: 'Contar páginas do DOCX gerado ou estimar — N/A se modo=geral. Cada seção deve caber em no máximo 4-6 linhas.', critico: true },
      { id: 'M4', item: 'Modo Geral: 9 seções em extensão integral com profundidade técnica (Cabeçalho, Questionamento, Interpretação Normativa, Implicações, Orientações, Vedações, Citações, Conclusão, Assinatura)', como_verificar: 'Verificar presença e extensão adequada de cada seção — N/A se modo=empresarial', critico: true },
      { id: 'M5', item: 'Modo Empresarial: 9 seções condensadas — nenhuma pode ser omitida', como_verificar: 'Verificar: Cabeçalho, A Situação, A Resposta, Implicações, O que fazer, Riscos, Base Legal, Conclusão, Assinatura — todas presentes mesmo que em 2-4 linhas — N/A se modo=geral', critico: true },
      { id: 'M6', item: 'Modo Empresarial: linguagem acessível — termos técnicos definidos na mesma linha ("boleto" em vez de "DAE", "imposto" em vez de "tributo", "nota fiscal" em vez de "NF-e")', como_verificar: 'Revisar se siglas e jargões foram substituídos ou explicados — N/A se modo=geral', critico: true },
      { id: 'M7', item: 'Título correto: "PARECER TÉCNICO-TRIBUTÁRIO" (Geral) ou "NOTA TÉCNICA TRIBUTÁRIA" (Empresarial)', como_verificar: 'Verificar o título no script Python e no DOCX gerado', critico: true },
    ],
  },
  revalidacao_tecnica: {
    descricao: 'Fase 7 — Revalidação Técnica Final (NOVO — OBRIGATÓRIO). Aplicar APÓS Checklist de Qualidade (Fase 6) e ANTES da geração do DOCX (Fase 8). Valida conteúdo jurídico, coerência lógica e aplicabilidade prática — complementa o Checklist de Qualidade, nenhuma das duas substitui a outra.',
    itens: [
      { id: 'RV1', item: 'Todas as perguntas da consulente foram respondidas de forma expressa', como_verificar: 'Comparar as perguntas do Questionamento (seção I) com as respostas da Conclusão (seção VII), uma a uma', critico: true },
      { id: 'RV2', item: 'Nenhuma pergunta ficou parcialmente respondida', como_verificar: 'Cada conclusão numérica corresponde a uma pergunta do item I. Verificar se há perguntas sem resposta direta.', critico: true },
      { id: 'RV3', item: 'Não existem conclusões sem fundamentação correspondente na seção II', como_verificar: 'Cada afirmação da Conclusão tem desenvolvimento anterior na Fundamentação. Nenhuma tese nova introduzida na Conclusão.', critico: true },
      { id: 'RV4', item: 'Todos os artigos citados existem no texto legal e estão vigentes na data do parecer', como_verificar: 'Verificar cada dispositivo no texto legal (fetch URL ou consulta). Nenhum revogado citado como vigente sem indicar a norma revogadora.', critico: true },
      { id: 'RV5', item: 'Sem conflito entre normas citadas sem justificativa de hierarquia', como_verificar: 'Norma superior prevalece; conflitos entre normas devem ser explicados com hierarquia (CF > LC > LO > Decreto > Ato normativo)', critico: true },
      { id: 'RV6', item: 'A conclusão decorre diretamente da fundamentação — sem teses jurídicas novas na conclusão', como_verificar: 'Nenhum dispositivo legal deve aparecer pela primeira vez na Conclusão. Nenhum argumento novo introduzido após a Fundamentação.', critico: true },
      { id: 'RV7', item: 'Coerência entre Relatório, Fundamentação e Conclusão', como_verificar: 'O objeto do Relatório é o mesmo analisado na Fundamentação e respondido na Conclusão. Sem desvio de objeto.', critico: true },
      { id: 'RV8', item: 'O cliente sabe exatamente o que fazer após ler o parecer', como_verificar: 'Orientações operacionais claras, numeradas e executáveis presentes na seção IV. Verificar se a seção de orientações responde "o que fazer concretamente?"', critico: true },
      { id: 'RV9', item: 'Riscos e limitações identificados com consequências práticas', como_verificar: 'Seção V (Vedações e Exceções) apresenta ao menos 3 vedações/riscos específicos com consequências práticas descritas', critico: true },
      { id: 'RV10', item: 'Exemplos práticos: cálculos aritmeticamente corretos, alíquotas e datas do período de vigência normativa', como_verificar: 'Verificar cada cálculo manualmente. Confirmar vigência normativa dos valores usados. N/A se não há exemplos práticos.', critico: true },
      { id: 'RV11', item: 'Sem exemplo que contradiga a fundamentação ou a conclusão', como_verificar: 'Resultado numérico do exemplo deve ser consistente com o posicionamento jurídico adotado. N/A se não há exemplos.', critico: true },
    ],
  },
  book_demonstracoes: {
    descricao: 'Validação do Book das Demonstrações Contábeis — pré-condições, demonstrações e 19 notas',
    itens: [
      { id: 'BD1', item: 'PRÉ-CONDIÇÃO BLOQUEANTE: dados de DOIS exercícios presentes (ANO_ATUAL e ANO_ANTERIOR)', como_verificar: 'Confirmar se o usuário forneceu valores dos dois exercícios. Se não houver dados do exercício anterior: REPROVAR e NÃO executar o book. Solicitar os dados faltantes.', critico: true },
      { id: 'BD2', item: 'BALANÇO PATRIMONIAL — ATIVO: tabela comparativa 3 colunas', como_verificar: 'Colunas: Descrição, ANO_ATUAL, ANO_ANTERIOR. Cabeçalho com período duplo. Rodapé: "notas explicativas são parte integrante". Assinaturas.', critico: true },
      { id: 'BD3', item: 'BALANÇO PATRIMONIAL — PASSIVO: tabela comparativa 3 colunas', como_verificar: 'Colunas: Descrição, ANO_ATUAL, ANO_ANTERIOR. Cabeçalho com período duplo. Rodapé: "notas explicativas são parte integrante". Assinaturas.', critico: true },
      { id: 'BD4', item: 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO: tabela comparativa 3 colunas', como_verificar: 'Colunas: Descrição, ANO_ATUAL, ANO_ANTERIOR. Cabeçalho com período duplo. Rodapé: "notas explicativas são parte integrante". Assinaturas.', critico: true },
      { id: 'BD5', item: 'NOTA 1 — Contexto Operacional presente', como_verificar: 'CNPJ, tipo societário, sede e principais atividades da empresa descritos.', critico: true },
      { id: 'BD6', item: 'NOTA 2 — Base de Preparação e Declaração de Conformidade presente', como_verificar: 'Menção a CPCs e NBCs aplicáveis. Se Balancete provisório: informar explicitamente e mencionar ajuste de equalização.', critico: true },
      { id: 'BD7', item: 'NOTA 3 — Principais Políticas Contábeis com os 7 subitens (3.1 a 3.7)', como_verificar: '3.1 Regime de Competência (CPC 26), 3.2 Caixa (CPC 03), 3.3 Recebíveis, 3.4 Estoques (CPC 16), 3.5 Imobilizado (CPC 27), 3.6 Fornecedores, 3.7 Receitas (CPC 47). Todos presentes.', critico: true },
      { id: 'BD8', item: 'NOTA 4 — Caixa e Equivalentes de Caixa: tabela comparativa', como_verificar: 'Tabela 3 colunas. Composição explicada (numerário, depósitos, aplicações até 90 dias).', critico: true },
      { id: 'BD9', item: 'NOTA 5 — Clientes / Contas a Receber: tabela comparativa', como_verificar: 'Tabela 3 colunas. Análise de variação entre exercícios presente.', critico: true },
      { id: 'BD10', item: 'NOTA 6 — Créditos / Impostos a Recuperar: tabela comparativa', como_verificar: 'Tabela 3 colunas. Composição por tributo (ICMS, PIS, COFINS) e adiantamentos.', critico: true },
      { id: 'BD11', item: 'NOTA 7 — Estoques: tabela comparativa', como_verificar: 'Tabela 3 colunas. Método de avaliação (custo médio) declarado. Se saldo zero em algum exercício: explicar.', critico: true },
      { id: 'BD12', item: 'NOTA 8 — Ativo Não Circulante: tabela comparativa', como_verificar: 'Tabela 3 colunas. Créditos com sócios e outros itens de longo prazo identificados com condições.', critico: true },
      { id: 'BD13', item: 'NOTA 9 — Imobilizado: tabela de movimentação do exercício', como_verificar: 'Colunas: Grupo de bens, Saldo inicial, Adições, Baixas, Depreciação, Saldo final. Taxa de depreciação declarada por grupo.', critico: true },
      { id: 'BD14', item: 'NOTA 10 — Fornecedores: tabela comparativa', como_verificar: 'Tabela 3 colunas. Natureza das obrigações e encargos.', critico: true },
      { id: 'BD15', item: 'NOTA 11 — Obrigações Tributárias: tabela comparativa', como_verificar: 'Tabela 3 colunas. Composição por tributo. Saldo devedor ou credor explicado.', critico: true },
      { id: 'BD16', item: 'NOTA 12 — Patrimônio Líquido: tabela comparativa com subitens 12.1, 12.2 e 12.3', como_verificar: 'Tabela 3 colunas. Subitens: 12.1 Capital Social, 12.2 Lucros/Prejuízos Acumulados, 12.3 Movimentação Analítica (ajustes de exercícios anteriores e equalizações detalhados).', critico: true },
      { id: 'BD17', item: 'NOTA 13 — Receita Bruta e Deduções: tabela comparativa', como_verificar: 'Tabela 3 colunas. Segregação por atividade (serviços, locação, produtos). Deduções discriminadas.', critico: true },
      { id: 'BD18', item: 'NOTA 14 — Custo dos Serviços e Produtos Vendidos: tabela comparativa', como_verificar: 'Tabela 3 colunas. Composição dos custos por categoria.', critico: true },
      { id: 'BD19', item: 'NOTA 15 — Despesas Operacionais: tabela comparativa', como_verificar: 'Tabela 3 colunas. Principais categorias (pessoal, terceiros, aluguéis, outras). Variação explicada.', critico: true },
      { id: 'BD20', item: 'NOTA 16 — Resultado do Exercício / Análise Comparativa: tabela presente', como_verificar: 'Tabela comparativa. Análise da variação lucro/prejuízo com justificativa das principais causas.', critico: true },
      { id: 'BD21', item: 'NOTA 17 — Partes Relacionadas presente', como_verificar: 'Identificar transações com sócios/administradores/grupo. Se não houver: declarar ausência explicitamente.', critico: true },
      { id: 'BD22', item: 'NOTA 18 — Passivos Contingentes presente', como_verificar: 'Avaliar prováveis, possíveis e remotos. Se não houver: declarar explicitamente que nenhum foi identificado.', critico: true },
      { id: 'BD23', item: 'NOTA 19 — Eventos Subsequentes presente', como_verificar: 'Eventos entre 31/12/[ANO_ATUAL] e a data de autorização para emissão. Se não houver: declarar explicitamente.', critico: true },
      { id: 'BD24', item: 'Encerramento: local, data e assinaturas nas 3 demonstrações', como_verificar: 'Cada uma das 3 demonstrações tem rodapé "Fortaleza (CE), [data]" e bloco de assinaturas com dados da empresa.', critico: true },
    ],
  },
};

const REVALIDACAO_TESTES = {
  descricao: 'Fase 7 — Testes obrigatórios de Revalidação Técnica Final. Aplicar APÓS RV1-RV11 e ANTES de gerar o DOCX.',
  teste_pergunta_unica: {
    descricao: 'Teste da Pergunta Única — executar antes de avançar para Fase 8',
    pergunta: 'Se o cliente ler APENAS a Conclusão do parecer, ele conseguirá entender a resposta final da consulta?',
    resposta_esperada: 'SIM',
    acao_se_nao: 'Retornar à Conclusão e reescrever para que seja autoexplicativa. A Conclusão deve ser compreensível sem leitura prévia da Fundamentação.',
  },
  teste_defesa_fiscal: {
    descricao: 'Teste de Defesa Fiscal — critério final e mais exigente da revalidação',
    pergunta: 'Se este parecer fosse apresentado amanhã para um Auditor da Receita Federal, Fiscal Estadual, Fiscal Municipal, membro do CARF ou Magistrado, a fundamentação suportaria a conclusão adotada?',
    resposta_sim: 'Prosseguir para a Fase 8 (geração do DOCX)',
    resposta_nao: 'Reabrir a Fundamentação antes de avançar. Verificar: norma citada sustenta a conclusão sem interpretação forçada? Existe precedente CARF contrário não abordado? A tese resiste à interpretação literal do fisco?',
    obs: 'Quando NÃO, registrar expressamente na seção V (Vedações e Exceções) o risco identificado e as condições de contestação pelo fisco.',
  },
  nota_confiabilidade: {
    descricao: 'Nota de Confiabilidade — uso interno, NÃO publicar no documento entregue ao cliente',
    criterios: ['Base Legal (0-10)', 'Atualização Normativa (0-10)', 'Coerência Jurídica (0-10)', 'Aplicação Prática (0-10)', 'Clareza da Conclusão (0-10)'],
    interpretacao: {
      aprovado: '9,0 a 10,0 → APROVADO — prosseguir para Fase 8',
      aprovado_com_ressalvas: '8,0 a 8,9 → APROVADO COM RESSALVAS — registrar limitação expressa na Conclusão do parecer',
      reprovado: 'Abaixo de 8,0 → REPROVADO — retornar para revisão antes de avançar',
    },
  },
};

const NORMAS_VIGENTES = {
  cpc: [
    { codigo: 'CPC 00 (R2)', titulo: 'Estrutura Conceitual para Relatório Financeiro', vigencia: '10/12/2019', status: 'VIGENTE', observacao: 'Reconhecimento em Capítulo 5. Não citar como "itens 4.26-4.36" (numeração R1 obsoleta).' },
    { codigo: 'CPC 32', titulo: 'Tributos sobre o Lucro', vigencia: '16/09/2009', status: 'VIGENTE', observacao: 'Aplica-se a IRPJ/CSLL. Para IBS/CBS: usar APENAS como referência por analogia.' },
    { codigo: 'CPC 47', titulo: 'Receita de Contrato com Cliente', vigencia: '22/12/2016', status: 'VIGENTE', observacao: 'Relevante para reconhecimento de receita em contratos com Fortes/software.' },
    { codigo: 'CPC 51', titulo: 'Apresentação e Divulgação nas Demonstrações Contábeis', vigencia: '07/01/2026', status: 'VIGENTE — NOVO', observacao: 'Substitui aspectos do CPC 26. Diretamente relevante para apresentação de IBS/CBS na DRE. OBRIGATÓRIO citar em pareceres IBS/CBS a partir de 2026.' },
    { codigo: 'CPC 26 (R1)', titulo: 'Apresentação das Demonstrações Contábeis', vigencia: '25/11/2011', status: 'PARCIALMENTE SUBSTITUÍDO pelo CPC 51 em 2026', observacao: 'Verificar quais aspectos ainda vigem com publicação do CPC 51.' },
  ],
  nbc: [
    { codigo: 'NBC TG 32 (R4)', titulo: 'Tributos sobre o Lucro', vigencia: '22/12/2017', status: 'VIGENTE', observacao: 'Correlação: CPC 32 / IAS 12. Usar por analogia para IBS/CBS — não é norma direta.' },
    { codigo: 'NBC TG 51', titulo: 'Apresentação e Divulgação nas Demonstrações Contábeis', vigencia: '25/02/2026', status: 'VIGENTE — NOVO', observacao: 'CFC — correlação com IFRS 18. Par do CPC 51. OBRIGATÓRIO citar em pareceres IBS/CBS.' },
    { codigo: 'NBC TG 09 (R1)', titulo: 'Demonstração do Valor Adicionado (DVA)', vigencia: '08/03/2024', status: 'VIGENTE', observacao: 'Relevante quando o parecer envolve impacto na DVA com IBS/CBS.' },
  ],
  legislacao: [
    { codigo: 'LC 214/2025', titulo: 'Institui o IBS, CBS e IS — Lei da Reforma Tributária do Consumo', vigencia: '16/01/2025', status: 'VIGENTE — fase obrigatória a partir de jun/2026', observacao: 'Transição 2026-2032. Artigos mais citados: fato gerador (6-9), base cálculo (12-15), alíquotas (16-23), não cumulatividade (28-47), split payment (34), simples nacional (99-127), IS (153-166), transição (337-370).' },
    { codigo: 'LC 227/2025', titulo: 'Cria o CGIBS — Comitê Gestor do IBS', vigencia: '2025', status: 'VIGENTE', observacao: 'Cria o Comitê Gestor do IBS como entidade pública federal autônoma. Define administração, fiscalização, contencioso administrativo e compensação do IBS. Citar quando o tema envolver administração tributária do IBS, disputas, compensação ou restituição.' },
    { codigo: 'LC 224/2025', titulo: 'Redução de incentivos fiscais federais', vigencia: '2025', status: 'VIGENTE', observacao: 'Reduz 10% linearmente incentivos fiscais federais durante transição. Exclui: Simples Nacional, Zona Franca de Manaus, imunidades constitucionais, cesta básica, programas sociais.' },
    { codigo: 'EC 132/2023', titulo: 'Reforma Tributária — Emenda Constitucional', vigencia: '20/12/2023', status: 'VIGENTE', observacao: 'Art. 149-B CF: tributação por fora e não cumulatividade plena. Base constitucional do IBS/CBS. Citar em todos os pareceres IBS/CBS.' },
    { codigo: 'LC 123/2006', titulo: 'Estatuto Nacional da Microempresa — Simples Nacional', vigencia: '14/12/2006', status: 'VIGENTE (parcialmente alterada por LC 214/2025)', observacao: 'Art. 18, §§ 14-15: regime de caixa para DAS. Não aplica regime de caixa ao IBS/CBS. Verificar arts. alterados pela LC 214.' },
    { codigo: 'Ato Conjunto RFB/CGIBS nº 1/2025', titulo: 'Alíquotas fase teste e suspensão de penalidades', vigencia: '2025-2026', status: 'PENALIDADES EXPIRADAS — obrigatoriedade integral desde 01/06/2026', observacao: 'ATENÇÃO: prazo de suspensão de penalidades venceu em 31/05/2026. A partir de 01/06/2026 as obrigações da fase teste são plenamente exigíveis com penalidades.' },
    { codigo: 'Informe Técnico 2026.002 v.1.00', titulo: 'Alíquotas CBS/IBS para 2026', vigencia: '2026', status: 'VIGENTE', observacao: 'CBS: 0,9% | IBS: 0,1% — alíquotas válidas para todo o ano de 2026 (fase teste).' },
    { codigo: 'Decreto nº 12.955/2026', titulo: 'Regulamentação do Split Payment e disposições operacionais', vigencia: '29/04/2026', status: 'VIGENTE', observacao: 'Regulamenta operacionalmente o Split Payment. Citar em pareceres sobre retenção automática de IBS/CBS, integração bancária e obrigações do adquirente.' },
    { codigo: 'Resolução CGSB nº 6/2026', titulo: 'Regulamento do IBS', vigencia: '30/04/2026', status: 'VIGENTE', observacao: 'Regulamento infralegal do IBS aprovado pelo Comitê Gestor. Detalha procedimentos de apuração, creditamento e obrigações acessórias do IBS.' },
    { codigo: 'NT 2025.002 v1.34', titulo: 'NF-e — Adequações para IBS/CBS/IS (grupo RTC)', vigencia: '2026', status: 'VERSÃO ATUAL — substituiu v1.00 até v1.33', observacao: 'Obrigatoriedade do grupo RTC (Registro de Cálculo de Tributos) na NF-e. Campos: vBC_IBS, pIBS, vIBS, vBC_CBS, pCBS, vCBS, vIS. Versão mais recente: v1.34 (dez/2025).' },
  ],
  lacunas: [
    { tema: 'Contabilização IBS/CBS', status: 'SEM PRONUNCIAMENTO', observacao: 'CPC e CFC não emitiram norma específica sobre como contabilizar IBS/CBS. Pareceres DEVEM declarar essa lacuna explicitamente e usar CPC 51 + NBC TG 51 + CPC 00 (R2) Cap. 5 por analogia.' },
    { tema: 'IVA Passivo de Creditamento — Simples Nacional', status: 'AGUARDANDO CGIBS', observacao: 'Percentual exato do crédito restrito do tomador (art. 127 LC 214) ainda não regulamentado pelo Comitê Gestor do IBS.' },
    { tema: 'Split Payment — reflexo contábil', status: 'PARCIALMENTE REGULAMENTADO', observacao: 'Decreto 12.955/2026 regulamentou o mecanismo operacional. Reflexo contábil específico ainda sem pronunciamento CPC/CFC.' },
    { tema: 'IBS/CBS no Simples Nacional a partir de 2029', status: 'AGUARDANDO CGIBS/RFB', observacao: 'Condições para integração do IBS/CBS ao DAS a partir de 2029 ainda não definidas. Não antecipar sem norma publicada.' },
    { tema: 'Alíquotas padrão definitivas IBS/CBS', status: 'AGUARDANDO RESOLUÇÃO SENADO/CGIBS', observacao: 'Alíquotas de referência definitivas (estimativa: ~17,7% total) dependem de resolução ainda não publicada. Usar apenas estimativas com ressalva explícita.' },
  ],
};

const PALAVRAS_PROIBIDAS: Array<{ palavra: string; substituto: string }> = [
  { palavra: 'cumpre salientar', substituto: 'vale destacar (ou suprimir)' },
  { palavra: 'destarte', substituto: 'portanto / assim' },
  { palavra: 'outrossim', substituto: 'além disso / também' },
  { palavra: 'no que tange', substituto: 'quanto a / sobre' },
  { palavra: 'consoante', substituto: 'conforme / segundo' },
  { palavra: 'mister se faz', substituto: 'é necessário' },
  { palavra: 'forçoso reconhecer', substituto: 'é preciso reconhecer' },
  { palavra: 'afigura-se', substituto: 'parece / é' },
  { palavra: 'urge destacar', substituto: 'vale destacar' },
  { palavra: 'ressalte-se que', substituto: 'destaque-se que / note-se que' },
  { palavra: 'importa destacar', substituto: 'cabe destacar / vale notar' },
  { palavra: 'em que pese', substituto: 'apesar de / embora' },
  { palavra: 'de plano', substituto: 'desde já / imediatamente' },
  { palavra: 'a toda evidência', substituto: 'claramente / evidentemente' },
  { palavra: 'resta consignado', substituto: 'fica registrado' },
  { palavra: 'de logo', substituto: 'desde já' },
  { palavra: 'em síntese apertada', substituto: 'em resumo / resumidamente' },
  { palavra: 'assim sendo', substituto: 'portanto (ou remover)' },
  { palavra: 'nesse diapasão', substituto: 'nesse sentido (ou remover)' },
  { palavra: 'precipuamente', substituto: 'principalmente / sobretudo' },
  { palavra: 'sobremodo', substituto: 'muito / especialmente' },
  { palavra: 'é forçoso concluir', substituto: 'conclui-se / portanto' },
  { palavra: 'nesse passo', substituto: 'nesse ponto / aqui' },
  { palavra: 'ab initio', substituto: 'desde o início' },
  { palavra: 'ex vi', substituto: 'por força de / nos termos de' },
  { palavra: 'verifica-se que', substituto: 'afirmação direta (remover a introdução)' },
  { palavra: 'nota-se que', substituto: 'afirmação direta' },
  { palavra: 'observa-se que', substituto: 'afirmação direta' },
  // Verbosidade e connectives desnecessários
  { palavra: 'de forma a', substituto: '"para" (mais direto)' },
  { palavra: 'no sentido de', substituto: '"para" / "a fim de"' },
  { palavra: 'com relação a', substituto: '"sobre" / "quanto a"' },
  { palavra: 'em relação a', substituto: '"sobre" / "quanto a"' },
  { palavra: 'haja vista que', substituto: '"visto que" / "considerando que"' },
  { palavra: 'haja vista', substituto: '"visto que" / "diante de"' },
  { palavra: 'no bojo de', substituto: '"no âmbito de" / "no contexto de"' },
  { palavra: 'no âmbito do presente', substituto: '"neste contrato" / "neste parecer" (mais direto)' },
  { palavra: 'para todos os efeitos legais', substituto: 'Evitar — já subentendido em texto técnico' },
  { palavra: 'conclui-se, portanto, que', substituto: '"conclui-se que" ("portanto" é redundante)' },
  // Latinismos desnecessários
  { palavra: 'pari passu', substituto: '"simultaneamente" / "em paralelo"' },
  { palavra: 'mutatis mutandis', substituto: '"com as devidas adaptações"' },
  { palavra: 'ipso facto', substituto: '"por isso mesmo" / "consequentemente"' },
  { palavra: 'data venia', substituto: '"com a devida vênia" (se necessário manter o registro) ou suprimir' },
  // Jargão corporativo IA
  { palavra: 'alavancar', substituto: '"aumentar" / "ampliar" / "impulsionar"' },
  { palavra: 'nortear', substituto: '"orientar" / "guiar" / "direcionar"' },
  { palavra: 'balizar', substituto: '"delimitar" / "orientar" / "estabelecer parâmetros"' },
  { palavra: 'permear', substituto: '"atravessar" / "influenciar" / "estar presente em"' },
  { palavra: 'expertise', substituto: '"conhecimento técnico" / "especialização" / "competência"' },
  { palavra: 'demandar', substituto: '"exigir" / "requerer" (demandar = acionar judicialmente em pt-BR formal)' },
  { palavra: 'robusto', substituto: '"sólido" / "consistente" / "abrangente"' },
  { palavra: 'sinalizar', substituto: '"indicar" / "apontar" / "demonstrar"' },
  { palavra: 'pari passu', substituto: '"simultaneamente" / "em paralelo"' },
];

// ─── TOOLS ────────────────────────────────────────────────────────────────────

export function registerRevisaoTools(server: McpServer): void {

  // ── revisao_checklist_parecer ───────────────────────────────────────────────
  server.registerTool(
    'revisao_checklist_parecer',
    {
      description:
        'Retorna o checklist completo de revisão para pareceres Compliance-CE / Guerra Advogados. ' +
        'Usar SEMPRE antes de finalizar ou entregar qualquer parecer técnico. ' +
        'Cobre: template, formatação, estrutura, base legal IBS/CBS, linguagem, entrega e modo_parecer (Geral vs Empresarial). ' +
        'Usar categoria "modo_parecer" para verificar se o modo foi confirmado e seguido corretamente.',
      inputSchema: {
        categoria: z
          .enum(['template', 'formatacao', 'estrutura', 'base_legal_ibs_cbs', 'linguagem', 'entrega', 'modo_parecer', 'revalidacao_tecnica', 'book_demonstracoes', 'todas'])
          .optional()
          .default('todas')
          .describe('Categoria específica ou "todas" para checklist completo. Use "modo_parecer" para verificar Geral vs Empresarial. Use "revalidacao_tecnica" para Fase 7 (RV1-RV11 + Teste da Pergunta Única + Teste de Defesa Fiscal + Nota de Confiabilidade) — obrigatório antes de gerar o DOCX. Use "book_demonstracoes" para validar o Book das Demonstrações Contábeis.'),
      },
    },
    async ({ categoria = 'todas' }) => {
      try {
        let resultado: typeof CHECKLIST;
        if (categoria === 'todas') {
          resultado = CHECKLIST;
        } else {
          resultado = { [categoria]: CHECKLIST[categoria] };
        }

        const total_itens = Object.values(resultado).reduce((acc, c) => acc + c.itens.length, 0);
        const total_criticos = Object.values(resultado).reduce(
          (acc, c) => acc + c.itens.filter((i) => i.critico).length, 0
        );

        const incluirTestes = categoria === 'revalidacao_tecnica' || categoria === 'todas';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  instrucao: 'Verificar TODOS os itens críticos antes de entregar. Itens não-críticos são melhorias recomendadas.',
                  total_itens,
                  total_criticos,
                  categorias: resultado,
                  ...(incluirTestes ? { fase7_testes_obrigatorios: REVALIDACAO_TESTES } : {}),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  // ── revisao_normas_vigentes ─────────────────────────────────────────────────
  server.registerTool(
    'revisao_normas_vigentes',
    {
      description:
        'Retorna o status atualizado das normas CPC, NBC e legislação aplicáveis a pareceres IBS/CBS. ' +
        'Inclui normas vigentes, substituídas e lacunas normativas conhecidas. ' +
        'Usar para verificar se as citações do parecer estão atualizadas.',
      inputSchema: {
        grupo: z
          .enum(['cpc', 'nbc', 'legislacao', 'lacunas', 'todos'])
          .optional()
          .default('todos')
          .describe('"cpc", "nbc", "legislacao", "lacunas" ou "todos".'),
      },
    },
    async ({ grupo = 'todos' }) => {
      try {
        let resultado: Partial<typeof NORMAS_VIGENTES>;
        if (grupo === 'todos') {
          resultado = NORMAS_VIGENTES;
        } else {
          resultado = { [grupo]: NORMAS_VIGENTES[grupo as keyof typeof NORMAS_VIGENTES] };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  referencia: 'Dados atualizados em jun/2026. Revisar trimestralmente.',
                  normas: resultado,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  // ── revisao_linguagem ───────────────────────────────────────────────────────
  server.registerTool(
    'revisao_linguagem',
    {
      description:
        'Analisa um texto e aponta violações das regras de linguagem do workspace. ' +
        'Verifica: travessões proibidos, palavras-IA proibidas, setas fora de lançamentos, ' +
        'gerundismo, "através de" inadequado, "a nível de" incorreto, ' +
        'colocação pronominal, uso indevido de "onde", redundâncias clássicas, ' +
        'palavras repetidas em sequência, espaços duplos e frases longas (> 65 palavras). ' +
        'Retorna cada ocorrência com contexto e substituto recomendado. ' +
        'Usar no texto completo do parecer antes de gerar o DOCX final.',
      inputSchema: {
        texto: z
          .string()
          .describe('Texto do parecer para análise — pode ser o conteúdo completo ou uma seção.'),
      },
    },
    async ({ texto }) => {
      try {
        const violacoes: Array<{
          tipo: string;
          ocorrencia: string;
          contexto: string;
          substituto: string;
          posicao_aprox: number;
        }> = [];

        // 1. Travessões em texto corrido (—)
        const travessaoRegex = /—/g;
        let m: RegExpExecArray | null;
        while ((m = travessaoRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 40);
          const fim = Math.min(texto.length, m.index + 40);
          violacoes.push({
            tipo: 'TRAVESSÃO PROIBIDO',
            ocorrencia: '—',
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: 'Substituir por vírgula, dois-pontos ou reescrever a frase',
            posicao_aprox: m.index,
          });
        }

        // 2. Palavras-IA proibidas (case-insensitive)
        for (const { palavra, substituto } of PALAVRAS_PROIBIDAS) {
          const re = new RegExp(palavra, 'gi');
          while ((m = re.exec(texto)) !== null) {
            const inicio = Math.max(0, m.index - 60);
            const fim = Math.min(texto.length, m.index + 60);
            violacoes.push({
              tipo: 'PALAVRA PROIBIDA',
              ocorrencia: m[0],
              contexto: `...${texto.slice(inicio, fim)}...`,
              substituto,
              posicao_aprox: m.index,
            });
          }
        }

        // 3. Setas em texto corrido (→ fora de lançamentos)
        // Heurística: → seguida de espaço e texto (não tabela/lista)
        const setaRegex = /→(?!\s*[A-Z]{2,}\s*[|:])/g;
        while ((m = setaRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 50);
          const fim = Math.min(texto.length, m.index + 50);
          violacoes.push({
            tipo: 'SETA EM TEXTO CORRIDO',
            ocorrencia: '→',
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: 'Seta (→) só é permitida em lançamentos contábeis e diagramas técnicos',
            posicao_aprox: m.index,
          });
        }

        // 4. Gerundismo — construção verbal proibida em escrita técnica formal
        const gerundismoRegex = /\b(estar[aáão]|estamos|estar[ei]mos|ir[aá]|iremos|v[aã]o\s+estar|podemos?\s+estar)\s+\w+ndo\b/gi;
        while ((m = gerundismoRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 60);
          const fim = Math.min(texto.length, m.index + 60);
          violacoes.push({
            tipo: 'GERUNDISMO',
            ocorrencia: m[0],
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: 'Substituir por forma verbal direta: "analisaremos", "será enviado", "procederemos a"',
            posicao_aprox: m.index,
          });
        }

        // 5. "Através de" — uso inadequado em escrita formal (correto apenas para sentido físico de travessia)
        const atravesRegex = /\batravés\s+de\b/gi;
        while ((m = atravesRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 60);
          const fim = Math.min(texto.length, m.index + 60);
          violacoes.push({
            tipo: 'REGÊNCIA INADEQUADA',
            ocorrencia: m[0],
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: '"por meio de" (instrumento/método) ou "mediante" (formalidade)',
            posicao_aprox: m.index,
          });
        }

        // 6. "A nível de" — incorreto gramaticalmente; correto é "no nível de" ou "no âmbito de"
        const aNivelRegex = /\ba\s+n[ií]vel\s+de\b/gi;
        while ((m = aNivelRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 60);
          const fim = Math.min(texto.length, m.index + 60);
          violacoes.push({
            tipo: 'ERRO GRAMATICAL',
            ocorrencia: m[0],
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: '"no âmbito de" / "no nível de" / "em termos de"',
            posicao_aprox: m.index,
          });
        }

        // 7. Pronome oblíquo no início de frase — erro de colocação pronominal
        const pronomeFrasalRegex = /(?:^|\.\s+|\n\s*)([Mm]e\s|[Ll]he\s|[Ll]hes\s|[Nn]os\s(?!termos|casos|artigos|incisos|parágrafos)|[Tt]e\s)/gm;
        while ((m = pronomeFrasalRegex.exec(texto)) !== null) {
          const pronome = m[1];
          const inicio = Math.max(0, m.index - 20);
          const fim = Math.min(texto.length, m.index + 80);
          violacoes.push({
            tipo: 'COLOCAÇÃO PRONOMINAL',
            ocorrencia: pronome.trim(),
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: 'Pronome oblíquo não inicia frase. Reorganizar: "Cabe-nos", "Foi-lhe informado", ou usar sujeito explícito',
            posicao_aprox: m.index,
          });
        }

        // 8. "Onde" referindo-se a pessoas ou conceitos abstratos (não-lugar)
        const ondeAbstratoRegex = /\b(contribuinte|empresa|sociedade|cliente|autor|réu|parte|contratante|contratada|pessoa|profissional|advogado|contador)\b[^.]{0,60}\bonde\b/gi;
        while ((m = ondeAbstratoRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 20);
          const fim = Math.min(texto.length, m.index + 100);
          violacoes.push({
            tipo: 'USO INDEVIDO DE "ONDE"',
            ocorrencia: 'onde',
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: '"onde" é relativo de lugar. Usar "em que", "no qual", "na qual", "nos quais"',
            posicao_aprox: m.index,
          });
        }

        // 9. Redundâncias clássicas
        const REDUNDANCIAS: Array<{ expr: string; substituto: string }> = [
          { expr: 'h[aá] anos? atr[aá]s', substituto: '"há anos" ou "anos atrás" (não ambos)' },
          { expr: 'subir para cima', substituto: '"subir" (cima é implícito)' },
          { expr: 'descer para baixo', substituto: '"descer" (baixo é implícito)' },
          { expr: 'elo de ligação', substituto: '"elo" ou "vínculo" (ligação é redundante)' },
          { expr: 'juntamente com', substituto: '"com" ou "junto a"' },
          { expr: 'breve resumo', substituto: '"resumo" (todo resumo é breve)' },
          { expr: 'a(?:o)? meu ver', substituto: '"a meu ver" está correto; se "ao meu ver", corrigir para "a meu ver"' },
          { expr: 'ao meu ver', substituto: 'Incorreto. Usar "a meu ver" ou "em minha opinião"' },
          { expr: 'enquanto que', substituto: '"enquanto" (o "que" é redundante)' },
          { expr: 'mas porém', substituto: '"mas" ou "porém" (não ambos)' },
          { expr: 'certeza absoluta', substituto: '"certeza" (toda certeza é absoluta)' },
          { expr: 'previsto antecipadamente', substituto: '"previsto" (previsão já implica antecipação)' },
        ];
        for (const { expr, substituto: subst } of REDUNDANCIAS) {
          const re = new RegExp(expr, 'gi');
          while ((m = re.exec(texto)) !== null) {
            const inicio = Math.max(0, m.index - 50);
            const fim = Math.min(texto.length, m.index + 50);
            violacoes.push({
              tipo: 'REDUNDÂNCIA',
              ocorrencia: m[0],
              contexto: `...${texto.slice(inicio, fim)}...`,
              substituto: subst,
              posicao_aprox: m.index,
            });
          }
        }

        // 10. Palavras repetidas em sequência (ex: "que que", "de de", "a a")
        const repeticaoRegex = /\b(\w{2,})\s+\1\b/gi;
        while ((m = repeticaoRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 40);
          const fim = Math.min(texto.length, m.index + 40);
          violacoes.push({
            tipo: 'PALAVRA REPETIDA',
            ocorrencia: m[0],
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: `Remover a repetição: "${m[1]}"`,
            posicao_aprox: m.index,
          });
        }

        // 11a. Pontuação dupla/tripla incorreta (.. ,, ?? !!)
        const pontDuplaRegex = /([.,!?])\1+/g;
        while ((m = pontDuplaRegex.exec(texto)) !== null) {
          // Exceção: "..." (reticências) é permitido
          if (m[0] === '...') { continue; }
          const inicio = Math.max(0, m.index - 40);
          const fim = Math.min(texto.length, m.index + 40);
          violacoes.push({
            tipo: 'PONTUAÇÃO INCORRETA',
            ocorrencia: m[0],
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: `Usar apenas um sinal de pontuação: "${m[1]}"`,
            posicao_aprox: m.index,
          });
        }

        // 11. Espaço duplo
        const espacoDuploRegex = /  +/g;
        while ((m = espacoDuploRegex.exec(texto)) !== null) {
          const inicio = Math.max(0, m.index - 30);
          const fim = Math.min(texto.length, m.index + 30);
          violacoes.push({
            tipo: 'ESPAÇO DUPLO',
            ocorrencia: `"${m[0]}" (${m[0].length} espaços)`,
            contexto: `...${texto.slice(inicio, fim)}...`,
            substituto: 'Substituir por um único espaço',
            posicao_aprox: m.index,
          });
        }

        // 12. Frases longas demais (> 65 palavras)
        const frasesLongas = texto.split(/(?<=[.!?])\s+/);
        let posAtual = 0;
        for (const frase of frasesLongas) {
          const palavras = frase.trim().split(/\s+/).length;
          if (palavras > 65) {
            violacoes.push({
              tipo: 'FRASE LONGA',
              ocorrencia: `${palavras} palavras`,
              contexto: `...${frase.slice(0, 120)}...`,
              substituto: 'Frase com mais de 65 palavras compromete a leitura técnica. Dividir em duas ou três frases menores.',
              posicao_aprox: posAtual,
            });
          }
          posAtual += frase.length + 1;
        }

        const criticos = violacoes.filter(
          (v) => v.tipo === 'TRAVESSÃO PROIBIDO' || v.tipo === 'PALAVRA PROIBIDA' || v.tipo === 'ERRO GRAMATICAL' || v.tipo === 'GERUNDISMO',
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  total_violacoes: violacoes.length,
                  violacoes_criticas: criticos.length,
                  status: violacoes.length === 0 ? '✓ APROVADO — nenhuma violação encontrada' : `✗ REPROVADO — ${violacoes.length} violação(ões) encontrada(s)`,
                  violacoes,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}
