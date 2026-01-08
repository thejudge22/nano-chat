# Chat Completion

> Creates a chat completion for the provided messages

### Tool calling

The `/api/v1/chat/completions` endpoint supports OpenAI-compatible function calling. You can describe callable functions in the `tools` array, control when the model may invoke them, and continue the conversation by echoing `tool` role messages that reference the assistant's chosen call.

#### Request parameters

* `tools` (optional array): Each entry must be `{ "type": "function", "function": { "name": string, "description"?: string, "parameters"?: JSON-Schema object } }`. Only `function` tools are accepted. The serialized `tools` payload is limited to 200 KB (overrides via `TOOL_SPEC_MAX_BYTES`); violating the shape or size yields a 400 with `tool_spec_too_large`, `invalid_tool_spec`, or `invalid_tool_spec_parse`.
* `tool_choice` (optional string or object): Defaults to `auto`. Set `"none"` to guarantee no tool calls (the server also drops the `tools` payload upstream), `"required"` to force the next response to be a tool call, or `{ "type": "function", "function": { "name": "your_function" } }` to pin the exact function.
* `parallel_tool_calls` (optional boolean): When `true` the flag is forwarded to providers that support issuing multiple tool calls in a single turn. Models that ignore the flag fall back to sequential calls.
* `messages[].tool_calls` (assistant role): Persist the tool call metadata returned by the model so future turns can see which functions were invoked. Each item uses the OpenAI shape `{ id, type: "function", function: { name, arguments } }`.
* `messages[]` with `role: "tool"`: Respond to the model by sending `{ "role": "tool", "tool_call_id": "<assistant tool_calls id>", "content": "<JSON or text payload>" }`. The server drops any tool response that references an unknown `tool_call_id`, so keep the IDs in sync.
* Validation behavior: If you send `tool_choice: "none"` with a `tools` array the request is accepted but the tools are omitted before hitting the model; invalid schemas or oversize payloads return the error codes above.

#### Example request

```http  theme={null}
POST /api/v1/chat/completions
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "What's the temperature in San Francisco right now?" }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "lookup_weather",
        "description": "Fetch the current weather for a city.",
        "parameters": {
          "type": "object",
          "properties": {
            "city": { "type": "string" },
            "unit": { "type": "string", "enum": ["c", "f"] }
          },
          "required": ["city"]
        }
      }
    }
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": true
}
```

#### Example assistant/tool turn

```json  theme={null}
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "lookup_weather",
        "arguments": "{\"city\":\"San Francisco\",\"unit\":\"f\"}"
      }
    }
  ]
}
```

```json  theme={null}
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"city\":\"San Francisco\",\"temperatureF\":58,\"conditions\":\"foggy\"}"
}
```

Streaming responses emit delta events that mirror OpenAI's `tool_calls` schema, so consumers can reuse their existing parsing logic without changes.

## Overview

The Chat Completion endpoint provides OpenAI-compatible chat completions.

## Sampling & Decoding Controls

The `/api/v1/chat/completions` endpoint accepts a full set of sampling and decoding knobs. All fields are optional; omit any you want to leave at provider defaults.

### Temperature & Nucleus

| Parameter                       | Range/Default     | Description                                                                           |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `temperature`                   | 0–2 (default 0.7) | Classic randomness control; higher values explore more.                               |
| `top_p`                         | 0–1 (default 1)   | Nucleus sampling that trims to the smallest set above `top_p` cumulative probability. |
| `top_k`                         | 1+                | Sample only from the top-k tokens each step.                                          |
| `top_a`                         | provider default  | Blends temperature and nucleus behavior; set only if a model calls for it.            |
| `min_p`                         | 0–1               | Require each candidate token to exceed a probability floor.                           |
| `tfs`                           | 0–1               | Tail free sampling; 1 disables.                                                       |
| `eta_cutoff` / `epsilon_cutoff` | provider default  | Drop tokens once they fall below the tail thresholds.                                 |
| `typical_p`                     | 0–1               | Entropy-based nucleus sampling; keeps tokens whose surprise matches expected entropy. |
| `mirostat_mode`                 | 0/1/2             | Enable Mirostat sampling; set tau/eta when active.                                    |
| `mirostat_tau` / `mirostat_eta` | provider default  | Target entropy and learning rate for Mirostat.                                        |

### Length & Stopping

| Parameter                    | Range/Default           | Description                                                       |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `max_tokens`                 | 1+ (default 4000)       | Upper bound on generated tokens.                                  |
| `min_tokens`                 | 0+ (default 0)          | Minimum completion length when provider supports it.              |
| `stop`                       | string or string\[]     | Stop sequences passed upstream.                                   |
| `stop_token_ids`             | int\[]                  | Stop generation on specific token IDs (limited provider support). |
| `include_stop_str_in_output` | boolean (default false) | Keep the stop sequence in the final text where supported.         |
| `ignore_eos`                 | boolean (default false) | Continue even if the model predicts EOS internally.               |

