# TEE Signature

> Fetch ECDSA signature for a chat request

Fetch an ECDSA signature for a chat request executed in a TEE.


## OpenAPI

````yaml GET /v1/tee/signature/{requestId}
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
  /v1/tee/signature/{requestId}:
    servers:
      - url: https://nano-gpt.com
        description: Root server for TEE endpoints
    get:
      description: Fetch ECDSA signature for a chat request
      parameters:
        - name: requestId
          in: path
          description: Chat request ID
          required: true
          schema:
            type: string
        - name: model
          in: query
          description: TEE model to attest
          required: true
          schema:
            type: string
        - name: signing_algo
          in: query
          description: Signing algorithm to use
          required: false
          schema:
            type: string
          example: ecdsa
      responses:
        '200':
          description: TEE signature response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TEESignatureResponse'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
        '500':
          description: Server Error
      security:
        - bearerAuth: []
components:
  schemas:
    TEESignatureResponse:
      type: object
      properties:
        signature:
          type: string
          description: The ECDSA signature
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
    bearerAuth:
      type: http
      scheme: bearer

````

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.nano-gpt.com/llms.txt