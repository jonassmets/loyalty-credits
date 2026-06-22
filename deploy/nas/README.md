# Loyalty Credits → NAS (runbook)

Loyalty Credits van Render naar de NAS verhuizen: **postgres + app + api +
tunnel**, volledig draaiend op de NAS, geparkeerd maar startbaar, en makkelijk
terug naar Render.

| Onderdeel | Wat | Container |
|-----------|-----|-----------|
| **app** | CreditClub — de Shopify-app (React Router + Prisma) | `loyalty-app` |
| **api** | `shopify-loyalty-api` — kleine Express-API (`/spend`) | `loyalty-api` |
| **postgres** | de Prisma-database (sessies, refresh-tokens, order-credit-dedup) | `loyalty-postgres` |
| **tunnel** | Cloudflare-tunnel → publieke HTTPS-URL | `loyalty-tunnel` |

> De échte store-credits leven in **Shopify**. Postgres houdt vooral bij *welke
> orders al credit kregen* — dus de data is het bewaren waard, maar verliezen is
> niet catastrofaal.

---

## ✅ Status: uitgevoerd 2026-06-22 (draait op de NAS)

De stack staat live op `/volume1/k118-studio/projects/loyalty-credits/`: postgres 18
+ app + api + tunnel draaien, 53 `LoyaltyLog`-rijen gemigreerd, tunnel
`loyalty.kattenberg118.be` geregistreerd, `project_type=compose` gezet (Start/Stop
in de studio). **Nog te doen door Jonas:** `SHOPIFY_API_SECRET` +
`SHOPIFY_ADMIN_ACCESS_TOKEN` in `.env` zetten + `docker compose up -d app`, de
Shopify Partner app-URL/redirects naar de tunnel, en Render afbouwen.

### NAS-specifieke gotchas (waar deze migratie tegenaan liep)
- **Bouwen:** `DOCKER_BUILDKIT=0` verplicht (BuildKit → "seccomp not supported" op Synology).
- **App-image:** `node:20` (full, openssl) + `npm ci --legacy-peer-deps` (geen apt-get).
- **Postgres 18:** volume op `/var/lib/postgresql` (niet `/…/data`).
- **Tunnel-token:** via `TUNNEL_TOKEN`-env, niet als `--token` op de command-line.
- **DB-migratie:** Render verbergt de externe DB-URL → data overgezet via read-only
  `SELECT`s → `INSERT … ON CONFLICT DO NOTHING` (geen `pg_dump`/wachtwoord nodig).

---

## 1. Cloudflare-tunnel aanmaken

1. Cloudflare-dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel**
   → type **cloudflared** → geef 'm een naam (bv. `loyalty`).
2. Kopieer de **token** (de lange string na `--token`). Die komt straks in `.env`.
3. Onder **Public Hostnames** map je:
   - `loyalty.kattenberg118.be` → **HTTP** → `app:3000`
   - (optioneel, alleen als de winkel `/spend` gebruikt)
     `loyalty-api.kattenberg118.be` → **HTTP** → `api:3000`

> De hostnames moeten onder een zone staan die in Cloudflare zit
> (`kattenberg118.be`). Pas anders de namen aan.

---

## 2. Mappenstructuur + code op de NAS

```sh
# SSH op de NAS, als user claude:
cd /volume1/k118-studio/projects
mkdir -p loyalty-credits && cd loyalty-credits

# De twee repo's clonen (de NAS-branch met de Dockerfiles):
git clone -b nas-deploy git@github.com:Kattenberg-118/loyalty-credits.git app
git clone -b nas-deploy git@github.com:jonassmets/shopify-loyalty-api.git api

# De compose + env naar de projectmap:
cp app/deploy/nas/docker-compose.yml ./docker-compose.yml
cp app/deploy/nas/.env.example ./.env
```

Eindresultaat:

```
loyalty-credits/
  docker-compose.yml
  .env
  app/   (clone loyalty-credits @ nas-deploy)
  api/   (clone shopify-loyalty-api @ nas-deploy)
```

---

