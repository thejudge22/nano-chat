# Talk to GPT (Legacy)

> Legacy endpoint for chat interactions with the GPT model

## Overview

The Talk to GPT endpoint is our legacy text generation API that also supports web search capabilities through LinkUp integration.

## Web Search

Enable web search by appending suffixes to the model name:

* **`:online`** - Standard web search (\$0.006 per request)
* **`:online/linkup-deep`** - Deep web search (\$0.06 per request)

### Example with Web Search

<CodeGroup>
  ```python Python theme={null}
  import requests
  import json

  BASE_URL = "https://nano-gpt.com/api"
  API_KEY = "YOUR_API_KEY"

  headers = {
      "x-api-key": API_KEY,
      "Content-Type": "application/json"
  }

  # Standard web search
  data = {
      "prompt": "What are the latest AI breakthroughs this month?",
      "model": "chatgpt-4o-latest:online",
      "messages": []
  }

  response = requests.post(
      f"{BASE_URL}/talk-to-gpt",
      headers=headers,
      json=data
  )

  # Deep web search for comprehensive research
  data_deep = {
      "prompt": "Provide a detailed analysis of recent quantum computing advances",
      "model": "chatgpt-4o-latest:online/linkup-deep",
      "messages": []
  }

  response_deep = requests.post(
      f"{BASE_URL}/talk-to-gpt",
      headers=headers,
      json=data_deep
  )

  # Parse response
  if response.status_code == 200:
      parts = response.text.split('<NanoGPT>')
      text_response = parts[0].strip()
      nano_info = json.loads(parts[1].split('</NanoGPT>')[0])
      
      print("Response:", text_response)
      print("Cost:", nano_info['cost'])
  ```

  ```javascript JavaScript theme={null}
  const BASE_URL = "https://nano-gpt.com/api";
  const API_KEY = "YOUR_API_KEY";

  // Standard web search
  const response = await fetch(`${BASE_URL}/talk-to-gpt`, {
      method: 'POST',
      headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          prompt: 'What are the latest AI breakthroughs this month?',
          model: 'chatgpt-4o-latest:online',
          messages: []
      })
  });

  // Deep web search
  const deepResponse = await fetch(`${BASE_URL}/talk-to-gpt`, {
      method: 'POST',
      headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          prompt: 'Provide a detailed analysis of recent quantum computing advances',
          model: 'chatgpt-4o-latest:online/linkup-deep',
          messages: []
      })
  });
  ```

  ```bash cURL theme={null}
  # Standard web search
  curl -X POST https://nano-gpt.com/api/talk-to-gpt \
    -H "x-api-key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "prompt": "What are the latest AI breakthroughs this month?",
      "model": "chatgpt-4o-latest:online",
      "messages": []
    }'

  # Deep web search
  curl -X POST https://nano-gpt.com/api/talk-to-gpt \
    -H "x-api-key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "prompt": "Provide a detailed analysis of recent quantum computing advances",
      "model": "chatgpt-4o-latest:online/linkup-deep",
      "messages": []
    }'
  ```
</CodeGroup>

## Important Notes

* Web search works with all models - simply append the suffix
* Increases input token count which affects total cost
* Provides access to real-time information
* For new projects, consider using the OpenAI-compatible `/v1/chat/completions` endpoint instead


## OpenAPI

````yaml POST /talk-to-gpt
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
  /talk-to-gpt:
    post:
      description: Legacy endpoint for chat interactions with the GPT model
      requestBody:
        description: Parameters for talking to GPT
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TalkToGptRequest'
        required: true
      responses:
        '200':
          description: Talk to GPT response
          content:
            text/plain:
              schema:
                type: string
                description: Text response followed by metadata in <NanoGPT> tags
        '400':
          description: Unexpected error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - apiKeyAuth: []
components:
  schemas:
    TalkToGptRequest:
      type: object
      required:
        - model
      properties:
        prompt:
          type: string
          description: The text prompt to send to GPT (optional)
          default: ''
          example: Please explain the concept of artificial intelligence.
        model:
          type: string
          description: >-
            The model to use for generation. Append ':online' for web search
            ($0.005/request) or ':online/linkup-deep' for deep web search
            ($0.05/request)
          default: chatgpt-4o-latest
          examples:
            - chatgpt-4o-latest
            - chatgpt-4o-latest:online
            - claude-3-5-sonnet-20241022:online/linkup-deep
        messages:
          type: array
          description: Array of previous message objects for context (optional)
          default:
            - role: user
              content: Hi, I'm just testing!
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
                  - user
                  - assistant
              content:
                type: string
                description: The content of the message
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