/**
 * Builds src/data/items.json from research/wiki-infobox-snapshot.json.
 *
 * Every number comes from the wiki snapshot or from a fact written on the
 * item's own wiki page (listed in TEXT_FACTS below with the page it came from).
 * Cooked values use the general cooking rule from https://peak.wiki.gg/wiki/Cooking
 * and are listed in `derivedFields`. Unknown values stay null and make the item
 * `verified: false`.
 *
 * Run: npx tsx scripts/build-items.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CookResult,
  FoodStats,
  Group,
  Item,
  ItemSpecial,
  ItemTags,
  ManualStatusKey,
  StatusChange,
} from '../src/engine/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Infobox = Record<string, string>;
const snapshot = JSON.parse(readFileSync(resolve(root, 'research/wiki-infobox-snapshot.json'), 'utf8')) as Record<
  string,
  Infobox
>;
delete snapshot._meta;

const STATUS_FIELDS: Record<string, ManualStatusKey> = {
  Injury: 'injury',
  Poison: 'poison',
  Cold: 'cold',
  Heat: 'heat',
  Drowsy: 'drowsy',
  Spores: 'spores',
  Curse: 'curse',
  Thorns: 'thorns',
};

/** Infobox status values that hit someone else or describe a hazard, not the user. */
const NOT_SELF_EFFECTS = new Set(['Dynamite', 'Scout Cannon', 'Blowgun', 'Cactus']);

const GROUP: Record<string, Group> = {};
const put = (g: Group, names: string[]) => names.forEach((n) => (GROUP[n] = g));
put('Packaged food', ['Airline Food', 'Granola Bar', 'Trail Mix', 'Scout Cookies', 'Fortified Milk']);
put('Stamina boosts', ['Sports Drink', 'Energy Drink', 'Big Lollipop']);
put('Natural food', [
  'Half-Coconut', 'Coconut', 'Honeycomb', 'Beehive', 'Hot Dog', 'Marshmallow', 'Egg', 'Big Egg', 'Small Egg',
  'Cooked Bird', 'Frog Legs', 'Frog', 'Tick', 'Scorpion', 'Mandrake', 'The Early Worm',
]);
put('Berries', [
  'Black Clusterberry', 'Red Clusterberry', 'Yellow Clusterberry', 'Blue Berrynana', 'Brown Berrynana',
  'Pink Berrynana', 'Yellow Berrynana', 'Red Crispberry', 'Yellow Crispberry', 'Green Crispberry',
  'Green Kingberry', 'Purple Kingberry', 'Yellow Kingberry', 'Orange Winterberry', 'Yellow Winterberry',
  'Red Prickleberry', 'Gold Prickleberry', 'Scorchberry', 'Napberry', 'Red Shroomberry', 'Yellow Shroomberry',
  'Green Shroomberry', 'Blue Shroomberry', 'Purple Shroomberry',
]);
put('Mushrooms', ['Bugle Shroom', 'Button Shroom', 'Cluster Shroom', 'Chubby Shroom']);
put('Mystical food', ['Cure-All', "Pandora's Lunchbox"]);
put('Healing', ['Bandages', 'First Aid Kit', 'Antidote', 'Remedy Fungus', 'Medicinal Root', 'Aloe Vera', 'Heat Pack', 'Sunscreen']);
put('Climbing tools', [
  'Rope Spool', 'Rope Cannon', 'Anti-Rope Spool', 'Anti-Rope Cannon', 'Chain Launcher', 'Piton', 'Rescue Claw',
  'Shelf Fungus', 'Cloud Fungus', 'Bounce Fungus', 'Magic Bean', 'Balloon', 'Balloon Bunch', 'Glider', 'Parasol',
  'Scout Cannon', 'Warp Fungus', 'Anti-Zooka', 'Jetpack', 'Rocketpack',
]);
put('Light and utility', [
  'Lantern', 'Torch', 'Candlestick', 'Flare', 'Compass', "Pirate's Compass", 'Binoculars', 'Portable Stove',
  'Guidebook', 'Checkpoint Flag', 'Dynamite', 'Blowgun', 'Backpack', 'Fanny Pack',
]);
put('Mystical and special', [
  'Faerie Lantern', 'Ancient Idol', 'Cursed Skull', 'Scout Effigy', 'The Book of Bones', 'Ritual Dagger',
  'Bugle of Friendship', "Scoutmaster's Bugle", "Scout's Ambition", "Scout's Generosity", "Scout's Initiative",
  "Scout's Tenacity", 'Strange Gem', "Scout's Honor", 'Warp Compass',
]);
put('Fun and collectibles', [
  'Bing Bong', 'Bugle', 'Bugle?', 'Basketball', 'Flying Disc', 'Conch', 'Bishop', 'King', 'Knight', 'Pawn',
  'Queen', 'Rook', 'Passport', 'Blue Berrynana Peel', 'Brown Berrynana Peel', 'Pink Berrynana Peel',
  'Yellow Berrynana Peel', 'Cactus', 'Snowball', 'Scroll',
]);

