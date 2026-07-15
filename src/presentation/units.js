"use strict";

(() => {
  // Unit markup and authored formations. This module returns HTML only.
  const PRESENTATION = window.CROSSROADS_FORMATIONS;
  if (!PRESENTATION) {
    throw new Error("data/formations.js did not load before units.js.");
  }

  function roleAbbreviation(unit) {
    return PRESENTATION.abbreviations[unit.role] ?? "RIF";
  }

  function unitFacing(unit) {
    const facing = unit?.facing;
    if (["left", "right", "up", "down"].includes(facing)) return facing;
    return unit?.faction === "red" ? "left" : "right";
  }

  function farCounterHtml(unit) {
    return `
      <span class="far-unit-counter" aria-hidden="true">
        <span class="far-counter-top">
          ${qualityStripeHtml(unit)}
          <strong>${roleAbbreviation(unit)}</strong>
        </span>
        <span class="far-counter-bottom">
          <strong>${unit.soldiers}</strong>
          ${unit.pins > 0 ? `<span class="counter-pins">P${unit.pins}</span>` : ""}
        </span>
      </span>
    `;
  }

  function soldierRole(unit, index) {
    if (unit.role === "officer") return index === 0 ? "officer" : "rifle";
    if (unit.role === "support") return index === 0 ? "mmg" : "loader";
    if (unit.role === "assault") {
      const smgCount = unit.weapons?.smg ?? unit.soldiers;
      return index < smgCount ? "smg" : "rifle";
    }

    const lmgCount = unit.weapons?.lmg ?? 0;
    if (lmgCount > 0 && index === 0) return "lmg";
    if (lmgCount > 0 && index === 1) return "loader";
    return "rifle";
  }

  function formationDefinition(unit, deployed = false) {
    if (unit.role === "support") {
      return deployed
        ? PRESENTATION.formations.supportDeployed
        : PRESENTATION.formations.supportPacked;
    }
    return PRESENTATION.formations[unit.role] ?? PRESENTATION.formations.line;
  }

  function formationSlots(unit, deployed = false) {
    return formationDefinition(unit, deployed).slots;
  }

  function formationStyle(unit, deployed = false) {
    const definition = formationDefinition(unit, deployed);
    return [
      `--formation-width:${definition.width}px`,
      `--formation-height:${definition.height}px`,
      `--model-count:${unit.soldiers}`
    ].join(";");
  }

  function weaponKeyForRole(role) {
    if (role === "smg") return "smg";
    if (role === "lmg") return "lmg";
    if (role === "mmg") return "mmg";
    if (role === "officer") return "pistol";
    if (role === "loader" || role === "crew") return null;
    return "rifle";
  }

  function brickSoldierHtml(unit, index, options = {}) {
    const role = options.role ?? soldierRole(unit, index);
    const slots = formationSlots(unit, options.deployed ?? false);
    const slot = options.slot ?? slots[index] ?? [
      20 + (index % 3) * 29,
      34 + Math.floor(index / 3) * 36
    ];
    const extraClass = options.extraClass ? ` ${options.extraClass}` : "";
    const facing = options.facing ?? unitFacing(unit);
    const weaponKey = options.weaponKey ?? weaponKeyForRole(role);

    return `
      <span class="model-wrap formation-slot slot-${index + 1}${extraClass}"
            style="--slot-x:${slot[0]}%;--slot-y:${slot[1]}%"
            aria-hidden="true">
        <span class="model-hit-pad" aria-hidden="true"></span>
        <span class="model-base-ring" aria-hidden="true"></span>
        <span class="model-shadow"></span>
        <span class="model-hop">
          <span class="brick-soldier role-${role} facing-${facing}"
                data-model-index="${index}"
                ${weaponKey ? `data-weapon-key="${weaponKey}"` : ""}>
          <span class="brick-legs"></span>
          <span class="brick-pack"></span>
          <span class="brick-torso"></span>
          <span class="brick-head"></span>
          <span class="brick-helmet"></span>
          <span class="brick-arm"></span>
          <span class="brick-weapon"><span class="weapon-muzzle" aria-hidden="true"></span></span>
          </span>
        </span>
      </span>
    `;
  }

  function roleAscii(unit) {
    if (unit.role === "officer") return "★";
    if (unit.role === "assault") return "SMG";
    if (unit.role === "support") return "MG";
    return "R";
  }

  function orderAscii(unit) {
    if (unit.ambush) return { symbol: "A", label: "AMBUSH", cls: "order-ambush" };
    if (unit.down) return { symbol: "↓", label: "DOWN", cls: "order-down" };

    const map = {
      Fire: { symbol: "✦", label: "FIRE", cls: "order-fire" },
      Run: { symbol: "≫", label: "RUN", cls: "order-run" },
      Advance: { symbol: "›", label: "ADV", cls: "order-advance" },
      Assault: { symbol: "!", label: "ASSAULT", cls: "order-assault" },
      Rally: { symbol: "+", label: "RALLY", cls: "order-rally" },
      Down: { symbol: "↓", label: "DOWN", cls: "order-down" }
    };
    return map[unit.order ?? ""] ?? null;
  }

  function packedMMGFormationHtml(unit) {
    return Array.from(
      { length: Math.max(1, unit.soldiers) },
      (_, index) => brickSoldierHtml(unit, index)
    ).join("");
  }

  function deployedMMGFormationHtml(unit) {
    const crewCount = Math.max(1, unit.soldiers);
    const crewSlots = formationSlots(unit, true);

    const crew = Array.from(
      { length: crewCount },
      (_, index) => `
        <span class="mmg-deployed-crew crew-${index + 1}">
          ${brickSoldierHtml(unit, index, {
            role: "crew",
            slot: crewSlots[index] ?? [50, 50],
            extraClass: "deployed-crew-model",
            deployed: true
          })}
        </span>
      `
    ).join("");

    return `
      <span class="mmg-deployed-formation" style="--mmg-facing:${unit.mmgFacing}deg">
        <span class="mmg-tripod"><i></i><i></i><i></i></span>
        <span class="mmg-receiver"></span>
        <span class="mmg-barrel"><span class="weapon-muzzle" aria-hidden="true"></span></span>
        ${crew}
      </span>
    `;
  }

  function qualityStripeHtml(unit) {
    const count =
      unit.quality === "veteran"
        ? 3
        : unit.quality === "regular"
          ? 2
          : 1;

    return `
      <span class="quality-nameplate-stripes quality-${unit.quality}"
            aria-label="${qualityLabel(unit)}">
        ${Array.from({ length: count }, () => "<i></i>").join("")}
      </span>
    `;
  }

  function pinScatterHtml(unit) {
    if (unit.pins <= 0) return "";
    if (unit.pins >= 5) {
      return `<span class="pin-scatter pin-counted" aria-label="${unit.pins} Pins">×${unit.pins}</span>`;
    }
    return `
      <span class="pin-scatter" aria-label="${unit.pins} Pins">
        ${Array.from({ length: unit.pins }, (_, index) =>
          `<i class="pin-mark pin-position-${index + 1}">×</i>`
        ).join("")}
      </span>
    `;
  }

  function mediumLabelHtml(unit) {
    return `
      <span class="unit-label unit-label-medium">
        ${qualityStripeHtml(unit)}
        <span class="unit-label-name">${roleAbbreviation(unit)}</span>
      </span>
    `;
  }

  function closeLabelHtml(unit) {
    return `
      <span class="unit-label unit-label-close">
        ${qualityStripeHtml(unit)}
        <span class="unit-label-name">${unit.name}</span>
      </span>
    `;
  }


  function unitFormationHtml(unit) {
    const models =
      isMMGTeam(unit)
        ? (
            unit.mmgDeployed
              ? deployedMMGFormationHtml(unit)
              : packedMMGFormationHtml(unit)
          )
        : Array.from(
            { length: Math.max(1, unit.soldiers) },
            (_, index) => brickSoldierHtml(unit, index)
          ).join("");

    const order = orderAscii(unit);
    const stateChits = order
      ? `<span class="ascii-chit physical-order-chit ${order.cls}">
           <b>${order.symbol}</b><span>${order.label}</span>
         </span>`
      : "";

    const stateClass = isMMGTeam(unit)
      ? (unit.mmgDeployed ? " is-mmg-deployed" : " is-mmg-packed")
      : "";

    return `
      <span class="unit-visual-travel">
        <span class="unit-representation unit-representation-far${stateClass}">
          ${farCounterHtml(unit)}
        </span>

        <span class="unit-representation unit-representation-medium${stateClass}">
          <span class="unit-model-group"
                style="${formationStyle(unit, unit.mmgDeployed)}">
            <span class="unit-formation-shell">
              <span class="unit-formation">
                ${models}
              </span>
              ${pinScatterHtml(unit)}
            </span>
          </span>
          ${mediumLabelHtml(unit)}
        </span>

        <span class="unit-representation unit-representation-close${stateClass}">
          <span class="unit-model-group"
                style="${formationStyle(unit, unit.mmgDeployed)}">
            <span class="unit-formation-shell">
              <span class="unit-formation">
                ${models}
              </span>
              ${pinScatterHtml(unit)}
            </span>
          </span>
          ${closeLabelHtml(unit)}
          <span class="unit-state-line">${stateChits}</span>
        </span>
      </span>
    `;
  }

  window.CrossroadsUnitPresentation = Object.freeze({
    farCounterHtml,
    soldierRole,
    formationDefinition,
    formationSlots,
    formationStyle,
    brickSoldierHtml,
    roleAscii,
    orderAscii,
    packedMMGFormationHtml,
    deployedMMGFormationHtml,
    qualityStripeHtml,
    pinScatterHtml,
    weaponKeyForRole,
    roleAbbreviation,
    unitFacing,
    unitFormationHtml
  });
})();
