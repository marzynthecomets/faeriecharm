// FaerieCharm settings. Change these to tune the game without touching the engine (js/game.js).
// All times are in seconds unless the name says ms.

const CONFIG = {
  // ----- the maze -----
  mazeWidth: 7,          // cells across on each player's half
  mazeHeight: 12,        // cells down
  mySeed: 2718,          // change to get a different maze layout for the player
  friendSeed: 9001,      // the friend's half (only shown dimmed behind the thorn wall)

  // ----- movement + view -----
  stepMs: 150,           // how long one step takes
  holdDelay: 0.38,       // how long the stick must be held before steps repeat
  repeatEvery: 0.2,      // time between repeated steps while holding
  fogClear: 85,          // radius (px) around the player that is fully visible
  fogEdge: 215,          // radius (px) where the fog is fully opaque
  peekSeconds: 3,        // how long the Peek charm shows the wider maze

  // ----- what the player starts with -----
  startGems: 4,
  startPeeks: 1,
  startDashes: 1,
  levelReward: 5,        // gems for finishing the level

  // ----- the scripted friend (playtest stand-in for a real second player) -----
  friendName: 'Anjalie',
  friend: {
    // scrolls she sends on her own, at these times
    scriptedScrolls: [
      { at: 6,  msg: "Hi!! Let's go!", emoji: '👋' },
      { at: 32, msg: 'You got this!',  emoji: '💪' }
    ],
    getsStuckAt: 46,       // she gets stuck here (status turns orange, Send a Scroll pulses)
    stuckFor: 22,          // she gets herself unstuck after this long if nobody helps
    findsHalfAt: 85,       // latest time she finds her half of the key
    findsHalfAfterYou: 10, // she finds hers at most this long after the player finds theirs
    findsHalfAfterHelp: 9  // ...or this long after the player gifts her a Peek or Dash
  },

  // ----- the Send a Scroll sheet -----
  messages: ["You got this!", "Almost there!", "I found my half!", "I'm stuck!", "Try another way", "Wait for me!"],
  emojis: ['💪', '🎉', '⭐', '😂', '🌿', '💖'],

  // what the friend says back to each message ("I'm stuck!" is special: she sends a Peek the first time)
  replies: {
    "You got this!":    { msg: 'Thanks!! You too',              emoji: '💪' },
    "Almost there!":    { msg: "Ooh, I'm close too!",           emoji: '✨' },
    "I found my half!": { msg: "YAY!! Mine's coming",           emoji: '🏃' },
    "Try another way":  { msg: 'Ok, turning around!',           emoji: '🔄' },
    "Wait for me!":     { msg: "Ok! I'll meet you at the door", emoji: '🙂' }
  }
};
