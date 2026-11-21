import { useMemo } from 'react';
import { advise } from './engine';
import { exampleState, usePlanner } from './state';
import { AdviceList } from './components/AdviceList';
import { Footer } from './components/Footer';
import { Inventory } from './components/Inventory';
import { ItemPicker } from './components/ItemPicker';
import { LiveInventory } from './components/LiveInventory';
import { StaminaBar } from './components/StaminaBar';
import styles from './App.module.css';

export default function App() {
  const live = window.location.hostname === '127.0.0.1' && new URLSearchParams(window.location.search).has('live');
  return live ? <LiveInventory /> : <ManualPlanner />;
}

function ManualPlanner() {
  const { state, send, canUndo } = usePlanner();
  const advice = useMemo(() => advise(state), [state]);
  const empty = state.inventory.length === 0;

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
          <button type="button" onClick={() => send({ type: 'undo' })} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" onClick={() => send({ type: 'clear' })} disabled={empty && !canUndo}>
            Empty everything
          </button>
          <button type="button" className={styles.example} onClick={() => send({ type: 'load', state: exampleState() })}>
            Load example
          </button>
        </div>
      </header>

      <main className={styles.layout}>
        <div className={styles.inv}>
          <Inventory arrangement={advice.arrangement} actions={advice.actions} bagType={state.bagType} send={send} />
        </div>
        <div className={styles.side}>
          <StaminaBar bar={advice.bar} state={state} send={send} />
          <AdviceList advice={advice} empty={empty} atCampfire={state.atCampfire} />
        </div>
        <div className={styles.picker}>
          <ItemPicker send={send} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
