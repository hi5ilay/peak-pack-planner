import type { CSSProperties } from 'react';
import { fmt, MANUAL_STATUS_KEYS, MECHANICS, STATUS_COLORS } from '../engine';
import type { BarResult, GameState, ManualStatusKey, StatusKey } from '../engine';
import type { Msg } from '../state';
import styles from './StaminaBar.module.css';

const LABELS: Record<StatusKey, string> = {
  hunger: 'Hunger',
  injury: 'Injury',
  poison: 'Poison',
  cold: 'Cold',
  heat: 'Heat',
  drowsy: 'Drowsy',
  spores: 'Spores',
  curse: 'Curse',
  thorns: 'Thorns',
  weight: 'Weight',
};

interface Props {
  bar: BarResult;
  state: GameState;
  send: (m: Msg) => void;
}

function Range({ label, value, max = 100, onChange, color }: { label: string; value: number; max?: number; onChange: (v: number) => void; color?: string }) {
  const id = `r-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={styles.range}>
      <label htmlFor={id}>
        {color && <span className={styles.dot} style={{ background: color }} />}
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={2.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={color ? ({ accentColor: color } as CSSProperties) : undefined}
      />
      <output htmlFor={id}>{fmt(value)}</output>
    </div>
  );
}

export function StaminaBar({ bar, state, send }: Props) {
  const ascents = MECHANICS.ascents.list;
  return (
    <section className={styles.panel} aria-label="Your stamina bar">
      <h2>Your stamina bar</h2>
      <div className={styles.barWrap}>
        <div
          className={styles.bar}
          role="img"
          aria-label={`Stamina bar: ${bar.caption}`}
        >
          <div className={styles.room} style={{ width: `${bar.maxStamina}%` }} />
          <div className={styles.stamina} style={{ width: `${bar.stamina}%` }} />
          {bar.segments.map((s) =>
            s.visible > 0 ? (
              <div
                key={s.status}
                className={`${styles.seg} ${s.status === 'weight' ? styles.weightSeg : ''}`}
                style={{ right: `${Math.min(100, s.offset)}%`, width: `${s.visible}%`, background: s.color }}
                title={`${LABELS[s.status]} ${fmt(s.amount)}`}
              >
                {s.visible >= 9 && <span>{LABELS[s.status]}</span>}
              </div>
            ) : null,
          )}
        </div>
        <div className={styles.extraTrack} title="Extra (bonus) stamina is a separate reserve under the main bar">
          <div className={styles.extra} style={{ width: `${Math.min(100, bar.extraStamina)}%` }} />
        </div>
      </div>
      <p className={styles.caption}>{bar.caption}</p>
      {bar.passedOut && <p className={styles.passedOut}>Statuses fill the whole bar: you pass out.</p>}
      <ul className={styles.legend}>
        {bar.segments.map((s) => (
          <li key={s.status}>
            <span className={styles.dot} style={{ background: s.color }} />
            {LABELS[s.status]} {fmt(s.amount)}
          </li>
        ))}
        {bar.extraStamina > 0 && (
          <li>
            <span className={`${styles.dot} ${styles.dotExtra}`} />
            Extra {fmt(bar.extraStamina)}
          </li>
        )}
      </ul>

      <div className={styles.controls}>
        <Range label="Stamina left" value={state.stamina} onChange={(v) => send({ type: 'stamina', value: v })} color="#e3c23a" />
        <Range label="Extra stamina" value={state.extraStamina} onChange={(v) => send({ type: 'extra', value: v })} color="#f0b429" />
        {MANUAL_STATUS_KEYS.map((k: ManualStatusKey) => (
          <Range
            key={k}
            label={LABELS[k]}
            value={state.status[k]}
            color={STATUS_COLORS[k]}
            onChange={(v) => send({ type: 'status', key: k, value: v })}
          />
        ))}
        <div className={styles.range}>
          <span className={styles.fakeLabel}>
            <span className={styles.dot} style={{ background: STATUS_COLORS.weight }} />
            Weight
          </span>
          <span className={styles.computed}>From your items</span>
          <output>{fmt(bar.weight)}</output>
        </div>
      </div>

      <div className={styles.toggles}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={state.hardClimb} onChange={() => send({ type: 'toggle', key: 'hardClimb' })} />
          Hard climb ahead
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={state.atCampfire} onChange={() => send({ type: 'toggle', key: 'atCampfire' })} />
          At a campfire
        </label>
        <label className={styles.ascent}>
          Difficulty
          <select value={state.ascent} onChange={(e) => send({ type: 'ascent', value: Number(e.target.value) })}>
            {ascents.map((a) => (
              <option key={a.level} value={a.level} title={a.effect}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.ascent >= 3 && <p className={styles.small}>Ascent 3+: every item weighs 2.5 more, except the Backpack.</p>}
    </section>
  );
}
