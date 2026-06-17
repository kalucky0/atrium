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
});
