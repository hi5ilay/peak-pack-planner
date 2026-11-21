import { describe, expect, it } from 'vitest';
import { emptyStatus } from '../engine';
import { comparePacks } from '../engine/comparePacks';
import { toEntry } from './liveInventory';
import { pickupAdvice, type LiveItem, type LiveRun } from './liveInventory';

const food: LiveItem = {uid:'food', name:'Airline Food', slot:'Marked item', cookLevel:0, usesLeft:null};
const run: LiveRun = {
  hands:[null,null,null], pockets:[null,null,null,null], marked:food, bagType:'backpack',
  ascent:1, stamina:100, extraStamina:0, status:emptyStatus(),
};

describe('live placement advice', () => {
  it('keeps the cooked cookies and balloons over the spare berry in the reported loadout', () => {
    const item = (uid: string, name: string, slot: string, cookLevel = 0): LiveItem => ({...food,uid,name,slot,cookLevel});
    const packed = {
      ...run, marked:item('spare','Bandages','Marked item'),
      hands:[item('berry','Purple Kingberry','Hand 1'),item('claw','Rescue Claw','Hand 2'),
        {...item('cookies','Scout Cookies','Hand 3',1),usesLeft:4}],
      pockets:[item('lollipop','Big Lollipop','Pocket 1',1),item('balloons','Balloon Bunch','Pocket 2'),
        item('kit','First Aid Kit','Pocket 3'),item('hotdog','Hot Dog','Pocket 4',1)],
      stamina:85, extraStamina:100, status:{...emptyStatus(),hunger:5,injury:2.5},
    };
    expect(pickupAdvice(packed, 'backpack').swapUid).toBe('berry');
    const duplicate = {...packed, hands:[item('band','Bandages','Hand 1'),...packed.hands.slice(1)]};
    expect(pickupAdvice(duplicate, 'backpack')).toMatchObject({action:'leave',text:expect.stringContaining('already have Bandages')});
  });

  it('leaves a second Energy Drink behind and counts all remaining cookie servings', () => {
    const item = (uid: string, name: string, slot: string): LiveItem => ({...food,uid,name,slot});
    const cookies = {...item('cookies', 'Scout Cookies', 'Hand 2'), usesLeft:4};
    const packed = {
      ...run, marked:item('extra-drink','Energy Drink','Marked item'),
      hands:[item('bandages','Bandages','Hand 1'),cookies,item('claw','Rescue Claw','Hand 3')],
      pockets:[item('kit','First Aid Kit','Pocket 1'),item('chain','Chain Launcher','Pocket 2'),
        {...food, cookLevel:1, slot:'Pocket 3'},item('drink','Energy Drink','Pocket 4')],
      extraStamina:99.6,
    };
    expect(pickupAdvice(packed, 'backpack')).toMatchObject({ action:'leave', text:expect.stringContaining('already have an Energy Drink') });
    const entry = toEntry(cookies)!;
    expect(comparePacks([entry], [], 1).details).toContain('Hunger recovery carried 40 to 0 · Bonus stamina carried 40 to 0');
  });

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
