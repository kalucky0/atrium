import { db } from "./index";
import { resource } from "./schema";

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

await db.insert(resource).values(rows);
console.log(`seeded ${rows.length} resources`);
process.exit(0);
