import { db } from "../db";
import { createLogger } from "../logger";
import type { ContractEvent } from "./types";

const log = createLogger("event-bus");

type Subscriber = (event: ContractEvent) => void;

/**
 * Minimal in-process pub/sub. For a single-instance hackathon deployment
 * this is the right amount of infrastructure — it's trivially swappable for
 * Redis pub/sub or a queue later because every publisher/consumer only ever
 * talks to `publish`/`subscribe`, never to a transport detail.
 */
class EventBus {
  private subscribers = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  async publish(event: ContractEvent): Promise<void> {
    log.info("event", { type: event.type, contractId: event.contractId });

    // Persist first so the event is durable even if a subscriber throws.
    await db.contractEvent.create({
      data: {
        contractId: event.contractId,
        type: event.type,
        payload: JSON.stringify(event),
      },
    });

    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (err) {
        log.error("subscriber threw", { err: String(err) });
      }
    }
  }
}

export const eventBus = new EventBus();
