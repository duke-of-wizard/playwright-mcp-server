import http from 'http';
import httpProxy from 'http-proxy';

const PORT = process.env.PORT || 3000;
const MCP_PORT = 8931;

const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${MCP_PORT}`,
  ws: true,
});

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, last-event-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  proxy.web(req, res, {}, (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });
});

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CORS proxy listening on port ${PORT}, forwarding to MCP on ${MCP_PORT}`);
});
