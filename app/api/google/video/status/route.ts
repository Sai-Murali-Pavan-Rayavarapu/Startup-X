import { z } from "zod";
import { projectId, publisherModelUrl, vertexRequest } from "@/lib/gcp";
import { requireGenerationAccess } from "@/lib/generation-guard";

const statusSchema = z.object({
  operationName: z.string().trim().min(40).max(500),
});

export async function POST(request: Request) {
  try {
    requireGenerationAccess(request);
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid operation." }, { status: 400 });

    const model = process.env.VIDEO_MODEL ?? "veo-3.1-lite-generate-001";
    const location = process.env.VERTEX_VIDEO_LOCATION ?? "us-central1";
    const expectedPrefix = `projects/${projectId()}/locations/${location}/publishers/google/models/${model}/operations/`;
    if (!parsed.data.operationName.startsWith(expectedPrefix)) {
      return Response.json({ error: "Operation does not belong to this service." }, { status: 403 });
    }

    const response = await vertexRequest(publisherModelUrl(model, "fetchPredictOperation", location), {
      method: "POST",
      body: JSON.stringify({ operationName: parsed.data.operationName }),
    });
    const data = await response.json() as {
      error?: { message?: string };
      done?: boolean;
      response?: { videos?: Array<{ gcsUri?: string; mimeType?: string }>; raiMediaFilteredCount?: number };
    };
    if (!response.ok) {
      return Response.json({ error: data.error?.message ?? "Could not check the clip." }, { status: response.status });
    }
    return Response.json({
      status: data.done ? "completed" : "processing",
      videoUri: data.response?.videos?.[0]?.gcsUri ?? null,
      filteredCount: data.response?.raiMediaFilteredCount ?? 0,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "GENERATION_DISABLED" ? 423 : code === "ADMIN_AUTH_REQUIRED" ? 401 : 500;
    return Response.json({ error: code || "Status check failed." }, { status });
  }
}
