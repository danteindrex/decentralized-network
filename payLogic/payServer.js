import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sendBitcoin from './controllers/payController'

// Create an MCP server
const server = new McpServer({
  name: "pay-server",
  version: "1.0.0"
});

// storage payement tool
server.registerTool("storagePayement",
  {
    title: "Storage Payment",
    description: "Prompt user to send bitcoin as payement for storage.",
    inputSchema: { address: String, email: String },
    outputSchema: { content: [{ type: "text", text: String }] }
  },
  async (address,email) => {
    return sendBitcoin(address, email)
      .then(() => ({ content: [{ type: "text", text: "Bitcoin sent successfully!" }] }))
      .catch((error) => ({ content: [{ type: "text", text: `Error sending Bitcoin: ${error.message}` }] }))
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