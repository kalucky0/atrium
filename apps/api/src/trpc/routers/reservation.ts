import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { reservation, resource } from "@atrium/db/schema";
import { protectedProcedure, router } from "../trpc";

export const reservationRouter = router({
  listByResource: protectedProcedure
    .input(z.object({ resourceId: z.uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.select().from(reservation).where(eq(reservation.resourceId, input.resourceId)),
    ),

  listByUser: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: reservation.id,
        during: reservation.during,
        resourceId: reservation.resourceId,
        resourceName: resource.name,
      })
      .from(reservation)
      .innerJoin(resource, eq(reservation.resourceId, resource.id))
      .where(eq(reservation.userId, ctx.user.id))
      .orderBy(reservation.createdAt),
  ),

  // Insert relies on the EXCLUDE constraint (reservation_no_overlap) to reject
  // overlaps atomically — no read-then-write race. '[)' (half-open) matches the
  // constraint, so back-to-back slots (end == next start) don't collide.
  create: protectedProcedure
    .input(
      z
        .object({
          resourceId: z.uuid(),
          start: z.date(),
          end: z.date(),
        })
        .refine((v) => v.start < v.end, { message: "start musi być przed end", path: ["end"] }),
    )
    .mutation(async ({ ctx, input }) => {
      // Pass ISO strings + explicit ::timestamptz cast: postgres-js can't bind a
      // raw Date as a parameter inside a sql`` fragment, and an uncast text param
      // wouldn't resolve tstzrange(timestamptz, timestamptz, text).
      const during = sql`tstzrange(${input.start.toISOString()}::timestamptz, ${input.end.toISOString()}::timestamptz, '[)')`;
      try {
        const [row] = await ctx.db
          .insert(reservation)
          .values({ resourceId: input.resourceId, userId: ctx.user.id, during })
          .returning();
        return row;
      } catch (e) {
        // Postgres 23P01 = exclusion_violation -> termin zajęty. drizzle 0.45 wraps
        // driver errors in DrizzleQueryError, so the SQLSTATE sits on .cause.
        const code =
          (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
        if (code === "23P01")
          throw new TRPCError({ code: "CONFLICT", message: "Termin jest już zajęty" });
        throw e;
      }
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .delete(reservation)
        .where(and(eq(reservation.id, input.id), eq(reservation.userId, ctx.user.id)))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Nie znaleziono rezerwacji" });
      return { id: row.id };
    }),
});
