import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./router";
import type { Context } from "./context";

function ctx(user: Context["user"]): Context {
  return {
    db: {} as Context["db"],
    user,
    session: null,
    resHeaders: new Headers(),
  };
}

describe("protectedProcedure auth gate", () => {
  it("rejects an unauthenticated call with UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(ctx(null));
    await expect(caller.resource.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("zod input validation", () => {
  it("rejects resource.byId with a non-uuid id", async () => {
    const caller = appRouter.createCaller(ctx({ id: "u1" } as Context["user"]));
    await expect(caller.resource.byId({ id: "not-a-uuid" })).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects reservation.create when start >= end", async () => {
    const caller = appRouter.createCaller(ctx({ id: "u1" } as Context["user"]));
    const t = new Date();
    await expect(
      caller.reservation.create({
        resourceId: "00000000-0000-0000-0000-000000000000",
        start: t,
        end: t,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  // drizzle 0.45 wraps the postgres error in DrizzleQueryError, so the 23P01
  // SQLSTATE lands on .cause — the catch must look there, not just the top level.
  it("maps a 23P01 exclusion violation to CONFLICT", async () => {
    const conflictDb = {
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw { cause: { code: "23P01" } };
          },
        }),
      }),
    } as unknown as Context["db"];
    const caller = appRouter.createCaller({
      ...ctx({ id: "u1" } as Context["user"]),
      db: conflictDb,
    });
    await expect(
      caller.reservation.create({
        resourceId: "00000000-0000-0000-0000-000000000000",
        start: new Date(2026, 0, 1, 9),
        end: new Date(2026, 0, 1, 10),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
