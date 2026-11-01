# FaerieCharm

A co-op maze game for kids 7–11, built for our UX Design for Kids class. Two friends each solve their own half of the Thorn Maze, find half of a key, and meet at the door. The design focus is **communicate**: players send each other **Scrolls** (preset messages, emojis, and gifts like a Peek, gems, or a lent Dash charm) while they play.

**Play it:** https://marzynthecomets.github.io/faeriecharm/ (works once GitHub Pages is turned on; open it on a phone)

## What's in this version

The whole experience, start to finish:

**Load → Forest map → Level → (Pick a friend) → Maze → Level complete → Bramble's Charm Stall → Bracelet**

- **Forest map:** three levels along a path. Finishing one unlocks the next. The floating cloud is Bramble's Charm Stall; the bracelet in the header opens your bracelet; the gear opens Settings.
- **Solo or Duo:** the play button starts solo. "Play with Friend?" opens the friend picker, and only **Anjalie** can play right now. She's **scripted**: she sends scrolls, gets stuck partway through, replies to whatever you send, and finds her half of the key. Real two-phone play is the next step after playtesting.
- **In the maze:** drag anywhere to move (arrow keys / WASD on a laptop). A quick push moves one space. Fog hides most of the maze and footprints fade behind you. Tap a charm on the bracelet to use it: **Peek** (see more), **Dash** (zip two spaces), **Thorn Snip** (cut the wall you're facing), **Glow** (bigger light for 10 seconds).
- **Send a Scroll (duo):** preset messages, emojis, and gifts: a Peek, gems (up to 5), or a boost charm lent for the level.
- **Stall:** spend gems on Boost charms (Dash 5, Thorn Snip 10, Glow 15) and Style charms (3–4). The Friendship charm can't be bought; you earn it by finishing a level with a friend.
- **Bracelet:** 5 boost slots and 5 style slots. Tap a charm to put it on or take it off. Only boost charms on the bracelet come into the maze.
- **Progress saves on the phone** (gems, charms, finished levels). Settings → Reset my progress wipes it, which is handy between testers.

### Running a playtest

- Reset progress between testers (gear icon on the map → Reset my progress).
- **Hidden facilitator menu (duo only):** tap the **key icon three times quickly**. You can make Anjalie send a cheer, get stuck, or find her half, finish the level right away, or restart.
- The level complete screen shows time, gems found, and (duo) scrolls sent and received. Jot those down per tester.

## Files

| File | What it's for |
| --- | --- |
| `index.html` | Every screen's structure, one `<section class="screen">` each |
| `css/style.css` | All styling, grouped by screen |
| `js/config.js` | **Start here.** Levels, charm prices and descriptions, timing, the friend's script, messages, emojis, replies |
| `js/ui.js` | Shared pieces: saved progress, charm icons, the hanging bracelet |
| `js/game.js` | The maze engine: movement, charms, drawing, the friend's logic, the Scroll sheet |
| `js/app.js` | Screen flow: map, level entry, friend picker, level complete, stall, bracelet |

Most tweaks only need `js/config.js`. For example, change a charm's price or Bramble's line about it, add a level (new `seed` = new maze), change when Anjalie gets stuck (`getsStuckAt`), or add a message to `messages` plus a matching line in `replies`.

## Art

Art lives in `art/`: the forest map (`map.webp`), the maze floor (`dirt.webp`), the maze walls (`vines.webp`), the gem (`gem.webp`, used everywhere gems appear), the load screen (`load.webp`), the Thorn Maze start screen (`entry-thorn.webp`, set per level with `entryArt` in `js/config.js`), Bramble (`bramble.webp`, animated), the stall (`stall.webp`) and its sky background (`stall-bg.webp`), and the map's Charms stall (`stall-map.webp`).

**Swapping Bramble or the stall:** save a new transparent image over the file with the same name and the same rough shape (Bramble is portrait, the stall is square). Bramble can be a still image or animated. To turn an animated GIF into WebP, use ezgif.com (GIF to WebP); it's usually a third of the size. The stall's charms hang on its two ropes; if a new stall puts the ropes somewhere else, update `STALL_SPOTS` in `js/app.js` (positions are % of the stall image).

**Swapping maze textures:** they must be seamless square tiles (Midjourney's `--tile`). Save over `art/dirt.webp` or `art/vines.webp`, or point `mazeArt` in `js/config.js` at new files. `tileSize` sets how big one repeat looks on screen, and the colors there control the fog, the dark rim around walls, footprints, and the tint on the friend's side.

**Swapping the map:** export the new image (portrait, about 816×1456 or the same shape), save it over `art/map.webp`, or add a new file and point `map.image` in `js/config.js` at it. If the gates move, update `map.gates`. Each gate's `x`/`y` is its center in the image's own pixels, and `w`/`h` is the tap area. Keep tappable things at least ~90px from the left and right edges, because tall phones crop the sides slightly. To shrink a big PNG, save it as WebP or JPG (around 85–90% quality).

## How to make a change

**No setup (GitHub website):**
1. Open the file on GitHub and click the pencil icon.
2. Make your edit, then **Commit changes**. Write a short note about what you changed.
3. The live link updates about a minute later. Refresh it on your phone.

**Seeing an old version after a change?** Browsers reuse files for a few minutes. In `index.html`, the CSS and JS links end in `?v=7`. Bump that number (to `?v=8` and so on) whenever you change a `.css` or `.js` file, and phones will fetch the new copy right away. Images get saved by browsers too: **when you replace a piece of art, give the new file a new name** (like `stall-2.webp`) and update where it's used. Otherwise phones may keep showing the old picture for a while.

**On your computer:**
1. `git clone https://github.com/marzynthecomets/faeriecharm.git`
2. Open `index.html` in a browser. No build step and no install.
3. To test on your phone over wifi, run `python3 -m http.server` in the folder and open `http://<your-computer's-ip>:8000` on the phone.
4. `git pull` before you start, then commit and `git push` when you're done.

**Working at the same time:** let the group know which file you're in. Two people editing different files is fine. Two people editing the same part of `game.js` causes merge conflicts.

## Design notes

- Kids add friends **in person only** (scan codes together), with no open chat or stranger contact. Scrolls use preset messages so there's nothing to moderate.
- Boost charms are **lent for one level**, not given away, so no one loses something they bought and there's no "give me your charm" pressure.
- Gem gifts are capped at 5 per scroll.
- Solo and Duo earn the same gems. Duo adds a Friendship charm (cosmetic), so kids without a friend on the app aren't shortchanged.
