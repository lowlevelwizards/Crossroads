"use strict";
// Physical silhouette definitions: 1939-era historical families.
// Visual only. Authoritative range, damage and order rules are elsewhere.
(() => {
  const defs=Object.freeze({
    wz29:{nation:"poland",name:"wz.29 / wz.98a",family:"bolt",stock:"mauser",
      receiver:.235,fore:.365,barrel:.395,butt:.45,wood:0x7b5740,
      note:"Polish short Mauser pattern; narrow stock wrist and exposed bolt"},
    kar98k:{nation:"germany",name:"Kar98k",family:"bolt",stock:"mauser",
      receiver:.23,fore:.365,barrel:.35,butt:.43,wood:0x76543a,
      note:"Mauser carbine: swept-down bolt, continuous wooden fore-end"},
    wz28:{nation:"poland",name:"Browning wz.28",family:"bar",stock:"bar",
      receiver:.31,fore:.32,barrel:.47,butt:.39,wood:0x785137,
      note:"BAR-derived receiver, bottom box feed, pistol grip and bipod"},
    mg34:{nation:"germany",name:"MG34",family:"mg",stock:"mg",
      receiver:.32,fore:.15,barrel:.69,butt:.29,wood:0x684a33,
      note:"Compact rear butt, pistol grip, left-side feed and barrel jacket"},
    mp38:{nation:"germany",name:"MP38",family:"mp",stock:"folding",
      receiver:.37,fore:.08,barrel:.32,butt:.30,wood:0x3a4240,
      note:"Tubular receiver, vertical magazine and folded/unfolded wire stock"},
    mors39:{nation:"poland",name:"Mors wz.39 prototype",family:"mors",
      receiver:.32,fore:.18,barrel:.35,butt:.34,wood:0x73533d,
      note:"Rare Polish experimental SMG with wooden stock and vertical box feed"},
    pistol:{nation:"both",name:"Officer pistol",family:"pistol",stock:"grip",
      receiver:.22,fore:0,barrel:.10,butt:0,wood:0x5c483c,
      note:"Compact slide, barrel and angled pistol grip"}
  });
  const fields=Object.freeze({
    length:{min:.74,max:1.20,default:.96,label:"Overall silhouette length"},
    stock:{min:.77,max:1.38,default:1.09,label:"Stock thickness"},
    receiver:{min:.77,max:1.38,default:1.1,label:"Receiver mass"},
    barrel:{min:.77,max:1.50,default:1.17,label:"Barrel diameter"},
    magazine:{min:.73,max:1.38,default:1.06,label:"Magazine size"},
    stockLength:{min:.72,max:1.28,default:1,label:"Buttstock length"},
    receiverLength:{min:.8,max:1.2,default:1,label:"Receiver length"},
    foreEndLength:{min:.76,max:1.32,default:1,label:"Fore-end length"},
    barrelLength:{min:.68,max:1.35,default:1,label:"Exposed barrel length"},
    exaggeration:{min:.84,max:1.3,default:1.08,label:"Heroic silhouette"}
  });
  const controls=Object.freeze({
    bolt:["length","stockLength","stock","receiverLength","receiver","foreEndLength","barrelLength","barrel","exaggeration"],
    bar:["length","stockLength","stock","receiver","foreEndLength","barrelLength","barrel","magazine","exaggeration"],
    mg:["length","stockLength","stock","receiver","barrelLength","barrel","magazine","exaggeration"],
    mp:["length","stockLength","receiver","barrelLength","barrel","magazine","exaggeration"],
    mors:["length","stockLength","stock","receiver","barrelLength","barrel","magazine","exaggeration"],
    pistol:["length","stock","receiver","barrel","exaggeration"]
  });
  window.Crossroads3DWeaponArchetypes=Object.freeze({defs,fields,controls,
    kinds:Object.freeze(Object.keys(defs))});
})();