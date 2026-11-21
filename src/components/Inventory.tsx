import { useState } from 'react';
import { BAG_NAMES, BAG_SLOTS, getItem } from '../engine';
import type { Action, Arrangement, BagType } from '../engine';
import type { Msg } from '../state';
import { Slot } from './Slot';
import styles from './Inventory.module.css';

interface Props {
  arrangement: Arrangement;
  actions: Action[];
  bagType: BagType;
  send: (m: Msg) => void;
}

const HAND_LABELS = ['Heal', 'Main food', 'Emergency'];

export function Inventory({ arrangement, actions, bagType, send }: Props) {
  const [over, setOver] = useState(false);
  const eat = new Set(actions.filter((action) => action.action === 'eat').map((action) => action.uid));
  return (
    <section
      className={`${styles.panel} ${over ? styles.over : ''}`}
      aria-label="Your inventory"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const data = e.dataTransfer.getData('text/plain');
        const [kind, itemId, mode] = data.split(':');
        if (kind === 'add' && itemId) send({ type: 'add', itemId, cooked: mode === 'cooked' });
      }}
    >
      <div className={styles.head}>
        <h2>Your pack</h2>
        <label className={styles.bagPick}>
          <span>Bag</span>
          <select value={bagType} onChange={(e) => send({ type: 'bag', bagType: e.target.value as BagType })}>
            {(Object.keys(BAG_NAMES) as BagType[]).map((b) => (
              <option key={b} value={b}>
                {BAG_NAMES[b]} ({BAG_SLOTS[b]} slots)
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.hint}>Hands (keys 1, 2, 3). Items sort themselves into roles. Drag items here from the list below, or tap them.</p>
      <div className={styles.hands}>
        {arrangement.hands.map((s, i) => (
          <Slot key={s?.entry.uid ?? `h${i}`} slot={s} label={HAND_LABELS[i]} hotkey={String(i + 1)} big send={send} />
        ))}
      </div>

      <div className={`${styles.bag} ${styles[bagType]}`}>
        {bagType === 'none' ? (
          <div className={styles.noBag}>No bag worn. Pick a Backpack or Fanny Pack above for more room.</div>
        ) : (
          <>
            <div className={styles.strap} aria-hidden="true" />
            <div className={styles.bagBody}>
              <div className={styles.flap}>
                <span>{BAG_NAMES[bagType]}</span>
                <span className={styles.bagKey}>4</span>
              </div>
              <div className={styles.pockets}>
                {arrangement.bag.map((s, i) => (
                  <Slot key={s?.entry.uid ?? `b${i}`} slot={s} label="Empty pocket" send={send} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {bagType === 'backpack' && (
        <p className={styles.note}>
          To open your own Backpack in-game you drop it and hold E. Teammates can use it while you wear it.
        </p>
      )}

      {arrangement.overflow.length > 0 && (
        <div className={styles.overflow} role="status">
          <h3>{arrangement.overflow.some((o) => eat.has(o.entry.uid)) ? 'Outside your pack' : 'Leave behind'}</h3>
          <ul>
            {arrangement.overflow.map((o) => (
              <li key={o.entry.uid}>
                <strong>{getItem(o.entry.itemId).name}</strong>: {eat.has(o.entry.uid) ? 'Eat for bonus stamina before moving on.' : o.reason}{' '}
                {eat.has(o.entry.uid) ? (
                  <button type="button" onClick={() => send({ type: 'eat-surplus', uid: o.entry.uid })}>Mark eaten</button>
                ) : (
                  <button type="button" onClick={() => send({ type: 'remove', uid: o.entry.uid })}>Drop it</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
