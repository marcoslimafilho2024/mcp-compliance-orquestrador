/**
 * tools/revisao_citacoes_catalogo.ts
 *
 * Catalogo estatico de apoio a revisao_citacoes (auditor adversarial).
 * Fonte: protocolo de verificacao de citacoes + base de erros reais da LC 214/2025
 * (consolidado a partir da revisao do Parecer Contabilizei - Junho/2026).
 *
 * Consumido pela tool revisao_citacoes via parametro `modo`:
 *   protocolo | erros_lc214 | template_quadro | todos
 */

export const PROTOCOLO = {
  titulo: 'Protocolo de Verificação de Citações — Guerra/Compliance',
  quando_usar: 'Antes de finalizar qualquer parecer. Obrigatório quando o parecer citar LC 214/2025, decisões STF/STJ ou cálculos tributários.',
  etapas: [
    {
      etapa: 1,
      acao: 'Coletar todas as citações do documento',
      como: 'Varrer o texto completo e listar: (a) blocos entre aspas com referência, (b) referências parentéticas "(art. X, LC Y)", (c) menções a decisões (REsp, RE, ADI), (d) cálculos numéricos com base legal',
      saida: 'Lista numerada de todas as citações encontradas',
    },
    {
      etapa: 2,
      acao: 'Classificar cada citação por tipo e criticidade',
      como: 'Tipo: DIRETA (transcrição literal) | INDIRETA (referência ao conteúdo) | CÁLCULO (exemplo numérico com base legal) | ANALOGIA (uso de precedente por extensão). Criticidade: GRAVE (muda o resultado jurídico) | IMPORTANTE (artigo trocado, tema certo) | MENOR (concordância, desatualizado)',
      saida: 'Cada citação classificada por tipo e criticidade',
    },
    {
      etapa: 3,
      acao: 'Verificar cada citação na fonte original',
      como: 'Para normas: acessar Planalto/Legisweb/Modeloinicial. Para jurisprudência: portal STJ/STF. Para cálculos: verificar manualmente a fórmula contra o texto legal. NUNCA confiar na memória ou em versões anteriores do parecer.',
      saida: 'Texto real da fonte para cada citação',
    },
    {
      etapa: 4,
      acao: 'Comparar citação do parecer vs. texto real',
      como: 'Para citações DIRETAS: comparar palavra a palavra. Para INDIRETAS: verificar se o artigo citado realmente contém o que o parecer afirma. Para CÁLCULOS: refazer a conta com base na fórmula legal.',
      saida: 'Veredicto por citação: ✅ CORRETO | ❌ ERRADO | ⚠️ IMPRECISO | 🟡 DESATUALIZADO | ❓ NÃO VERIFICADO',
    },
    {
      etapa: 5,
      acao: 'Registrar correção para cada erro',
      como: 'Para erros: indicar o artigo correto, texto correto ou cálculo correto. Para desatualizados: indicar a norma/decisão que atualizou. Para imprecisos: indicar a qualificação necessária.',
      saida: 'Quadro final com veredicto + correção por citação',
    },
    {
      etapa: 6,
      acao: 'Avaliar impacto dos erros na conclusão do parecer',
      como: 'Erros GRAVES que fundamentam a conclusão exigem reescrita. Erros IMPORTANTES de numeração exigem correção pontual. Erros MENORES são corrigidos na revisão final.',
      saida: 'Lista de ações: reescrever seção / corrigir artigo / qualificar afirmação',
    },
  ],
};

