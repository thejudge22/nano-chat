# Completions

> Creates a completion for the provided prompt



## OpenAPI

````yaml POST /v1/completions
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
  /v1/completions:
    post:
      description: Creates a completion for the provided prompt
      requestBody:
        description: Parameters for text completion
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CompletionRequest'
        required: true
      responses:
        '200':
          description: Text completion response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CompletionResponse'
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
    CompletionRequest:
      type: object
      required:
        - model
        - prompt
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
        prompt:
          type: string
          description: The text prompt to complete
        max_tokens:
          type: integer
          description: Upper bound on generated tokens
          default: 4000
          minimum: 1
        temperature:
          type: number
          description: >-
            Classic randomness control. Accepts any decimal between 0-2. Lower
            numbers bias toward deterministic responses, higher values explore
            more aggressively
          minimum: 0
          maximum: 2
          default: 0.7
        top_p:
          type: number
          description: >-
            Nucleus sampling. When set below 1.0, trims candidate tokens to the
            smallest set whose cumulative probability exceeds top_p. Works well
            as an alternative to tweaking temperature
          minimum: 0
          maximum: 1
          default: 1
        stream:
          type: boolean
          description: Whether to stream the response
          default: false
        stop:
          description: >-
            Stop sequences. Accepts string or array of strings. Values are
            passed directly to upstream providers
          oneOf:
            - type: string
            - type: array
              items:
                type: string
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
    CompletionResponse:
      type: object
      properties:
        id:
          type: string
          description: Unique identifier for the completion
        object:
          type: string
          description: Object type, always 'text_completion'
        created:
          type: integer
          description: Unix timestamp of when the completion was created
        model:
          type: string
          description: Model used for completion
        choices:
          type: array
          description: Array of completion choices
          items:
            type: object
            properties:
              text:
                type: string
                description: The completed text
              index:
                type: integer
                description: Index of the choice
              logprobs:
                type: object
                nullable: true
                description: Log probabilities of tokens (if requested)
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
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

````

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.nano-gpt.com/llms.txt