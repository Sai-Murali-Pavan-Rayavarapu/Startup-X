"""One-shot Vertex video proof: locked script -> Veo -> Telugu speech -> MP4."""
import base64
import io
import json
import os
import re
import subprocess
import tempfile
import uuid
from pathlib import Path

import google.auth
from google.auth.transport.requests import Request
from google.cloud import storage, texttospeech
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image
import httpx
from pydantic import BaseModel

app = FastAPI(title="Navura Video MVP")
MODEL = "veo-3.1-fast-generate-001"
LOCATION = "us-central1"
ROOT = Path(__file__).resolve().parent.parent


class PreviewInput(BaseModel):
    artifact: dict


def settings():
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    bucket = os.getenv("NAVURA_VIDEO_BUCKET")
    secret = os.getenv("NAVURA_PIPELINE_TOKEN")
    if not project or not bucket or not secret:
        raise HTTPException(503, "Video service needs project, bucket, and pipeline token configuration.")
    return project, bucket, secret


def authorize(token):
    import hmac
    expected = settings()[2]
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(401, "Unauthorized")


def blobs():
    return storage.Client().bucket(settings()[1])


def state_blob(job):
    return blobs().blob(f"navura-jobs/{job}/state.json")


def read_state(job):
    if not re.fullmatch(r"[0-9a-f]{32}", job):
        raise HTTPException(404, "Job not found")
    blob = state_blob(job)
    if not blob.exists():
        raise HTTPException(404, "Job not found")
    return json.loads(blob.download_as_text())


def write_state(job, value):
    state_blob(job).upload_from_string(json.dumps(value, ensure_ascii=False), content_type="application/json")


def access_token():
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    credentials.refresh(Request())
    return credentials.token


def vertex(method, body):
    project = settings()[0]
    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{project}/locations/{LOCATION}/publishers/google/models/{MODEL}:{method}"
    response = httpx.post(url, headers={"Authorization":f"Bearer {access_token()}"}, json=body, timeout=45)
    if response.is_error:
        raise HTTPException(502, f"Vertex video request failed ({response.status_code}): {response.text[:350]}")
    return response.json()


def reference_png(host):
    # The private Site sends only the selected, approved reference for this preview.
    ident = host.get("id", "")
    if not re.fullmatch(r"w(?:1|2|3|4|5|7|8|9|10|11)", ident):
        raise HTTPException(422, "MVP preview needs an approved Nithya reference.")
    encoded = host.get("image_base64")
    if encoded:
        try:
            if len(encoded) > 6_000_000:
                raise ValueError("Reference image is too large")
            source = io.BytesIO(base64.b64decode(encoded, validate=True))
        except (ValueError, base64.binascii.Error):
            raise HTTPException(422, "The selected host image is invalid.")
    else:
        path = ROOT / "public" / "assets" / f"{ident}.webp"
        if not path.is_file():
            raise HTTPException(503, "Selected host image is missing from the video service.")
        source = path
    with Image.open(source) as image:
        output = io.BytesIO()
        image.convert("RGB").save(output, format="PNG")
        return base64.b64encode(output.getvalue()).decode()


def check_artifact(artifact):
    if artifact.get("stage") != "creative_direction" or not artifact.get("locked_at"):
        raise HTTPException(422, "Lock Stage 4 before generating video.")
    shots, lines = artifact.get("shots"), artifact.get("script_lines")
    if not isinstance(shots, list) or not isinstance(lines, list) or len(shots) != len(lines) or not 1 <= len(lines) <= 24:
        raise HTTPException(422, "The locked plan and script lines do not match.")
    first = lines[0]
    if first.get("speaker") != "Nithya" or shots[0].get("line_number") != 1:
        raise HTTPException(422, "The MVP preview starts with the approved Nithya line.")
    if len(first.get("telugu", "")) > 500:
        raise HTTPException(422, "First dialogue line is too long.")
    return first


@app.get("/health")
def health():
    return {"ok":True,"configured":all(os.getenv(k) for k in ("GOOGLE_CLOUD_PROJECT","NAVURA_VIDEO_BUCKET","NAVURA_PIPELINE_TOKEN"))}


