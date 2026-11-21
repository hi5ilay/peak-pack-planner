import { canCook, COOK_LEVEL_NAMES, effectiveStats, fmt, getItem, isBroken, ROLE_LABELS } from '../engine';
import type { ArrangedSlot } from '../engine';
import type { Msg } from '../state';
import { ItemIcon } from './ItemIcon';
import styles from './Slot.module.css';

interface Props {
  slot: ArrangedSlot | null;
  label: string;
  hotkey?: string;
  big?: boolean;
  send: (m: Msg) => void;
}

export function Slot({ slot, label, hotkey, big, send }: Props) {
  if (!slot) {
    return (
      <div className={`${styles.slot} ${styles.empty} ${big ? styles.big : ''}`}>
        {hotkey && <span className={styles.key}>{hotkey}</span>}
        <span className={styles.emptyText}>{label}</span>
      </div>
    );
  }
  const { entry, role } = slot;
  const item = getItem(entry.itemId);
  const stats = effectiveStats(entry);
  const broken = isBroken(entry);
  const bits: string[] = [];
  if (stats.hunger) bits.push(`${fmt(stats.hunger)} food`);
  if (stats.extraStamina) bits.push(`+${fmt(stats.extraStamina)} extra`);
  const cookable = canCook(item);
  return (
    <div
      className={`${styles.slot} ${big ? styles.big : ''} ${broken ? styles.broken : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', `remove:${entry.uid}`);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={`${item.name}. Drag back to the item list to remove.`}
    >
      {hotkey && <span className={styles.key}>{hotkey}</span>}
      <span className={styles.role}>{role === 'bag' ? '' : ROLE_LABELS[role]}</span>
      <ItemIcon id={item.id} name={item.name} size={big ? 52 : 36} />
      <span className={styles.name}>{item.name}</span>
      <span className={styles.meta}>
        {entry.cookLevel > 0 && item.cookResult !== 'cooked_only' && item.cookResult !== 'no_change' && (
          <span className={entry.cookLevel >= 3 ? styles.burnt : styles.cooked}>{COOK_LEVEL_NAMES[entry.cookLevel]}</span>
        )}
        {broken && <span className={styles.burnt}>Unusable</span>}
        {bits.join(', ')}
        {entry.usesLeft !== null && entry.usesLeft > 1 && ` (${entry.usesLeft} uses)`}
      </span>
      <span className={styles.buttons}>
        {cookable && (
          <>
            <button type="button" onClick={() => send({ type: 'cook', uid: entry.uid, delta: 1 })} disabled={entry.cookLevel >= 4} aria-label={`Cook ${item.name}`}>
              Cook
            </button>
            {entry.cookLevel > 0 && (
              <button type="button" onClick={() => send({ type: 'cook', uid: entry.uid, delta: -1 })} aria-label={`Uncook ${item.name}`}>
                Uncook
              </button>
            )}
          </>
        )}
        <button type="button" onClick={() => send({ type: 'use', uid: entry.uid })} aria-label={`Mark ${item.name} as used`}>
          Used
        </button>
        <button type="button" className={styles.drop} onClick={() => send({ type: 'remove', uid: entry.uid })} aria-label={`Drop ${item.name}`}>
          Drop
        </button>
      </span>
    </div>
  );
}
