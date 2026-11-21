import { arrangeInventory, keepPriority, type Arrangement } from './arrange';
import { computeBar, type BarResult } from './bar';
import { bestBoost, bestFix, bestFood, canHealInjury, FIXABLE, HUNGRY, isPoisonousNow, totalFreed } from './choose';
import { getItem } from './data';
import {
  canCook,
  COOK_LEVEL_NAMES,
  extraOf,
  fmt,
  hungerFill,
  isBroken,
  isEdible,
  itemWeight,
  removes,
} from './stats';
import type { CarriedItem, GameState, ManualStatus, ManualStatusKey } from './types';

export type ActionType = 'use' | 'eat' | 'cook' | 'drop' | 'keep';

export interface Action {
  action: ActionType;
  itemId: string;
  itemName: string;
  uid?: string;
  reason: string;
  /** Expected result in numbers, for example "Sports Drink: +30 extra stamina, 20% to 50%". */
  result: string;
  priority: number;
}

export type WarningKind =
  | 'poisonous_raw'
  | 'cooked_explodes'
  | 'burnt'
  | 'broken'
  | 'junk'
  | 'no_heal'
  | 'no_food'
  | 'heavy'
  | 'overflow'
  | 'passed_out';

export interface Warning {
  kind: WarningKind;
  message: string;
  itemId?: string;
}

export interface CampfirePlan {
  cook: { uid: string; itemId: string; itemName: string; why: string }[];
  dontCook: { uid: string; itemId: string; itemName: string; why: string }[];
}

export interface Advice {
  actions: Action[];
  warnings: Warning[];
  campfire: CampfirePlan | null;
  bar: BarResult;
  arrangement: Arrangement;
}

const HEAVY_WEIGHT = 20;
const LOW_STAMINA = 30;

const STATUS_LABEL: Record<ManualStatusKey, string> = {
  hunger: 'Hunger',
  injury: 'Injury',
  poison: 'Poison',
  cold: 'Cold',
  heat: 'Heat',
  drowsy: 'Drowsy',
  spores: 'Spores',
  curse: 'Curse',
  thorns: 'Thorns',
};

function name(entry: CarriedItem): string {
  const item = getItem(entry.itemId);
  return entry.cookLevel > 0 && item.cookResult !== 'cooked_only' && item.cookResult !== 'no_change'
    ? `${COOK_LEVEL_NAMES[entry.cookLevel]} ${item.name}`
    : item.name;
}

function verbFor(entry: CarriedItem): ActionType {
  return getItem(entry.itemId).tags.edible ? 'eat' : 'use';
}

/** Apply an entry's effects to a status copy (what the bar looks like after using it). */
function applyUse(entry: CarriedItem, status: ManualStatus): ManualStatus {
  const next = { ...status };
  for (const k of FIXABLE) next[k] = Math.max(0, next[k] - removes(entry, k));
  next.hunger = Math.max(0, next.hunger - hungerFill(entry));
  return next;
}

function sumStatus(s: ManualStatus): number {
  return (Object.keys(s) as ManualStatusKey[]).reduce((a, k) => a + s[k], 0);
}

/**
 * Ranked list of what to do right now.
 * Ranking: whatever blocks the most stamina is fixed first.
 */
