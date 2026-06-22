# CreditClub — Shopify-app (React Router + Prisma op Postgres).
#
# node:20 (full debian) i.p.v. -slim: bevat openssl voor de Prisma-engine, dus
# GEEN `apt-get` nodig — op de Synology-NAS faalt apt-get-tijdens-build op
# seccomp. Bouw op de NAS met de legacy builder: `DOCKER_BUILDKIT=0 docker
# compose build` (BuildKit zet een seccomp-profiel dat de NAS-kernel weigert).
#
# --legacy-peer-deps: de React/Polaris peer-dependency-range botst onder `npm ci`
# (Render's `npm install` is impliciet toleranter). Bij start draait `docker-start`
# = prisma generate && prisma migrate deploy && react-router-serve.
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "docker-start"]