### Penalties & Repetition Guards

| Parameter              | Range/Default      | Description                                                    |
| ---------------------- | ------------------ | -------------------------------------------------------------- |
| `frequency_penalty`    | -2 – 2 (default 0) | Penalize tokens proportional to prior frequency.               |
| `presence_penalty`     | -2 – 2 (default 0) | Penalize tokens based on whether they appeared at all.         |
| `repetition_penalty`   | -2 – 2             | Provider-agnostic repetition modifier; >1 discourages repeats. |
| `no_repeat_ngram_size` | 0+                 | Forbid repeating n-grams of the given size (limited support).  |
| `custom_token_bans`    | int\[]             | Fully block listed token IDs.                                  |

### Logit Shaping & Determinism

| Parameter         | Range/Default  | Description                                               |
| ----------------- | -------------- | --------------------------------------------------------- |
| `logit_bias`      | object         | Map token IDs to additive logits (OpenAI-compatible).     |
| `logprobs`        | boolean or int | Return token-level logprobs where supported.              |
| `prompt_logprobs` | boolean        | Request logprobs on the prompt when available.            |
| `seed`            | integer        | Make completions repeatable where the provider allows it. |

### Usage notes

* Parameters can be combined (e.g., `temperature` + `top_p` + `top_k`), but overly narrow settings may lead to early stops.
* Invalid ranges yield a 400 before reaching the provider.
* Provider defaults apply to any omitted field.

### Example request

```bash  theme={null}
curl -X POST https://nano-gpt.com/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Write a creative story about space exploration"}
    ],
    "temperature": 0.8,
    "top_p": 0.9,
    "top_k": 40,
    "tfs": 0.8,
    "typical_p": 0.95,
    "mirostat_mode": 2,
    "mirostat_tau": 5,
    "mirostat_eta": 0.1,
    "max_tokens": 500,
    "frequency_penalty": 0.3,
    "presence_penalty": 0.1,
    "repetition_penalty": 1.1,
    "stop": ["###"],
    "seed": 42
  }'
```

## Web Search

All models can access real-time web information by appending special suffixes to the model name:

* **`:online`** - Standard web search (\$0.006 per request)
  * Returns 10 search results
  * Perfect for straightforward questions
* **`:online/linkup-deep`** - Deep web search (\$0.06 per request)
  * Iteratively searches for comprehensive information
  * Ideal when initial results aren't sufficient

### Examples

<CodeGroup>
  ```python Python theme={null}
  import requests
  import json

  BASE_URL = "https://nano-gpt.com/api/v1"
  API_KEY = "YOUR_API_KEY"

  headers = {
      "Authorization": f"Bearer {API_KEY}",
      "Content-Type": "application/json"
  }

  # Standard web search
  data = {
      "model": "chatgpt-4o-latest:online",
      "messages": [
          {"role": "user", "content": "What are the latest developments in AI?"}
      ]
  }

  response = requests.post(
      f"{BASE_URL}/chat/completions",
      headers=headers,
      json=data
  )

  # Deep web search
  data_deep = {
      "model": "chatgpt-4o-latest:online/linkup-deep",
      "messages": [
          {"role": "user", "content": "Provide a comprehensive analysis of recent AI breakthroughs"}
      ]
  }
  ```

  ```javascript JavaScript theme={null}
  const BASE_URL = "https://nano-gpt.com/api/v1";
  const API_KEY = "YOUR_API_KEY";

  // Standard web search
  const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          model: 'chatgpt-4o-latest:online',
          messages: [
              { role: 'user', content: 'What are the latest developments in AI?' }
          ]
      })
  });

  // Deep web search
  const deepResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          model: 'chatgpt-4o-latest:online/linkup-deep',
          messages: [
              { role: 'user', content: 'Provide a comprehensive analysis of recent AI breakthroughs' }
          ]
      })
  });
  ```

  ```bash cURL theme={null}
  # Standard web search
  curl -X POST https://nano-gpt.com/api/v1/chat/completions \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "chatgpt-4o-latest:online",
      "messages": [
        {"role": "user", "content": "What are the latest developments in AI?"}
      ]
    }'

  # Deep web search
  curl -X POST https://nano-gpt.com/api/v1/chat/completions \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "chatgpt-4o-latest:online/linkup-deep",
      "messages": [
        {"role": "user", "content": "Provide a comprehensive analysis of recent AI breakthroughs"}
      ]
    }'
  ```
