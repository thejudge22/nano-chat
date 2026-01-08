# Video Generation

> Generate videos using various AI models including text-to-video and image-to-video capabilities across multiple providers (FAL, PromptChan, LongStories). Model capabilities: **LongStories** (longstories, longstories-kids): AI-powered short-form video creation with script generation, voice narration, and automated editing. **FAL Models**: kling-video (Kling 1.5 Pro text-to-video), kling-video-v2 (Kling 2.0 text/image-to-video), veo2-video (Veo2 text/image-to-video), minimax-video (MiniMax T2V-01), hunyuan-video (Hunyuan text-to-video), hunyuan-video-image-to-video (Hunyuan image-to-video), wan-video-image-to-video (Wan image-to-video), kling-v21-standard/pro/master (Kling V2.1 variants). **PromptChan**: promptchan-video (adult content generation). All requests return immediately with status 'pending' - use the unified status endpoint to poll for completion.

> Image-conditioned models accept either `imageDataUrl` (base64) or a public `imageUrl`. The service uses the explicit value you provide before checking any saved attachments.

## Overview

`POST /generate-video` submits an asynchronous job to create, extend, or edit a video with one of NanoGPT's provider integrations. The endpoint responds immediately with `runId`, `model`, and `status: "pending"`. Poll the Video Status endpoint with that `runId` until you receive final assets. Duration-based billing is assessed after completion; align any pricing tables with `lib/credits/videoPricingConfig.ts`.

Provider errors include descriptive JSON payloads. Surface the `error.message` (and HTTP status) to help users correct content-policy or validation issues.

## Request Schema

Only include the fields required by your chosen `model`. Unknown keys are ignored, but some providers fail when extra media fields are present.

### Core Fields

