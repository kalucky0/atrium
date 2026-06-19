import { sql } from "drizzle-orm";
import { db } from "./index";
import { reservation, resource, user } from "./schema";

const existing = await db.select().from(resource).limit(1);
if (existing.length > 0) {
  console.log("resource table not empty — skipping seed");
  process.exit(0);
}

const rows = [
  { name: "Sala konferencyjna A", kind: "room", description: "Rzutnik, 12 miejsc" },
  { name: "Sala konferencyjna B", kind: "room", description: "8 miejsc" },
  { name: "Projektor Epson", kind: "equipment", description: "Przenośny, HDMI" },
  { name: "Laptop Dell", kind: "equipment", description: null },
];

const resources = await db.insert(resource).values(rows).returning();
console.log(`seeded ${resources.length} resources`);

const [demo] = await db
  .insert(user)
  .values({ id: "demo-user", name: "Demo", email: "demo@atrium.local" })
  .returning();

const slot = (resourceId: string, start: string, end: string) => ({
  resourceId,
  userId: demo.id,
  during: sql`tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)')`,
});

await db.insert(reservation).values([
  slot(resources[0].id, "2026-06-26 09:00+00", "2026-06-26 10:00+00"),
  slot(resources[0].id, "2026-06-26 11:00+00", "2026-06-26 12:00+00"),
  slot(resources[2].id, "2026-06-26 14:00+00", "2026-06-26 15:30+00"),
]);
console.log("seeded 1 demo user + 3 reservations");
process.exit(0);
