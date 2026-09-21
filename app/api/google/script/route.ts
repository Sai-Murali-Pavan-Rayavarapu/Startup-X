import { z } from "zod";
import { publisherModelUrl, vertexRequest } from "@/lib/gcp";
import { requireGenerationAccess } from "@/lib/generation-guard";

const scriptSchema = z.object({
  guest: z.string().trim().min(2).max(120),
  date: z.string().trim().min(3).max(80),
  situation: z.string().trim().min(10).max(1200),
  minutes: z.number().int().min(1).max(15),
});

export async function POST(request: Request) {
  try {
    requireGenerationAccess(request);
    const parsed = scriptSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "The episode brief is incomplete." }, { status: 400 });
    }

    const { guest, date, situation, minutes } = parsed.data;
    const prompt = `You are the editorial writer for Navura Media. Draft a ${minutes}-minute podcast conversation in natural Telugu with familiar English terms where useful. Host: Nithya. Guest depiction: ${guest}. Calendar trigger: ${date}. Discuss exactly one life situation: ${situation}.

Editorial rules: no political propaganda, party campaign, current-politics commentary, personal attacks, gossip, religious superiority, communal comparison, outrage bait, invented achievements, invented quotations, or advertising disguised as biography. Separate documented facts from interpretation. Never imply invented dialogue is an authentic quotation. If the situation cannot be safely supported, return a clear rejection instead of a script.

Structure: opening hook, context, decision, reflective conversation, result, meaning, respectful close. Prefix every line with NITHYA: or GUEST:. End with FACTS TO VERIFY and list every factual claim requiring confirmation. This is a research draft, not an approved script.`;

    const model = process.env.SCRIPT_MODEL ?? "gemini-3.8-flash";
    const location = process.env.VERTEX_LOCATION ?? "global";
    const response = await vertexRequest(publisherModelUrl(model, "generateContent", location), {
      method: "POST",
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 8192 },
      }),
    });
    const data = await response.json() as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!response.ok) {
      return Response.json({ error: data.error?.message ?? "Vertex AI could not create the script." }, { status: response.status });
    }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
    if (!text) return Response.json({ error: "Vertex AI returned an empty draft." }, { status: 502 });
    return Response.json({ text, status: "research-draft", model });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "GENERATION_DISABLED" ? 423 : code === "ADMIN_AUTH_REQUIRED" ? 401 : 500;
    return Response.json({ error: code || "Script generation failed." }, { status });
  }
}
