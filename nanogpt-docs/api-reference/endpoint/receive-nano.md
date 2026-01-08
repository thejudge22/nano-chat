# Receive Nano

> Process pending Nano transactions for the account



## OpenAPI

````yaml POST /receive-nano
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
  /receive-nano:
    post:
      description: Process pending Nano transactions for the account
      responses:
        '200':
          description: Nano receive operation result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReceiveNanoResponse'
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
    ReceiveNanoResponse:
      type: object
      properties:
        success:
          type: boolean
          description: Whether the operation was successful
        received_blocks:
          type: array
          description: Array of received block hashes
          items:
            type: string
        total_received:
          type: string
          description: Total amount of Nano received
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