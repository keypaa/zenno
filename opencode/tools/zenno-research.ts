import { tool } from "@opencode-ai/plugin";
export const zennoBoundedResearch = tool({
  description: "Research-heavy tasks: dispatches exactly 3 explorers + 1 synthesis via native Agent Teams. Fixed-size replacement for open-ended fan-out.",
  args: { topic: tool.schema.string().describe("research topic") },
  async execute(args: any) {
    return `Bounded research on "${args.topic}" — dispatch 3 parallel exploration agents + 1 synthesis. See core/skills/bounded-research/SKILL.md`;
  },
});
export const zennoPlanStressTest = tool({
  description: "After writing-plans, before implementation: 4 fixed-role reviewers (security, scope, test coverage, architecture) in parallel.",
  args: { planPath: tool.schema.string().describe("path to the plan file to review") },
  async execute(args: any) {
    return `Plan stress-test on "${args.planPath}" — 4 reviewers (security, scope, test coverage, architecture). See core/skills/plan-stress-test/SKILL.md`;
  },
});
