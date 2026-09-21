import { accessToken, outputBucket } from "@/lib/gcp";
import { requireGenerationAccess } from "@/lib/generation-guard";

export async function POST(request: Request) {
  try {
    requireGenerationAccess(request);
    const { gcsUri } = await request.json() as { gcsUri?: string };
    const expectedPrefix = `gs://${outputBucket()}/`;
    if (!gcsUri?.startsWith(expectedPrefix)) {
      return Response.json({ error: "Invalid output file." }, { status: 400 });
    }
    const objectName = gcsUri.slice(expectedPrefix.length);
    const token = await accessToken();
    const url = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(outputBucket())}/o/${encodeURIComponent(objectName)}?alt=media`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok || !response.body) {
      return Response.json({ error: "The generated clip is not available yet." }, { status: response.status || 502 });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "video/mp4",
        "Content-Disposition": `attachment; filename="${objectName.split("/").pop() ?? "navura-test.mp4"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "GENERATION_DISABLED" ? 423 : code === "ADMIN_AUTH_REQUIRED" ? 401 : 500;
    return Response.json({ error: code || "Download failed." }, { status });
  }
}
