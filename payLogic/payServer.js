import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sendBitcoin from './controllers/payController'
import createInvoice from './controllers/payController';
import { json } from "express";

// Create an MCP server
const server = new McpServer({
  name: "pay-server",
  version: "1.0.0"
});

// storage payement tool
server.registerTool("IPFSAgentPayTool",
  {
    title: "Agent Payment",
    description: "Send bitcoin in a particular address as payment for IPFS agent services.",
    inputSchema: { address: String, email: String, btc: Number },
    outputSchema: { response: json }
  },
  async (address,email,btc) => {
    return sendBitcoin(address, email,btc)
      .then((response) => (response))
      .catch((error) => ({error: error}))
  }
);

// Customer invoicing tool
server.registerTool("storagePayement",
  {
    title: "Storage Payment",
    description: "Prompt user to pay for storage.",
    inputSchema: {email: String, btc: Number},
    outputSchema: { content: [{type:"text",data:data}] }
  },
  async (address,email) => {
    return sendBitcoin(address, email)
      .then((response) => ({ content: [{ type: "API response", data: response}] }))
      .catch((error) => ({ content: [{ type: "error", data: `Error sending Bitcoin: ${error}` }] }))
  }
);

// Add a dynamic greeting resource
// server.registerResource(
//   "greeting",
//   new ResourceTemplate("greeting://{name}", { list: undefined }),
//   { 
//     title: "Greeting Resource",      // Display name for UI
//     description: "Dynamic greeting generator"
//   },
//   async (uri, { name }) => ({
//     contents: [{
//       uri: uri.href,
//       text: `Hello, ${name}!`
//     }]
//   })
// );

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);