// FaerieCharm settings. Change these to tune the game without touching the engine.
// All times are in seconds unless the name says ms.

const CONFIG = {
  // ----- movement + view -----
  stepMs: 150,           // how long one step takes
  holdDelay: 0.38,       // how long the stick must be held before steps repeat
  repeatEvery: 0.2,      // time between repeated steps while holding
  fogClear: 85,          // radius (px) around the player that is fully visible
  fogEdge: 215,          // radius (px) where the fog is fully opaque
  peekSeconds: 3,        // how long Peek shows the wider maze
  glowSeconds: 10,       // how long Glow lights up a bigger circle
  glowBoost: 1.9,        // how much bigger the visible circle gets with Glow

  // ----- rewards -----
  levelReward: 5,        // gems for finishing a level (same for solo and duo)
  maxGemGift: 5,         // most gems you can put in one scroll

  // ----- forest map art -----
  // Positions are in the art's own pixels (open the image in any editor to read them).
  // Keep tappable things at least ~90px in from the left/right edges: tall phones crop the sides a little.
  map: {
    image: 'art/map.webp', width: 816, height: 1456,
    gates: [                                   // one per level, in order: center x/y and the tap area size
      { x: 387, y: 1025, w: 330, h: 130 },     // Level 1: the thorny hedge
      { x: 407, y: 540,  w: 110, h: 110 },     // Level 2: lower door
      { x: 420, y: 210,  w: 110, h: 110 }      // Level 3: upper door
    ],
    stall: { x: 96, y: 232 }                   // top-left corner of the floating Charm Stall
  },

  // ----- levels (seed = maze layout; change it to get a new maze) -----
  levels: [
    { name: 'Thorn Maze',   blurb: 'Enter the Thorn Maze and find the key to free the forest.', width: 7, height: 12, seed: 2718, friendSeed: 9001 },
    { name: 'Fern Tangle',  blurb: 'The ferns have grown over the path. Find the key hidden in the green.', width: 7, height: 14, seed: 4242, friendSeed: 7777 },
    { name: 'Moonroot Maze', blurb: 'The roots only glow at night. Find the key before the moon sets.', width: 8, height: 16, seed: 1312, friendSeed: 5150 }
  ],

  // ----- charms (type 'boost' = used in the maze, 'style' = just for looks) -----
  charms: {
    peek:   { type: 'boost', name: 'Peek',       price: 0,  say: 'See more of the maze around you for 3 seconds. Once per level.' },
    dash:   { type: 'boost', name: 'Dash',       price: 5,  say: 'Zip two spaces in a straight line. Perfect for escaping a dead end.' },
    snip:   { type: 'boost', name: 'Thorn Snip', price: 10, say: 'Snip through one thorny wall right in front of you. Once per level.' },
    glow:   { type: 'boost', name: 'Glow',       price: 15, say: 'Light up a big circle around you for 10 seconds. Once per level.' },
    leaf:   { type: 'style', name: 'Leaf',       price: 3,  say: 'A tiny leaf from the oldest tree in the forest. Just for looks!' },
    star:   { type: 'style', name: 'Star',       price: 3,  say: 'A star that fell into my garden. It twinkles on your bracelet.' },
    moon:   { type: 'style', name: 'Moon',       price: 4,  say: 'A sliver of moon. Faeries wear these for luck.' },
    shroom: { type: 'style', name: 'Mushroom',   price: 4,  say: 'A little spotted mushroom. Do not eat it!' },
    friend: { type: 'style', name: 'Friendship', price: null, say: 'You earn this by finishing a level with a friend. They have the matching half!' }
  },
  stallBoost: ['dash', 'snip', 'glow'],
  stallStyle: ['leaf', 'star', 'moon', 'shroom'],

  // ----- the scripted friend (playtest stand-in for a real second player) -----
  friendName: 'Anjalie',
  otherFriends: [
    { name: 'Marco', status: 'Playing Level 2' },
    { name: 'Priya', status: 'Away · can play her half later' }
  ],
  friend: {
    scriptedScrolls: [                 // scrolls she sends on her own, at these times
      { at: 6,  msg: "Hi!! Let's go!", emoji: '👋' },
      { at: 32, msg: 'You got this!',  emoji: '💪' }
    ],
    getsStuckAt: 46,       // she gets stuck here (status turns orange, Send a Scroll pulses)
    stuckFor: 22,          // she gets herself unstuck after this long if nobody helps
    findsHalfAt: 85,       // latest time she finds her half of the key
    findsHalfAfterYou: 10, // she finds hers at most this long after the player finds theirs
    findsHalfAfterHelp: 9  // ...or this long after the player gifts her a Peek or a charm
  },

  // ----- the Send a Scroll sheet -----
  messages: ["You got this!", "Almost there!", "I found my half!", "I'm stuck!", "Try another way", "Wait for me!"],
  emojis: ['💪', '🎉', '⭐', '😂', '🌿', '💖'],
  // what the friend says back ("I'm stuck!" is special: she sends a Peek the first time)
  replies: {
    "You got this!":    { msg: 'Thanks!! You too',              emoji: '💪' },
    "Almost there!":    { msg: "Ooh, I'm close too!",           emoji: '✨' },
    "I found my half!": { msg: "YAY!! Mine's coming",           emoji: '🏃' },
    "Try another way":  { msg: 'Ok, turning around!',           emoji: '🔄' },
    "Wait for me!":     { msg: "Ok! I'll meet you at the door", emoji: '🙂' }
  }
};
