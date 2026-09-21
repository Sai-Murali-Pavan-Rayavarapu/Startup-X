"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronRight, CircleDashed, Download, Film, ImageIcon, KeyRound, LoaderCircle, MessageSquareText, Mic2, Play, Scissors, ShieldCheck, Sparkles } from "lucide-react";

const stages = [
  ["Script work", MessageSquareText],
  ["Guest image", ImageIcon],
  ["Anchor", Mic2],
  ["Video + voice", Film],
  ["Corrections", Scissors],
  ["Final render", Sparkles],
] as const;

const clips = [
  ["01", "Wide two-shot", "Nithya opens with the 1893 train incident", "0–10s"],
  ["02", "Host close-up", "Why did that humiliation become a decision?", "10–20s"],
  ["03", "Guest close-up", "Anger versus disciplined response", "20–30s"],
  ["04", "Two-shot", "Not silence; resistance without violence", "30–40s"],
  ["05", "Host reaction", "Turning personal pain into a principle", "40–50s"],
  ["06", "Closing wide", "The direction we give an insult", "50–60s"],
] as const;

const scriptDraft = [
  ["NITHYA", "ఒక చల్లని రాత్రి. First-class ticket ఉన్న యువ న్యాయవాదిని రైలు నుంచి దిగవేశారు. ఆ అవమానం తర్వాత మీరు ఏం నిర్ణయించుకున్నారు?"],
  ["GANDHI — DRAMATIZED", "ఆ క్షణంలో కోపం వచ్చింది. కానీ కోపంతోనే స్పందిస్తే, నా గౌరవం కాదు—నా ఆవేశమే మాట్లాడుతుందని అనిపించింది."],
  ["NITHYA", "అంటే ప్రతీకారం కాదు… నియంత్రణతో కూడిన resistance?"],
  ["GANDHI — DRAMATIZED", "అన్యాయం ముందు నిశ్శబ్దం కాదు. హింస లేకుండా, వెనక్కి తగ్గకుండా నిలబడే మార్గం వెతకాలి అనుకున్నాను."],
  ["NITHYA", "ఒక humiliation‌ని personal pain‌గా వదిలేయకుండా principle‌గా మార్చిన క్షణమా?"],
  ["GANDHI — DRAMATIZED", "అవమానం మన చేతిలో ఉండదు. దానికి మనం ఇచ్చే దిశ మాత్రం మన చేతిలో ఉంటుంది."],
] as const;

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [generationEnabled, setGenerationEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [adminToken, setAdminToken] = useState("");
  const [scriptResult, setScriptResult] = useState("");
  const [scriptStatus, setScriptStatus] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const [videoUri, setVideoUri] = useState("");

  useEffect(() => {
    fetch("/api/google/connection", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setConnected(Boolean(data.connected));
        setGenerationEnabled(Boolean(data.generationEnabled));
      })
      .catch(() => setConnected(false))
      .finally(() => setChecking(false));
  }, []);

  async function protectedPost(path: string, body: Record<string, unknown>) {
    if (!adminToken) throw new Error("Enter the private admin token first.");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "The request failed.");
    return data;
  }

  async function generatePilotScript() {
    try {
      setScriptStatus("Generating research draft…");
      const data = await protectedPost("/api/google/script", {
        guest: "Mahatma Gandhi — respectful AI dramatization",
        date: "October 2",
        situation: "The 1893 Pietermaritzburg railway incident and the disciplined response Gandhi later described. Clearly separate documented history from interpretive dialogue.",
        minutes: 1,
      });
      setScriptResult(data.text);
      setScriptStatus(`Draft ready · ${data.model}`);
    } catch (error) {
      setScriptStatus(error instanceof Error ? error.message : "Script generation failed.");
    }
  }

  async function generateTestClip() {
    if (!window.confirm("Generate one 4-second 720p Veo Lite test? Current listed price is about US$0.05.")) return;
    try {
      setVideoUri("");
      setVideoStatus("Submitting one protected test…");
      const data = await protectedPost("/api/google/video", {
        approval: "RUN_ONE_TEST",
        prompt: "Cinematic documentary establishing shot of Pietermaritzburg railway station in South Africa in 1893 at a cold misty night, a period steam train beside the platform, warm gas lamps, restrained historical realism, slow gentle camera push, respectful serious mood, no recognizable public figure, no dialogue, natural train ambience only, 16:9.",
        durationSeconds: 4,
        resolution: "720p",
        referenceImages: [],
        negativePrompt: "modern objects, text, logos, close-up faces, caricature, fantasy, exaggerated motion",
      });
      setVideoStatus(`Processing · estimated US$${data.estimatedCostUsd}`);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 15000));
        const status = await protectedPost("/api/google/video/status", { operationName: data.operationName });
        if (status.status === "completed") {
          if (!status.videoUri) throw new Error(status.filteredCount ? "The test was filtered by Google safety checks." : "The job finished without a video file.");
          setVideoUri(status.videoUri);
          setVideoStatus("Test clip ready for review.");
          return;
        }
        setVideoStatus(`Processing · check ${attempt + 1}/40`);
      }
      setVideoStatus("The job is still running. Keep this page open and try again shortly.");
    } catch (error) {
      setVideoStatus(error instanceof Error ? error.message : "Video generation failed.");
    }
  }

  async function downloadGeneratedClip() {
    try {
      setVideoStatus("Preparing private download…");
      const response = await fetch("/api/google/video/file", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ gcsUri: videoUri }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Download failed.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "navura-gandhi-pilot-test.mp4";
      link.click();
      URL.revokeObjectURL(url);
      setVideoStatus("Downloaded. Review before creating any additional clips.");
    } catch (error) {
      setVideoStatus(error instanceof Error ? error.message : "Download failed.");
    }
  }

  function downloadManifest() {
    const manifest = {
      schemaVersion: 1,
      title: "The night a humiliating train journey became a decision",
      guest: "Mahatma Gandhi — AI dramatization",
      anchor: "Nithya",
      durationSeconds: 60,
      output: { aspectRatio: "16:9", width: 1920, height: 1080, fps: 25 },
      editorialStatus: "research-needed",
      clips: clips.map(([id, shot, direction, time]) => ({ id, shot, direction, time })),
      disclosure: "AI-generated dramatization; not an authentic interview or recording.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "navura-gandhi-pilot-render-manifest.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#071211] text-[#eef8f5]">
      <header className="border-b border-white/10 bg-[#071211]/95">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/assets/navura-logo.png" alt="Navura Media" className="h-10 w-10 rounded-xl object-cover" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#62d4c5]">Navura Media</p>
              <h1 className="text-lg font-semibold tracking-tight">AI Podcast Studio</h1>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
            {connected ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
            {checking ? "Checking…" : connected ? "Google Cloud connected" : "Deployment required"}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1480px] px-5 py-6 lg:px-8">
        <div className="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex min-w-[960px] items-center gap-2">
            {stages.map(([title, Icon], index) => (
              <div key={title} className="contents">
                <button type="button" onClick={() => setActiveStage(index + 1)} className={`flex flex-1 items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${activeStage === index + 1 ? "border-[#4ac4b4]/50 bg-[#4ac4b4]/10" : "border-white/8 bg-black/10 hover:bg-white/5"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${activeStage === index + 1 ? "bg-[#4ac4b4] text-[#061311]" : "bg-white/8 text-white/60"}`}><Icon className="h-4 w-4" /></span>
                  <div><p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Stage {index + 1}</p><p className="whitespace-nowrap text-sm font-medium">{title}</p></div>
                </button>
                {index < stages.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div className="relative min-h-[580px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1a18]">
            <img src="/assets/navura-studio.png" alt="Navura virtual podcast studio" className="absolute inset-0 h-full w-full object-cover opacity-45" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071211] via-[#071211]/55 to-transparent" />
            <div className="relative flex min-h-[580px] flex-col justify-between p-6 md:p-9">
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur">Pilot · 1 minute</span>
                <span className="rounded-full border border-[#4ac4b4]/30 bg-[#4ac4b4]/10 px-3 py-1.5 text-xs text-[#9ce9df]">16:9 · Telugu + English</span>
              </div>
              <div className="max-w-3xl">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-[#73d8cb]"><CalendarDays className="h-4 w-4" /> October 2 pilot · Mahatma Gandhi</p>
                <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">The night a humiliating train journey became a decision.</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">Nithya explores one documented 1893 life situation: Gandhi’s removal from a first-class carriage at Pietermaritzburg and the disciplined response he later described. AI dramatization—not an authentic interview or recording.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <span className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm">No propaganda</span>
                  <span className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm">No current politics</span>
                  <span className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm">One life situation</span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-[#0d1c1a] p-6 shadow-2xl shadow-black/20">
            <div className="mb-6 flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4ac4b4] text-[#061311]"><KeyRound className="h-5 w-5" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#62d4c5]">Production access</p><h2 className="mt-1 text-xl font-semibold">Google Cloud IAM</h2></div>
            </div>
            <div className={`rounded-2xl border p-5 ${connected ? "border-emerald-400/25 bg-emerald-400/10" : "border-amber-300/25 bg-amber-300/10"}`}>
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /><span className="font-semibold">{connected ? "Service account connected" : "Waiting for GCP deployment"}</span></div>
              <p className="mt-2 text-sm leading-6 text-white/60">{connected ? "Vertex AI uses short-lived IAM credentials. No Gemini API key is stored in the browser or application source." : "Generation remains locked until the Cloud Run service is deployed."}</p>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Generation control</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${generationEnabled ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/10 text-amber-100"}`}>{generationEnabled ? "Enabled" : "Locked"}</span>
              </div>
              <label className="mt-4 block text-xs text-white/50" htmlFor="admin-token">Private admin token</label>
              <input id="admin-token" type="password" autoComplete="off" value={adminToken} onChange={(event) => setAdminToken(event.target.value.trim())} placeholder="Kept only in this browser tab" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-[#4ac4b4]/60" />
              <p className="mt-2 text-xs leading-5 text-white/40">Not saved to source code, local storage or Cloud Storage.</p>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <img src="/assets/nithya-anchor.png" alt="Nithya, locked Navura anchor" className="h-48 w-full object-cover object-[65%_28%]" />
              <div className="p-4"><p className="text-sm font-semibold">Nithya · Primary anchor</p><p className="mt-1 text-xs leading-5 text-white/50">Identity and grey-blazer look locked. Voice reference is retained for human QC; Google does not support cloning it from the intro video.</p></div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-white/55">
              <p className="font-medium text-white/80">Monthly target</p>
              <p className="mt-1">Three to five 10–15 minute videos using reusable studio assets, selective Veo shots and cost-controlled rendering.</p>
            </div>
          </aside>
        </div>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#0d1c1a] p-5 md:p-7">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#62d4c5]">Stage {activeStage} workspace</p><h2 className="mt-2 text-2xl font-semibold">{stages[activeStage - 1][0]}</h2></div>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">Human approval required</span>
          </div>

          {activeStage === 1 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#4ac4b4]/20 bg-[#4ac4b4]/5 p-4">
                <div><p className="text-sm font-semibold">Pilot script generator</p><p className="mt-1 text-xs text-white/45">One-minute research draft · Gemini 3.8 Flash</p></div>
                <button type="button" onClick={generatePilotScript} disabled={!connected || !generationEnabled || !adminToken || scriptStatus.startsWith("Generating")} className="inline-flex items-center gap-2 rounded-xl bg-[#4ac4b4] px-4 py-2.5 text-sm font-semibold text-[#061311] disabled:cursor-not-allowed disabled:opacity-35"><Sparkles className="h-4 w-4" /> Generate draft</button>
              </div>
              {scriptDraft.map(([speaker, line], index) => <article key={index} className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#62d4c5]">{speaker}</p><p className="mt-2 leading-7 text-white/75">{line}</p></article>)}
              {scriptStatus && <p className="lg:col-span-2 text-sm text-[#9ce9df]">{scriptStatus}</p>}
              {scriptResult && <pre className="lg:col-span-2 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-5 font-sans text-sm leading-7 text-white/75">{scriptResult}</pre>}
              <p className="lg:col-span-2 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-6 text-amber-50/75">Research gate: confirm the exact train date, ticket class, removal, station wait, and Gandhi’s later account. Guest dialogue is interpretive dramatization, never a quotation.</p>
            </div>
          )}

          {activeStage === 2 && (
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <img src="/assets/gandhi-reference.jpg" alt="Public-domain 1931 studio portrait of Mahatma Gandhi" className="h-72 w-full rounded-2xl object-cover object-top grayscale" />
              <div className="rounded-2xl border border-white/8 bg-black/20 p-5"><p className="text-lg font-semibold">Mahatma Gandhi · identity reference</p><p className="mt-3 leading-7 text-white/60">Public-domain 1931 studio portrait selected only as the identity reference. It does not depict the 1893 incident. Any generated result remains an AI dramatization and must be checked for respectful likeness.</p><a className="mt-5 inline-flex text-sm font-medium text-[#73d8cb] underline underline-offset-4" href="https://commons.wikimedia.org/wiki/File:Mahatma-Gandhi,_studio,_1931.jpg" target="_blank" rel="noreferrer">View source and rights record</a></div>
            </div>
          )}

          {activeStage === 3 && (
            <div className="grid gap-6 md:grid-cols-[320px_1fr]"><img src="/assets/nithya-anchor.png" alt="Nithya" className="h-72 w-full rounded-2xl object-cover object-[65%_25%]" /><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-5"><p className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" /> Nithya locked</p><p className="mt-3 leading-7 text-white/60">Grey blazer, tied-back hair, warm intelligent delivery, natural Telugu with English terms. The supplied 14-second intro remains a voice-performance reference for human review; it cannot be uploaded to Omni as a cloneable audio reference.</p><audio className="mt-5 w-full" controls src="/assets/nithya-intro.mp4" /></div></div>
          )}

          {activeStage === 4 && (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#4ac4b4]/20 bg-[#4ac4b4]/5 p-4">
                  <div><p className="text-sm font-semibold">Infrastructure test · no Gandhi likeness yet</p><p className="mt-1 text-xs text-white/45">One 4-second 720p establishing shot · estimated US$0.05</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={generateTestClip} disabled={!connected || !generationEnabled || !adminToken || videoStatus.startsWith("Processing") || videoStatus.startsWith("Submitting")} className="inline-flex items-center gap-2 rounded-xl bg-[#4ac4b4] px-4 py-2.5 text-sm font-semibold text-[#061311] disabled:cursor-not-allowed disabled:opacity-35">{videoStatus.startsWith("Processing") ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run one test</button>
                    {videoUri && <button type="button" onClick={downloadGeneratedClip} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button>}
                  </div>
                </div>
                {videoStatus && <p className="mb-4 text-sm text-[#9ce9df]">{videoStatus}</p>}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{clips.map(([id, shot, direction, time]) => <article key={id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#62d4c5]">CLIP {id}</span><span className="text-xs text-white/40">{time}</span></div><p className="mt-3 font-semibold">{shot}</p><p className="mt-2 text-sm leading-6 text-white/55">{direction}</p><span className="mt-4 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45">Protected generation · approval required</span></article>)}</div>
              </div>
          )}

          {activeStage === 5 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{["Face likeness", "Telugu pronunciation", "Lip sync", "Studio continuity", "Factual meaning"].map((check) => <div key={check} className="rounded-2xl border border-white/8 bg-black/20 p-4"><CircleDashed className="h-5 w-5 text-white/30" /><p className="mt-3 text-sm font-medium">{check}</p><p className="mt-1 text-xs text-white/40">Pending generated clips</p></div>)}</div>
          )}

          {activeStage === 6 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_auto]"><div className="rounded-2xl border border-white/8 bg-black/20 p-5"><p className="font-semibold">1080p render handoff</p><p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">The final MP4 requires an external renderer after all six active clip versions pass QC. The manifest fixes order, timing, aspect ratio, disclosure, captions and branding without claiming a render already exists.</p></div><button type="button" onClick={downloadManifest} className="self-center rounded-xl bg-[#4ac4b4] px-5 py-3 font-semibold text-[#061311] hover:bg-[#67d7c9]">Download render manifest</button></div>
          )}
        </section>
      </section>
    </main>
  );
}