const CLIMBING_TOOLS = new Set([
  'Rope Spool', 'Rope Cannon', 'Anti-Rope Spool', 'Anti-Rope Cannon', 'Chain Launcher', 'Piton', 'Rescue Claw',
  'Shelf Fungus', 'Cloud Fungus', 'Bounce Fungus', 'Magic Bean', 'Parasol', 'Glider', 'Warp Fungus',
  'Balloon', 'Balloon Bunch', 'Anti-Zooka', 'Scout Cannon',
]);

const HIDDEN: Record<string, string> = {
  Backpack: 'Choose it with the bag selector.',
  'Fanny Pack': 'Choose it with the bag selector.',
  Jetpack: 'Worn in the 4th equipment slot, like a bag.',
  Rocketpack: 'Worn in the 4th equipment slot, like a bag.',
  Passport: 'Airport only, cannot be dropped or taken on the climb.',
  'Bugle?': 'Removed (time-limited event item).',
  'Warp Compass': 'Removed from the game in patch 1.1.a.',
};

const COOKED_ONLY = new Set(['Cooked Bird', 'Frog Legs', 'Scorpion']);

const EXPLODES = new Set([
  'Dynamite', 'Flare', 'Lantern', 'Heat Pack', 'Portable Stove', 'Scout Cannon', 'Cursed Skull', 'Antidote',
  'Cure-All', 'Faerie Lantern', "Pandora's Lunchbox", 'Sunscreen', 'Anti-Zooka', 'Balloon', 'Balloon Bunch',
  'Basketball', 'Energy Drink', "Scout's Honor",
]);
const BURNS = new Set([
  'Rope Spool', 'Rope Cannon', 'Anti-Rope Spool', 'Anti-Rope Cannon', 'Chain Launcher', 'Piton', 'Rescue Claw',
  'Guidebook',
]);

