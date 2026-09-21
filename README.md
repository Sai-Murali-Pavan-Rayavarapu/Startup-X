# Navura AI Podcast Studio — Google Cloud edition

This package migrates the Navura six-stage production desk to Google Cloud project `navuramedia-509306`.

## Security and cost posture

- Uses Cloud Run service-account credentials and Vertex AI IAM. No Gemini API key is required.
- Video generation is disabled on the first deployment.
- Generation routes require a private admin token from Secret Manager.
- A single generation request is capped at an estimated USD 1.00.
- Cloud Run scales to zero and is limited to two instances.
- Veo 3.1 Lite 720p is the default draft model.

## Deploy or update

1. Download and extract this package.
2. Open [Google Cloud Shell](https://shell.cloud.google.com/?project=navuramedia-509306).
3. Upload the extracted folder to Cloud Shell.
4. Open a terminal in the folder. For a first deployment, keep generation locked:

   ```bash
   chmod +x scripts/deploy-gcp.sh
   ./scripts/deploy-gcp.sh
   ```

   After budget alerts are configured, deploy the protected generation controls with:

   ```bash
   ENABLE_GENERATION=true ./scripts/deploy-gcp.sh
   ```

The script enables the required APIs, creates a least-privilege runtime service account, creates the output bucket, stores an admin token in Secret Manager, builds the container, and deploys it to Cloud Run.

Generation remains disabled unless `ENABLE_GENERATION=true` is supplied. The website still requires the private admin token and a second confirmation before the one-clip test is submitted.

## Enable generation without rebuilding

```bash
gcloud run services update navura-ai-studio \
  --project=navuramedia-509306 \
  --region=us-central1 \
  --update-env-vars=GENERATION_ENABLED=true
```

Retrieve the admin token only when needed:

```bash
gcloud secrets versions access latest \
  --project=navuramedia-509306 \
  --secret=navura-admin-token
```

Never paste that token into source code or share it in chat.

Paste it only into the password field in your own deployed website. The field is held in React memory for the current browser tab and is not written to local storage or application logs.

## Safe first test

1. Open Stage 1 and generate the one-minute research draft.
2. Review the facts and wording.
3. Open Stage 4 and click **Run one test**.
4. Confirm the single 4-second 720p Veo Lite establishing shot.
5. Download and review it before creating any Gandhi likeness or additional clips.

The first video test intentionally contains no recognizable public figure. It checks IAM, long-running Veo operations, Cloud Storage output and private download at the lowest listed Veo Lite audio price tier.

## Local validation

```bash
npm install
npm run build
```

Local calls to Vertex AI require Application Default Credentials. The production Cloud Run service receives credentials automatically from its attached service account.
