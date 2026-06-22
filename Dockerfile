# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Build stage — installeer alle deps, genereer Prisma client, build
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app

# Prisma heeft openssl nodig
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Verklein node_modules tot enkel productie-dependencies
RUN npm prune --omit=dev

# ─────────────────────────────────────────────────────────────
# Runtime stage — lichte image met enkel de build + prod deps
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# docker-start = "prisma generate && prisma migrate deploy" gevolgd door react-router-serve
CMD ["npm", "run", "docker-start"]
