# Architecture Decision Record (ADR)

**Projekt:** Atrium *(system rezerwacji sal / sprzętu z kalendarzem)*
**Przedmiot:** Projektowanie Aplikacji Internetowych (PAI 2025/2026)

> Każdy wpis ma format: **Decyzja · Kontekst · Alternatywy · Uzasadnienie · Trade-offy**.
> Wpisy ADR-9 i ADR-10 opisują decyzje *negatywne* (czego świadomie nie dodaliśmy).

---

## ADR-1 — TypeScript end-to-end w jednym monorepo

| Pole | Treść |
|---|---|
| **Decyzja** | Cały kod (frontend + backend + warstwa danych) w TypeScript, w jednym monorepo opartym o Bun workspaces. |
| **Kontekst** | Zespół 2–3 os. pracujący jednocześnie nad frontendem i backendem. Chcemy minimalizować przełączanie kontekstu i błędy na granicy klient–serwer. |
| **Alternatywy** | Oddzielne języki (np. Python/FastAPI na backendzie + TS na froncie); architektura polyrepo. |
| **Uzasadnienie** | Jeden język = jeden model mentalny i możliwość współdzielenia typów. To warunek wstępny dla tRPC, które daje typowany kontrakt API bez code generation. W małym zespole redukuje narzut narzędziowy. |
| **Trade-offy** | Zamykamy się na ekosystem JS/TS — rezygnujemy z dojrzałości narzędzi typu Pydantic/SQLAlchemy. Monorepo wymaga konfiguracji workspace i dyscypliny w pilnowaniu granic pakietów. |

## ADR-2 — tRPC jako warstwa API

| Pole | Treść |
|---|---|
| **Decyzja** | tRPC jako warstwa komunikacji klient–serwer (zamiast REST lub GraphQL). |
| **Kontekst** | Frontend i backend są w jednym repo w TypeScript. Potrzebujemy type-safe kontraktu, który nie wymaga ręcznego utrzymywania typów po stronie klienta. |
| **Alternatywy** | REST + OpenAPI (natywny HTTP caching, największy ekosystem, ale codegen lub ręczne typy); GraphQL (elastyczny dobór pól, ale narzut DataLoaderów i schematu przy małej liczbie widoków). |
| **Uzasadnienie** | End-to-end type safety „za darmo": zmiana procedury serwerowej jest natychmiast widoczna w typach klienta. Domena jest prosta i ma niewiele endpointów, więc elastyczność GraphQL nie jest nam potrzebna. |
| **Trade-offy** | Zamknięcie na TypeScript po obu stronach. Brak natywnego HTTP cachingu (komunikacja idzie przez `POST`). tRPC nie jest standardem branżowym jak REST, więc trudniej byłoby wystawić publiczne API dla zewnętrznych klientów. |

## ADR-3 — PostgreSQL + Drizzle

