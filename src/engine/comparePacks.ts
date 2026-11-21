import { getItem } from './data';
import { computeWeight, extraOf, fmt, hungerFill, isBroken } from './stats';
import type { CarriedItem } from './types';

function summarize(pack: CarriedItem[], ascent: number) {
  const usable = pack.filter((entry) => !isBroken(entry));
  return {
    weight: computeWeight(pack, ascent),
    clawUses: usable.reduce((total, entry) =>
      total + (entry.itemId === 'rescue-claw' ? entry.usesLeft ?? getItem(entry.itemId).uses ?? 0 : 0), 0),
    hunger: usable.reduce((total, entry) => total + hungerFill(entry) * (entry.usesLeft ?? getItem(entry.itemId).uses ?? 1), 0),
    bonus: usable.reduce((total, entry) => total + extraOf(entry) * (entry.usesLeft ?? getItem(entry.itemId).uses ?? 1), 0),
  };
}

export function comparePacks(before: CarriedItem[], after: CarriedItem[], ascent: number) {
  const current = summarize(before, ascent);
  const proposed = summarize(after, ascent);
  const changes = [
    ['Weight', current.weight, proposed.weight],
    ['Rescue Claw uses', current.clawUses, proposed.clawUses],
    ['Hunger recovery carried', current.hunger, proposed.hunger],
    ['Bonus stamina carried', current.bonus, proposed.bonus],
  ] as const;
  return {
    current,
    proposed,
    details: changes
      .filter(([, from, to]) => from !== to)
      .map(([label, from, to]) => `${label} ${fmt(from)} to ${fmt(to)}`)
      .join(' · '),
  };
}
