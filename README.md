# FaerieCharm

A co-op maze game for kids 7–11, built for our UX Design for Kids class. Two friends each solve their own half of the Thorn Maze, find half of a key, and meet at the door. The design focus is **communicate**: players send each other **Scrolls** (preset messages, emojis, and gifts like a Peek, gems, or a lent Dash charm) while they play.

**Play it:** https://marzynthecomets.github.io/faeriecharm/ (works once GitHub Pages is turned on; open it on a phone)

## What's in this version

This is the **Duo level for playtesting**. The second player, "Anjalie," is **scripted**: she sends scrolls, gets stuck partway through, replies to whatever you send, and finds her half of the key. Real two-phone play is the next step after playtesting.

- Drag anywhere on the maze to move (or use arrow keys / WASD on a laptop). A quick push moves one space.
- Fog hides most of the maze; footprints fade behind you.
- Bracelet charms in the header: **Peek** (see more for 3 seconds) and **Dash** (zip two spaces).
- **Send a Scroll** opens the message sheet.

### Running a playtest

- **Hidden facilitator menu:** tap the **key icon three times quickly**. You can make Anjalie send a cheer, get stuck, or find her half, or restart the level.
- The win screen shows time, scrolls sent, and scrolls received. Jot those down per tester.

## Files

| File | What it's for |
| --- | --- |
| `index.html` | Page structure: header, status bar, Scroll sheet, overlays |
| `css/style.css` | All styling |
| `js/config.js` | **Start here.** Timing, starting items, the friend's script, messages, emojis, replies |
| `js/game.js` | The engine: maze, movement, drawing, the friend's logic, the Scroll sheet |

Most tweaks only need `js/config.js`. For example, change when Anjalie gets stuck (`getsStuckAt`), add a message to `messages` plus a matching line in `replies`, or try a new maze with `mySeed`.

## How to make a change

**No setup (GitHub website):**
1. Open the file on GitHub and click the pencil icon.
2. Make your edit, then **Commit changes**. Write a short note about what you changed.
3. The live link updates about a minute later. Refresh it on your phone.

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
