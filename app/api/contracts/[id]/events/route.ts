import { NextRequest } from "next/server";
import { eventBus } from "@/lib/events/bus";

/**
 * GET /api/contracts/:id/events -> Server-Sent Events stream filtered to
 * one contract. Subscribes to the in-process event bus on connect,
 * forwards each event as a `data: ...\n\n` SSE frame, and emits a
 * comment heartbeat every 15s so intermediaries don't drop the connection.
 *
 * The detail page opens this with EventSource to render the live event
 * timeline without polling.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await ctx.params;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed; cleanup will run via cancel().
        }
      };

      // Initial comment + a synthetic hello so the client confirms the
      // subscription is live before the first real event.
      write(`: subscribed to ${contractId}\n\n`);
      write(
        `event: hello\ndata: ${JSON.stringify({ contractId, ts: new Date().toISOString() })}\n\n`,
      );

      unsubscribe = eventBus.subscribe((event) => {
        if (event.contractId !== contractId) return;
        write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      heartbeat = setInterval(() => write(`: heartbeat ${Date.now()}\n\n`), 15000);

      // If the client disconnects, Next.js calls cancel(); clean up.
      req.signal.addEventListener("abort", () => {
        if (unsubscribe) unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
