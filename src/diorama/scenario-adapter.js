"use strict";

// 3D presentation reads authored scenario data and normalized 2D terrain.
// This module does not resolve rules, choose collisions, or mutate scenarios.
(() => {
  const scenarios=window.CROSSROADS_SCENARIOS;
  const geometry=window.CrossroadsTerrainGeometry;
  const bridge=window.CrossroadsDioramaBridge;
  const definitions=window.CROSSROADS_TERRAIN_TYPES;
  if(!scenarios||!geometry||!bridge||!definitions)
    throw new Error("3D scenario adapter: missing existing scenario, geometry or kit modules");

  function loadScenario(key="hold_the_farm") {
    const scenario=scenarios[key];
    if(!scenario)throw new Error("Unknown Crossroads scenario: "+key);
    if(scenario.table.width!==bridge.table.width||scenario.table.height!==bridge.table.height)
      throw new Error("3D scene requires the shared 72 x 48 inch board");

    const instances=geometry.setActiveScenario(scenario);
    const discrete=instances.filter(item=>item.sourceKind==="terrain");
    const extra=instances.filter(item=>item.sourceKind!=="terrain");
    const ids=new Set();
    for(const item of instances) {
      if(ids.has(item.id))throw new Error("Duplicate terrain id "+item.id);
      ids.add(item.id);
      if(!item.definition||!item.rules)throw new Error("Invalid normalized terrain "+item.id);
      if(![item.x,item.y,item.width,item.height].every(Number.isFinite)
        ||item.width<=0||item.height<=0)
        throw new Error("Bad terrain bounds "+item.id);
    }
    const entries=Object.freeze(discrete.map(item=>Object.freeze({
      id:item.id,terrainId:item.terrainId,
      renderer:item.definition.renderer,
      rulesRect:Object.freeze({x:item.x,y:item.y,width:item.width,height:item.height}),
      visualRect:item.visualRect,
      rotation:item.rotation,
      appearance:item.appearance||item.definition.presentation?.defaultAppearance||null,
      normalized:item
    })));
    const objectives=Object.freeze((scenario.objectives||[]).map(x=>Object.freeze({...x})));
    return Object.freeze({
      scenario,entries,normalized:Object.freeze([...instances]),
      auxiliary:Object.freeze(extra),objectives,
      forces:scenario.forces,
      summary:Object.freeze({
        scenarioId:scenario.id,sceneryCount:entries.length,
        unitCount:Object.values(scenario.forces).reduce((n,a)=>n+a.length,0),
        objectiveCount:objectives.length
      })
    });
  }
  function boundsWorld(rect) {
    const at=bridge.toWorld({x:rect.x+rect.width/2,y:rect.y+rect.height/2});
    return {x:at.x,z:at.z,width:rect.width*bridge.table.worldUnitsPerInch,
      depth:rect.height*bridge.table.worldUnitsPerInch};
  }
  window.Crossroads3DScenarioAdapter=Object.freeze({loadScenario,boundsWorld});
})();