</CodeGroup>

## Image Input

Send images using the OpenAI‑compatible chat format. Provide image parts alongside text in the `messages` array.

### Supported Forms

* Remote URL: `{"type":"image_url","image_url":{"url":"https://..."}}`
* Base64 data URL: `{"type":"image_url","image_url":{"url":"data:image/png;base64,...."}}`

Notes:

* Prefer HTTPS URLs; some upstreams reject non‑HTTPS. If in doubt, use base64 data URLs.
* Accepted mime types: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`.
* Inline markdown images in plain text (e.g., `![alt](data:image/...;base64,...)`) are auto‑normalized into structured parts server‑side.

### Message Shape

```json  theme={null}
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What is in this image?" },
    { "type": "image_url", "image_url": { "url": "https://example.com/image.jpg" } }
  ]
}
```

### cURL — Image URL (non‑streaming)

```bash  theme={null}
curl -sS \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST https://nano-gpt.com/api/v1/chat/completions \
  --data '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Describe this image in three words."},
          {"type": "image_url", "image_url": {"url": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg"}}
        ]
      }
    ],
    "stream": false
  }'
```

### cURL — Base64 Data URL (non‑streaming)

Embed your image as a data URL. Replace `...BASE64...` with your image bytes.

```bash  theme={null}
curl -sS \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type": "application/json" \
  -X POST https://nano-gpt.com/api/v1/chat/completions \
  --data '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "What is shown here?"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,...BASE64..."}}
        ]
      }
    ],
    "stream": false
  }'
```

### cURL — Streaming SSE

```bash  theme={null}
curl -N \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -X POST https://nano-gpt.com/api/v1/chat/completions \
  --data '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Two words only."},
          {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
        ]
      }
    ],
    "stream": true,
    "stream_options": { "include_usage": true }
  }'
```

The response streams `data: { ... }` lines until a final terminator. Usage metrics appear only when requested: set `stream_options.include_usage` to `true` for streaming responses, or send `"include_usage": true` on non-streaming calls.

*Note: Prompt-caching helpers implicitly force `include_usage`, so cached requests still receive usage data without extra flags.*

### Prompt Caching (Claude Models)

Claude caching works exactly like Anthropic's `/v1/messages`: you must place `cache_control` objects on the content blocks you want the model to reuse, or instruct NanoGPT to do it for you via the `prompt_caching` helper.

> **Note:** NanoGPT's automatic failover system ensures high availability but may occasionally cause cache misses. If you're seeing unexpected cache misses in your usage logs, see the "Cache Consistency with `stickyProvider`" section below.

The `prompt_caching` / `promptCaching` helper accepts these options:

| Parameter                 | Type    | Default | Description                                                                                                                      |
| ------------------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                 | boolean | —       | Enable prompt caching                                                                                                            |
| `ttl`                     | string  | `"5m"`  | Cache time-to-live: `"5m"` or `"1h"`                                                                                             |
| `cut_after_message_index` | integer | —       | Zero-based index; cache all messages up to and including this index                                                              |
| `stickyProvider`          | boolean | `false` | **New:** When `true`, disable automatic failover to preserve cache consistency. Returns 503 error instead of switching services. |

```python  theme={null}
headers = {
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json",
  "anthropic-beta": "prompt-caching-2024-07-31"
}

payload = {
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "Reference handbook + rules of engagement.",
          "cache_control": {"type": "ephemeral", "ttl": "5m"}
        }
      ]
    },
    {"role": "user", "content": "Live request goes here"}
  ]
}

