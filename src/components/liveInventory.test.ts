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

  it('shows the intended hand order when the heal slot is occupied', () => {
    const bandages = {...food, uid:'bandages', name:'Bandages', slot:'Hand 1'};
    const flare = {...food, uid:'flare', name:'Flare', slot:'Hand 2'};
    expect(pickupAdvice({...run, marked:bandages, hands:[flare,null,null], pockets:[], bagType:'none'}, 'none').text)
      .toContain('1: Bandages · 2: Flare');
  });

  it('frees slot 2 for the pickup and then recommends the correct final order', () => {
    const bandages = {...food, uid:'bandages', name:'Bandages', slot:'Hand 3'};
    const kit = {...food, uid:'kit', name:'First Aid Kit', slot:'Hand 2'};
    const launcher = {...food, uid:'launcher', name:'Chain Launcher'};
    const hands = [{...food, slot:'Hand 1', cookLevel:1}, kit, bandages];
    const packed = {...run, marked:launcher, hands, pockets:[], bagType:'none'};
    const advice = pickupAdvice(packed, 'none');
    expect(advice.swapUid).toBe('kit');
    expect(advice.text).toContain('First Aid Kit (Hand 2)');
    expect(advice.text).toContain('1: Bandages · 2: Airline Food · 3: Chain Launcher');
    expect(pickupAdvice({...packed, hands:[hands[0], {...launcher, slot:'Hand 2'}, bandages]}, 'none').text)
      .toContain('1: Bandages · 2: Airline Food · 3: Chain Launcher');
  });
});
