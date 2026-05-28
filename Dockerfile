FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json .
RUN npm install

# Install the browser version bundled with @playwright/mcp
RUN npx @playwright/mcp install-browser

COPY server.mjs .

EXPOSE 3000

# --headless: required in container (headed by default)
# --isolated: keep browser profile in memory
# --no-sandbox: required in Docker containers
CMD ["sh", "-c", "npx @playwright/mcp --port 8931 --host 127.0.0.1 --allowed-hosts '*' --headless --isolated --no-sandbox & node server.mjs"]
