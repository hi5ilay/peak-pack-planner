import { describe, expect, it } from 'vitest';
import { advise, type Advice } from './advise';
import { arrangeInventory } from './arrange';
import { computeBar } from './bar';
import { getItem, ITEMS } from './data';
import { computeWeight, defaultCookLevel, effectiveStats, emptyStatus } from './stats';
import type { BagType, CarriedItem, CookLevel, GameState, ManualStatus } from './types';
import { step } from '../state';

let n = 0;
function c(itemId: string, cookLevel?: CookLevel): CarriedItem {
  const item = getItem(itemId);
  return { uid: `u${++n}`, itemId, cookLevel: cookLevel ?? defaultCookLevel(item), usesLeft: item.uses };
}

function state(partial: Partial<Omit<GameState, 'status'>> & { status?: Partial<ManualStatus> }): GameState {
  return {
    inventory: [],
    bagType: 'backpack',
    stamina: 100,
    extraStamina: 0,
    hardClimb: false,
    atCampfire: false,
    ascent: 0,
    ...partial,
    status: { ...emptyStatus(), ...(partial.status ?? {}) },
  };
}

const top = (a: Advice) => a.actions[0];
const has = (a: Advice, kind: string) => a.warnings.some((w) => w.kind === kind);

describe('amulet activation', () => {
  it.each([
    ['scouts-initiative', false, 7],
    ['scouts-tenacity', false, 20],
    ['scouts-generosity', false, 25],
    ['scouts-generosity', true, 45],
    ['scouts-ambition', false, 30],
  ] as const)('keeps %s in the pack and records its Petrify', (id, mysticalTarget, cost) => {
    const entry = c(id);
    const after = step(state({
      inventory: [entry], status: { injury: 40, poison: 40, petrify: 10 }, extraStamina: 100,
    }), { type: 'use', uid: entry.uid, mysticalTarget });
    expect(after.inventory).toEqual([entry]);
    expect(after.status.petrify).toBe(10 + cost);
    expect(after.extraStamina).toBe(90 - cost);
    if (id === 'scouts-tenacity') expect(after.status).toMatchObject({ injury: 0, poison: 20 });
  });

  it('limits only the bonus bar with Petrify', () => {
    const bar = computeBar({ ...emptyStatus(), petrify: 65, hunger: 10 }, 50, []);
    expect(bar.maxStamina).toBe(90);
    expect(bar.extraStamina).toBe(35);
    expect(bar.petrify).toBe(65);
  });
});

