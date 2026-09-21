#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="navuramedia-509306"
REGION="us-central1"
SERVICE="navura-ai-studio"
SERVICE_ACCOUNT="navura-studio-runtime"
BUCKET="${PROJECT_ID}-navura-video"
RUNTIME_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
ENABLE_GENERATION="${ENABLE_GENERATION:-false}"

if [[ "$ENABLE_GENERATION" != "true" && "$ENABLE_GENERATION" != "false" ]]; then
  echo "ENABLE_GENERATION must be true or false."
  exit 1
fi

command -v gcloud >/dev/null || { echo "Run this script in Google Cloud Shell."; exit 1; }
ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
test -n "$ACTIVE_ACCOUNT" || { echo "No active Google Cloud login found."; exit 1; }

echo "Deploying project: $PROJECT_ID"
echo "Signed in as: $ACTIVE_ACCOUNT"
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com

# New Google Cloud projects use the Compute Engine default service account for
# Cloud Build. Source deployments require the dedicated Cloud Run Builder role.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUILD_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_EMAIL}" \
  --role="roles/run.builder" >/dev/null

if ! gcloud iam service-accounts describe "$RUNTIME_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
    --display-name="Navura Studio runtime"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_EMAIL}" \
  --role="roles/aiplatform.user" >/dev/null

if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="$REGION" \
    --uniform-bucket-level-access
fi

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_EMAIL}" \
  --role="roles/storage.objectAdmin" >/dev/null

if ! gcloud secrets describe navura-admin-token >/dev/null 2>&1; then
  gcloud secrets create navura-admin-token --replication-policy=automatic
  ADMIN_TOKEN_VALUE="$(openssl rand -hex 32)"
  printf '%s' "$ADMIN_TOKEN_VALUE" | gcloud secrets versions add navura-admin-token --data-file=-
fi

gcloud secrets add-iam-policy-binding navura-admin-token \
  --member="serviceAccount:${RUNTIME_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

gcloud run deploy "$SERVICE" \
  --source . \
  --region="$REGION" \
  --platform=managed \
  --service-account="$RUNTIME_EMAIL" \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=0 \
  --max-instances=2 \
  --concurrency=20 \
  --timeout=900 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},VERTEX_LOCATION=global,VERTEX_VIDEO_LOCATION=${REGION},GCS_OUTPUT_BUCKET=${BUCKET},SCRIPT_MODEL=gemini-3.8-flash,VIDEO_MODEL=veo-3.1-lite-generate-001,GENERATION_ENABLED=${ENABLE_GENERATION},MAX_ESTIMATED_USD_PER_REQUEST=1.00" \
  --set-secrets="ADMIN_TOKEN=navura-admin-token:latest"

SERVICE_URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
echo
echo "Deployment complete: $SERVICE_URL"
echo "Generation enabled: ${ENABLE_GENERATION}"
echo "Project: $PROJECT_ID | Bucket: gs://$BUCKET | Service account: $RUNTIME_EMAIL"
