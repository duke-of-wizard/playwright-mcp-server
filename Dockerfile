FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json .
RUN npm install

# Install chromium using the exact playwright version bundled with @playwright/mcp
RUN npx playwright install chromium

COPY server.mjs .

EXPOSE 3000

# Use local node_modules binary (same version as install step above), force chromium
CMD ["sh", "-c", "node_modules/.bin/playwright-mcp --port 8931 --host 127.0.0.1 --allowed-hosts '*' --browser chromium & node server.mjs"]
