"use strict";

// Foundation 2B.2: static terrain definitions peeled out of index.html.
window.CROSSROADS_TERRAIN = Object.freeze({
  woods: Object.freeze({ id: "woods", label: "woods", type: "soft", x: 15, y: 28, width: 18, height: 14, save: 5 }),
  wall: Object.freeze({ id: "wall", label: "low wall", type: "hard", x: 38, y: 30, width: 17, height: 2.5, save: 4 }),
  building: Object.freeze({ id: "building", label: "farmhouse", type: "blocking", x: 28, y: 4, width: 13, height: 13 })
});
