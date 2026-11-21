// Item choice helpers shared by arrangeInventory and advise.
import { applyAmulet } from './amulets';
import { getItem } from './data';
import { adds, extraOf, hungerFill, isBroken, isEdible, removes } from './stats';
import type { CarriedItem, ManualStatus, ManualStatusKey } from './types';

export const FIXABLE: ManualStatusKey[] = ['injury', 'poison', 'cold', 'heat', 'drowsy', 'spores', 'curse', 'thorns'];

/** Items whose "use" is a hazard to the user and must never be suggested as a fix. */
const NEVER_SELF_USE = new Set(['cursed-skull', 'napberry', 'blowgun', 'ritual-dagger', 'pandoras-lunchbox']);

export function usable(entry: CarriedItem): boolean {
  return !isBroken(entry) && !NEVER_SELF_USE.has(entry.itemId);
}

/** How much of the current statuses this entry would clear in total. */
export function totalFreed(entry: CarriedItem, status: ManualStatus): number {
  let freed = 0;
  for (const k of FIXABLE) freed += Math.min(removes(entry, k), status[k]);
  return freed;
}

export interface FixChoice {
  entry: CarriedItem;
  covered: number;
  capacity: number;
}

/**
 * Best carried fix for one status.
 * Prefers the smallest item that clears at least 75% of the status, so big kits
 * are saved for big problems. Otherwise takes the item that clears the most.
 */
export function bestFix(inventory: CarriedItem[], key: ManualStatusKey, status: ManualStatus): FixChoice | null {
  const amount = status[key];
  if (amount <= 0) return null;
  let cands = inventory
    .filter(usable)
    .map((entry) => {
      if (entry.itemId === 'scouts-tenacity') {
        const next = applyAmulet(entry.itemId, status);
        return { entry, capacity: removes(entry, key), covered: next.petrify < 100 ? amount - next[key] : 0 };
      }
      const capacity = removes(entry, key);
      return { entry, capacity, covered: Math.min(capacity, amount) };
    })
    .filter((c) => c.covered > 0)
    // Do not "fix" a status with an item that adds more of it.
    .filter((c) => adds(c.entry, key) < c.capacity);
  if (key === 'heat') {
    // Players keep the Sports Drink for stamina: only use it for Heat when nothing else exists.
    const others = cands.filter((c) => !getItem(c.entry.itemId).tags.avoidForHeat);
    if (others.length) cands = others;
  }
  // Never pick poisonous raw food as a cure when anything else exists.
  const clean = cands.filter((c) => !(getItem(c.entry.itemId).poisonousRaw && c.entry.cookLevel === 0));
  if (clean.length) cands = clean;
  if (!cands.length) return null;
  const enough = cands.filter((c) => c.covered >= amount * 0.75);
  if (enough.length) {
    enough.sort((a, b) => a.capacity - b.capacity || foodCost(a.entry) - foodCost(b.entry));
    return enough[0];
  }
  cands.sort((a, b) => b.covered - a.covered || a.capacity - b.capacity);
  return cands[0];
}

function foodCost(entry: CarriedItem): number {
  return hungerFill(entry);
}

export function isHealItem(entry: CarriedItem): boolean {
  if (!usable(entry)) return false;
  const item = getItem(entry.itemId);
  if (item.group === 'Healing' || item.group === 'Mystical food') return FIXABLE.some((k) => removes(entry, k) > 0);
  return removes(entry, 'injury') > 0 && !item.tags.edible;
}

/** Any item that can heal Injury (the only status that never goes away on its own besides Curse). */
export function canHealInjury(entry: CarriedItem): boolean {
  return usable(entry) && removes(entry, 'injury') > 0;
}

/** Overall healing power, used to rank heal items when nothing is wrong yet. */
export function healPower(entry: CarriedItem): number {
  return FIXABLE.reduce((s, k) => s + Math.min(removes(entry, k), 100), 0);
}

export function isPoisonousNow(entry: CarriedItem): boolean {
  return adds(entry, 'poison') > 0;
}

/**
 * The next thing to eat for the given Hunger.
 * Picks the biggest fill that does not go past current Hunger, avoiding poisonous
 * and "always cook first" items when something else works.
 */
export function bestFood(inventory: CarriedItem[], hunger: number): CarriedItem | null {
  let foods = inventory.filter((entry) => entry.itemId !== 'medicinal-root' && isEdible(entry));
  if (!foods.length) return null;
  const safe = foods.filter((e) => !isPoisonousNow(e));
  if (safe.length) foods = safe;
  const notWaitingForFire = foods.filter((e) => !(getItem(e.itemId).tags.alwaysCook && e.cookLevel === 0));
  if (notWaitingForFire.length) foods = notWaitingForFire;
  // Keep boost items (lollipop, drinks) for climbing when ordinary food exists.
  const plain = foods.filter((e) => {
    const it = getItem(e.itemId);
    return !it.special.infiniteStaminaSeconds && !it.special.speedBoostSeconds && !it.tags.staminaItem;
  });
  if (plain.length) foods = plain;
  const fits = foods.filter((e) => hungerFill(e) <= hunger);
  if (fits.length) {
    fits.sort((a, b) => hungerFill(b) - hungerFill(a) || extraOf(b) - extraOf(a));
    return fits[0];
  }
  foods.sort((a, b) => hungerFill(a) - hungerFill(b) || extraOf(b) - extraOf(a));
  return foods[0];
}

export interface BoostChoice {
  entry: CarriedItem;
  extra: number;
  infinite: number;
  fill: number;
  waste: number;
  score: number;
}

export function boostCandidates(inventory: CarriedItem[], hunger: number, hardClimb: boolean): BoostChoice[] {
  const out: BoostChoice[] = [];
  for (const entry of inventory) {
    if (!usable(entry) || entry.itemId === 'medicinal-root') continue;
    const item = getItem(entry.itemId);
    const extra = extraOf(entry);
    const infinite = item.special.infiniteStaminaSeconds ?? 0;
    const speed = item.special.speedBoostSeconds ?? 0;
    if (extra <= 0 && infinite <= 0 && speed <= 0) continue;
    if (isPoisonousNow(entry)) continue;
    const fill = hungerFill(entry);
    const waste = Math.max(0, fill - hunger);
    let score = extra + (hardClimb ? infinite * 4 + speed * 2 : infinite * 2 + speed);
    score -= waste * 0.5;
    out.push({ entry, extra, infinite, fill, waste, score });
  }
  return out;
}

/**
 * Best boost. Never spends food that would waste Hunger fill when a stamina-only
 * item exists, unless the player is hungry.
 */
export function bestBoost(inventory: CarriedItem[], hunger: number, hardClimb: boolean): BoostChoice | null {
  let cands = boostCandidates(inventory, hunger, hardClimb);
  if (!cands.length) return null;
  const staminaOnly = cands.filter((c) => c.fill === 0);
  const hungry = hunger >= HUNGRY;
  if (staminaOnly.length && !hungry) cands = staminaOnly;
  else if (staminaOnly.length) cands = cands.filter((c) => c.fill === 0 || c.waste === 0);
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  return cands[0];
}

/** Hunger at which the player counts as hungry. */
export const HUNGRY = 10;
