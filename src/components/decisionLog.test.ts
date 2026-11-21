import { describe, expect, it } from 'vitest';
import { emptyStatus } from '../engine';
import { observeDecision, type PickupAdvice } from './decisionLog';
import type { LiveItem, LiveRun } from './liveInventory';

const root: LiveItem = { uid:'root', name:'Medicinal Root', cookLevel:0, usesLeft:null, slot:'Hand 2' };
const claw: LiveItem = { uid:'claw', name:'Rescue Claw', cookLevel:0, usesLeft:3, slot:'Pocket 1' };
const base: LiveRun = {
  hands:[null,null,null], pockets:[claw], marked:root, bagType:'backpack', ascent:1,
  stamina:90, extraStamina:0, status:emptyStatus(), runId:'run', markId:1000,
};
const advice: PickupAdvice = { action:'leave', text:'Leave it.' };

describe('live decision log', () => {
  it('tracks a temporary pickup, transfer, drop and return without counting the gap', () => {
    let log = observeDecision([], base, 1000, advice);
    log = observeDecision(log, {...base, hands:[root], pockets:[]}, 1500);
    const pocketRoot = {...root, slot:'Pocket 1'};
    log = observeDecision(log, {...base, pockets:[pocketRoot]}, 2500);
    log = observeDecision(log, base, 3000);
    log = observeDecision(log, {...base, hands:[root]}, 5000);
    log = observeDecision(log, {...base, hands:[root]}, 5500);
    expect(log[0].carriedMs).toBe(1500);
    expect(log[0].events.map((event) => event.kind)).toEqual([
      'picked up','other item removed','moved','no longer carried','other item returned','picked up',
    ]);
    expect(log[0].events.find((event) => event.kind === 'no longer carried')?.detail).toBe('Reason unknown');
  });

  it('records actual consumption and charge deltas separately from disappearance', () => {
    let log = observeDecision([], {...base, marked:claw, pockets:[]}, 1000, advice);
    log = observeDecision(log, {...base, marked:claw}, 1500);
    log = observeDecision(log, {...base, marked:claw, pockets:[{...claw, usesLeft:2}]}, 2000);
    log = observeDecision(log, {...base, marked:claw, pockets:[], consumed:[{uid:claw.uid,time:2400}]}, 2500);
    expect(log[0].events.map((event) => event.kind)).toEqual(['picked up','charges used','consumed']);
    expect(log[0].closed).toBe(true);
  });

  it('ends observation on disconnect without labeling the target as dropped', () => {
    let log = observeDecision([], base, 1000, advice);
    log = observeDecision(log, {...base, hands:[root]}, 1500);
    log = observeDecision(log, null, 4000);
    expect(log[0].closed).toBe(true);
    expect(log[0].events.at(-1)?.kind).toBe('tracking interrupted');
  });
});
