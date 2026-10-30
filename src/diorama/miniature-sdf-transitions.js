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
    // Both helmets are sculpted from one continuous field. The lower
    // opening varies around the circumference: high at the brow for eye
    // clearance, lower over German ears and nape.
    const front=clamp((-p[2]-.055)/.19,0,1);
    const rear=clamp((p[2]-.045)/.24,0,1);
    const side=clamp((Math.abs(p[0])-.12)/.16,0,1);
    const shellCenter=german?[0,.307,.024]:[0,.305,.015];
    const shellSize=german?[.253,.251,.250]:[.250,.238,.249];
    const dome=ellipsoid(p,shellCenter,shellSize);
    const rimY=german?
      .215+.062*front-.022*side*(1-front)-.025*rear*(1-front):
      .227+.051*front-.004*side*(1-front)+.003*rear;
    const shell=-smoothMin(-dome,p[1]-rimY,.013);
    // Keep forward brow broad but shallow. A low round ellipsoid lip was
    // occluding both eyes in the old marching-tetrahedra helmet bake.
    const brow=ellipsoid(p,
      german?[0,.283,-.085]:[0,.285,-.062],
      german?[.269,.027,.223]:[.264,.026,.228]);
    if(!german)return smoothMin(shell,brow,.023);
    // German M35: longer ear protection and modestly flared rear skirt;
    // a raised front opening, not a huge level pancake brim.
    const skirtOval=ellipsoid(p,[0,.219,.095],[.280,.068,.231]);
    const guard=Math.max(skirtOval,p[1]-(.177+.087*front));
    const skirt=smoothMin(guard,brow,.025);
    return smoothMin(shell,skirt,.026);
  };
  const jointField=(p,kind)=>{
    const knee=kind==="knee",
      top=knee?[.105,.091,.107]:[.062,.063,.064],
      low=knee?[.097,.088,.095]:[.057,.062,.060];
    const upper=ellipsoid(p,[0,knee?.052:.041,0],top);
    const lower=ellipsoid(p,[0,knee?-.055:-.042,0],low);
    return smoothMin(upper,lower,knee?.036:.026);
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
  // v7 silhouette-first helmets. Unlike the former smooth union of domes
  // and ellipse lips these are a single watertight-edged contour surface.
  // A few deliberate latitudinal rings give 28mm-scale readable skirt shapes
  // without tetrahedral interpolation chatter or an overlapping brim.
  function helmetPatternGeometry(THREE,faction){
    const german=faction==="germany",sides=36;
    // [height, half-width, half-depth]; crown to bottom shell.
    const rings=german?[
      [.539,.009,.010],[.524,.098,.098],[.486,.183,.180],
      [.424,.228,.223],[.351,.247,.246],[.290,.256,.256],
      [.244,.267,.267],[.209,.280,.284]
    ]:[
      [.550,.008,.009],[.530,.101,.103],[.493,.183,.182],
      [.438,.224,.220],[.364,.246,.240],[.305,.251,.245],
      [.267,.256,.248],[.254,.259,.254]
    ];
    const positions=[],indices=[];
    const ringPoint=(r,angle,inner=false)=>{
      const [y,rx,rz]=r,front=Math.max(0,-Math.sin(angle)),
        rear=Math.max(0,Math.sin(angle)),side=Math.abs(Math.cos(angle));
      const rim=inner?1:0;
      const edgeY=german?
        .051*front-.035*rear-.025*side*(1-front):
        .016*front-.006*rear-.003*side;
      // Only apply the field hem outline at the bottom two rings.
      const amount=r===rings[rings.length-1]?1:
        r===rings[rings.length-2]?.35:0;
      const frontBill=german?.006:.015;
      return [Math.cos(angle)*(rx-rim*.017),
        y+edgeY*amount+(inner?.014:0),
        Math.sin(angle)*(rz-rim*.017)-frontBill*front*amount];
    };
    for(const ring of rings){
      for(let n=0;n<=sides;n++){
        positions.push(...ringPoint(ring,2*Math.PI*n/sides));
      }
    }
    // The inner curled lip is one extra ring, joined to the outer edge.
    for(let n=0;n<=sides;n++)
      positions.push(...ringPoint(rings[rings.length-1],2*Math.PI*n/sides,true));
    for(let j=0;j<rings.length;j++){
      for(let n=0;n<sides;n++){
        const a=j*(sides+1)+n,b=a+sides+1;
        indices.push(a,a+1,b,a+1,b+1,b);
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
    g.userData={sharedMiniatureGeometry:true,helmetPattern:faction,
      ringCount:rings.length+1,triangleCount:indices.length/3};
    return g;
  }
  function create(THREE,S){
    const helmet=(parent,mat,faction)=>{
      const geometry=S.cached("silhouette-helmet-v7-"+faction,()=>
        helmetPatternGeometry(THREE,faction));
      return S.mesh(parent,geometry,mat);
    };
    const joint=(parent,mat,kind)=>{
      const geometry=S.cached("sdf-seam-v4-"+kind,()=>
        bake(THREE,p=>jointField(p,kind),
          kind==="knee"?
            [[-.153,-.19,-.16],[.153,.195,.16]]:
            [[-.104,-.147,-.104],[.104,.147,.104]],kind==="knee"?13:15));
      return S.mesh(parent,geometry,mat);
    };
    return Object.freeze({helmet,joint});
  }
  window.Crossroads3DSDFTransitions=Object.freeze({
    create,helmetField,helmetPatternGeometry,jointField,smoothMin,bake
  });
})();