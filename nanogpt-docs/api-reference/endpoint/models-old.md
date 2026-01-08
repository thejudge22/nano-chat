# Models (Old)

> Legacy endpoint to list available models



## OpenAPI

````yaml GET /models
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
  /models:
    get:
      description: Legacy endpoint to list available models
      responses:
        '200':
          description: List of available models (legacy format)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ModelsLegacyResponse'
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
    ModelsLegacyResponse:
      type: object
      properties:
        models:
          type: array
          description: List of available model names
          items:
            type: string
            description: Model identifier
            example: chatgpt-4o-latest
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