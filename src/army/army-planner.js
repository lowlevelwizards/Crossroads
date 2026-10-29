"use strict";
// Draft force lists, not a substitute for licensed Third Edition selectors.
(() => {
  const clone=entry=>({id:String(entry.id||""),unitType:String(entry.unitType||""),
    quality:String(entry.quality||"regular"),name:String(entry.name||"")});
  const known=["inexperienced","regular","veteran"];
  function validate(roster,types=window.CROSSROADS_UNIT_TYPES||{}){
    const errors=[];
    if(!roster||!["blue","red"].includes(roster.faction))errors.push("Choose a faction");
    if(!Array.isArray(roster?.units)||roster.units.length>50)
      errors.push("Roster must contain 0–50 units");
    const ids=new Set();
    for(const item of roster?.units||[]){
      if(!types[item.unitType])errors.push("Unknown unit type "+item.unitType);
      if(!known.includes(item.quality))errors.push("Unknown quality "+item.quality);
      if(ids.has(item.id))errors.push("Duplicate roster ID "+item.id);
      ids.add(item.id);
    }
    return {valid:errors.length===0,errors};
  }
  function load(data,types=window.CROSSROADS_UNIT_TYPES||{}){
    const source=typeof data==="string"?JSON.parse(data):data;
    const roster={schemaVersion:1,faction:source.faction,
      name:String(source.name||"Untitled force").slice(0,80),
      units:(source.units||[]).map(clone)};
    const result=validate(roster,types);
    if(!result.valid)throw Error(result.errors.join("; "));
    return roster;
  }
  window.CrossroadsArmyDraft=Object.freeze({validate,load,qualities:known});
})();