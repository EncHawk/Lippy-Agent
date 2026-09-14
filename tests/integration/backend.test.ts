import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { db } from "../../lib/db";
import { createContract, triggerRun, getData, getContract, reviewRun, reconcileRun, enqueueRun } from "../../lib/contracts/service";
import { claimRun, processRun } from "../../lib/jobs/worker";
import { readEvents } from "../../lib/events/bus";
import { mutateFixture, type Fixture } from "../../lib/fixtures/scraper";
import { issueToken, requireUser, completeGoogleLogin, beginGoogleLogin } from "../../lib/auth/service";
import { env } from "../../lib/env";
const enabled = process.env.RUN_DB_TESTS === "1";
const owner = `test-${randomUUID()}`;
const definition = { url: "https://example.com/product", enabled: false, fields: [{ key: "product", type: "string", expectedValue: "Example product" }, { key: "price", type: "number", minimum: 0, maxRelativeChange: 0.5 }] };
async function drain(id: string) {
  for (let i = 0; i < 40; i++) {
    const latest = await db.run.findUniqueOrThrow({ where: { id } });
    if (latest.finishedAt) return latest;
    const run = await claimRun();
    if (!run) throw new Error("Expected claimable work");
    await processRun(run);
  }
  throw new Error("Workflow did not terminate");
}
async function mutate(contractId: string, scenario: "layout" | "value" | "unrepairable", field?: string, value?: string) {
  const c = await getContract(contractId, owner);
  await db.contract.update({ where: { id: contractId }, data: { fixture: JSON.stringify(mutateFixture(JSON.parse(c.fixture!) as Fixture, scenario, field, value)) } });
}
describe.skipIf(!enabled)("PostgreSQL backend integration", () => {
  beforeAll(async () => { await db.user.create({ data: { id: owner, email: "test@example.com" } }); });
  afterAll(async () => {
    const contracts = await db.contract.findMany({ where: { ownerId: owner }, select: { id: true } });
    const ids = contracts.map(c => c.id);
    await db.contractEvent.deleteMany({ where: { contractId: { in: ids } } });
    await db.repairAttempt.deleteMany({ where: { run: { contractId: { in: ids } } } });
    await db.run.deleteMany({ where: { contractId: { in: ids } } });
    await db.contract.deleteMany({ where: { id: { in: ids } } });
    await db.user.delete({ where: { id: owner } });
    await db.$disconnect();
  });
  it("enqueues immediately, deduplicates concurrent requests, accepts baseline and repairs HTML drift", async () => {
    const c = await createContract(definition, owner);
    const [a, b] = await Promise.all([triggerRun(c.id, owner, "same"), triggerRun(c.id, owner, "same")]);
    expect(a!.id).toBe(b!.id); expect(a!.state).toBe("queued");
    await expect(triggerRun(c.id, owner, "different")).rejects.toThrow();
    expect((await drain(a!.id)).outcome).toBe("valid");
    const baseline = await getData(c.id, owner);
    await mutate(c.id, "layout");
    const next = await triggerRun(c.id, owner);
    expect((await drain(next!.id)).outcome).toBe("healed");
    expect((await getData(c.id, owner)).data).toEqual(baseline.data);
    const events = await readEvents(c.id);
    expect(events.some(e => e.type === "contract.violated")).toBe(true);
    expect(events.some(e => e.type === "contract.healed")).toBe(true);
    expect(events.every(e => [a!.id, next!.id].includes(e.runId!))).toBe(true);
    const cursor = events[2]!.sequence;
    expect((await readEvents(c.id, BigInt(cursor))).every(e => BigInt(e.sequence) > BigInt(cursor))).toBe(true);
    expect((await triggerRun(c.id, owner, "same"))!.id).toBe(a!.id);
  });
  it("bounds repairs and preserves the last accepted result", async () => {
    const c = await createContract(definition, owner), first = await triggerRun(c.id, owner);
    await drain(first!.id); await mutate(c.id, "unrepairable");
    const second = await triggerRun(c.id, owner), failed = await drain(second!.id);
    expect(failed.outcome).toBe("escalated"); expect(failed.healAttempts).toBe(3);
    expect((await getData(c.id, owner)).runId).toBe(first!.id);
    expect((await getContract(c.id, owner)).enabled).toBe(false);
  });
  it("quarantines suspicious changes until an explicit review accepts them", async () => {
    const c = await createContract(definition, owner), first = await triggerRun(c.id, owner);
    await drain(first!.id); await mutate(c.id, "value", "price", "900");
    const next = await triggerRun(c.id, owner);
    expect((await drain(next!.id)).outcome).toBe("review_required");
    expect((await getData(c.id, owner)).runId).toBe(first!.id);
    await expect(triggerRun(c.id, owner)).rejects.toThrow();
    await reviewRun(next!.id, owner, "accept");
    expect((await getData(c.id, owner)).data.price).toBe(900);
  });
  it("rejects suspicious candidates without changing accepted data", async () => {
    const c = await createContract(definition, owner), first = await triggerRun(c.id, owner);
    await drain(first!.id); await mutate(c.id, "value", "price", "900");
    const next = await triggerRun(c.id, owner); await drain(next!.id);
    await reviewRun(next!.id, owner, "reject");
    expect((await getData(c.id, owner)).runId).toBe(first!.id);
  });
  it("has one lease winner, resumes an expired lease and fences the stale worker", async () => {
    const c = await createContract(definition, owner), queued = await triggerRun(c.id, owner);
    const claims = await Promise.all([claimRun(), claimRun()]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old = claims.find(Boolean)!;
    await db.run.update({ where: { id: old.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    const replacement = await claimRun(); expect(replacement!.leaseToken).not.toBe(old.leaseToken);
    await processRun(old);
    expect((await db.run.findUniqueOrThrow({ where: { id: old.id } })).state).toBe("queued");
    await processRun(replacement!);
    expect((await drain(queued!.id)).outcome).toBe("valid");
  });
  it("does not replay interrupted external submissions", async () => {
    const c = await createContract(definition, owner), queued = await triggerRun(c.id, owner);
    await db.run.update({ where: { id: queued!.id }, data: { state: "extracting_submitting" } });
    expect((await drain(queued!.id)).outcome).toBe("indeterminate");
    expect((await getContract(c.id, owner)).enabled).toBe(false);
    await reconcileRun(queued!.id, owner, "Confirmed the remote job was cancelled in Studio");
    expect((await getContract(c.id, owner)).status).toBe("broken");
  });
  it("does not queue duplicate scheduled runs", async () => {
    const c = await createContract({ ...definition, enabled: true }, owner);
    const runs = await Promise.all([enqueueRun(c.id, undefined, true), enqueueRun(c.id, undefined, true)]);
    expect(runs.filter(Boolean)).toHaveLength(1);
    await drain(runs.find(Boolean)!.id);
  });
  it("fails expired workflows rather than polling forever", async () => {
    const c = await createContract(definition, owner), run = await triggerRun(c.id, owner);
    await db.run.update({ where: { id: run!.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    expect((await drain(run!.id)).outcome).toBe("failed");
  });
  it("enforces ownership and hashed, revocable credentials", async () => {
    const c = await createContract(definition, owner);
    await expect(getContract(c.id, "other-user")).rejects.toThrow();
    await expect(triggerRun(c.id, "other-user")).rejects.toThrow();
    const issued = await issueToken(owner, "api");
    const stored = await db.session.findUniqueOrThrow({ where: { id: issued.id } });
    expect(stored.tokenHash).not.toBe(issued.token);
    const req = new Request("http://localhost:3000/api/contracts", { headers: { Authorization: `Bearer ${issued.token}` } });
    expect(await requireUser(req)).toBe(owner);
    await db.session.delete({ where: { id: issued.id } });
    await expect(requireUser(req)).rejects.toThrow();
  });
  it("rejects cookie-authenticated writes without origin and cross-origin bearer requests", async () => {
    const s = await issueToken(owner, "session");
    await expect(requireUser(new Request("http://localhost:3000/api/contracts", { method: "POST", headers: { cookie: `lippy_session=${s.token}` } }))).rejects.toThrow();
    await expect(requireUser(new Request("http://localhost:3000/api/contracts", { headers: { origin: "https://attacker.example" } }))).rejects.toThrow();
  });
  it("rejects OAuth state mismatch before exchanging any authorization code", async () => {
    const login = await beginGoogleLogin();
    expect(new URL(login.url).searchParams.get("code_challenge_method")).toBe("S256");
    await expect(completeGoogleLogin("code", login.state, "wrong-cookie")).rejects.toThrow("state mismatch");
  });
  it("disables the development authentication bypass in production", async () => {
    const old = { auth: env.AUTH_MODE, node: env.NODE_ENV };
    try {
      env.AUTH_MODE = "development"; env.NODE_ENV = "production";
      await expect(requireUser(new Request("https://example.com/api/contracts"))).rejects.toThrow();
    } finally { env.AUTH_MODE = old.auth; env.NODE_ENV = old.node; }
  });
});
