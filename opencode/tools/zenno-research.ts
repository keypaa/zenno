export function buildZennoBoundedResearch(getDir: (sessionID?: string) => Promise<string>) {
  void getDir;
  return {
    name: "zenno_bounded_research",
    description:
      "Research-heavy tasks: dispatches exactly 3 explorers + 1 synthesis via native Agent Teams. Fixed-size replacement for open-ended fan-out.",
    input: {
      type: "object",
      properties: { topic: { type: "string", description: "research topic" } },
      required: ["topic"],
      additionalProperties: false,
    },
    execute: async (args: any) => {
      return {
        content: `Bounded research on "${args.topic}" — dispatch 3 parallel exploration agents + 1 synthesis. See core/skills/bounded-research/SKILL.md`,
      };
    },
  };
}

export function buildZennoPlanStressTest(getDir: (sessionID?: string) => Promise<string>) {
  void getDir;
  return {
    name: "zenno_plan_stress_test",
    description:
      "After writing-plans, before implementation: 4 fixed-role reviewers (security, scope, test coverage, architecture) in parallel.",
    input: {
      type: "object",
      properties: { planPath: { type: "string", description: "path to the plan file to review" } },
      required: ["planPath"],
      additionalProperties: false,
    },
    execute: async (args: any) => {
      return {
        content: `Plan stress-test on "${args.planPath}" — 4 reviewers (security, scope, test coverage, architecture). See core/skills/plan-stress-test/SKILL.md`,
      };
    },
  };
}
