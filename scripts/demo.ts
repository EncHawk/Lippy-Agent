import { randomUUID } from "node:crypto";
import { env } from "../lib/env";
async function main() {
  if (env.EXTRACTION_PROVIDER !== "fixture") throw new Error("This demo requires EXTRACTION_PROVIDER=fixture");
  const token = process.env.LIPPY_API_TOKEN;
  async function request(path: string, input?: unknown) {
    const response = await fetch(`${env.APP_URL}${path}`, { method: input === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), "Idempotency-Key": randomUUID() },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response.json();
  }
  async function run(id: string) {
    const { runId } = await request(`/api/contracts/${id}/run`, {});
    for (let i = 0; i < 120; i++) {
      const { run } = await request(`/api/runs/${runId}`);
      if (run.finishedAt) { console.log(JSON.stringify({ runId, outcome: run.outcome, repairs: run.healAttempts })); return run; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error("Demo timed out. Start npm run worker in another terminal.");
  }
  const { contract } = await request("/api/contracts", { url: "https://example.com/product", enabled: false,
    fields: [{ key: "product", type: "string", expectedValue: "Example product" }, { key: "price", type: "number", minimum: 0, maxRelativeChange: 0.5 }] });
  console.log(`Contract: ${contract.id}`);
  if ((await run(contract.id)).outcome !== "valid") throw new Error("Baseline failed");
  await request("/api/dev/break", { contractId: contract.id, scenario: "layout" });
  if ((await run(contract.id)).outcome !== "healed") throw new Error("Selector recovery failed");
  await request("/api/dev/break", { contractId: contract.id, scenario: "value", field: "price", value: "900" });
  if ((await run(contract.id)).outcome !== "review_required") throw new Error("Suspicious change was not quarantined");
  const accepted = await request(`/api/contracts/${contract.id}/data`);
  if (accepted.data.price !== 100) throw new Error("Last accepted value was overwritten");
  console.log(JSON.stringify({ result: "passed", accepted }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
