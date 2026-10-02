#!/usr/bin/env bash
set -euo pipefail

# Run from the video-mvp directory in Google Cloud Shell.
cd "$(dirname "$0")"
PROJECT="navuramedia-509306"
REGION="us-central1"
SERVICE="navura-video-mvp"
ACCOUNT="navura-video-mvp@${PROJECT}.iam.gserviceaccount.com"
BUCKET="${PROJECT}-video-mvp"
SECRET="navura-video-mvp-token"

test -n "${NAVURA_PIPELINE_TOKEN:-}" || { echo "The private video token environment variable is missing." >&2; exit 1; }
command -v gcloud >/dev/null || { echo "Run this bundle in Google Cloud Shell." >&2; exit 1; }

gcloud services enable --project="$PROJECT" \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com texttospeech.googleapis.com storage.googleapis.com \
  secretmanager.googleapis.com

if ! gcloud iam service-accounts describe "$ACCOUNT" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create navura-video-mvp --project="$PROJECT" \
    --display-name="Navura video MVP"
fi
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$ACCOUNT" --role="roles/aiplatform.user" \
  --condition=None --quiet >/dev/null

if ! gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT" \
    --location="$REGION" --uniform-bucket-level-access
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$ACCOUNT" --role="roles/storage.objectAdmin" >/dev/null

if ! gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy=automatic
fi
printf '%s' "$NAVURA_PIPELINE_TOKEN" | gcloud secrets versions add "$SECRET" \
  --project="$PROJECT" --data-file=- >/dev/null
gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT" \
  --member="serviceAccount:$ACCOUNT" --role="roles/secretmanager.secretAccessor" >/dev/null

gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --source=. --service-account="$ACCOUNT" --allow-unauthenticated \
  --memory=2Gi --cpu=2 --timeout=900 --concurrency=1 \
  --min-instances=0 --max-instances=1 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT,NAVURA_VIDEO_BUCKET=$BUCKET" \
  --set-secrets="NAVURA_PIPELINE_TOKEN=$SECRET:latest" --quiet

URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT" \
  --region="$REGION" --format='value(status.url)')"
test -n "$URL" || { echo "Deployment has no service URL." >&2; exit 1; }
echo "NAVURA_VIDEO_SERVICE_URL=$URL"
echo "Share this URL with Codex to connect the live Stage 5 page."