| field                                         | type             | required    | details                                                                                                                                                |
| --------------------------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`                                       | string           | yes         | See [Model Directory](#model-directory) for the complete list. Use `longstories-movie` / `longstories-pixel-art`; `promptchan-video` has been removed. |
| `prompt`                                      | string           | conditional | Required for text-to-video and edit models unless a structured script is supplied.                                                                     |
| `negative_prompt`                             | string           | no          | Suppresses specific content. Respected by Veo, Wan, Runway, Pixverse, and other models noted below.                                                    |
| `script`                                      | string           | conditional | LongStories models accept full scripts instead of relying on `prompt`.                                                                                 |
| `storyConfig`                                 | object           | conditional | LongStories structured payload (e.g. scenes, narration, voice).                                                                                        |
| `duration`                                    | string           | conditional | Seconds as a string (`"5"`, `"8"`, `"60"`). Limits vary per model; see individual entries.                                                             |
| `seconds`                                     | string           | conditional | Sora-specific duration selector (`"4"`, `"8"`, `"12"`).                                                                                                |
| `aspect_ratio`                                | string           | conditional | Provider-specific ratios such as `16:9`, `9:16`, `1:1`, `3:4`, `4:3`, `21:9`, `auto`.                                                                  |
| `orientation`                                 | string           | conditional | `landscape` or `portrait` for Sora and Wan text/image flows.                                                                                           |
| `resolution`                                  | string           | conditional | Resolution tokens (`480p`, `580p`, `720p`, `1080p`, `1792x1024`, `2k`, `4k`).                                                                          |
| `size`                                        | string           | conditional | Provider preset for `vidu-video`, `pixverse-*`, `wan-wavespeed-22-plus`, `wan-wavespeed-25`, and upscalers.                                            |
| `generateAudio`                               | boolean          | no          | Adds AI audio on Veo 3 and Lightricks models. Defaults to `false`.                                                                                     |
| `enhancePrompt`                               | boolean          | no          | Optional Veo 3 prompt optimizer. Defaults to `false`.                                                                                                  |
| `pro_mode` / `pro`                            | boolean          | no          | High-quality toggle for Sora and Hunyuan families. Defaults to `false`.                                                                                |
| `enable_prompt_expansion`                     | boolean          | no          | Prompt booster for Wan/Seedance/Minimax variants. Disabled by default.                                                                                 |
| `enable_safety_checker`                       | boolean          | no          | Wan 2.2 Turbo safety switch. Defaults to provider configuration.                                                                                       |
| `camera_fix` / `camera_fixed` / `cameraFixed` | boolean          | no          | Locks the virtual camera for Seedance and Wan variants.                                                                                                |
| `seed`                                        | number or string | no          | Deterministic seed when supported (Veo, Wan, Pixverse).                                                                                                |
| `voice_id`                                    | string           | conditional | Required by `kling-lipsync-t2v`.                                                                                                                       |
| `voice_language`                              | string           | conditional | `en` or `zh` for `kling-lipsync-t2v`.                                                                                                                  |
| `voice_speed`                                 | number           | conditional | Range `0.8-2.0` for `kling-lipsync-t2v`.                                                                                                               |
| `videoDuration` / `billedDuration`            | number           | no          | Optional overrides for upscaler billing calculations.                                                                                                  |
| `adjust_fps_for_interpolation`                | boolean          | no          | Optional toggle for interpolation-aware upscaling. Defaults to `false`.                                                                                |

### Media Inputs

| field             | type   | required    | details                                                                               |
| ----------------- | ------ | ----------- | ------------------------------------------------------------------------------------- |
| `imageDataUrl`    | string | conditional | Base64-encoded data URL. Recommended for private assets or files larger than 4 MB.    |
| `imageUrl`        | string | conditional | HTTPS link to a source image.                                                         |
| `image`           | string | conditional | Some Wavespeed/ByteDance providers expect this property instead of `imageUrl`.        |
| `reference_image` | string | conditional | Optional still image guiding `runwayml-gen4-aleph`.                                   |
| `audioDataUrl`    | string | conditional | Base64 data URL for audio-driven models.                                              |
| `audioUrl`        | string | conditional | HTTPS audio input.                                                                    |
| `audio`           | string | conditional | Alternate audio field accepted by ByteDance and Kling lipsync providers.              |
| `video`           | string | conditional | HTTPS link or data URL to the source video (edit, extend, upscaler, or lipsync jobs). |
| `videoUrl`        | string | conditional | Alias accepted by select providers.                                                   |
| `swapImage`       | string | conditional | Required by `magicapi-video-face-swap`.                                               |
| `targetVideo`     | string | conditional | Required by `magicapi-video-face-swap`.                                               |
| `targetFaceIndex` | number | no          | Optional face index for MagicAPI swaps.                                               |

> Provide only the media fields that your target model expects. Extra media inputs often trigger provider validation errors.

### Advanced Controls

| field                                                                                            | type    | models                                                             |
| ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------ |
| `num_frames`                                                                                     | integer | Wan 2.2 families, Seedance 22 5B, Wan image-to-video.              |
| `frames_per_second`                                                                              | integer | Wan 2.2 5B.                                                        |
| `num_inference_steps`                                                                            | integer | Wan 2.2 families.                                                  |
| `guidance_scale`                                                                                 | number  | Wan 2.2 5B.                                                        |
| `shift`                                                                                          | number  | Wan 2.2 5B.                                                        |
| `interpolator_model`                                                                             | string  | Wan 2.2 5B.                                                        |
| `num_interpolated_frames`                                                                        | integer | Wan 2.2 5B.                                                        |
| `movementAmplitude`                                                                              | string  | `vidu-video` (`auto`, `small`, `medium`, `large`).                 |
| `motion`                                                                                         | string  | `midjourney-video` (`low`, `high`).                                |
| `style`                                                                                          | string  | `vidu-video` (`general`, `anime`), `pixverse-*` (various presets). |
| `effectType`, `effect`, `cameraMovement`, `motionMode`, `soundEffectSwitch`, `soundEffectPrompt` | varies  | Pixverse v4.5/v5.                                                  |
| `mode`                                                                                           | string  | `wan-wavespeed-22-animate` (`animate`, `replace`).                 |
| `prompt_optimizer`                                                                               | boolean | `minimax-hailuo-02`, `minimax-hailuo-02-pro`.                      |

## Model Directory

Model strings are grouped by upstream provider. Each row lists the required media inputs and notable request fields. Code references point to the backend implementation.

### Core & LongStories Models

| model                          | input types         | key request fields                                                                                                                             | code ref                                         |
| ------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `kling-video`                  | text-to-video       | `prompt`, optional `negative_prompt`, `duration` (defaults to `5`)                                                                             | `lib/modelProviders/videoModels.ts`              |
| `kling-video-v2`               | text/image-to-video | `prompt`, optional `imageDataUrl`/`imageUrl`, `duration` (`5`, `10`), Kling guidance handled server-side                                       | `lib/modelProviders/videoModels.ts`              |
| `veo2-video`                   | text/image-to-video | `prompt`, `duration` (`5s-30s`), `aspect_ratio` (`16:9`, `9:16`, `1:1`, `4:3`, `3:4`), optional `negative_prompt`, `seed`                      | `lib/modelProviders/videoModels.ts`              |
| `minimax-video`                | text/image-to-video | `duration` (`6`, `10`), optional `enable_prompt_expansion`                                                                                     | `lib/modelProviders/videoModels.ts`              |
| `hunyuan-video`                | text-to-video       | `pro` (boolean), `resolution` (`480p`, `720p`, `1080p`), `num_frames`, `num_inference_steps`, optional `negative_prompt`                       | `lib/modelProviders/videoModels.ts`              |
| `hunyuan-video-image-to-video` | image-to-video      | Requires `imageDataUrl`/`imageUrl`, supports `pro`, `resolution`, `num_frames`, `num_inference_steps`                                          | `lib/modelProviders/videoModels.ts`              |
| `wan-video-image-to-video`     | image-to-video      | Requires `imageDataUrl`/`imageUrl`, optional `prompt`, `num_frames`, `frames_per_second`, `resolution`, `negative_prompt`, `seed`              | `lib/modelProviders/videoModels.ts`              |
| `kling-v21-standard`           | image-to-video      | Requires `imageDataUrl`/`imageUrl`, `duration` (`5`), optional `negative_prompt`, `seed`                                                       | `lib/modelProviders/runwareVideo.ts`             |
| `kling-v21-pro`                | text/image-to-video | `duration` (`5`, `10`), optional `negative_prompt`, `seed`                                                                                     | `lib/modelProviders/runwareVideo.ts`             |
| `kling-v21-master`             | text/image-to-video | `duration` (`5` default), `negative_prompt`, `seed`, Runware tuning parameters                                                                 | `lib/modelProviders/runwareVideo.ts`             |
| `longstories-movie`            | scripted generation | `duration` (`30`, `60`, `180`, `300`, `600`), accepts `script`/`storyConfig` payloads (use `duration` instead of legacy `targetLengthInWords`) | `lib/modelProviders/longstoriesModel.ts`         |
| `longstories-pixel-art`        | scripted generation | `duration` (`15`, `30`, `60`, `180`, `300`, `600`), same structured payloads as `longstories-movie`                                            | `lib/modelProviders/longstoriesPixelArtModel.ts` |

### Wavespeed & Partner Models

| model                             | input types                                 | key request fields                                                                                                                                                 | code ref                                                                               |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `sora-2`                          | text-to-video, image-to-video               | `pro_mode` (boolean), `resolution` (`720p`, `1792x1024`), `orientation` (`landscape`, `portrait`), `seconds` (`4`, `8`, `12`), optional `imageDataUrl`/`imageUrl`  | `lib/modelProviders/sora2Video.ts`                                                     |
| `veo3-1-video`                    | text-to-video, image-to-video               | `duration` (`4`, `6`, `8`), `resolution` (`720p`, `1080p`), `aspect_ratio` (`16:9`, `9:16`), `generateAudio` (default `false`), optional `negative_prompt`, `seed` | `lib/modelProviders/wavespeedVeo31.ts`                                                 |
| `wan-wavespeed-s2v`               | image + audio → video                       | Requires `image` + `audio` (URL or data URI), optional `prompt`, `resolution` (`480p`, `720p`)                                                                     | `lib/modelProviders/wavespeedWanS2V.ts`                                                |
| `veed-fabric-1.0`                 | image + audio → talking head                | Requires `imageDataUrl`/`imageUrl` + `audioDataUrl`/`audioUrl`, `resolution` (`480p`, `720p`)                                                                      | `lib/modelProviders/wavespeedVeedFabric.ts`, `app/api/generate-video/route.ts`         |
| `bytedance-avatar-omni-human-1.5` | image + audio → avatar                      | Requires `image` + `audio`, duration derived from audio, optional `prompt`                                                                                         | `lib/modelProviders/videoModels.ts:1115`                                               |
| `kling-lipsync-t2v`               | focal video + script                        | Requires `video` URL, `prompt`/`text`, `voice_id`, `voice_language` (`en`, `zh`), `voice_speed` (`0.8-2.0`)                                                        | `lib/modelProviders/wavespeedKlingLipsync.ts`, `lib/modelProviders/videoModels.ts:881` |
| `kling-lipsync-a2v`               | focal video + audio                         | Requires `video` + `audio` URLs, 2-10 s clip length                                                                                                                | `lib/modelProviders/wavespeedKlingLipsync.ts`, `lib/modelProviders/videoModels.ts:938` |
| `wan-wavespeed-video-edit`        | video edit                                  | Requires source `video`, text prompt, `resolution` (`480p`, `720p`)                                                                                                | `lib/modelProviders/videoModels.ts:1075`                                               |
| `wan-wavespeed-22-spicy-extend`   | video extend                                | Requires source `video`, `resolution` (`480p`, `720p`), `duration` (`5`, `8`)                                                                                      | `lib/modelProviders/videoModels.ts:1094`                                               |
| `wan-wavespeed-22-plus`           | text/image generative                       | `resolution` (`480p`, `720p`, `1080p`), `orientation` (text-only), fixed 5 s clips, optional `enable_prompt_expansion`                                             | `lib/modelProviders/videoModels.ts:1024`, `lib/modelProviders/wavespeedWan22Plus.ts`   |
| `wan-wavespeed-22-animate`        | reference image + driver video              | Requires `image` + driver `video`, `resolution` (`480p`, `720p`), `mode` (`animate`, `replace`)                                                                    | `lib/modelProviders/videoModels.ts:1602`                                               |
| `wan-wavespeed-25`                | text/image generative                       | `resolution` (`480p`, `720p`, `1080p` via `resolution` or `size`), `duration` (`5`, `10`), optional `enable_prompt_expansion`                                      | `lib/modelProviders/videoModels.ts:1205`                                               |
| `lightricks-ltx-2-fast`           | text/image, optional audio                  | `duration` (`6-20` s), `generateAudio` toggle                                                                                                                      | `lib/modelProviders/videoModels.ts:1638`                                               |
| `lightricks-ltx-2-pro`            | text/image, optional audio                  | `duration` (`6`, `8`, `10` s), `generateAudio` toggle                                                                                                              | `lib/modelProviders/videoModels.ts:1664`                                               |
| `runwayml-gen4-aleph`             | video-to-video (+ optional reference image) | Requires `video`, optional `reference_image`, `aspect_ratio` (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `auto`)                                                         | `lib/modelProviders/wavespeedRunwayGen4Aleph.ts`                                       |
| `video-upscaler`                  | video-to-video                              | Requires `video`, `target_resolution` (`720p`, `1080p`, `2k`, `4k`); optional `videoDuration` / `billedDuration`                                                   | `lib/modelProviders/videoModels.ts:1186`, `app/api/generate-video/route.ts`            |
| `bytedance-seedance-upscaler`     | video-to-video                              | Requires `video`, `target_resolution` (`1080p`, `2k`, `4k`)                                                                                                        | `lib/modelProviders/videoModels.ts:1197`                                               |
| `bytedance-waver-1.0`             | image-to-video                              | Requires `image`, fixed 5 s duration                                                                                                                               | `lib/modelProviders/videoModels.ts:1231`                                               |
| `bytedance-seedance-v1-pro-fast`  | text/image                                  | `resolution` (`480p`, `720p`, `1080p`), `duration` (`2-12` s), `aspect_ratio` (`16:9`, `9:16`, `1:1`, `3:4`, `4:3`, `21:9`), `camera_fixed`                        | `lib/modelProviders/videoModels.ts:1260`                                               |
| `kling-v25-turbo-pro`             | text/image                                  | `duration` (`5`, `10`), `aspect_ratio` (`16:9`, `9:16`, `1:1`)                                                                                                     | `lib/modelProviders/videoModels.ts:1344`                                               |
| `kling-v25-turbo-std`             | image-to-video                              | Requires `image`, `duration` (`5`, `10`); Kling guidance handled within the Runware provider                                                                       | `lib/modelProviders/videoModels.ts:1391`, `lib/modelProviders/runwareVideo.ts`         |
| `minimax-hailuo-23-standard`      | text/image                                  | `duration` (`6`, `10`), optional `enable_prompt_expansion`                                                                                                         | `lib/modelProviders/wavespeedMinimaxHailuo23Standard.ts`                               |
| `minimax-hailuo-23-pro`           | text/image                                  | Fixed 5 s clips, optional `enable_prompt_expansion`                                                                                                                | `lib/modelProviders/wavespeedMinimaxHailuo23Pro.ts`                                    |

### FAL-hosted Models

| model                       | input types    | key request fields                                                                                                                                                                                                                                                             | code ref                                                                        |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `veo3-video`                | text/image     | `generateAudio`, `enhancePrompt`, `aspect_ratio` (`16:9`), `duration` (`5s-8s`), `resolution` (`720p`, `1080p`), optional `negative_prompt`, `seed`                                                                                                                            | `lib/modelProviders/veo3Video.ts`                                               |
| `veo3-fast-video`           | text/image     | `generateAudio`, `enhancePrompt`, `aspect_ratio` (`16:9`, `9:16`), `resolution` (`720p`, `1080p`)                                                                                                                                                                              | `lib/modelProviders/veo3FastVideo.ts`                                           |
| `veo2-video-image-to-video` | image-to-video | Requires `imageDataUrl`/`imageUrl`, `aspect_ratio` (`16:9`, `9:16`), `duration` (`5s-8s`)                                                                                                                                                                                      | `lib/modelProviders/veo2VideoImageToVideo.ts`                                   |
| `wan-video-22`              | text/image     | `resolution` (`480p`, `720p`), `orientation` (`landscape`, `portrait`), `duration` (`5`, `8`), optional `enable_prompt_expansion`                                                                                                                                              | `lib/modelProviders/wanVideo22.ts`                                              |
| `wan-video-22-5b`           | text/image     | `negative_prompt`, `num_frames` (`81-121`), `frames_per_second` (`4-60`), `resolution` (`580p`, `720p`), `aspect_ratio`, `num_inference_steps`, `enable_safety_checker`, `enable_prompt_expansion`, `guidance_scale`, `shift`, `interpolator_model`, `num_interpolated_frames` | `lib/modelProviders/wanVideo22-5b.ts`                                           |
| `wan-video-22-turbo`        | text/image     | `resolution` (`480p`, `580p`, `720p`), `aspect_ratio` (`auto`, `16:9`, `9:16`, `1:1`), `enable_safety_checker`, `enable_prompt_expansion`, optional `seed`                                                                                                                     | `lib/modelProviders/wanVideo22Turbo.ts`                                         |
| `seedance-video`            | text/image     | `resolution` (`480p`, `720p`), `aspect_ratio` (`16:9`, `1:1`, `3:4`, `9:16`, `21:9`, `9:21`), `duration` (`5`, `10`), `camera_fix`                                                                                                                                             | `lib/modelProviders/seedanceVideo.ts`                                           |
| `seedance-lite-video`       | text/image     | Default `resolution` `720p`, `aspect_ratio` `16:9`, `duration` `5`; supports `camera_fixed`, optional `seed`                                                                                                                                                                   | `lib/modelProviders/falSeedanceLiteVideo.ts`, `app/api/generate-video/route.ts` |
| `minimax-hailuo-02`         | text/image     | `duration` (`6`, `10`), `prompt_optimizer` toggle                                                                                                                                                                                                                              | `lib/modelProviders/minimaxHailuoVideo02.ts`                                    |
| `minimax-hailuo-02-pro`     | text/image     | Fixed `duration` `6`, `prompt_optimizer` toggle                                                                                                                                                                                                                                | `lib/modelProviders/minimaxHailuoVideo02Pro.ts`                                 |

### Runware-backed Models

| model              | input types         | key request fields                                                                                                                                                        | code ref                                                                      |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `kling-v21-master` | text/image-to-video | Documented above; Runware-specific tuning parameters are auto-populated                                                                                                   | `lib/modelProviders/runwareVideo.ts`, `lib/modelProviders/videoModels.ts:369` |
| `veo3-fast-video`  | text/image          | Same payload as the FAL variant; this route uses Runware infrastructure                                                                                                   | `lib/modelProviders/veo3FastVideo.ts`                                         |
| `vidu-video`       | text/image          | `size` (`16:9` / 1920×1080), `style` (`general`, `anime`), `movementAmplitude` (`auto`, `small`, `medium`, `large`), fixed 5 s duration                                   | `lib/modelProviders/viduVideo.ts`                                             |
| `pixverse-v45`     | text/image          | `size` presets (multiple aspect ratios), `duration` (`5`, `8`), `style`, `effectType`, `effect`, `cameraMovement`, `motionMode`, `soundEffectSwitch`, `soundEffectPrompt` | `lib/modelProviders/pixverseVideo.ts`                                         |
| `pixverse-v5`      | text/image          | Same field set as v4.5 with updated defaults                                                                                                                              | `lib/modelProviders/pixverseVideoV5.ts`                                       |

### Doubao / ByteDance (direct)

These models are also available outside Wavespeed; their field requirements mirror the entries above.

| model                             | input types            | notes                                                                                                                                       | code ref                                 |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `bytedance-avatar-omni-human-1.5` | image + audio → avatar | Requires `image` + `audio`, duration derived from audio length, optional `prompt`                                                           | `lib/modelProviders/videoModels.ts:1115` |
| `bytedance-waver-1.0`             | image-to-video         | Fixed 5 s duration, NSFW content may be filtered                                                                                            | `lib/modelProviders/videoModels.ts:1231` |
| `bytedance-seedance-v1-pro-fast`  | text/image             | `resolution` (`480p`, `720p`, `1080p`), `duration` (`2-12` s), `aspect_ratio` (`16:9`, `9:16`, `1:1`, `3:4`, `4:3`, `21:9`), `camera_fixed` | `lib/modelProviders/videoModels.ts:1260` |

### Other Providers

| model                      | input types    | key request fields                                                                                                     | code ref                                                                      |
| -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `midjourney-video`         | image-to-video | Requires `image` (`imageDataUrl` or library asset), `motion` (`low`, `high`)                                           | `lib/modelProviders/midjourneyVideo.ts`                                       |
| `magicapi-video-face-swap` | face swap      | Requires `swapImage`, `targetVideo`, optional `targetFaceIndex`; supports videos ≤ 4 min; pricing varies by resolution | `lib/modelProviders/magicapivideoModel.ts`, `app/api/generate-video/route.ts` |

## Async Processing & Status Polling

* The submission response includes `{ runId, model, status: "pending" }`.
* Poll `/video-status` with the returned `runId` until the job reaches `status: "succeeded"` or `status: "failed"`.
* Many providers emit intermediate states (`queued`, `processing`, `generating`, `delivering`). Persist them if you need audit trails.
* Failed jobs include an `error` object mirroring the upstream provider response. Surface the message and adjust prompts or inputs before retrying.
* Duration and resolution determine credit usage; reconcile charges against `lib/credits/videoPricingConfig.ts`.

## Content & Safety Notes

Wan 2.2 Turbo, Veo 3, Kling, and other providers may block prompts that violate content policies. Non-200 responses describe the violation reason; relay these messages verbatim to users or implement automated prompt adjustments.

## Next Steps

* Poll the Video Status endpoint after every submission to retrieve final assets.
* Keep customer-facing pricing tables in sync with `lib/credits/videoPricingConfig.ts`.
* Remove any external references to `promptchan-video`; the provider is disabled in code.


## OpenAPI

````yaml POST /generate-video
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
  /generate-video:
    post:
      description: >-
        Generate videos using various AI models including text-to-video and
        image-to-video capabilities across multiple providers (FAL, PromptChan,
        LongStories). Model capabilities: **LongStories** (longstories,
        longstories-kids): AI-powered short-form video creation with script
        generation, voice narration, and automated editing. **FAL Models**:
        kling-video (Kling 1.5 Pro text-to-video), kling-video-v2 (Kling 2.0
        text/image-to-video), veo2-video (Veo2 text/image-to-video),
        minimax-video (MiniMax T2V-01), hunyuan-video (Hunyuan text-to-video),
        hunyuan-video-image-to-video (Hunyuan image-to-video),
        wan-video-image-to-video (Wan image-to-video),
        kling-v21-standard/pro/master (Kling V2.1 variants). **PromptChan**:
        promptchan-video (adult content generation). All requests return
        immediately with status 'pending' - use the unified status endpoint to
        poll for completion.
      requestBody:
        description: Parameters for video generation across different models and providers
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VideoGenerationRequest'
        required: true
      responses:
        '202':
          description: >-
            Video generation request submitted successfully (asynchronous
            processing)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VideoGenerationResponse'
        '400':
          description: Bad Request - Invalid parameters or safety filter triggered
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized - Invalid or missing API key
        '500':
          description: Server Error - Video generation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - apiKeyAuth: []
components:
  schemas:
    VideoGenerationRequest:
      type: object
      required:
        - model
      properties:
        model:
          type: string
          description: The video model to use for generation
          enum:
            - longstories
            - longstories-kids
            - kling-video
            - kling-video-v2
            - veo2-video
            - minimax-video
            - hunyuan-video
            - hunyuan-video-image-to-video
            - wan-video-image-to-video
            - kling-v21-standard
            - kling-v21-pro
            - kling-v21-master
            - promptchan-video
          default: longstories
        prompt:
          type: string
          description: Text prompt describing the video to generate
          example: A serene lake at sunset with gentle ripples on the water
        script:
          type: string
          description: >-
            Fully-written script for LongStories models (takes precedence over
            prompt)
        conversationUUID:
          type: string
          description: UUID for conversation tracking
        projectId:
          type: string
          description: Project identifier for LongStories models
        framework:
          type: string
          description: Story framework for LongStories models
          enum:
            - default
            - emotional_story
            - product_showcase
            - tutorial
          default: default
        shortRequestEnhancer:
          type: boolean
          description: >-
            Smart Enhancement: if true, automatically choose better framework
            and add Director Notes if necessary
          default: false
        targetLengthInWords:
          type: integer
          description: Target length in words for LongStories models (legacy parameter)
          default: 70
        targetLengthInSeconds:
          type: integer
          description: Target length in seconds (alternative to words)
        directorNotes:
          type: string
          description: >-
            Prompt for the image generation engine (LongStories). Example: 'Warm
            lighting' or 'Make the first image very impactful'
          example: Warm, cozy lighting with focus on people interacting
        aspectRatio:
          type: string
          description: Video aspect ratio for LongStories
          enum:
            - '9:16'
            - '16:9'
          default: '9:16'
        scriptConfig:
          type: object
          description: Script generation configuration for LongStories
          properties:
            style:
              type: string
              description: Sets the tone & voice of the generated script
              enum:
                - default
                - no_style
                - engaging_conversational
                - dixit_biography
                - kind_biography
                - hero_journey
                - emotional_story
                - dramatic_reveal
                - heartwarming_stories
                - educational_history
                - news_brief
              default: default
            targetLengthInSeconds:
              type: integer
              description: >-
                Approx. time length of the script in seconds. The actual length
                may vary slightly.
              minimum: 5
              maximum: 600
              default: 30
        imageConfig:
          type: object
          description: Image generation configuration for LongStories
          properties:
            model:
              type: string
              description: Which image model to use for generating images
              enum:
                - flux_schnell
                - flux_lora
                - flux_pro
                - flux_pro_ultra
                - flux-kontext
                - recraft
                - sdxl
                - sdxl_lora
                - sd35_large
                - sd35_medium
                - sd35_large_turbo
                - leonardo_flux_precision
                - leonardo_phoenix_quality
                - leonardo_phoenix_ultra
                - reve-v1
                - hidream_fast
                - hidream_dev
                - hidream_full
                - gpt_image_1
                - imagen4_preview
                - midjourney
              default: hidream_dev
            loraConfig:
              type: object
              description: Style configuration (only applies when using Flux LoRA model)
              properties:
                loraSlug:
                  type: string
                  description: Specialized style to apply
                  enum:
                    - ghibsky-comic-book
                    - colour-sketches
                    - sketch-paint
                    - 90s-anime
                    - 2000s-crime-thrillers
                    - xno-symbol-flux
                  default: ghibsky-comic-book
        videoConfig:
          type: object
          description: Video generation configuration for LongStories
          properties:
            enabled:
              type: boolean
              description: Generate video motion from images instead of using static images
              default: true
            model:
              type: string
              description: Which video model to use for motion generation
              enum:
                - ltx_video_13b_distilled
                - ltx_video
                - stable_video
                - motion
                - kling_v1_6_std_5s
                - kling_v2_1_std_5s
                - ltx_video_13b_dev
                - skyreels
                - vidu
                - kling_v1_6_std_10s
                - kling_v2_1_std_10s
                - kling_v2_1_pro_5s
                - luma_ray2
                - kling_pro_5s
                - minimax
                - wan_i2v
                - motion_2
                - kling_v2_1_pro_10s
                - wan_pro
                - luma_ray2_hd
                - kling_pro_10s
                - kling_v2_1_master_5s
                - kling_v2_master_5s
                - veo2
                - kling_v2_1_master_10s
                - kling_v2_master_10s
              default: kling_v2_1_std_5s
        voiceoverConfig:
          type: object
          description: Voiceover configuration for LongStories
          properties:
            enabled:
              type: boolean
              description: Enable AI voiceover for the video
              default: true
            voiceId:
              type: string
              description: Voice for video narration
              enum:
                - 9BWtsMINqrJLrRacOk9x
                - CwhRBWXzGAHq8TQ4Fs17
                - EXAVITQu4vr4xnSDxMaL
                - FGY2WhTYpPnrIDTdsKH5
                - IKne3meq5aSn9XLyUdCD
                - JBFqnCBsd6RMkjVDRZzb
                - N2lVS1w4EtoT3dr4eOWO
                - SAz9YHcvj6GT2YYXdXww
                - TX3LPaxmHKxFdv7VOQHJ
                - XB0fDUnXU5powFXDhCwa
                - Xb7hH8MSUJpSbSDYk0k2
                - XrExE9yKIg1WjnnlVkGX
                - bIHbv24MWmeRgasZH58o
                - cgSgspJ2msm6clMCkdW9
                - cjVigY5qzO86Huf0OWal
                - nPczCjzI2devNBz1zQrb
                - onwK4e9ZLuTAKqWW03F9
                - pqHfZKP75CvOlQylNhV4
                - pFZP5JQG7iQjIQuC4Bku
                - KHCvMklQZZo0O30ERnVn
                - Nh2zY9kknu6z4pZy6FhD
                - LlZr3QuzbW4WrPjgATHG
                - YExhVa4bZONzeingloMX
                - m1VE7dnwBN0zMer3LcKv
                - zWDA589rUKXuLnPRDtAG
                - YYHkBdgrAwQWIaH6m2ai
              default: zWDA589rUKXuLnPRDtAG
        captionsConfig:
          type: object
          description: Captions configuration for LongStories
          properties:
            captionsEnabled:
              type: boolean
              description: Show text captions in the video
              default: true
            captionsStyle:
              type: string
              description: Style of video captions
              enum:
                - default
                - minimal
                - neon
                - cinematic
                - fancy
                - tiktok
                - highlight
                - gradient
                - intellectual
                - vida
                - manuscripts
                - subtitle
                - modern
                - bounce
                - popcorn
                - typewriter
                - handwritten
                - karaoke
                - retro
                - gaming
              default: tiktok
        effectsConfig:
          type: object
          description: Effects configuration for LongStories
          properties:
            transition:
              type: string
              description: Transition style between different images
              enum:
                - fade
                - random
                - slide
                - wipe
                - flip
                - none
              default: fade
            floating:
              type: boolean
              description: Make the images move around slightly with floating effects
              default: true
        musicConfig:
          type: object
          description: Music configuration for LongStories
          properties:
            enabled:
              type: boolean
              description: Add background music to the video
              default: true
            musicSlug:
              type: string
              description: Choose background music for your video
              enum:
                - ''
                - temple_of_treasures
                - gentle_ambient_loop
                - serene_ambience
                - soothing_ambience
                - soothing_ambient_backdrop
                - tranquil_ambience
                - dreamscape
                - belonging_resonance
                - vivid_memories
                - cinematic_intro
                - cinematic_teaser
                - dramatic_cinematic_score
                - thriller_cinema_trailer
                - fractured_paintings
                - promise_of_tomorrow
                - spooky_orchestral_theme
                - light_upbeat_melody
                - puzzle_time
                - stomping_drums_rhythm
                - stomps_and_claps_rhythm_track
                - news_theme
                - adventurous_intro
                - burlesque_sweetheart
                - highway_nocturne_national_sweetheart
                - haptic_sensation
              default: gentle_ambient_loop
            volume:
              type: number
              description: Volume level for background music
              minimum: 0
              maximum: 1
              default: 0.3
            loop:
              type: boolean
              description: Whether to loop the background music
              default: true
        voice:
          type: string
          description: 'Legacy: Voice ID for narration (use voiceoverConfig.voiceId instead)'
          example: pNInz6obpgDQGcFmaJgB
        captionsShow:
          type: boolean
          description: >-
            Legacy: Whether to show captions (use captionsConfig.captionsEnabled
            instead)
          default: true
        captionsStyle:
          type: string
          description: >-
            Legacy: Style for captions (use captionsConfig.captionsStyle
            instead)
          enum:
            - default
            - minimal
            - neon
            - cinematic
            - fancy
            - tiktok
            - highlight
            - gradient
            - instagram
            - vida
            - manuscripts
          default: default
        effects:
          type: object
          description: 'Legacy: Video effects configuration (use effectsConfig instead)'
          properties:
            transition:
              type: string
              default: fade
            floating:
              type: boolean
              default: false
        quality:
          type: string
          description: 'Legacy: Video quality (handled by videoConfig now)'
          enum:
            - low
            - medium
            - high
          default: medium
        motion:
          type: object
          description: 'Legacy: Motion configuration (handled by videoConfig now)'
          properties:
            enabled:
              type: boolean
              default: false
            strength:
              type: integer
              minimum: 1
              maximum: 10
              default: 3
        music:
          type: string
          description: 'Legacy: Music track (use musicConfig instead)'
          example: video-creation/music/dramatic_cinematic_score.mp3
        duration:
          oneOf:
            - type: string
            - type: integer
          description: >-
            Video duration (format varies by model - '5s' for Veo2, '5' for
            Kling, etc.)
          example: 5s
        aspect_ratio:
          type: string
          description: Aspect ratio for FAL models
          enum:
            - '16:9'
            - '9:16'
            - '1:1'
            - '4:3'
            - '3:4'
          default: '16:9'
        negative_prompt:
          type: string
          description: Negative prompt to avoid certain elements
          example: blur, distort, and low quality
        cfg_scale:
          type: number
          description: Classifier-free guidance scale
          minimum: 0
          maximum: 20
          default: 0.5
        imageDataUrl:
          type: string
          description: >-
            Base64 data URL of input image for image-to-video models. Aliases
            `image_data_url` and `image` are also accepted and normalized.
          example: data:image/jpeg;base64,/9j/4AAQ...
        imageUrl:
          type: string
          description: >-
            Public HTTPS URL of the input image (interchangeable with
            imageDataUrl). The service will prioritize whichever field you
            supply before falling back to library attachments.
          example: https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?w=1024
        imageAttachmentId:
          type: string
          description: Library attachment ID for input image
        prompt_optimizer:
          type: boolean
          description: Whether to optimize the prompt (MiniMax model)
          default: true
        num_inference_steps:
          type: integer
          description: Number of inference steps
          minimum: 1
          maximum: 50
          default: 30
        pro_mode:
          type: boolean
          description: Enable pro mode for Hunyuan Video
          default: false
        resolution:
          type: string
          description: Video resolution
          enum:
            - 720p
            - 1080p
            - 540p
          default: 720p
        num_frames:
          oneOf:
            - type: integer
            - type: string
          description: Number of frames to generate
          default: 81
        frames_per_second:
          type: integer
          description: Frames per second
          minimum: 5
          maximum: 24
          default: 16
        seed:
          type: integer
          description: Random seed for reproducible results
        enable_safety_checker:
          type: boolean
          description: Enable safety content filtering
          default: true
        showExplicitContent:
          type: boolean
          description: Allow explicit content (inverse of safety checker)
          default: false
        enable_prompt_expansion:
          type: boolean
          description: Enable automatic prompt expansion
        acceleration:
          type: boolean
          description: Enable acceleration for faster processing
        shift:
          type: number
          description: Shift parameter for certain models
        age_slider:
          type: integer
          description: Age setting for PromptChan model
          minimum: 18
          maximum: 60
          default: 18
        audioEnabled:
          type: boolean
          description: Enable audio for PromptChan model
          default: false
        video_quality:
          type: string
          description: Video quality for PromptChan model
          enum:
            - Standard
            - High
          default: Standard
        aspect:
          type: string
          description: Aspect setting for PromptChan model
          enum:
            - Portrait
            - Landscape
            - Square
          default: Portrait
    VideoGenerationResponse:
      type: object
      required:
        - runId
        - status
        - model
      properties:
        runId:
          type: string
          description: Unique identifier for the video generation request
        projectId:
          type: string
          description: Project identifier (for LongStories models)
        status:
          type: string
          description: Current status of the generation
          enum:
            - pending
            - processing
            - completed
            - failed
          default: pending
        model:
          type: string
          description: The model used for generation
        cost:
          type: number
          description: Cost of the video generation
        paymentSource:
          type: string
          description: Payment source used (USD or XNO)
        remainingBalance:
          type: number
          description: Remaining balance after the generation
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