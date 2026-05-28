FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json .
RUN npm install

# Install chromium using the exact playwright version bundled with @playwright/mcp
RUN npx playwright install chromium

COPY server.mjs .

EXPOSE 3000

# Start MCP server on internal port 8931, then streaming proxy on $PORT
CMD ["sh", "-c", "npx @playwright/mcp --port 8931 --host 127.0.0.1 --browser chromium & node server.mjs"]
