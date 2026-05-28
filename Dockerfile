FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json .
RUN npm install

EXPOSE 8931

CMD ["sh", "-c", "npx @playwright/mcp@latest --port ${PORT:-8931} --host 0.0.0.0 --allowed-origins ${ALLOWED_ORIGINS:-*}"]
