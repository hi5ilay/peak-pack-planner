# PEAK research notes

Everything the app knows about PEAK comes from the PEAK community wiki (https://peak.wiki.gg), read on 2026-11-21, plus a short list of corrections from real gameplay (see `src/data/overrides.json`). Game version at the time of reading: the wiki's latest patch notes go up to 2.4.a.

How the data was collected: the raw wikitext of every page in [Category:Items](https://peak.wiki.gg/wiki/Category:Items) (133 pages) was pulled through the wiki's MediaWiki API (`https://peak.wiki.gg/api.php?action=query&prop=revisions`). The `{{Infobox item}}` fields of each page are saved in [`wiki-infobox-snapshot.json`](./wiki-infobox-snapshot.json). `scripts/build-items.ts` turns that snapshot into `src/data/items.json`. Each item keeps a link to its own wiki page in `sourceUrl`.

## Units

- The stamina bar is 100 points. Every status amount on the wiki is in the same points, so "Hunger 40" means 40% of the bar. Source: https://peak.wiki.gg/wiki/Stamina_bar
- Status amounts (except stamina, bonus stamina and Petrify) come in steps of 2.5, called a "tick". Source: https://peak.wiki.gg/wiki/Stamina_bar
- In infoboxes, a negative number means the item removes that much (Hunger -40 removes 40 Hunger). A positive number means it adds it. An absent field means the item does not touch that stat. Source: each item page, for example https://peak.wiki.gg/wiki/Airline_Food and https://peak.wiki.gg/wiki/Sports_Drink (which writes `Hunger = <!-- n/a -->`).

## Stamina bar

Source for this whole section: https://peak.wiki.gg/wiki/Stamina_bar

- Full bar = 100. Status effects may add up to more than 100 and draw past the end of the bar with a dashed outline. The sum of all statuses is capped at 200.
- Status effects lower the maximum stamina available. If they leave no room for stamina to regenerate, the scout passes out.
- Stamina regenerates at 20 per second once grounded for 0.2 s and either 1 s has passed since you stopped using stamina, or 2 s since you ran out completely (including bonus stamina). Hanging on a Piton also regenerates.
- Costs: sprinting 5 per second, jumping 5, jumping while sprinting 15. On Ascent 6+ all stamina (including bonus) is used 40% faster.

### Bonus (extra) stamina

- The wiki calls it "Bonus stamina". It is a reserve shown as a **separate bar below the main stamina bar**, not inside the main bar.
- It is only used once primary stamina is at 0. It cannot be used for sprinting, and plain jumps do not use it.
- An action that costs more primary stamina than you have does not dip into bonus stamina.
- It does not regenerate. It comes from food, cooking food, Campfire Morale Boosts (+25), Pandora's Lunchbox, Scoutmaster's Bugle (+100) and a few other items.
- No status effect blocks it, except Petrify, which limits the bonus bar instead of the main bar. So bonus stamina is usable even when statuses block most of the main bar.
- Passive drain: the wiki says nothing about bonus stamina draining on its own. It is only described as being spent when primary stamina runs out.
- Maximum: not stated on the article. A user comment on https://peak.wiki.gg/wiki/Talk:Food says it can reach 100 (unconfirmed).
- Patch 1.40.a: bonus stamina resets to 0 when a scout dies.
- Note: the project spec described bonus stamina as filling "the same bar". The wiki says it is a separate bar under the main one. The app draws it as a striped strip directly under the main bar to match the game.

### Statuses (all from https://peak.wiki.gg/wiki/Stamina_bar unless noted)

| Status | How it builds | How it goes away |
|---|---|---|
| Weight | Carrying items (hands, inventory, equipped Backpack) and carrying other scouts | Only by dropping or using items. Does not decay. |
| Hunger | +0.05 per second (2.5 per 50 s). 30% slower on Tenderfoot, 60% faster on Ascent 2+. Eating does not reset the hunger timer | Eating food, Cure-All, Pandora's Lunchbox |
| Injury | Falls (1.5 s or longer, 5 to 100, doubled on Ascent 1+), lava, Dynamite, cooked Flare/Lantern/Stove/Heat Pack, etc. | Never on its own. Bandages, First Aid Kit, Medicinal Root, Yellow Winterberry, Gold Prickleberry, Red Clusterberry, Remedy Fungus, Cure-All, Faerie Lantern, lighting a Campfire (heals 20) |
| Poison | Poisonous or incinerated food, urchins, jellyfish, ticks, scorpions, bees, etc. | Decays 0.4/s after 30 s with no new poison. Medicinal Root, First Aid Kit, Antidote, Remedy Fungus, Cure-All, Faerie Lantern |
| Spores | Shroomberries (+5 each), Roots spore clouds, zombie bites | Decays 0.5/s after 45 s (not while zombie-infected). Medicinal Root, Antidote, First Aid Kit, Faerie Lantern, Cure-All, Remedy Fungus |
| Cold | Alpine blizzards, fog, Ascent 5+ nights (about 100 total), snowballs | Huddling (1.5/s within 3.2 m), Lantern, Faerie Lantern, Heat Pack, Cure-All, campfire, Portable Stove. Cold and Heat cancel each other |
| Heat | Scorchberry, Mesa sun, lava, hot rocks, fire | Decays 1.3/s after 8 s. Sports Drink, Energy Drink, Fortified Milk, Antidote, Faerie Lantern, Cure-All, Winterberries, Prickleberries, Half-Coconut, Aloe Vera |
| Drowsy | Blowgun dart, raw Energy Drink and raw Big Lollipop after their effect ends, Napberry, Mandrake screams, Gloom fog | Decays 1.5/s after 10 s. Energy Drink (removes all on drink), The Early Worm, Cure-All, Faerie Lantern, Pandora's Lunchbox |
| Thorns | Big cacti, Cactus balls, Prickleberries (+10), tumbleweeds. 5 per physical thorn | Pull them off; thorns vanish after 30 s solo / 120 s multiplayer. Cure-All removes 25 |
| Curse | Ancient Statue revives, cannibalism, The Book of Bones, Ascent 7+ start (10) | Never on its own. Cure-All (5), cooked Mandrake (25), Pandora's Lunchbox |

Other bar effects (not modeled as sliders): Petrify (limits bonus stamina), Arrow, Web, Flytrap, Infinite Stamina, Numb, Invincibility.

## Weight

- Weight comes from items in hands, inventory slots and the equipped Backpack. Source: https://peak.wiki.gg/wiki/Stamina_bar#Weight
- Each item's infobox `Weight` is in the same points as the bar. Example: Balloon "passively removes Weight 5", and the Ascent 3 rule says a Cure-All "will weigh 7.5 instead of 5". So **Weight status = sum of carried item weights**. Sources: https://peak.wiki.gg/wiki/Balloon, https://peak.wiki.gg/wiki/Stamina_bar#Weight
- Negative weights exist: Balloon -5, Balloon Bunch -15, Anti-Rope Spool -2.5. They reduce the total while carried (including inside a Backpack).
- Ascent 3 and higher: every item except the Backpack weighs 2.5 more, including negative-weight items. Source: https://peak.wiki.gg/wiki/Ascents
- Weight does not affect movement speed or fall damage. It does not decay. Dropping or consuming an item removes its weight immediately.
- Not stated: whether total weight can go below 0. The app clamps the Weight status at 0.
- Not stated: the Backpack's contents when the Backpack is not worn. The app only models a worn bag.

## Eating when not hungry

- Not stated anywhere on the wiki. The Ascent 2 tips (https://peak.wiki.gg/wiki/Ascents) call eating past your hunger "wasting" food, which suggests the extra Hunger fill is simply lost.
- No page says leftover Hunger fill turns into bonus stamina. The app treats leftover fill as wasted and does not convert it. This is marked unconfirmed in `mechanics.json`.

## Inventory

Sources: https://peak.wiki.gg/wiki/How_to_play, https://peak.wiki.gg/wiki/Backpack, https://peak.wiki.gg/wiki/Fanny_Pack, https://peak.wiki.gg/wiki/Jetpack

- 3 item slots, selected with keys 1, 2, 3. Pressing the key again empties your hands. You cannot climb while holding anything. Picking something up with a full inventory puts it in your hands, but you cannot store it.
- The Backpack goes in a special 4th slot (key 4) and holds 4 more items.
- To use your own backpack: place it on the ground, look at it, hold E. A radial menu with 4 slots appears. Confirmed.
- Teammates can use your backpack while you are wearing it, without you taking it off. Confirmed. The wiki does not name the key or say "from behind"; the app does not claim more than that.
- Fanny Pack: worn in the same 4th equipment slot as the Backpack, holds 2 more items, weight 0. Disabled in solo play since 2.4.a. Because both use the 4th slot, you cannot wear both. (The Jetpack page states the same rule for itself directly.)
- The Jetpack and Rocketpack also take the 4th slot, so wearing one means no bag. The app's bag selector only offers None, Backpack and Fanny Pack.

## Cooking

Source: https://peak.wiki.gg/wiki/Cooking

| Stage | Name | Effect |
|---|---|---|
| 1 | Cooked | Hunger restored is doubled. Bonus stamina x1.5, or +10 if the food gave none. Berries (and Shroomberries) lose their Poison and Thorns, and Spores are reduced by 5 |
| 2 | Well-Done | Identical to Cooked (does not stack) |
| 3 | Burnt | 5 less Hunger restored than the previous stage |
| 4 | Incinerated | Adds 10 Poison each time (max 90). Equipment breaks |

- So cooking once and cooking twice give the same result. Burning starts at the 3rd cook. The project spec assumed "cooking twice burns"; the wiki says the 3rd stage burns.
- Poisonous mushrooms (Bugle, Button, Cluster Shroom) stay poisonous when cooked (patch 1.40.a). Only berries become safe.
- Since 1.40.a, cooked non-food items (like Bandages) no longer give bonus stamina.
- Explode or shatter when cooked: Dynamite, Flare, Lantern, Heat Pack, Portable Stove, Scout Cannon, Cursed Skull, Antidote, Cure-All, Faerie Lantern, Pandora's Lunchbox, Sunscreen, Anti-Zooka, Balloon, Balloon Bunch, Basketball.
- Become incinerated and unusable: Rope Spool, Rope Cannon, Anti-Rope Spool, Anti-Rope Cannon, Chain Launcher, Piton, Rescue Claw, Guidebook.
- No effect (visual only): Backpack, Bandages, First Aid Kit, The Book of Bones, Glider, Jetpack, Candlestick.
- Special: Energy Drink explodes on use and knocks back players within 9.6 m (no Injury), lasts 15 s instead of 11 s, and gives no Drowsy crash (https://peak.wiki.gg/wiki/Energy_Drink). Big Lollipop loses its Drowsy 32.5 crash (https://peak.wiki.gg/wiki/Big_Lollipop). Fortified Milk gets +10 s of invincibility. Mandrake stops screaming and removes 25 Curse. Medicinal Root removes an extra 20 Poison and 20 Spores. Sports Drink gets +15 bonus (45 total) according to the wiki, with no penalty for burning (see overrides).

## Campfire

Source: https://peak.wiki.gg/wiki/Campfire

- Lit when every scout is within 19.2 m. Lighting it gives each nearby scout a Morale Boost of +25 bonus stamina, heals 20 Injury and clears 20 Petrify, and stops hunger while scouts stay nearby.
- Used to cook. A Backpack is always nearby (except at the end of Caldera and Gloom), plus one Marshmallow (62.5%) or Hot Dog (37.5%) per player.
- Cooking a Backpack on a Campfire, Portable Stove or the Crash Site flame does not cook its contents (https://peak.wiki.gg/wiki/Backpack).

## Ascents

Source: https://peak.wiki.gg/wiki/Ascents (cumulative)

- Tenderfoot: climbing uses 30% less stamina, Hunger grows 30% slower.
- Peak: default.
- Ascent 1: fall damage x2.
- Ascent 2: Hunger grows 60% faster.
- Ascent 3: every item weighs +2.5 (except the Backpack). The app models this.
- Ascent 4: no Flares at the Peak.
- Ascent 5: cold nights (about 100 Cold).
- Ascent 6: climbing uses 40% more stamina.
- Ascent 7: start with 10 Curse, +15 per statue revive.
- Ascent 8: free the Scoutmaster's soul (Nadir).

## Shroomberries

Source: https://peak.wiki.gg/wiki/Shroomberries

- Each gives 0 to 15 bonus stamina (random), Spores 5, and removes Hunger 10. Cooking removes the 5 Spores.
- Red and Yellow are always a good effect, Green and Blue always bad, Purple unpredictable. The exact effect is random per map, so the app keeps their bonus stamina as `null` (unverified).

## Patch history that changed numbers

- 1.1.a: Energy Drink buff lengthened, speed and Drowsy reduced (https://peak.wiki.gg/wiki/Energy_Drink).
- 1.7: Rope Spool weight 0 to 1 tick; Anti-Rope items to -1 tick. 1.8: Anti-Rope Cannon weight 0 (https://peak.wiki.gg/wiki/Anti-Rope_Cannon).
- 1.10.a: Trail Mix, Granola Bar, Medicinal Root and Airline Food now get the cooked Hunger bonus (https://peak.wiki.gg/wiki/Airline_Food).
- 1.20.a: Heat decays faster but starts later; Thorns added (https://peak.wiki.gg/wiki/Stamina_bar).
- 1.23.a: Ancient Idol weight 50 to 40 (https://peak.wiki.gg/wiki/Ancient_Idol).
- 1.40.a: cooking overhaul. Cooked poisonous berries are safe; prickleberry thorns cook out; Sports Drink overcooking has no effect; Marshmallow 20 to 15 Hunger; non-food items no longer give bonus stamina when cooked; Spores added (https://peak.wiki.gg/wiki/Cooking, https://peak.wiki.gg/wiki/Marshmallow).
- 2.0.a: Fanny Pack, Jetpack, Rocketpack, Glider, Frog Legs, Ascent 8 added; Cursed Skull gives 100 bonus (https://peak.wiki.gg/wiki/Fanny_Pack, https://peak.wiki.gg/wiki/Cursed_Skull).
- 2.4.a: Fanny Pack disabled in solo play (https://peak.wiki.gg/wiki/Fanny_Pack).

## Conflicts and gaps found

- Cure-All Thorns: infobox says -25, the item list note says 35, and the cooked shatter note says 20. The app uses the infobox value (25).
- Sports Drink cooked: wiki says 45 bonus stamina. Real gameplay says 30 (override wins).
- Marshmallow: was 20 Hunger before 1.40.a, 15 now. The app uses 15.
- Blowgun: wiki says cooking should switch the dart to Heat 150, but notes this is bugged and still gives Drowsy 120.
- Cooked Bird: spawns precooked (80 Hunger). Its bonus stamina is not stated, so it stays `null`.
- Pandora's Lunchbox: all values random ("?" on the wiki), kept as `null`.
- Fanny Pack sources: infobox lists Regular and Explorer's Luggage, the text says all luggage except Clown Luggage.
- Not found anywhere: segment colors of the bar, exact bonus stamina cap, what happens to leftover hunger fill, the key teammates use to open a worn backpack.
