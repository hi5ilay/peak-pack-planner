// Shared types for item data, game state and engine output.

export const STATUS_KEYS = [
  'hunger',
  'injury',
  'poison',
  'cold',
  'heat',
  'drowsy',
  'spores',
  'curse',
  'thorns',
  'petrify',
  'weight',
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

/** Statuses the player sets by hand. Weight is always computed from the inventory. */
export const MANUAL_STATUS_KEYS = STATUS_KEYS.filter((k) => k !== 'weight') as Exclude<StatusKey, 'weight'>[];
export type ManualStatusKey = Exclude<StatusKey, 'weight'>;

export type Group =
  | 'Packaged food'
  | 'Natural food'
  | 'Berries'
  | 'Mushrooms'
  | 'Mystical food'
  | 'Stamina boosts'
  | 'Healing'
  | 'Climbing tools'
  | 'Light and utility'
  | 'Mystical and special'
  | 'Fun and collectibles';

export const GROUPS: Group[] = [
  'Packaged food',
  'Natural food',
  'Berries',
  'Mushrooms',
  'Mystical food',
  'Stamina boosts',
  'Healing',
  'Climbing tools',
  'Light and utility',
  'Mystical and special',
  'Fun and collectibles',
];

export type CookResult = 'better' | 'no_change' | 'burns' | 'explodes' | 'cooked_only';

export interface StatusChange {
  status: ManualStatusKey;
  /** Positive adds the status, negative removes it. Points of the 100 point bar. */
  amount: number;
  timing?: 'instant' | 'over_time' | 'after_effect';
  /** Optional detail, for example "after 3 s, over 10 s". */
  detail?: string;
}

export interface FoodStats {
  /** Hunger removed when eaten (positive number). 0 when it does not feed. null when unknown. */
  hunger: number | null;
  /** Bonus (extra) stamina gained. null when unknown. */
  extraStamina: number | null;
  effects: StatusChange[];
}

export interface ItemSpecial {
  infiniteStaminaSeconds?: number;
  invincibilitySeconds?: number;
  speedBoostSeconds?: number;
  /** Removes every status except Curse (Napberry, Blowgun dart). */
  clearsAllStatuses?: boolean;
}

export interface ItemTags {
  /** Never suggest this item for Heat unless nothing else exists. */
  avoidForHeat?: boolean;
  /** Treat as a stamina item even though it is a drink. */
  staminaItem?: boolean;
  /** Always recommend cooking before eating. */
  alwaysCook?: boolean;
  /** Never recommend cooking by default (trade-off shown instead). */
  neverCookByDefault?: boolean;
  /** Can be eaten for food. */
  edible?: boolean;
  /** Item that helps you climb or recover from a fall. */
  climbingTool?: boolean;
  /** Item with no survival use (toys, peels, chess pieces). */
  junk?: boolean;
  /** Required to finish the run on Ascent 4+ (Flare). */
  objective?: boolean;
}

export interface Item {
  id: string;
  name: string;
  /** Wiki "Type" field, for example "Food, Packaged food". */
  category: string;
  group: Group;
  weight: number | null;
  /** Number of uses. null when the wiki does not state it (treated as 1). */
  uses: number | null;
  raw: FoodStats;
  cooked: FoodStats | null;
  cookResult: CookResult;
  poisonousRaw: boolean;
  statusEffects: { adds: StatusChange[]; removes: StatusChange[] };
  special: ItemSpecial;
  tags: ItemTags;
  whereFound: string;
  notes: string;
  /** Short explanation of what cooking does, for the UI. */
  cookNote?: string;
  sourceUrl: string;
  verified: boolean;
  /** Fields that are null or random, listed when verified is false. */
  unverifiedFields?: string[];
  /** Values derived from a sourced general rule instead of the item's own page. */
  derivedFields?: string[];
  /** True when overrides.json changed this item. */
  overridden?: boolean;
  /** Not offered in the picker (bags, wearables, removed or lobby-only items). */
  hidden?: boolean;
  hiddenReason?: string;
}

export type BagType = 'none' | 'backpack' | 'fannypack';

/** 0 raw, 1 cooked, 2 well-done (same as cooked), 3 burnt, 4 incinerated. */
export type CookLevel = 0 | 1 | 2 | 3 | 4;

export interface CarriedItem {
  uid: string;
  itemId: string;
  cookLevel: CookLevel;
  /** Uses left. null when the item has a single use. */
  usesLeft: number | null;
}

export type ManualStatus = Record<ManualStatusKey, number>;

export interface GameState {
  inventory: CarriedItem[];
  bagType: BagType;
  status: ManualStatus;
  /** Current stamina, 0 to 100. Clamped to max stamina. */
  stamina: number;
  extraStamina: number;
  hardClimb: boolean;
  atCampfire: boolean;
  /** -1 Tenderfoot, 0 Peak, 1 to 8 Ascents. */
  ascent: number;
}
