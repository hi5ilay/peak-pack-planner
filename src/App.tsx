import { useMemo, useState } from 'react';
import { advise, computeBar, emptyStatus, type Arrangement, type BagType } from './engine';
import { exampleState, usePlanner } from './state';
import { AdviceList } from './components/AdviceList';
import { DecisionHistory } from './components/DecisionHistory';
import { Footer } from './components/Footer';
import { Inventory } from './components/Inventory';
import { ItemPicker } from './components/ItemPicker';
import { LIVE_URL, pickupAdvice, toEntry, useLiveInventory } from './components/liveInventory';
import { StaminaBar } from './components/StaminaBar';
import styles from './App.module.css';

export default function App() {
  const manual = usePlanner();
  const [live, setLive] = useState(() => new URLSearchParams(window.location.search).has('live'));
  const { run, connection, sampleTime } = useLiveInventory(live);
  const bagType: BagType = run?.bagType === 'backpack' || run?.bagType === 'fannypack' ? run.bagType : 'none';
  const livePack = useMemo<Arrangement>(() => {
    const hands = (run?.hands ?? [null, null, null]).map((item) => {
      const entry = item && toEntry(item);
      return entry ? { entry, role: 'free' as const } : null;
    });
    const bag = (run?.pockets ?? []).map((item) => {
      const entry = item && toEntry(item);
      return entry ? { entry, role: 'bag' as const } : null;
    });
    return { hands, bag, kept: [...hands, ...bag].flatMap((slot) => slot ? [slot.entry] : []), overflow: [] };
  }, [run]);
  const { send, canUndo } = manual;
  const state = useMemo(() => live ? {
    ...manual.state, bagType, inventory: livePack.kept, status: { ...emptyStatus(), ...run?.status },
    stamina: run?.stamina ?? 100, extraStamina: run?.extraStamina ?? 0,
    ascent: run?.ascent ?? 0, atCampfire: false, hardClimb: false,
  } : manual.state, [live, manual.state, bagType, livePack, run]);
  const advice = useMemo(() => advise(state), [state]);
  const bar = live ? computeBar(state.status, state.extraStamina, livePack.kept, state) : advice.bar;
  const empty = state.inventory.length === 0;
  const unknown = run ? [...run.hands, ...run.pockets].filter((item) => item && !toEntry(item)) : [];
  const supportedBag = run?.bagType === bagType;
  const markedAdvice = useMemo(() => run && supportedBag ? pickupAdvice(run, bagType) : undefined, [run, supportedBag, bagType]);
  const toggleLive = () => {
    const url = new URL(window.location.href);
    if (live) url.searchParams.delete('live');
    else url.searchParams.set('live', '');
    window.history.replaceState(null, '', url);
    setLive(!live);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <svg className={styles.logo} viewBox="0 0 64 64" aria-hidden="true">
            <path d="M4 56 26 14l10 18 6-10 18 34z" fill="currentColor" />
            <path d="M26 14l6 11-6-3-5 4z" fill="#fff" />
          </svg>
          <div>
            <h1>PEAK Pack Planner</h1>
            <p className={styles.tag}>What to carry, eat, drop and use right now. Unofficial fan tool.</p>
          </div>
        </div>
        <div className={styles.tools}>
          <button type="button" onClick={toggleLive} aria-pressed={live}>Live inventory</button>
          {!live && <>
          <button type="button" onClick={() => send({ type: 'undo' })} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" onClick={() => send({ type: 'clear' })} disabled={empty && !canUndo}>
            Empty everything
          </button>
          <button type="button" className={styles.example} onClick={() => send({ type: 'load', state: exampleState() })}>
            Load example
          </button>
          </>}
        </div>
      </header>

      <main className={styles.layout}>
        <div className={styles.inv}>
          <Inventory arrangement={live ? livePack : advice.arrangement} actions={advice.actions} bagType={state.bagType} send={send} readOnly={live} />
          {unknown.length > 0 && <p>Unmapped items: {unknown.map((item) => item?.name).join(', ')}</p>}
        </div>
        <div className={styles.side}>
          <fieldset className={styles.readOnly} disabled={live}>
            <StaminaBar bar={bar} state={state} send={send} />
          </fieldset>
          {live && (
            <section className={styles.livePanel} aria-label="Marked item">
              <h2>{run?.marked?.name ?? 'Marked item'}</h2>
              <p role="status">{connection}</p>
              {run ? <p>{markedAdvice?.text ?? 'Swap advice is unavailable for this bag type.'}</p>
                : window.location.hostname !== '127.0.0.1' && <a href={LIVE_URL}>Open the local planner if this browser blocks the connection</a>}
              <DecisionHistory run={run} time={sampleTime} advice={markedAdvice} />
            </section>
          )}
          {(!live || (run && supportedBag && unknown.length === 0)) && (
            <AdviceList advice={advice} empty={empty} atCampfire={state.atCampfire} />
          )}
        </div>
        {!live && <div className={styles.picker}><ItemPicker send={send} /></div>}
      </main>
      <Footer />
    </div>
  );
}