requests.post("https://nano-gpt.com/api/v1/chat/completions", headers=headers, json=payload)
```

* Each `cache_control` marker caches the full prefix up to that block. Place them on every static chunk (system messages, tool definitions, large contexts) you plan to reuse.
* Anthropic currently supports TTLs of `5m` (1.25× one-time billing) and `1h` (2× one-time). Replays show the discounted tokens inside `usage.prompt_tokens_details.cached_tokens`.
* The `anthropic-beta: prompt-caching-2024-07-31` header is mandatory on requests that include caching metadata.

For a simpler experience, send the helper fields and NanoGPT will stamp the first *N* messages for you before reaching Anthropic:

```ts  theme={null}
await client.chat.completions.create(
  {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'system', content: 'Static rubric lives here.' },
      { role: 'user', content: 'Additional reusable context.' },
      { role: 'user', content: 'This turn is not cached.' },
    ],
    prompt_caching: {
      enabled: true,
      ttl: '1h',
      cut_after_message_index: 1,
    },
  },
  {
    headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  },
);
```

`cut_after_message_index` is zero-based and NanoGPT does not guess—everything at or before that index is cached, everything after is not. Switch back to explicit `cache_control` blocks if you need multiple cache breakpoints or mixed TTLs in the same payload.

### Cache Consistency with `stickyProvider`

NanoGPT automatically fails over to backup services when the primary service is temporarily unavailable. While this ensures high availability, it can break your prompt cache because **each backend service maintains its own separate cache**.

If cache consistency is more important than availability for your use case, you can enable the `stickyProvider` option:

```json  theme={null}
{
  "model": "claude-sonnet-4-5-20250929",
  "messages": [...],
  "prompt_caching": {
    "enabled": true,
    "ttl": "5m",
    "stickyProvider": true
  }
}
```

**Behavior:**

* **`stickyProvider: false` (default)** — If the primary service fails, NanoGPT automatically retries with a backup service. Your request succeeds, but the cache may be lost (you'll pay full price for that request and need to rebuild the cache).
* **`stickyProvider: true`** — If the primary service fails, NanoGPT returns a 503 error instead of failing over. Your cache remains intact for when the service recovers.

**When to use `stickyProvider: true`:**

* You have very large cached contexts where cache misses are expensive
* You prefer to retry failed requests yourself rather than pay for cache rebuilds
* Cost predictability is more important than request success rate

**When to use `stickyProvider: false` (default):**

* You prefer requests to always succeed when possible
* Occasional cache misses are acceptable
* You're using shorter contexts where cache rebuilds are inexpensive

**Error response when stickyProvider blocks a failover:**

```json  theme={null}
{
  "error": {
    "message": "Service is temporarily unavailable. Fallback disabled to preserve prompt cache consistency. Switching services would invalidate your cached tokens. Remove stickyProvider option or retry later.",
    "status": 503,
    "type": "service_unavailable",
    "code": "fallback_blocked_for_cache_consistency"
  }
}
```

### Troubleshooting

* 400 unsupported image: ensure the image is a valid PNG/JPEG/WebP, not a tiny 1×1 pixel, and either HTTPS URL or a base64 data URL.
* 503 after fallbacks: try a different model, verify API key/session, and prefer base64 data URL for local or protected assets.
* Missing usage events: confirm `include_usage` is `true` in the payload or that prompt caching is enabled.

## Context Memory

Enable unlimited-length conversations with lossless, hierarchical memory.

* Append `:memory` to any model name
* Or send header `memory: true`
* Can be combined with web search: `:online:memory`
* Retention: default 30 days; configure via `:memory-<days>` (1..365) or header `memory_expiration_days: <days>`; header takes precedence

<CodeGroup>
  ```python Python theme={null}
  import requests

  BASE_URL = "https://nano-gpt.com/api/v1"
  API_KEY = "YOUR_API_KEY"

  headers = {
      "Authorization": f"Bearer {API_KEY}",
      "Content-Type": "application/json"
  }

  # Suffix-based
  payload = {
      "model": "chatgpt-4o-latest:memory",
      "messages": [{"role": "user", "content": "Keep our previous discussion in mind and continue."}]
  }
  requests.post(f"{BASE_URL}/chat/completions", headers=headers, json=payload)
  ```

  ```javascript JavaScript theme={null}
  const BASE_URL = "https://nano-gpt.com/api/v1";
  const API_KEY = "YOUR_API_KEY";

  // Header-based (with optional retention override)
  await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'memory': 'true',
      'memory_expiration_days': '45'
    },
    body: JSON.stringify({
      model: 'chatgpt-4o-latest',
      messages: [{ role: 'user', content: 'Continue with full history awareness.' }]
    })
  });
  ```

  ```bash cURL theme={null}
  # Combine with web search (and set retention to 90 days via suffix)
  curl -X POST https://nano-gpt.com/api/v1/chat/completions \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "chatgpt-4o-latest:online:memory-90",
      "messages": [
        {"role": "user", "content": "Research and continue our plan without losing context."}
      ]
    }'

  # Header-based retention override (header takes precedence)
  curl -X POST https://nano-gpt.com/api/v1/chat/completions \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -H "memory: true" \
    -H "memory_expiration_days: 45" \
    -d '{
      "model": "chatgpt-4o-latest",
      "messages": [
        {"role": "user", "content": "Use memory with 45-day retention."}
      ]
    }'
  ```
</CodeGroup>

### Custom Context Size Override

When Context Memory is enabled, you can override the model-derived context size used for the memory compression step with `model_context_limit`.

* Parameter: `model_context_limit` (number or numeric string)
* Default: Derived from the selected model’s context size
* Minimum: Values below 10,000 are clamped internally
* Scope: Only affects memory compression; does not change the target model’s own window

Examples:

```bash  theme={null}
# Enable memory via header; use model default context size
curl -s -X POST \
  -H "Authorization: Bearer $NANOGPT_API_KEY" \
  -H "Content-Type: application/json" \
  -H "memory: true" \
  https://nano-gpt.com/api/v1/chat/completions \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Briefly say hello."}],
    "stream": false
  }'

