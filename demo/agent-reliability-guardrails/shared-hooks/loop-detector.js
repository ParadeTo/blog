import crypto from 'node:crypto';

import { GuardrailDeny } from '../src/hook-framework/registry.js';

export class LoopDetector {
  constructor({ threshold = process.env.LOOP_DETECTOR_THRESHOLD ?? 3, logger = console.error } = {}) {
    this.threshold = Math.max(1, Number(threshold));
    this.logger = logger;
    this.toolHashes = [];
    this.turnHashes = [];
    this.uniqueStates = new Set();
    this.loopDetections = 0;
    this.totalToolCalls = 0;
    this.totalTurns = 0;
  }

  afterToolHandler(ctx) {
    this.totalToolCalls += 1;
    const output = truncate(ctx.metadata?.toolOutput ?? ctx.metadata?.output ?? '');
    const state = `${ctx.toolName || ''}:${output}`;

    this.checkLoop(this.toolHashes, state);
  }

  afterTurnHandler(ctx) {
    this.totalTurns += 1;
    const output = truncate(ctx.metadata?.output ?? '');
    const state = `${ctx.toolName || ''}:${output}`;

    this.checkLoop(this.turnHashes, state);
  }

  checkLoop(hashes, state) {
    const hash = crypto.createHash('md5').update(state).digest('hex').slice(0, 16);
    hashes.push(hash);
    this.uniqueStates.add(hash);

    if (hashes.length > this.threshold) {
      hashes.splice(0, hashes.length - this.threshold);
    }

    if (hashes.length === this.threshold && hashes.every((entry) => entry === hash)) {
      this.loopDetections += 1;
      const reason = `loop detected after ${this.threshold} repeated states`;

      this.logger({
        level: 'CRITICAL',
        guardrail: 'loop_detector',
        message: reason,
        stateHash: hash,
        threshold: this.threshold,
        loopDetections: this.loopDetections,
      });

      throw new GuardrailDeny(reason, { guardrail: 'loop_detector' });
    }
  }

  getMetrics() {
    return {
      total_turns: this.totalTurns,
      total_tool_calls: this.totalToolCalls,
      unique_states: this.uniqueStates.size,
      loop_detections: this.loopDetections,
    };
  }
}

function truncate(value) {
  return String(value).slice(0, 200);
}
