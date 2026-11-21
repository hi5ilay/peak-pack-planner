import { describe, expect, it } from 'vitest';
import { emptyStatus } from '../engine';
import { pickupAdvice, type LiveItem, type LiveRun } from './liveInventory';

const food: LiveItem = {uid:'food', name:'Airline Food', slot:'Marked item', cookLevel:0, usesLeft:null};
const run: LiveRun = {
  hands:[null,null,null], pockets:[null,null,null,null], marked:food, bagType:'backpack',
  ascent:1, stamina:100, extraStamina:0, status:emptyStatus(),
};

describe('live placement advice', () => {
  it('puts raw Airline Food in a free pocket before the campfire', () => {
    expect(pickupAdvice(run, 'backpack').text).toContain('put it in backpack pocket 1');
    expect(pickupAdvice({...run, hands:[{...food,slot:'Hand 1'},null,null]}, 'backpack').text)
      .toBe('Move it to backpack pocket 1.');
  });

  it('uses a real free hand slot when the recommended hand is occupied', () => {
    const bandages = {...food, uid:'bandages', name:'Bandages', slot:'Hand 1'};
    const flare = {...food, uid:'flare', name:'Flare', slot:'Hand 2'};
    expect(pickupAdvice({...run, marked:bandages, hands:[flare,null,null], pockets:[], bagType:'none'}, 'none').text)
      .toContain('put it in hand slot 2');
  });
});