/** Facts read in each item page's article text (not the infobox). */
const TEXT_FACTS: Record<string, { effects?: StatusChange[]; cookedEffects?: StatusChange[]; special?: ItemSpecial; cookedSpecial?: ItemSpecial; note?: string; cookNote?: string; cookedExtra?: number }> = {
  'Energy Drink': {
    effects: [{ status: 'drowsy', amount: -50, timing: 'instant' }],
    special: { speedBoostSeconds: 11 },
    cookedSpecial: { speedBoostSeconds: 15 },
    note: 'Removes Heat 30 and Drowsy 50, then 11 s of +50% run speed and +150% climb speed (8 s once you climb). Drowsy 25 hits when it wears off.',
    cookNote: 'Cooked: explodes when you drink it and knocks back everyone within 9.6 m (no Injury). Boost lasts 15 s and there is no Drowsy crash.',
  },
  'Big Lollipop': {
    effects: [{ status: 'drowsy', amount: 32.5, timing: 'after_effect', detail: 'over 10 s after the effect ends' }],
    special: { infiniteStaminaSeconds: 11 },
    cookedSpecial: { infiniteStaminaSeconds: 11 },
    note: 'Infinite stamina for 11 s (8 s once you start climbing). Drowsy 32.5 over 10 s afterwards.',
    cookNote: 'Cooked: no Drowsy crash afterwards.',
  },
  'Fortified Milk': {
    special: { invincibilitySeconds: 15 },
    cookedSpecial: { invincibilitySeconds: 25 },
    note: 'Invincibility for 15 s: no new statuses except Weight, Curse and Petrify.',
    cookNote: 'Cooked: +10 s of invincibility. No other cooking bonus.',
  },
  Mandrake: {
    cookedEffects: [{ status: 'curse', amount: -25, timing: 'instant' }],
    note: 'Screams when uprooted (Drowsy 5 every quarter second within 16 m). Raw: Numb for 60 s.',
    cookNote: 'Cooked: stops screaming and removes Curse 25.',
  },
  'Medicinal Root': {
    cookNote: 'Cooked: removes an extra Poison 20 and Spores 20.',
  },
  Napberry: {
    special: { clearsAllStatuses: true },
    note: 'Removes every status except Curse and Petrify, then fills the bar with Drowsy and knocks you out for a while.',
  },
  'The Early Worm': { note: 'Removes all Drowsy.' },
  'Scout Effigy': { note: 'Revives a random dead or unconscious scout.', cookNote: 'Cooked: gives Bonus 10 when used.', cookedExtra: 10 },
  'Cursed Skull': { note: 'Kills the user. Everyone else gets Bonus 100 and is cleared of all statuses except Curse. Not in solo.' },
  'Cure-All': { note: '3 uses. Wiki conflict: infobox Thorns -25, list note 35. The app uses 25.' },
  'First Aid Kit': { note: 'Removes all Injury, Poison and Spores.' },
  Bandages: { note: 'Use time 4 s.' },
  'Heat Pack': { note: 'Removes Cold 6 per second for 60 s.' },
  Lantern: { note: 'While lit, scouts within 7.2 m recover Cold 2.5 per second. 60 s of fuel.' },
  'Faerie Lantern': { note: 'While lit, scouts within 7.2 m recover Heat 2.5, Cold 5, Poison 2.5, Drowsy 5, Injury 2.5 per second. 30 s of fuel.' },
  'Remedy Fungus': { note: 'Thrown or dropped: heals Injury 17.5 at once within 8 m, then Injury 35, Poison and Spores over 14 s.' },
  'Sports Drink': { note: 'Removes Heat 200.' },
  Flare: { note: 'Light it at the Peak to call the helicopter. On Ascent 4+ you must bring your own.' },
  Balloon: { note: 'Removes Weight 5 while carried. Lowers gravity by 18% per balloon.' },
  'Balloon Bunch': { note: 'Removes Weight 15 while carried. 3 balloons.' },
  'Ancient Idol': { special: { invincibilitySeconds: undefined }, note: 'Invincibility while held. Weight 40 (was 50 before 1.23.a).' },
  Piton: { note: 'Place it while climbing to get a handhold where stamina regenerates.' },
  'Bugle of Friendship': { special: { infiniteStaminaSeconds: 7.5 }, note: 'Gives nearby scouts infinite stamina while played, 7.5 s total. Not in solo.' },
  "Scout's Ambition": { special: { infiniteStaminaSeconds: 8 }, note: 'Amulet: 8 s infinite stamina bubble. Costs Petrify 30.' },
  "Scoutmaster's Bugle": { note: 'One use: Morale Boost of Bonus 100 for every scout.' },
  "Pandora's Lunchbox": { note: 'Clears all statuses (except Petrify), then gives random amounts of many statuses and bonus stamina. 3 uses.' },
  Blowgun: { note: 'Dart clears a target scout of all statuses except Curse but inflicts Drowsy 120. Not in solo.' },
  Dynamite: { note: 'Explodes 5 s after a scout comes within 8 m. Up to Injury 27.5 within 9.6 m, +25 if held.' },
  Coconut: { note: 'Break it to get 2 Half-Coconuts.' },
  Beehive: { note: 'Break it for 4 Honeycombs. Angry bees deal Poison 3 per second.' },
  'Big Egg': { note: 'Crack it for an Egg (10% chance of a Cooked Bird).' },
  'Small Egg': { note: 'Crack it for an Egg (1% chance of a Cooked Bird).' },
  Frog: { note: 'Cook it to get Frog Legs.' },
  'Frog Legs': { note: 'Only obtainable cooked (cook a Frog).' },
  Scorpion: { note: 'Stings for Poison 2.5 then 50 to 100 over 15 s. Edible once cooked.' },
  Tick: { note: 'Latches on and inflicts up to Poison 50. Edible once removed.' },
  'Cooked Bird': { note: 'Spawns precooked. Cooking again only makes it Well-Done.' },
  Glider: { note: 'Gliding costs 20 stamina per second.' },
  Cactus: { note: 'Sticks to you for Thorns 20 until thrown.' },
  Snowball: { note: 'Hits for Cold 5 to 10.' },
};

