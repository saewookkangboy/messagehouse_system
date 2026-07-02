import { z } from "zod";

export const RetrievedChunkSchema = z.object({
  filename: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1),
  score: z.number(),
  source: z.enum(["pack", "org_library"]).optional(),
});
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

export const DEFAULT_TOP_K = 5;
