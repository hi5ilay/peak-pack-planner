# PEAK Pack Planner

An unofficial, open-source fan web app for **PEAK**, the co-op climbing game by Aggro Crab and Landfall Games. It helps you manage your inventory: what to carry, what to eat, what to drop, and what to use right now based on your stamina bar.

![Screenshot of PEAK Pack Planner](docs/screenshot.png)
_Screenshot placeholder: add `docs/screenshot.png`._

## What it does

- **Your pack**: 3 hand slots (keys 1, 2, 3) and a Backpack (4 pockets), Fanny Pack (2) or no bag. Items sort themselves into roles: slot 1 Heal, slot 2 Main food, slot 3 Emergency (a climbing tool, or a stamina boost), and the bag holds the rest. Anything that does not fit is listed with the reason.
- **Your stamina bar**: drawn like the in-game bar, with a colored segment per status and a striped extra stamina reserve under it. Weight is computed from your items, not a slider.
- **Do this now**: a ranked list of actions (use, eat, cook, drop, keep) with the numbers, for example `Sports Drink: +30 extra stamina, 20% to 50%`. It fixes whatever blocks the most stamina first, warns about poisonous raw food, cooked items that explode, burnt food, junk and heavy items, and tells you exactly what to cook (and what not to) at a campfire.
- Item picker with search (Enter adds the first match), groups, a raw/cooked toggle and an "unverified" badge on items whose numbers are not confirmed.
- Drag and drop on desktop, tap on phones. Undo, Empty everything, and Load example. The app always starts empty and saves your state in your browser.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (by default http://localhost:5173/peak-pack-planner/).

Other scripts:

| Command | What it does |
|---|---|
| `npm test` | Runs the engine tests (Vitest) |
| `npm run build` | Type checks and builds the static site into `dist/` |
| `npm run check-icons` | Lists every item id that has no icon file yet |
| `npm run build-items` | Rebuilds `src/data/items.json` from the wiki snapshot in `research/` |

## Add icons

Icons are not included. Put PNG files in `public/icons/`, named after the item id, for example `public/icons/sports-drink.png`. Item ids are in `src/data/items.json`. Run `npm run check-icons` to see which ones are still missing. Until a file exists the app shows a rounded square with the item's initials, so nothing breaks.

Only add icons you have the right to use. Game icons belong to their owners (see Legal).

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` tests, builds and deploys the site on every push to `main`.

1. In the repository on GitHub, go to **Settings, Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

The Vite base path is set from the repository name during the build. To build for another path, set `BASE_PATH`, for example `BASE_PATH=/ npm run build`.

## Where the data comes from

All item numbers come from the [PEAK community wiki (peak.wiki.gg)](https://peak.wiki.gg). `research/NOTES.md` lists what was learned and the source page for each fact. `research/wiki-infobox-snapshot.json` is the raw data copied from each item page, and `scripts/build-items.ts` turns it into `src/data/items.json`.

Rules: numbers are never guessed. If a value was not found on a page, it is `null` and the item is marked `verified: false` (shown with an "unverified" badge). Cooked values that come from the wiki's general cooking rule (Hunger doubled, bonus stamina x1.5 or +10) are listed in each item's `derivedFields`.

`src/data/mechanics.json` holds the game rules (stamina bar, weight, extra stamina, inventory, cooking, campfire, ascents) with a source for each, and marks the ones the wiki does not confirm.

## Overrides

Sometimes the wiki is wrong or out of date. `src/data/overrides.json` holds corrections from real gameplay, and **overrides always win over wiki data**. Items changed by an override show a "gameplay fix" badge.

Current overrides:

- **Sports Drink**: cooking makes no difference, +30 extra stamina raw and cooked. Treated as a stamina item; only suggested for Heat when nothing else can fix it.
- **Energy Drink**: never suggested for cooking. Cooking removes the Drowsy crash and extends the boost, but it explodes when you drink it and knocks back nearby players (fine solo on flat ground, dangerous on a wall or near friends).
- **Big Lollipop**: always cook it (removes the Drowsy crash).
- **Airline Food**: always cook it before eating (40 Hunger raw, 80 cooked).

### Submit a correction

1. Check it in-game, ideally more than once, and note the game version.
2. Open an issue or a pull request that adds an entry to `src/data/overrides.json`, keyed by the item id:

   ```json
   "item-id": {
     "raw": { "hunger": 40, "extraStamina": 0 },
     "cooked": { "hunger": 80 },
     "cookResult": "better",
     "tags": { "alwaysCook": true },
     "cookNote": "Short text shown in the app.",
     "source": "What you tested, on which game version."
   }
   ```

   Only include the fields you are correcting.
3. Run `npm test` before opening the pull request.

## Legal

This is an unofficial project and is not affiliated with, endorsed, or sponsored by Aggro Crab or Landfall Games. All game assets, icons, screenshots, and trademarks are property of Aggro Crab, Landfall Games and/or their licensors.

Game data is credited to the [PEAK community wiki (peak.wiki.gg)](https://peak.wiki.gg) and its contributors.

## License

The code is released under the [MIT license](LICENSE). **The MIT license covers the code only.** Game assets (names, logos, icons, artwork, screenshots and other material from PEAK) are excluded and belong to their owners.

## Live inventory companion

The Windows companion reads your hand slots, the bag you are wearing, and the item highlighted by PEAK. Press **T** over an item to compare it. Press **T** with no item highlighted to clear it. The planner shows which existing item and slot to swap out, when there is room, or when to leave the marked item behind. It never changes your inventory.

Build the BepInEx 5 plugin against your installed PEAK managed assemblies and your Thunderstore profile's BepInEx core, then copy its DLL into that profile:

```powershell
dotnet build companion -c Release "-p:PeakManaged=$managed" "-p:BepInExCore=$bepInEx/core"
Copy-Item companion/bin/Release/netstandard2.1/PeakPackPlanner.dll "$bepInEx/plugins/"
npm ci
npm run build -- --base /
node companion/serve.mjs "$bepInEx/peak-pack-planner.json"
```

Here `$managed` is the path to `PEAK_Data/Managed` and `$bepInEx` is the path to the profile's `BepInEx` directory. Launch PEAK using the profile's **Modded** button and open [the live planner](http://127.0.0.1:47831/?live) on the same PC. The browser tab refreshes while you play. The companion matches English in-game item names against the planner catalog and shows unsupported items by name.
