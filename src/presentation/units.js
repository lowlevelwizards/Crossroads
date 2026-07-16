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

  const ORDER_PRESENTATION = Object.freeze({
    Fire: Object.freeze({ symbol: "✦", short: "FIRE", cls: "order-fire" }),
    Run: Object.freeze({ symbol: "≫", short: "RUN", cls: "order-run" }),
    Advance: Object.freeze({ symbol: "›", short: "ADV", cls: "order-advance" }),
    Assault: Object.freeze({ symbol: "!", short: "ASLT", cls: "order-assault" }),
    Rally: Object.freeze({ symbol: "+", short: "RALLY", cls: "order-rally" }),
    Ambush: Object.freeze({ symbol: "A", short: "AMB", cls: "order-ambush" }),
    Down: Object.freeze({ symbol: "↓", short: "DOWN", cls: "order-down" })
  });

  function orderPresentation(unitOrOrder) {
    if (typeof unitOrOrder === "string") {
      return ORDER_PRESENTATION[unitOrOrder] ?? null;
    }

    const unit = unitOrOrder;
    if (!unit) return null;
    if (unit.ambush) return ORDER_PRESENTATION.Ambush;
    if (unit.down) return ORDER_PRESENTATION.Down;

    const raw = String(unit.order ?? "").split(" · ")[0];
    if (raw === "Ambush Fired") return ORDER_PRESENTATION.Fire;
    if (raw === "MMG Deployed") return ORDER_PRESENTATION.Fire;
    return ORDER_PRESENTATION[raw] ?? null;
  }

  function orderChitHtml(unit, detail = "close") {
    const order = orderPresentation(unit);
    if (!order) return "";

    const label =
      detail === "close"
        ? `<span>${order.short}</span>`
        : "";

    return `
      <span class="ascii-chit physical-order-chit ${order.cls} detail-${detail}"
            aria-label="${order.short}">
        <b>${order.symbol}</b>${label}
      </span>
    `;
  }

  function unitNameplateHtml(unit, options = {}) {
    const detail = options.detail ?? "close";
    const name =
      options.name ??
      (detail === "medium" ? roleAbbreviation(unit) : unit.name);

    const stats = [];
    if (options.showMen) {
      stats.push(`<span class="nameplate-men">♟${unit.soldiers}</span>`);
    }
    if (options.showPins && unit.pins > 0) {
      stats.push(`<span class="nameplate-pins">P${unit.pins}</span>`);
    }

    const showOrder = options.showOrder ?? true;
    const order = showOrder ? orderPresentation(unit) : null;
    const orderLabel =
      order
        ? `<span class="nameplate-order ${order.cls}"
                 aria-label="${order.short}">
             <b>${order.symbol}</b>
             ${detail === "close" || detail === "building"
               ? `<span>${order.short}</span>`
               : ""}
           </span>`
        : "";

    return `
      <span class="unit-label unit-label-${detail}">
        ${qualityStripeHtml(unit)}
        <span class="unit-label-name">${name}</span>
        ${stats.length ? `<span class="unit-label-stats">${stats.join("")}</span>` : ""}
        ${orderLabel}
      </span>
    `;
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

    const farOrderChit = orderChitHtml(unit, "far");

    const stateClass = isMMGTeam(unit)
      ? (unit.mmgDeployed ? " is-mmg-deployed" : " is-mmg-packed")
      : "";

    return `
      <span class="unit-visual-travel">
        <span class="unit-feedback-layer" aria-hidden="true"></span>
        <span class="unit-representation unit-representation-far${stateClass}">
          ${farCounterHtml(unit)}
          <span class="unit-state-line unit-state-line-far">${farOrderChit}</span>
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
          ${unitNameplateHtml(unit, { detail: "medium" })}
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
          ${unitNameplateHtml(unit, { detail: "close" })}
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
    ORDER_PRESENTATION,
    orderPresentation,
    orderChitHtml,
    unitNameplateHtml,
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
