import { getItem } from './data';
import type { BagType, CarriedItem, CookLevel, FoodStats, Item, ManualStatus, ManualStatusKey } from './types';

export const COOK_LEVEL_NAMES: Record<CookLevel, string> = {
  0: 'Raw',
  1: 'Cooked',
  2: 'Well-Done',
  3: 'Burnt',
  4: 'Incinerated',
};

export const BAG_SLOTS: Record<BagType, number> = { none: 0, backpack: 4, fannypack: 2 };
export const HAND_SLOTS = 3;

export const BAG_NAMES: Record<BagType, string> = { none: 'No bag', backpack: 'Backpack', fannypack: 'Fanny Pack' };

export function canCook(item: Item): boolean {
  return item.cookResult !== 'no_change' && item.cookResult !== 'cooked_only';
}

/** The level a freshly picked up item starts at. */
export function defaultCookLevel(item: Item): CookLevel {
  return item.cookResult === 'cooked_only' ? 1 : 0;
}

/** True when cooking this entry has destroyed it or made it unusable. */
export function isBroken(entry: CarriedItem): boolean {
  const item = getItem(entry.itemId);
  if (entry.cookLevel === 0) return false;
  if (item.cookResult === 'burns') return true;
  if (item.cookResult === 'explodes' && item.id !== 'energy-drink') return true;
  return false;
}

/**
 * Stats of an entry at its cook level, using the stages from
 * https://peak.wiki.gg/wiki/Cooking: Cooked and Well-Done are the same,
 * Burnt restores 5 less Hunger, Incinerated also adds Poison 10.
 */
export function effectiveStats(entry: Pick<CarriedItem, 'itemId' | 'cookLevel'>): FoodStats {
  const item = getItem(entry.itemId);
  const level = entry.cookLevel;
  if (level === 0 || !item.cooked) {
    if (level === 0 && item.cookResult === 'cooked_only' && item.cooked) return item.cooked;
    return item.raw;
  }
  const base = item.cooked;
  if (level <= 2 || item.cookResult === 'no_change') return base;
  const hunger = base.hunger === null ? null : Math.max(0, base.hunger - 5);
  const effects = [...base.effects];
  if (level === 4) effects.push({ status: 'poison', amount: 10, timing: 'instant', detail: 'incinerated' });
  return { hunger, extraStamina: base.extraStamina, effects };
}

export function hungerFill(entry: Pick<CarriedItem, 'itemId' | 'cookLevel'>): number {
  return effectiveStats(entry).hunger ?? 0;
}

export function extraOf(entry: Pick<CarriedItem, 'itemId' | 'cookLevel'>): number {
  return effectiveStats(entry).extraStamina ?? 0;
}

/** Amount of a status this entry removes when used (positive number), 0 if none. */
export function removes(entry: Pick<CarriedItem, 'itemId' | 'cookLevel'>, status: ManualStatusKey): number {
  return effectiveStats(entry)
    .effects.filter((e) => e.status === status && e.amount < 0)
    .reduce((s, e) => s - e.amount, 0);
}

/** Amount of a status this entry adds when used. */
export function adds(entry: Pick<CarriedItem, 'itemId' | 'cookLevel'>, status: ManualStatusKey): number {
  return effectiveStats(entry)
    .effects.filter((e) => e.status === status && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
}

export function isEdible(entry: CarriedItem): boolean {
  const item = getItem(entry.itemId);
  return !!item.tags.edible && hungerFill(entry) > 0 && !isBroken(entry);
}

/** Ascent 3+ adds 2.5 to every item except the Backpack (https://peak.wiki.gg/wiki/Ascents). */
export function itemWeight(item: Item, ascent = 0): number {
  const w = item.weight ?? 0;
  return ascent >= 3 && item.id !== 'backpack' ? w + 2.5 : w;
}

/**
 * Weight status from the carried items: the sum of item weights, clamped at 0.
 * https://peak.wiki.gg/wiki/Stamina_bar#Weight
 */
export function computeWeight(inventory: CarriedItem[], ascent = 0): number {
  const total = inventory.reduce((s, e) => s + itemWeight(getItem(e.itemId), ascent), 0);
  return Math.max(0, Math.round(total * 100) / 100);
}

export function emptyStatus(): ManualStatus {
  return { hunger: 0, injury: 0, poison: 0, cold: 0, heat: 0, drowsy: 0, spores: 0, curse: 0, thorns: 0, petrify: 0 };
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}
