"use strict";

window.CROSSROADS_UNIT_QUALITY = Object.freeze({
  inexperienced: Object.freeze({
    id: "inexperienced", label: "Inexperienced", short: "INEXP",
    morale: 8, shootingTargetModifier: 1, assaultDamageTarget: 5
  }),
  regular: Object.freeze({
    id: "regular", label: "Regular", short: "REG",
    morale: 9, shootingTargetModifier: 0, assaultDamageTarget: 4
  }),
  veteran: Object.freeze({
    id: "veteran", label: "Veteran", short: "VET",
    morale: 10, shootingTargetModifier: -1, assaultDamageTarget: 3
  })
});
