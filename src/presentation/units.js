"use strict";

(() => {
  // Unit-level LOD, labels, counters, and formation assembly. Individual model
  // recipes and shape-built markup live in miniatures.js.
  const PRESENTATION = window.CROSSROADS_FORMATIONS;
  const MINIATURES = window.CrossroadsMiniaturePresentation;
  const UNIT_TYPES = window.CROSSROADS_UNIT_TYPES;
  const UNIT_QUALITY = window.CROSSROADS_UNIT_QUALITY;

  if (!PRESENTATION) {
    throw new Error("data/formations.js did not load before units.js.");
  }
  if (!MINIATURES) {
    throw new Error("src/presentation/miniatures.js did not load before units.js.");
  }
  if (!UNIT_TYPES || !UNIT_QUALITY) {
    throw new Error("Unit type and quality data must load before units.js.");
  }

  const {
    soldierRole,
    weaponKeyForRole,
    unitFacing,
    brickSoldierHtml,
    packedMMGFormationHtml,
    deployedMMGFormationHtml
  } = MINIATURES;

  function qualityLabel(unit) {
    return UNIT_QUALITY[unit?.quality]?.label ?? "Regular";
  }

  function isSupportTeam(unit) {
    return unit?.role === "support";
  }

  function roleAbbreviation(unit) {
    return UNIT_TYPES[unit?.type]?.short ?? ({
      officer: "HQ",
      line: "RIF",
      assault: "SMG",
      support: "MMG"
    }[unit?.role] ?? "RIF");
  }

  function formationDefinition(unit, deployed = false) {
    if (isSupportTeam(unit)) {
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

    return `
      <span class="ascii-chit physical-order-chit ${order.cls} detail-${detail}"
            aria-label="${order.short}">
        <b>${order.symbol}</b>${detail === "close" ? `<span>${order.short}</span>` : ""}
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

    const order = (options.showOrder ?? true) ? orderPresentation(unit) : null;
    const orderLabel = order
      ? `<span class="nameplate-order ${order.cls}" aria-label="${order.short}">
           <b>${order.symbol}</b>
           ${detail === "close" || detail === "building" ? `<span>${order.short}</span>` : ""}
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

  function qualityStripeHtml(unit) {
    const count = unit.quality === "veteran" ? 3 : unit.quality === "regular" ? 2 : 1;
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

  function formationModelsHtml(unit) {
    const deployed = Boolean(unit.mmgDeployed && isSupportTeam(unit));
    const slots = formationSlots(unit, deployed);

    if (isSupportTeam(unit)) {
      return deployed
        ? deployedMMGFormationHtml(unit, slots)
        : packedMMGFormationHtml(unit, slots);
    }

    return Array.from(
      { length: Math.max(1, unit.soldiers) },
      (_, index) => brickSoldierHtml(unit, index, {
        slot: slots[index] ?? [50, 50]
      })
    ).join("");
  }

  function unitFormationHtml(unit) {
    const models = formationModelsHtml(unit);
    const farOrderChit = orderChitHtml(unit, "far");
    const stateClass = isSupportTeam(unit)
      ? (unit.mmgDeployed ? " is-mmg-deployed" : " is-mmg-packed")
      : "";
    const style = formationStyle(unit, unit.mmgDeployed);

    return `
      <span class="unit-visual-travel">
        <span class="unit-feedback-layer" aria-hidden="true"></span>
        <span class="unit-representation unit-representation-far${stateClass}">
          ${farCounterHtml(unit)}
          <span class="unit-state-line unit-state-line-far">${farOrderChit}</span>
        </span>

        <span class="unit-representation unit-representation-medium${stateClass}">
          <span class="unit-model-group" style="${style}">
            <span class="unit-formation-shell">
              <span class="unit-formation">${models}</span>
              ${pinScatterHtml(unit)}
            </span>
          </span>
          ${unitNameplateHtml(unit, { detail: "medium" })}
        </span>

        <span class="unit-representation unit-representation-close${stateClass}">
          <span class="unit-model-group" style="${style}">
            <span class="unit-formation-shell">
              <span class="unit-formation">${models}</span>
              ${pinScatterHtml(unit)}
            </span>
          </span>
          ${unitNameplateHtml(unit, { detail: "close" })}
        </span>
      </span>
    `;
  }

  // Preserve the established public API while delegating individual miniature
  // concerns to CrossroadsMiniaturePresentation.
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
