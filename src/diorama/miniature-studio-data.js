"use strict";
// Catalogue is derived from authoritative unit and faction kit registries.
(() => {
  const units=()=>Object.entries(window.CROSSROADS_UNIT_TYPES||{}).map(([id,unit])=>
    Object.freeze({id,label:unit.name,count:unit.soldiers,role:unit.role}));
  const kits=()=>Object.entries(window.CROSSROADS_FACTION_KITS?.kits||{}).map(([id,kit])=>
    Object.freeze({id,label:kit.label,faction:kit.factionId}));
  function buildUnit(unitId,kitId){
    const type=window.CROSSROADS_UNIT_TYPES?.[unitId];
    const kit=window.CROSSROADS_FACTION_KITS?.kits?.[kitId];
    if(!type||!kit)throw Error("Unknown miniature catalogue selection");
    return {id:kitId+":"+unitId,type:unitId,kitId,
      faction:kit.factionId==="germany"?"red":"blue",
      name:type.name,soldiers:type.soldiers,role:type.role,
      weapons:{...type.weapons}};
  }
  function soldier(unitId,kitId,index){
    const unit=buildUnit(unitId,kitId);
    if(!Number.isInteger(index)||index<0||index>=unit.soldiers)
      throw RangeError("Soldier is outside unit roster");
    return window.CrossroadsMiniaturePresentation.resolveModelRecipe(unit,index);
  }
  window.Crossroads3DStudioCatalog=Object.freeze({units,kits,buildUnit,soldier});
})();
