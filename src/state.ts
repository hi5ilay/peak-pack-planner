import { useCallback, useEffect, useReducer } from 'react';
import { canCook, defaultCookLevel, emptyStatus, getItem, ITEM_BY_ID } from './engine';
import type { BagType, CarriedItem, CookLevel, GameState, ManualStatusKey } from './engine';

const STORAGE_KEY = 'peak-pack-planner/v1';
const HISTORY_LIMIT = 50;

export function initialState(): GameState {
  // The app always starts empty: no default items, ever.
  return {
    inventory: [],
    bagType: 'backpack',
    status: emptyStatus(),
    stamina: 100,
    extraStamina: 0,
    hardClimb: false,
    atCampfire: false,
    ascent: 0,
  };
}

export type Msg =
  | { type: 'add'; itemId: string; cooked: boolean }
  | { type: 'remove'; uid: string }
  | { type: 'use'; uid: string }
  | { type: 'cook'; uid: string; delta: 1 | -1 }
  | { type: 'bag'; bagType: BagType }
  | { type: 'status'; key: ManualStatusKey; value: number }
  | { type: 'stamina'; value: number }
  | { type: 'extra'; value: number }
  | { type: 'toggle'; key: 'hardClimb' | 'atCampfire' }
  | { type: 'ascent'; value: number }
  | { type: 'clear' }
  | { type: 'load'; state: GameState }
  | { type: 'undo' };

interface Store {
  current: GameState;
  past: GameState[];
  /** Last slider moved, so a drag counts as one undo step. */
  lastMsg?: string;
}

function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function step(s: GameState, m: Msg): GameState {
  switch (m.type) {
    case 'add': {
      const item = getItem(m.itemId);
      let cookLevel: CookLevel = defaultCookLevel(item);
      if (m.cooked && canCook(item) && item.cookResult === 'better') cookLevel = 1;
      const entry: CarriedItem = { uid: newUid(), itemId: item.id, cookLevel, usesLeft: item.uses };
      return { ...s, inventory: [...s.inventory, entry] };
    }
    case 'remove':
      return { ...s, inventory: s.inventory.filter((e) => e.uid !== m.uid) };
    case 'use':
      return {
        ...s,
        inventory: s.inventory.flatMap((e) => {
          if (e.uid !== m.uid) return [e];
          if (e.usesLeft !== null && e.usesLeft > 1) return [{ ...e, usesLeft: e.usesLeft - 1 }];
          return [];
        }),
      };
    case 'cook':
      return {
        ...s,
        inventory: s.inventory.map((e) =>
          e.uid === m.uid ? { ...e, cookLevel: Math.max(0, Math.min(4, e.cookLevel + m.delta)) as CookLevel } : e,
        ),
      };
    case 'bag':
      return { ...s, bagType: m.bagType };
    case 'status':
      return { ...s, status: { ...s.status, [m.key]: m.value } };
    case 'stamina':
      return { ...s, stamina: m.value };
    case 'extra':
      return { ...s, extraStamina: m.value };
    case 'toggle':
      return { ...s, [m.key]: !s[m.key] };
    case 'ascent':
      return { ...s, ascent: m.value };
    case 'clear':
      return initialState();
    case 'load':
      return m.state;
    case 'undo':
      return s;
  }
}

function reducer(store: Store, m: Msg): Store {
  if (m.type === 'undo') {
    if (!store.past.length) return store;
    return { current: store.past[store.past.length - 1], past: store.past.slice(0, -1) };
  }
  const next = step(store.current, m);
  if (next === store.current) return store;
  // Slider drags would flood the history, so merge consecutive slider moves.
  const sliding = m.type === 'status' || m.type === 'stamina' || m.type === 'extra';
  const last = store.past[store.past.length - 1];
  const key = sliding ? `${m.type}:${'key' in m ? m.key : ''}` : undefined;
  const past = sliding && last && store.lastMsg === key ? store.past : [...store.past, store.current].slice(-HISTORY_LIMIT);
  return { current: next, past, lastMsg: key };
}

function isValidState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const s = x as GameState;
  return Array.isArray(s.inventory) && typeof s.status === 'object' && typeof s.bagType === 'string';
}

export function loadSaved(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return initialState();
    const base = initialState();
    return {
      ...base,
      ...parsed,
      status: { ...base.status, ...parsed.status },
      // Drop anything that no longer exists in the data.
      inventory: parsed.inventory.filter((e) => e && ITEM_BY_ID[e.itemId]),
    };
  } catch {
    return initialState();
  }
}

export function save(s: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage can be blocked (private mode, previews). The app still works without it.
  }
}

export function usePlanner() {
  const [store, dispatch] = useReducer(reducer, undefined, () => ({ current: loadSaved(), past: [] }));
  useEffect(() => save(store.current), [store.current]);
  const canUndo = store.past.length > 0;
  const send = useCallback((m: Msg) => dispatch(m), []);
  return { state: store.current, send, canUndo };
}

export function exampleState(): GameState {
  const mk = (itemId: string, cookLevel: CookLevel = 0): CarriedItem => ({
    uid: newUid(),
    itemId,
    cookLevel,
    usesLeft: getItem(itemId).uses,
  });
  return {
    ...initialState(),
    inventory: [
      mk('bandages'),
      mk('airline-food'),
      mk('rope-spool'),
      mk('sports-drink'),
      mk('energy-drink'),
      mk('yellow-kingberry'),
      mk('big-lollipop'),
      mk('bing-bong'),
    ],
    status: { ...emptyStatus(), hunger: 25, injury: 15, poison: 10 },
    stamina: 35,
    extraStamina: 0,
  };
}
