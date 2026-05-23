import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LegiswebAgent } from './agents/legisweb.agent.js';
import { TaxPraticoAgent } from './agents/taxpratico.agent.js';
import { registerLegiswebTools } from './tools/legisweb.tools.js';
import { registerTaxPraticoTools } from './tools/taxpratico.tools.js';
import { registerLayoutTools } from './tools/layouts.tools.js';
import { startServer } from './server.js';

const legiswebAgent = new LegiswebAgent();
const taxPraticoAgent = new TaxPraticoAgent();

function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'mcp-compliance-orquestrador',
      version: '0.1.0',
    },
    {
      instructions:
        'Ferramentas de compliance: Legisweb e Tax Prático. Use buscar_* antes de extrair_* quando não houver URL direta.',
    },
  );

  registerLegiswebTools(server, legiswebAgent);
  registerTaxPraticoTools(server, taxPraticoAgent);
  registerLayoutTools(server);

  return server;
}

startServer(createMcpServer);