# Explicit numeric override
curl -s -X POST \
  -H "Authorization: Bearer $NANOGPT_API_KEY" \
  -H "Content-Type: application/json" \
  -H "memory: true" \
  https://nano-gpt.com/api/v1/chat/completions \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Briefly say hello."}],
    "model_context_limit": 20000,
    "stream": false
  }'

# String override (server coerces to number)
curl -s -X POST \
  -H "Authorization: Bearer $NANOGPT_API_KEY" \
  -H "Content-Type: application/json" \
  -H "memory: true" \
  https://nano-gpt.com/api/v1/chat/completions \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Briefly say hello."}],
    "model_context_limit": "30000",
    "stream": false
  }'
```

## Reasoning Streams

The Chat Completions endpoint separates the model’s visible answer from its internal reasoning. By default, reasoning is included and delivered alongside normal content so that clients can decide whether to display it. Requests that use the `thinking` model suffix (for example `:thinking` or `-thinking:8192`) are normalized before dispatch, but the response contract remains the same.

### Endpoint variants

Choose the base path that matches how your client consumes reasoning streams:

* `https://nano-gpt.com/api/v1/chat/completions` — default endpoint that streams internal thoughts through `choices[0].delta.reasoning` (and repeats them in `message.reasoning` on completion). Recommended for apps like SillyTavern that understand the modern response shape.
* `https://nano-gpt.com/api/v1legacy/chat/completions` — legacy contract that swaps the field name to `choices[0].delta.reasoning_content` / `message.reasoning_content` for older OpenAI-compatible clients. Use this for LiteLLM’s OpenAI adapter to avoid downstream parsing errors.
* `https://nano-gpt.com/api/v1thinking/chat/completions` — reasoning-aware models write everything into the normal `choices[0].delta.content` stream so clients that ignore reasoning fields still see the full conversation transcript. This is the preferred base URL for JanitorAI.

### Streaming payload format

Server-Sent Event (SSE) streams emit the answer in `choices[0].delta.content` and the thought process in `choices[0].delta.reasoning` (plus optional `delta.reasoning_details`). Reasoning deltas are dispatched before or alongside regular content, letting you render both panes in real-time.

```text  theme={null}
data: {
  "choices": [{
    "delta": {
      "reasoning": "Assessing possible tool options…"
    }
  }]
}
data: {
  "choices": [{
    "delta": {
      "content": "Let me walk you through the solution."
    }
  }]
}
```

When streaming completes, the formatter aggregates the collected values and repeats them in the final payload: `choices[0].message.content` contains the assistant reply and `choices[0].message.reasoning` (plus `reasoning_details` when available) contains the full chain-of-thought. Non-streaming requests reuse the same formatter, so the reasoning block is present as a dedicated field.

### Showing or hiding reasoning

Send `reasoning: { "exclude": true }` to strip the reasoning payload from both streaming deltas and the final message. With this flag set, `delta.reasoning` and `message.reasoning` are omitted entirely.

```bash  theme={null}
curl -X POST https://nano-gpt.com/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "reasoning": {"exclude": true}
  }'
```

**Without reasoning.exclude**:

```json  theme={null}
{
  "choices": [{
    "message": {
      "content": "The answer is 4.",
      "reasoning": "The user is asking for a simple addition. 2+2 equals 4."
    }
  }]
}
```

**With reasoning.exclude**:

```json  theme={null}
{
  "choices": [{
    "message": {
      "content": "The answer is 4."
    }
  }]
}
```

### Reasoning Effort

Control how much computational effort the model puts into reasoning before generating a response. Higher values result in more thorough reasoning but slower responses and higher costs. Only applicable to reasoning-capable models.

#### Parameter: `reasoning_effort`

| Value     | Description                                                                      |
| --------- | -------------------------------------------------------------------------------- |
| `none`    | Disables reasoning entirely                                                      |
| `minimal` | Allocates \~10% of max\_tokens for reasoning                                     |
| `low`     | Allocates \~20% of max\_tokens for reasoning                                     |
| `medium`  | Allocates \~50% of max\_tokens for reasoning (default when reasoning is enabled) |
| `high`    | Allocates \~80% of max\_tokens for reasoning                                     |

#### Usage

The `reasoning_effort` parameter can be passed at the top level:

