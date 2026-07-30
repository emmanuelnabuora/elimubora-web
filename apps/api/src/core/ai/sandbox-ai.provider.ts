import { Injectable, Logger } from '@nestjs/common';
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.port';

/**
 * Sandbox implementation — see ai-provider.port.ts for the full
 * disclaimer. No network call, no real model. Returns a short,
 * clearly-labeled templated placeholder so callers, tests, and the
 * human-review workflows downstream all have real (if not real
 * *quality*) content to operate on.
 */
@Injectable()
export class SandboxAiProvider implements AiProvider {
  private readonly logger = new Logger(SandboxAiProvider.name);

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    this.logger.log(`[sandbox] ${request.feature} completion requested — no real model called`);
    const text = `[SANDBOX AI DRAFT — ${request.feature}] This is a placeholder generated without a real language model. Replace SandboxAiProvider with a production Anthropic API client to generate real content. Prompt received: ${request.prompt.slice(0, 200)}`;
    return { text };
  }
}
