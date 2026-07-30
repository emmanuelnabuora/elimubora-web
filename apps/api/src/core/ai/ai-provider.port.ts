/**
 * AI generation boundary, architecturally identical to the payment
 * gateway pattern (core/payments/payment-gateway.port.ts): a narrow
 * port any domain module can depend on, one honestly-labeled sandbox
 * implementation, and a production provider (a real Anthropic API
 * client) as a drop-in replacement requiring no application-code
 * change — only a different registration in CoreModule.
 *
 * SANDBOX DISCLAIMER: this codebase has no real Anthropic API
 * credentials configured. `SandboxAiProvider` (the only
 * implementation provided) does NOT call any LLM; it returns a
 * clearly-marked templated placeholder. Nothing in this platform
 * should be taken as evidence of real generative output quality —
 * that question is entirely deferred to whichever real provider is
 * registered in production.
 *
 * SAFETY NOTE for the real implementation: a production provider
 * sitting behind this port serves an audience that includes children
 * as young as ~4 (CBC PP1). Before registering a real provider,
 * production deployment needs, at minimum: age-appropriate content
 * settings, a moderation/safety layer on generated output, and the
 * human-approval gates this sprint already wires into the data model
 * (AI-drafted lesson plans and exam questions start at 'pending' /
 * un-approved and cannot reach a student without a teacher acting).
 * This port intentionally returns plain text only — no tool use, no
 * autonomous actions — so the blast radius of a bad generation is
 * "a teacher has to reject a draft," never a direct write a student sees.
 */
export interface AiCompletionRequest {
  /** Which persona-facing feature is calling — drives the log and, for a real
   *  provider, would drive feature-specific system prompts/safety settings. */
  feature: 'lesson_plan_draft' | 'exam_question_draft' | 'feedback_draft' | 'homework_help';
  prompt: string;
  /** Free-form context for logging/prompt-construction (courseId, subject, etc). */
  context?: Record<string, unknown>;
}

export interface AiCompletionResult {
  text: string;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
