import { describe, it, expect, vi } from "vitest";
import { BrightDataClient } from "../lib/brightdata/client";
function setup(responses: Response[]) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => responses.shift()!);
  return { client: new BrightDataClient(fetcher), fetcher };
}
describe("documented Bright Data wire protocol", () => {
  it("triggers a collection and polls 202 until results are ready", async () => {
    const { client, fetcher } = setup([Response.json({ collection_id: "j_123" }), Response.json({ status: "building" }, { status: 202 }), Response.json([{ price: 100 }])]);
    expect(await client.trigger("c_123", "https://example.com", "run_123")).toBe("j_123");
    expect(fetcher.mock.calls[0]?.[0]).toContain("collector=c_123");
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual([{ url: "https://example.com" }]);
    expect(await client.results("j_123")).toBe(null);
    expect(await client.results("j_123")).toEqual({ price: 100 });
  });
  it("accepts the empty approval response and sends auto_save", async () => {
    const { client, fetcher } = setup([new Response(null, { status: 200 })]);
    await expect(client.approve("c_123")).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[0]).toContain("/dca/collectors/c_123/resume_automation_job");
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({ message: true, auto_save: true });
  });
  it("rejects unexpected records rather than silently picking a row", async () => {
    const { client } = setup([Response.json([{ price: 1 }, { price: 2 }])]);
    await expect(client.results("j_123")).rejects.toThrow();
  });
  it("marks rate limits retryable and never treats errors as no-change", async () => {
    const { client } = setup([new Response("rate limited", { status: 429 })]);
    await expect(client.results("j_123")).rejects.toMatchObject({ retryable: true });
  });
  it("rejects malformed provider progress", async () => {
    const { client } = setup([Response.json({ unexpected: true })]);
    await expect(client.progress("c_123", true)).rejects.toThrow();
  });
});
