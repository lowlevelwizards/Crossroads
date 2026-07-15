"use strict";

(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

  function create({ battlefield, tableWidth, tableHeight, renderUnits }) {
    const casualties = new Map();
    let casualtySequence = 0;
    let busyCount = 0;

    function setBusy(delta) {
      busyCount = Math.max(0, busyCount + delta);
      document.body.classList.toggle("presentation-busy", busyCount > 0);
    }

    function isBusy() {
      return busyCount > 0;
    }

    function unitElement(unitId) {
      return battlefield.querySelector(`.unit[data-unit-id="${CSS.escape(unitId)}"]`);
    }

    async function playMovement(unitId, from, to, distance, options = {}) {
      const root = unitElement(unitId);
      if (!root) return;

      const visual = root.querySelector(".unit-visual-travel");
      const visibleRepresentation = [
        ...root.querySelectorAll(".unit-representation")
      ].find(element => getComputedStyle(element).display !== "none");

      if (!visual || !visibleRepresentation) return;

      const duration = Math.round(
        Math.max(1200, Math.min(1950, 1080 + distance * 72))
      );

      const previousTransition = root.style.transition;
      root.style.transition = "none";

      const startRect = root.getBoundingClientRect();
      root.style.left = `${(to.x / tableWidth) * 100}%`;
      root.style.top = `${(to.y / tableHeight) * 100}%`;

      // Ensure the anchor has reached its final layout position before measuring.
      void root.offsetWidth;

      const endRect = root.getBoundingClientRect();
      const inverse =
        window.CrossroadsFormationGeometry.screenDeltaBetweenRects(
          startRect,
          endRect
        );

      visual.style.transform =
        `translate3d(${inverse.x.toFixed(2)}px, ${inverse.y.toFixed(2)}px, 0)`;

      // Paint the exact old screen position before starting travel and hops.
      void visual.offsetWidth;

      setBusy(1);
      root.classList.add("presentation-moving");

      const travel = visual.animate(
        [
          {
            transform:
              `translate3d(${inverse.x.toFixed(2)}px, ${inverse.y.toFixed(2)}px, 0)`
          },
          { transform: "translate3d(0, 0, 0)" }
        ],
        {
          duration,
          easing: "cubic-bezier(.18,.68,.24,1)",
          fill: "forwards"
        }
      );

      const localAnimations = [];
      const slots = [
        ...visibleRepresentation.querySelectorAll(".formation-slot")
      ];

      slots.forEach((slot, index) => {
        const hop = slot.querySelector(".model-hop");
        const shadow = slot.querySelector(".model-shadow");
        const delay = Math.min(160, index * 34);
        const hopDuration = 350 + (index % 3) * 42;
        const hopHeight =
          index === 0 && options.heavy ? -4 : -6 - (index % 2);

        if (hop) {
          localAnimations.push(
            hop.animate(
              [
                { transform: "translateY(0)" },
                {
                  transform: `translateY(${hopHeight}px)`,
                  offset: .46
                },
                { transform: "translateY(0)" }
              ],
              {
                duration: hopDuration,
                delay,
                iterations: Infinity,
                easing: "cubic-bezier(.35,0,.35,1)"
              }
            )
          );
        }

        if (shadow) {
          localAnimations.push(
            shadow.animate(
              [
                {
                  transform: "translateX(-50%) scale(1)",
                  opacity: .78
                },
                {
                  transform: "translateX(-50%) scale(.72)",
                  opacity: .48,
                  offset: .46
                },
                {
                  transform: "translateX(-50%) scale(1)",
                  opacity: .78
                }
              ],
              {
                duration: hopDuration,
                delay,
                iterations: Infinity,
                easing: "cubic-bezier(.35,0,.35,1)"
              }
            )
          );
        }
      });

      try {
        await travel.finished;
      } finally {
        travel.cancel();
        localAnimations.forEach(animation => animation.cancel());
        visual.style.transform = "";
        root.classList.remove("presentation-moving");
        root.style.transition = previousTransition;
        setBusy(-1);
      }
    }

    function pulseDuration(key) {
      if (key === "mmg") return 185;
      if (key === "lmg") return 175;
      if (key === "smg") return 170;
      return 190;
    }

    function shotInterval(key) {
      if (key === "mmg") return 145;
      if (key === "lmg") return 155;
      if (key === "smg") return 170;
      return 210;
    }

    function flash(muzzle, key) {
      if (!muzzle) return;
      muzzle.classList.remove("muzzle-pulse");
      void muzzle.offsetWidth;
      muzzle.style.setProperty("--muzzle-duration", `${pulseDuration(key)}ms`);
      muzzle.classList.add("muzzle-pulse");
      setTimeout(() => muzzle.classList.remove("muzzle-pulse"), pulseDuration(key) + 20);
    }

    async function playFire(unitId, groups) {
      const root = unitElement(unitId);
      if (!root) return;

      setBusy(1);
      try {
        await sleep(220);
        const jobs = [];
        let groupStart = 0;

        for (const group of groups ?? []) {
          const key = group.key;
          let muzzles = [
            ...root.querySelectorAll(`[data-weapon-key="${CSS.escape(key)}"] .weapon-muzzle`)
          ];

          if (key === "mmg") {
            const deployed = root.querySelector(".mmg-barrel .weapon-muzzle");
            if (deployed) muzzles = [deployed];
          }

          if (!muzzles.length) continue;

          const shots = Math.max(1, group.shots ?? 1);
          const modelCount = Math.max(1, Math.min(muzzles.length, group.models ?? muzzles.length));
          const interval = shotInterval(key);

          for (let shot = 0; shot < shots; shot += 1) {
            const muzzle = muzzles[shot % modelCount];
            const volley = Math.floor(shot / modelCount);
            const delay = groupStart + (shot % modelCount) * 85 + volley * interval;
            jobs.push(new Promise(resolve => {
              setTimeout(() => {
                flash(muzzle, key);
                setTimeout(resolve, pulseDuration(key) + 15);
              }, delay);
            }));
          }
          groupStart += 75;
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
