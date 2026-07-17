"use strict";

(() => {
  const open = Object.freeze({ movement:"open", cover:null, los:"clear" });
  const rough = Object.freeze({ movement:"rough", cover:null, los:"clear" });
  const roughSoft = Object.freeze({ movement:"rough", cover:"soft", los:"clear", save:5 });
  const crossingHard = Object.freeze({ movement:"crossing", cover:"hard", los:"clear", save:4 });

  function style(id, renderer, family, label, width, rules, presentation = {}) {
    return Object.freeze({ id, renderer, family, label, width, rules, presentation:Object.freeze(presentation) });
  }

  window.CROSSROADS_LINEAR_TERRAIN_STYLES = Object.freeze({
    dirt_road: style("dirt_road", "road", "transport", "dirt road", 3.4, open, {
      shoulderWidth:3.78, color:"#ad9361", shoulder:"#748354", detail:"#d0bb87"
    }),
    stream: style("stream", "stream", "water", "stream", 2.35, rough, {
      bankWidth:3.35, bank:"#6f8259", water:"#75b4c6", detail:"#b9d9df"
    }),
    ditch: style("ditch", "ditch", "linear", "ditch", 2.0, roughSoft, {
      bankWidth:3.0, bank:"#75845d", channel:"#66563d"
    }),
    railway_embankment: style("railway_embankment", "rail", "transport", "raised railway", 4.0, crossingHard, {
      ballastWidth:3.05, ballast:"#8c795b", sleeperSpacing:2.35, sleeperLength:2.65, railGauge:0.92
    }),
    hedge: style("hedge", "hedge", "linear", "hedge", 1.65, crossingHard, { repeatSpacing:1.35 }),
    wood_fence: style("wood_fence", "fence", "linear", "wood fence", 0.75, crossingHard, { postSpacing:2.1 }),
    stone_wall: style("stone_wall", "wall", "linear", "low wall", 1.05, crossingHard, { stoneSpacing:1.15 })
  });
})();
