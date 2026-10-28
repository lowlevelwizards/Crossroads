"use strict";
(() => {
  // World-space units: the live rules always operate in physical game inches.
  // Keep game footprints separate from the painted miniature's shape.
  const worldUnitsPerInch = .30;
  const inches = n => n*worldUnitsPerInch;
  const model = Object.freeze({
    infantryBaseDiameter: inches(1.04),  // 25–26 mm heroic infantry base
    infantryStandingHeight: inches(2.1), // painted figure incl. base
    wallVisibleThickness: inches(.72),
    wallVisibleHeight: inches(1.22),
    wallCapThickness: inches(.89),
    farmhouseEaveHeight: inches(2.40),
    farmhouseRidgeHeight: inches(3.72),
    barnEaveHeight: inches(2.72)
  });
  function wallDimensions(rect) {
    const alongX = rect.width >= rect.depth;
    return Object.freeze({
      length: alongX ? rect.width : rect.depth,
      rulesWidth: alongX ? rect.depth : rect.width,
      visibleThickness: Math.min(model.wallVisibleThickness, (alongX ? rect.depth : rect.width)*.34),
      height: model.wallVisibleHeight,
      alongX
    });
  }
  function houseDimensions(rect, bays=6) {
    const length=Math.max(rect.width,rect.depth);
    const depth=Math.min(rect.width,rect.depth);
    return Object.freeze({
      length,depth,bays,
      bayWidth:length/bays,
      eaveHeight:model.farmhouseEaveHeight,
      ridgeHeight:model.farmhouseRidgeHeight,
      roofRise:model.farmhouseRidgeHeight-model.farmhouseEaveHeight
    });
  }
  window.Crossroads3DScale = Object.freeze({worldUnitsPerInch,inches,model,wallDimensions,houseDimensions});
})();