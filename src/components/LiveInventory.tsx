import { useEffect, useState } from 'react';
import { arrangeInventory, defaultCookLevel, emptyStatus, getItem, ITEMS, type BagType, type CarriedItem, type CookLevel, type ManualStatus } from '../engine';
import styles from './LiveInventory.module.css';

interface LiveItem {
  uid: string;
  name: string;
  slot: string;
  cookLevel: number;
  usesLeft: number | null;
}

interface LiveRun {
  hands: (LiveItem | null)[];
  pockets: (LiveItem | null)[];
  marked: LiveItem | null;
  bagType: string;
  ascent: number;
  status: ManualStatus;
}

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const catalog = new Map(ITEMS.map((item) => [normalize(item.name), item]));

function toEntry(item: LiveItem): CarriedItem | null {
  const match = catalog.get(normalize(item.name));
  if (!match) return null;
  const cookLevel = (Math.max(defaultCookLevel(match), Math.min(4, item.cookLevel))) as CookLevel;
  return { uid: item.uid, itemId: match.id, cookLevel, usesLeft: item.usesLeft };
}

function recommendation(run: LiveRun, bagType: BagType): string {
  const marked = run.marked;
  if (!marked) return 'Look at a highlighted item in PEAK and press T.';
  const carried = [...run.hands, ...run.pockets].filter((item): item is LiveItem => item !== null);
  if (carried.some((item) => item.uid === marked.uid)) return 'You already picked this up.';
  const candidate = toEntry(marked);
  if (!candidate) return 'This item has no matching entry in the planner catalog.';
  const entries = carried.map(toEntry);
  if (entries.some((item) => item === null)) return 'A carried item is unknown. Swap advice is paused until the whole pack can be evaluated.';
  const known = entries.filter((item): item is CarriedItem => item !== null);
  const status = { ...emptyStatus(), ...run.status };
  const before = arrangeInventory(known, bagType, status, run.ascent);
  const after = arrangeInventory([...known, candidate], bagType, status, run.ascent);
  const rejected = after.overflow.find(({ entry }) => entry.uid === candidate.uid);
  if (rejected) return 'Leave it. ' + rejected.reason;
  const priorOverflow = new Set(before.overflow.map(({ entry }) => entry.uid));
  const displaced = after.overflow.find(({ entry }) => !priorOverflow.has(entry.uid));
  const slots = run.hands.length + (bagType === 'backpack' ? 4 : bagType === 'fannypack' ? 2 : 0);
  const swap = displaced ?? (carried.length >= slots ? after.overflow[0] : undefined);
  if (!swap) return 'Pick it up. You have room.';
  const item = carried.find((entry) => entry.uid === swap.entry.uid);
  return 'Swap out ' + getItem(swap.entry.itemId).name + (item ? ' (' + item.slot + ')' : '') + '. ' + swap.reason;
}

export function LiveInventory() {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [connection, setConnection] = useState('Waiting for the PEAK mod');
  useEffect(() => {
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const response = await fetch('/snapshot', {signal: controller.signal, cache:'no-store'});
        if (!response.ok) throw new Error('Waiting');
        const data = await response.json();
        if (data.version !== 1 || Date.now() - data.time > 3000) throw new Error('Stale');
        setRun(data.run);
        setConnection(data.run ? 'Connected to PEAK' : 'Connected · Start a climb');
      } catch {
        if (controller.signal.aborted) return;
        setRun(null);
        setConnection('Waiting for the PEAK mod');
      }
      timer = window.setTimeout(poll, 500);
    }
    void poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  const bag = run?.bagType;
  const knownBag = bag === 'backpack' || bag === 'fannypack' || bag === 'none' ? bag : undefined;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>PEAK Live Pack</h1>
        <a href="/">Manual planner</a>
      </header>
      <p role="status">{connection}</p>
      {run && (
        <>
          <section className={styles.panel} aria-label="Marked item">
            <h2>{run.marked?.name ?? 'Marked item'}</h2>
            <p>{knownBag ? recommendation(run, knownBag) : 'Swap advice is unavailable for this bag type.'}</p>
          </section>
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2>Hands</h2>
              <ol>{run.hands.map((item, index) => <li key={index}>{item?.name ?? 'Empty'}</li>)}</ol>
            </section>
            <section className={styles.panel}>
              <h2>{bag === 'none' ? 'No bag equipped' : bag === 'fannypack' ? 'Fanny Pack' : 'Equipped ' + bag}</h2>
              <ol>{run.pockets.map((item, index) => <li key={index}>{item?.name ?? 'Empty'}</li>)}</ol>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
