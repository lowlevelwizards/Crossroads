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

    function clearCommittedMovementOverlay() {
      document.getElementById("routeLayer")?.replaceChildren();

      for (const id of [
        "waypointMarker",
        "ghostToken",
        "ambushPreviewDot",
        "traceLine",
        "traceLabel"
      ]) {
        const element = document.getElementById(id);
        if (!element) continue;
        element.hidden = true;
        if (id === "ghostToken") element.textContent = "";
      }
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

    function reducedMotionPreferred() {
      return Boolean(
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      );
    }

    async function playUnitHop(unitId, options = {}) {
      if (reducedMotionPreferred()) return;

      const root = unitElement(unitId);
      if (!root) return;

      const { representation, slots } = visibleUnitParts(root);
      const duration = options.duration ?? 340;
      const height = Math.max(2, options.height ?? 5);
      const stagger = Math.max(0, options.stagger ?? 10);
      const baseDelay = Math.max(0, options.delay ?? 0);
      const animations = [];

      if (slots.length === 0) {
        const counter = representation?.querySelector(".far-unit-counter");
        if (!counter) return;

        const animation = counter.animate(
          [
            { translate: "0 0" },
            { translate: `0 -${height}px`, offset: .46 },
            { translate: "0 0" }
          ],
          {
            duration,
            delay: baseDelay,
            iterations: 1,
            easing: "cubic-bezier(.28,0,.32,1)"
          }
        );
        await animation.finished.catch(() => {});
        return;
      }

      slots.forEach((slot, index) => {
        const hop = slot.querySelector(".model-hop");
        const shadow = slot.querySelector(".model-shadow");
        const delay = baseDelay + index * stagger;
        const localHeight = height + (index % 2);

        if (hop) {
          animations.push(
            hop.animate(
              [
                { transform: "translateY(0)" },
                { transform: `translateY(-${localHeight}px)`, offset: .46 },
                { transform: "translateY(0)" }
              ],
              {
                duration,
                delay,
                iterations: 1,
                easing: "cubic-bezier(.28,0,.32,1)"
              }
            )
          );
        }

        if (shadow) {
          animations.push(
            shadow.animate(
              [
                { opacity: .78 },
                { opacity: .5, offset: .46 },
                { opacity: .78 }
              ],
              {
                duration,
                delay,
                iterations: 1,
                easing: "cubic-bezier(.28,0,.32,1)"
              }
            )
          );
        }
      });

      await Promise.all(
        animations.map(animation => animation.finished.catch(() => {}))
      );
      settleSlots(slots);
    }

    async function visuallyPackMMGBeforeMovement(root, unitId) {
      const visible = visibleUnitParts(root);
      const deployed = visible.representation?.querySelector(
        ".mmg-deployed-formation"
      );
      if (!deployed) return;

      const collapse = deployed.animate(
        [
          { opacity: 1, filter: "brightness(1)" },
          { opacity: .12, filter: "brightness(.78)" }
        ],
        {
          duration: 170,
          easing: "cubic-bezier(.35,0,.55,1)",
          fill: "forwards"
        }
      );
      await collapse.finished.catch(() => {});
      collapse.cancel();

      const unit = window.InfantryCore?.state.units
        ?.find(candidate => candidate.id === unitId);
      const presentation = window.CrossroadsUnitPresentation;
      if (!unit || !presentation) return;

      const packedUnit = { ...unit, mmgDeployed: false };
      root.querySelectorAll(".unit-representation.is-mmg-deployed")
        .forEach(representation => {
          representation.classList.remove("is-mmg-deployed");
          representation.classList.add("is-mmg-packed");

          const group = representation.querySelector(".unit-model-group");
          const formation = representation.querySelector(".unit-formation");
          if (group) {
            group.setAttribute(
              "style",
              presentation.formationStyle(packedUnit, false)
            );
          }
          if (formation) {
            formation.innerHTML =
              presentation.packedMMGFormationHtml(packedUnit);
          }
        });

      await new Promise(requestAnimationFrame);
      await sleep(55);
    }

    function playEligibilityHop() {
      if (reducedMotionPreferred()) return;

      const roots = [...battlefield.querySelectorAll(".unit.eligible-current")];
      roots.forEach((root, unitIndex) => {
        void playUnitHop(root.dataset.unitId, {
          delay: unitIndex * 42,
          duration: 340,
          height: 4,
          stagger: 8
        });
      });
    }

    async function playMovementPath(
      unitId,
      path,
      totalDistance,
      options = {}
    ) {
      clearCommittedMovementOverlay();

      const root = unitElement(unitId);
      if (!root || !Array.isArray(path) || path.length < 2) return;

      const previousTransition = root.style.transition;
      root.style.transition = "none";

      setBusy(1);
      document.body.classList.add("movement-resolving");
      root.classList.add("presentation-moving");

      try {
        await visuallyPackMMGBeforeMovement(root, unitId);

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
        document.body.classList.remove("movement-resolving");
        clearCommittedMovementOverlay();
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

        await Promise.all([
          playFeedbackPulse(root, "rally", {
            duration: 500,
            peakOpacity: .94,
            easing: "ease-out"
          }),
          playUnitHop(unitId, {
            duration: 410,
            height: 6,
            stagger: 9
          })
        ]);
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

    const unitStateById = new Map();
    let unitStateFrame = 0;

    function syncUnitStateFeedback() {
      const next = new Map();

      for (const root of battlefield.querySelectorAll(".unit[data-unit-id]")) {
        const unitId = root.dataset.unitId;
        const state = {
          selected: root.classList.contains("selected"),
          ambush: root.classList.contains("ambush"),
          down: root.classList.contains("down")
        };
        const previous = unitStateById.get(unitId);
        next.set(unitId, state);

        if (!previous) continue;

        if (!previous.selected && state.selected) {
          void playUnitHop(unitId, {
            duration: 330,
            height: 5,
            stagger: 8
          });
        }

        if (!previous.down && state.down) {
          void Promise.all([
            playFeedbackPulse(root, "down", {
              duration: 520,
              peakOpacity: .92
            }),
            playUnitHop(unitId, {
              duration: 380,
              height: 5,
              stagger: 9
            })
          ]);
        } else if (!previous.ambush && state.ambush) {
          void Promise.all([
            playFeedbackPulse(root, "ambush", {
              duration: 540,
              peakOpacity: .94
            }),
            playUnitHop(unitId, {
              duration: 390,
              height: 5,
              stagger: 9
            })
          ]);
        }
      }

      unitStateById.clear();
      next.forEach((state, unitId) => unitStateById.set(unitId, state));
    }

    new MutationObserver(() => {
      cancelAnimationFrame(unitStateFrame);
      unitStateFrame = requestAnimationFrame(syncUnitStateFeedback);
    }).observe(battlefield, {
      childList: true
    });

    const ORDER_TONES = Object.freeze([
      ["run", /(?:^|\s)Run(?:\s|·|$)/i],
      ["advance", /(?:^|\s)(?:Advance|Adv)(?:\s|·|$)/i],
      ["fire", /(?:^|\s)Fire(?:\s|$)/i],
      ["assault", /(?:^|\s)(?:Assault|Charge)(?:\s|·|$)/i],
      ["ambush", /(?:^|\s)(?:Ambush|Amb)(?:\s|$)/i],
      ["down", /(?:^|\s)Down(?:\s|$)/i],
      ["rally", /(?:^|\s)Rally(?:\s|·|$)/i]
    ]);

    function tagOrderTone(button) {
      const desktopOrder = button.dataset.order;
      if (desktopOrder) {
        button.dataset.orderTone = desktopOrder.toLowerCase();
        return;
      }

      const label = button.textContent.trim();
      const match = ORDER_TONES.find(([, pattern]) => pattern.test(label));
      if (match) button.dataset.orderTone = match[0];
      else delete button.dataset.orderTone;
    }

    function syncOrderToneButtons() {
      document
        .querySelectorAll(".orderButton[data-order], #mobileCommandActions button")
        .forEach(tagOrderTone);
    }

    syncOrderToneButtons();
    const mobileCommandActions = document.getElementById("mobileCommandActions");
    if (mobileCommandActions) {
      new MutationObserver(syncOrderToneButtons).observe(mobileCommandActions, {
        childList: true
      });
    }

    const drawnDie = document.getElementById("drawnDie");
    let eligibilityFrame = 0;
    if (drawnDie) {
      new MutationObserver(() => {
        if (!/Order Die$/.test(drawnDie.textContent.trim())) return;
        cancelAnimationFrame(eligibilityFrame);
        eligibilityFrame = requestAnimationFrame(playEligibilityHop);
      }).observe(drawnDie, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    const reactionPanel = document.getElementById("reactionPanel");
    if (reactionPanel) {
      new MutationObserver(() => {
        if (!reactionPanel.hidden) clearCommittedMovementOverlay();
      }).observe(reactionPanel, {
        attributes: true,
        attributeFilter: ["hidden"]
      });
    }

    return Object.freeze({
      playMovementPath,
      playEligibilityHop,
      playUnitHop,
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