describe('data', () => {
  it('has more than 100 items with unique ids and a source link each', () => {
    expect(ITEMS.length).toBeGreaterThan(100);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) expect(i.sourceUrl).toMatch(/^https:\/\/peak\.wiki\.gg\/wiki\//);
  });

  it('marks items with null numbers as unverified, never guessing', () => {
    for (const i of ITEMS) {
      const nums = [i.weight, i.raw.hunger, i.raw.extraStamina, i.cooked?.hunger, i.cooked?.extraStamina];
      if (nums.some((v) => v === null)) expect(i.verified).toBe(false);
    }
    expect(getItem('pandoras-lunchbox').verified).toBe(false);
  });

  it('applies the gameplay overrides over wiki data', () => {
    const sd = getItem('sports-drink');
    expect(sd.cookResult).toBe('no_change');
    expect(sd.raw.extraStamina).toBe(30);
    expect(sd.cooked?.extraStamina).toBe(30);
    expect(sd.tags.avoidForHeat).toBe(true);
    const af = getItem('airline-food');
    expect(af.raw.hunger).toBe(40);
    expect(af.cooked?.hunger).toBe(80);
    expect(af.tags.alwaysCook).toBe(true);
    expect(getItem('energy-drink').tags.neverCookByDefault).toBe(true);
    expect(getItem('big-lollipop').tags.alwaysCook).toBe(true);
  });

  it('contains no em dashes anywhere in the item data', () => {
    expect(JSON.stringify(ITEMS)).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('computeBar and weight', () => {
  it('heavy inventory raises the Weight status from item weights', () => {
    const inv = [c('ancient-idol'), c('coconut'), c('first-aid-kit')];
    const bar = computeBar(emptyStatus(), 0, inv);
    expect(bar.weight).toBe(40 + 12.5 + 5);
    expect(bar.maxStamina).toBe(100 - 57.5);
    expect(bar.segments.find((s) => s.status === 'weight')?.amount).toBe(57.5);
  });

  it('balloons carry negative weight and the total never goes below 0', () => {
    expect(computeWeight([c('balloon-bunch'), c('bandages')])).toBe(0);
    expect(computeWeight([c('balloon'), c('first-aid-kit'), c('lantern')])).toBe(5);
  });

  it('Ascent 3 adds 2.5 to every item except the Backpack', () => {
    expect(computeWeight([c('bandages'), c('flare')], 3)).toBe(2.5 + 2.5 + 2.5);
    expect(computeWeight([c('backpack')], 3)).toBe(0);
  });

  it('statuses block the bar and stamina is clamped to what is left', () => {
    const bar = computeBar({ ...emptyStatus(), hunger: 20, injury: 15 }, 30, [], { stamina: 90 });
    expect(bar.blocked).toBe(35);
    expect(bar.maxStamina).toBe(65);
    expect(bar.stamina).toBe(65);
    expect(bar.caption).toBe('35% blocked, 65% stamina, +30 extra');
  });

  it('extra stamina is a separate reserve that statuses do not reduce', () => {
    const bar = computeBar({ ...emptyStatus(), injury: 90 }, 30, [], { stamina: 5 });
    expect(bar.maxStamina).toBe(10);
    expect(bar.extraStamina).toBe(30);
  });

  it('a full bar of statuses means passing out', () => {
    const bar = computeBar({ ...emptyStatus(), injury: 60, poison: 50 }, 0, []);
    expect(bar.passedOut).toBe(true);
    expect(bar.maxStamina).toBe(0);
  });
});

describe('cooking stats', () => {
  it('cooking doubles Hunger, Well-Done is the same, Burnt is 5 less', () => {
    expect(effectiveStats(c('granola-bar', 0)).hunger).toBe(15);
    expect(effectiveStats(c('granola-bar', 1)).hunger).toBe(30);
    expect(effectiveStats(c('granola-bar', 2)).hunger).toBe(30);
    expect(effectiveStats(c('granola-bar', 3)).hunger).toBe(25);
  });

  it('incinerated food adds Poison 10', () => {
    expect(effectiveStats(c('trail-mix', 4)).effects.some((e) => e.status === 'poison' && e.amount === 10)).toBe(true);
  });

  it('cooking removes berry poison but not mushroom poison', () => {
    expect(effectiveStats(c('yellow-kingberry', 1)).effects.some((e) => e.status === 'poison')).toBe(false);
    expect(effectiveStats(c('button-shroom-poisonous', 1)).effects.some((e) => e.status === 'poison' && e.amount > 0)).toBe(true);
  });
});

describe('arrangeInventory', () => {
  it('uses a Balloon Bunch in place of the spare Rescue Claw to lighten the reported pack', () => {
    const inventory = [
      c('bandages'), c('first-aid-kit'), c('marshmallow', 1), c('airline-food'),
      c('scouts-tenacity'), c('rescue-claw'), c('rescue-claw'), c('balloon-bunch'),
    ];
    const a = advise(state({ inventory, ascent: 1, status: { hunger: 2.5 } }));
    expect(a.arrangement.bag.map((slot) => slot?.entry.itemId).sort()).toEqual([
      'airline-food', 'balloon-bunch', 'first-aid-kit', 'rescue-claw',
    ]);
    expect(a.arrangement.overflow.map(({ entry }) => entry.itemId)).toEqual(['rescue-claw']);
    expect(a.bar.weight).toBe(5);
    expect(top(a).reason).toContain('22.5 to 5');
  });

  it('keeps both charged Rescue Claws over Energy Drink in the reported solo pack', () => {
    const inventory = [
      c('bandages'), c('first-aid-kit'), c('medicinal-root', 1), c('energy-drink'),
      c('rescue-claw'), c('scouts-tenacity'), c('marshmallow', 1), c('rescue-claw'),
    ];
    const a = advise(state({ inventory, ascent: 1, extraStamina: 75 }));
    expect(a.arrangement.kept.filter((entry) => entry.itemId === 'rescue-claw')).toHaveLength(2);
    expect(a.arrangement.overflow.map(({ entry }) => entry.itemId)).toEqual(['energy-drink']);
    expect(top(a).reason).toMatch(/charged Rescue Claw/);
  });

  it('keeps both Rescue Claws over Chain Launcher in the reported solo pack', () => {
    const inventory = [
      c('bandages'), c('first-aid-kit'), c('medicinal-root', 1), c('chain-launcher'),
      c('rescue-claw'), c('scouts-tenacity'), c('marshmallow', 1), c('rescue-claw'),
    ];
    const a = advise(state({ inventory, ascent: 1 }));
    expect(a.arrangement.kept.filter((entry) => entry.itemId === 'rescue-claw')).toHaveLength(2);
    expect(a.arrangement.overflow.map(({ entry }) => entry.itemId)).toEqual(['chain-launcher']);
  });

  it('keeps cooked Marshmallow over raw Trail Mix in the reported full pack', () => {
    const inventory = [
      c('bandages'), c('first-aid-kit'), c('medicinal-root', 1), c('chain-launcher'),
      c('rescue-claw'), c('scouts-tenacity'), c('marshmallow', 1), c('trail-mix'),
    ];
    const a = advise(state({ inventory, ascent: 1, extraStamina: 25 }));
    expect(a.arrangement.hands[1]?.entry.itemId).toBe('marshmallow');
    expect(a.arrangement.overflow.map(({ entry }) => entry.itemId)).toEqual(['trail-mix']);
  });

  it('puts Tenacity in the open hand slot and keeps both dedicated heals', () => {
    const inventory = [
      c('bandages'), c('first-aid-kit'), c('chain-launcher'),
      c('medicinal-root'), c('rescue-claw'), c('rope-cannon'), c('scouts-tenacity'),
    ];
    const a = arrangeInventory(inventory, 'backpack', emptyStatus());
    expect(a.hands.map((slot) => slot?.entry.itemId)).toEqual(['bandages', 'scouts-tenacity', 'rescue-claw']);
    expect(a.bag.map((slot) => slot?.entry.itemId)).toContain('first-aid-kit');
    expect(a.overflow).toEqual([]);
  });

  it('keeps food in hand and puts an amulet in the emergency slot', () => {
    const inventory = [c('bandages'), c('trail-mix'), c('piton'), c('scouts-initiative')];
    const a = arrangeInventory(inventory, 'backpack', emptyStatus());
    expect(a.hands.map((slot) => slot?.entry.itemId)).toEqual(['bandages', 'trail-mix', 'scouts-initiative']);
    expect(a.bag[0]?.entry.itemId).toBe('piton');
  });

  it.each([false, true])('keeps Big Lollipop over a spare Piton (Energy Drink: %s)', (withDrink) => {
    const inventory = [
      c('piton'), c('first-aid-kit'), c('fortified-milk'), c('chain-launcher'),
      c('medicinal-root'), c('rescue-claw'), c('rope-cannon'), c('big-lollipop'),
    ];
    if (withDrink) inventory.push(c('energy-drink'));
    const a = advise(state({ inventory, ascent: 1 }));
    const kept = a.arrangement.kept.map((entry) => entry.itemId);
    expect(kept).toEqual(expect.arrayContaining(['first-aid-kit', 'fortified-milk', 'chain-launcher', 'big-lollipop']));
    if (withDrink) expect(kept).toContain('energy-drink');
    expect(a.actions).toContainEqual(expect.objectContaining({ action: 'drop', itemId: 'piton' }));
    expect(a.campfire?.cook.map((entry) => entry.itemId)).toContain('big-lollipop');
  });

  it('leaves Rope Spool behind on a solo climb even with open pockets', () => {
    const inventory = [c('rope-spool'), c('rope-cannon'), c('bandages'), c('trail-mix')];
    const a = advise(state({ inventory, atCampfire: true }));
    expect(a.arrangement.hands[2]?.entry.itemId).toBe('rope-cannon');
    expect(a.arrangement.overflow).toEqual([{ entry: inventory[0], reason: expect.stringContaining('solo') }]);
    expect(a.actions).toContainEqual(expect.objectContaining({ action: 'drop', itemId: 'rope-spool' }));
    expect(a.campfire?.dontCook.map((entry) => entry.itemId)).not.toContain('rope-spool');
  });

  it.each([false, true])('keeps Medicinal Root alongside Bandages and First Aid Kit (other food: %s)', (otherFood) => {
    const inventory = [
      c('bandages'), c('medicinal-root'), c('first-aid-kit'),
      c('chain-launcher'), c('rescue-claw'), c('rope-cannon'),
    ];
    if (otherFood) inventory.push(c('trail-mix'));
    const a = advise(state({ inventory, status: { poison: 20 } }));

    expect(a.arrangement.hands[0]?.entry.itemId).toBe('bandages');
    expect(a.arrangement.hands[1]?.entry.itemId).toBe(otherFood ? 'trail-mix' : undefined);
    expect(a.arrangement.bag.map((slot) => slot?.entry.itemId)).toContain('first-aid-kit');
    expect(a.arrangement.overflow).toEqual([]);
    expect(a.actions.find((action) => action.action === 'eat')?.itemId).toBe('medicinal-root');
  });

  it('keeps quick Bandages, one First Aid Kit, food and climbing gear in a crowded pack', () => {
    const inventory = [
      c('first-aid-kit'), c('first-aid-kit'), c('bandages'), c('bandages'),
      c('rope-cannon'), c('chain-launcher'), c('rescue-claw'), c('trail-mix', 1),
    ];
    const a = advise(state({ inventory }));
    expect(a.arrangement.hands.map((slot) => slot?.entry.itemId)).toEqual([
      'bandages', 'trail-mix', 'rescue-claw',
    ]);
    expect(a.arrangement.kept.filter((e) => e.itemId === 'first-aid-kit')).toHaveLength(1);
    expect(a.arrangement.overflow.map((o) => o.entry.itemId).sort()).toEqual(['bandages', 'first-aid-kit']);
    expect(a.actions.filter((x) => x.action === 'drop').map((x) => x.itemId)).not.toContain('trail-mix');
  });

  it('keeps a heal, food and a climbing tool with no bag', () => {
    const inv = [c('first-aid-kit'), c('first-aid-kit'), c('bandages'), c('trail-mix'), c('piton')];
    const a = arrangeInventory(inv, 'none', emptyStatus());
    expect(a.kept.map((e) => e.itemId)).toEqual(['bandages', 'trail-mix', 'piton']);
  });

  it('reserves room for the required Flare at Ascent 4 even without a bag', () => {
    const inv = [c('bandages'), c('trail-mix'), c('piton'), c('flare')];
    const a = arrangeInventory(inv, 'none', emptyStatus(), 4);
    expect(a.kept.map((e) => e.itemId)).toEqual(['bandages', 'trail-mix', 'flare']);
  });

  it('full bag picking up Airline Food pushes the junk item to overflow', () => {
    const inv = [
      c('bandages'), c('granola-bar'), c('piton'), c('sports-drink'),
      c('bing-bong'), c('trail-mix'), c('lantern'), c('airline-food'),
    ];
    const a = arrangeInventory(inv, 'backpack', emptyStatus());
    expect(a.kept).toHaveLength(7);
    expect(a.overflow).toHaveLength(1);
    expect(a.overflow[0].entry.itemId).toBe('bing-bong');
    expect(a.overflow[0].reason).toMatch(/Junk/);
    expect(a.kept.map((e) => e.itemId)).toContain('airline-food');
  });

  it('puts heal in slot 1, next food in slot 2 and a climbing tool in slot 3', () => {
    const inv = [c('trail-mix'), c('piton'), c('bandages'), c('flare')];
    const a = arrangeInventory(inv, 'backpack', { ...emptyStatus(), injury: 20, hunger: 10 });
    expect(a.hands[0]?.entry.itemId).toBe('bandages');
    expect(a.hands[0]?.role).toBe('heal');
    expect(a.hands[1]?.entry.itemId).toBe('trail-mix');
    expect(a.hands[2]?.entry.itemId).toBe('piton');
    expect(a.bag[0]?.entry.itemId).toBe('flare');
  });

  it('uses a stamina boost as the emergency item when there is no climbing tool', () => {
    const a = arrangeInventory([c('sports-drink'), c('bandages')], 'none', emptyStatus());
    expect(a.hands[2]?.entry.itemId).toBe('sports-drink');
    expect(a.hands[2]?.role).toBe('emergency');
  });

  it('a Fanny Pack holds 2 and no bag holds nothing', () => {
    const inv = [c('bandages'), c('trail-mix'), c('piton'), c('flare'), c('compass'), c('bugle')];
    const fanny = arrangeInventory(inv, 'fannypack', emptyStatus());
    expect(fanny.bag).toHaveLength(2);
    expect(fanny.overflow).toHaveLength(1);
    const none = arrangeInventory(inv, 'none' as BagType, emptyStatus());
    expect(none.bag).toHaveLength(0);
    expect(none.overflow).toHaveLength(3);
  });
});

describe('advise', () => {
  it('keeps cooked Marshmallow and eats surplus Granola Bar for bonus stamina', () => {
    const granola = c('granola-bar');
    const s = state({ inventory: [
      c('bandages'), c('first-aid-kit'), c('medicinal-root', 1), c('rescue-claw'),
      c('rescue-claw'), c('scouts-tenacity'), c('marshmallow', 1), granola,
    ], extraStamina: 25, ascent: 1 });
    const a = advise(s);
    expect(a.arrangement.hands[1]?.entry.itemId).toBe('marshmallow');
    expect(top(a)).toMatchObject({ action: 'eat', uid: granola.uid, result: '+20 bonus stamina, 25 to 45' });
    expect(step(s, { type: 'eat-surplus', uid: granola.uid }).extraStamina).toBe(45);
    const full = advise({ ...s, extraStamina: 100 });
    expect(top(full)).toMatchObject({ action: 'drop', uid: granola.uid });
  });

  it('models Tenacity as 60 total relief and avoids a lethal activation', () => {
    const inventory = [c('scouts-tenacity')];
    const a = advise(state({ inventory, status: { injury: 40, poison: 40 } }));
    expect(top(a).result).toContain('Poison 40 to 20');
    expect(top(a).reason).toContain('Adds 20 Petrify');
    const dangerous = advise(state({ inventory, status: { injury: 40, poison: 40, petrify: 80 } }));
    expect(dangerous.actions.some((action) => action.action === 'use')).toBe(false);
  });

  it.each([0, 1] as const)('saves Medicinal Root for status relief at 12.5 Hunger (cook level %s)', (cookLevel) => {
    const a = advise(state({ inventory: [c('medicinal-root', cookLevel), c('first-aid-kit')], status: { hunger: 12.5 }, hardClimb: true }));
    expect(top(a)).toMatchObject({ action: 'keep', itemId: 'medicinal-root' });
    expect(a.actions.some((action) => action.action === 'eat' && action.itemId === 'medicinal-root')).toBe(false);
  });

  it('eats regular food for Hunger and saves Medicinal Root', () => {
    const a = advise(state({ inventory: [c('medicinal-root'), c('trail-mix')], status: { hunger: 12.5 } }));
    expect(top(a)).toMatchObject({ action: 'eat', itemId: 'trail-mix' });
  });

  it('40% Injury with Bandage and First Aid Kit: uses the Bandage and saves the kit', () => {
    const a = advise(state({ inventory: [c('bandages'), c('first-aid-kit')], status: { injury: 40 } }));
    expect(top(a).action).toBe('use');
    expect(top(a).itemId).toBe('bandages');
    expect(top(a).result).toContain('Injury 40 to 10');
    // Bandages (2.5) and First Aid Kit (5) add 7.5 Weight.
    expect(top(a).result).toContain('max stamina 52.5% to 82.5%');
    expect(top(a).reason).toContain('First Aid Kit');
  });

  it('80% Injury: the First Aid Kit is the right call', () => {
    const a = advise(state({ inventory: [c('bandages'), c('first-aid-kit')], status: { injury: 80 } }));
    expect(top(a).itemId).toBe('first-aid-kit');
  });

  it('low stamina, not hungry, Sports Drink and Granola Bar: drinks the Sports Drink', () => {
    const a = advise(state({ inventory: [c('sports-drink'), c('granola-bar')], stamina: 20 }));
    const boost = a.actions.find((x) => x.action === 'use' || x.action === 'eat');
    expect(boost?.itemId).toBe('sports-drink');
    expect(boost?.result).toBe('Sports Drink: +30 extra stamina, 20% to 50%');
    expect(boost?.reason).toContain('Does not spend food');
  });

  it('low stamina and hungry: the Granola Bar does both jobs', () => {
    const a = advise(state({ inventory: [c('granola-bar')], stamina: 20, status: { hunger: 20 } }));
    expect(a.actions.some((x) => x.itemId === 'granola-bar')).toBe(true);
  });

  it('never wastes food on a boost when a stamina-only item exists', () => {
    const a = advise(state({ inventory: [c('honeycomb'), c('sports-drink')], stamina: 10 }));
    const boost = a.actions.find((x) => x.action === 'use' || x.action === 'eat');
    expect(boost?.itemId).toBe('sports-drink');
  });

  it('poisonous Kingberry: warns and does not pick it while safe food exists', () => {
    const a = advise(state({ inventory: [c('yellow-kingberry'), c('trail-mix')], status: { hunger: 30 } }));
    expect(has(a, 'poisonous_raw')).toBe(true);
    expect(a.warnings.find((w) => w.kind === 'poisonous_raw')?.message).toMatch(/Cook it/);
    expect(a.actions.find((x) => x.action === 'eat')?.itemId).toBe('trail-mix');
  });

  it('cooked Energy Drink: warns about the explosion and knockback', () => {
    const a = advise(state({ inventory: [c('energy-drink', 1)] }));
    const w = a.warnings.find((x) => x.kind === 'cooked_explodes');
    expect(w?.message).toMatch(/knocks back/);
    expect(w?.message).toMatch(/flat ground/);
  });

  it('never recommends cooking the Energy Drink at a campfire', () => {
    const a = advise(state({ inventory: [c('energy-drink'), c('big-lollipop')], atCampfire: true }));
    expect(a.campfire?.cook.map((x) => x.itemId)).not.toContain('energy-drink');
    expect(a.campfire?.dontCook.map((x) => x.itemId)).toContain('energy-drink');
    expect(a.actions.some((x) => x.action === 'cook' && x.itemId === 'energy-drink')).toBe(false);
  });

  it('always recommends cooking the Big Lollipop at a campfire', () => {
    const a = advise(state({ inventory: [c('big-lollipop')], atCampfire: true }));
    const cook = a.campfire?.cook.find((x) => x.itemId === 'big-lollipop');
    expect(cook?.why).toMatch(/no Drowsy crash/);
    expect(a.actions.some((x) => x.action === 'cook' && x.itemId === 'big-lollipop')).toBe(true);
  });

  it('Airline Food: cook it at the fire, 40 to 80 Hunger', () => {
    const a = advise(state({ inventory: [c('airline-food')], atCampfire: true }));
    const cook = a.actions.find((x) => x.action === 'cook');
    expect(cook?.itemId).toBe('airline-food');
    expect(cook?.result).toContain('Hunger 40 to 80');
    expect(cook?.reason).toMatch(/Always cook/);
  });

  it('Airline Food away from a fire: eats something else first if possible', () => {
    const a = advise(state({ inventory: [c('airline-food'), c('granola-bar')], status: { hunger: 40 } }));
    expect(a.actions.find((x) => x.action === 'eat')?.itemId).toBe('granola-bar');
  });

  it('plans what to cook at the next campfire after eating now', () => {
    const a = advise(state({
      inventory: [c('airline-food'), c('granola-bar')],
      status: { hunger: 40 },
    }));
    expect(a.actions.find((x) => x.action === 'eat')?.itemId).toBe('granola-bar');
    expect(a.actions.some((x) => x.action === 'cook')).toBe(false);
    expect(a.campfire?.cook.map((x) => x.itemId)).toEqual(['airline-food']);
    expect(a.campfire?.cook[0].why).toContain('Hunger 40 to 80');
  });

  it('Airline Food as the only food, not very hungry: keep it for the campfire', () => {
    const a = advise(state({ inventory: [c('airline-food')], status: { hunger: 20 } }));
    const keep = a.actions.find((x) => x.action === 'keep');
    expect(keep?.itemId).toBe('airline-food');
    expect(keep?.result).toBe('Airline Food: 40 Hunger raw, 80 cooked');
    expect(a.actions.some((x) => x.action === 'eat')).toBe(false);
  });

  it('campfire: lists what not to cook (ropes, explosives, Sports Drink)', () => {
    const a = advise(state({ inventory: [c('rope-cannon'), c('dynamite'), c('sports-drink'), c('trail-mix')], atCampfire: true }));
    const dont = a.campfire?.dontCook.map((x) => x.itemId) ?? [];
    expect(dont).toEqual(expect.arrayContaining(['rope-cannon', 'dynamite', 'sports-drink']));
    expect(a.campfire?.cook.map((x) => x.itemId)).toEqual(['trail-mix']);
  });

  it('campfire: already cooked food is not cooked again', () => {
    const a = advise(state({ inventory: [c('granola-bar', 2)], atCampfire: true }));
    expect(a.campfire?.dontCook[0].why).toMatch(/burns/);
  });

  it('heavy inventory raising Weight: suggests dropping the heavy low-value item', () => {
    const a = advise(state({ inventory: [c('ancient-idol'), c('bandages'), c('trail-mix')] }));
    expect(has(a, 'heavy')).toBe(true);
    const drop = a.actions.find((x) => x.action === 'drop');
    expect(drop?.itemId).toBe('ancient-idol');
    expect(drop?.result).toContain('Weight 45 to 5');
  });

  it('fixes whatever blocks the most stamina first', () => {
    const a = advise(state({
      inventory: [c('antidote'), c('bandages')],
      status: { injury: 10, poison: 35 },
    }));
    expect(top(a).itemId).toBe('antidote');
  });

  it('Heat: uses Fortified Milk before the Sports Drink', () => {
    const a = advise(state({ inventory: [c('sports-drink'), c('fortified-milk')], status: { heat: 40 } }));
    expect(top(a).itemId).toBe('fortified-milk');
  });

  it('Heat with only a Sports Drink: uses it, but says why', () => {
    const a = advise(state({ inventory: [c('sports-drink')], status: { heat: 30 } }));
    const fix = a.actions.find((x) => x.itemId === 'sports-drink');
    expect(fix?.reason).toMatch(/nothing else/);
  });

  it('Cold maps to the Heat Pack', () => {
    const a = advise(state({ inventory: [c('heat-pack'), c('trail-mix')], status: { cold: 40 } }));
    expect(top(a).itemId).toBe('heat-pack');
  });

  it('Drowsy maps to The Early Worm', () => {
    const a = advise(state({ inventory: [c('the-early-worm')], status: { drowsy: 50 } }));
    expect(top(a).itemId).toBe('the-early-worm');
  });

  it('Spores maps to the Antidote over the First Aid Kit when it covers it', () => {
    const a = advise(state({ inventory: [c('antidote'), c('first-aid-kit')], status: { spores: 30 } }));
    expect(top(a).itemId).toBe('antidote');
  });

  it('Curse maps to the Cure-All', () => {
    const a = advise(state({ inventory: [c('cure-all')], status: { curse: 10 } }));
    expect(top(a).itemId).toBe('cure-all');
  });

  it('Poison: never uses a poisonous berry as a cure', () => {
    const a = advise(state({ inventory: [c('medicinal-root'), c('green-kingberry')], status: { poison: 20 } }));
    expect(top(a).itemId).toBe('medicinal-root');
  });

  it('hard climb ahead: picks the Big Lollipop and says it spends little food', () => {
    const a = advise(state({ inventory: [c('big-lollipop', 1), c('trail-mix')], hardClimb: true, status: { hunger: 20 } }));
    const boost = a.actions.find((x) => x.itemId === 'big-lollipop');
    expect(boost?.result).toContain('11 s of infinite stamina');
    expect(boost?.reason).toMatch(/Spends food/);
  });

  it('warns when carrying no heal and no food', () => {
    const a = advise(state({ inventory: [c('rope-spool')] }));
    expect(has(a, 'no_heal')).toBe(true);
    expect(has(a, 'no_food')).toBe(true);
  });

  it('flags junk items using slots', () => {
    const a = advise(state({ inventory: [c('bing-bong'), c('bandages'), c('trail-mix')] }));
    expect(has(a, 'junk')).toBe(true);
    expect(a.actions.some((x) => x.action === 'drop' && x.itemId === 'bing-bong')).toBe(true);
  });

  it('flags burnt food and incinerated tools', () => {
    const a = advise(state({ inventory: [c('granola-bar', 3), c('piton', 1)] }));
    expect(has(a, 'burnt')).toBe(true);
    expect(has(a, 'broken')).toBe(true);
  });

  it('flags cooked explosives that should already be gone', () => {
    const a = advise(state({ inventory: [c('dynamite', 1)] }));
    expect(a.warnings.find((w) => w.kind === 'cooked_explodes')?.message).toMatch(/explodes when cooked/);
  });

  it('hungry with only food that is bigger than the hunger: eats the smallest', () => {
    const a = advise(state({ inventory: [c('napberry'), c('frog-legs'), c('trail-mix')], status: { hunger: 12 } }));
    const eat = a.actions.find((x) => x.action === 'eat');
    expect(eat?.itemId).toBe('trail-mix');
  });

  it('Ascent 4: keeps the Flare', () => {
    const a = advise(state({ inventory: [c('flare')], ascent: 4 }));
    expect(a.actions.some((x) => x.action === 'keep' && x.itemId === 'flare')).toBe(true);
  });

  it('does nothing silly with an empty inventory', () => {
    const a = advise(state({}));
    expect(a.actions).toHaveLength(0);
    expect(has(a, 'no_food')).toBe(true);
  });

  it('every action carries numbers in its result', () => {
    const a = advise(state({
      inventory: [c('bandages'), c('sports-drink'), c('granola-bar'), c('ancient-idol'), c('bing-bong')],
      status: { injury: 30, hunger: 20 },
      stamina: 15,
    }));
    expect(a.actions.length).toBeGreaterThan(2);
    for (const x of a.actions) expect(x.result).toMatch(/\d/);
  });
});
