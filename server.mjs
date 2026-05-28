import http from 'http';

const PORT = process.env.PORT || 3000;
const MCP_PORT = 8931;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-session-id, last-event-id',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

const FORWARD_REQUEST_HEADERS = ['content-type', 'authorization', 'mcp-session-id', 'last-event-id'];
const FORWARD_RESPONSE_HEADERS = ['content-type', 'mcp-session-id'];

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Build upstream request headers
  const upstreamHeaders = {};
  for (const h of FORWARD_REQUEST_HEADERS) {
    if (req.headers[h]) upstreamHeaders[h] = req.headers[h];
  }

  const upstreamReq = http.request(
    { hostname: '127.0.0.1', port: MCP_PORT, path: req.url, method: req.method, headers: upstreamHeaders },
    (upstreamRes) => {
      const contentType = upstreamRes.headers['content-type'] || '';
      const isSSE = contentType.includes('text/event-stream');

      // Build response headers
      const resHeaders = { ...CORS_HEADERS };
      for (const h of FORWARD_RESPONSE_HEADERS) {
        if (upstreamRes.headers[h]) resHeaders[h] = upstreamRes.headers[h];
      }

      if (isSSE) {
        // Disable all buffering for SSE
        resHeaders['Cache-Control'] = 'no-cache, no-transform';
        resHeaders['X-Accel-Buffering'] = 'no';
        resHeaders['Connection'] = 'keep-alive';
        delete resHeaders['Content-Length'];
      }

      res.writeHead(upstreamRes.statusCode, resHeaders);

      if (isSSE) {
        // Stream each chunk immediately — no buffering
        upstreamRes.on('data', (chunk) => {
          res.write(chunk);
          if (typeof res.flush === 'function') res.flush();
        });
        upstreamRes.on('end', () => res.end());
        upstreamRes.on('error', () => res.end());
      } else {
        upstreamRes.pipe(res);
      }
    }
  );

  upstreamReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, CORS_HEADERS);
      res.end('Bad Gateway');
    }
  });

  req.pipe(upstreamReq);
});

// WebSocket upgrade passthrough
server.on('upgrade', (req, socket, head) => {
  const upstreamReq = http.request({
    hostname: '127.0.0.1',
    port: MCP_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });
  upstreamReq.on('upgrade', (_res, upstreamSocket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n');
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });
  upstreamReq.on('error', () => socket.destroy());
  upstreamReq.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Streaming MCP proxy on :${PORT} → MCP on :${MCP_PORT}`);
});