```bash  theme={null}
curl -X POST https://nano-gpt.com/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "o3-mini",
    "messages": [
      {"role": "user", "content": "Explain quantum entanglement step by step"}
    ],
    "reasoning_effort": "high",
    "max_tokens": 4096
  }'
```

Alternatively, pass it as part of the `reasoning` object:

```json  theme={null}
{
  "model": "o3-mini",
  "messages": [{"role": "user", "content": "Solve this complex math problem..."}],
  "reasoning": {
    "effort": "high"
  }
}
```

Both formats are equivalent.

#### Combining effort with exclude

You can control both reasoning depth and visibility:

```json  theme={null}
{
  "model": "deepseek-reasoner",
  "messages": [{"role": "user", "content": "..."}],
  "reasoning": {
    "effort": "high",
    "exclude": false
  }
}
```

Sending `reasoning_effort` to models that don't support reasoning will have no effect (the parameter is ignored).

### Model suffix: `:reasoning-exclude`

You can toggle the filter without altering your JSON body by appending `:reasoning-exclude` to the `model` name.

* Equivalent to sending `{ "reasoning": { "exclude": true } }`
* Only the `:reasoning-exclude` suffix is stripped before the request is routed; other suffixes remain active
* Works for streaming and non-streaming responses on both Chat Completions and Text Completions

```json  theme={null}
{
  "model": "claude-3-5-sonnet-20241022:reasoning-exclude",
  "messages": [{ "role": "user", "content": "What is 2+2?" }]
}
```

#### Combine with other suffixes

`:reasoning-exclude` composes safely with the other routing suffixes you already use:

* `:thinking` (and variants like `…-thinking:8192`)
* `:online` and `:online/linkup-deep`
* `:memory` and `:memory-<days>`

Examples:

* `claude-3-7-sonnet-thinking:8192:reasoning-exclude`
* `gpt-4o:online:reasoning-exclude`
* `claude-3-5-sonnet-20241022:memory-30:online/linkup-deep:reasoning-exclude`

### Legacy delta field compatibility

Older clients that expect the legacy `reasoning_content` field can opt in per request. Set `reasoning.delta_field` to `"reasoning_content"`, or use the top-level shorthands `reasoning_delta_field` / `reasoning_content_compat` if updating nested objects is difficult. When the toggle is active, every streaming and non-streaming response exposes `reasoning_content` instead of `reasoning`, and the modern key is omitted. The compatibility pass is skipped if `reasoning.exclude` is `true`, because no reasoning payload is emitted. If you cannot change the request payload, target `https://nano-gpt.com/api/v1legacy/chat/completions` instead—the legacy endpoint keeps `reasoning_content` without extra flags. LiteLLM’s OpenAI adapter should point here to maintain compatibility. For clients that ignore reasoning-specific fields entirely, use `https://nano-gpt.com/api/v1thinking/chat/completions` so the full text appears in the standard content stream; this is the correct choice for JanitorAI.

```json  theme={null}
{
  "model": "openai/gpt-4o-mini",
  "messages": [...],
  "reasoning": {
    "delta_field": "reasoning_content"
  }
}
```

#### Notes and limitations

* GPU-TEE models (`phala/*`) require byte-for-byte SSE passthrough for signature verification. For those models, streaming cannot be filtered; the suffix has no effect on the streaming bytes.
* When assistant content is an array (e.g., vision/text parts), only text parts are filtered; images and tool/metadata content are untouched.

## YouTube Transcripts

Automatically fetch and prepend YouTube video transcripts when the latest user message contains YouTube links.

### Defaults

* Parameter: `youtube_transcripts` (boolean)
* Default: `false` (opt-in)
* Opt-in: set `youtube_transcripts` to `true` (string `"true"` is also accepted) to fetch transcripts
* Limit: Up to 3 YouTube URLs processed per request
* Injection: Transcripts are added as a system message before your messages
* Billing: \$0.01 per transcript fetched

### Enable automatic transcripts

By default, YouTube links are ignored. Set `youtube_transcripts` to `true` when you want the system to retrieve and bill for transcripts.

```bash  theme={null}
curl -X POST https://nano-gpt.com/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Summarize this: https://youtu.be/dQw4w9WgXcQ"}
    ],
    "youtube_transcripts": true
  }'
```

### Notes

* Web scraping is separate. To scrape non‑YouTube URLs, set `scraping: true`. YouTube transcripts do not require `scraping: true`.
* When not requested, YouTube links are ignored for transcript fetching and are not billed.
* If your balance is insufficient when enabled, the request may be blocked with a 402.

## Performance Benchmarks

LinkUp achieves state-of-the-art performance on OpenAI's SimpleQA benchmark:

