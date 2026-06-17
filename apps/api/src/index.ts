import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "./auth";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const app = new Hono();

app.use("*", cors({ origin: WEB_ORIGIN, credentials: true }));

app.get("/health", (c) => c.json({ ok: true }));

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use("/trpc/*", (c) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError: ({ error, path }) => console.error(`tRPC ${path ?? "<root>"}:`, error.message),
  }),
);

export type { AppRouter } from "./trpc/router";

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
};
