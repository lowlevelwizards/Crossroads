"use strict";
// Purposeful weapon surfaces: tapered cross-sections and crisp manufactured edges.
// All profiles use local -Z muzzle / +Z stock. The common receiver interfaces
// are the reference for contiguous parts; geometry never uses drifting group scales.
(() => {
  const shared=new WeakMap();
  function create(THREE,S){
    if(shared.has(THREE))return shared.get(THREE);
    const cache=new Map();
    function profileGeometry(rings,sides=8){
      const vertices=[],indices=[];
      for(const [z,rx,ry,cy=0] of rings){
        for(let k=0;k<=sides;k++){
          const a=k*2*Math.PI/sides;
          vertices.push(Math.cos(a)*rx,cy+Math.sin(a)*ry,z);
        }
      }
      for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
        const a=i*(sides+1)+j,b=a+sides+1;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
      for(let side=0;side<2;side++){
        const ring=side===0?0:rings.length-1,point=rings[ring];
        const center=vertices.length/3;vertices.push(0,point[3]||0,point[0]);
        for(let j=0;j<sides;j++){
          const a=ring*(sides+1)+j,b=ring*(sides+1)+(j+1)%sides;
          if(side===0)indices.push(center,a,b);
          else indices.push(center,b,a);
        }
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
      g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
      g.userData.sharedMiniatureGeometry=true;return g;
    }
    function mesh(parent,material,rings,{sides=8,cacheKey}={}){
      // Quantized keys keep identical battle weapon geometry shared.
      const key=cacheKey||JSON.stringify([sides,rings.map(row=>row.map(v=>Math.round(v*1000)/1000))]);
      let geometry=cache.get(key);
      if(!geometry){geometry=profileGeometry(rings,sides);cache.set(key,geometry)}
      return S.mesh(parent,geometry,material);
    }
    function tube(parent,material,zFront,zBack,rx,ry=rx,cy=0,sides=10){
      const z0=Math.min(zFront,zBack),z1=Math.max(zFront,zBack);
      return mesh(parent,material,[
        [z0,rx*.96,ry*.96,cy],[z0+.012,rx,ry,cy],
        [z1-.012,rx,ry,cy],[z1,rx*.96,ry*.96,cy]
      ],{sides});
    }
    function stock(parent,material,{rear,front,thickness=1,style="mauser"}){
      const length=rear-front;
      const curve=style==="bar"?1.09:style==="mg"?.92:1;
      const mid=front+length*.45;
      return mesh(parent,material,[
        [front-.012,.058*thickness,.077*thickness,-.01],
        [front+length*.10,.060*thickness,.075*thickness,-.032],
        [mid,.069*thickness,.083*thickness,-.046],
        [front+length*.70,.093*thickness,.101*thickness*curve,-.052],
        [rear-.013,.108*thickness,.115*thickness*curve,-.062],
        [rear,.104*thickness,.11*thickness*curve,-.062]
      ]);
    }
    function block(parent,mat,[x,y,z],[px,py,pz]){
      return S.box(parent,mat,[x,y,z],[px,py,pz]);
    }
    function taperedFore(parent,mat,front,back,w=.083,h=.071){
      return mesh(parent,mat,[
        [front,w*.83,h*.94,-.014],
        [front+.028,w*.89,h,-.014],
        [back-.03,w,h,-.013],
        [back,w*.99,h,-.013]
      ]);
    }
    function wire(parent,mat,points,r=.018){
      const result=[];
      for(let i=1;i<points.length;i++){
        const a=S.v(...points[i-1]),b=S.v(...points[i]);
        const m=S.loft(parent,mat,"weapon-wire-"+r,[
          [-.5,r,r],[.5,r,r]
        ]);
        S.segment(m,a,b);result.push(m);
      }
      return result;
    }
    const api=Object.freeze({profileGeometry,mesh,tube,stock,block,taperedFore,wire,
      stats:()=>({cachedGeometryCount:cache.size})});
    shared.set(THREE,api);return api;
  }
  window.Crossroads3DWeaponGeometry=Object.freeze({create});
})();