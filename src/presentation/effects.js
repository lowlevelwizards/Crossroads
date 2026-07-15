"use strict";

(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

  function create({ battlefield, tableWidth, tableHeight }) {
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
        Math.max(875, Math.min(1425, 760 + distance * 54))
      );

      const previousTransition = root.style.transition;
      root.style.transition = "none";

      const startRect = root.getBoundingClientRect();
      root.style.left = `${(to.x / tableWidth) * 100}%`;
      root.style.top = `${(to.y / tableHeight) * 100}%`;
      void root.offsetWidth;

      const endRect = root.getBoundingClientRect();
      const inverse =
        window.CrossroadsFormationGeometry.screenDeltaBetweenRects(
          startRect,
          endRect
        );

      visual.style.transform =
        `translate3d(${inverse.x.toFixed(2)}px, ${inverse.y.toFixed(2)}px, 0)`;
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
          easing: "cubic-bezier(.30,.05,.70,.95)",
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
        const delay = Math.min(120, index * 28);
        const hopDuration = 340 + (index % 3) * 38;
        const hopHeight =
          index === 0 && options.heavy ? -4 : -6 - (index % 2);
        const iterations = Math.max(
          1,
          Math.ceil((duration - delay) / hopDuration)
        );

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
                iterations,
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
                iterations,
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

        for (const slot of slots) {
          const hop = slot.querySelector(".model-hop");
          const shadow = slot.querySelector(".model-shadow");
          if (hop) hop.style.transform = "translateY(0)";
          if (shadow) {
            shadow.style.transform = "translateX(-50%) scale(1)";
            shadow.style.opacity = "";
          }
        }

        visual.style.transform = "";
        root.classList.remove("presentation-moving");
        root.style.transition = previousTransition;
        setBusy(-1);
      }
    }

    function pulseDuration(key) {
      if (key === "mmg") return 222;
      if (key === "lmg") return 210;
      if (key === "smg") return 204;
      return 228;
    }

    function shotInterval(key) {
      if (key === "mmg") return 174;
      if (key === "lmg") return 186;
      if (key === "smg") return 204;
      return 252;
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
            const delay = groupStart + (shot % modelCount) * 100 + volley * interval;
            jobs.push(new Promise(resolve => {
              setTimeout(() => {
                flash(muzzle, key);
                setTimeout(resolve, pulseDuration(key) + 15);
              }, delay);
            }));
          }
          groupStart += 90;
        }

        if (jobs.length) await Promise.all(jobs);
      } finally {
        setBusy(-1);
      }
    }

    function playCasualtyPuffs(unit, descriptors = []) {
      if (!unit || !descriptors.length) return;

      const root = unitElement(unit.id);
      const rootLeft = root?.style.left || `${(unit.x / tableWidth) * 100}%`;
      const rootTop = root?.style.top || `${(unit.y / tableHeight) * 100}%`;

      descriptors.slice(0, 4).forEach((descriptor, index) => {
        const puff = document.createElement("span");
        puff.className = "casualty-puff";
        puff.style.left = rootLeft;
        puff.style.top = rootTop;

        const slot = descriptor.slot ?? [50, 50];
        const localX = (slot[0] - 50) * .45 + (index % 2 ? 3 : -3);
        const localY = (slot[1] - 50) * .38 + Math.floor(index / 2) * 3;
        puff.style.setProperty("--puff-x", `${localX.toFixed(1)}px`);
        puff.style.setProperty("--puff-y", `${localY.toFixed(1)}px`);
        puff.innerHTML = "<i></i><i></i><i></i>";
        battlefield.appendChild(puff);
        setTimeout(() => puff.remove(), 520);
      });
    }

    return Object.freeze({
      playMovement,
      playFire,
      playCasualtyPuffs,
      isBusy
    });
  }

  window.CrossroadsPresentationEffects = Object.freeze({ create });
})();
