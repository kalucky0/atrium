# API image (also runs DB migrations). Build context = repo root.
FROM oven/bun:1.3-slim
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install deps first for layer caching (copy manifests only).
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN bun install --frozen-lockfile

# App source (incl. packages/db/drizzle migrations).
COPY . .

EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
