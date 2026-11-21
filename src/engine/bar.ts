import { STATUS_COLORS } from './data';
import { computeWeight, fmt } from './stats';
import { MANUAL_STATUS_KEYS, type CarriedItem, type ManualStatus, type StatusKey } from './types';

export interface BarSegment {
  status: StatusKey;
  amount: number;
  /** Where the segment starts, counted from the right end of the 100 point bar. */
  offset: number;
  /** Part of the segment that fits inside the bar. */
  visible: number;
  color: string;
}

export interface BarResult {
  segments: BarSegment[];
  /** Total of all statuses (can pass 100, capped at 200). */
  blocked: number;
  /** Room left for stamina: 100 minus statuses, never below 0. */
  maxStamina: number;
  /** Current stamina, clamped to max stamina. */
  stamina: number;
  /** Bonus stamina in its own reserve bar. */
  extraStamina: number;
  weight: number;
  passedOut: boolean;
  caption: string;
}

export interface BarOptions {
  /** Current stamina before clamping. Defaults to max stamina. */
  stamina?: number;
  ascent?: number;
}

const BAR = 100;
const STATUS_CAP = 200;

/**
 * Builds the stamina bar.
 * Rules from https://peak.wiki.gg/wiki/Stamina_bar: statuses fill the bar from
 * the right and lower max stamina; Weight comes from the inventory; bonus
 * stamina is a separate reserve that statuses do not block.
 */
export function computeBar(
  status: ManualStatus,
  extraStamina: number,
  inventory: CarriedItem[],
  options: BarOptions = {},
): BarResult {
  const weight = computeWeight(inventory, options.ascent ?? 0);
  const amounts: [StatusKey, number][] = [
    ...MANUAL_STATUS_KEYS.map((k) => [k, Math.max(0, status[k] ?? 0)] as [StatusKey, number]),
    ['weight', weight],
  ];
  const segments: BarSegment[] = [];
  let offset = 0;
  for (const [key, amount] of amounts) {
    if (amount <= 0) continue;
    const visible = Math.max(0, Math.min(amount, BAR - offset));
    segments.push({ status: key, amount, offset, visible, color: STATUS_COLORS[key] ?? '#888' });
    offset += amount;
  }
  const blocked = Math.min(STATUS_CAP, offset);
  const maxStamina = Math.max(0, BAR - blocked);
  const requested = options.stamina ?? maxStamina;
  const stamina = Math.max(0, Math.min(requested, maxStamina));
  const extra = Math.max(0, extraStamina);
  const parts = [`${fmt(Math.min(blocked, BAR))}% blocked`, `${fmt(stamina)}% stamina`];
  if (extra > 0) parts.push(`+${fmt(extra)} extra`);
  if (blocked > BAR) parts.push(`${fmt(blocked - BAR)}% of statuses past the end of the bar`);
  return {
    segments,
    blocked,
    maxStamina,
    stamina,
    extraStamina: extra,
    weight,
    passedOut: maxStamina <= 0,
    caption: parts.join(', '),
  };
}