export const ERROS_LC214 = {
  titulo: 'Padrões de Erro Recorrentes — LC 214/2025 (baseado em casos reais)',
  fonte_caso: 'Identificados na revisão do Parecer Contabilizei — Junho/2026',
  advertencia: 'Estes erros foram confirmados com verificação direta no Planalto e fontes oficiais. Verificar periodicamente se a LC 214/2025 foi alterada (LC 227/2026 já alterou art. 11 inciso X).',
  erros: [
    {
      codigo: 'E-LC214-01',
      gravidade: '🔴 GRAVE',
      artigo_errado: 'Art. 169, §8º',
      uso_incorreto: 'Fundamento do crédito presumido para quem adquire de nanoempreendedor',
      realidade: 'Art. 169 + §8º trata de crédito presumido para TRANSPORTE AUTÔNOMO DE CARGA. §8º estende às cooperativas de transportadores. Nanoempreendedor NÃO é mencionado.',
      artigo_correto: 'Não existe crédito presumido específico para aquisição de nano na LC 214. Verificar arts. 126-134 (regime de crédito do Simples) se o contexto for outro.',
      dica: 'Buscar "nanoempreendedor" na LC 214 — só aparece no art. 26, IV (definição). Qualquer outro fundamento para nano precisa ser verificado.',
    },
    {
      codigo: 'E-LC214-02',
      gravidade: '🔴 GRAVE',
      artigo_errado: 'Art. 11, X — "local do estabelecimento do PRESTADOR"',
      uso_incorreto: 'Afirmar que serviços remotos têm IBS/CBS no município do prestador',
      realidade: 'Art. 11, X = "local do domicílio principal do ADQUIRENTE residente/domiciliado no País" (redação LC 227/2026). Para serviços remotos onerosos, o local é o DESTINO (tomador), não o prestador.',
      artigo_correto: 'Art. 11, X — mas com interpretação correta: local = adquirente/tomador',
      dica: 'Confundir prestador com tomador inverte toda a lógica do IBS/CBS territorial. No caso Lucas/Vacaria: IBS vai para o município de CADA CLIENTE, não Vacaria.',
    },
    {
      codigo: 'E-LC214-03',
      gravidade: '🟡 IMPORTANTE',
      artigo_errado: 'Art. 258 — "redução de 70% nas alíquotas para imóveis"',
      uso_incorreto: 'Citar art. 258 como fundamento da alíquota reduzida de 70%',
      realidade: 'Art. 258 = "redutor de ajuste" — mecanismo de apuração da BASE DE CÁLCULO em operações imobiliárias (valor de aquisição histórico). Nada a ver com alíquota.',
      artigo_correto: 'Art. 261, §único — "alíquotas de IBS e CBS relativas às operações de locação, cessão onerosa e arrendamento de bens imóveis ficam reduzidas em 70%"',
      dica: 'Arts. 258-260 = base de cálculo (redutor de ajuste). Art. 261 = alíquotas. Confusão frequente por proximidade numérica.',
    },
    {
      codigo: 'E-LC214-04',
      gravidade: '🟡 IMPORTANTE',
      artigo_errado: 'Art. 253 — "limites PF locadora: R$240k + 3 imóveis"',
      uso_incorreto: 'Citar art. 253 como os critérios para PF ser contribuinte na locação de imóveis',
      realidade: 'Art. 253 = locação residencial de CURTA TEMPORADA (até 90 dias) — aplica regras de hotelaria. Não trata dos limites gerais da PF.',
      artigo_correto: 'Art. 251, §1º, inciso I, alíneas a e b — "receita bruta superior a R$240.000 E mais de 3 imóveis distintos"',
      dica: 'Art. 251 = regra geral PF locadora. Art. 253 = caso especial curta temporada/airbnb. Confusão por proximidade numérica (251 vs 253).',
    },
    {
      codigo: 'E-LC214-05',
      gravidade: '🔴 GRAVE',
      artigo_errado: 'Art. 72 — "imunidade das exportações de serviços"',
      uso_incorreto: 'Citar art. 72 como fundamento da imunidade das exportações de serviços ao IBS/CBS',
      realidade: 'Art. 72 = define quem é CONTRIBUINTE do IBS na IMPORTAÇÃO de bens materiais (importador). Nada a ver com exportações.',
      artigo_correto: 'Art. 8º (regra geral de imunidade) + Art. 79 (imunidade de exportações, Capítulo V) + Art. 80 (conceito de exportação de serviços)',
      dica: 'A imunidade de exportações está no Capítulo V (arts. 72-80 do Título I). Art. 72 abre o capítulo mas trata do contribuinte na importação. Art. 79 é o artigo principal sobre exportações.',
    },
    {
      codigo: 'E-LC214-06',
      gravidade: '🟡 IMPORTANTE',
      artigo_errado: 'Art. 60, §2º — "Ato conjunto RFB/CGIBS dispensa não contribuintes"',
      uso_incorreto: 'Atribuir ao §2º do art. 60 a previsão de dispensa por ato conjunto para não contribuintes',
      realidade: 'Art. 60, §2º real: obrigação de emissão aplica-se inclusive a operações imunes, isentas, alíquota zero e transferências. A previsão de "ato conjunto" para dispensar não contribuintes está em outro parágrafo (verificar §3º ou §4º).',
      artigo_correto: 'Verificar art. 60, §3º ou §4º para localizar a previsão de dispensa por ato conjunto',
      dica: 'Ao transcrever parágrafos, verificar sempre o número exato. §2º e §3º/§4º têm conteúdos radicalmente diferentes aqui.',
    },
  ],
};

