import { z } from "zod";
import { eq } from "drizzle-orm";
import { resource } from "@atrium/db";
import { protectedProcedure, router } from "../trpc";

export const resourceRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.select().from(resource).orderBy(resource.createdAt),
  ),

  byId: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(resource).where(eq(resource.id, input.id));
      return row ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        kind: z.string().min(1).default("room"),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(resource).values(input).returning();
      return row;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).optional(),
        kind: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const [row] = await ctx.db.update(resource).set(patch).where(eq(resource.id, id)).returning();
      return row ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(resource).where(eq(resource.id, input.id));
      return { id: input.id };
    }),
});
