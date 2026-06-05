import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LegiswebAgent } from './agents/legisweb.agent.js';
import { TaxPraticoAgent } from './agents/taxpratico.agent.js';
import { SijutAgent } from './agents/sijut.agent.js';
import { CarfAgent } from './agents/carf.agent.js';
import { CarfAcordaosAgent } from './agents/carfacordaos.agent.js';
import { registerLegiswebTools } from './tools/legisweb.tools.js';
import { registerTaxPraticoTools } from './tools/taxpratico.tools.js';
import { registerLayoutTools } from './tools/layouts.tools.js';
import { registerSijutTools } from './tools/sijut.tools.js';
import { registerCarfTools } from './tools/carf.tools.js';
import { registerCarfAcordaosTools } from './tools/carfacordaos.tools.js';
import { registerCpcTools } from './tools/cpc.tools.js';
import { registerCfcTools } from './tools/cfc.tools.js';
import { registerYoutubeTools } from './tools/youtube.tools.js';
import { registerRevisaoTools } from './tools/revisao.tools.js';
import { registerFase7Tools } from './tools/fase7.tools.js';
import { registerSlidesTools } from './tools/slides.tools.js';
import { registerAlegacoesTools } from './tools/alegacoes.tools.js';
import { registerFontesOficiaisTools } from './tools/fontes_oficiais.tools.js';
import { startServer } from './server.js';

const legiswebAgent = new LegiswebAgent();
const taxPraticoAgent = new TaxPraticoAgent();
const sijutAgent = new SijutAgent();
const carfAgent = new CarfAgent();
const carfAcordaosAgent = new CarfAcordaosAgent();

function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'mcp-compliance-orquestrador',
      version: '0.2.0',
    },
    {
      instructions:
        'MCP de Compliance Tributário — Reforma Tributária IBS/CBS (LC 214/2025). ' +
        'Fluxo para respostas técnicas: (1) fonte_lc214_mapa_temas → identificar artigos; ' +
        '(2) fonte_artigo_url → URL para fetch do texto legal; ' +
        '(3) alegacao_estrutura_resposta → estrutura dos 7 tópicos; ' +
        '(4) revisao_checklist_parecer(categoria) → validar por categoria antes de entregar. ' +
        'Pesquisa: pesquisar_*(modo="buscar") para listar, pesquisar_*(modo="extrair", url) para texto completo. ' +
        'Formatação: layout_regras(tipo="docx"|"xlsx"|"linguagem"). ' +
        'Integrações (Trello/Gmail/Drive/Keep) estão no mcp-integracoes separado.',
    },
  );

  registerLegiswebTools(server, legiswebAgent);
  registerTaxPraticoTools(server, taxPraticoAgent);
  registerLayoutTools(server);
  registerSijutTools(server, sijutAgent);
  registerCarfTools(server, carfAgent);
  registerCarfAcordaosTools(server, carfAcordaosAgent);
  registerCpcTools(server);
  registerCfcTools(server);
  registerYoutubeTools(server);
  registerRevisaoTools(server);
  registerFase7Tools(server);
  registerSlidesTools(server);
  registerAlegacoesTools(server);
  registerFontesOficiaisTools(server);

  return server;
}

startServer(createMcpServer);
