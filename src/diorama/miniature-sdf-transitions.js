"use strict";
// Baked implicit forms for the helmet and for *articulated* cloth transitions.
// Helmets are a true one-piece smooth union. Elbow/knee joints use a small
// shared SDF-baked sleeve bridging two separately animated limb segments:
// this preserves joint flexibility without CPU voxel remeshing per frame.
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smoothMin=(a,b,k)=>{
    const h=Math.max(k-Math.abs(a-b),0)/k;
    return Math.min(a,b)-h*h*k*.25;
  };
  const ellipsoid=(p,center,r)=>{
    const x=(p[0]-center[0])/r[0],
      y=(p[1]-center[1])/r[1],z=(p[2]-center[2])/r[2];
    return (Math.hypot(x,y,z)-1)*Math.min(...r);
  };
  const tetra=[
    [0,5,1,6],[0,1,2,6],[0,2,3,6],
    [0,3,7,6],[0,7,4,6],[0,4,5,6]
  ];
  const corners=[
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ];
  // Edged dome fused directly into its low-profile brim. Never create an
  // overlapping separate brim mesh with a different normal field.
  const helmetField=(p,faction)=>{
    const german=faction==="germany";
    const domeRadius=german?[.256,.248,.273]:[.253,.245,.262];
    const dome=ellipsoid(p,[0,.295,.016],domeRadius);
    // Trim the lower dome; otherwise an invisible sphere bottom overlaps
    // the face and makes a green bowl around the nose/ears.
    // A softened lower cut avoids the abrupt normal discontinuity that
    // produced dark triangles and a serrated lip at close inspection.
    const clipped=-smoothMin(-dome,p[1]-.228,.018);
    const brim=ellipsoid(p,[0,.239,-.024],
      german?[.294,.057,.298]:[.283,.050,.283]);
    return smoothMin(clipped,brim,.043);
  };
  const jointField=(p,kind)=>{
    const knee=kind==="knee",
      top=knee?[.114,.102,.115]:[.073,.081,.074],
      low=knee?[.101,.099,.100]:[.069,.077,.069];
    const upper=ellipsoid(p,[0,knee?.052:.041,0],top);
    const lower=ellipsoid(p,[0,knee?-.055:-.042,0],low);
    return smoothMin(upper,lower,knee?.054:.032);
  };
  function bake(THREE,field,bounds,resolution=16){
    // Marching tetrahedra. Resolution is intentionally bounded: these are
    // tiny tabletop parts, not heavy sculpting meshes.
    resolution=clamp(Math.round(resolution),10,30);
    const [lo,hi]=bounds;
    const size=hi.map((v,i)=>v-lo[i]),max=Math.max(...size);
    const counts=size.map(v=>Math.max(3,Math.round(v/max*resolution)));
    const spacing=size.map((v,i)=>v/counts[i]);
    const vertices=[],normals=[];
    const scalar=(point)=>field(point);
    const grad=(p)=>{
      const e=Math.min(...spacing)*.3;
      const d=[0,1,2].map(i=>{
        const a=p.slice(),b=p.slice();a[i]+=e;b[i]-=e;
        return scalar(a)-scalar(b);
      });
      const magnitude=Math.hypot(...d)||1;
      return d.map(x=>x/magnitude);
    };
    const lerp=(a,b,da,db)=>{
      const t=clamp(da/(da-db||1e-9),0,1);
      return a.map((v,i)=>v+(b[i]-v)*t);
    };
    const emit=(a,b,c)=>{
      const cross=[
        (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
        (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
        (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
      ];
      const middle=a.map((v,i)=>(v+b[i]+c[i])/3);
      const normal=grad(middle);
      if(cross.reduce((s,v,i)=>s+v*normal[i],0)<0)[b,c]=[c,b];
      for(const p of [a,b,c])vertices.push(...p),normals.push(...grad(p));
    };
    for(let x=0;x<counts[0];x++)
      for(let y=0;y<counts[1];y++)
        for(let z=0;z<counts[2];z++){
          const points=corners.map(([a,b,c])=>[
            lo[0]+(x+a)*spacing[0],
            lo[1]+(y+b)*spacing[1],
            lo[2]+(z+c)*spacing[2]]);
          const values=points.map(scalar);
          if(values.every(v=>v>=0)||values.every(v=>v<0))continue;
          for(const t of tetra){
            const inside=t.filter(i=>values[i]<0),
              outside=t.filter(i=>values[i]>=0);
            if(!inside.length||inside.length===4)continue;
            const edge=(a,b)=>lerp(points[a],points[b],values[a],values[b]);
            if(inside.length===1){
              const a=inside[0];emit(...outside.map(b=>edge(a,b)));
            }else if(inside.length===3){
              const b=outside[0];emit(...inside.map(a=>edge(a,b)));
            }else{
              const [a,b]=inside,[c,d]=outside,
                ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);
              emit(ac,ad,bc);emit(ad,bd,bc);
            }
          }
        }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
    geometry.computeBoundingSphere();
    geometry.userData={sdfBaked:true,sharedMiniatureGeometry:true,
      triangleCount:vertices.length/9};
    return geometry;
  }
  function create(THREE,S){
    const helmet=(parent,mat,faction)=>{
      const geometry=S.cached("sdf-helmet-v3-"+faction,()=>
        bake(THREE,p=>helmetField(p,faction),
          [[-.325,.171,-.329],[.325,.563,.325]],28));
      return S.mesh(parent,geometry,mat);
    };
    const joint=(parent,mat,kind)=>{
      const geometry=S.cached("sdf-seam-v3-"+kind,()=>
        bake(THREE,p=>jointField(p,kind),
          kind==="knee"?
            [[-.153,-.19,-.16],[.153,.195,.16]]:
            [[-.104,-.147,-.104],[.104,.147,.104]],kind==="knee"?13:15));
      return S.mesh(parent,geometry,mat);
    };
    return Object.freeze({helmet,joint});
  }
  window.Crossroads3DSDFTransitions=Object.freeze({
    create,helmetField,jointField,smoothMin,bake
  });
})();