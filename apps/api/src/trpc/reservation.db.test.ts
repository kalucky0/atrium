import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { inArray, sql } from "drizzle-orm";
import { appRouter } from "./router";
import type { Context } from "./context";

const url = process.env.DATABASE_URL;

type DbModule = typeof import("@atrium/db");
let mod: DbModule | undefined;
let dbUp = false;
if (url) {
  try {
    mod = await import("@atrium/db");
    await mod.db.execute(sql`select 1`);
    dbUp = true;
  } catch {
    dbUp = false;
  }
}

const USER_A = "test-user-a";
const USER_B = "test-user-b";

describe.skipIf(!dbUp)("reservation flow (real Postgres)", () => {
  const createdResources: string[] = [];

  const caller = (userId: string) =>
    appRouter.createCaller({
      db: mod!.db,
      user: { id: userId } as Context["user"],
      session: null,
      resHeaders: new Headers(),
    });

  async function makeResource() {
    const name = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [r] = await mod!.db.insert(mod!.resource).values({ name, kind: "room" }).returning();
    createdResources.push(r!.id);
    return r!.id;
  }

  const at = (iso: string) => new Date(iso);

  beforeAll(async () => {
    await migrate(mod!.db, {
      migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
    });
    await mod!.db
      .insert(mod!.user)
      .values([
        { id: USER_A, name: "A", email: "a@test.local" },
        { id: USER_B, name: "B", email: "b@test.local" },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await mod!.db.delete(mod!.user).where(inArray(mod!.user.id, [USER_A, USER_B]));
    if (createdResources.length)
      await mod!.db.delete(mod!.resource).where(inArray(mod!.resource.id, createdResources));
  });

  it("creates a reservation", async () => {
    const rid = await makeResource();
    const row = await caller(USER_A).reservations.create({
      resourceId: rid,
      start: at("2026-03-01T09:00:00Z"),
      end: at("2026-03-01T10:00:00Z"),
    });
    expect(row?.id).toBeTruthy();
  });

  it("rejects an overlapping reservation with CONFLICT", async () => {
    const rid = await makeResource();
    const c = caller(USER_A);
    await c.reservations.create({
      resourceId: rid,
      start: at("2026-03-02T09:00:00Z"),
      end: at("2026-03-02T10:00:00Z"),
    });
    await expect(
      c.reservations.create({
        resourceId: rid,
        start: at("2026-03-02T09:30:00Z"),
        end: at("2026-03-02T10:30:00Z"),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows a back-to-back reservation (half-open [) range)", async () => {
    const rid = await makeResource();
    const c = caller(USER_A);
    await c.reservations.create({
      resourceId: rid,
      start: at("2026-03-03T09:00:00Z"),
      end: at("2026-03-03T10:00:00Z"),
    });
    const row = await c.reservations.create({
      resourceId: rid,
      start: at("2026-03-03T10:00:00Z"),
      end: at("2026-03-03T11:00:00Z"),
    });
    expect(row?.id).toBeTruthy();
  });

  it("cancels the caller's own reservation", async () => {
    const rid = await makeResource();
    const c = caller(USER_A);
    const row = await c.reservations.create({
      resourceId: rid,
      start: at("2026-03-04T09:00:00Z"),
      end: at("2026-03-04T10:00:00Z"),
    });
    await c.reservations.cancel({ id: row!.id });
    const after = await c.availability.forResource({
      resourceId: rid,
      from: at("2026-01-01T00:00:00Z"),
      to: at("2027-01-01T00:00:00Z"),
    });
    expect(after.find((r) => r.id === row!.id)).toBeUndefined();
  });

  it("won't cancel another user's reservation (NOT_FOUND, row remains)", async () => {
    const rid = await makeResource();
    const row = await caller(USER_A).reservations.create({
      resourceId: rid,
      start: at("2026-03-05T09:00:00Z"),
      end: at("2026-03-05T10:00:00Z"),
    });
    await expect(caller(USER_B).reservations.cancel({ id: row!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const after = await caller(USER_A).availability.forResource({
      resourceId: rid,
      from: at("2026-01-01T00:00:00Z"),
      to: at("2027-01-01T00:00:00Z"),
    });
    expect(after.find((r) => r.id === row!.id)).toBeDefined();
  });

  it("mine returns only the caller's reservations", async () => {
    const rid = await makeResource();
    const bRow = await caller(USER_B).reservations.create({
      resourceId: rid,
      start: at("2026-03-06T11:00:00Z"),
      end: at("2026-03-06T12:00:00Z"),
    });
    const aRow = await caller(USER_A).reservations.create({
      resourceId: rid,
      start: at("2026-03-06T09:00:00Z"),
      end: at("2026-03-06T10:00:00Z"),
    });
    const ids = (await caller(USER_B).reservations.mine()).map((r) => r.id);
    expect(ids).toContain(bRow!.id);
    expect(ids).not.toContain(aRow!.id);
  });

  it("availability.forResource returns only reservations overlapping the window", async () => {
    const rid = await makeResource();
    const c = caller(USER_A);
    const inside = await c.reservations.create({
      resourceId: rid,
      start: at("2026-03-09T09:00:00Z"),
      end: at("2026-03-09T10:00:00Z"),
      title: "W oknie",
    });
    const outside = await c.reservations.create({
      resourceId: rid,
      start: at("2026-03-20T09:00:00Z"),
      end: at("2026-03-20T10:00:00Z"),
    });
    const week = await c.availability.forResource({
      resourceId: rid,
      from: at("2026-03-09T00:00:00Z"),
      to: at("2026-03-16T00:00:00Z"),
    });
    const ids = week.map((r) => r.id);
    expect(ids).toContain(inside!.id);
    expect(ids).not.toContain(outside!.id);
    expect(week.find((r) => r.id === inside!.id)?.title).toBe("W oknie");
  });
});