| Provider               | Score  |
| ---------------------- | ------ |
| LinkUp Deep Search     | 90.10% |
| Exa                    | 90.04% |
| Perplexity Sonar Pro   | 86%    |
| LinkUp Standard Search | 85%    |
| Perplexity Sonar       | 77%    |
| Tavily                 | 73%    |

## Important Notes

* Web search increases input token count, which affects total cost
* Models gain access to real-time information published less than a minute ago
* Internet connectivity can provide up to 10x improvement in factuality
* All models support web search - simply append the suffix to any model name


## OpenAPI

````yaml POST /v1/chat/completions
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
  /v1/chat/completions:
    post:
      description: Creates a chat completion for the provided messages
      requestBody:
        description: Parameters for chat completion
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChatCompletionRequest'
        required: true
      responses:
        '200':
          description: Chat completion response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChatCompletionResponse'
        '400':
          description: Unexpected error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - bearerAuth: []
components:
  schemas:
    ChatCompletionRequest:
      type: object
      required:
        - model
        - messages
      properties:
        model:
          type: string
          description: >-
            The model to use for completion. Append ':online' for web search
            ($0.005/request) or ':online/linkup-deep' for deep web search
            ($0.05/request)
          default: chatgpt-4o-latest
          examples:
            - chatgpt-4o-latest
            - chatgpt-4o-latest:online
            - chatgpt-4o-latest:online/linkup-deep
            - claude-3-5-sonnet-20241022:online
        messages:
          type: array
          description: Array of message objects with role and content
          default:
            - role: user
              content: Testing, please reply!
          items:
            type: object
            required:
              - role
              - content
            properties:
              role:
                type: string
                description: The role of the message author
                enum:
                  - system
                  - user
                  - assistant
              content:
                description: >-
                  Message content as a simple string or an array of multimodal
                  parts
                oneOf:
                  - type: string
                  - type: array
                    items:
                      $ref: '#/components/schemas/MessageContentPart'
        stream:
          type: boolean
          description: Whether to stream the response
          default: false
        temperature:
          type: number
          description: >-
            Classic randomness control. Accepts any decimal between 0-2. Lower
            numbers bias toward deterministic responses, higher values explore
            more aggressively
          minimum: 0
          maximum: 2
          default: 0.7
        max_tokens:
          type: integer
          description: Upper bound on generated tokens
          default: 4000
          minimum: 1
        top_p:
          type: number
          description: >-
            Nucleus sampling. When set below 1.0, trims candidate tokens to the
            smallest set whose cumulative probability exceeds top_p. Works well
            as an alternative to tweaking temperature
          minimum: 0
          maximum: 1
          default: 1
        frequency_penalty:
          type: number
          description: >-
            Penalizes tokens proportionally to how often they appeared
            previously. Negative values encourage repetition; positive values
            discourage it
          minimum: -2
          maximum: 2
          default: 0
        presence_penalty:
          type: number
          description: >-
            Penalizes tokens based on whether they appeared at all. Good for
            keeping the model on topic without outright banning words
          minimum: -2
          maximum: 2
          default: 0
        repetition_penalty:
          type: number
          description: >-
            Provider-agnostic repetition modifier (distinct from OpenAI
            penalties). Values >1 discourage repetition
          minimum: -2
          maximum: 2
        top_k:
          type: integer
          description: Caps sampling to the top-k highest probability tokens per step
        top_a:
          type: number
          description: >-
            Combines top-p and temperature behavior; leave unset unless a model
            description explicitly calls for it
        min_p:
          type: number
          description: >-
            Ensures each candidate token probability exceeds a floor (0-1).
            Helpful for stopping models from collapsing into low-entropy loops
          minimum: 0
          maximum: 1
        tfs:
          type: number
          description: >-
            Tail free sampling. Values between 0-1 let you shave the long tail
            of the distribution; 1.0 disables the feature
          minimum: 0
          maximum: 1
        eta_cutoff:
          type: number
          description: >-
            Cut probabilities as soon as they fall below the specified tail
            threshold
        epsilon_cutoff:
          type: number
          description: >-
            Cut probabilities as soon as they fall below the specified tail
            threshold
        typical_p:
          type: number
          description: >-
            Typical sampling (aka entropy-based nucleus). Works like top_p but
            preserves tokens whose surprise matches the expected entropy
          minimum: 0
          maximum: 1
        mirostat_mode:
          type: integer
          description: >-
            Enables Mirostat sampling for models that support it. Set to 1 or 2
            to activate
          enum:
            - 0
            - 1
            - 2
        mirostat_tau:
          type: number
          description: >-
            Mirostat target entropy parameter. Used when mirostat_mode is
            enabled
        mirostat_eta:
          type: number
          description: Mirostat learning rate parameter. Used when mirostat_mode is enabled
        min_tokens:
          type: integer
          description: >-
            For providers that support it, enforces a minimum completion length
            before stop conditions fire
          default: 0
          minimum: 0
        stop:
          description: >-
            Stop sequences. Accepts string or array of strings. Values are
            passed directly to upstream providers
          oneOf:
            - type: string
            - type: array
              items:
                type: string
        stop_token_ids:
          type: array
          description: >-
            Numeric array that lets callers stop generation on specific token
            IDs. Not supported by many providers
          items:
            type: integer
        include_stop_str_in_output:
          type: boolean
          description: >-
            When true, keeps the stop sequence in the final text. Not supported
            by many providers
          default: false
        ignore_eos:
          type: boolean
          description: >-
            Allows completions to continue even if the model predicts EOS
            internally. Useful for long creative writing runs
          default: false
        no_repeat_ngram_size:
          type: integer
          description: >-
            Extension that forbids repeating n-grams of the given size. Not
            supported by many providers
          minimum: 0
        custom_token_bans:
          type: array
          description: List of token IDs to fully block
          items:
            type: integer
        logit_bias:
          type: object
          description: >-
            Object mapping token IDs to additive logits. Works just like
            OpenAI's version
          additionalProperties:
            type: number
        logprobs:
          description: >-
            When true or a number, forwards the request to providers that
            support returning token-level log probabilities
          oneOf:
            - type: boolean
            - type: integer
        prompt_logprobs:
          type: boolean
          description: >-
            Requests logprobs on the prompt itself when the upstream API allows
            it
        seed:
          type: integer
          description: >-
            Numeric seed. Wherever supported, passes the value to make
            completions repeatable
        prompt_caching:
          type: object
          description: >-
            Helper to tag the leading messages for Claude prompt caching.
            NanoGPT injects cache_control blocks on each message up to the
            specified index before forwarding to Anthropic.
          properties:
            enabled:
              type: boolean
              description: Whether to enable prompt caching on this request
              default: false
            ttl:
              type: string
              description: Cache time-to-live ('5m' or '1h')
              enum:
                - 5m
                - 1h
              example: 5m
            cut_after_message_index:
              type: integer
              minimum: 0
              description: >-
                Zero-based index of the last message that should be cached. All
                messages up to and including this index receive the same
                cache_control block.
    ChatCompletionResponse:
      type: object
      properties:
        id:
          type: string
          description: Unique identifier for the completion
        object:
          type: string
          description: Object type, always 'chat.completion'
        created:
          type: integer
          description: Unix timestamp of when the completion was created
        choices:
          type: array
          description: Array of completion choices
          items:
            type: object
            properties:
              index:
                type: integer
                description: Index of the choice
              message:
                type: object
                properties:
                  role:
                    type: string
                    description: Role of the completion message
                    enum:
                      - assistant
                  content:
                    type: string
                    description: Content of the completion message
              finish_reason:
                type: string
                description: Reason why the completion finished
                enum:
                  - stop
                  - length
                  - content_filter
        usage:
          type: object
          properties:
            prompt_tokens:
              type: integer
              description: Number of tokens in the prompt
            completion_tokens:
              type: integer
              description: Number of tokens in the completion
            total_tokens:
              type: integer
              description: Total number of tokens used
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
    MessageContentPart:
      type: object
      required:
        - type
      additionalProperties: true
      properties:
        type:
          type: string
          description: Content block type
          enum:
            - text
            - image_url
            - input_text
            - input_audio
            - input_video
            - tool_use
            - tool_result
        text:
          type: string
          description: Text content when type is 'text'
        image_url:
          type: object
          description: Image reference for multimodal prompts
          properties:
            url:
              type: string
              description: HTTPS URL or base64 data URL for the image
            detail:
              type: string
              description: Requested image resolution detail
              enum:
                - low
                - high
                - auto
        input_audio:
          type: object
          description: Inline audio input payload
          properties:
            data:
              type: string
              description: Base64 encoded audio bytes
            format:
              type: string
              description: Audio format (e.g. wav, mp3)
        input_video:
          type: object
          description: Inline video reference
          properties:
            video_url:
              type: string
              description: HTTPS URL or data URL for the video
        cache_control:
          type: object
          description: >-
            Claude-only prompt caching control applied to this block. When
            present, NanoGPT forwards it unchanged to Anthropic.
          properties:
            type:
              type: string
              enum:
                - ephemeral
              description: >-
                Cache type. Claude currently exposes the 'ephemeral' tier for
                5m/1h TTLs.
            ttl:
              type: string
              enum:
                - 5m
                - 1h
              description: Optional TTL override for this block.
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

````

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.nano-gpt.com/llms.txt