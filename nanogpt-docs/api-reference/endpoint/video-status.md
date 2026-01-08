# Video Status

> Poll the status of a video generation request submitted via /generate-video. Returns normalized status and the final video URL on completion.

## Overview

Poll the status of an asynchronous video generation run. Use the `runId` you received from `POST /generate-video` along with the `modelSlug` you used to start the job. When the run completes, the response includes `data.output.video.url`.

### Query parameters

* `runId` (string, required): The run identifier returned by the submit call
* `modelSlug` (string, required): The model used for the run (e.g., `veo2-video`)

## Usage

<CodeGroup>
  ```python Python theme={null}
  import requests
  import time

  BASE = "https://nano-gpt.com/api"

  def get_video_status(run_id: str, model_slug: str, api_key: str) -> dict:
      resp = requests.get(
          f"{BASE}/generate-video/status",
          headers={"x-api-key": api_key},
          params={"runId": run_id, "modelSlug": model_slug},
          timeout=30,
      )
      resp.raise_for_status()
      return resp.json()


  def wait_for_video(run_id: str, model_slug: str, api_key: str, max_attempts: int = 120, delay_s: int = 5) -> str:
      for i in range(max_attempts):
          data = get_video_status(run_id, model_slug, api_key)
          status = data.get("data", {}).get("status")
          if status == "COMPLETED":
              return data["data"]["output"]["video"]["url"]
          if status == "FAILED":
              raise RuntimeError(data.get("data", {}).get("error", "Video generation failed"))
          time.sleep(delay_s)
      raise TimeoutError("Video generation timed out")
  ```

  ```javascript JavaScript theme={null}
  const BASE = 'https://nano-gpt.com/api';

  async function getVideoStatus(runId, modelSlug, apiKey) {
    const res = await fetch(`${BASE}/generate-video/status?runId=${runId}&modelSlug=${modelSlug}`, {
      headers: { 'x-api-key': apiKey }
    });
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    return res.json();
  }

  export async function waitForVideo(runId, modelSlug, apiKey, maxAttempts = 120, delayMs = 5000) {
    for (let i = 0; i < maxAttempts; i++) {
      const payload = await getVideoStatus(runId, modelSlug, apiKey);
      const status = payload?.data?.status;
      if (status === 'COMPLETED') return payload.data.output.video.url;
      if (status === 'FAILED') throw new Error(payload?.data?.error || 'Video generation failed');
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error('Video generation timed out');
  }
  ```

  ```bash cURL theme={null}
  # Single status check
  curl -s "https://nano-gpt.com/api/generate-video/status?runId=RUN_ID&modelSlug=veo2-video" \
    -H "x-api-key: YOUR_API_KEY" | jq .

  # Poll until complete (~10 minutes max)
  for i in {1..120}; do
    RESP=$(curl -s "https://nano-gpt.com/api/generate-video/status?runId=RUN_ID&modelSlug=veo2-video" -H "x-api-key: YOUR_API_KEY")
    STATUS=$(echo "$RESP" | jq -r '.data.status // empty')
    echo "Attempt $i: status=$STATUS"
    if [ "$STATUS" = "COMPLETED" ]; then
      echo "$RESP" | jq .
      VIDEO_URL=$(echo "$RESP" | jq -r '.data.output.video.url')
      echo "Video URL: $VIDEO_URL"
      break
    fi
    sleep 5
  done
  ```
</CodeGroup>

## Status values

* `IN_QUEUE`: Request queued
* `IN_PROGRESS`: Generation in progress
* `COMPLETED`: Video ready
* `FAILED`: Generation failed
* `CANCELLED`: Request cancelled

## Response examples

### In progress

```json  theme={null}
{
  "data": {
    "status": "IN_PROGRESS",
    "request_id": "fal-request-abc123xyz"
  }
}
```

### Completed

```json  theme={null}
{
  "data": {
    "status": "COMPLETED",
    "request_id": "fal-request-abc123xyz",
    "output": {
      "video": {
        "url": "https://storage.example.com/video.mp4"
      }
    }
  }
}
```

### Failed

```json  theme={null}
{
  "data": {
    "status": "FAILED",
    "request_id": "fal-request-abc123xyz",
    "error": "Content policy violation",
    "isNSFWError": true,
    "userFriendlyError": "Content flagged as inappropriate. Please modify your prompt and try again."
  }
}
```

### Notes

* Polling this endpoint is free; submission endpoints are rate limited.
* The final video URL is returned in `data.output.video.url` when status is `COMPLETED`.


## OpenAPI

````yaml GET /generate-video/status
openapi: 3.1.0
info:
  title: NanoGPT API
  description: >-
    API documentation for the NanoGPT language, image, video, speech-to-text,
    and text-to-speech generation services
  license:
    name: MIT
  version: 1.0.0
servers:
  - url: https://nano-gpt.com/api
    description: NanoGPT API Server
security: []
paths:
  /generate-video/status:
    get:
      description: >-
        Poll the status of a video generation request submitted via
        /generate-video. Returns normalized status and the final video URL on
        completion.
      parameters:
        - name: runId
          in: query
          description: Run ID returned from the POST /generate-video response
          required: true
          schema:
            type: string
        - name: modelSlug
          in: query
          description: Model identifier used in the generation request (e.g., 'veo2-video')
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Current status for the requested video generation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GenerateVideoStatusResponse'
        '400':
          description: Bad Request - Missing or invalid parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Request not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - apiKeyAuth: []
components:
  schemas:
    GenerateVideoStatusResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            status:
              type: string
              description: Current status
              enum:
                - IN_QUEUE
                - IN_PROGRESS
                - COMPLETED
                - FAILED
                - CANCELLED
            request_id:
              type: string
              description: Provider request identifier
            output:
              type: object
              properties:
                video:
                  type: object
                  properties:
                    url:
                      type: string
                      description: Final video URL
            error:
              type: string
              nullable: true
            isNSFWError:
              type: boolean
              nullable: true
            userFriendlyError:
              type: string
              nullable: true
    Error:
      required:
        - error
        - message
      type: object
      properties:
        error:
          type: integer
          format: int32
        message:
          type: string
  securitySchemes:
    apiKeyAuth:
      type: apiKey
      in: header
      name: x-api-key

````

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.nano-gpt.com/llms.txt