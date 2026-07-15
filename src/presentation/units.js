"use strict";

(() => {
  // Foundation 3D: pure unit markup and formation builders.
  // This module reads unit data and returns HTML; it does not mutate battle state
  // or attach battlefield interaction handlers.

function farCounterHtml(unit) {
      return `
        <span class="far-unit-counter" aria-hidden="true">
          <span class="far-counter-top">
            ${qualityStripeHtml(unit)}
            <strong>${roleAscii(unit)}</strong>
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
      if (unit.role === "assault") return "smg";

      const lmgCount = unit.weapons?.lmg ?? 0;
      if (lmgCount > 0 && index === 0) return "lmg";
      if (lmgCount > 0 && index === 1) return "loader";
      return "rifle";
    }

function formationSlots(unit) {
      const presets = {
        officer: [[38,44],[63,58]],
        support: [[50,34],[32,66],[68,66]],
        assault: [[25,35],[50,35],[75,35],[25,70],[50,70],[75,70]],
        line: [[25,35],[50,35],[75,35],[25,70],[50,70],[75,70]]
      };
      return presets[unit.role] ?? presets.line;
    }

function brickSoldierHtml(unit, index) {
      const role = soldierRole(unit, index);
      const slots = formationSlots(unit);
      const slot = slots[index] ?? [20 + (index % 3) * 29, 34 + Math.floor(index / 3) * 36];
      return `
        <span class="model-wrap formation-slot slot-${index + 1}" style="--slot-x:${slot[0]}%;--slot-y:${slot[1]}%" aria-hidden="true">
          <span class="model-shadow"></span>
          <span class="brick-soldier role-${role}">
            <span class="brick-legs"></span>
            <span class="brick-pack"></span>
            <span class="brick-torso"></span>
            <span class="brick-head"></span>
            <span class="brick-helmet"></span>
            <span class="brick-arm"></span>
            <span class="brick-weapon"></span>
          </span>
        </span>
      `;
    }

function pinScatterHtml(unit) {
      if (unit.pins <= 0) return "";

      const visiblePins = Math.min(unit.pins, 4);
      const markers = Array.from(
        { length: visiblePins },
        () => `<span class="pin-x">×</span>`
      ).join("");

      const count =
        unit.pins > 4
          ? `<span class="pin-count">×${unit.pins}</span>`
          : "";

      return `<span class="pin-scatter" aria-label="${unit.pins} Pins">${markers}${count}</span>`;
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

      const order = unit.order ?? "";
      const map = {
        Fire: { symbol: "✦", label: "FIRE", cls: "order-fire" },
        Run: { symbol: "≫", label: "RUN", cls: "order-run" },
        Advance: { symbol: "›", label: "ADV", cls: "order-advance" },
        Assault: { symbol: "!", label: "ASSAULT", cls: "order-assault" },
        Rally: { symbol: "+", label: "RALLY", cls: "order-rally" },
        Down: { symbol: "↓", label: "DOWN", cls: "order-down" }
      };
      return map[order] ?? null;
    }

function packedMMGFormationHtml(unit) {
      return Array.from(
        { length: Math.max(1, unit.soldiers) },
        (_, index) => brickSoldierHtml(unit, index)
      ).join("");
    }

function deployedMMGFormationHtml(unit) {
      const visibleCrew = Math.max(1, unit.soldiers);
      const crew = Array.from(
        { length: visibleCrew },
        (_, index) => `<span class="mmg-deployed-crew crew-${index + 1}">${brickSoldierHtml(unit, index)}</span>`
      ).join("");

      return `
        <span class="mmg-deployed-formation" style="--mmg-facing:${unit.mmgFacing}deg">
          <span class="mmg-tripod"><i></i><i></i><i></i></span>
          <span class="mmg-receiver"></span>
          <span class="mmg-barrel"></span>
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
        <span class="quality-nameplate-stripes quality-${unit.quality}" aria-label="${qualityLabel(unit)}">
          ${Array.from({ length: count }, () => "<i></i>").join("")}
        </span>
      `;
    }

function compactPinHtml(unit) {
      if (unit.pins <= 0) return "";
      const visible = "×".repeat(Math.min(unit.pins, 4));
      const overflow = unit.pins > 4 ? `+${unit.pins - 4}` : "";
      return `<span class="unit-nameplate-pins" aria-label="${unit.pins} Pins">${visible}${overflow}</span>`;
    }

function unitFormationHtml(unit) {
      const models =
        isMMGTeam(unit)
          ? (unit.mmgDeployed
              ? deployedMMGFormationHtml(unit)
              : packedMMGFormationHtml(unit))
          : Array.from(
              { length: Math.max(1, unit.soldiers) },
              (_, index) => brickSoldierHtml(unit, index)
            ).join("");

      const order = orderAscii(unit);
      const stateChits = [
        order
          ? `<span class="ascii-chit physical-order-chit ${order.cls}"><b>${order.symbol}</b><span>${order.label}</span></span>`
          : ""
      ].filter(Boolean).join("");

      return `
        <span class="unit-representation unit-representation-far">
          ${farCounterHtml(unit)}
        </span>
        <span class="unit-representation unit-representation-medium">
          <span class="unit-formation" style="--model-count:${unit.soldiers}">
            ${models}
          </span>
          <span class="unit-label">
            ${qualityStripeHtml(unit)}
            <span class="unit-label-name">${unit.name}</span>
          </span>
        </span>
        <span class="unit-representation unit-representation-close">
          <span class="unit-formation" style="--model-count:${unit.soldiers}">
            ${models}
          </span>
          <span class="unit-label">
            ${qualityStripeHtml(unit)}
            <span class="unit-label-name">${unit.name}</span>
          </span>
          ${compactPinHtml(unit)}
          <span class="unit-state-line">${stateChits}</span>
        </span>
      `;
    }

  window.CrossroadsUnitPresentation = Object.freeze({
    farCounterHtml,
    soldierRole,
    formationSlots,
    brickSoldierHtml,
    pinScatterHtml,
    roleAscii,
    orderAscii,
    packedMMGFormationHtml,
    deployedMMGFormationHtml,
    qualityStripeHtml,
    compactPinHtml,
    unitFormationHtml
  });
})();
