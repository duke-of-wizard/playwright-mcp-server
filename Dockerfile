FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.mjs .

EXPOSE 3000

# Find the Chromium binary from the base image and pass it explicitly.
# This avoids the "chrome not found at /opt/google/chrome" error.
CMD ["sh", "-c", "CHROME=$(find /ms-playwright -name 'chrome' -path '*/chrome-linux/chrome' | head -1) && echo \"Using browser: $CHROME\" && npx @playwright/mcp --port 8931 --host 127.0.0.1 --allowed-hosts '*' --headless --isolated --no-sandbox --executable-path \"$CHROME\" & node server.mjs"]