export const ERROS_OUTROS = {
  titulo: 'Padrões de Erro em Outras Normas — Casos Confirmados',
  erros: [
    {
      codigo: 'E-CTN-01',
      gravidade: '🟡 IMPORTANTE',
      norma: 'CTN, art. 111, I',
      uso_incorreto: 'Fundamento para "interpretação literal de normas de INCIDÊNCIA tributária"',
      realidade: 'Art. 111, I = interpretação literal de legislação que dispõe sobre SUSPENSÃO OU EXCLUSÃO do crédito tributário. Não se refere a normas de incidência.',
      correto: 'Para isenção: art. 111, II. Para normas de incidência em geral: não há exigência legal de interpretação literal — o CTN não restringe o método interpretativo para incidência.',
    },
    {
      codigo: 'E-IRPF-01',
      gravidade: '🔴 GRAVE',
      norma: 'Lei 9.250/1995, art. 6º-A — cálculo IRRF',
      uso_incorreto: 'Calcular IRRF sobre o EXCEDENTE de R$50.000: IRRF = 10% × (total − 50.000)',
      realidade: 'Art. 6º-A, caput: incidência sobre total quando superior a R$50k. §1º: "vedadas quaisquer deduções da base de cálculo". Base = TOTAL recebido, não excedente.',
      correto: 'Exemplo correto: R$80.000 recebidos → IRRF = 10% × R$80.000 = R$8.000 (não R$3.000)',
    },
    {
      codigo: 'E-EC132-01',
      gravidade: '🟡 IMPORTANTE',
      norma: 'EC 132/2023 — extinção do ISS',
      uso_incorreto: 'Citar "art. 156, §1º, da CF" como fundamento da extinção do ISS',
      realidade: 'A extinção do ISS está no art. 129 do ADCT (inserido pela EC 132/2023): "Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II e 156, III da CF". Data: 01/01/2033 (não 31/12/2032).',
      correto: 'Citar: art. 129 do ADCT (EC 132/2023). Data: "a partir de 2033" ou "01/01/2033".',
    },
    {
      codigo: 'E-STJ-01',
      gravidade: '⚠️ VERIFICAR',
      norma: 'STJ, REsp 1.390.109/RJ',
      uso_incorreto: 'Citado como precedente sobre ISS ser devido no local de efetiva prestação vs. CNPJ',
      realidade: 'Não confirmado — pode ser precedente sobre sociedades uniprofissionais / alíquota fixa de ISS, não sobre localização.',
      correto: 'Verificar o tema real antes de protocolar. Precedentes confirmados sobre local ISS: REsp 1.060.210/SC (Tema 355), REsp 1.117.121/SP, REsp 1.195.844/DF.',
    },
    {
      codigo: 'E-PRAZO-01',
      gravidade: '🟡 DESATUALIZADO',
      norma: 'Prazo de isenção de lucros/dividendos',
      uso_incorreto: 'Afirmar que a ATA de distribuição precisa ser aprovada até 31/12/2025',
      realidade: 'STF, ADIs 7912/7914 (Min. Nunes Marques): prazo prorrogado para 31/01/2026. Decisão cautelar referendada pelo plenário.',
      correto: 'Prazo: 31/01/2026. Citar: "ADIs 7912 e 7914, STF, Min. Nunes Marques".',
    },
  ],
};

export const TEMPLATE_QUADRO = {
  titulo: 'Template — Quadro de Verificação de Citações',
  instrucao: 'Preencher uma linha por citação. Veredictos: ✅ CORRETO | ❌ ERRADO | ⚠️ IMPRECISO | 🟡 DESATUALIZADO | ❓ NÃO VERIFICADO',
  colunas: ['#', 'Tipo', 'Citação (norma/decisão)', 'O que o parecer afirma', 'Texto real da fonte', 'Veredicto', 'Correção necessária'],
  tipos_validos: ['DIRETA (transcrição literal)', 'INDIRETA (referência ao conteúdo)', 'CÁLCULO (exemplo numérico)', 'ANALOGIA (extensão de precedente)'],
  gravidades: {
    grave: '🔴 Muda o resultado jurídico — exige reescrita da seção',
    importante: '🟡 Artigo trocado, tema certo — corrigir o número',
    menor: '⚠️ Concordância, imprecisão, desatualizado — corrigir antes de entregar',
  },
  exemplo_linha: {
    numero: 'C1',
    tipo: 'DIRETA',
    citacao: 'Art. 26, IV — LC 214/2025',
    parecer_afirma: 'Nano: PF com RBT < 50% do MEI que não aderiu ao regime',
    texto_real: 'Confirmado no Planalto — texto coincide',
    veredicto: '✅ CORRETO',
    correcao: '—',
  },
  checklist_pre_entrega: [
    'Todos os artigos foram verificados no Planalto ou fonte oficial?',
    'Nenhum §º ou inciso está trocado em citações diretas?',
    'Os precedentes STF/STJ citados tratam exatamente do tema afirmado?',
    'Os cálculos nos Exemplos Práticos reproduzem corretamente a fórmula legal?',
    'Datas de prazo (isenções, vigências) foram conferidas contra decisões recentes?',
    'Artigos de leis que tiveram alterações recentes (ex: LC 227/2026) estão na versão vigente?',
  ],
};
