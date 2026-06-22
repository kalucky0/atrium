# Raport zgodności — Atrium

**Przedmiot:** weryfikacja zgodności implementacji z [`design_document.md`](./design_document.md) oraz [`adr.md`](./adr.md)
**Data:** 2026-06-25

## Wniosek ogólny

Rdzeń systemu jest **zgodny** z dokumentacją i spełnia wymagania niefunkcjonalne: gwarancja braku
double-bookingu przez constraint `EXCLUDE` w bazie, end-to-end type-safety (tRPC + type-only import
`AppRouter`), Better Auth (sesje w httpOnly cookie, `protectedProcedure`, ownership), Bun + Hono + fetch
adapter, `docker compose up` jako jedna komenda, oraz ≥ 10 testów z kluczowym constraintem testowanym na
**realnym** Postgresie.

Rozbieżności koncentrują się w trzech obszarach: **frontend (brak widoku kalendarza i typowanych search
params)**, **nazewnictwo i powierzchnia API** oraz **uproszczenia modelu danych** (twardy `DELETE` zamiast
soft-delete + `status`). Żadna z rozbieżności nie łamie kluczowej gwarancji integralności, ale część dotyczy
wprost wymagań funkcjonalnych z §2 dokumentu.

Legenda wagi: 🔴 krytyczna · 🟠 średnia · 🟡 drobna.

---

## 1. Elementy zgodne (potwierdzone w kodzie)

| Obszar | Status | Dowód |
|---|---|---|
| Constraint anty-kolizyjny `EXCLUDE USING gist (resource_id WITH =, during WITH &&)` + `btree_gist` | ✅ | `packages/db/drizzle/0001_exclusion_constraint.sql` |
| `reservation.create` wstawia bez pre-checku i mapuje Postgres `23P01` → `TRPCError CONFLICT` | ✅ | `apps/api/src/trpc/routers/reservation.ts:43-63` |
| Better Auth (adapter Drizzle, `/api/auth/*`), `createContext` czyta sesję, `protectedProcedure` → `UNAUTHORIZED`, ownership w cancel | ✅ | `apps/api/src/auth.ts`, `apps/api/src/trpc/context.ts`, `apps/api/src/trpc/trpc.ts`, `reservation.ts:67-76` |
| Bun + Hono + tRPC fetch adapter; `AppRouter` eksportowany i importowany type-only przez web | ✅ | `apps/api/src/index.ts`, `apps/web/src/lib/trpc.ts` |
| Zod jako `input` każdej procedury | ✅ | `reservation.ts:34-42`, `resource.ts:13-18` |
| `docker-compose.yml`: `db` (healthcheck + wolumen `pgdata`), `api` (czeka na zdrowy `db`, migracje → serwer), `web` (build Vite + nginx) | ✅ | `docker-compose.yml` |
| Testy: 11 przypadków; constraint testowany na **realnym** Postgresie (nie na mocku) → spełnia ≥ 10 i regułę z ADR-4/ADR-8 | ✅ | `apps/api/src/trpc/reservation.db.test.ts`, `router.test.ts` |

---

## 2. Rozbieżności

Każda pozycja: *co mówi dokument* → *co jest w kodzie (dowód `plik:linia`)* → **waga** → **rekomendacja**.

### 🔴 Krytyczne

**R1. Brak widoku kalendarza (tydzień).**
Dokument §2 (wymaganie funkcjonalne) i §8: „Widok kalendarza (tydzień) z zajętością wybranego zasobu".
W kodzie zamiast siatki tygodnia są jedynie dwa pola `datetime-local` (start/end) i tekstowa lista
rezerwacji — `apps/web/src/routes/resources/$resourceId.tsx:73-115`.
**Rekomendacja:** zaimplementować widok kalendarza tygodnia **albo** skorygować zakres w §2/§8 dokumentu.

