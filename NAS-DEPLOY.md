# CreditClub op je Synology NAS draaien (weg van Render)

Deze gids zet de app op je Synology NAS in Docker, met PostgreSQL als container en
een **Cloudflare Tunnel** voor de publieke HTTPS-toegang. De tunnel is **geparkeerd**:
hij draait niet standaard, maar je start hem op wanneer nodig.

---

## ⚠️ Lees dit eerst — wat "parkeren" betekent

CreditClub is een **embedded Shopify-app**. Shopify moet de app publiek via HTTPS
kunnen bereiken voor:

- het laden van het admin-paneel (iframe via `application_url`),
- **webhooks** (`orders/paid`, `app/uninstalled`),
- de OAuth-callback bij (her)installatie.

Daarom geldt:

| Toestand | App lokaal op NAS | Tunnel | Gevolg |
|---|---|---|---|
| **Geparkeerd** | draait | **uit** | Shopify kan de app niet bereiken. Het admin-paneel opent niet en **`orders/paid` webhooks komen NIET binnen** → klanten krijgen op dat moment géén store credit. |
| **Actief** | draait | **aan** | Alles werkt normaal. |

> **Conclusie:** zolang de app aan een echte (live) winkel hangt en die winkel
> bestellingen verwerkt, moet de tunnel blijven draaien om credits toe te kennen.
> "Parkeren" is bedoeld voor wanneer de app *niet* live op een verkopende winkel
> staat — je houdt alles klaarstaan en zet de tunnel aan wanneer je hem nodig hebt.

---

## Vereisten

- Synology NAS met **Container Manager** (Package Center → installeren).
- Een **Cloudflare-account** met een domein dat in Cloudflare beheerd wordt (gratis plan volstaat).
- **Shopify Partner**-toegang tot deze app (om het app-domein aan te passen).
- Optioneel: SSH op de NAS (Configuratiescherm → Terminal & SNMP → SSH inschakelen) — handig voor `docker compose`-commando's.

---

## Stap 1 — Cloudflare Tunnel aanmaken

We gebruiken een **remote-managed tunnel** (met token). De hostname → service-koppeling
stel je in het Cloudflare-dashboard in; de container heeft enkel het token nodig.

