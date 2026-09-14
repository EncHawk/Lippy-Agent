export type SelectorDiff = { field: string; oldSelector?: string; newSelector: string };
export type ContractEvent = {
  type: string;
  contractId: string;
  runId?: string;
  [key: string]: unknown;
};
export type ContractEventType = ContractEvent["type"];
