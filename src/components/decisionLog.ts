import type { LiveItem, LiveRun } from './liveInventory';

export type PickupAdvice = { text: string; action?: 'take' | 'leave' | 'eat' | 'swap'; swapUid?: string };
type EventKind = 'picked up' | 'moved' | 'charges used' | 'consumed' | 'no longer carried' | 'other item removed' | 'other item returned' | 'tracking interrupted';

interface DecisionEvent {
  time: number;
  kind: EventKind;
  item: string;
  detail?: string;
  uid?: string;
  pack?: LiveItem[];
}

export interface Decision {
  id: string;
  runId: string;
  target: LiveItem;
  markedAt: number;
  recommendation: PickupAdvice;
  before: LiveItem[];
  lastPack: LiveItem[];
  lastSeen: number;
  carriedMs: number;
  pickedUp: boolean;
  pickedUpAt?: number;
  closed: boolean;
  events: DecisionEvent[];
}

const packOf = (run: LiveRun): LiveItem[] => [...run.hands, ...run.pockets].filter((item): item is LiveItem => item !== null);

export function observeDecision(log: Decision[], run: LiveRun | null, time: number, advice?: PickupAdvice): Decision[] {
  if (!time) return log;
  const runId = run?.runId ?? 'legacy';
  const pack = run ? packOf(run) : [];
  const marked = run?.marked;
  const id = marked ? `${runId}:${run?.markId ?? marked.uid}` : null;
  const updated = log.map((entry): Decision => {
    if (entry.closed || time <= entry.lastSeen) return entry;
    if (!run || runId !== entry.runId || time - entry.lastSeen > 3000) {
      return { ...entry, closed: true, events: [...entry.events, { time, kind:'tracking interrupted', item: entry.target.name }] };
    }
    if (!entry.pickedUp && id !== entry.id && !pack.some((item) => item.uid === entry.target.uid)
      && !run.consumed?.some((event) => event.uid === entry.target.uid && event.time >= entry.markedAt)) {
      return { ...entry, closed: true };
    }
    const before = entry.lastPack.find((item) => item.uid === entry.target.uid);
    const now = pack.find((item) => item.uid === entry.target.uid);
    const events = [...entry.events];
    const note = (kind: EventKind, item: string, detail?: string, uid?: string) => events.push({ time, kind, item, detail, uid, pack });
    const consumed = run.consumed?.some((event) => event.uid === entry.target.uid && event.time >= entry.markedAt)
      && !events.some((event) => event.kind === 'consumed');
    if (!before && now) note('picked up', now.name, now.slot);
    if (before && now && before.slot !== now.slot) note('moved', now.name, `${before.slot} → ${now.slot}`);
    if (before?.usesLeft != null && now?.usesLeft != null && now.usesLeft < before.usesLeft) {
      note('charges used', now.name, `${before.usesLeft} → ${now.usesLeft}`);
    }
    if (consumed) note('consumed', entry.target.name);
    else if (before && !now) note('no longer carried', before.name, 'Reason unknown');
    const pickedUpAt = entry.pickedUpAt ?? (now || consumed ? time : undefined);
    if (pickedUpAt !== undefined) {
      for (const original of entry.before) {
        const wasCarried = entry.lastPack.some((item) => item.uid === original.uid);
        const isCarried = pack.some((item) => item.uid === original.uid);
        if (wasCarried && !isCarried && time - pickedUpAt <= 3000) note('other item removed', original.name, original.slot, original.uid);
        if (!wasCarried && isCarried && events.some((event) => event.kind === 'other item removed' && event.uid === original.uid)) {
          note('other item returned', original.name, original.slot, original.uid);
        }
      }
    }
    return {
      ...entry, events, lastPack: pack, lastSeen: time,
      pickedUp: entry.pickedUp || !!now || !!consumed, pickedUpAt,
      carriedMs: entry.carriedMs + (before && (now || consumed) ? time - entry.lastSeen : 0),
      closed: !!consumed,
    };
  });
  if (!marked || !id || !advice?.action || updated.some((entry) => entry.id === id)) return updated;
  return [...updated, {
    id, runId, target: marked, markedAt: time, recommendation: advice, before: pack,
    lastPack: pack, lastSeen: time, carriedMs: 0, pickedUp: false, closed: false, events: [],
  }].slice(-100);
}
