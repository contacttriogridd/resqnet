# RESQNET API — build context is the repository root:
#   docker build -f backend/Dockerfile -t resqnet-api .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci --ignore-scripts \
 && npm rebuild argon2 \
 && npm run build -w @resqnet/shared \
 && npx prisma generate --schema prisma/schema.prisma \
 && npm run build -w @resqnet/backend

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations (non-destructive), then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node backend/dist/server.js"]