**R2. Brak typowanych search params w URL (`?week=…&resource=…`).**
Dokument §8 oraz ADR-7 czynią z typowanych search params **główne** uzasadnienie wyboru TanStack Router
(„widok jest linkowalny i odświeżalny"). W trasach nie występuje `validateSearch`/`useSearch` — stan widoku
nie jest trzymany w URL (`apps/web/src/routes/resources/$resourceId.tsx`, `routes/__root.tsx`).
**Rekomendacja:** dodać typowane search params dla stanu kalendarza **albo** osłabić deklarację w ADR-7/§8.

### 🟠 Średnie

**R3. Brak procedury `availability.forResource`.**
Dokument §6 (tabela API): query zwracające „rezerwacje zasobu w danym zakresie dat (pod kalendarz)".
W kodzie istnieje `reservation.listByResource`, które zwraca **wszystkie** rezerwacje zasobu, bez filtra
zakresu dat — `apps/api/src/trpc/routers/reservation.ts:9-13`.
**Rekomendacja:** dodać filtr zakresu dat / dedykowaną procedurę pod kalendarz **albo** zaktualizować §6.

**R4. Nazewnictwo routerów i procedur niezgodne z powierzchnią API (§6).**
Dokument używa nazw: `resources.*`, `reservations.*`, `availability.forResource`, `reservations.mine`,
`reservations.cancel`. Implementacja (`apps/api/src/trpc/router.ts` i routery): `resource.*`,
`reservation.*` (liczba pojedyncza), `reservation.listByUser` (= „mine"), brak routera `availability`.
**Rekomendacja:** ujednolicić nazwy z dokumentem **albo** zaktualizować tabelę §6 (kontrakt API).

**R5. Model anulowania: twardy `DELETE` zamiast soft-delete + `status`.**
Dokument §4/§5/§6 + diagram ER: `reservation.status` ('active' | 'cancelled'), cancel ustawia
`status = 'cancelled'`, a constraint ma klauzulę `WHERE (status = 'active')`, dzięki czemu anulowane
zwalniają termin. W kodzie: **brak kolumny `status`**, cancel wykonuje `DELETE`
(`apps/api/src/trpc/routers/reservation.ts:67-76`), a `EXCLUDE` jest **bez** klauzuli `WHERE`
(`packages/db/drizzle/0001_exclusion_constraint.sql:7-9`).
**Uwaga:** rozwiązanie jest **wewnętrznie spójne i funkcjonalnie poprawne** — usunięty wiersz nie
uczestniczy już w constraincie, więc anulowanie realnie zwalnia slot, a gwarancja braku nakładania się
aktywnych rezerwacji jest zachowana. To **rozbieżność modelu danych**, a nie błąd integralności.
**Rekomendacja:** zaktualizować dokument do modelu hard-delete **albo** — jeśli zależy nam na historii/audycie
anulowań — wdrożyć soft-delete z kolumną `status` i `WHERE (status = 'active')` w constraincie.

**R6. Brak filtrowania listy zasobów po typie.**
Dokument §2 (wymaganie funkcjonalne): „Lista zasobów z filtrowaniem po typie". `resource.list` nie przyjmuje
żadnego inputu (`apps/api/src/trpc/routers/resource.ts:9-11`), brak też filtra w UI.
**Rekomendacja:** dodać input `type`/filtr w UI **albo** usunąć wymaganie z §2.

**R7. Brak E2E scenariusza kolizji w UI.**
Dokument §11 + ADR-8: e2e ma pokryć happy-path **oraz** scenariusz double-bookingu w UI. Istnieje wyłącznie
test smoke (signup → lista zasobów) — `apps/web/e2e/smoke.spec.ts`.
**Rekomendacja:** dopisać test Playwright odtwarzający kolizję rezerwacji w interfejsie.

### 🟡 Drobne

**R8. `resource.type` vs `resource.kind`.**
Diagram ER używa nazwy `type`; schemat bazy używa `kind` (`packages/db/src/schema.ts:21`). Funkcjonalnie
równoważne, różnica wyłącznie w nazwie.
**Rekomendacja:** ujednolicić nazewnictwo (schemat ↔ diagram).

**R9. Brak `reservation.title`.**
Pole obecne w diagramie ER, brak go w schemacie (`packages/db/src/schema.ts:26-36`).
**Rekomendacja:** dodać pole **albo** usunąć z diagramu.

**R10. Brak `resource.capacity` (int).**
Pole obecne w diagramie ER, brak go w schemacie (`packages/db/src/schema.ts:18-24`).
**Rekomendacja:** dodać pole **albo** usunąć z diagramu.

**R11. Nieudokumentowana powierzchnia API + brak ról.**
Implementacja dodaje pełny CRUD zasobów (`resource.create/update/delete`, `apps/api/src/trpc/routers/resource.ts:20-53`)
spoza tabeli §6; każdy zalogowany użytkownik może tworzyć/edytować/usuwać zasoby, choć §1 wyklucza role
administracyjne z zakresu.
**Rekomendacja:** udokumentować te procedury i rozważyć ograniczenie uprawnień **albo** oznaczyć jako celowo
poza zakresem.

**R12. Seed nieuruchamiany automatycznie w `docker compose`.**
Dokument §10: „Skrypt `seed` wypełnia bazę przykładowymi zasobami i rezerwacjami do demo". Usługa `api`
w compose uruchamia tylko `migrate.ts && index.ts` — seed trzeba odpalić ręcznie (w compose używa go
wyłącznie konfiguracja Playwrighta).
**Rekomendacja:** dodać krok seed do compose (np. dla profilu demo) **albo** dopisać w §10, że seed jest ręczny.

**R13. `resource.list` jako `protectedProcedure` (rozstrzygnięcie niejednoznaczności).**
Dokument §6 podaje „publiczna/chroniona" (niejednoznacznie). Wybrano wariant chroniony, co jest spójne
z „aplikacja w całości za logowaniem" (ADR-7). **To nie jest realna rozbieżność** — odnotowane dla
kompletności; warto doprecyzować §6.

---

## 3. Podsumowanie

| # | Rozbieżność | Waga | Kierunek naprawy |
|---|---|---|---|
| R1 | Brak widoku kalendarza (tydzień) | 🔴 | kod |
| R2 | Brak typowanych search params w URL | 🔴 | kod |
| R3 | Brak `availability.forResource` (jest `listByResource` bez filtra dat) | 🟠 | kod |
| R4 | Nazewnictwo routerów/procedur (`resource`/`reservation`, `listByUser`) | 🟠 | kod |
| R5 | Twardy `DELETE` zamiast soft-delete + `status` (constraint bez `WHERE`) | 🟠 | dokument |
| R6 | Brak filtrowania listy zasobów po typie | 🟠 | kod |
| R7 | Brak E2E scenariusza kolizji w UI | 🟠 | kod |
| R8 | `type` vs `kind` | 🟡 | dokument |
| R9 | Brak `reservation.title` | 🟡 | kod |
| R10 | Brak `resource.capacity` | 🟡 | kod |
| R11 | Nieudokumentowany CRUD zasobów + brak ról | 🟡 | dokument |
| R12 | Seed nieuruchamiany automatycznie w compose | 🟡 | kod |
| R13 | `resource.list` chroniona (niejednoznaczność §6) | 🟡 | dokument |

**Bilans:** rdzeń domenowy (integralność, auth, type-safety, konteneryzacja, testy) — zgodny. Główny dług
zgodności leży po stronie **frontendu (R1, R2)** oraz **kontraktu/modelu API (R3–R5)**. Pozostałe pozycje to
porządki w dokumencie lub drobne uzupełnienia schematu.
