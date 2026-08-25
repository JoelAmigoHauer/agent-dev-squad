/**
 * Claude-backed proposal engine.
 *
 * This is the only place in the system where a model influences an outcome, and its output is
 * still not trusted: everything it returns goes through the deterministic guardrail engine before
 * it can become a recommendation, and anything that fails is written to `agent_steps` as a
 * `rejection` rather than shown to the advisor.
 *
 * The model is asked for legs and a rationale. It is NOT asked whether the portfolio has drifted,
 * whether a security is prohibited, or whether a trade is permitted — those are computed
 * (contract §1, "What the model decides, and what it must never decide").
 */

import Anthropic from '@anthropic-ai/sdk';
import { fromInput, multiplyQuantityByPrice, formatBps, format } from '@/lib/domain/money';
import type { ProposedLeg } from '@/lib/guardrails/types';
import type { Candidate, ProposalEngine, ProposalInput } from './types';

const SYSTEM = `You are the proposal agent inside Thelma, a supervised portfolio system used by
US registered investment advisors. An advisor reviews and approves everything you produce; you
never execute.

You are given a household's current allocation drift against a mandate the advisor configured, the
positions available to trade, and the constraints that apply. Propose the trades that best close
the drift.

Hard rules about your role:
- You do not decide whether a rule is satisfied. A deterministic guardrail engine checks every
  proposal you make against the mandate after you respond, and will reject anything that breaches
  it. Propose what you believe is correct; do not try to guess your way around the checks.
- Only propose trades in securities that appear in the positions or the tradable list you are given.
- Never propose selling more of a security than the position holds.
- Your rationale is read by an advisor who is accountable for the decision, and may later be read
  by an SEC examiner. Write it as an explanation of your reasoning, in plain professional English:
  what is out of line, by how much, what the trade does about it, and what it costs. State the
  tax consequence when there is one. Do not use marketing language and do not overstate certainty.
- If nothing is worth doing, return an empty list of proposals. A household inside its mandate is
  the normal case, not a failure.`;

