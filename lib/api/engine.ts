import { deterministicProposalEngine } from '@/lib/agents/proposal-deterministic';
import { createClaudeProposalEngine } from '@/lib/agents/proposal-claude';
import type { ProposalEngine } from '@/lib/agents/types';

/**
 * Claude when a key is configured, deterministic otherwise.
 *
 * The fallback is not a stub: it detects the same drift and proposes the same arithmetic trade,
 * with a plainer rationale. Degrading to zero recommendations would show the advisor an in-mandate
 * portfolio that is actually in breach, which is worse than a terse explanation.
 * QA forces the deterministic engine so its assertions are reproducible.
 */
export function selectProposalEngine(): ProposalEngine {
  if (process.env.THELMA_FORCE_DETERMINISTIC === '1') return deterministicProposalEngine;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? createClaudeProposalEngine(apiKey) : deterministicProposalEngine;
}
