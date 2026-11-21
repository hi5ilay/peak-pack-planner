import { useMemo, useState } from 'react';
import { fmt, GROUPS, ITEMS } from '../engine';
import type { FoodStats, Item } from '../engine';
import type { Msg } from '../state';
import { ItemIcon } from './ItemIcon';
import styles from './ItemPicker.module.css';

const PICKABLE = ITEMS.filter((i) => !i.hidden);
const STATUS_SHORT: Record<string, string> = {
  injury: 'Injury', poison: 'Poison', cold: 'Cold', heat: 'Heat', drowsy: 'Drowsy',
  spores: 'Spores', curse: 'Curse', thorns: 'Thorns', hunger: 'Hunger',
};

function statsFor(item: Item, cooked: boolean): FoodStats {
  if (item.cookResult === 'cooked_only') return item.cooked ?? item.raw;
  return cooked && item.cooked ? item.cooked : item.raw;
}

function keyNumbers(item: Item, cooked: boolean): string[] {
  const s = statsFor(item, cooked);
  const out: string[] = [];
  if (s.hunger === null) out.push('food ?');
  else if (s.hunger > 0) out.push(`${fmt(s.hunger)} food`);
  if (s.extraStamina === null) out.push('extra ?');
  else if (s.extraStamina > 0) out.push(`+${fmt(s.extraStamina)} extra`);
  for (const e of s.effects.slice(0, 3)) out.push(`${e.amount > 0 ? '+' : '-'}${fmt(Math.abs(e.amount))} ${STATUS_SHORT[e.status]}`);
  if (item.special.infiniteStaminaSeconds) out.push(`${fmt(item.special.infiniteStaminaSeconds)} s infinite`);
  out.push(`${item.weight === null ? '?' : fmt(item.weight)} wt`);
  return out;
}

interface Props {
  send: (m: Msg) => void;
}

export function ItemPicker({ send }: Props) {
  const [query, setQuery] = useState('');
  const [cooked, setCooked] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [over, setOver] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? PICKABLE.filter((i) => i.name.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)) : PICKABLE),
    [q],
  );
  const add = (item: Item) => send({ type: 'add', itemId: item.id, cooked });

  return (
    <section
      className={`${styles.panel} ${over ? styles.over : ''}`}
      aria-label="Item list"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const data = e.dataTransfer.getData('text/plain');
        if (data.startsWith('remove:')) send({ type: 'remove', uid: data.slice(7) });
      }}
    >
      <div className={styles.head}>
        <h2>Items</h2>
        <div className={styles.mode} role="group" aria-label="Show numbers for">
          <button type="button" aria-pressed={!cooked} onClick={() => setCooked(false)}>
            Raw
          </button>
          <button type="button" aria-pressed={cooked} onClick={() => setCooked(true)}>
            Cooked
          </button>
        </div>
      </div>
      <input
        className={styles.search}
        type="search"
        placeholder="Search items, press Enter to add the first match"
        aria-label="Search items"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) {
            add(matches[0]);
            setQuery('');
          }
        }}
      />
      <p className={styles.hint}>
        Tap an item to add it, or drag it onto your pack. Drag a slot back here to remove it.
        {cooked && ' Items that improve with cooking are added cooked.'}
      </p>
      {GROUPS.map((g) => {
        const list = matches.filter((i) => i.group === g);
        if (!list.length) return null;
        const isOpen = q ? true : (open[g] ?? false);
        return (
          <div key={g} className={styles.group}>
            <button
              type="button"
              className={styles.groupHead}
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [g]: !isOpen }))}
            >
              <span className={styles.chev} aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              {g}
              <span className={styles.count}>{list.length}</span>
            </button>
            {isOpen && (
              <div className={styles.grid}>
                {list.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.card}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `add:${item.id}${cooked ? ':cooked' : ''}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => add(item)}
                    title={[item.notes, item.cookNote, `Found: ${item.whereFound}`].filter(Boolean).join('\n')}
                  >
                    <ItemIcon id={item.id} name={item.name} size={36} />
                    <span className={styles.cardBody}>
                      <span className={styles.cardName}>
                        {item.name}
                        {!item.verified && <span className={styles.unverified} title={`Unverified: ${item.unverifiedFields?.join(', ')}`}>unverified</span>}
                        {item.overridden && <span className={styles.override} title="Corrected from real gameplay">gameplay fix</span>}
                      </span>
                      <span className={styles.nums}>{keyNumbers(item, cooked).join(' · ')}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!matches.length && <p className={styles.hint}>No item matches "{query}".</p>}
    </section>
  );
}
