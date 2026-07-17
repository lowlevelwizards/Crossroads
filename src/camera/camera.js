"use strict";
(() => {
  const W=1080,H=720,MIN=.18,MAX=4.5,DELAY=125;
  function create({battlefieldViewport:v,battlefieldSurface:s,zoomReadout:z,clamp,onViewChanged=()=>{},onTransformChanged=()=>{},onViewSettled=onViewChanged}){
    let zoom=1,fit=1,turns=0,manual=false,mx=180,my=180,ox=0,oy=0,vw=W,vh=H,timer=0;
    const narrow=()=>matchMedia("(max-width: 820px)").matches||(matchMedia("(pointer: coarse)").matches&&innerWidth<=1180);
    const portrait=()=>narrow()&&innerHeight>innerWidth;
    const rotated=()=>Math.abs(turns%2)===1;
    function syncAutomaticCameraRotation(){if(!manual)turns=portrait()?1:0;}
    function syncCameraViewportBox(){if(!v)return;if(narrow()){v.style.removeProperty("--desktop-camera-height");v.style.removeProperty("height");return;}const r=v.getBoundingClientRect();const h=Math.max(320,innerHeight-Math.max(r.top,0)-14);v.style.setProperty("--desktop-camera-height",`${h}px`);v.style.height=`${h}px`;}
    function viewport(){syncCameraViewportBox();const r=v?.getBoundingClientRect();return{width:r?Math.max(1,Math.min(v.clientWidth,innerWidth-Math.max(r.left,0))):innerWidth,height:r?Math.max(1,Math.min(v.clientHeight,innerHeight-Math.max(r.top,0)-14)):innerHeight};}
    function calculateFitZoom(){const q=viewport(),bw=rotated()?H:W,bh=rotated()?W:H;return clamp(Math.min(q.width/bw,q.height/bh),MIN,MAX);}
    function recalculateFitZoom(){fit=calculateFitZoom();return fit;}
    const relative=()=>fit>0?zoom/fit:1;
    function snapshot(){return Object.freeze({zoom,fittedZoom:fit,relativeZoom:relative(),rotated:rotated()});}
    function updateCameraDetailLevel(){const r=relative(),m=clamp(.90+Math.max(0,r-.82)*.48,.90,1.82);document.documentElement.style.setProperty("--camera-relative-zoom",r.toFixed(3));document.documentElement.style.setProperty("--miniature-scale",m.toFixed(3));document.body.classList.toggle("camera-far",r<.82);document.body.classList.toggle("camera-normal",r>=.82&&r<1.65);document.body.classList.toggle("camera-close",r>=1.65);document.body.classList.toggle("camera-inspection",r>=2.25);document.body.classList.toggle("camera-rotated",rotated());}
    function readout(){const r=relative(),f=Math.abs(r-1)<.015;if(z)z.textContent=f?"FIT":`${Math.round(r*100)}%`;document.body.classList.toggle("fit-table-active",f);}
    function apply(){if(!s)return;const q=viewport();vw=(rotated()?H:W)*zoom;vh=(rotated()?W:H)*zoom;mx=Math.max(150,q.width*.58);my=Math.max(150,q.height*.58);ox=mx;oy=my;const sw=vw+mx*2,sh=vh+my*2;s.style.setProperty("--camera-width",`${sw}px`);s.style.setProperty("--camera-height",`${sh}px`);s.style.setProperty("--board-left",`${ox}px`);s.style.setProperty("--board-top",`${oy}px`);s.style.setProperty("--board-width",`${W}px`);s.style.setProperty("--board-height",`${H}px`);s.style.setProperty("--board-transform-origin","0 0");s.style.setProperty("--board-transform",rotated()?`translateX(${H*zoom}px) rotate(90deg) scale(${zoom})`:`scale(${zoom})`);Object.assign(s.style,{width:`${sw}px`,height:`${sh}px`,minWidth:`${sw}px`,minHeight:`${sh}px`,flex:"0 0 auto"});readout();onTransformChanged(snapshot());}
    function applyCameraSurfaceSize(){fit=calculateFitZoom();apply();updateCameraDetailLevel();}
    function settle(){clearTimeout(timer);document.body.classList.add("camera-transforming");timer=setTimeout(()=>{document.body.classList.remove("camera-transforming");updateCameraDetailLevel();onViewSettled(snapshot());},DELAY);}
    function cameraPointFromClient(x,y){const r=v.getBoundingClientRect();return{x:x-r.left,y:y-r.top};}
    function setZoomImmediate(n){const f=fit||calculateFitZoom();zoom=clamp(n,Math.max(MIN,f*.45),Math.min(MAX,f*8));return zoom;}
    function setBoardZoom(n,o={}){if(!v||!s)return;const p=o.viewportPoint??{x:v.clientWidth/2,y:v.clientHeight/2},ow=Math.max(1,s.offsetWidth),oh=Math.max(1,s.offsetHeight),fx=(v.scrollLeft+p.x)/ow,fy=(v.scrollTop+p.y)/oh;fit=calculateFitZoom();setZoomImmediate(n);apply();requestAnimationFrame(()=>{v.scrollLeft=fx*s.offsetWidth-p.x;v.scrollTop=fy*s.offsetHeight-p.y;});settle();}
    function centerTable(o={}){v.scrollTo({left:ox+vw/2-v.clientWidth/2,top:oy+vh/2-v.clientHeight/2,behavior:o.instant?"auto":"smooth"});}
    function fitTable(){syncAutomaticCameraRotation();syncCameraViewportBox();requestAnimationFrame(()=>{fit=calculateFitZoom();zoom=fit;apply();updateCameraDetailLevel();requestAnimationFrame(()=>centerTable({instant:true}));onViewSettled(snapshot());});}
    function zoomCameraByFactor(f,p=null){setBoardZoom(zoom*f,{viewportPoint:p??{x:v.clientWidth/2,y:v.clientHeight/2}});}
    function rotateBoard(){manual=true;turns=turns===0?1:0;applyCameraSurfaceSize();requestAnimationFrame(()=>centerTable({instant:true}));onViewSettled(snapshot());}
    function tablePointToSurfacePixels(p){const x=p.x*(W*zoom/72),y=p.y*(W*zoom/72),bh=H*zoom;return rotated()?{x:ox+bh-y,y:oy+x}:{x:ox+x,y:oy+y};}
    function frameTablePoint(p,o={}){if(!p||!v||!s)return;const q=tablePointToSurfacePixels(p),m=o.margin??72,l=v.scrollLeft,t=v.scrollTop,r=l+v.clientWidth,b=t+v.clientHeight;let nl=l,nt=t;if(q.x<l+m)nl=q.x-m;else if(q.x>r-m)nl=q.x-v.clientWidth+m;if(q.y<t+m)nt=q.y-m;else if(q.y>b-m)nt=q.y-v.clientHeight+m;v.scrollTo({left:Math.max(0,nl),top:Math.max(0,nt),behavior:o.instant?"auto":"smooth"});}
    return Object.freeze({narrowBoardLayout:narrow,adaptivePortrait:portrait,syncAutomaticCameraRotation,cameraIsRotated:rotated,syncCameraViewportBox,cameraViewportSize:viewport,calculateFitZoom,recalculateFitZoom,updateCameraDetailLevel,applyCameraSurfaceSize,cameraPointFromClient,setBoardZoom,setZoomImmediate,centerTable,fitTable,zoomCameraByFactor,rotateBoard,cameraCanPan:()=>true,tablePointToSurfacePixels,frameTablePoint,getBoardZoom:()=>zoom,getFittedZoom:()=>fit});
  }
  window.CrossroadsCamera=Object.freeze({create});
})();
