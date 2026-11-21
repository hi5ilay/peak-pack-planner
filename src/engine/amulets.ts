import type { ManualStatus, ManualStatusKey } from './types';

const TENACITY_ORDER: ManualStatusKey[] = ['injury', 'spores', 'poison', 'cold', 'heat', 'drowsy'];

export const AMULETS = {
  'scouts-initiative': { cost: '7', effect: '12.8 m lift and 3 s of wind walking' },
  'scouts-tenacity': { cost: '10–30', effect: 'Clears up to 60 total ailments and grants 10 s of invincibility' },
  'scouts-generosity': { cost: '25 regular / 45 mystical', effect: 'Duplicates the targeted inventory item' },
  'scouts-ambition': { cost: '30', effect: '8 s of infinite stamina within a 9.6 m aura' },
};

export function getAmulet(id: string) {
  return Object.prototype.hasOwnProperty.call(AMULETS, id) ? AMULETS[id as keyof typeof AMULETS] : undefined;
}

export function applyAmulet(id: string, status: ManualStatus, mysticalTarget = false): ManualStatus {
  const next = { ...status };
  let cost = 0;
  switch (id) {
    case 'scouts-initiative': cost = 7; break;
    case 'scouts-generosity': cost = mysticalTarget ? 45 : 25; break;
    case 'scouts-ambition': cost = 30; break;
    case 'scouts-tenacity': {
      let remaining = 60;
      for (const key of TENACITY_ORDER) {
        const healed = Math.min(remaining, status[key]);
        next[key] -= healed;
        remaining -= healed;
      }
      cost = Math.max(10, (status.injury - next.injury) / 2);
      break;
    }
  }
  next.petrify = Math.min(100, (status.petrify ?? 0) + cost);
  return next;
}
