"use strict";

(() => {
  function install({
    battlefieldViewport,
    battlefieldSurface,
    camera,
    adaptiveTouchActive,
    cameraCanPan,
    cameraPointFromClient,
    zoomCameraByFactor,
    setBoardZoom,
    applyCameraSurfaceSize,
    suppressGesturesFor
  }) {
    // Desktop wheel zoom, centered on the cursor.
    battlefieldViewport.addEventListener(
      "wheel",
      event => {
        if (event.ctrlKey) return;
        event.preventDefault();

        const viewportPoint = cameraPointFromClient(
          event.clientX,
          event.clientY
        );
        const factor = Math.exp(-event.deltaY * 0.0014);
        zoomCameraByFactor(factor, viewportPoint);
      },
      { passive: false }
    );

    // Desktop click-drag panning.
    let desktopPan = null;

    battlefieldViewport.addEventListener("mousedown", event => {
      if (event.button !== 0) return;

      desktopPan = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: battlefieldViewport.scrollLeft,
        scrollTop: battlefieldViewport.scrollTop,
        moved: false
      };
    });

    window.addEventListener("mousemove", event => {
      if (!desktopPan) return;

      const dx = event.clientX - desktopPan.startX;
      const dy = event.clientY - desktopPan.startY;

      if (!desktopPan.moved && Math.hypot(dx, dy) > 5) {
        desktopPan.moved = true;
        battlefieldViewport.classList.add("camera-dragging");
      }

      if (desktopPan.moved) {
        battlefieldViewport.scrollLeft = desktopPan.scrollLeft - dx;
        battlefieldViewport.scrollTop = desktopPan.scrollTop - dy;
        event.preventDefault();
      }
    });

    window.addEventListener("mouseup", () => {
      if (!desktopPan) return;

      if (desktopPan.moved) suppressGesturesFor(220);

      desktopPan = null;
      battlefieldViewport.classList.remove("camera-dragging");
    });

    // Touch pan, pinch zoom, and double-tap zoom.
    const activePointers = new Map();
    let panGesture = null;
    let pinchGesture = null;
    let lastCameraTap = { time: 0, x: 0, y: 0 };

    function pointerMidpoint(points) {
      return {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      };
    }

    battlefieldViewport.addEventListener("pointerdown", event => {
      if (!adaptiveTouchActive() || event.pointerType === "mouse") return;

      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });

      battlefieldViewport.setPointerCapture?.(event.pointerId);

      if (activePointers.size === 1) {
        panGesture = {
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: battlefieldViewport.scrollLeft,
          scrollTop: battlefieldViewport.scrollTop,
          moved: false
        };
      }

      if (activePointers.size === 2) {
        const points = [...activePointers.values()];
        const midpoint = pointerMidpoint(points);
        const distance = Math.hypot(
          points[1].x - points[0].x,
          points[1].y - points[0].y
        );
        const viewportPoint = cameraPointFromClient(midpoint.x, midpoint.y);

        pinchGesture = {
          startDistance: Math.max(1, distance),
          startZoom: camera.getBoardZoom(),
          worldFocusX:
            (battlefieldViewport.scrollLeft + viewportPoint.x) /
            Math.max(1, battlefieldSurface.offsetWidth),
          worldFocusY:
            (battlefieldViewport.scrollTop + viewportPoint.y) /
            Math.max(1, battlefieldSurface.offsetHeight),
          moved: false
        };

        panGesture = null;
      }
    });

    battlefieldViewport.addEventListener(
      "pointermove",
      event => {
        if (!activePointers.has(event.pointerId)) return;

        activePointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY
        });

        if (activePointers.size >= 2 && pinchGesture) {
          const points = [...activePointers.values()];
          const midpoint = pointerMidpoint(points);
          const viewportPoint = cameraPointFromClient(midpoint.x, midpoint.y);
          const distance = Math.hypot(
            points[1].x - points[0].x,
            points[1].y - points[0].y
          );

          if (Math.abs(distance - pinchGesture.startDistance) > 3) {
            pinchGesture.moved = true;
            document.body.classList.add("camera-panning");
          }

          camera.setZoomImmediate(
            pinchGesture.startZoom *
              distance /
              pinchGesture.startDistance
          );
          applyCameraSurfaceSize();

          battlefieldViewport.scrollLeft =
            pinchGesture.worldFocusX * battlefieldSurface.offsetWidth -
            viewportPoint.x;
          battlefieldViewport.scrollTop =
            pinchGesture.worldFocusY * battlefieldSurface.offsetHeight -
            viewportPoint.y;

          event.preventDefault();
          return;
        }

        if (
          activePointers.size === 1 &&
          panGesture &&
          cameraCanPan()
        ) {
          const dx = event.clientX - panGesture.startX;
          const dy = event.clientY - panGesture.startY;

          if (Math.hypot(dx, dy) > 5) {
            panGesture.moved = true;
            document.body.classList.add("camera-panning");
          }

          if (panGesture.moved) {
            battlefieldViewport.scrollLeft = panGesture.scrollLeft - dx;
            battlefieldViewport.scrollTop = panGesture.scrollTop - dy;
            event.preventDefault();
          }
        }
      },
      { passive: false }
    );

    function endAdaptivePointer(event) {
      const pointer = activePointers.get(event.pointerId);
      const moved = Boolean(panGesture?.moved || pinchGesture?.moved);

      activePointers.delete(event.pointerId);

      if (moved) {
        suppressGesturesFor(320);
      } else if (
        pointer &&
        activePointers.size === 0 &&
        event.pointerType !== "mouse"
      ) {
        const now = Date.now();
        const nearLastTap =
          now - lastCameraTap.time < 310 &&
          Math.hypot(
            event.clientX - lastCameraTap.x,
            event.clientY - lastCameraTap.y
          ) < 34;

        if (nearLastTap) {
          const viewportPoint = cameraPointFromClient(
            event.clientX,
            event.clientY
          );
          const fittedZoom = camera.getFittedZoom();
          const targetZoom =
            camera.getBoardZoom() < Math.max(1.05, fittedZoom * 1.8)
              ? Math.max(1.05, fittedZoom * 2.1)
              : fittedZoom;

          setBoardZoom(targetZoom, { viewportPoint });
          suppressGesturesFor(360);
          lastCameraTap = { time: 0, x: 0, y: 0 };
        } else {
          lastCameraTap = {
            time: now,
            x: event.clientX,
            y: event.clientY
          };
        }
      }

      if (activePointers.size < 2) pinchGesture = null;

      if (activePointers.size === 0) {
        panGesture = null;
        document.body.classList.remove("camera-panning");
      } else if (activePointers.size === 1) {
        const remaining = [...activePointers.values()][0];
        panGesture = {
          startX: remaining.x,
          startY: remaining.y,
          scrollLeft: battlefieldViewport.scrollLeft,
          scrollTop: battlefieldViewport.scrollTop,
          moved: false
        };
      }
    }

    battlefieldViewport.addEventListener("pointerup", endAdaptivePointer);
    battlefieldViewport.addEventListener("pointercancel", endAdaptivePointer);
    battlefieldViewport.addEventListener("lostpointercapture", event => {
      if (activePointers.has(event.pointerId)) endAdaptivePointer(event);
    });

    return Object.freeze({
      activePointerCount: () => activePointers.size
    });
  }

  window.CrossroadsCameraInput = Object.freeze({ install });
})();
