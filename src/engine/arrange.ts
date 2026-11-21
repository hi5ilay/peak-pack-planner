import { getItem } from './data';
import { bestBoost, bestFix, bestFood, canHealInjury, FIXABLE, healPower, isHealItem, usable } from './choose';
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
  const overflow: OverflowEntry[] = byPriority
    .filter((entry) => entry.itemId === 'rope-spool')
    .map((entry) => ({ entry, reason: 'Leave the Rope Spool behind on solo climbs. Save the slot for gear you can use.' }));
  let pool = byPriority.filter((entry) => entry.itemId !== 'rope-spool');
  const take = (e: CarriedItem | null | undefined): CarriedItem | null => {
    if (!e) return null;
    pool = pool.filter((p) => p.uid !== e.uid);
    return e;
  };

  // Reserve hand roles before using the remaining slots for spares.
  const heals = pool.filter(isHealItem);
  const bandages = heals.find((e) => e.itemId === 'bandages');
  const firstAid = heals.find((e) => e.itemId === 'first-aid-kit');
  const worst = FIXABLE.filter((k) => status[k] > 0).sort((a, b) => status[b] - status[a]);
  const statusHeal = worst.map((k) => bestFix(heals, k, status)?.entry).find(Boolean);
  const heal = take(bandages ?? firstAid ?? heals.find(canHealInjury) ?? statusHeal ?? heals[0]);

  const food = take(bestFood(pool.filter((e) => !isHealItem(e)), Math.max(status.hunger, 15))
    ?? bestFood(pool, Math.max(status.hunger, 15)));

  // On Ascent 4+ the Flare is required to finish, so reserve it even with no bag.
  const objective = ascent >= 4 ? take(pool.find((e) => getItem(e.itemId).tags.objective && usable(e))) : null;
  const hasEmergencySlot = Number(!!heal) + Number(!!food) + Number(!!objective) < capacity;
  const emergency = hasEmergencySlot
    ? take(pool.find((e) => usable(e) && getItem(e.itemId).tags.climbingTool)
      ?? bestBoost(pool.filter((e) => !isHealItem(e)), status.hunger, true)?.entry)
    : null;

  const rest = objective ? [objective] : [];
  const spareKit = heal?.itemId === 'bandages' && firstAid && pool.includes(firstAid) ? take(firstAid) : null;
  const candidates = spareKit ? [spareKit, ...pool] : pool;
  const spareSlots = capacity - Number(!!heal) - Number(!!food) - Number(!!emergency);
  // Foods such as Medicinal Root cover Hunger as well as treating statuses.
  // Only dedicated heals count toward the two-item limit.
  let healCount = Number(!!heal && !isEdible(heal));
  for (const entry of candidates) {
    const healing = isHealItem(entry) && !isEdible(entry);
    if (healing && healCount >= 2) {
      overflow.push({ entry, reason: 'Already carrying two dedicated heals. Leave space for food and climbing gear.' });
    } else if (rest.length >= spareSlots) {
      overflow.push({ entry, reason: overflowReason(entry, bagType, capacity) });
    } else {
      rest.push(entry);
      if (healing) healCount++;
    }
  }

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
