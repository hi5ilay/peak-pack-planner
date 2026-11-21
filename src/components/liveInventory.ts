import { useEffect, useState } from 'react';
import { advise, arrangeInventory, BAG_SLOTS, defaultCookLevel, emptyStatus, getItem, itemWeight, ITEMS, type Arrangement, type BagType, type CarriedItem, type CookLevel, type ManualStatus } from '../engine';
import { comparePacks } from '../engine/comparePacks';

export interface LiveItem {
  uid: string;
  name: string;
  slot: string;
  cookLevel: number;
  usesLeft: number | null;
}

export interface LiveRun {
  runId?: string;
  markId?: number;
  consumed?: { uid: string; time: number }[];
  hands: (LiveItem | null)[];
  pockets: (LiveItem | null)[];
  marked: LiveItem | null;
  bagType: string;
  ascent: number;
  stamina: number;
  extraStamina: number;
  status: ManualStatus;
}

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const catalog = new Map(ITEMS.map((item) => [normalize(item.name), item]));

export function toEntry(item: LiveItem): CarriedItem | null {
  const match = catalog.get(normalize(item.name));
  if (!match) return null;
  const cookLevel = (Math.max(defaultCookLevel(match), Math.min(4, item.cookLevel))) as CookLevel;
  return { uid: item.uid, itemId: match.id, cookLevel, usesLeft: item.usesLeft };
}

function prefersPocket(entry: CarriedItem, ascent: number): boolean {
  const item = getItem(entry.itemId);
  return (item.tags.alwaysCook === true && entry.cookLevel === 0) || itemWeight(item, ascent) < 0;
}

function handOrder(run: LiveRun, entry: CarriedItem, plan: Arrangement, swapUid?: string): string | undefined {
  const hand = plan.hands.findIndex((slot) => slot?.entry.uid === entry.uid && slot.role !== 'free');
  if (hand < 0 || prefersPocket(entry, run.ascent)) return;
  const occupant = run.hands[hand];
  if (!occupant || occupant.uid === entry.uid || occupant.uid === swapUid) return;
  const hands = plan.hands.flatMap((slot, index) => slot ? [`${index + 1}: ${getItem(slot.entry.itemId).name}`] : []);
  return `Arrange hands after pickup — ${hands.join(' · ')}.`;
}

function placement(run: LiveRun, bagType: BagType, entry: CarriedItem, plan: Arrangement, swapUid?: string): string | undefined {
  const hand = plan.hands.findIndex((slot) => slot?.entry.uid === entry.uid);
  const store = prefersPocket(entry, run.ascent);
  const available = (slot: LiveItem | null | undefined) => !slot || slot.uid === swapUid;
  const pocket = Array.from({ length: BAG_SLOTS[bagType] }, (_, index) => run.pockets[index]).findIndex(available);
  const freeHand = hand >= 0 && available(run.hands[hand]) ? hand : run.hands.findIndex(available);
  const currentHand = run.hands.findIndex((slot) => slot?.uid === entry.uid);
  const inPocket = run.pockets.some((slot) => slot?.uid === entry.uid);

  if (store || hand < 0) {
    if (inPocket) return;
    if (pocket >= 0) return `backpack pocket ${pocket + 1}`;
  }
  if (currentHand >= 0 && (hand === currentHand || freeHand !== hand)) return;
  if (freeHand >= 0) return `hand slot ${freeHand + 1}`;
  if (!inPocket && pocket >= 0) return `backpack pocket ${pocket + 1}`;
}

