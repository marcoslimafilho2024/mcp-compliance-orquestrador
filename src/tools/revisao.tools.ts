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
    descricao: 'Estrutura obrigatória — 10 seções',
    itens: [
      { id: 'E1', item: 'Cabeçalho: tabela com CONSULENTE, DATA, ASSUNTO, LEGISLAÇÃO, PARECERISTAS, EMITIDO POR', como_verificar: 'Confirmar presença das 6 linhas no tbl_cab', critico: true },
      { id: 'E2', item: 'I. QUESTIONAMENTO — contexto e perguntas enumeradas', como_verificar: 'Seção presente e com as perguntas do solicitante', critico: true },
      { id: 'E3', item: 'II. BASE LEGAL ATUALIZADA — artigos com número completo', como_verificar: 'Formato: "LC 214/2025, art. Xº — descrição"', critico: true },
      { id: 'E4', item: 'III. INTERPRETAÇÃO NORMATIVA — análise com subseções numeradas', como_verificar: 'Subseções 3.1, 3.2... presentes', critico: true },
      { id: 'E5', item: 'IV. IMPLICAÇÕES PRÁTICAS — lançamentos e exemplos numéricos', como_verificar: 'Pelo menos uma tabela e um bloco de lançamentos', critico: true },
      { id: 'E6', item: 'V. ORIENTAÇÕES OPERACIONAIS — o que o cliente deve fazer', como_verificar: 'Itens numerados a), b), c)...', critico: true },
      { id: 'E7', item: 'VI. VEDAÇÕES E EXCEÇÕES — riscos e restrições legais', como_verificar: 'Pelo menos 3 vedações específicas ao assunto', critico: true },
      { id: 'E8', item: 'VII. CITAÇÕES COMPLEMENTARES — jurisprudência, doutrina, normas', como_verificar: 'Inclui RE 574.706 e Informe Técnico quando relevante', critico: false },
      { id: 'E9', item: 'IX. CONCLUSÃO — resposta direta às perguntas, numerada', como_verificar: 'Cada conclusão responde a uma pergunta do Questionamento', critico: true },
      { id: 'E10', item: 'ASSINATURA — tabela com os 3 pareceristas', como_verificar: 'Fellipe Guerra CRC 21.074 | Marcos Lima CRC 23.224 | Mathaus Pordeus OAB 52.206', critico: true },
    ],
  },
  base_legal_ibs_cbs: {
    descricao: 'Base legal mínima para pareceres IBS/CBS (reforma tributária)',
    itens: [
      { id: 'BL1', item: 'LC 214/2025 citada com artigos específicos (nunca apenas "LC 214/2025")', como_verificar: 'Cada referência tem art. Xº identificado', critico: true },
      { id: 'BL2', item: 'EC 132/2023, art. 149-B, CF — tributação "por fora" e não cumulatividade', como_verificar: 'Presente na Base Legal', critico: true },
      { id: 'BL3', item: 'CPC 00 (R2) — Capítulo 5 (Reconhecimento e Desreconhecimento)', como_verificar: 'Citado como "CPC 00 (R2), Capítulo 5" — NÃO "itens 4.26-4.36" (numeração R1 obsoleta)', critico: true },
      { id: 'BL4', item: 'CPC 51 — Apresentação e Divulgação (jan/2026)', como_verificar: 'Presente em Base Legal e Citações', critico: true },
      { id: 'BL5', item: 'NBC TG 51 — Apresentação e Divulgação (fev/2026, CFC)', como_verificar: 'Presente em Base Legal e Citações', critico: true },
      { id: 'BL6', item: 'NBC TG 32 (R4) citada como referência POR ANALOGIA — não como norma direta', como_verificar: 'Texto deve conter "(por analogia)" ou "referência por analogia"', critico: true },
      { id: 'BL7', item: 'Ato Conjunto RFB/CGIBS nº 1/2025 — penalidades e fase teste', como_verificar: 'Presente quando o parecer trata de 2026', critico: false },
      { id: 'BL8', item: 'Informe Técnico 2026.002 v.1.00 — alíquotas CBS 0,9% + IBS 0,1%', como_verificar: 'Presente quando há menção de alíquotas de 2026', critico: false },
      { id: 'BL9', item: 'LACUNA NORMATIVA declarada — nenhum CPC/NBC específico sobre IBS/CBS', como_verificar: 'Texto menciona ausência de pronunciamento específico do CPC/CFC', critico: true },
    ],
  },
  linguagem: {
    descricao: 'Regras de escrita — proibições e estilo',
    itens: [
      { id: 'L1', item: 'ZERO travessões (—) em texto corrido', como_verificar: 'Buscar "—" no texto; substituir por vírgula ou dois-pontos', critico: true },
      { id: 'L2', item: 'Nenhuma das 27 palavras-IA proibidas', como_verificar: 'Usar revisao_linguagem(texto) para verificação automática', critico: true },
      { id: 'L3', item: 'Frases com máx. 2 orações subordinadas', como_verificar: 'Parágrafos com muitas vírgulas ou "que... que... que..."', critico: false },
      { id: 'L4', item: 'Parágrafos com máx. 6 linhas', como_verificar: 'Dividir parágrafos longos em dois', critico: false },
      { id: 'L5', item: 'Voz ativa predominante', como_verificar: 'Evitar "é reconhecido", "deve ser feito" — preferir "reconhece-se", "fazer"', critico: false },
      { id: 'L6', item: 'Seta (→) apenas em lançamentos contábeis — nunca em texto corrido', como_verificar: 'Verificar se há "→" fora de blocos add_lancamentos', critico: false },
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
    { codigo: 'LC 214/2025', titulo: 'Institui o IBS, CBS e IS — Lei da Reforma Tributária do Consumo', vigencia: '16/01/2025', status: 'VIGENTE — fase teste 2026', observacao: 'Transição 2026-2032. Artigos mais citados: 6º, 7º, 11, 12, 16-17, 28-56, 47-49, 99-108.' },
    { codigo: 'EC 132/2023', titulo: 'Reforma Tributária — Emenda Constitucional', vigencia: '20/12/2023', status: 'VIGENTE', observacao: 'Art. 149-B CF: tributação por fora e não cumulatividade plena. Base constitucional do IBS/CBS.' },
    { codigo: 'LC 123/2006', titulo: 'Estatuto Nacional da Microempresa — Simples Nacional', vigencia: '14/12/2006', status: 'VIGENTE (parcialmente alterada por LC 214/2025)', observacao: 'Art. 18, §§ 14-15: regime de caixa para DAS. Não aplica regime de caixa ao IBS/CBS.' },
    { codigo: 'Ato Conjunto RFB/CGIBS nº 1/2025', titulo: 'Alíquotas fase teste e suspensão de penalidades', vigencia: '2025', status: 'VIGENTE em 2026', observacao: 'Penalidades suspensas até 31/05/2026. A partir de jun/2026: obrigatoriedade integral.' },
    { codigo: 'Informe Técnico 2026.002 v.1.00', titulo: 'Alíquotas CBS/IBS para 2026', vigencia: '2026', status: 'VIGENTE', observacao: 'CBS: 0,9% | IBS: 0,1% — válidas para todo o ano de 2026 (fase teste).' },
  ],
  lacunas: [
    { tema: 'Contabilização IBS/CBS', status: 'SEM PRONUNCIAMENTO', observacao: 'CPC e CFC não emitiram norma específica sobre como contabilizar IBS/CBS. Pareceres devem declarar essa lacuna explicitamente.' },
    { tema: 'IVA Passivo de Creditamento — Simples Nacional', status: 'AGUARDANDO CGIBS', observacao: 'Percentual exato do crédito restrito do tomador ainda não regulamentado pelo Comitê Gestor do IBS.' },
    { tema: 'Split Payment — reflexo contábil', status: 'AGUARDANDO REGULAMENTAÇÃO', observacao: 'Regulamento do split payment bancário ainda não publicado. Pareceres devem listar nos "Pontos em Aberto".' },
    { tema: 'IBS/CBS no Simples Nacional a partir de 2029', status: 'AGUARDANDO CGIBS/RFB', observacao: 'Condições para integração ao DAS ainda não definidas. Não antecipar sem amparo normativo.' },
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
];

// ─── TOOLS ────────────────────────────────────────────────────────────────────

export function registerRevisaoTools(server: McpServer): void {

  // ── revisao_checklist_parecer ───────────────────────────────────────────────
  server.registerTool(
    'revisao_checklist_parecer',
    {
      description:
        'Retorna o checklist completo de revisão para pareceres Guerra Advogados. ' +
        'Usar SEMPRE antes de finalizar ou entregar qualquer parecer técnico. ' +
        'Cobre: template, formatação, estrutura, base legal IBS/CBS, linguagem e entrega.',
      inputSchema: {
        categoria: z
          .enum(['template', 'formatacao', 'estrutura', 'base_legal_ibs_cbs', 'linguagem', 'entrega', 'todas'])
          .optional()
          .default('todas')
          .describe('Categoria específica ou "todas" para checklist completo.'),
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

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  instrucao: 'Verificar TODOS os itens críticos antes de entregar. Itens não-críticos são melhorias.',
                  total_itens,
                  total_criticos,
                  categorias: resultado,
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
        'Analisa um texto e aponta violações das regras de linguagem do workspace: ' +
        'travessões proibidos, palavras-IA proibidas, setas fora de lançamentos. ' +
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

        const criticos = violacoes.filter(
          (v) => v.tipo === 'TRAVESSÃO PROIBIDO' || v.tipo === 'PALAVRA PROIBIDA',
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
