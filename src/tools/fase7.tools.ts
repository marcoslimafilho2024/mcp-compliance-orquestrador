/**
 * tools/fase7.tools.ts
 * FASE 7 — Revalidação Técnica Final (Orquestrador)
 *
 * Sub-fases:
 *   7.1 revisao_normativa  — auditor normativo: normas vigentes, artigos corretos, hierarquia
 *   7.2 mcp_chato          — auditor adversarial: o que está faltando, o que não foi respondido
 *   7.3 mcp_defender       — auditor fiscal: o que o fisco atacaria
 *   7.4+7.5 fase7_liberar  — consolida scores e emite veredito LIBERADO / BLOQUEADO
 *
 * Modelo de scoring:
 *   - Itens com peso 1, 2 ou 3
 *   - Score = (soma pesos aprovados / soma pesos aplicáveis) × 100
 *   - Qualquer item peso-3 reprovado → REPROVADO imediato (independente do score)
 *   - Nota final = normativa×40% + chato×35% + defender×25%
 *   - LIBERADO: todos aprovados e nota_final ≥ 80
 *
 * Critérios dinâmicos: itens N_A são excluídos do denominador.
 * Apenas itens aplicáveis ao conteúdo do parecer são avaliados.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ─── PESOS POR CRITÉRIO ───────────────────────────────────────────────────────

const PESOS: Record<string, number> = {
  RN1: 3, RN2: 3, RN3: 3, RN4: 2, RN5: 2, RN6: 2, RN7: 2, RN8: 2, RN9: 1,
  MC1: 3, MC2: 3, MC3: 3, MC4: 3, MC5: 2, MC6: 2, MC7: 1, MC8: 3,
  MD1: 3, MD2: 3, MD3: 3, MD4: 3, MD5: 2, MD6: 2, MD7: 1,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function menciona(texto: string, ...termos: string[]): boolean {
  const t = texto.toLowerCase();
  return termos.some(term => t.includes(term.toLowerCase()));
}

function trecho(texto: string, keyword: string, chars = 250): string {
  const idx = texto.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return texto.slice(0, Math.min(chars, texto.length)) + '...';
  const s = Math.max(0, idx - 80);
  const e = Math.min(texto.length, idx + chars);
  return `...${texto.slice(s, e)}...`;
}

interface ItemResult {
  id: string;
  item: string;
  peso: number;
  status: 'APROVADO' | 'REPROVADO' | 'AVALIAR' | 'N_A';
  justificativa?: string;
  trecho_relevante?: string;
}

function calcScore(itens: Array<{ id: string; aprovado: boolean }>): {
  score: number;
  peso_total: number;
  peso_aprovado: number;
  reprovados_criticos: string[];
} {
  let total = 0, aprovado = 0;
  const rep3: string[] = [];
  for (const item of itens) {
    const p = PESOS[item.id] ?? 1;
    total += p;
    if (item.aprovado) aprovado += p;
    else if (p >= 3) rep3.push(item.id);
  }
  return {
    score: total > 0 ? Math.round((aprovado / total) * 100) : 100,
    peso_total: total,
    peso_aprovado: aprovado,
    reprovados_criticos: rep3,
  };
}

function statusFromScore(
  score: number,
  rep3: string[],
): 'APROVADO' | 'APROVADO_COM_RESSALVAS' | 'REPROVADO' {
  if (rep3.length > 0 || score < 80) return 'REPROVADO';
  if (score < 90) return 'APROVADO_COM_RESSALVAS';
  return 'APROVADO';
}

// ─── TOOLS ───────────────────────────────────────────────────────────────────

export function registerFase7Tools(server: McpServer): void {

  // ── 7.1 revisao_normativa ──────────────────────────────────────────────────
  server.registerTool(
    'revisao_normativa',
    {
      description:
        'FASE 7.1 — Auditor Normativo. ' +
        'Valida se as normas citadas no parecer existem, estão vigentes e sustentam as conclusões. ' +
        'Critérios dinâmicos: ativa apenas os itens aplicáveis ao conteúdo do parecer. ' +
        'Retorna itens com status APROVADO (auto), REPROVADO (auto), AVALIAR (julgamento Claude) ou N_A. ' +
        'Após avaliar os itens AVALIAR, chamar fase7_liberar() com os resultados completos dos 3 auditores.',
      inputSchema: {
        normas_citadas: z.array(z.object({
          codigo: z.string().describe("Ex: 'LC 214/2025', 'CPC 51', 'EC 132/2023'"),
          artigos: z.array(z.string()).describe("Ex: ['art. 6º', 'art. 28', '§ 3º']"),
        })).describe('Todas as normas citadas no parecer com os artigos correspondentes'),
        fundamentacao: z.string().describe('Texto completo da seção II — FUNDAMENTAÇÃO'),
        conclusao: z.string().describe('Texto completo da seção IV — CONCLUSÃO'),
        data_parecer: z.string().describe('Data do parecer no formato YYYY-MM-DD'),
      },
    },
    async ({ normas_citadas, fundamentacao, conclusao, data_parecer }) => {
      try {
        const texto  = fundamentacao + ' ' + conclusao;
        const codigos = normas_citadas.map(n => n.codigo);

        const temIbsCbs  = menciona(texto, 'IBS', 'CBS', 'Imposto sobre Bens e Serviços', 'Contribuição sobre Bens e Serviços');
        const temLc214   = codigos.some(c => c.includes('214'));
        const temCpc00   = codigos.some(c => /CPC\s*00/i.test(c));
        const temAtoConj = codigos.some(c => /ato\s+conjunto/i.test(c));
        const temNfe     = menciona(texto, 'NF-e', 'nota fiscal eletrônica', 'grupo RTC', 'RTC', 'NFe');

        const itens: ItemResult[] = [];

        // RN1 — sempre — AVALIAR (confronto data × vigência de cada norma)
        itens.push({
          id: 'RN1', peso: 3,
          item: 'Todas as normas citadas estão vigentes na data do parecer',
          status: 'AVALIAR',
          justificativa: `Data do parecer: ${data_parecer}. Verificar cada norma contra seu status nesta data.`,
          trecho_relevante: `Normas: ${codigos.join(' | ')}`,
        });

        // RN2 — sempre — AVALIAR (requer conhecimento da estrutura de cada norma)
        itens.push({
          id: 'RN2', peso: 3,
          item: 'Cada artigo citado pertence à norma indicada',
          status: 'AVALIAR',
          justificativa: 'Verificar se os artigos listados existem nas respectivas normas.',
          trecho_relevante: normas_citadas
            .map(n => `${n.codigo}: ${n.artigos.join(', ') || '(sem artigos)'}`)
            .join(' | '),
        });

        // RN3 — sempre — AVALIAR (julgamento jurídico de hierarquia)
        itens.push({
          id: 'RN3', peso: 3,
          item: 'Hierarquia de fontes respeitada: CF > LC > LO > Decreto > Ato normativo',
          status: 'AVALIAR',
          justificativa: 'Verificar se nenhuma norma inferior contradiz norma superior sem justificativa de hierarquia.',
          trecho_relevante: trecho(fundamentacao, 'hierarquia') || trecho(fundamentacao, 'norma', 200),
        });

        // RN4 — LC 214 com artigos (auto)
        if (temLc214) {
          const lc214 = normas_citadas.find(n => n.codigo.includes('214'));
          const aprovado = !!(lc214 && lc214.artigos.length > 0);
          itens.push({
            id: 'RN4', peso: 2,
            item: 'LC 214/2025 citada com artigos específicos, nunca apenas o código genérico',
            status: aprovado ? 'APROVADO' : 'REPROVADO',
            justificativa: aprovado
              ? `Artigos encontrados: ${lc214!.artigos.join(', ')}`
              : 'LC 214/2025 sem artigos específicos. Indicar ao menos um artigo na norma.',
          });
        } else {
          itens.push({ id: 'RN4', peso: 2, item: 'LC 214/2025 citada com artigos específicos', status: 'N_A' });
        }

        // RN5 e RN6 — IBS/CBS (auto via keywords)
        if (temIbsCbs) {
          const temLacuna = menciona(texto,
            'lacuna normativa', 'ausência de pronunciamento',
            'sem pronunciamento específico', 'não há norma específica',
          );
          itens.push({
            id: 'RN5', peso: 2,
            item: 'Lacuna normativa IBS/CBS declarada explicitamente',
            status: temLacuna ? 'APROVADO' : 'REPROVADO',
            justificativa: temLacuna
              ? 'Declaração de lacuna normativa identificada.'
              : 'Tema IBS/CBS sem declaração de lacuna. Incluir na Fundamentação.',
            trecho_relevante: temLacuna ? trecho(texto, 'lacuna') : undefined,
          });

          const temCpc51   = menciona(texto, 'CPC 51') || codigos.some(c => c.includes('CPC 51'));
          const temNbcTg51 = menciona(texto, 'NBC TG 51') || codigos.some(c => c.includes('NBC TG 51'));
          itens.push({
            id: 'RN6', peso: 2,
            item: 'CPC 51 e NBC TG 51 citados em pareceres com tema IBS/CBS',
            status: (temCpc51 && temNbcTg51) ? 'APROVADO' : 'REPROVADO',
            justificativa: (temCpc51 && temNbcTg51)
              ? 'CPC 51 e NBC TG 51 encontrados.'
              : `Ausentes: ${!temCpc51 ? 'CPC 51 ' : ''}${!temNbcTg51 ? 'NBC TG 51' : ''}. Incluir nas Citações Complementares.`,
          });
        } else {
          itens.push({ id: 'RN5', peso: 2, item: 'Lacuna normativa IBS/CBS declarada', status: 'N_A' });
          itens.push({ id: 'RN6', peso: 2, item: 'CPC 51 e NBC TG 51 citados', status: 'N_A' });
        }

        // RN7 — CPC 00 sem numeração antiga (auto)
        if (temCpc00) {
          const numAntiga = /4\.[2-3][0-9]/i.test(texto);
          itens.push({
            id: 'RN7', peso: 2,
            item: 'CPC 00 (R2) Capítulo 5 citado corretamente — nunca "itens 4.26-4.36"',
            status: numAntiga ? 'REPROVADO' : 'APROVADO',
            justificativa: numAntiga
              ? 'Numeração obsoleta R1 encontrada (4.2x ou 4.3x). Corrigir para "Capítulo 5 do CPC 00 (R2)".'
              : 'Numeração antiga não encontrada.',
            trecho_relevante: numAntiga ? trecho(texto, '4.2') : undefined,
          });
        } else {
          itens.push({ id: 'RN7', peso: 2, item: 'CPC 00 (R2) Capítulo 5 citado corretamente', status: 'N_A' });
        }

        // RN8 — Ato Conjunto sem suspensão (auto)
        if (temAtoConj) {
          const citaSusp = menciona(texto,
            'suspensão de penalidades', 'prazo de suspensão',
            'penalidades suspensas', 'suspensão vigente',
          );
          itens.push({
            id: 'RN8', peso: 2,
            item: 'Status penalidades Ato Conjunto RFB/CGIBS correto (obrigatório integral desde 01/06/2026)',
            status: citaSusp ? 'REPROVADO' : 'APROVADO',
            justificativa: citaSusp
              ? 'Texto menciona suspensão de penalidades — prazo expirou em 31/05/2026. Corrigir: obrigatoriedade integral desde 01/06/2026.'
              : 'Sem referência a suspensão de penalidades.',
            trecho_relevante: citaSusp ? trecho(texto, 'suspensão') : undefined,
          });
        } else {
          itens.push({ id: 'RN8', peso: 2, item: 'Status penalidades Ato Conjunto', status: 'N_A' });
        }

        // RN9 — NT versão atual (auto)
        if (temNfe) {
          const versaoAntiga = menciona(texto, 'v1.00', 'v1.0 ', '1.00', 'v1.33', 'v1.32', 'v1.31');
          const v134 = menciona(texto, 'v1.34', '1.34');
          itens.push({
            id: 'RN9', peso: 1,
            item: 'NT 2025.002 v1.34 citada quando o tema envolve NF-e e grupo RTC',
            status: versaoAntiga ? 'REPROVADO' : v134 ? 'APROVADO' : 'AVALIAR',
            justificativa: versaoAntiga
              ? 'Versão desatualizada da NT encontrada. Usar v1.34.'
              : v134
              ? 'v1.34 confirmada.'
              : 'NT presente mas versão não identificada. Confirmar se é v1.34.',
            trecho_relevante: trecho(texto, 'NT 2025') || trecho(texto, 'NF-e'),
          });
        } else {
          itens.push({ id: 'RN9', peso: 1, item: 'NT 2025.002 v1.34 citada', status: 'N_A' });
        }

        const aplicaveis  = itens.filter(i => i.status !== 'N_A');
        const paraAvaliar = aplicaveis.filter(i => i.status === 'AVALIAR');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              auditor: 'revisao_normativa',
              instrucao: paraAvaliar.length > 0
                ? `Avaliar os ${paraAvaliar.length} itens AVALIAR. Depois chamar fase7_liberar() com {normativa, chato, defender} — arrays de {id, aprovado}.`
                : 'Todos os itens foram auto-avaliados. Chamar fase7_liberar() com os resultados.',
              resumo: {
                aplicaveis: aplicaveis.length,
                auto_avaliados: aplicaveis.length - paraAvaliar.length,
                para_avaliar: paraAvaliar.length,
                n_a: itens.length - aplicaveis.length,
              },
              itens,
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  // ── 7.2 mcp_chato ─────────────────────────────────────────────────────────
  server.registerTool(
    'mcp_chato',
    {
      description:
        'FASE 7.2 — Auditor Adversarial (MCP Chato). ' +
        'Perspectiva: o que está faltando? O que não foi respondido? O que é fraco? ' +
        'Verifica completude, coerência de objeto e operacionalidade das conclusões. ' +
        'Retorna itens APROVADO, REPROVADO, AVALIAR ou N_A. ' +
        'Após avaliar os AVALIAR, incluir em fase7_liberar().',
      inputSchema: {
        perguntas_consulente: z.array(z.string())
          .describe('Lista explícita de perguntas extraídas do I. RELATÓRIO — uma string por pergunta'),
        fundamentacao: z.string().describe('Texto completo da seção II — FUNDAMENTAÇÃO'),
        conclusao: z.string().describe('Texto completo da seção IV — CONCLUSÃO'),
      },
    },
    async ({ perguntas_consulente, fundamentacao, conclusao }) => {
      try {
        const texto = fundamentacao + ' ' + conclusao;
        const temCalculos = menciona(texto, 'R$', 'alíquota', 'cálculo', 'III.', 'EXEMPLOS PRÁTICOS', '%');

        const itens: ItemResult[] = [];

        // MC1 — cada pergunta com resposta na Conclusão — AVALIAR com mapeamento
        const mapeamento = perguntas_consulente.map((perg, i) => {
          const palavras = perg.toLowerCase().split(/\s+/).filter(p => p.length > 4);
          const melhorIdx = palavras.reduce((best, word) => {
            const idx = conclusao.toLowerCase().indexOf(word);
            return idx !== -1 && (best === -1 || idx < best) ? idx : best;
          }, -1);
          return {
            pergunta: `${i + 1}. ${perg}`,
            trecho_na_conclusao: melhorIdx !== -1
              ? trecho(conclusao, palavras[0] ?? perg.slice(0, 20), 200)
              : '(sem correspondência encontrada na Conclusão — verificar manualmente)',
          };
        });
        itens.push({
          id: 'MC1', peso: 3,
          item: 'Cada pergunta da consulente tem resposta direta e numerada na Conclusão',
          status: 'AVALIAR',
          justificativa: `${perguntas_consulente.length} pergunta(s) para verificar. Confirmar resposta direta e numerada para cada uma.`,
          trecho_relevante: mapeamento
            .map(m => `${m.pergunta}\n→ ${m.trecho_na_conclusao}`)
            .join('\n\n'),
        });

        // MC2 — nenhuma parcialmente respondida — AVALIAR
        itens.push({
          id: 'MC2', peso: 3,
          item: 'Nenhuma pergunta foi parcialmente respondida',
          status: 'AVALIAR',
          justificativa: 'Verificar se cada resposta na Conclusão é completa e objetiva, não apenas reconhece a pergunta.',
          trecho_relevante: conclusao.slice(0, Math.min(500, conclusao.length)) + '...',
        });

        // MC3 — sem argumento novo na Conclusão — AVALIAR
        itens.push({
          id: 'MC3', peso: 3,
          item: 'Nenhum argumento jurídico novo introduzido na Conclusão',
          status: 'AVALIAR',
          justificativa: 'Verificar se a Conclusão cita dispositivos ou normas que NÃO aparecem na Fundamentação.',
          trecho_relevante: trecho(conclusao, 'art.') || conclusao.slice(0, 400) + '...',
        });

        // MC4 — coerência de objeto — AVALIAR
        itens.push({
          id: 'MC4', peso: 3,
          item: 'Coerência de objeto: Relatório = Fundamentação = Conclusão',
          status: 'AVALIAR',
          justificativa: 'O objeto do Relatório deve ser exatamente o que a Fundamentação analisa e a Conclusão responde. Sem desvio.',
          trecho_relevante: trecho(fundamentacao, 'II.', 300),
        });

        // MC5 — nenhuma conclusão sem fundamentação — AVALIAR
        itens.push({
          id: 'MC5', peso: 2,
          item: 'Nenhuma conclusão numerada sem fundamentação correspondente na seção II',
          status: 'AVALIAR',
          justificativa: 'Para cada item numerado na Conclusão, deve existir subseção na Fundamentação que o embasa.',
          trecho_relevante: trecho(fundamentacao, 'II.1') || trecho(fundamentacao, 'II.', 300),
        });

        // MC6 — orientações operacionais (auto via keywords)
        const temOrientacoes = menciona(texto,
          'II.5', 'Orientações Operacionais', 'recomenda-se', 'deve-se', 'deverá', 'proceder',
        );
        itens.push({
          id: 'MC6', peso: 2,
          item: 'Orientações operacionais presentes e executáveis pelo cliente',
          status: temOrientacoes ? 'AVALIAR' : 'REPROVADO',
          justificativa: temOrientacoes
            ? 'Orientações identificadas. Verificar se são executáveis concretamente, não apenas recomendações vagas.'
            : 'Seção de orientações operacionais não encontrada (II.5 ou equivalente). Incluir antes de entregar.',
          trecho_relevante: temOrientacoes
            ? trecho(texto, 'II.5') || trecho(texto, 'recomenda-se')
            : undefined,
        });

        // MC7 — exemplos com cálculos (condicional + auto)
        if (temCalculos) {
          itens.push({
            id: 'MC7', peso: 1,
            item: 'Exemplos práticos com cálculos presentes quando o tema envolve valores ou alíquotas',
            status: 'APROVADO',
            justificativa: 'Indicadores de cálculos e valores encontrados no texto.',
          });
        } else {
          itens.push({ id: 'MC7', peso: 1, item: 'Exemplos práticos com cálculos', status: 'N_A' });
        }

        // MC8 — Conclusão não recomenda Consulta Formal como validação do próprio parecer (auto)
        const consultaFormalNaConc = menciona(conclusao,
          'Consulta Formal', 'consulta formal',
          'avalie a necessidade', 'avaliar a necessidade',
          'necessidade de consulta', 'proteção expressa contra eventual autuação',
        );
        itens.push({
          id: 'MC8', peso: 3,
          item: 'Conclusão afirma a posição jurídica com autoridade — não recomenda Consulta Formal à RFB como condição ou validação do próprio parecer',
          status: consultaFormalNaConc ? 'REPROVADO' : 'APROVADO',
          justificativa: consultaFormalNaConc
            ? 'A Conclusão contém recomendação de Consulta Formal à RFB ou equivalente. Isso mina a autoridade do parecer. Mover para II.5 como medida opcional de proteção processual e substituir na Conclusão por instrução de uso deste parecer como instrumento de defesa.'
            : 'Conclusão não condiciona a posição a validação externa.',
          trecho_relevante: consultaFormalNaConc ? trecho(conclusao, 'consulta') : undefined,
        });

        const aplicaveis  = itens.filter(i => i.status !== 'N_A');
        const paraAvaliar = aplicaveis.filter(i => i.status === 'AVALIAR');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              auditor: 'mcp_chato',
              instrucao: `Avaliar os ${paraAvaliar.length} itens AVALIAR com perspectiva adversarial: o que está faltando? O que é fraco? Depois incluir em fase7_liberar().`,
              resumo: {
                perguntas_recebidas: perguntas_consulente.length,
                aplicaveis: aplicaveis.length,
                para_avaliar: paraAvaliar.length,
                n_a: itens.length - aplicaveis.length,
              },
              itens,
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  // ── 7.3 mcp_defender ──────────────────────────────────────────────────────
  server.registerTool(
    'mcp_defender',
    {
      description:
        'FASE 7.3 — Auditor Fiscal (MCP Defender). ' +
        'Perspectiva: se o fisco atacar este parecer amanhã, o que cede? ' +
        'Testa defensibilidade: RFB, CARF, magistrado. ' +
        'Retorna itens APROVADO, REPROVADO, AVALIAR ou N_A. ' +
        'Após avaliar os AVALIAR, incluir em fase7_liberar().',
      inputSchema: {
        tema_tributario: z.string()
          .describe("Ex: 'ICMS exclusão PIS/COFINS', 'Split Payment', 'Simples Nacional IBS/CBS'"),
        fundamentacao: z.string().describe('Texto completo da seção II — FUNDAMENTAÇÃO'),
        conclusao: z.string().describe('Texto completo da seção IV — CONCLUSÃO'),
        normas_citadas: z.array(z.string())
          .describe("Códigos das normas: ['LC 214/2025', 'EC 132/2023']"),
      },
    },
    async ({ tema_tributario, fundamentacao, conclusao, normas_citadas }) => {
      try {
        const texto = fundamentacao + ' ' + conclusao;
        const temCarf     = menciona(texto, 'CARF', 'contencioso', 'acórdão', 'recurso administrativo');
        const temRisco    = menciona(texto, 'risco', 'contestação', 'vedação', 'II.6', 'VEDAÇÕES', 'limitação');
        const temExemplos = menciona(texto, 'III.', 'EXEMPLOS PRÁTICOS', 'tabela', 'R$', 'alíquota');

        const itens: ItemResult[] = [];

        // MD1 — tese sem interpretação forçada — AVALIAR
        itens.push({
          id: 'MD1', peso: 3,
          item: 'Tese jurídica sustentada pela norma citada sem interpretação forçada',
          status: 'AVALIAR',
          justificativa: `Tema: "${tema_tributario}". Verificar se a conclusão adotada é suportada pela leitura literal da norma ou depende de interpretação extensiva favorável ao contribuinte.`,
          trecho_relevante: trecho(fundamentacao, tema_tributario.split(' ')[0] ?? 'art.', 400),
        });

        // MD2 — sem norma revogada como vigente — AVALIAR
        itens.push({
          id: 'MD2', peso: 3,
          item: 'Nenhuma norma revogada citada como vigente sem indicar a norma revogadora',
          status: 'AVALIAR',
          justificativa: `Normas: ${normas_citadas.join(', ')}. Verificar se alguma foi revogada ou substancialmente alterada.`,
          trecho_relevante: normas_citadas.join(' | '),
        });

        // MD3 — precedente CARF (sempre AVALIAR — requer pesquisa jurisprudencial)
        itens.push({
          id: 'MD3', peso: 3,
          item: 'Precedente CARF contrário: inexistente ou abordado explicitamente',
          status: 'AVALIAR',
          justificativa: temCarf
            ? 'Texto menciona CARF. Verificar se há precedente contrário à tese e se foi endereçado.'
            : `Tema "${tema_tributario}" pode ter jurisprudência administrativa. Verificar se existe acórdão CARF contrário.`,
          trecho_relevante: temCarf ? trecho(texto, 'CARF', 400) : `Tema: ${tema_tributario}`,
        });

        // MD4 — hierarquia sustenta conclusão — AVALIAR
        itens.push({
          id: 'MD4', peso: 3,
          item: 'Hierarquia de fontes sustenta a conclusão adotada',
          status: 'AVALIAR',
          justificativa: 'Verificar se a norma mais alta citada (CF, LC, LO) é a que fundamenta a conclusão, não norma inferior.',
          trecho_relevante: trecho(fundamentacao, 'art.', 400),
        });

        // MD5 — interpretação literal do fisco — AVALIAR
        itens.push({
          id: 'MD5', peso: 2,
          item: 'Conclusão resiste à interpretação literal do fisco (não depende de interpretação favorável ao contribuinte)',
          status: 'AVALIAR',
          justificativa: 'Testar: lendo a norma literalmente, sem presunção pro contribuinte, a conclusão ainda sustenta?',
          trecho_relevante: conclusao.slice(0, Math.min(500, conclusao.length)) + '...',
        });

        // MD6 — riscos declarados (auto via keywords)
        itens.push({
          id: 'MD6', peso: 2,
          item: 'Riscos e limitações declarados quando a posição é objeto de contestação conhecida',
          status: temRisco ? 'APROVADO' : 'REPROVADO',
          justificativa: temRisco
            ? 'Seção de riscos/vedações identificada.'
            : 'Nenhuma declaração de risco ou limitação encontrada. Incluir seção II.6 com ao menos 2 riscos práticos.',
          trecho_relevante: temRisco
            ? trecho(texto, 'risco') || trecho(texto, 'vedação')
            : undefined,
        });

        // MD7 — exemplos consistentes (condicional)
        if (temExemplos) {
          itens.push({
            id: 'MD7', peso: 1,
            item: 'Exemplos práticos consistentes com a posição jurídica adotada',
            status: 'AVALIAR',
            justificativa: 'Exemplos identificados. Verificar se os resultados numéricos são consistentes com a conclusão jurídica.',
            trecho_relevante: trecho(texto, 'III.') || trecho(texto, 'EXEMPLOS'),
          });
        } else {
          itens.push({ id: 'MD7', peso: 1, item: 'Exemplos consistentes com a posição jurídica', status: 'N_A' });
        }

        const aplicaveis  = itens.filter(i => i.status !== 'N_A');
        const paraAvaliar = aplicaveis.filter(i => i.status === 'AVALIAR');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              auditor: 'mcp_defender',
              instrucao: `Avaliar os ${paraAvaliar.length} itens AVALIAR com perspectiva fiscal: o que um auditor RFB/CARF atacaria neste parecer? Depois incluir em fase7_liberar().`,
              resumo: {
                tema: tema_tributario,
                aplicaveis: aplicaveis.length,
                para_avaliar: paraAvaliar.length,
                n_a: itens.length - aplicaveis.length,
              },
              itens,
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );

  // ── 7.4+7.5 fase7_liberar ─────────────────────────────────────────────────
  server.registerTool(
    'fase7_liberar',
    {
      description:
        'FASE 7.4+7.5 — Consolidação e Liberação. ' +
        'Recebe os resultados avaliados dos 3 auditores (revisao_normativa, mcp_chato, mcp_defender) ' +
        'e emite o veredito final da Fase 7. ' +
        'Incluir apenas itens aplicáveis (não-N_A). ' +
        'LIBERADO → prosseguir para Fase 8 (geração do DOCX). ' +
        'BLOQUEADO → corrigir antes de avançar. ' +
        'Scoring: normativa×40% + chato×35% + defender×25%. Mínimo 80 para LIBERADO.',
      inputSchema: {
        normativa: z.array(z.object({
          id: z.string().describe('ID do critério: RN1, RN2, ...'),
          aprovado: z.boolean().describe('true = aprovado, false = reprovado'),
        })).describe('Resultados avaliados do revisao_normativa — apenas itens aplicáveis'),
        chato: z.array(z.object({
          id: z.string(),
          aprovado: z.boolean(),
        })).describe('Resultados avaliados do mcp_chato — apenas itens aplicáveis'),
        defender: z.array(z.object({
          id: z.string(),
          aprovado: z.boolean(),
        })).describe('Resultados avaliados do mcp_defender — apenas itens aplicáveis'),
      },
    },
    async ({ normativa, chato, defender }) => {
      try {
        const rn = calcScore(normativa);
        const mc = calcScore(chato);
        const md = calcScore(defender);

        const statusRN = statusFromScore(rn.score, rn.reprovados_criticos);
        const statusMC = statusFromScore(mc.score, mc.reprovados_criticos);
        const statusMD = statusFromScore(md.score, md.reprovados_criticos);

        const notaFinal = Math.round(rn.score * 0.40 + mc.score * 0.35 + md.score * 0.25);

        const todosAprovados = [statusRN, statusMC, statusMD].every(s => s !== 'REPROVADO');
        const liberado = todosAprovados && notaFinal >= 80;

        const bloqueios = [
          ...rn.reprovados_criticos.map(id => ({ auditor: 'revisao_normativa', id })),
          ...mc.reprovados_criticos.map(id => ({ auditor: 'mcp_chato', id })),
          ...md.reprovados_criticos.map(id => ({ auditor: 'mcp_defender', id })),
        ];

        const coletarNaoCriticos = (
          itens: Array<{ id: string; aprovado: boolean }>,
          auditor: string,
        ) => itens
          .filter(i => !i.aprovado && (PESOS[i.id] ?? 1) < 3)
          .map(i => ({ auditor, id: i.id }));

        const ressalvas = [
          ...coletarNaoCriticos(normativa, 'revisao_normativa'),
          ...coletarNaoCriticos(chato, 'mcp_chato'),
          ...coletarNaoCriticos(defender, 'mcp_defender'),
        ];

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              fase: '7.4 Consolidação + 7.5 Liberação',
              scores: {
                revisao_normativa: { score: rn.score, status: statusRN },
                mcp_chato:         { score: mc.score, status: statusMC },
                mcp_defender:      { score: md.score, status: statusMD },
              },
              nota_final: notaFinal,
              status: liberado ? 'LIBERADO' : 'BLOQUEADO',
              veredicto: liberado
                ? notaFinal >= 90
                  ? 'LIBERADO — Parecer aprovado. Prosseguir para Fase 8 (geração do DOCX).'
                  : 'LIBERADO COM RESSALVAS — Registrar as ressalvas na Conclusão antes de gerar o DOCX.'
                : 'BLOQUEADO — Corrigir os itens abaixo antes de avançar para a Fase 8.',
              ...(bloqueios.length > 0 ? { bloqueios } : {}),
              ...(ressalvas.length > 0 ? { ressalvas } : {}),
              proximo_passo: liberado
                ? 'Fase 8 — Geração do DOCX com python-docx a partir do template correto.'
                : 'Retornar à seção indicada nos bloqueios e corrigir antes de chamar fase7_liberar() novamente.',
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
      }
    },
  );
}
