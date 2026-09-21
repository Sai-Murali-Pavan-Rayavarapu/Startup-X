import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export function projectId(): string {
  const value = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
  if (!value) throw new Error("GCP_PROJECT_NOT_CONFIGURED");
  return value;
}

export function outputBucket(): string {
  const value = process.env.GCS_OUTPUT_BUCKET;
  if (!value) throw new Error("GCS_BUCKET_NOT_CONFIGURED");
  return value;
}

export async function accessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("GCP_AUTH_UNAVAILABLE");
  return token.token;
}

export async function vertexRequest(
  url: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
): Promise<Response> {
  const token = await accessToken();
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

export function publisherModelUrl(model: string, action: string, location: string): string {
  const host = location === "global"
    ? "aiplatform.googleapis.com"
    : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId()}/locations/${location}/publishers/google/models/${model}:${action}`;
}
