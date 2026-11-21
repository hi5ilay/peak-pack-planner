import { useEffect, useState } from 'react';
import { observeDecision, type Decision, type PickupAdvice } from './decisionLog';
import type { LiveRun } from './liveInventory';

const KEY = 'peak-pack-planner/decisions-v1';

function loadLog(): Decision[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function outcome(entry: Decision): string {
  if (!entry.pickedUp) return entry.closed ? 'No pickup observed' : 'Watching for pickup';
  if (entry.events.some((event) => event.kind === 'consumed')) return 'Consumed';
  return entry.lastPack.some((item) => item.uid === entry.target.uid)
    ? entry.closed ? 'Last seen in pack' : 'Carrying'
    : 'No longer carried';
}

function overrideNote(entry: Decision): string | undefined {
  if (!entry.pickedUp) return;
  if (entry.recommendation.action === 'leave') return 'Picked up despite leave advice';
  if (entry.recommendation.action !== 'swap') return;
  const removal = entry.events.find((event) => event.kind === 'other item removed' && event.uid !== entry.recommendation.swapUid);
  if (removal && !entry.events.some((event) => event.kind === 'other item removed' && event.uid === entry.recommendation.swapUid)) {
    return 'Different item moved out: ' + removal.item;
  }
}

export function DecisionHistory({ run, time, advice }: { run: LiveRun | null; time: number; advice?: PickupAdvice }) {
  const [log, setLog] = useState(loadLog);
  useEffect(() => {
    setLog((previous) => observeDecision(previous, run, time, advice));
  }, [run, time, advice]);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* storage unavailable */ }
  }, [log]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'peak-decisions.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <details>
      <summary>Decision log ({log.length})</summary>
      <p>Saved in this browser. Carry time is estimated from live snapshots.</p>
      {log.length > 0 && <button type="button" onClick={download}>Download log</button>}
      <ol>
        {log.slice(-10).reverse().map((entry) => (
          <li key={entry.id}>
            <details>
              <summary>{entry.target.name} · {outcome(entry)} · {Math.floor(entry.carriedMs / 1000)} s carried</summary>
              <p>{entry.recommendation.text}</p>
              {overrideNote(entry) && <p>{overrideNote(entry)}</p>}
              {entry.events.length > 0 && <ul>{entry.events.map((event, index) => (
                <li key={index}>{event.item} · {event.kind}{event.detail && ` · ${event.detail}`}</li>
              ))}</ul>}
            </details>
          </li>
        ))}
      </ol>
    </details>
  );
}
