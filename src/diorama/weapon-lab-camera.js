"use strict";
// Lightweight, testable orbit camera for the independent Weapon Lab.
// One pointer orbits; right/middle mouse pans; two touch pointers pan + pinch.
// Camera always orbits a focus point in world space, never the last finger.
(() => {
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const viewAngles=Object.freeze({
    side:[Math.PI/2,Math.PI/2],
    front:[Math.PI,Math.PI/2],
    rear:[0,Math.PI/2],
    three:[Math.PI+.55,1.28],
    top:[Math.PI,.11]
  });
  function create({fov=35,height=600}={}){
    let theta=viewAngles.three[0],polar=viewAngles.three[1],
      radius=2.65,viewHeight=Math.max(1,height);
    let center=[0,-.02,-.34],target=[...center];
    let comparison=false,mounted=false,activeView="three";
    const pointers=new Map();
    const cameraPosition=()=>[
      target[0]+radius*Math.sin(polar)*Math.sin(theta),
      target[1]+radius*Math.cos(polar),
      target[2]+radius*Math.sin(polar)*Math.cos(theta)
    ];
    // Camera's screen-right and screen-up directions, consistent with
    // perspective lookAt and stable even near the top view.
    const screenAxes=()=>({
      right:[Math.cos(theta),0,-Math.sin(theta)],
      up:[-Math.cos(polar)*Math.sin(theta),Math.sin(polar),
        -Math.cos(polar)*Math.cos(theta)]
    });
    function pan(dx,dy){
      if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
      const worldPerPixel=2*radius*Math.tan(fov*Math.PI/360)/viewHeight;
      const {right,up}=screenAxes();
      for(let i=0;i<3;i++)
        target[i]+=(-dx*right[i]+dy*up[i])*worldPerPixel;
    }
    function zoom(factor){
      if(Number.isFinite(factor)&&factor>0)
        radius=clamp(radius*factor,.67,12);
    }
    function focus(){
      center=[0,mounted?.10:-.02,mounted?-.44:-.34];
      radius=comparison?3.55:mounted?2.95:2.65;
      target=[...center];
    }
    function setContext({compare=false,mount=false}={}){
      comparison=!!compare;mounted=!!mount;
      focus();
      // Maintain the orientation when switching weapons/compare modes.
    }
    function view(name){
      if(!viewAngles[name])return false;
      [theta,polar]=viewAngles[name];
      activeView=name;
      target=[...center]; // A named orthographic-style view always re-centers.
      return true;
    }
    function reset(){
      activeView="three";
      [theta,polar]=viewAngles.three;
      focus();
      pointers.clear();
    }
    const midpoint=pair=>[
      (pair[0].x+pair[1].x)/2,(pair[0].y+pair[1].y)/2
    ];
    const distance=pair=>Math.hypot(
      pair[0].x-pair[1].x,pair[0].y-pair[1].y);
    function pointerDown(id,x,y,button=0){
      if(pointers.has(id)||pointers.size>=2)return false;
      pointers.set(id,{x,y,button});
      return true;
    }
    function pointerMove(id,x,y,buttons){
      const previous=pointers.get(id);if(!previous)return false;
      const before=[...pointers.values()];
      pointers.set(id,{...previous,x,y});
      const after=[...pointers.values()];
      if(after.length===1){
        const dx=x-previous.x,dy=y-previous.y;
        if(previous.button===1||previous.button===2||buttons===2)pan(dx,dy);
        else{
          theta-=dx*.008;
          polar=clamp(polar-dy*.007,.08,Math.PI-.08);
          activeView=null;
        }
      }else{
        // Use both pointer positions before and after this event, never
        // just the moving finger. This prevents drifting, jumping and
        // the wrong pan direction during iPhone pinch gestures.
        const start=before.slice(0,2),end=after.slice(0,2);
        const oldDistance=distance(start),newDistance=distance(end);
        if(oldDistance>4&&newDistance>4)zoom(oldDistance/newDistance);
        const oldMid=midpoint(start),newMid=midpoint(end);
        pan(newMid[0]-oldMid[0],newMid[1]-oldMid[1]);
      }
      return true;
    }
    function pointerUp(id){pointers.delete(id)}
    function clearPointers(){pointers.clear()}
    function snapshot(){
      return {theta,polar,radius,target:[...target],
        position:cameraPosition(),activeView,pointerCount:pointers.size};
    }
    return Object.freeze({
      pan,zoom,view,reset,setContext,pointerDown,pointerMove,pointerUp,
      clearPointers,snapshot,setViewportHeight:h=>{viewHeight=Math.max(1,h)}
    });
  }
  window.Crossroads3DWeaponCameraControls=Object.freeze({create,viewAngles});
})();