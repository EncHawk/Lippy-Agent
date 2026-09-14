import { requireUser } from "@/lib/auth/service";
import { getContract } from "@/lib/contracts/service";
import { readEvents } from "@/lib/events/bus";
import { cursor, endpoint } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => {
  const owner = await requireUser(req), { id } = await ctx.params;
  await getContract(id, owner);
  let after = cursor(req.headers.get("last-event-id") ?? new URL(req.url).searchParams.get("after"));
  if (!req.headers.get("accept")?.includes("text/event-stream")) return Response.json({ events: await readEvents(id, after) });
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abort = () => { cancelled = true; };
      req.signal.addEventListener("abort", abort, { once: true });
      try {
        controller.enqueue(encoder.encode(": subscribed\n\n"));
        while (!cancelled && !req.signal.aborted) {
          // Re-check authentication so expired/revoked tokens cannot keep reading indefinitely.
          await requireUser(req);
          const events = await readEvents(id, after);
          if (cancelled || req.signal.aborted) break;
          for (const event of events) {
            controller.enqueue(encoder.encode(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`));
            after = BigInt(event.sequence);
          }
          if (events.length === 100) continue;
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!cancelled) controller.close();
      } catch (error) { if (!cancelled) controller.error(error); }
      finally { req.signal.removeEventListener("abort", abort); }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}); }
