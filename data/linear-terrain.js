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
      ballastWidth:3.18, ballast:"#8f918b", sleeperSpacing:1.05, sleeperLength:2.86, sleeperHeight:0.48, railGauge:1.02
    }),
    hedge: style("hedge", "hedge", "linear", "hedge", 1.65, crossingHard, { repeatSpacing:1.35 }),
    wood_fence: style("wood_fence", "fence", "linear", "wood fence", 0.75, crossingHard, { postSpacing:2.1 }),
    stone_wall: style("stone_wall", "wall", "linear", "low wall", 1.05, crossingHard, { stoneSpacing:1.15 })
  });

  window.CROSSROADS_LINEAR_TERRAIN_MATERIALS = Object.freeze({
    dirt_road: Object.freeze({
      dirt: Object.freeze({ id:"dirt", label:"Dirt", surface:"#94805b", shoulder:"#73805d", detail:"#d0bd8d" }),
      paved: Object.freeze({ id:"paved", label:"Paved", surface:"#777a76", shoulder:"#676d69", detail:"#aeb2ad" }),
      mud: Object.freeze({ id:"mud", label:"Mud", surface:"#6f5943", shoulder:"#657153", detail:"#9a7b59" })
    }),
    stream: Object.freeze({
      clear: Object.freeze({ id:"clear", label:"Clear water", water:"#73b1c3", bank:"#6d805c", detail:"#c7e3e7" }),
      dark: Object.freeze({ id:"dark", label:"Deep water", water:"#547f91", bank:"#627459", detail:"#a9c8d1" }),
      marsh: Object.freeze({ id:"marsh", label:"Marsh water", water:"#78998f", bank:"#6f7d57", detail:"#bdd0b8" })
    }),
    railway_embankment: Object.freeze({
      standard: Object.freeze({ id:"standard", label:"Standard rail", ballast:"#8f918b", stripe:"#73766f", sleeper:"#6b4732", sleeperEdge:"#493126", rail:"#7d888e", railEdge:"#3f474b" })
    })
  });

})();
