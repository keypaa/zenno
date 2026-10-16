const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { evaluateToPerm, applyGuardOutput } = require("./v2-adapter.js");

describe("v2-adapter evaluateToPerm", () => {
  it("maps action/resources onto the V1 perm shape", () => {
    const perm = evaluateToPerm({
      sessionID: "ses_1",
      action: "edit",
      resources: ["/repo/.env"],
      metadata: { cwd: "/repo" },
    });
    assert.equal(perm.type, "edit");
    assert.equal(perm.sessionID, "ses_1");
    assert.equal(perm.title, "edit");
    assert.deepEqual(perm.pattern, ["/repo/.env"]);
    assert.equal(perm.metadata.cwd, "/repo");
    assert.deepEqual(perm.metadata.resources, ["/repo/.env"]);
  });

  it("tolerates missing fields", () => {
    const perm = evaluateToPerm({});
    assert.equal(perm.type, "unknown");
    assert.deepEqual(perm.metadata, {});
  });
});

describe("v2-adapter applyGuardOutput", () => {
  it("sets deny + message on guard deny", () => {
    const event = { effect: "ask" };
    const denied = applyGuardOutput(event, { status: "deny", reason: "blocked" });
    assert.equal(denied, true);
    assert.equal(event.effect, "deny");
    assert.equal(event.message, "blocked");
  });

  it("leaves effect untouched when guards allow (preserves ask)", () => {
    const event = { effect: "ask" };
    const denied = applyGuardOutput(event, { status: "allow" });
    assert.equal(denied, false);
    assert.equal(event.effect, "ask");
    assert.equal(event.message, undefined);
  });
});
