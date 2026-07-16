"use strict";

(() => {
  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

  const FEEDBACK_CLASSES = Object.freeze([
    "feedback-ambush",
    "feedback-command",
    "feedback-down",
    "feedback-rally"
  ]);

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
      return battlefield.querySelector(
        `.unit[data-unit-id="${CSS.escape(unitId)}"]`
      );
    }

    function visibleUnitParts(root) {
      const visual = root.querySelector(".unit-visual-travel");
      const representation = [...root.querySelectorAll(".unit-representation")]
        .find(element => getComputedStyle(element).display !== "none");

      return {
        visual,
        representation,
        slots: representation
          ? [...representation.querySelectorAll(".formation-slot")]
          : []
      };
    }

    function feedbackLayer(root) {
      return root?.querySelector(".unit-feedback-layer") ?? null;
    }

    async function playFeedbackPulse(root, state, options = {}) {
      const feedback = feedbackLayer(root);
      if (!feedback) return;

      const className = `feedback-${state}`;
      feedback.classList.remove(...FEEDBACK_CLASSES);
      feedback.classList.add(className);

      const animation = feedback.animate(
        [
          { opacity: 0, filter: "brightness(1)" },
          {
            opacity: options.peakOpacity ?? .96,
            filter: "brightness(1.12)",
            offset: options.peakOffset ?? .42
          },
          { opacity: 0, filter: "brightness(1.04)" }
        ],
        {
          duration: options.duration ?? 620,
          easing: options.easing ?? "cubic-bezier(.2,.8,.25,1)"
        }
      );

      try {
        await animation.finished;
      } catch (_) {
        // A rerender can remove the layer while an effect is in flight.
      } finally {
        feedback.classList.remove(className);
      }
    }

    function applyFacing(root, facing) {
      window.CrossroadsFormationGeometry.applyFacing(root, facing);
    }

    function startHopAnimations(slots, duration, options = {}) {
      const animations = [];

      slots.forEach((slot, index) => {
        const hop = slot.querySelector(".model-hop");
        const shadow = slot.querySelector(".model-shadow");
        const delay = Math.min(95, index * 22);
        const hopDuration = 300 + (index % 3) * 34;
        const hopHeight =
          index === 0 && options.heavy ? -4 : -6 - (index % 2);
        const iterations = Math.max(
          1,
          Math.ceil((duration - delay) / hopDuration)
        );

        if (hop) {
          animations.push(
            hop.animate(
              [
                { transform: "translateY(0)" },
                { transform: `translateY(${hopHeight}px)`, offset: .46 },
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
          animations.push(
            shadow.animate(
              [
                { opacity: .78 },
                { opacity: .48, offset: .46 },
                { opacity: .78 }
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

      return animations;
    }

    function settleSlots(slots) {
      for (const slot of slots) {
        const hop = slot.querySelector(".model-hop");
        const shadow = slot.querySelector(".model-shadow");
        hop?.style.removeProperty("transform");
        shadow?.style.removeProperty("transform");
        shadow?.style.removeProperty("opacity");
      }
    }

    async function playMovementPath(
      unitId,
      path,
      totalDistance,
      options = {}
    ) {
      const root = unitElement(unitId);
      if (!root || !Array.isArray(path) || path.length < 2) return;

      const parts = visibleUnitParts(root);
      if (!parts.visual || !parts.representation) return;

      const segmentLengths = [];
      let pathLength = 0;
      for (let index = 1; index < path.length; index += 1) {
        const length = Math.hypot(
          path[index].x - path[index - 1].x,
          path[index].y - path[index - 1].y
        );
        segmentLengths.push(length);
        pathLength += length;
      }

      const totalDuration = Math.round(
        Math.max(740, Math.min(1210, 645 + totalDistance * 46))
      );

      const previousTransition = root.style.transition;
      root.style.transition = "none";

      setBusy(1);
      root.classList.add("presentation-moving");

      try {
        for (let index = 1; index < path.length; index += 1) {
          const to = path[index];
          const facing = options.facings?.[index - 1] ?? null;
          applyFacing(root, facing);

          if (index > 1 && facing) await sleep(55);

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

          parts.visual.style.transform =
            `translate3d(${inverse.x.toFixed(2)}px, ${inverse.y.toFixed(2)}px, 0)`;
          void parts.visual.offsetWidth;

          const share =
            pathLength > 0
              ? segmentLengths[index - 1] / pathLength
              : 1 / (path.length - 1);
          const duration = Math.max(
            260,
            Math.round(totalDuration * share)
          );

          const travel = parts.visual.animate(
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

          const localAnimations =
            startHopAnimations(parts.slots, duration, options);

          try {
            await travel.finished;
          } finally {
            travel.cancel();
            localAnimations.forEach(animation => animation.cancel());
            settleSlots(parts.slots);
            parts.visual.style.transform = "";
          }
        }
      } finally {
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
      setTimeout(
        () => muzzle.classList.remove("muzzle-pulse"),
        pulseDuration(key) + 20
      );
    }

    async function playFire(unitId, groups) {
      const root = unitElement(unitId);
      if (!root) return;

      setBusy(1);
      try {
        await sleep(220);
        const jobs = [];
        let groupStart = 0;

        const visible = visibleUnitParts(root);
        const firingSurface = visible.representation ?? root;

        for (const group of groups ?? []) {
          const key = group.key;
          let muzzles = [
            ...firingSurface.querySelectorAll(
              `[data-weapon-key="${CSS.escape(key)}"] .weapon-muzzle`
            )
          ];

          if (key === "mmg") {
            const deployed = firingSurface.querySelector(
              ".mmg-barrel .weapon-muzzle"
            );
            if (deployed) muzzles = [deployed];
          }

          if (!muzzles.length) continue;

          const shots = Math.max(1, group.shots ?? 1);
          const modelCount = Math.max(
            1,
            Math.min(muzzles.length, group.models ?? muzzles.length)
          );
          const interval = shotInterval(key);

          for (let shot = 0; shot < shots; shot += 1) {
            const muzzle = muzzles[shot % modelCount];
            const volley = Math.floor(shot / modelCount);
            const delay =
              groupStart + (shot % modelCount) * 100 + volley * interval;
            jobs.push(
              new Promise(resolve => {
                setTimeout(() => {
                  flash(muzzle, key);
                  setTimeout(resolve, pulseDuration(key) + 15);
                }, delay);
              })
            );
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
      const rootLeft =
        root?.style.left || `${(unit.x / tableWidth) * 100}%`;
      const rootTop =
        root?.style.top || `${(unit.y / tableHeight) * 100}%`;

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

    async function playRally(unitId) {
      const root = unitElement(unitId);
      if (!root) return;

      setBusy(1);
      try {
        const visible = visibleUnitParts(root);
        const pinSurface = visible.representation ?? root;
        const pins = [
          ...pinSurface.querySelectorAll(".pin-mark, .pin-counted")
        ];
        const animations = pins.map((pin, index) =>
          pin.animate(
            [
              { transform: "translateY(0) scale(1)", opacity: 1 },
              {
                transform: `translateY(${-14 - index * 2}px) scale(.78)`,
                opacity: 0
              }
            ],
            {
              duration: 360,
              delay: index * 34,
              easing: "cubic-bezier(.2,.7,.25,1)",
              fill: "forwards"
            }
          )
        );

        await Promise.all(
          animations.map(animation => animation.finished.catch(() => {}))
        );
        pins.forEach(pin => {
          pin.style.visibility = "hidden";
        });

        await playFeedbackPulse(root, "rally", {
          duration: 500,
          peakOpacity: .94,
          easing: "ease-out"
        });
      } finally {
        setBusy(-1);
      }
    }

    function playCommandPulse(officerId, supportedUnitIds = []) {
      const officer = unitElement(officerId);
      officer?.querySelector(".command-ring")?.animate(
        [
          { opacity: .35, filter: "brightness(1)" },
          { opacity: .82, filter: "brightness(1.28)" },
          { opacity: .38, filter: "brightness(1)" }
        ],
        { duration: 620, easing: "ease-out" }
      );

      for (const unitId of supportedUnitIds) {
        const root = unitElement(unitId);
        if (!root) continue;
        void playFeedbackPulse(root, "command", {
          duration: 680,
          peakOpacity: 1,
          easing: "ease-out"
        });
      }
    }

    function playStatePulse(unitId, state) {
      const root = unitElement(unitId);
      if (!root) return Promise.resolve();
      return playFeedbackPulse(root, state);
    }

    return Object.freeze({
      playMovementPath,
      playFire,
      playCasualtyPuffs,
      playRally,
      playCommandPulse,
      playStatePulse,
      isBusy
    });
  }

  window.CrossroadsPresentationEffects = Object.freeze({ create });
})();
