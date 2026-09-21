import { randomUUID } from "node:crypto";
import { z } from "zod";
import { outputBucket, publisherModelUrl, vertexRequest } from "@/lib/gcp";
import { enforceRequestCost, estimatedVideoCost, requireGenerationAccess } from "@/lib/generation-guard";

const referenceSchema = z.object({
  gcsUri: z.string().regex(/^gs:\/\/[a-z0-9._-]+\/.+/),
  mimeType: z.enum(["image/png", "image/jpeg"]),
  referenceType: z.enum(["asset", "style"]).default("asset"),
});

const videoSchema = z.object({
  approval: z.literal("RUN_ONE_TEST"),
  prompt: z.string().trim().min(20).max(6000),
  durationSeconds: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(8),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  referenceImages: z.array(referenceSchema).max(3).default([]),
  negativePrompt: z.string().trim().max(800).optional(),
});

export async function POST(request: Request) {
  try {
    requireGenerationAccess(request);
    const parsed = videoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "The clip request is invalid." }, { status: 400 });
    }

    const model = process.env.VIDEO_MODEL ?? "veo-3.1-lite-generate-001";
    const location = process.env.VERTEX_VIDEO_LOCATION ?? "us-central1";
    const estimate = estimatedVideoCost(model, parsed.data.resolution);
    enforceRequestCost(estimate);

    const outputPrefix = `gs://${outputBucket()}/jobs/${randomUUID()}/`;
    const instance: Record<string, unknown> = { prompt: parsed.data.prompt };
    if (parsed.data.referenceImages.length) {
      instance.referenceImages = parsed.data.referenceImages.map((reference) => ({
        image: { gcsUri: reference.gcsUri, mimeType: reference.mimeType },
        referenceType: reference.referenceType,
      }));
    }

    const response = await vertexRequest(publisherModelUrl(model, "predictLongRunning", location), {
      method: "POST",
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          sampleCount: 1,
          storageUri: outputPrefix,
          durationSeconds: parsed.data.durationSeconds,
          aspectRatio: "16:9",
          resolution: parsed.data.resolution,
          personGeneration: "allow_adult",
          generateAudio: true,
          enhancePrompt: true,
          task: parsed.data.referenceImages.length ? "referenceToVideo" : "textToVideo",
          negativePrompt: parsed.data.negativePrompt,
        },
      }),
    });
    const data = await response.json() as {
      error?: { message?: string };
      name?: string;
    };
    if (!response.ok) {
      return Response.json({ error: data.error?.message ?? "Vertex AI could not start the clip." }, { status: response.status });
    }
    if (!data.name) {
      return Response.json({ error: "Vertex AI did not return an operation ID." }, { status: 502 });
    }
    return Response.json({
      status: "processing",
      operationName: data.name,
      outputPrefix,
      estimatedCostUsd: estimate,
      model,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "GENERATION_DISABLED" ? 423 : code === "ADMIN_AUTH_REQUIRED" ? 401 : code === "REQUEST_COST_LIMIT" ? 402 : 500;
    return Response.json({ error: code || "Clip generation failed." }, { status });
  }
}
