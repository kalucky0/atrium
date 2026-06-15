import { customType, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

// Postgres tstzrange has no built-in Drizzle type — declare it via customType.
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tstzrange";
  },
});

export const resource = pgTable("resource", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("room"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reservation = pgTable("reservation", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id")
    .notNull()
    .references(() => resource.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  during: tstzrange("during").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The anti-double-booking EXCLUDE constraint on (resource_id, during) is NOT
// expressible in the Drizzle builder — it is added as a hand-written SQL
// migration in Phase 3 (see drizzle/*_exclusion*.sql). drizzle-kit diffs the
// schema against its own snapshots (not the live DB), so it will not drop it.
