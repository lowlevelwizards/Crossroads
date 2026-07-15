"use strict";

(() => {
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }

  function create({ battlefield, tableWidth, tableHeight, renderUnits }) {
    const movements = new Map();
    const casualties = new Map();
    let busyCount = 0;
    let casualtySequence = 0;

    function setBusy(delta) {
      busyCount = Math.max(0, busyCount + delta);
      document.body.classList.toggle("presentation-busy", busyCount > 0);
    }

    function isBusy() {
      return busyCount > 0;
    }

    function queueMovement(unitId, from, to, distance) {
      const duration = Math.round(Math.max(1000, Math.min(1700, 950 + distance * 55)));
      movements.set(unitId, {
        from: { ...from },
        to: { ...to },
        duration,
        started: false
      });
      return duration;
    }

    function decorateUnitElement(element, unit) {
      const movement = movements.get(unit.id);
      if (!movement) return;

      const pixelsPerInch = Math.max(1, battlefield.offsetWidth) / tableWidth;
      const dx = (movement.from.x - movement.to.x) * pixelsPerInch;
      const dy = (movement.from.y - movement.to.y) * pixelsPerInch;

      element.classList.add("presentation-moving");
      element.style.setProperty("--movement-from-x", `${dx.toFixed(2)}px`);
      element.style.setProperty("--movement-from-y", `${dy.toFixed(2)}px`);
      element.style.setProperty("--movement-duration", `${movement.duration}ms`);

      element.querySelectorAll(".formation-slot").forEach((slot, index) => {
        slot.style.setProperty("--hop-delay", `${(index * 73) % 290}ms`);
        slot.style.setProperty("--hop-duration", `${310 + (index % 3) * 55}ms`);
        if (index === 0 && unit.role === "support") {
          slot.style.setProperty("--hop-height", "-3px");
        } else {
          slot.style.setProperty("--hop-height", `${-4 - (index % 2)}px`);
        }
      });
    }

    async function playMovement(unitId) {
      const movement = movements.get(unitId);
      if (!movement) return;
      setBusy(1);
      try {
        await new Promise(requestAnimationFrame);
        const element = battlefield.querySelector(`.unit[data-unit-id="${CSS.escape(unitId)}"]`);
        if (!element) {
          await sleep(movement.duration);
          return;
        }
        movement.started = true;
        element.classList.add("presentation-moving-active");
        await sleep(movement.duration + 60);
      } finally {
        movements.delete(unitId);
        setBusy(-1);
        renderUnits({ reason: "movement-presentation-complete" });
      }
    }

    function weaponPulseInterval(key) {
      if (key === "mmg") return 70;
      if (key === "lmg") return 78;
      if (key === "smg") return 92;
      return 110;
    }

    function flashMuzzle(muzzle) {
      if (!muzzle) return;
      muzzle.classList.remove("muzzle-pulse");
      void muzzle.offsetWidth;
      muzzle.classList.add("muzzle-pulse");
      setTimeout(() => muzzle.classList.remove("muzzle-pulse"), 100);
    }

    async function playFire(unitId, groups) {
      setBusy(1);
      try {
        await sleep(160);
        const root = battlefield.querySelector(`.unit[data-unit-id="${CSS.escape(unitId)}"]`);
        if (!root) return;

        const jobs = [];
        let groupOffset = 0;

        for (const group of groups ?? []) {
          const key = group.key;
          const candidates = [
            ...root.querySelectorAll(`[data-weapon-key="${CSS.escape(key)}"] .weapon-muzzle`)
          ];
          if (key === "mmg") {
            const deployed = root.querySelector(".mmg-barrel .weapon-muzzle");
            if (deployed) candidates.splice(0, candidates.length, deployed);
          }
          if (!candidates.length) continue;

          const shots = Math.max(1, group.shots ?? 1);
          const models = Math.max(1, Math.min(candidates.length, group.models ?? candidates.length));
          const interval = weaponPulseInterval(key);

          for (let shot = 0; shot < shots; shot++) {
            const muzzle = candidates[shot % models];
            const delay = groupOffset + (shot % models) * 58 + Math.floor(shot / models) * interval;
            jobs.push(new Promise(resolve => {
              setTimeout(() => {
                flashMuzzle(muzzle);
                setTimeout(resolve, 115);
              }, delay);
            }));
          }
          groupOffset += 45;
        }

        if (jobs.length) await Promise.all(jobs);
      } finally {
        setBusy(-1);
      }
    }

    function recordCasualties(unit, descriptors) {
      if (!unit || !descriptors?.length) return;
      const list = casualties.get(unit.id) ?? [];
      for (const descriptor of descriptors.slice(0, Math.max(0, 3 - list.length))) {
        list.push({
          id: `casualty-${++casualtySequence}`,
          unitId: unit.id,
          faction: unit.faction,
          type: unit.type,
          role: descriptor.role,
          weaponKey: descriptor.weaponKey,
          slot: descriptor.slot,
          facing: unit.facing,
          x: unit.x,
          y: unit.y,
          createdRound: descriptor.round ?? 0,
          fading: false
        });
      }
      casualties.set(unit.id, list);
    }

    function casualtyRecords() {
      return [...casualties.values()].flat();
    }

    async function clearCasualtiesForUnit(unitId) {
      const list = casualties.get(unitId);
      if (!list?.length) return;
      for (const record of list) record.fading = true;
      renderUnits({ reason: "casualty-fade" });
      await sleep(340);
      casualties.delete(unitId);
      renderUnits({ reason: "casualty-clear" });
    }

    function clearDestroyedCasualties(activeUnitIds) {
      const active = new Set(activeUnitIds);
      for (const [unitId] of casualties) {
        if (!active.has(unitId)) casualties.delete(unitId);
      }
    }

    return Object.freeze({
      queueMovement,
      decorateUnitElement,
      playMovement,
      playFire,
      recordCasualties,
      casualtyRecords,
      clearCasualtiesForUnit,
      clearDestroyedCasualties,
      isBusy
    });
  }

  window.CrossroadsPresentationEffects = Object.freeze({ create });
})();