| Pole | Treść |
|---|---|
| **Decyzja** | PostgreSQL jako baza danych, Drizzle jako ORM i narzędzie migracji. |
| **Kontekst** | Domena rezerwacji wymaga silnych gwarancji integralności (patrz ADR-4) oraz typowanych, wersjonowanych migracji (R2). |
| **Alternatywy** | MySQL (brak natywnego typu zakresowego i `EXCLUDE`); MongoDB (model dokumentowy słabo pasuje do gwarancji na kolizje rezerwacji); Prisma (cięższy, bardziej „magiczny", dalej od SQL-a niż Drizzle). |
| **Uzasadnienie** | Postgres oferuje typ `tstzrange` i constraint `EXCLUDE USING gist`, które są fundamentem ADR-4. Drizzle jest blisko SQL-a (łatwo sięgnąć po niestandardowe konstrukcje) i daje typowane migracje generowane ze schematu. |
| **Trade-offy** | Wiążemy się z Postgresem — kluczowe mechanizmy integralności są nieprzenośne na inne bazy. Drizzle jest młodszy i ma mniejszy ekosystem niż Prisma. |

## ADR-4 — Integralność rezerwacji wymuszana w bazie (`EXCLUDE`), nie w aplikacji

| Pole | Treść |
|---|---|
| **Decyzja** | Brak nakładających się rezerwacji tego samego zasobu wymuszamy constraintem bazodanowym `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (status = 'active')`, a nie sprawdzeniem w kodzie aplikacji. |
| **Kontekst** | Najważniejszy problem domenowy to *double-booking*: dwie osoby próbują zarezerwować ten sam zasób w nakładających się przedziałach czasu, potencjalnie w tej samej chwili (race condition). |
| **Alternatywy** | Sprawdzenie kolizji w kodzie przed zapisem (podatne na race condition między odczytem a zapisem); pessimistic locking (`SELECT ... FOR UPDATE`); optimistic locking z wersją wiersza. |
| **Uzasadnienie** | Constraint w bazie jest atomowy i odporny na współbieżność z definicji — niemożliwe jest wstawienie kolidującego wiersza niezależnie od liczby równoczesnych transakcji. Eliminuje całą klasę błędów zamiast łatać ją w warstwie aplikacji. Warunek `WHERE status = 'active'` sprawia, że anulowane rezerwacje nie blokują terminu. |
| **Trade-offy** | Logika integralności „ucieka" do bazy → trudniej pokryć ją czystymi testami jednostkowymi (potrzebne testy integracyjne na realnym Postgresie). Wymaga rozszerzenia `btree_gist` i ręcznej migracji SQL (Drizzle nie wyraża `EXCLUDE` w builderze schematu). Naruszenie constraintu (błąd Postgresa `23P01`) trzeba przechwycić i zmapować na czytelny błąd `CONFLICT` w tRPC. |

## ADR-5 — Bun (runtime) + Hono (warstwa HTTP)

| Pole | Treść |
|---|---|
| **Decyzja** | Bun jako runtime backendu, Hono jako cienka warstwa HTTP, tRPC podpięte przez fetch adapter. |
| **Kontekst** | tRPC pełni rolę warstwy routingu, więc framework backendowy odpowiada tylko za serwer HTTP i middleware (CORS, cookies). Chcemy czegoś lekkiego, ale nie „gołego". |
| **Alternatywy** | Node + Fastify (najdojrzalsze, cięższe); Node + Express („popularne" nie jest uzasadnieniem); goły `Bun.serve` (CORS/cookies trzeba pisać ręcznie); NestJS (DI/dekoratory = over-engineering przy tej skali). |
| **Uzasadnienie** | Bun daje natywny TS, szybki start i wbudowane narzędzia (test runner, obsługa `.env`), redukując liczbę zależności. Hono oddaje lekkie middleware bez wagi Express/Fastify, a jego fetch-standardowe handlery pasują do fetch adaptera tRPC i Better Auth — abstrakcja jest spójna z resztą stacku. |
| **Trade-offy** | Bun to młodszy ekosystem o wyższej wariancji (ryzyko niezgodności bibliotek). **Hono ogranicza to ryzyko: ewentualna migracja na Node jest tania — zmiana entrypointu, nie przepisanie aplikacji.** Przenośność dotyczy warstwy HTTP, nie całej apki: driver Postgresa, entrypoint i test runner pozostają runtime-specyficzne. |

## ADR-6 — Autentykacja: Better Auth (sesje w cookies)

| Pole | Treść |
|---|---|
| **Decyzja** | Better Auth jako biblioteka autentykacji, z adapterem Drizzle i sesjami przechowywanymi w httpOnly cookies. |
| **Kontekst** | R4 wymaga logowania i ochrony endpointów rezerwacji. Mamy jeden serwer, który kontrolujemy — nie potrzebujemy stateless tokenów. |
| **Alternatywy** | **Lucia** — pierwotny wybór, ale od marca 2025 zdeprecjonowana jako biblioteka (jest teraz materiałem edukacyjnym, nie paczką npm); JWT (stateless, ale trudna rewokacja i ryzyko XSS przy tokenie w `localStorage`); Auth.js / NextAuth (mocno zorientowane na Next.js, mniej czyste poza nim); własna implementacja sesji od zera. |
| **Uzasadnienie** | Better Auth jest framework-agnostyczny i TypeScript-native, ma gotowy adapter Drizzle (`provider: "pg"`) i montuje się w Hono jednym catch-all routem (`/api/auth/*`). Domyślnie używa sesji w cookies — co realizuje nasze pierwotne założenie (łatwa rewokacja, httpOnly odporne na odczyt przez XSS) bez pisania auth od zera. Sprawdzanie sesji wpinamy w `createContext` tRPC (`protectedProcedure`). |
| **Trade-offy** | Better Auth jest właścicielem tabel `user`/`session`/`account` — nasza domena nie tworzy własnego modelu użytkownika, tylko referuje `reservation.userId → user.id`. Dokładamy zależność i jej schemat (generowany przez CLI). Stan sesji w bazie utrudnia bezstanowe skalowanie poziome — przy naszej skali nieistotne. |

## ADR-7 — Frontend: React + Vite + TanStack Router + TanStack Query

| Pole | Treść |
|---|---|
| **Decyzja** | React jako SPA (build Vite), TanStack Router do routingu, TanStack Query do zarządzania server-state. |
| **Kontekst** | Widok kalendarza ma złożony stan po stronie klienta (wybrany tydzień, zakres dat, filtry zasobów). Dostępność slotów to *server-state*, który zmienia się niezależnie od użytkownika (ktoś inny może zająć slot). |
| **Alternatywy** | Next.js (SSR, ale własny router kolidujący z TanStack Router, a SSR jest zbędny — apka w całości za logowaniem); Vue/Svelte; React Router (domyślny, ale słabsze typowanie search params); Redux/Zustand do danych z serwera. |
| **Uzasadnienie** | TanStack Query zarządza server-state: po mutacji unieważnia zapytanie o dostępność i kalendarz odświeża się sam; kontrola świeżości przez `staleTime`. Jest też kanonicznym klientem tRPC. TanStack Router daje **typowane search params**, idealne do trzymania stanu kalendarza w URL (`?week=2026-W26&resource=3`). Całość domyka motyw type-safety od bazy po URL. |
| **Trade-offy** | TanStack Router jest młodszy niż React Router (krzywa uczenia, mniejszy ekosystem). SPA = brak SSR/SEO, co akceptujemy, bo aplikacja jest za logowaniem. |

## ADR-8 — Testy: Vitest + Playwright

| Pole | Treść |
|---|---|
| **Decyzja** | Vitest do testów jednostkowych i integracyjnych, Playwright do testów e2e. |
| **Kontekst** | Wymagane min. 10 testów na kluczowej logice. Krytyczna logika to wykrywanie kolizji rezerwacji i transakcyjny zapis. |
| **Alternatywy** | Wbudowany test runner Bun (zero-config, szybki, natywny dla runtime); Jest (wolniejszy, konfiguracja ESM/TS); Cypress (cięższy niż Playwright). |
| **Uzasadnienie** | Vitest jest Vite-native → współdzieli konfigurację i model z frontendem, czyli jedno narzędzie testowe w całym monorepo; API zgodne z Jest, dobre mockowanie i coverage. Testy integracyjne backendu uderzają w realny Postgres (kontener z docker-compose), więc weryfikują faktyczny constraint z ADR-4, a nie mock. Playwright pokrywa krytyczny scenariusz e2e: rezerwacja slotu i próba double-bookingu w UI. |
| **Trade-offy** | Vitest celuje głównie w tooling Node — część testów backendu na Bun może wymagać uruchamiania pod Node lub świadomego wyboru runnera. Wbudowany runner Bun byłby szybszy i bezkonfiguracyjny, ale rozjechałby narzędzia front/back. Świadomie wybieramy spójność (jedno narzędzie) kosztem natywnej prędkości Bun. |

## ADR-9 — Modularny monolit zamiast mikroserwisów *(decyzja negatywna)*

| Pole | Treść |
|---|---|
| **Decyzja** | Backend jako jeden modularny monolit. **Nie** wprowadzamy mikroserwisów, message brokera (Kafka/RabbitMQ) ani osobnych serwisów komunikujących się po sieci. |
| **Kontekst** | Domena ma trzy główne zasoby (użytkownik, zasób, rezerwacja) i prostą logikę. Pojawia się pokusa „dojrzałej" architektury rozproszonej. |
| **Alternatywy** | Architektura mikroserwisowa; event-driven z brokerem komunikatów. |
| **Uzasadnienie** | Przy tej skali rozbicie na serwisy dodaje złożoność operacyjną (sieć, spójność rozproszona, deployment) bez żadnej korzyści. Regulamin wprost premiuje prostotę i uzasadnianie, czego **nie** dodano. Monolit z czytelnym podziałem na moduły w pełni wystarcza i jest łatwiejszy do uruchomienia jedną komendą (R5). |
| **Trade-offy** | Brak niezależnego skalowania i deploymentu poszczególnych części. Akceptowalne — aplikacja nie ma wymagań skali, które by to uzasadniały. |

## ADR-10 — Brak deploymentu na edge (Workers / Hyperdrive) *(decyzja negatywna)*

| Pole | Treść |
|---|---|
| **Decyzja** | Aplikację uruchamiamy klasycznie (docker-compose, jeden host), z Postgresem po TCP. **Nie** celujemy w deployment na edge (Cloudflare Workers / Workerd). |
| **Kontekst** | Hono jest multi-runtime, więc kuszące jest deklarowanie „a potem przeniesiemy na edge". Sprawdziliśmy konsekwencje dla naszej warstwy danych. |
| **Alternatywy** | Deployment na Cloudflare Workers z Hyperdrive (pooling TCP) lub z driverem HTTP do Postgresa. |
| **Uzasadnienie** | Edge wymagałby albo vendor-specyficznej infrastruktury (Hyperdrive), albo drivera HTTP, który jest single-shot i **łamie nasz interaktywno-transakcyjny model rezerwacji** z ADR-4. Przy R5 = docker-compose na jednym hoście to złożoność i lock-in za zero korzyści. Przenośność Hono traktujemy jako ubezpieczenie ryzyka runtime (ADR-5), nie jako cel deploymentowy. |
| **Trade-offy** | Rezygnujemy z potencjalnej niskiej latencji globalnej i skalowania na edge. Nieistotne dla aplikacji, której użytkownicy są zlokalizowani i która działa za logowaniem. |