const PROPOSAL_TOOL: Anthropic.Tool = {
  name: 'submit_proposals',
  description:
    'Submit the ranked trade proposals for this household. Rank 1 is the strongest. ' +
    'Return an empty array if no action is warranted.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['proposals'],
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['action', 'rationale', 'legs'],
          properties: {
            action: {
              type: 'string',
              enum: ['rebalance_trade', 'tax_loss_harvest', 'cash_raise', 'cash_invest'],
            },
            rationale: {
              type: 'string',
              description:
                'Plain professional English. What is out of line, by how much, what this trade ' +
                'does about it, and what it costs.',
            },
            legs: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['symbol', 'accountId', 'side', 'quantity'],
                properties: {
                  symbol: { type: 'string' },
                  accountId: { type: 'string' },
                  side: { type: 'string', enum: ['buy', 'sell'] },
                  quantity: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function createClaudeProposalEngine(
  apiKey: string,
  model = process.env.THELMA_MODEL || 'claude-opus-5',
): ProposalEngine {
  const client = new Anthropic({ apiKey });

  return {
    id: 'claude',
    model,

    async propose(input: ProposalInput) {
      const response = await client.messages.create({
        model,
        max_tokens: 16_000,
        thinking: { type: 'adaptive' },
        system: SYSTEM,
        tools: [PROPOSAL_TOOL],
        tool_choice: { type: 'tool', name: 'submit_proposals' },
        messages: [{ role: 'user', content: renderPrompt(input) }],
      });

      const call = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === 'tool_use' && block.name === 'submit_proposals',
      );
      if (!call) return { candidates: [], tokensIn: response.usage.input_tokens, tokensOut: response.usage.output_tokens };

      const parsed = call.input as {
        proposals?: {
          action: Candidate['action'];
          rationale: string;
          legs: { symbol: string; accountId: string; side: 'buy' | 'sell'; quantity: number }[];
        }[];
      };

      const securityIdBySymbol = new Map(
        [...input.symbolsById].map(([id, symbol]) => [symbol.toUpperCase(), id]),
      );

      const candidates: Candidate[] = [];
      for (const proposal of parsed.proposals ?? []) {
        const legs: ProposedLeg[] = [];
        let usable = true;
        for (const leg of proposal.legs ?? []) {
          const securityId = securityIdBySymbol.get(leg.symbol.toUpperCase());
          const price = securityId ? input.pricesBySecurityId.get(securityId) : undefined;
          // A hallucinated symbol, an unknown account or a missing price makes the whole proposal
          // unusable. Dropping the leg and keeping the rest would silently change the trade into
          // something the model did not propose and the rationale does not describe.
          if (!securityId || !price || price <= 0) { usable = false; break; }
          if (!input.ctx.accounts.some((a) => a.id === leg.accountId)) { usable = false; break; }
          if (!Number.isFinite(leg.quantity) || leg.quantity <= 0) { usable = false; break; }
          legs.push({
            accountId: leg.accountId,
            securityId,
            side: leg.side,
            quantity: leg.quantity,
            estPrice: price,
            estAmount: multiplyQuantityByPrice(leg.quantity, price),
          });
        }
        if (!usable || legs.length === 0) continue;
        candidates.push({
          action: proposal.action,
          legs,
          rationale: proposal.rationale,
          projectedRealizedGain: fromInput(0),
          projectedTaxCost: fromInput(0),
        });
      }

      return {
        candidates,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
      };
    },
  };
}

function renderPrompt(input: ProposalInput): string {
  const { drift, ctx, symbolsById } = input;

  const bands = drift.bands
    .map((b) =>
      `  ${b.assetClass.padEnd(24)} target ${formatBps(b.targetBps).padStart(7)}  ` +
      `actual ${formatBps(b.actualBps).padStart(7)}  ` +
      `band ${formatBps(b.minBps)}–${formatBps(b.maxBps)}  ` +
      `drift ${b.driftBps >= 0 ? '+' : ''}${formatBps(b.driftBps)}` +
      `${b.breached ? '   *** OUTSIDE BAND ***' : ''}`)
    .join('\n');

  const positions = ctx.positions
    .map((p) => {
      const account = ctx.accounts.find((a) => a.id === p.accountId);
      return `  ${(symbolsById.get(p.securityId) ?? '?').padEnd(6)} ` +
        `qty ${String(p.quantity).padStart(12)}  value ${format(p.marketValue).padStart(14)}  ` +
        `basis ${format(p.costBasis).padStart(14)}  ` +
        `account ${p.accountId} (${account?.taxTreatment ?? 'unknown'})`;
    })
    .join('\n');

  const constraints = ctx.mandate.constraints.length
    ? ctx.mandate.constraints
        .map((c) => `  ${c.kind}: ${c.securityId ? symbolsById.get(c.securityId) ?? c.securityId : ''}` +
          `${c.sector ?? ''}${c.limitBps !== null ? ` limit ${formatBps(c.limitBps)}` : ''}`)
        .join('\n')
    : '  (none)';

  return `Household: ${input.householdName}
Mandate version ${ctx.mandate.version}. Total market value ${format(drift.totalMarketValue)}.

ALLOCATION vs MANDATE
${bands}

Drift tolerance: ${formatBps(ctx.mandate.driftToleranceBps)}
Minimum trade amount: ${format(ctx.mandate.minTradeAmount)}
Minimum cash: ${formatBps(ctx.mandate.minCashBps)}  Liquidity need: ${format(ctx.mandate.liquidityNeed)}
Realised gains booked this year: ${format(ctx.realizedGainYtd)}${
  ctx.mandate.realizedGainBudget !== null
    ? `  (annual budget ${format(ctx.mandate.realizedGainBudget)})`
    : '  (no annual budget set)'}

POSITIONS
${positions}

CONSTRAINTS
${constraints}

OBSERVATIONS DETECTED THIS CYCLE
${input.observations.length
  ? input.observations.map((o) => `  [${o.severity}] ${o.kind} ${o.assetClass ?? ''}`).join('\n')
  : '  (none)'}

Propose the trades you would put to the advisor, ranked strongest first. Use the account ids
exactly as given above. Submit via the submit_proposals tool.`;
}
