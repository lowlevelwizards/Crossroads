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
      history:[],
      future:[],
      drag:null,
      pan:null,
      drawingPath:null,
      drawingPatch:null,
      drawingCursor:null,
      targetPickerObjectiveId:null,
      issues:[],
      showGrid:true,
      showTerrain:true,
      showLinear:true,
      showUnits:true,
      showUnitLabels:true,
      showObjectives:true,
      showFootprints:false,
      showZones:true,
      snap:true,
      objectFilter:"",
      collapsedGroups:{},
      spacePressed:false,
      status:"Source loaded",
      ...initial
    };
  }

  window.CrossroadsEditorState = Object.freeze({ create });
})();