## 3. `.env` invullen

Open `.env` (op de NAS met `vi`, of bewerk lokaal en `scp`):

- `POSTGRES_PASSWORD` → een sterk wachtwoord (verzin er één).
- `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` → uit het Shopify **Partner-dashboard**
  (of uit de huidige Render-env-vars, zie stap 5).
- `SHOPIFY_APP_URL` → `https://loyalty.kattenberg118.be`
- `SHOPIFY_SHOP` + `SHOPIFY_ADMIN_ACCESS_TOKEN` → voor de api (uit Render-env).
- `TUNNEL_TOKEN` → de token uit stap 1.

---

## 4. Database overzetten van Render (optioneel maar aanbevolen)

Eerst alleen postgres starten zodat de DB er is:

```sh
docker compose up -d postgres
```

Haal in het Render-dashboard de **External Database URL** op (Loyalty-Postgres →
Connect → External). Dump + restore (een volledige dump bevat schema + data +
Prisma's migratie-historie, dus `migrate deploy` is daarna een no-op):

```sh
# op een machine met de postgres-client (je Mac of de NAS):
pg_dump "postgresql://…RENDER-EXTERNAL-URL…" --no-owner --no-privileges > loyalty.sql

# loyalty.sql op de NAS in de projectmap zetten, dan inladen:
cat loyalty.sql | docker compose exec -T postgres psql -U loyalty -d loyalty
```

> Geen data nodig? Sla deze stap over — `prisma migrate deploy` maakt bij de
> eerste start vanzelf lege tabellen aan.

---

## 5. Alles starten

```sh
docker compose up -d        # bouwt app + api, start postgres + tunnel
docker compose logs -f app  # volg de boot (prisma migrate deploy → serve)
```

Check:
- `docker compose ps` → alles `Up` / `healthy`.
- `https://loyalty.kattenberg118.be` → de app-login laadt.

---

## 6. Shopify Partner-dashboard bijwerken

De app wijst nu naar de tunnel i.p.v. Render. In het **Partner-dashboard** →
CreditClub → **Configuration**:

- **App URL** → `https://loyalty.kattenberg118.be`
- **Allowed redirection URL(s)** → `https://loyalty.kattenberg118.be/auth/callback`
  (en de andere `/auth/*`-callbacks die er stonden voor Render).

> `shopify.app.toml` in de app-repo staat nog op `…onrender.com`. Laat 'm staan
> of pas 'm aan op de `nas-deploy`-branch — runtime telt enkel `SHOPIFY_APP_URL`
> + de Partner-config.

Herinstalleer/heropen de app in de testwinkel om OAuth opnieuw te laten lopen.

---

## 7. Render afbouwen

Pas **nadat** stap 5+6 werken:

1. Render-dashboard → de service **loyalty-credits** → Settings → **Suspend**
   (of Delete).
2. Idem de **shopify-loyalty-api**-service.
3. De **Postgres**-instance → Suspend/Delete (na de dump uit stap 4!).

Suspend = pauze (kosten weg, makkelijk terug). Delete = definitief.

---

## Parkeren / starten (dagelijks gebruik)

```sh
cd /volume1/k118-studio/projects/loyalty-credits
docker compose up -d     # aanzetten
docker compose down      # uitzetten (data blijft in het volume loyalty-db)
docker compose pull && docker compose up -d --build   # na een git pull in app/ of api/
```

In Fase B komt hier een **knop in de Studio** voor (start/stop via SSH), zodat dit
niet meer met de hand hoeft.

---

## Terug naar Render

Het `render.yaml` (Blueprint) in de app-repo staat klaar:

1. Render-dashboard → **New → Blueprint** → kies de `loyalty-credits`-repo.
2. Render maakt de Postgres + web-service en koppelt `DATABASE_URL` automatisch.
3. Vul de Shopify-secrets in (die staan op `sync:false`).
4. Zet `SHOPIFY_APP_URL` + de Partner-redirect-URLs terug naar het
   `…onrender.com`-adres.
5. (De api opnieuw als losse Render-service deployen.)
