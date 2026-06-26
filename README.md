# Atrium

Szkielet webowej aplikacji do rezerwacji sal/sprzętu (modularny monolit, monorepo Bun).

## Stack

| Warstwa | Technologia |
|---|---|
| Monorepo / runtime | Bun workspaces, Bun 1.3 |
| HTTP | Hono 4 |
| API | tRPC v11 (fetch adapter) + Zod 4 + superjson |
| Auth | Better Auth 1.6 (Drizzle adapter `provider: "pg"`, email+hasło, sesje w cookies) |
| Baza | PostgreSQL 17 |
| ORM / migracje | Drizzle ORM 0.45 + drizzle-kit 0.31 (driver `postgres` / postgres-js) |
| Frontend | React 19 + Vite 8 (SPA) |
| Routing | TanStack Router 1 (file-based) |
| Server-state | TanStack Query 5 (`@trpc/react-query`) |
| Testy | Vitest 3 (unit) + Playwright 1 (e2e) |
| Konteneryzacja | Docker + docker-compose |

## Struktura

```
atrium/
├─ docker-compose.yml         # db + api + web
├─ .env.example
├─ packages/db/               # Drizzle: schema, klient, migracje, seed
│  ├─ src/schema.ts           #   resource, reservation, re-eksport auth-schema
│  ├─ src/auth-schema.ts      #   tabele Better Auth (user/session/account/verification)
│  ├─ src/index.ts            #   klient drizzle (postgres-js)
│  ├─ src/migrate.ts          #   programatyczny migrator
│  ├─ src/seed.ts
│  └─ drizzle/                #   migracje SQL (0000–0003; 0001 = ręczny EXCLUDE,
│                             #     0003 = reservation.title + resource.capacity)
└─ apps/
   ├─ api/                    # Hono + tRPC + Better Auth
   │  └─ src/trpc/routers/    #   resources (CRUD) / reservations (create/cancel/mine)
   │                          #     / availability (forResource - pod kalendarz)
   └─ web/                    # React + Vite + TanStack Router/Query
      └─ src/routes/          #   login, resources (lista+filtr+create), resources/$id
                              #     (kalendarz tygodnia), my-reservations
```

## Uruchomienie

Wymagania: **Docker** (z Docker Compose) oraz **Bun** (do trybu deweloperskiego).

```bash
cp .env.example .env        # uzupełnij sekrety; do dev wartości domyślne wystarczą
```

### Wariant A - całość w Dockerze

```bash
docker compose up -d --build
```

- Web: <http://localhost:5173>
- API: <http://localhost:3001> (zdrowie: `/health`)
- Start usługi `api` uruchamia kolejno `migrate -> seed -> serwer`, więc migracje (w tym
  constraint `EXCLUDE`) i **dane demo** (kilka zasobów + przykładowe rezerwacje) są gotowe
  automatycznie. Seed jest idempotentny - pomija niepustą bazę.

Zatrzymanie: `docker compose down` (dane w wolumenie `pgdata` zostają).

### Wariant B - dev (baza w Dockerze, aplikacje lokalnie)

```bash
docker compose up -d db          # sam Postgres
bun install
bun run db:migrate               # migracje (w tym constraint EXCLUDE)
bun run db:seed                  # opcjonalne dane demo
bun run dev:api                  # API na :3001 (hot reload)
bun run dev:web                  # Vite na :5173
```

## Testy

```bash
bun run test                     # Vitest (apps/api). Test integracyjny rezerwacji (kolizja
                                 #   EXCLUDE, cancel, ownership) wymaga bazy - bez niej pomija się
                                 #   automatycznie. Aby go odpalić: docker compose up -d db + db:migrate.
bunx playwright install chromium # jednorazowo, przed e2e
bun run test:e2e                 # Playwright: smoke (signup -> lista) + collision
                                 #   (podwójna rezerwacja -> "Termin jest już zajęty")
```

CI: `.github/workflows/ci.yml` przy każdym pushu/PR uruchamia `typecheck` oraz `bun run test`
na realnym Postgresie (serwis w workflow), więc odpala się też test integracyjny constraintu.

## Baza danych

- `resource` i `reservation` w `packages/db/src/schema.ts`. `reservation.during` to `tstzrange`
  (typ własny przez `customType`, brak natywnego wsparcia w builderze Drizzle).
- **Anty-double-booking**: migracja `drizzle/0001_exclusion_constraint.sql` zakłada
  `CREATE EXTENSION btree_gist` oraz `EXCLUDE USING gist (resource_id WITH =, during WITH &&)`
  na `reservation`. Dwie nakładające się rezerwacje tego samego zasobu są odrzucane (Postgres `23P01`).
- Tabele auth (`user`/`session`/`account`/`verification`) należą do **Better Auth**; domena
  referuje do `user.id`.
- Nowa migracja: edytuj schema -> `bun run db:generate` -> `bun run db:migrate`.

## TODO

Zostawione do implementacji:

- **Sekrety produkcyjne** - przed wdrożeniem ustaw realny `BETTER_AUTH_SECRET`
  (`openssl rand -base64 32`); domyślna wartość w `.env.example`/compose jest tylko do dev/demo.

Widok kalendarza tygodnia (siatka, klik-aby-zarezerwować/anulować) oraz typowane search params
(`?week=`, `?kind=`) są już zaimplementowane - `apps/web/src/routes/resources/$resourceId.tsx`,
`apps/web/src/lib/week.ts`.

## Odstępstwa od pierwotnej specyfikacji

Wymuszone aktualnym API bibliotek lub środowiskiem (stan na 2026-06-21):

- **Port API = 3001** (nie 3000): 3000 jest na tej maszynie zajęty przez kontener innego projektu.
- **Schemat Better Auth napisany ręcznie** (`packages/db/src/auth-schema.ts`) zgodnie z formatem
  generatora 1.6.x. CLI (`bun run --filter @atrium/api auth:generate`) nie buduje swojej natywnej
  zależności `better-sqlite3` na Node 26 bez Pythona - skrypt zostaje do regeneracji w CI/na maszynie
  z toolchainem.
- **Adapter Drizzle** importowany z subpath `better-auth/adapters/drizzle`; jeden driver
  Postgres (`postgres`/postgres-js) dla aplikacji i auth (`provider: "pg"` to dialekt, nie driver).
- **tRPC v11**: transformer (`superjson`) na linku (klient) i w `initTRPC.create` (serwer);
  montaż w Hono przez `fetchRequestHandler` (bez `@hono/trpc-server`). CORS globalny w Hono
  (Better Auth sam nie emituje nagłówków CORS ani nie obsługuje preflightu).
- **TanStack Router**: plugin `@tanstack/router-plugin/vite` przed `react()`; `routeTree.gen.ts`
  jest generowany i gitignorowany.
