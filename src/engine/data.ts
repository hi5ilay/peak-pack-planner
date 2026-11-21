import rawItems from '../data/items.json';
import overrides from '../data/overrides.json';
import mechanicsJson from '../data/mechanics.json';
import type { FoodStats, Item } from './types';

type Override = Partial<Omit<Item, 'raw' | 'cooked' | 'tags'>> & {
  raw?: Partial<FoodStats>;
  cooked?: Partial<FoodStats> | null;
  tags?: Item['tags'];
  source?: string;
};

/** Merge one override into an item. Overrides always win over wiki data. */
export function applyOverride(item: Item, o: Override): Item {
  const out: Item = { ...item, tags: { ...item.tags, ...(o.tags ?? {}) }, overridden: true };
  if (o.cookResult) out.cookResult = o.cookResult;
  if (o.raw) out.raw = { ...item.raw, ...o.raw };
  if (o.cooked === null) out.cooked = null;
  else if (o.cooked) out.cooked = { ...(item.cooked ?? item.raw), ...o.cooked };
  if (o.cookNote) out.cookNote = o.cookNote;
  if (o.notes) out.notes = o.notes;
  if (typeof o.weight === 'number') out.weight = o.weight;
  if (typeof o.uses === 'number') out.uses = o.uses;
  if (o.statusEffects) out.statusEffects = o.statusEffects;
  if (o.raw || o.cooked) {
    // Overridden numbers came from real gameplay, so they no longer count as derived.
    out.derivedFields = item.derivedFields?.filter(
      (f) => !(f.startsWith('raw.') && o.raw) && !(f.startsWith('cooked.') && o.cooked),
    );
    if (out.derivedFields && out.derivedFields.length === 0) delete out.derivedFields;
  }
  return out;
}

export function mergeItems(items: Item[], ov: Record<string, unknown>): Item[] {
  return items.map((it) => {
    const o = ov[it.id] as Override | undefined;
    return o ? applyOverride(it, o) : it;
  });
}

export const ITEMS: Item[] = mergeItems(rawItems as unknown as Item[], overrides as Record<string, unknown>);
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const MECHANICS = mechanicsJson;

export function getItem(id: string): Item {
  const it = ITEM_BY_ID[id];
  if (!it) throw new Error(`Unknown item id: ${id}`);
  return it;
}

export const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(mechanicsJson.statuses)
    .filter(([, v]) => typeof v === 'object' && v !== null && 'color' in v)
    .map(([k, v]) => [k, (v as { color: string }).color]),
);
