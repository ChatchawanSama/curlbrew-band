import { z } from "zod";

export const requestInput = z.object({ songId: z.string().uuid(), nickname: z.string().trim().min(1).max(40) });
export const controlInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("reject"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("play"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("remove"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("finish"), requestId: z.string().uuid(), outcome: z.enum(["done", "skipped"]) }),
  z.object({ action: z.literal("toggle-requests") }),
  z.object({ action: z.literal("end-session") }),
]);
