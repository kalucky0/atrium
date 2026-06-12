-- Anti-double-booking: no two reservations for the same resource may have
-- overlapping time ranges. Not expressible in the Drizzle builder, so it lives
-- as this hand-written migration. btree_gist lets a GiST EXCLUDE index combine
-- the equality op (=) on resource_id with the range-overlap op (&&) on during.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (resource_id WITH =, during WITH &&);