export function advise(state: GameState): Advice {
  const arrangement = arrangeInventory(state.inventory, state.bagType, state.status, state.ascent);
  const carried = arrangement.kept;
  const bar = computeBar(state.status, state.extraStamina, carried, { stamina: state.stamina, ascent: state.ascent });
  const actions: Action[] = [];
  const warnings: Warning[] = [];
  const usedUids = new Set<string>();
  let sim: ManualStatus = { ...state.status };
  const weightNow = bar.weight;
  const maxNow = () => Math.max(0, 100 - Math.min(200, sumStatus(sim) + weightNow));

  if (bar.passedOut) {
    warnings.push({ kind: 'passed_out', message: 'Statuses fill the whole bar: you pass out. A teammate has to help, or wait for statuses that decay.' });
  }

  // 1. Status fixes, biggest status first.
  const order = [...FIXABLE].filter((k) => sim[k] > 0).sort((a, b) => sim[b] - sim[a]);
  for (const key of order) {
    if (sim[key] <= 0) continue;
    const pool = carried.filter((e) => !usedUids.has(e.uid));
    const fix = bestFix(pool, key, sim);
    if (!fix) continue;
    const before = { ...sim };
    const maxBefore = maxNow();
    const freed = totalFreed(fix.entry, sim);
    sim = applyUse(fix.entry, sim);
    usedUids.add(fix.entry.uid);
    const item = getItem(fix.entry.itemId);
    const parts = FIXABLE.filter((k) => before[k] !== sim[k]).map(
      (k) => `${STATUS_LABEL[k]} ${fmt(before[k])} to ${fmt(sim[k])}`,
    );
    let reason = `${STATUS_LABEL[key]} blocks ${fmt(before[key])}% of your bar.`;
    const bigger = pool.filter((e) => e.uid !== fix.entry.uid && removes(e, key) > fix.capacity);
    if (bigger.length && fix.covered >= before[key] * 0.75 && fix.covered < before[key]) {
      reason += ` Save ${name(bigger[0])} for a bigger problem.`;
    }
    if (item.tags.avoidForHeat && key === 'heat') reason += ' Only because nothing else you carry removes Heat; it is usually kept for stamina.';
    if (key === 'poison' || key === 'spores' || key === 'heat' || key === 'drowsy' || key === 'cold') {
      reason += ` ${STATUS_LABEL[key]} also fades on its own over time.`;
    }
    const fill = hungerFill(fix.entry);
    if (fill > 0 && before.hunger < fill) reason += ` Wastes ${fmt(fill - before.hunger)} Hunger fill.`;
    actions.push({
      action: verbFor(fix.entry),
      itemId: item.id,
      itemName: name(fix.entry),
      uid: fix.entry.uid,
      reason,
      result: `${name(fix.entry)}: ${parts.join(', ')}, max stamina ${fmt(maxBefore)}% to ${fmt(maxNow())}%`,
      priority: freed,
    });
  }

  // 2. Hunger.
  if (sim.hunger >= HUNGRY) {
    const pool = carried.filter((e) => !usedUids.has(e.uid));
    const food = bestFood(pool, sim.hunger);
    const waitForFire = food && getItem(food.itemId).tags.alwaysCook && food.cookLevel === 0 && hungerFill(food) > sim.hunger;
    if (food && waitForFire) {
      const item = getItem(food.itemId);
      actions.push({
        action: 'keep',
        itemId: item.id,
        itemName: name(food),
        uid: food.uid,
        reason: `It is your only clean food, and eating it raw now would waste ${fmt(hungerFill(food) - sim.hunger)} Hunger fill. Cook it at the next campfire.`,
        result: `${item.name}: ${fmt(hungerFill(food))} Hunger raw, ${fmt(item.cooked?.hunger ?? hungerFill(food))} cooked`,
        priority: 4,
      });
    } else if (food) {
      const item = getItem(food.itemId);
      const fill = hungerFill(food);
      const extra = extraOf(food);
      const maxBefore = maxNow();
      const hBefore = sim.hunger;
      sim = applyUse(food, sim);
      usedUids.add(food.uid);
      let reason = `Hunger blocks ${fmt(hBefore)}% of your bar.`;
      if (fill > hBefore) reason += ` Wastes ${fmt(fill - hBefore)} Hunger fill; nothing smaller is carried.`;
      if (isPoisonousNow(food)) reason += ' It is poisonous raw: only because nothing else is left.';
      if (item.tags.alwaysCook && food.cookLevel === 0) reason += ` Better cooked: ${fmt(fill)} raw, ${fmt(item.cooked?.hunger ?? fill)} cooked.`;
      const extraTxt = extra > 0 ? `, +${fmt(extra)} extra stamina` : '';
      actions.push({
        action: 'eat',
        itemId: item.id,
        itemName: name(food),
        uid: food.uid,
        reason,
        result: `${name(food)}: Hunger ${fmt(hBefore)} to ${fmt(sim.hunger)}${extraTxt}, max stamina ${fmt(maxBefore)}% to ${fmt(maxNow())}%`,
        priority: Math.min(fill, hBefore),
      });
    }
  }

  // 3. Low stamina or a hard climb ahead: best boost.
  const staminaAfter = Math.min(bar.stamina, maxNow());
  if (state.hardClimb || bar.stamina <= LOW_STAMINA) {
    const pool = carried.filter((e) => !usedUids.has(e.uid));
    const boost = bestBoost(pool, sim.hunger, state.hardClimb);
    if (boost) {
      const item = getItem(boost.entry.itemId);
      const why = state.hardClimb ? 'Hard climb ahead.' : `Stamina is low (${fmt(bar.stamina)}%).`;
      const food = boost.fill > 0
        ? ` Spends food: fills ${fmt(boost.fill)} Hunger${boost.waste > 0 ? `, ${fmt(boost.waste)} of it wasted` : ''}.`
        : ' Does not spend food.';
      const bits: string[] = [];
      if (boost.extra > 0) bits.push(`+${fmt(boost.extra)} extra stamina, ${fmt(staminaAfter)}% to ${fmt(staminaAfter + boost.extra)}%`);
      if (boost.infinite > 0) bits.push(`${fmt(boost.infinite)} s of infinite stamina`);
      if (item.special.speedBoostSeconds) bits.push(`${fmt(item.special.speedBoostSeconds)} s of faster climbing`);
      let reason = why + food;
      if (item.id === 'big-lollipop' && boost.entry.cookLevel === 0) reason += ' Raw lollipop gives Drowsy 32.5 afterwards; cook it at the next fire if you can wait.';
      if (item.id === 'energy-drink' && boost.entry.cookLevel === 0) reason += ' Drowsy 25 hits when it wears off.';
      if (item.id === 'energy-drink' && boost.entry.cookLevel > 0) reason += ' Cooked: it explodes and knocks back everyone within 9.6 m. Only drink it on flat ground away from friends.';
      if (bar.maxStamina < 30) reason += ' Extra stamina is a separate reserve, so it still works while statuses block your bar.';
      actions.push({
        action: verbFor(boost.entry),
        itemId: item.id,
        itemName: name(boost.entry),
        uid: boost.entry.uid,
        reason,
        result: `${name(boost.entry)}: ${bits.join(', ')}`,
        priority: (state.hardClimb ? 45 : 40) + Math.min(20, boost.score / 5),
      });
      usedUids.add(boost.entry.uid);
    }
  }

  // 4. Inventory problems.
  for (const o of arrangement.overflow) {
    actions.push({
      action: 'drop',
      itemId: o.entry.itemId,
      itemName: name(o.entry),
      uid: o.entry.uid,
      reason: o.reason,
      result: `${name(o.entry)}: frees your hands, Weight stays ${fmt(bar.weight)}`,
      priority: 8,
    });
    warnings.push({ kind: 'overflow', message: `${name(o.entry)} does not fit. ${o.reason}`, itemId: o.entry.itemId });
  }

  for (const e of carried) {
    const item = getItem(e.itemId);
    const w = itemWeight(item, state.ascent);
    if (e.cookLevel === 0 && item.poisonousRaw) {
      const fixable = item.group === 'Berries' && canCook(item);
      warnings.push({
        kind: 'poisonous_raw',
        itemId: item.id,
        message: fixable
          ? `${item.name} is poisonous raw. Cook it to make it safe.`
          : `${item.name} is poisonous, and cooking does not remove mushroom poison. Only eat it if you are desperate.`,
      });
    }
    if (e.cookLevel > 0 && item.cookResult === 'explodes') {
      warnings.push({
        kind: 'cooked_explodes',
        itemId: item.id,
        message:
          item.id === 'energy-drink'
            ? 'Cooked Energy Drink explodes when you drink it and knocks back everyone within 9.6 m (including you). Fine solo on flat ground, dangerous on a wall or near friends.'
            : `${item.name} explodes when cooked. In the game it would already be gone; remove it.`,
      });
    }
    if (isBroken(e) && item.cookResult === 'burns') {
      warnings.push({ kind: 'broken', itemId: item.id, message: `${item.name} is incinerated and unusable.` });
      actions.push({
        action: 'drop',
        itemId: item.id,
        itemName: name(e),
        uid: e.uid,
        reason: 'Cooking incinerated it: it no longer works but still uses a slot.',
        result: `${name(e)}: frees a slot, Weight ${fmt(bar.weight)} to ${fmt(Math.max(0, bar.weight - w))}`,
        priority: 12,
      });
    }
    if (item.tags.edible && e.cookLevel >= 3) {
      warnings.push({
        kind: 'burnt',
        itemId: item.id,
        message:
          e.cookLevel === 4
            ? `${item.name} is incinerated: 5 less Hunger and +10 Poison when eaten.`
            : `${item.name} is burnt: it restores 5 less Hunger. Cooking it again incinerates it (+10 Poison).`,
      });
    }
    if (item.tags.junk) {
      warnings.push({ kind: 'junk', itemId: item.id, message: `${item.name} is a junk item using a slot${w > 0 ? ` and ${fmt(w)} Weight` : ''}.` });
      actions.push({
        action: 'drop',
        itemId: item.id,
        itemName: name(e),
        uid: e.uid,
        reason: 'No survival use. It takes a slot you could use for food or tools.',
        result: `${name(e)}: frees a slot, Weight ${fmt(bar.weight)} to ${fmt(Math.max(0, bar.weight - w))}`,
        priority: 6 + Math.max(0, w),
      });
    }
  }

  if (!carried.some(canHealInjury)) {
    warnings.push({ kind: 'no_heal', message: 'You carry nothing that heals Injury. Injury never goes away on its own.' });
  }
  if (!carried.some(isEdible)) {
    warnings.push({ kind: 'no_food', message: 'You carry no food. Hunger keeps growing (2.5 every 50 s on Peak).' });
  }

  if (bar.weight >= HEAVY_WEIGHT) {
    const droppedAlready = new Set(actions.filter((a) => a.action === 'drop').map((a) => a.uid));
    const heavy = carried
      .filter((e) => !droppedAlready.has(e.uid) && !usedUids.has(e.uid))
      .map((e) => ({ e, w: itemWeight(getItem(e.itemId), state.ascent), p: keepPriority(e, state.ascent) }))
      // Only suggest dropping things that are really heavy, junk, or broken.
      .filter((x) => x.w >= 10 || (x.w >= 5 && x.p <= 25))
      .sort((a, b) => a.p - a.w - (b.p - b.w));
    warnings.push({ kind: 'heavy', message: `Weight blocks ${fmt(bar.weight)}% of your bar. Every carried item counts.` });
    const top = heavy[0];
    if (top) {
      const item = getItem(top.e.itemId);
      actions.push({
        action: 'drop',
        itemId: item.id,
        itemName: name(top.e),
        uid: top.e.uid,
        reason: `Weight is high and ${item.name} is one of the heaviest things you carry for what it does.`,
        result: `${name(top.e)}: Weight ${fmt(bar.weight)} to ${fmt(Math.max(0, bar.weight - top.w))}, max stamina ${fmt(bar.maxStamina)}% to ${fmt(Math.min(100, bar.maxStamina + Math.min(top.w, bar.weight)))}%`,
        priority: Math.min(top.w, bar.weight),
      });
    }
  }

  if (state.ascent >= 4) {
    const flare = carried.find((e) => e.itemId === 'flare');
    if (flare) {
      actions.push({
        action: 'keep',
        itemId: 'flare',
        itemName: 'Flare',
        uid: flare.uid,
        reason: 'Ascent 4+: there are no Flares at the Peak. Without one you cannot finish.',
        result: 'Flare: weighs 0, keep it all the way up',
        priority: 3,
      });
    }
  }

  // 5. Campfire plan.
  const campfire: CampfirePlan = { cook: [], dontCook: [] };
  const dropUids = new Set(actions.filter((a) => a.action === 'drop').map((a) => a.uid));
  for (const e of carried) {
    if (!state.atCampfire && (usedUids.has(e.uid) || dropUids.has(e.uid))) continue;
    const item = getItem(e.itemId);
    const nm = name(e);
    if (item.cookResult === 'cooked_only') continue;
    if (item.cookResult === 'no_change') {
      if (item.tags.edible || item.id === 'sports-drink') {
        campfire.dontCook.push({ uid: e.uid, itemId: item.id, itemName: nm, why: item.cookNote ?? 'Cooking changes nothing.' });
      }
      continue;
    }
    if (item.cookResult === 'explodes') {
      campfire.dontCook.push({
        uid: e.uid,
        itemId: item.id,
        itemName: nm,
        why: item.id === 'energy-drink' ? (item.cookNote ?? 'Explodes when used.') : 'Explodes or shatters when cooked.',
      });
      continue;
    }
    if (item.cookResult === 'burns') {
      campfire.dontCook.push({ uid: e.uid, itemId: item.id, itemName: nm, why: 'Cooking incinerates it and it stops working.' });
      continue;
    }
    if (e.cookLevel >= 1) {
      campfire.dontCook.push({
        uid: e.uid,
        itemId: item.id,
        itemName: nm,
        why: e.cookLevel >= 2 ? 'Already Well-Done: one more cook burns it (-5 Hunger).' : 'Already cooked: cooking again changes nothing, and a third time burns it.',
      });
      continue;
    }
    const raw = { ...e, cookLevel: 0 as const };
    const cookedE = { ...e, cookLevel: 1 as const };
    const gainH = hungerFill(cookedE) - hungerFill(raw);
    const gainX = extraOf(cookedE) - extraOf(raw);
    const bits: string[] = [];
    if (gainH > 0) bits.push(`Hunger ${fmt(hungerFill(raw))} to ${fmt(hungerFill(cookedE))}`);
    if (gainX > 0) bits.push(`extra stamina ${fmt(extraOf(raw))} to ${fmt(extraOf(cookedE))}`);
    if (item.poisonousRaw && isPoisonousNow(raw) && !isPoisonousNow(cookedE)) bits.push('removes the poison');
    if (item.id === 'big-lollipop') bits.push('no Drowsy crash');
    if (item.id === 'mandrake') bits.push('stops screaming, removes Curse 25');
    if (item.id === 'fortified-milk') bits.push('+10 s invincibility');
    if (!bits.length) continue;
    const why = (item.tags.alwaysCook ? 'Always cook it. ' : '') + bits.join(', ') + '.';
    campfire.cook.push({ uid: e.uid, itemId: item.id, itemName: nm, why });
    if (!state.atCampfire) continue;
    actions.push({
      action: 'cook',
      itemId: item.id,
      itemName: nm,
      uid: e.uid,
      reason: `You are at a campfire. Cook it once (cooking twice is the same, the third time burns).${item.tags.alwaysCook ? ' Always cook this one.' : ''}`,
      result: `${item.name}: ${bits.join(', ')}`,
      priority: 30 + gainH / 2 + gainX / 2 + (item.tags.alwaysCook ? 10 : 0),
    });
  }

  // Cook actions for raw food with an always-cook rule are reordered before eating it.
  actions.sort((a, b) => b.priority - a.priority);
  return {
    actions,
    warnings,
    campfire: state.atCampfire || campfire.cook.length > 0 ? campfire : null,
    bar,
    arrangement,
  };
}
