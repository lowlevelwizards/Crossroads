"use strict";

(() => {
  function create(initial = {}) {
    return {
      sourceScenarioId:"mokra",
      sourceDocument:null,
      document:null,
      selection:null,
      selectionSet:[],
      clipboard:null,
      marquee:null,
      zoom:1,
      viewportGeometry:null,
      history:[],
      future:[],
      drag:null,
      pan:null,
      placement:null,
      pointEdit:null,
      scaleSession:null,
      keyboardTransform:null,
      drawingPath:null,
      drawingPatch:null,
      drawingCursor:null,
      targetPickerObjectiveId:null,
      issues:[],
      showGrid:true,
      showPatches:true,
      showObjects:true,
      showLinear:true,
      showUnits:true,
      showUnitLabels:true,
      showObjectives:true,
      showFootprints:false,
      showZones:true,
      snap:true,
      objectFilter:"",
      assetFilter:"",
      assetCategory:"all",
      collapsedGroups:{},
      spacePressed:false,
      status:"Source loaded",
      ...initial
    };
  }

  window.CrossroadsEditorState = Object.freeze({ create });
})();
