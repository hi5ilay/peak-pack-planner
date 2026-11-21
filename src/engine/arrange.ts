import { getItem } from './data';
import { bestBoost, bestFix, bestFood, FIXABLE, healPower, isHealItem, usable } from './choose';
import { BAG_NAMES, BAG_SLOTS, extraOf, HAND_SLOTS, hungerFill, isBroken, isEdible } from './stats';
import type { BagType, CarriedItem, ManualStatus } from './types';

export type SlotRole = 'heal' | 'food' | 'emergency' | 'bag' | 'free';

export interface ArrangedSlot {
  entry: CarriedItem;
  role: SlotRole;
}

export interface OverflowEntry {
  entry: CarriedItem;
  reason: string;
}

export interface Arrangement {
  hands: (ArrangedSlot | null)[];
  bag: (ArrangedSlot | null)[];
  overflow: OverflowEntry[];
  /** Everything that fits (hands then bag), in slot order. */
  kept: CarriedItem[];
}

export const ROLE_LABELS: Record<SlotRole, string> = {
  heal: 'Heal',
  food: 'Main food',
  emergency: 'Emergency',
  bag: 'Bag',
  free: 'Spare',
};

/** How much an entry is worth keeping. Higher stays, lowest goes to overflow first. */
export function keepPriority(entry: CarriedItem, ascent = 0): number {
  const item = getItem(entry.itemId);
  if (isBroken(entry)) return 0;
  if (item.tags.objective) return ascent >= 4 ? 95 : 45;
  if (item.tags.junk) return 5;
  if (isHealItem(entry)) return 70 + Math.min(20, healPower(entry) / 10);
  if (item.tags.climbingTool) return 66;
  if (isEdible(entry)) return 55 + Math.min(20, hungerFill(entry) / 4) + Math.min(10, extraOf(entry) / 5);
  if (extraOf(entry) > 0 || item.special.infiniteStaminaSeconds) return 58;
  if (item.group === 'Mystical and special') return 50;
  if (item.group === 'Light and utility') return 35;
  return 25;
}

function overflowReason(entry: CarriedItem, bagType: BagType, capacity: number): string {
  const item = getItem(entry.itemId);
  const space =
    bagType === 'none'
      ? `all ${capacity} hand slots are full and you have no bag`
      : `all ${capacity} slots are full (3 hands + ${BAG_SLOTS[bagType]} ${BAG_NAMES[bagType]} pockets)`;
  if (isBroken(entry)) return `Broken by cooking and ${space}.`;
  if (item.tags.junk) return `Junk item and ${space}.`;
  return `Lowest priority item and ${space}.`;
}

/**
 * Puts items into fixed slot roles:
 * slot 1 Heal, slot 2 Main food (next thing to eat), slot 3 Emergency
 * (climbing tool, or a stamina boost when there is no tool). The bag holds the
 * rest in priority order. A role with no candidate is filled with the next
 * best item (role "free"). What does not fit goes to overflow with a reason.
 */
export function arrangeInventory(
  items: CarriedItem[],
  bagType: BagType,
  status: ManualStatus,
  ascent = 0,
): Arrangement {
  const capacity = HAND_SLOTS + BAG_SLOTS[bagType];
  const prio = new Map(items.map((e) => [e.uid, keepPriority(e, ascent)]));
  const byPriority = [...items].sort((a, b) => (prio.get(b.uid) ?? 0) - (prio.get(a.uid) ?? 0));
  const keepSet = new Set(byPriority.slice(0, capacity).map((e) => e.uid));
  const overflow: OverflowEntry[] = byPriority
    .slice(capacity)
    .map((entry) => ({ entry, reason: overflowReason(entry, bagType, capacity) }));
  let pool = items.filter((e) => keepSet.has(e.uid));
  const take = (e: CarriedItem | null | undefined): CarriedItem | null => {
    if (!e) return null;
    pool = pool.filter((p) => p.uid !== e.uid);
    return e;
  };

  // Slot 1: the heal for whatever hurts most right now, else the strongest heal.
  let heal: CarriedItem | null = null;
  const worst = [...FIXABLE].filter((k) => status[k] > 0).sort((a, b) => status[b] - status[a]);
  for (const k of worst) {
    const fix = bestFix(pool, k, status);
    if (fix && isHealItem(fix.entry)) {
      heal = fix.entry;
      break;
    }
  }
  if (!heal) {
    const heals = pool.filter(isHealItem).sort((a, b) => healPower(b) - healPower(a));
    heal = heals[0] ?? null;
  }
  heal = take(heal);

  // Slot 2: the next thing to eat.
  const food = take(bestFood(pool, Math.max(status.hunger, 15)));

  // Slot 3: a climbing tool, or the best stamina boost.
  const tools = pool
    .filter((e) => usable(e) && getItem(e.itemId).tags.climbingTool)
    .sort((a, b) => (prio.get(b.uid) ?? 0) - (prio.get(a.uid) ?? 0));
  let emergency = take(tools[0] ?? null);
  if (!emergency) emergency = take(bestBoost(pool, status.hunger, true)?.entry ?? null);

  const rest = [...pool].sort((a, b) => (prio.get(b.uid) ?? 0) - (prio.get(a.uid) ?? 0));
  const hands: (ArrangedSlot | null)[] = [
    heal ? { entry: heal, role: 'heal' } : null,
    food ? { entry: food, role: 'food' } : null,
    emergency ? { entry: emergency, role: 'emergency' } : null,
  ];
  const bagSlots = BAG_SLOTS[bagType];
  // With no bag, empty hand roles take the next items so nothing that fits is lost.
  // With a bag, spare items go to the bag first and only fill hands when the bag is full.
  const bag: (ArrangedSlot | null)[] = Array.from({ length: bagSlots }, () => null);
  let bi = 0;
  for (const e of rest) {
    if (bi < bagSlots) {
      bag[bi++] = { entry: e, role: 'bag' };
      continue;
    }
    const free = hands.findIndex((h) => h === null);
    if (free >= 0) hands[free] = { entry: e, role: 'free' };
  }
  const kept = [...hands, ...bag].filter((s): s is ArrangedSlot => s !== null).map((s) => s.entry);
  return { hands, bag, overflow, kept };
}
