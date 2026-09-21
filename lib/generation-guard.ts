import { timingSafeEqual } from "node:crypto";

const videoRequestPrices: Record<string, Record<string, number>> = {
  "veo-3.1-lite-generate-001": { "720p": 0.05, "1080p": 0.08 },
  "veo-3.1-fast-generate-001": { "720p": 0.10, "1080p": 0.12 },
  "veo-3.1-generate-001": { "720p": 0.40, "1080p": 0.40 },
};

function constantTimeMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireGenerationAccess(request: Request): void {
  if (process.env.GENERATION_ENABLED !== "true") {
    throw new Error("GENERATION_DISABLED");
  }
  const expected = process.env.ADMIN_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied || !constantTimeMatch(expected, supplied)) {
    throw new Error("ADMIN_AUTH_REQUIRED");
  }
}

export function estimatedVideoCost(model: string, resolution: string): number {
  const perRequest = videoRequestPrices[model]?.[resolution];
  if (!perRequest) throw new Error("MODEL_NOT_ALLOWED");
  return perRequest;
}

export function enforceRequestCost(estimate: number): void {
  const limit = Number(process.env.MAX_ESTIMATED_USD_PER_REQUEST ?? "1.00");
  if (!Number.isFinite(limit) || estimate > limit) throw new Error("REQUEST_COST_LIMIT");
}
