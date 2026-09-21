import { accessToken, outputBucket, projectId } from "@/lib/gcp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await accessToken();
    return Response.json({
      connected: true,
      authentication: "service-account",
      projectId: projectId(),
      outputBucket: outputBucket(),
      generationEnabled: process.env.GENERATION_ENABLED === "true",
    });
  } catch {
    return Response.json({ connected: false }, { status: 503 });
  }
}

export async function POST() {
  return Response.json(
    { error: "API keys are disabled. This deployment uses Google Cloud IAM." },
    { status: 405 },
  );
}