const SHROOMBERRY = /Shroomberry$/;
const POISON_SHROOMS = new Set(['Bugle Shroom', 'Button Shroom', 'Cluster Shroom']);

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\?/g, '-question')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function num(v: string | undefined): number | null | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function wikiUrl(name: string): string {
  return 'https://peak.wiki.gg/wiki/' + encodeURIComponent(name.replace(/ /g, '_')).replace(/%2F/g, '/');
}

function whereFound(ib: Infobox): string {
  return [ib.Biome, ib.Location, ib.Source].filter(Boolean).join('; ') || 'Not stated';
}

interface BuildInput {
  name: string;
  ib: Infobox;
  poisonVariant?: boolean;
}

function build({ name, ib, poisonVariant }: BuildInput): Item {
  const baseName = name.replace(' (Poisonous)', '');
  const unverified: string[] = [];
  const derived: string[] = [];
  const isFood = /Food/.test(ib.Type ?? '');
  const facts = TEXT_FACTS[baseName] ?? {};
  const group = GROUP[baseName];
  if (!group) throw new Error('No group for ' + name);

  const weight = num(ib.Weight);
  if (weight === undefined || weight === null) unverified.push('weight');

  // Raw hunger: infobox Hunger is negative when it removes hunger.
  let rawHunger: number | null;
  const h = num(ib.Hunger);
  if (h === null) {
    rawHunger = null;
    unverified.push('raw.hunger');
  } else rawHunger = h === undefined ? 0 : -h;

  let rawExtra: number | null;
  const b = num(ib.Bonus);
  if (b === null) {
    rawExtra = null;
    unverified.push('raw.extraStamina');
  } else rawExtra = b ?? 0;
  if (SHROOMBERRY.test(baseName)) {
    rawExtra = null;
    unverified.push('raw.extraStamina (random 0 to 15)');
  }

  const effects: StatusChange[] = [];
  if (!NOT_SELF_EFFECTS.has(baseName)) {
    for (const [field, key] of Object.entries(STATUS_FIELDS)) {
      const v = num(ib[field]);
      if (v === undefined) continue;
      if (v === null) {
        unverified.push('raw.' + key);
        continue;
      }
      const change: StatusChange = { status: key, amount: v };
      const start = ib[field + '-start'];
      const time = ib[field + '-time'];
      if (start || time) {
        change.timing = 'over_time';
        change.detail = `${start ? `after ${start} s, ` : ''}over ${time ?? '?'} s`;
      } else if (baseName === 'Energy Drink' && key === 'drowsy') {
        change.timing = 'after_effect';
        change.detail = 'when the boost ends';
      } else change.timing = v > 0 && ib[field + '-time'] ? 'over_time' : 'instant';
      effects.push(change);
    }
  }
  if (poisonVariant) {
    effects.push({
      status: 'poison',
      amount: Number(ib.Poisonous_Poison),
      timing: 'over_time',
      detail: `after ${ib['Poisonous_Poison-start']} s, over ${ib['Poisonous_Poison-time']} s`,
    });
  }
  if (facts.effects) effects.push(...facts.effects);

  const poisonousRaw = effects.some((e) => e.status === 'poison' && e.amount > 0);

  // Cook result
  let cookResult: CookResult;
  if (COOKED_ONLY.has(baseName)) cookResult = 'cooked_only';
  else if (EXPLODES.has(baseName)) cookResult = 'explodes';
  else if (BURNS.has(baseName)) cookResult = 'burns';
  else if (isFood && !/^no$/i.test(ib.HasCookingBonus ?? '')) cookResult = 'better';
  else if (baseName === 'Scout Effigy') cookResult = 'better';
  else cookResult = 'no_change';
  if (baseName === 'Energy Drink') cookResult = 'explodes';

  // Cooked stats (general rule from https://peak.wiki.gg/wiki/Cooking)
  let cooked: FoodStats | null = null;
  if (cookResult === 'better' || cookResult === 'cooked_only' || baseName === 'Energy Drink') {
    let cHunger: number | null;
    const hc = num(ib.HungerCooked);
    if (hc !== undefined && hc !== null && hc !== 0) cHunger = -hc;
    else if (hc === 0) cHunger = rawHunger; // "0" on Fortified Milk means no change
    else if (rawHunger === null) cHunger = null;
    else {
      cHunger = rawHunger * 2;
      if (rawHunger > 0) derived.push('cooked.hunger');
    }
    if (baseName === 'Frog Legs' && rawHunger !== null) {
      // Infobox Hunger 50 is the uncooked value; Frog Legs only exist cooked.
      cHunger = rawHunger * 2;
    }

    let cExtra: number | null;
    const bc = num(ib.BonusCooked);
    if (bc !== undefined && bc !== null) cExtra = bc === 0 ? rawExtra : bc;
    else if (facts.cookedExtra !== undefined) cExtra = facts.cookedExtra;
    else if (baseName === 'Cooked Bird') {
      cExtra = null;
      unverified.push('cooked.extraStamina');
    } else if (rawExtra === null) {
      cExtra = null;
      if (!unverified.some((u) => u.startsWith('raw.extraStamina'))) unverified.push('cooked.extraStamina');
    } else if (!isFood) cExtra = rawExtra;
    else {
      cExtra = rawExtra > 0 ? rawExtra * 1.5 : 10;
      derived.push('cooked.extraStamina');
    }
    if (baseName === 'Fortified Milk') cExtra = 0;

    let cEffects = effects.map((e) => ({ ...e }));
    if (group === 'Berries') {
      cEffects = cEffects.filter((e) => !((e.status === 'poison' || e.status === 'thorns') && e.amount > 0));
      cEffects = cEffects.filter((e) => !(e.status === 'spores' && e.amount > 0 && e.amount <= 5));
    }
    if (baseName === 'Medicinal Root') {
      cEffects = cEffects.map((e) => (e.status === 'poison' || e.status === 'spores' ? { ...e, amount: e.amount - 20 } : e));
    }
    if (baseName === 'Big Lollipop' || baseName === 'Energy Drink') {
      cEffects = cEffects.filter((e) => !(e.status === 'drowsy' && e.amount > 0));
    }
    if (facts.cookedEffects) cEffects.push(...facts.cookedEffects);
    if (baseName === 'Scout Effigy') cEffects = [];
    cooked = { hunger: cHunger, extraStamina: cExtra, effects: cEffects };
    if (cookResult === 'cooked_only') {
      // There is no raw form to eat.
      rawHunger = 0;
      rawExtra = 0;
    }
  }

  const raw: FoodStats = { hunger: rawHunger, extraStamina: rawExtra, effects: cookResult === 'cooked_only' ? [] : effects };
  const refEffects = cookResult === 'cooked_only' && cooked ? cooked.effects : effects;

  const special: ItemSpecial = {};
  if (facts.special) Object.assign(special, facts.special);
  if (ib.Infinite && special.infiniteStaminaSeconds === undefined) {
    const m = ib.Infinite.match(/([\d.]+)/);
    if (m) special.infiniteStaminaSeconds = Number(m[1]);
  }
  if (/Clears|Removes all/i.test(ib['Benefit note'] ?? '')) special.clearsAllStatuses = true;
  for (const k of Object.keys(special) as (keyof ItemSpecial)[]) if (special[k] === undefined) delete special[k];

  const tags: ItemTags = {};
  const edibleHunger = Math.max(raw.hunger ?? 0, cooked?.hunger ?? 0);
  if (isFood && edibleHunger > 0) tags.edible = true;
  if (CLIMBING_TOOLS.has(baseName)) tags.climbingTool = true;
  if (group === 'Fun and collectibles') tags.junk = true;
  if (baseName === 'Flare') tags.objective = true;

  let uses: number | null = null;
  const u = num(ib.Uses);
  if (typeof u === 'number') uses = u;

  const notes: string[] = [];
  if (facts.note) notes.push(facts.note);
  if (poisonVariant)
    notes.push('Poisonous look-alike. Cooking does not remove mushroom poison (patch 1.40.a).');
  if (POISON_SHROOMS.has(baseName) && !poisonVariant) notes.push('Has a poisonous look-alike; this is the safe one.');
  if (SHROOMBERRY.test(baseName)) {
    const kind = /Red|Yellow/.test(baseName) ? 'a random good effect' : /Purple/.test(baseName) ? 'a random good or bad effect' : 'a random bad effect';
    notes.push(`Gives ${kind}, Spores 5 and 0 to 15 bonus stamina (random per map).`);
  }
  if (HIDDEN[baseName]) notes.push(HIDDEN[baseName]);

  let cookNote = facts.cookNote ?? ib['Cooking-notes'];
  if (!cookNote) {
    if (cookResult === 'better') cookNote = 'Cooked: Hunger doubled, bonus stamina x1.5 (or +10 if none).';
    if (cookResult === 'no_change') cookNote = 'Cooking has no useful effect.';
  }

  const item: Item = {
    id: slug(name),
    name,
    category: ib.Type ?? 'Not stated',
    group,
    weight: weight ?? null,
    uses,
    raw,
    cooked,
    cookResult,
    poisonousRaw,
    statusEffects: {
      adds: refEffects.filter((e) => e.amount > 0),
      removes: refEffects.filter((e) => e.amount < 0),
    },
    special,
    tags,
    whereFound: whereFound(ib),
    notes: notes.join(' '),
    sourceUrl: wikiUrl(baseName),
    verified: unverified.length === 0,
  };
  if (cookNote) item.cookNote = cookNote;
  if (unverified.length) item.unverifiedFields = unverified;
  if (derived.length) item.derivedFields = derived;
  if (HIDDEN[baseName]) {
    item.hidden = true;
    item.hiddenReason = HIDDEN[baseName];
  }
  return item;
}

const items: Item[] = [];
for (const [name, ib] of Object.entries(snapshot)) {
  items.push(build({ name, ib }));
  if (ib.Poisonous_Poison) items.push(build({ name: `${name} (Poisonous)`, ib, poisonVariant: true }));
}
items.sort((a, b) => a.name.localeCompare(b.name));

const ids = new Set<string>();
for (const it of items) {
  if (ids.has(it.id)) throw new Error('Duplicate id ' + it.id);
  ids.add(it.id);
}

writeFileSync(resolve(root, 'src/data/items.json'), JSON.stringify(items, null, 2) + '\n');
const unverified = items.filter((i) => !i.verified).map((i) => i.name);
console.log(`Wrote ${items.length} items. Verified: ${items.length - unverified.length}. Unverified: ${unverified.join(', ')}`);
