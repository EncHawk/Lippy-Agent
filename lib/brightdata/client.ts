import { z } from "zod";
import { env } from "../env";
const progressSchema = z.object({ status: z.enum(["in_progress", "pending_answer", "done", "failed", "queued", "running"]), step: z.string().optional() }).passthrough();
export class ProviderError extends Error {
  constructor(message: string, readonly retryable = false) { super(message); }
}
/** Each call performs one bounded HTTP operation. The worker persists between polls. */
export class BrightDataClient {
  constructor(private fetcher: typeof fetch = fetch) {}
  private async request(path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    if (!env.BRIGHTDATA_API_KEY) throw new ProviderError("BRIGHTDATA_API_KEY is required in brightdata mode");
    let response: Response;
    try {
      response = await this.fetcher(`${env.BRIGHTDATA_API_BASE}${path}`, {
        method: body === undefined ? "GET" : "POST", redirect: "error",
        headers: { Authorization: `Bearer ${env.BRIGHTDATA_API_KEY}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
      });
    } catch { throw new ProviderError("Bright Data request timed out or failed to connect", true); }
    if (!response.ok) throw new ProviderError(`Bright Data returned HTTP ${response.status}`, response.status === 429 || response.status >= 500);
    const text = await response.text();
    if (!text) return { status: response.status, data: null };
    try { return { status: response.status, data: JSON.parse(text) }; }
    catch { throw new ProviderError("Bright Data returned malformed JSON"); }
  }
  async createScraper(name: string) {
    if (!env.BRIGHTDATA_DELIVERY_EMAIL) throw new ProviderError("Set BRIGHTDATA_DELIVERY_EMAIL for scraper creation, or supply an existing collectorId");
    const { data } = await this.request("/dca/collector", { name, deliver: { type: "email", address: env.BRIGHTDATA_DELIVERY_EMAIL, filename: { template: "lippy", extension: "json" } } });
    return z.object({ id: z.string().min(1) }).parse(data).id;
  }
  async generate(collectorId: string, url: string, description: string) {
    await this.request(`/dca/collectors/${encodeURIComponent(collectorId)}/automate_template`, { urls: [url], description: description.slice(0, 500) });
  }
  async progress(collectorId: string, healing: boolean) {
    const { data } = await this.request(`/dca/collectors/${encodeURIComponent(collectorId)}/${healing ? "refactor_template" : "automate_template"}/progress`);
    return progressSchema.parse(data);
  }
  async trigger(collectorId: string, url: string, runId: string) {
    const query = new URLSearchParams({ collector: collectorId, queue_next: "1", name: runId });
    const { data } = await this.request(`/dca/trigger?${query}`, [{ url }]);
    return z.object({ collection_id: z.string().min(1) }).parse(data).collection_id;
  }
  async results(jobId: string): Promise<Record<string, unknown> | null> {
    const { status, data } = await this.request(`/dca/dataset?id=${encodeURIComponent(jobId)}`);
    if (status === 202) return null;
    // A contract represents one page/entity. Never silently accept an arbitrary row.
    const rows = z.array(z.record(z.unknown())).length(1).parse(data);
    return rows[0]!;
  }
  async heal(collectorId: string, url: string, prompt: string) {
    await this.request(`/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template`, { prompt: prompt.slice(0, 1000), custom_input: [{ url }] });
  }
  async approve(collectorId: string) {
    // This endpoint legitimately returns 200 with no body.
    await this.request(`/dca/collectors/${encodeURIComponent(collectorId)}/resume_automation_job`, { message: true, auto_save: true });
  }
}
export const brightData = new BrightDataClient();
