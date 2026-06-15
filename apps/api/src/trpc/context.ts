import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { db } from "@atrium/db";
import { auth } from "../auth";

export async function createContext(opts: FetchCreateContextFnOptions) {
  const data = await auth.api.getSession({ headers: opts.req.headers });
  return {
    db,
    user: data?.user ?? null,
    session: data?.session ?? null,
    resHeaders: opts.resHeaders,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
