"use strict";

(() => {
  // Foundation 3H: pure movement legality and cost analysis.
  // The module returns analysis results only. It does not mutate units,
  // draw routes, resolve Ambush, or advance activation state.

  function create({
    rules,
    terrain,
    movementIntegrityEnabled,
    livingUnits,
    distanceBetweenPoints,
    pointAtSegment,
    pointInsideRect,
    expandRect,
    segmentRectClip,
    segmentPointDistance,
    capitalize
  }) {
    function analyzeMovementPath(unit, path, order, exemptUnitId) {
      const allowance =
        order === "Run" ? rules.runDistance : rules.advanceDistance;
      let cost = 0;
      const details = [];

      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];
        const segment = analyzeMovementSegment(
          unit,
          start,
          end,
          exemptUnitId
        );

        cost += movementIntegrityEnabled()
          ? segment.cost
          : segment.distance;

        details.push(...segment.details);

        if (!segment.legal) {
          return {
            legal: false,
            kind: "obstacle",
            reason: segment.reason,
            cost,
            allowance,
            details
          };
        }
      }

      const destination = path[path.length - 1];
      const destinationCollision = analyzeDestinationCollision(
        unit,
        destination,
        exemptUnitId
      );

      if (destinationCollision.blocked) {
        return {
          legal: false,
          kind: "collision",
          reason: destinationCollision.reason,
          cost,
          allowance,
          details
        };
      }

      if (cost > allowance + 0.001) {
        return {
          legal: false,
          kind: "allowance",
          reason:
            `path costs ${cost.toFixed(1)}″ but ` +
            `${order} allows ${allowance}″.`,
          cost,
          allowance,
          details
        };
      }

      return {
        legal: true,
        kind: "legal",
        reason: "",
        cost,
        allowance,
        details
      };
    }

    function fitMovementPathToAllowance(
      unit,
      path,
      order,
      exemptUnitId
    ) {
      const allowance =
        order === "Run" ? rules.runDistance : rules.advanceDistance;
      const fittedPath = [path[0]];
      const details = [];
      let cost = 0;

      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];
        const fullSegment = analyzeMovementSegment(
          unit,
          start,
          end,
          exemptUnitId
        );

        if (!fullSegment.legal) return null;

        const segmentCost = movementIntegrityEnabled()
          ? fullSegment.cost
          : fullSegment.distance;

        if (cost + segmentCost <= allowance + 0.001) {
          fittedPath.push(end);
          cost += segmentCost;
          details.push(...fullSegment.details);
          continue;
        }

        const remaining = allowance - cost;
        if (remaining <= 0.02) break;

        let low = 0;
        let high = 1;
        let bestPoint = start;
        let bestSegment = null;

        for (let step = 0; step < 34; step++) {
          const t = (low + high) / 2;
          const candidate = pointAtSegment(start, end, t);
          const segment = analyzeMovementSegment(
            unit,
            start,
            candidate,
            exemptUnitId
          );

          const destinationCollision = segment.legal
            ? analyzeDestinationCollision(
                unit,
                candidate,
                exemptUnitId
              )
            : { blocked: true };

          const candidateCost = segment.legal
            ? (
                movementIntegrityEnabled()
                  ? segment.cost
                  : segment.distance
              )
            : Infinity;

          if (
            segment.legal &&
            !destinationCollision.blocked &&
            candidateCost <= remaining + 0.0005
          ) {
            low = t;
            bestPoint = candidate;
            bestSegment = segment;
          } else {
            high = t;
          }
        }

        if (
          !bestSegment ||
          distanceBetweenPoints(start, bestPoint) < 0.05
        ) {
          break;
        }

        fittedPath.push(bestPoint);
        cost += movementIntegrityEnabled()
          ? bestSegment.cost
          : bestSegment.distance;
        details.push(...bestSegment.details);
        details.push("destination shortened to available movement");

        return {
          path: fittedPath,
          analysis: {
            legal: true,
            kind: "fitted",
            reason: "",
            cost,
            allowance,
            details,
            fitted: true
          }
        };
      }

      if (fittedPath.length < 2) return null;

      const destinationCollision = analyzeDestinationCollision(
        unit,
        fittedPath[fittedPath.length - 1],
        exemptUnitId
      );

      if (destinationCollision.blocked) return null;

      return {
        path: fittedPath,
        analysis: {
          legal: true,
          kind: "fitted",
          reason: "",
          cost,
          allowance,
          details,
          fitted: true
        }
      };
    }

    function analyzeMovementSegment(
      unit,
      start,
      end,
      exemptUnitId
    ) {
      const distance = distanceBetweenPoints(start, end);
      const expandedBuilding = expandRect(
        terrain.building,
        rules.unitCollisionRadius
      );

      if (pointInsideRect(end, expandedBuilding)) {
        return {
          legal: false,
          reason: "destination overlaps the impassable farmhouse.",
          distance,
          cost: distance,
          details: []
        };
      }

      if (segmentRectClip(start, end, expandedBuilding)) {
        return {
          legal: false,
          reason: "the path passes through the impassable farmhouse.",
          distance,
          cost: distance,
          details: []
        };
      }

      if (movementIntegrityEnabled()) {
        for (const other of livingUnits()) {
          if (other.id === unit.id || other.id === exemptUnitId) {
            continue;
          }

          const proximity = segmentPointDistance(start, end, other);

          if (
            proximity.distance < rules.unitSeparation - 0.001 &&
            proximity.t > 0.05 &&
            proximity.t < 0.98
          ) {
            return {
              legal: false,
              reason:
                `the path passes through ` +
                `${capitalize(other.faction)} ${other.name}.`,
              distance,
              cost: distance,
              details: []
            };
          }
        }
      }

      let cost = distance;
      const details = [];

      if (movementIntegrityEnabled()) {
        const woodsClip = segmentRectClip(start, end, terrain.woods);

        if (woodsClip) {
          const insideLength =
            distance *
            Math.max(0, woodsClip.tExit - woodsClip.tEnter);

          cost +=
            insideLength *
            (rules.roughGroundMultiplier - 1);

          details.push(
            `${insideLength.toFixed(1)}″ through woods costs double`
          );
        }

        const wallClip = segmentRectClip(start, end, terrain.wall);

        if (wallClip) {
          cost += rules.wallCrossingCost;
          details.push(`wall crossing +${rules.wallCrossingCost}″`);
        }
      }

      return {
        legal: true,
        reason: "",
        distance,
        cost,
        details
      };
    }

    function analyzeDestinationCollision(
      unit,
      destination,
      exemptUnitId
    ) {
      if (!movementIntegrityEnabled()) {
        return { blocked: false, reason: "" };
      }

      for (const other of livingUnits()) {
        if (other.id === unit.id || other.id === exemptUnitId) {
          continue;
        }

        const distance = distanceBetweenPoints(destination, other);

        if (distance < rules.unitSeparation - 0.001) {
          return {
            blocked: true,
            reason:
              `destination would overlap ` +
              `${capitalize(other.faction)} ${other.name}; ` +
              `maintain ${rules.unitSeparation.toFixed(1)}″ separation.`
          };
        }
      }

      return { blocked: false, reason: "" };
    }

    return Object.freeze({
      analyzeMovementPath,
      fitMovementPathToAllowance,
      analyzeMovementSegment,
      analyzeDestinationCollision
    });
  }

  window.CrossroadsMovementRules = Object.freeze({ create });
})();
