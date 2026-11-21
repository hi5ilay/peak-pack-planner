import type { Advice } from '../engine';
import styles from './AdviceList.module.css';

const VERB: Record<string, string> = { use: 'Use', eat: 'Eat', cook: 'Cook', drop: 'Drop', keep: 'Keep' };

export function AdviceList({ advice, empty }: { advice: Advice; empty: boolean }) {
  const { actions, warnings, campfire } = advice;
  return (
    <section className={styles.panel} aria-label="Do this now">
      <h2>Do this now</h2>
      {empty && <p className={styles.muted}>Add the items you are carrying and set your bar to get advice.</p>}
      {!empty && actions.length === 0 && <p className={styles.muted}>Nothing urgent. Keep climbing.</p>}
      {actions.length > 0 && (
        <ol className={styles.list}>
          {actions.map((a, i) => (
            <li key={`${a.action}-${a.uid ?? a.itemId}-${i}`} className={`${styles.item} ${i === 0 ? styles.top : ''}`}>
              <div className={styles.row}>
                <span className={`${styles.verb} ${styles[a.action]}`}>{VERB[a.action]}</span>
                <strong>{a.itemName}</strong>
                {i === 0 && <span className={styles.badge}>Top pick</span>}
              </div>
              <div className={styles.result}>{a.result}</div>
              <div className={styles.reason}>{a.reason}</div>
            </li>
          ))}
        </ol>
      )}

      {campfire && (
        <div className={styles.campfire}>
          <h3>At the campfire</h3>
          {campfire.cook.length === 0 && campfire.dontCook.length === 0 && <p className={styles.muted}>Nothing to cook.</p>}
          {campfire.cook.length > 0 && (
            <>
              <h4>Cook these</h4>
              <ul>
                {campfire.cook.map((c) => (
                  <li key={c.itemId + c.itemName}>
                    <strong>{c.itemName}</strong>: {c.why}
                  </li>
                ))}
              </ul>
            </>
          )}
          {campfire.dontCook.length > 0 && (
            <>
              <h4>Do not cook</h4>
              <ul>
                {campfire.dontCook.map((c) => (
                  <li key={c.itemId + c.itemName}>
                    <strong>{c.itemName}</strong>: {c.why}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className={styles.warnings}>
          <h3>Watch out</h3>
          <ul>
            {warnings.map((w, i) => (
              <li key={`${w.kind}-${w.itemId ?? ''}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