@app.post("/jobs")
def start(payload: PreviewInput, x_navura_token: str | None = Header(None)):
    authorize(x_navura_token)
    artifact = payload.artifact
    line = check_artifact(artifact)
    job = uuid.uuid4().hex
    image = reference_png(artifact["references"]["host"])
    prompt = ("Eight-second silent cinematic studio shot. The supplied photo is the approved reference for the adult female Telugu podcast host Nithya. "
              "She sits at a desk in a modern Hyderabad podcast studio with a microphone, natural subtle movement, steady eye line and clean framing. "
              "No audible dialogue, no music, no captions, no text, no historical reenactment, no additional people. Preserve the reference identity. "
              "The exact approved Telugu dialogue will be added as separately reviewed speech and captions in post-production.")
    body = {"instances":[{"prompt":prompt,"referenceImages":[{"image":{"bytesBase64Encoded":image,"mimeType":"image/png"},"referenceType":"asset"}]}],
            "parameters":{"aspectRatio":"16:9","durationSeconds":8,"storageUri":f"gs://{settings()[1]}/navura-jobs/{job}/veo/","sampleCount":1,"resolution":"720p","personGeneration":"allow_adult"}}
    result = vertex("predictLongRunning", body)
    name = result.get("name")
    if not name or not name.startswith(f"projects/{settings()[0]}/locations/{LOCATION}/publishers/google/models/{MODEL}/operations/"):
        raise HTTPException(502, "Vertex did not return a video operation.")
    record = {"job_id":job,"status":"generating","run_id":artifact.get("run_id"),"plan_revision":artifact.get("plan_revision"),
              "line_number":1,"speaker":"Nithya","dialogue":line["telugu"],"operation":name,"video":None,"error":None}
    write_state(job, record)
    return public_state(record)


def public_state(record):
    return {key:record.get(key) for key in ("job_id","status","run_id","plan_revision","line_number","speaker","video","error")}


def synthesize(text, output):
    client = texttospeech.TextToSpeechClient()
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text.strip("[] ")),
        voice=texttospeech.VoiceSelectionParams(language_code="te-IN",name="te-IN-Chirp3-HD-Achernar"),
        audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3))
    output.write_bytes(response.audio_content)


def run_ffmpeg(clip, audio, destination, vertical=False, subtitle=None):
    vf = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720"
    if vertical:
        vf += ",crop=405:720:(in_w-405)/2:0,scale=720:1280"
    if subtitle:
        vf += f",subtitles={subtitle}:force_style='FontName=Noto Sans Telugu,FontSize=24,Outline=2,Alignment=2,MarginV=36'"
    command = ["ffmpeg","-hide_banner","-loglevel","error","-y","-stream_loop","-1","-i",str(clip),"-i",str(audio),
               "-vf",vf,"-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","veryfast","-crf","24","-pix_fmt","yuv420p",
               "-c:a","aac","-b:a","128k","-shortest","-movflags","+faststart",str(destination)]
    subprocess.run(command,check=True,timeout=180)
    if not destination.is_file() or destination.stat().st_size < 10000:
        raise RuntimeError("Renderer produced an empty video")


def render(record, source_uri):
    if not source_uri.startswith(f"gs://{settings()[1]}/navura-jobs/{record['job_id']}/"):
        raise HTTPException(502, "Vertex returned a video outside the job output prefix.")
    source = source_uri.split("/",3)[3]
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp)
        clip,audio=root/"source.mp4",root/"speech.mp3"
        blobs().blob(source).download_to_filename(str(clip))
        synthesize(record["dialogue"],audio)
        subtitle=root/"dialogue.srt"
        dialogue=record["dialogue"].strip("[] ").replace("\r"," ").replace("\n"," ")
        subtitle.write_text(f"1\n00:00:00,000 --> 00:00:59,000\n{dialogue}\n",encoding="utf-8")
        for format_name,vertical in (("landscape",False),("vertical",True)):
            output=root/f"{format_name}.mp4"
            run_ffmpeg(clip,audio,output,vertical,subtitle)
            blobs().blob(f"navura-jobs/{record['job_id']}/{format_name}.mp4").upload_from_filename(str(output),content_type="video/mp4")
    record["video"]={"landscape":f"/jobs/{record['job_id']}/video/landscape","vertical":f"/jobs/{record['job_id']}/video/vertical"}
    record["status"]="ready"


@app.post("/jobs/{job}/advance")
def advance(job: str, x_navura_token: str | None = Header(None)):
    authorize(x_navura_token)
    record=read_state(job)
    if record["status"] in ("ready","failed"):
        return public_state(record)
    try:
        result=vertex("fetchPredictOperation",{"operationName":record["operation"]})
        if not result.get("done"):
            return public_state(record)
        if result.get("error"):
            raise RuntimeError(str(result["error"])[:350])
        videos=result.get("response",{}).get("videos",[])
        if not videos:
            raise RuntimeError("Video generation returned no usable clip")
        record["status"]="rendering"
        write_state(job,record)
        render(record,videos[0]["gcsUri"])
    except Exception as exc:
        record["status"]="failed"
        record["error"]=str(exc)[:500]
    write_state(job,record)
    return public_state(record)


@app.get("/jobs/{job}")
def status(job: str, x_navura_token: str | None = Header(None)):
    authorize(x_navura_token)
    return public_state(read_state(job))


@app.get("/jobs/{job}/video/{format_name}")
def video(job: str, format_name: str, x_navura_token: str | None = Header(None)):
    authorize(x_navura_token)
    if format_name not in ("landscape","vertical") or read_state(job)["status"]!="ready":
        raise HTTPException(404,"Video not ready")
    blob=blobs().blob(f"navura-jobs/{job}/{format_name}.mp4")
    return StreamingResponse(blob.open("rb"),media_type="video/mp4")
