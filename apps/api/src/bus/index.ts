import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { RedisClientType } from 'redis';
import type { Alert, Incident, IncidentSummary, NormalizedEvent } from '@argus/contracts';

export interface IncidentEvent {
  incident: Incident;
  latestAlert: Alert;
}

interface BusEvents {
  'incident.created': [IncidentEvent];
  'incident.updated': [IncidentEvent];
  'summary.ready': [IncidentSummary];
  'event.normalized': [NormalizedEvent];
  'alert.raised': [Alert];
}

export type Bus = EventEmitter<BusEvents>;

export function createBus(): Bus {
  return new EventEmitter<BusEvents>();
}

const REDIS_BUS_CHANNEL = 'argus:bus';

interface RelayedMessage {
  instanceId: string;
  type: keyof BusEvents;
  payload: unknown;
}

// Redis-backed bus: `emit` still notifies this process's listeners
// synchronously (nothing about existing bus.on(...) call sites changes) and
// also publishes to a Redis channel, so a second `realtime` instance running
// its own RedisBus picks the same event up and re-emits it locally there too.
// Each publish is tagged with this instance's id so its own echo back from
// the subscriber is ignored — the local emit already delivered it once.
export class RedisBus extends EventEmitter<BusEvents> {
  private readonly instanceId = randomUUID();

  private constructor(private readonly publisher: RedisClientType) {
    super();
  }

  static async create(publisher: RedisClientType, subscriber: RedisClientType): Promise<RedisBus> {
    const bus = new RedisBus(publisher);
    await subscriber.subscribe(REDIS_BUS_CHANNEL, (message) => {
      const relayed = JSON.parse(message) as RelayedMessage;
      if (relayed.instanceId === bus.instanceId) return;
      // call the base EventEmitter's emit directly — bypasses this class's
      // override so relaying an incoming message doesn't re-publish it
      EventEmitter.prototype.emit.call(bus, relayed.type, relayed.payload);
    });
    return bus;
  }

  override emit<K extends keyof BusEvents>(type: K, ...args: BusEvents[K]): boolean {
    // EventEmitter.prototype.emit.call(this, ...), not `super.emit` extracted
    // into a variable first — the latter drops `this` when invoked standalone,
    // since super's implicit binding only applies to the direct `super.x()` call
    // form. .call(this, ...) also sidesteps the base class's conditional generic
    // `emit` type, which doesn't unify with a spread of our own generic tuple.
    const emitBase = EventEmitter.prototype.emit as (
      this: RedisBus,
      t: K,
      ...a: BusEvents[K]
    ) => boolean;
    const result = emitBase.call(this, type, ...args);
    // every BusEvents entry is a single-payload tuple — args[0] is that payload
    const relayed: RelayedMessage = { instanceId: this.instanceId, type, payload: args[0] };
    void this.publisher.publish(REDIS_BUS_CHANNEL, JSON.stringify(relayed));
    return result;
  }
}

// tracks which entities are "part of an active story" so the live pipeline
// view only gets normalized-event traffic for entities a rule has actually
// fired on recently, instead of every background benign event too.
export class HotEntities {
  private readonly hotUntil = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  markHot(entity: string, now: number = Date.now()): void {
    this.hotUntil.set(entity, now + this.ttlMs);
  }

  isHot(entity: string, now: number = Date.now()): boolean {
    const expiresAt = this.hotUntil.get(entity);
    if (expiresAt === undefined) return false;
    if (expiresAt < now) {
      this.hotUntil.delete(entity);
      return false;
    }
    return true;
  }
}