1. Ga naar **Cloudflare Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**.
2. Kies **Cloudflared**, geef een naam (bv. `creditclub-nas`) → **Save**.
3. Je krijgt een **connector-token** te zien (lange string). **Kopieer dit** — dit wordt
   `TUNNEL_TOKEN` in je `.env`. (Negeer de install-commando's; Docker doet dat.)
4. Tab **Public Hostname** → **Add a public hostname**:
   - **Subdomain**: bv. `credits`
   - **Domain**: je domein (bv. `jouwdomein.be`)
   - **Type**: `HTTP`
   - **URL**: `app:3000`  ← de containernaam + interne poort
5. **Save**. Je publieke URL wordt dan: `https://credits.jouwdomein.be`

> De tunnel-container praat over het interne Docker-netwerk met `app:3000`. Je hoeft
> dus **geen poorten op je router open te zetten**.

---

## Stap 2 — Code en `.env` op de NAS zetten

1. Zet deze repo op de NAS (bv. in een gedeelde map `/volume1/docker/creditclub`):
   - via **Git** (Container Manager kan een project uit Git clonen), of
   - door de map te kopiëren via File Station.
2. Maak het bestand `.env` aan op basis van `.env.example` en vul in:

   ```env
   SHOPIFY_API_KEY="..."           # uit Partner Dashboard
   SHOPIFY_API_SECRET="..."        # uit Partner Dashboard
   SHOPIFY_APP_URL="https://credits.jouwdomein.be"

   POSTGRES_USER="creditclub"
   POSTGRES_PASSWORD="<sterk-wachtwoord>"
   POSTGRES_DB="creditclub"

   TUNNEL_TOKEN="<token-uit-stap-1>"
   ```

   > `SHOPIFY_API_KEY` en `SHOPIFY_API_SECRET` kun je 1-op-1 overnemen uit je huidige
   > Render-service (Environment-tab). Het zijn dezelfde app-credentials.

---

## Stap 3 — Bouwen en starten

### Via SSH (eenvoudigst)

```bash
cd /volume1/docker/creditclub

# App + database starten (tunnel blijft geparkeerd):
docker compose up -d --build
```

Bij de eerste start draait de app automatisch `prisma migrate deploy` en maakt zo de
tabellen aan in de Postgres-container.

### Via Container Manager (GUI)

- **Project** → **Create** → kies de map met `docker-compose.yml` → bouwen.
- Container Manager start standaard `db` en `app` (het `tunnel`-profiel start hij niet).

Controleer lokaal op de NAS: `http://<nas-ip>:3000/health` → je zou JSON moeten zien
met `"database": "connected (...)"`.

---

## Stap 4 — (Aanbevolen) Bestaande data overzetten van Render

Op Render staat nu een Postgres met je **sessies** (zodat de app niet opnieuw geïnstalleerd
hoeft) en je **loyalty-historiek** (`LoyaltyLog`). Zet die over zodat je niets verliest:

```bash
# 1) Dump van de Render-database (externe connection string uit Render → je Postgres → "External Connection")
pg_dump "postgresql://USER:PASS@HOST:5432/DBNAME" \
  --no-owner --no-privileges -Fc -f render-dump.dump

# 2) Restore in de NAS-container (db moet draaien):
docker compose cp render-dump.dump db:/tmp/render-dump.dump
docker compose exec db pg_restore -U creditclub -d creditclub --no-owner --clean --if-exists /tmp/render-dump.dump
```

> Ik kan je helpen de **externe connection string van je Render-Postgres** op te halen
> via de Render-integratie — vraag het gerust.

Geen migratie nodig? Dan start de app met een lege database; klanten moeten de app
opnieuw autoriseren bij eerste gebruik.

---

## Stap 5 — Shopify app-config naar je nieuwe domein (VERPLICHT)

Zolang Shopify nog naar `loyalty-credits.onrender.com` wijst, werkt er niets na het
weghalen van Render. Pas op een machine met de **Shopify CLI** (en `shopify app config link`)
de volgende bestanden aan:

**`shopify.app.toml`** — vervang overal `https://loyalty-credits.onrender.com` door je tunnel-URL:

```toml
application_url = "https://credits.jouwdomein.be"
...
redirect_urls = [ "https://credits.jouwdomein.be/auth/callback" ]
...
customer_data_request_url = "https://credits.jouwdomein.be/webhooks"
customer_deletion_url     = "https://credits.jouwdomein.be/webhooks"
shop_deletion_url         = "https://credits.jouwdomein.be/webhooks"
```

**`extensions/add-store-credit/shopify.extension.toml`** — de Flow-action `runtime_url`:

```toml
runtime_url = "https://credits.jouwdomein.be/flow-action"
```

Daarna pushen naar Shopify:

```bash
shopify app deploy
```

> **Let op:** de tunnel moet hiervoor **aan** staan (zie stap 6), anders kan Shopify de
> nieuwe URL's niet valideren.

---

## Stap 6 — Tunnel starten en parkeren

```bash
# Tunnel + app publiek zetten:
docker compose --profile tunnel up -d

# Tunnel weer parkeren (app blijft lokaal draaien):
docker compose stop cloudflared

# Controleren of de tunnel verbonden is:
docker compose logs -f cloudflared
```

Zodra de tunnel draait, test je publiek: `https://credits.jouwdomein.be/health`.

---

## Stap 7 — Van Render afhalen

Doe dit **pas nadat** de app op de NAS via de tunnel werkt én `shopify app deploy`
geslaagd is met de nieuwe URL's:

1. Open in Shopify de app en bevestig dat het admin-paneel laadt vanaf je nieuwe domein.
2. Test een betaalde order (of een Flow-actie) → controleer dat de credit wordt toegekend.
3. Pas dán: in Render de **web service** en de **Postgres** **suspenden** (eerst), en na een
   gerust gevoel **verwijderen**.

> Ik kan je via de Render-integratie helpen de service te **suspenden of verwijderen** —
> zeg maar wanneer je zover bent.

---

## Commando-spiekbriefje

| Doel | Commando |
|---|---|
| App + DB starten (geparkeerd) | `docker compose up -d --build` |
| Tunnel erbij (publiek) | `docker compose --profile tunnel up -d` |
| Tunnel parkeren | `docker compose stop cloudflared` |
| Logs app | `docker compose logs -f app` |
| Logs tunnel | `docker compose logs -f cloudflared` |
| Alles stoppen (data blijft) | `docker compose down` |
| Update na code-wijziging | `docker compose up -d --build` |
| DB-backup | `docker compose exec db pg_dump -U creditclub creditclub > backup.sql` |

De Postgres-data zit in het Docker-volume **`db-data`** en blijft bewaard bij
`docker compose down`. Pas bij `docker compose down -v` wordt het volume verwijderd.
