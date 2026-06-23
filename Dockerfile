# CreditClub — Shopify-app (React Router + Prisma op Postgres).
#
# node:20 (full debian) i.p.v. -slim: bevat openssl voor de Prisma-engine, dus
# GEEN `apt-get` nodig — op de Synology-NAS faalt apt-get-tijdens-build op
# seccomp. Bouw op de NAS met de legacy builder: `DOCKER_BUILDKIT=0 docker
# compose build` (BuildKit zet een seccomp-profiel dat de NAS-kernel weigert).
#
# rm package-lock + npm install + expliciete linux-rollup-binary: --legacy-peer-deps
# voor de React/Polaris peer-conflict, en het omzeilt de npm optional-dep-bug
# (lockfile op macOS gemaakt → @rollup/rollup-linux-x64-gnu ontbreekt → vite-build
# faalt). Bij start draait `docker-start` = prisma migrate deploy && react-router-serve.
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN rm -f package-lock.json \
 && npm install --legacy-peer-deps \
 && npm install --no-save --legacy-peer-deps @rollup/rollup-linux-x64-gnu
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "docker-start"]
