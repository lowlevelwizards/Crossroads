"use strict";

(() => {
  const MOVEMENT = Object.freeze({
    open:Object.freeze({ multiplier:1, infantryAccess:true, vehicleAccess:"open" }),
    rough:Object.freeze({ multiplier:2, infantryAccess:true, vehicleAccess:"restricted" }),
    crossing:Object.freeze({ multiplier:1, infantryAccess:true, vehicleAccess:"restricted" }),
    impassable:Object.freeze({ multiplier:Infinity, infantryAccess:false, vehicleAccess:"none" })
  });

  function normalize(rules = {}, context = {}) {
    const movement = String(rules.movement || "open");
    const profile = MOVEMENT[movement] || MOVEMENT.open;
    const cover = rules.cover ?? null;
    const los = rules.los || "clear";
    const width = Number(context.width);
    const maxInfantryCrossingWidth = Number(rules.maxInfantryCrossingWidth);
    const widthBlocksInfantry = Number.isFinite(width) && Number.isFinite(maxInfantryCrossingWidth) && width > maxInfantryCrossingWidth;
    const resolvedMovement = widthBlocksInfantry ? "impassable" : movement;
    const resolvedProfile = MOVEMENT[resolvedMovement] || profile;
    return Object.freeze({
      ...rules,
      movement:resolvedMovement,
      cover,
      los,
      movementMultiplier:Number(rules.movementMultiplier) || resolvedProfile.multiplier,
      blocksMovement:resolvedMovement === "impassable",
      blocksLineOfSight:los === "blocking",
      defensivePosition:rules.defensivePosition ?? Boolean(cover || resolvedMovement === "crossing" || resolvedMovement === "rough"),
      infantryAccess:rules.infantryAccess ?? resolvedProfile.infantryAccess,
      vehicleAccess:rules.vehicleAccess ?? resolvedProfile.vehicleAccess,
      sourceWidth:Number.isFinite(width) ? width : undefined
    });
  }

  function forDefinition(definition, context = {}) {
    return normalize(definition?.rules ?? {}, context);
  }

  function describe(rules = {}) {
    const normalized = normalize(rules);
    const parts = [normalized.movement];
    if (normalized.cover) parts.push(`${normalized.cover} cover`);
    if (normalized.los !== "clear") parts.push(`${normalized.los} LOS`);
    return parts.join(" · ");
  }

  window.CrossroadsTerrainSemantics = Object.freeze({ MOVEMENT, normalize, forDefinition, describe });
})();
