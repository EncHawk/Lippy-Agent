export type CreateScraperInput = {
  url: string;
  description: string;
};

export type CreateScraperResult = {
  collectorId: string; // c_*
};

export type CollectorRunResult = {
  collectorId: string;
  data: Record<string, unknown>;
  fetchedAt: string;
};

export type RefactorTemplateInput = {
  collectorId: string;
  /** Plain-language instruction, generated from the field(s) that failed validation. */
  prompt: string;
};

export type RefactorProgressStatus = "in_progress" | "pending_answer" | "done" | "failed";

export type RefactorProgress = {
  status: RefactorProgressStatus;
  diff?: { field: string; oldSelector?: string; newSelector: string }[];
};