export function pickupAdvice(run: LiveRun, bagType: BagType): { text: string; action?: "take" | "leave" | "eat" | "swap"; swapUid?: string } {
  const marked = run.marked;
  if (!marked) return { text: 'Look at a highlighted item in PEAK and press T.' };
  const carried = [...run.hands, ...run.pockets].filter((item): item is LiveItem => item !== null);
  const held = carried.find((item) => item.uid === marked.uid);
  const candidate = toEntry(marked);
  if (!candidate) return { text: 'This item has no matching entry in the planner catalog.' };
  const entries = carried.map(toEntry);
  if (entries.some((item) => item === null)) return { text: 'A carried item is unknown. Swap advice is paused until the whole pack can be evaluated.' };
  const known = entries.filter((item): item is CarriedItem => item !== null);
  const status = { ...emptyStatus(), ...run.status };
  const before = arrangeInventory(known, bagType, status, run.ascent);
  if (held) {
    const entry = toEntry(held);
    const order = entry && handOrder(run, entry, before);
    if (order) return { text: order };
    const destination = entry && placement(run, bagType, entry, before);
    return { text: destination ? `Move it to ${destination}.` : `Already in your pack (${held.slot}).` };
  }
  const proposed = advise({
    inventory: [...known, candidate], bagType, status, ascent: run.ascent,
    stamina: run.stamina, extraStamina: run.extraStamina, hardClimb: false, atCampfire: false,
  });
  const after = proposed.arrangement;
  const rejected = after.overflow.find(({ entry }) => entry.uid === candidate.uid);
  if (rejected) {
    const snack = proposed.actions.find((action) => action.uid === candidate.uid && action.action === 'eat');
    return snack ? { action: 'eat', text: 'Eat it before moving on. ' + snack.result + '.' }
      : { action: 'leave', text: 'Leave it. ' + rejected.reason };
  }
  const priorOverflow = new Set(before.overflow.map(({ entry }) => entry.uid));
  const displaced = after.overflow.find(({ entry }) => !priorOverflow.has(entry.uid));
  const slots = run.hands.length + (bagType === 'backpack' ? 4 : bagType === 'fannypack' ? 2 : 0);
  const swap = displaced ?? (carried.length >= slots ? after.overflow[0] : undefined);
  if (!swap) {
    const trade = comparePacks(known, [...known, candidate], run.ascent);
    const order = handOrder(run, candidate, after);
    const destination = placement(run, bagType, candidate, after);
    const instruction = order ? `Pick it up. ${order}` : destination ? `Pick it up and put it in ${destination}.` : 'Pick it up. You have room.';
    return { action: 'take', text: [instruction, trade.details].filter(Boolean).join(' ') };
  }
  const item = carried.find((entry) => entry.uid === swap.entry.uid);
  const trade = comparePacks(known, known.map((entry) => entry.uid === swap.entry.uid ? candidate : entry), run.ascent);
  const order = handOrder(run, candidate, after, swap.entry.uid);
  const destination = placement(run, bagType, candidate, after, swap.entry.uid);
  const instruction = 'Swap out ' + getItem(swap.entry.itemId).name + (item ? ' (' + item.slot + ')' : '') + '.'
    + (order ? ` ${order}` : destination ? ` Put the marked item in ${destination}.` : '');
  return { action: 'swap', swapUid: swap.entry.uid, text: [instruction, trade.details || swap.reason].join(' ') };
}

export const LIVE_URL = 'http://127.0.0.1:47831/?live';

export function useLiveInventory(enabled: boolean) {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [sampleTime, setSampleTime] = useState(0);
  const [connection, setConnection] = useState('Waiting for the PEAK mod');
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const local = window.location.hostname === '127.0.0.1';
        const url = local ? '/snapshot' : new URL('/snapshot', LIVE_URL);
        const response = await fetch(url, {signal: controller.signal, cache: 'no-store', targetAddressSpace: 'loopback'} as RequestInit);
        if (!response.ok) throw new Error('Waiting');
        const data = await response.json();
        if (data.version !== 1 || Date.now() - data.time > 3000) throw new Error('Stale');
        setSampleTime(data.time);
        setRun(data.run);
        setConnection(data.run ? 'Connected to PEAK' : 'Connected · Start a climb');
      } catch {
        if (controller.signal.aborted) return;
        setRun(null);
        setSampleTime(Date.now());
        setConnection('Waiting for the PEAK mod');
      }
      timer = window.setTimeout(poll, 500);
    }
    void poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [enabled]);
  return { run: enabled ? run : null, connection, sampleTime };
}
