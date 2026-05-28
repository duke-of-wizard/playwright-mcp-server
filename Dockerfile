FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

RUN npm install @playwright/mcp@latest

EXPOSE 8931

CMD npx @playwright/mcp@latest --port ${PORT:-8931} --host 0.0.0.0
