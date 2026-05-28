FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.mjs .

EXPOSE 3000

# Start MCP server on internal port 8931, then CORS proxy on $PORT
CMD ["sh", "-c", "npx @playwright/mcp@latest --port 8931 --host 127.0.0.1 --allowed-hosts '*' & node server.mjs"]
