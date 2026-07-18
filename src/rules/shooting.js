"use strict";

(() => {
  // Foundation 4A: pure shooting legality, fire-group, hit, Pin, damage,
  // and cover-save calculation. This module never renders, logs, updates
  // statistics, or mutates battle state.

  function create({
    rules,
    weaponProfiles,
    unitQuality,
    terrain,
    mmgRules,
    distanceBetweenPoints,
    segmentRectClip,
    segmentTerrainClip = segmentRectClip,
    resolveShooterPoint,
    resolveTargetPoint,
    getTerrainInstance,
    analyzeIncomingPins
  }) {
    if (
      !rules ||
      !weaponProfiles ||
      !unitQuality ||
      !terrain ||
      !mmgRules ||
      typeof analyzeIncomingPins !== "function"
    ) {
      throw new Error(
        "Crossroads shooting rules require data, geometry, and morale dependencies."
      );
    }

    function qualityProfile(unitOrQuality) {
      const qualityId =
        typeof unitOrQuality === "string"
          ? unitOrQuality
          : unitOrQuality?.quality;
      return unitQuality[qualityId] ?? unitQuality.regular;
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function isMMGTeam(unit) {
      return Boolean(unit?.weapons?.mmg);
    }

    function normalizeDegrees(value) {
      let angle = value % 360;
      if (angle < 0) angle += 360;
      return angle;
    }

    function facingToward(from, to) {
      return normalizeDegrees(
        Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
      );
    }

    function smallestAngleDifference(a, b) {
      const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
      return Math.min(diff, 360 - diff);
    }

    function analyzeMMGFireArc(unit, target) {
      if (!isMMGTeam(unit) || !unit.mmgDeployed) {
        return Object.freeze({
          bearing: null,
          relativeAngle: 0,
          insideArc: true
        });
      }

      const bearing = facingToward(unit, target);
      const relativeAngle = smallestAngleDifference(unit.mmgFacing, bearing);
      return Object.freeze({
        bearing,
        relativeAngle,
        insideArc: relativeAngle <= mmgRules.arcDegrees / 2 + 0.001
      });
    }

    function targetInsideMMGArc(unit, target) {
      return analyzeMMGFireArc(unit, target).insideArc;
    }

    function availableFireGroups(
      unit,
      distance,
      moving = false,
      enforceRange = true
    ) {
      const groups = [];

      for (const [key, rawCount] of Object.entries(unit?.weapons ?? {})) {
        const profile = weaponProfiles[key];
        if (!profile || rawCount <= 0) continue;
        if (moving && profile.fixed) continue;
        if (enforceRange && distance > profile.range + 0.001) continue;

        let shots = rawCount * profile.shots;
        let models = rawCount;

        if (profile.crewWeapon) {
          models = 1;
          if (profile.fixed && !unit.mmgDeployed) shots = 0;
          else if (unit.soldiers >= mmgRules.fullCrew) shots = profile.shots;
          else if (unit.soldiers >= mmgRules.reducedCrew) {
            shots = profile.reducedShots;
          } else shots = 0;
        }

        if (shots <= 0) continue;
        groups.push(Object.freeze({ key, profile, models, shots }));
      }

      return Object.freeze(groups);
    }

    function weaponRange(unit, moving = false) {
      const groups = availableFireGroups(unit, Infinity, moving, false);
      return groups.length
        ? Math.max(...groups.map(group => group.profile.range))
        : 0;
    }

    function determineLineCover(shooter, target) {
      const sources = [];
      let saveTarget = null;
      let label = "No cover";
      const instances = Array.isArray(terrain.instances) ? terrain.instances : [];

      for (const woods of instances.filter(
        instance => instance.rules?.cover === "soft"
      )) {
        if (segmentTerrainClip(shooter, target, woods) === null) continue;
        const terrainSave = woods.rules?.save ?? 5;
        sources.push(
          `line passes through ${woods.definition?.label ?? "soft terrain"}`
        );
        if (saveTarget === null || terrainSave < saveTarget) {
          saveTarget = terrainSave;
          label = `Soft cover from ${woods.definition?.label ?? "terrain"}`;
        }
      }

      for (const wall of instances.filter(
        instance => instance.rules?.movement === "crossing"
      )) {
        const wallClip = segmentTerrainClip(shooter, target, wall);
        if (wallClip === null) continue;
        const nearest = distanceBetweenPoints(target, wallClip.exit);
        if (nearest <= rules.wallProtectionDepth + 0.001) {
          const terrainSave = wall.rules?.save ?? 4;
          sources.push(
            `${wall.definition?.label ?? "wall"} crossed ` +
            `${nearest.toFixed(1)}″ from target`
          );
          if (saveTarget === null || terrainSave < saveTarget) {
            saveTarget = terrainSave;
            label = `Hard cover from ${wall.definition?.label ?? "wall"}`;
          }
        }
      }

      if (target.down) {
        if (saveTarget === null) {
          saveTarget = 5;
          label = "Down in the open";
          sources.push("target is Down");
        } else {
          saveTarget = Math.max(2, saveTarget - 2);
          label += " + Down";
          sources.push("Down improves cover");
        }
      }

      return Object.freeze({
        label,
        saveTarget,
        sources: Object.freeze(sources)
      });
    }

    function analyzeShot(shooter, target) {
      return analyzeShotAtPoint(shooter, target);
    }

    function analyzeShotAtPoint(shooter, targetPoint) {
      const shooterPoint = resolveShooterPoint(shooter, targetPoint);
      const targetContext = resolveTargetPoint(targetPoint);
      const targetUnit = targetContext.unit ?? null;
      const targetAimPoint = targetContext.point;
      const distance = distanceBetweenPoints(shooterPoint, targetAimPoint);
      const range = weaponRange(shooter, false);
      const inRange = distance <= range + 0.001;

      const mmgArc = analyzeMMGFireArc(shooter, targetAimPoint);
      const shooterBuildingId = shooter?.inBuilding ?? null;
      const targetBuildingId = targetContext.buildingId ?? targetUnit?.inBuilding ?? null;
      const instances = Array.isArray(terrain.instances) ? terrain.instances : [];
      const blockingBuilding = instances
        .filter(instance => instance.rules?.los === "blocking")
        .find(instance => {
          if (
            instance.id === shooterBuildingId ||
            instance.id === targetBuildingId
          ) {
            return false;
          }
          return segmentRectClip(shooterPoint, targetAimPoint, instance) !== null;
        }) ?? null;

      const blockedByBuilding = Boolean(blockingBuilding);
      const blockedByArc = !mmgArc.insideArc;
      const blocked = blockedByBuilding || blockedByArc;
      const blockReason = blockedByArc
        ? "Outside the deployed MMG firing arc."
        : blockedByBuilding
          ? `The ${blockingBuilding.definition?.label ?? "building"} ` +
            "completely blocks line of sight."
          : "";

      let cover = blocked
        ? Object.freeze({ label: "No shot", saveTarget: null, sources: Object.freeze([]) })
        : determineLineCover(shooterPoint, targetAimPoint);

      if (!blocked && targetBuildingId) {
        const occupiedBuilding = getTerrainInstance(targetBuildingId);
        const label = occupiedBuilding?.definition?.label ?? "building";
        cover = Object.freeze({
          label: `Hard cover inside ${label}`,
          saveTarget: occupiedBuilding?.rules?.save ?? 3,
          sources: Object.freeze([`target occupies the ${label}`])
        });
      }

      return Object.freeze({
        distance,
        range,
        inRange,
        blocked,
        blockReason,
        cover,
        shooterPoint,
        targetPoint: targetAimPoint,
        insideArc: mmgArc.insideArc
      });
    }

    function calculateGroupHitTarget(shooter, group, movingPenalty = false) {
      let hitTarget = rules.baseHitTarget;
      const modifiers = [];
      const qualityShotModifier = qualityProfile(shooter).shootingTargetModifier;

      if (qualityShotModifier !== 0) {
        hitTarget += qualityShotModifier;
        modifiers.push(Object.freeze({
          code: "quality",
          label: qualityShotModifier > 0 ? "Inexperienced" : "Veteran",
          value: qualityShotModifier
        }));
      }

      if (movingPenalty && !group.profile.assault) {
        hitTarget += 1;
        modifiers.push(Object.freeze({
          code: "moving",
          label: "fired on the move",
          value: 1
        }));
      }

      if ((shooter?.pins ?? 0) > 0) {
        hitTarget += 1;
        modifiers.push(Object.freeze({
          code: "pinned",
          label: "firer still pinned",
          value: 1
        }));
      }

      return Object.freeze({
        hitTarget: clamp(hitTarget, 2, 7),
        modifiers: Object.freeze(modifiers)
      });
    }

    function resolveAttack({
      shooter,
      target,
      trace,
      movingPenalty = false,
      rollDice
    }) {
      if (typeof rollDice !== "function") {
        throw new Error("Shooting resolution requires an injected rollDice function.");
      }

      const groups = availableFireGroups(
        shooter,
        trace.distance,
        movingPenalty,
        true
      );

      if (groups.length === 0) {
        return Object.freeze({
          status: "no-weapons",
          groups,
          totalShots: 0,
          totalHits: 0,
          pinDelta: 0,
          pinsAfter: target?.pins ?? 0,
          routedByPins: false,
          damageTarget: rules.regularDamageTarget,
          damageRolls: Object.freeze([]),
          potentialCasualties: 0,
          coverSaveTarget: trace.cover.saveTarget,
          saveRolls: Object.freeze([]),
          saved: 0,
          requestedCasualties: 0,
          casualties: 0,
          destroyed: false
        });
      }

      let totalShots = 0;
      let totalHits = 0;
      const groupResults = [];

      for (const group of groups) {
        const hitAnalysis = calculateGroupHitTarget(
          shooter,
          group,
          movingPenalty
        );
        const rolls = Object.freeze([...rollDice(group.shots)]);
        const hits = hitAnalysis.hitTarget > 6
          ? 0
          : rolls.filter(value => value >= hitAnalysis.hitTarget).length;

        totalShots += group.shots;
        totalHits += hits;
        groupResults.push(Object.freeze({
          key: group.key,
          profile: group.profile,
          models: group.models,
          shots: group.shots,
          hitTarget: hitAnalysis.hitTarget,
          modifiers: hitAnalysis.modifiers,
          rolls,
          hits
        }));
      }

      const pinDelta = totalHits > 0 ? 1 : 0;
      const pinImpact = analyzeIncomingPins(target, pinDelta);
      const pinsAfter = pinImpact.pinsAfter;
      const routedByPins = pinImpact.routed;

      if (routedByPins) {
        const casualties = Math.max(0, target?.soldiers ?? 0);
        return Object.freeze({
          status: "routed",
          groups: Object.freeze(groupResults),
          totalShots,
          totalHits,
          pinDelta,
          pinsAfter,
          routedByPins: true,
          damageTarget: rules.regularDamageTarget,
          damageRolls: Object.freeze([]),
          potentialCasualties: 0,
          coverSaveTarget: trace.cover.saveTarget,
          saveRolls: Object.freeze([]),
          saved: 0,
          requestedCasualties: casualties,
          casualties,
          destroyed: true
        });
      }

      const damageRolls = Object.freeze([...rollDice(totalHits)]);
      const potentialCasualties = damageRolls.filter(
        value => value >= rules.regularDamageTarget
      ).length;

      let saveRolls = Object.freeze([]);
      let saved = 0;
      if (potentialCasualties > 0 && trace.cover.saveTarget !== null) {
        saveRolls = Object.freeze([...rollDice(potentialCasualties)]);
        saved = saveRolls.filter(
          value => value >= trace.cover.saveTarget
        ).length;
      }

      const requestedCasualties = Math.max(0, potentialCasualties - saved);
      const casualties = Math.min(
        requestedCasualties,
        Math.max(0, target?.soldiers ?? 0)
      );

      return Object.freeze({
        status: "resolved",
        groups: Object.freeze(groupResults),
        totalShots,
        totalHits,
        pinDelta,
        pinsAfter,
        routedByPins: false,
        damageTarget: rules.regularDamageTarget,
        damageRolls,
        potentialCasualties,
        coverSaveTarget: trace.cover.saveTarget,
        saveRolls,
        saved,
        requestedCasualties,
        casualties,
        destroyed:
          (target?.soldiers ?? 0) > 0 && casualties >= target.soldiers
      });
    }

    return Object.freeze({
      isMMGTeam,
      analyzeMMGFireArc,
      targetInsideMMGArc,
      availableFireGroups,
      weaponRange,
      determineLineCover,
      analyzeShot,
      analyzeShotAtPoint,
      calculateGroupHitTarget,
      resolveAttack
    });
  }

  window.CrossroadsShootingRules = Object.freeze({ create });
})();
