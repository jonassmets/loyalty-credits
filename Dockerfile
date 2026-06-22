# CreditClub — Shopify-app (React Router + Prisma op Postgres).
#
# Debian-slim i.p.v. alpine: Prisma's standaard query-engine draait zo zonder
# extra binaryTargets-gedoe (alpine = musl → vraagt een aparte engine).
# De build genereert de Prisma-client + bouwt de app. Bij het starten draait
# `docker-start` (zie package.json) = `prisma generate && prisma migrate deploy`
# gevolgd door `react-router-serve`. Migrate-deploy heeft de DB nodig, dus die
# stap gebeurt bewust pas bij runtime (postgres moet dan up zijn).
FROM node:20-slim

# OpenSSL is nodig voor de Prisma-engine op debian-slim.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Eerst alleen de manifests → betere layer-cache bij code-wijzigingen.
COPY package*.json ./
RUN npm ci

# Daarna de rest + de build (Prisma-client + React-Router-build).
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# docker-start = prisma generate && prisma migrate deploy && react-router-serve
CMD ["npm", "run", "docker-start"]
