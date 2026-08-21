import { env, isMockBrightData } from "../env";
import { createLogger } from "../logger";
import { ExtractionFailedError } from "../errors";
import type {
  CreateScraperInput,
  CreateScraperResult,
  CollectorRunResult,
  RefactorTemplateInput,
  RefactorProgress,
} from "./types";

const log = createLogger("brightdata-client");

/**
 * Thin, typed wrapper over Bright Data Scraper Studio's AI Flow API.
 *
 * Two design choices worth calling out:
 *
 * 1. Every method mirrors a real Scraper Studio endpoint 1:1
 *    (create -> AI Flow, run -> /dca/trigger, heal -> /refactor_template,
 *    approve -> /resume_automation_job) so swapping the mock implementation
 *    for live HTTP calls is a matter of filling in `fetch` calls in this
 *    one file — nothing upstream changes.
 *
 * 2. `resumeAutomationJob` exists as a first-class method because
 *    auto-approving the AI's proposed diff (rather than requiring a human
 *    to click "approve" in the Scraper Studio UI) is what makes the
 *    self-heal loop actually autonomous. Without it, "self-healing" stops
 *    at "self-diagnosing."
 */
export class BrightDataClient {
  private readonly mock = isMockBrightData;

  async createScraper(input: CreateScraperInput): Promise<CreateScraperResult> {
    if (this.mock) {
      log.info("mock: createScraper", { url: input.url });
      return { collectorId: `c_mock_${hashString(input.url)}` };
    }
    return this.request<CreateScraperResult>("/scraper/create", input);
  }

  async runCollector(collectorId: string): Promise<CollectorRunResult> {
    if (this.mock) {
      log.info("mock: runCollector", { collectorId });
      return mockRun(collectorId);
    }
    try {
      return await this.request<CollectorRunResult>(`/dca/trigger`, { collectorId });
    } catch (err) {
      throw new ExtractionFailedError(collectorId, err);
    }
  }

  /** Triggers Scraper Studio's AI self-healing for a broken field. */
  async refactorTemplate(input: RefactorTemplateInput): Promise<{ jobId: string }> {
    if (this.mock) {
      log.info("mock: refactorTemplate", input);
      return { jobId: `job_mock_${hashString(input.prompt)}` };
    }
    return this.request<{ jobId: string }>("/refactor_template", input);
  }

  async pollRefactorProgress(jobId: string): Promise<RefactorProgress> {
    if (this.mock) {
      // Simulate: first poll finds a diff and asks for approval.
      return {
        status: "pending_answer",
        diff: [{ field: "price", oldSelector: ".price", newSelector: "[data-testid='selling-price']" }],
      };
    }
    return this.request<RefactorProgress>(`/refactor_template/progress?jobId=${jobId}`);
  }

  /**
   * The auto-approve unlock: accepts the AI's proposed diff programmatically
   * instead of requiring a human click in the Scraper Studio UI.
   */
  async resumeAutomationJob(jobId: string): Promise<{ accepted: boolean }> {
    if (this.mock) {
      log.info("mock: resumeAutomationJob (auto-approve)", { jobId });
      // In mock mode a successful auto-approve clears the broken flag, so
      // the next extraction returns the correct value. Real API would
      // persist the updated selector config server-side.
      isBroken = false;
      return { accepted: true };
    }
    return this.request<{ accepted: boolean }>("/resume_automation_job", {
      jobId,
      message: true,
      auto_save: true,
    });
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const hasBody = body !== undefined;
    const res = await fetch(`${env.BRIGHTDATA_API_BASE}${path}`, {
      method: hasBody ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.BRIGHTDATA_API_KEY}`,
      },
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      throw new Error(`Bright Data API ${path} responded ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }
}

export const brightData = new BrightDataClient();

/**
 * Demo helper, mock-mode only. Re-breaks the mock so the next run
 * violates and triggers the heal cycle again. Real API would not have
 * this — you'd edit the page for real. Exposed via POST /api/dev/break
 * for live demos.
 */
export function breakMockForDemo(): boolean {
  if (!isMockBrightData) return false;
  isBroken = true;
  return true;
}

// --- mock helpers -----------------------------------------------------

/**
 * System-wide broken flag. The earlier shared-counter version could land
 * on multiple broken positions in a row, escalating instead of healing
 * — bad for a demo. A single flag that gets cleared by
 * `resumeAutomationJob` (the auto-approve that "succeeded") gives the
 * deterministic broken → heal → fixed cycle the SPEC's demo script
 * actually shows. Defaults to `true` so the first run always violates
 * and exercises the heal path.
 */
let isBroken = true;

function mockRun(_collectorId: string): CollectorRunResult {
  return {
    collectorId: _collectorId,
    fetchedAt: new Date().toISOString(),
    data: {
      product: "MacBook Air",
      price: isBroken ? null : 99990,
      stock: true,
    },
  };
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
