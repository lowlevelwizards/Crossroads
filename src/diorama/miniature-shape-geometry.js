"use strict";
// SDF blending is CPU-baked into ordinary Three.js BufferGeometry.
// Never raymarch every soldier at runtime. Source contours remain editable.
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smoothMin=(a,b,k)=>{
    const h=Math.max(k-Math.abs(a-b),0)/k;
    return Math.min(a,b)-h*h*k*.25;
  };
  function sampleContour(doc,p){
    const axis=doc.axis==="z"?"z":"y";
    const h=axis==="y"?p[1]:p[2];
    const c=doc.contours;
    let i=0;
    while(i<c.length-2&&c[i+1].height<h)i++;
    const a=c[i],b=c[i+1];
    const t=clamp((h-a.height)/(b.height-a.height),0,1);
    const rx=mix(a.width,b.width,t),rz=mix(a.depth,b.depth,t);
    const cx=mix(a.offsetX,b.offsetX,t),cz=mix(a.offsetZ,b.offsetZ,t);
    const radial=axis==="y"?
      Math.hypot((p[0]-cx)/rx,(p[2]-cz)/rz):
      Math.hypot((p[0]-cx)/rx,(p[1]-cz)/rz);
    const radialDistance=(radial-1)*Math.min(rx,rz);
    const capDistance=Math.max(c[0].height-h,h-c[c.length-1].height);
    return Math.max(radialDistance,capDistance);
  }
  function sampleEllipsoid(p,primitive){
    const v=primitive.center,r=primitive.radius;
    const q=Math.hypot((p[0]-v[0])/r[0],
      (p[1]-v[1])/r[1],(p[2]-v[2])/r[2]);
    return (q-1)*Math.min(...r);
  }
  function field(doc,p){
    const a=sampleContour(doc,p);
    if(!doc.blend?.enabled)return a;
    const b=sampleEllipsoid(p,doc.blend.primitive);
    return smoothMin(a,b,doc.blend.strength);
  }
  const P0=[0,0,0],CUBE=[
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ];
  const TETRA=[
    [0,5,1,6],[0,1,2,6],[0,2,3,6],
    [0,3,7,6],[0,7,4,6],[0,4,5,6]
  ];
  const interpolate=(a,b,da,db)=>{
    const t=clamp(da/(da-db||1e-9),0,1);
    return [mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
  };
  function bounds(doc){
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const c of doc.contours){
      const x=c.offsetX,z=c.offsetZ;
      const pts=doc.axis==="z"?
        [[x-c.width,z-c.depth,c.height],[x+c.width,z+c.depth,c.height]]:
        [[x-c.width,c.height,z-c.depth],[x+c.width,c.height,z+c.depth]];
      for(const p of pts)for(let j=0;j<3;j++){
        lo[j]=Math.min(lo[j],p[j]);hi[j]=Math.max(hi[j],p[j]);
      }
    }
    if(doc.blend?.enabled){
      const {center,radius}=doc.blend.primitive;
      for(let j=0;j<3;j++){
        lo[j]=Math.min(lo[j],center[j]-radius[j]);
        hi[j]=Math.max(hi[j],center[j]+radius[j]);
      }
    }
    const pad=doc.blend?.enabled?doc.blend.strength+.055:.035;
    return [lo.map(x=>x-pad),hi.map(x=>x+pad)];
  }
  function contourGeometry(THREE,doc){
    const verts=[],uv=[],indices=[],sides=doc.radialSegments;
    const zAxis=doc.axis==="z";
    for(let j=0;j<doc.contours.length;j++){
      const c=doc.contours[j];
      for(let i=0;i<=sides;i++){
        const a=i/sides*2*Math.PI,
          u=c.offsetX+Math.cos(a)*c.width,
          v=c.offsetZ+Math.sin(a)*c.depth;
        if(zAxis)verts.push(u,v,c.height);
        else verts.push(u,c.height,v);
        uv.push(i/sides,j/(doc.contours.length-1));
      }
    }
    for(let j=0;j<doc.contours.length-1;j++)
      for(let i=0;i<sides;i++){
        const a=j*(sides+1)+i,b=a+sides+1;
        if(zAxis)indices.push(a,a+1,b,a+1,b+1,b);
        else indices.push(a,b,a+1,b,b+1,a+1);
      }
    // Independent cap vertices avoid unwanted smoothing of cap edges.
    for(const index of [0,doc.contours.length-1]){
      const c=doc.contours[index],center=verts.length/3;
      if(zAxis)verts.push(c.offsetX,c.offsetZ,c.height);
      else verts.push(c.offsetX,c.height,c.offsetZ);
      uv.push(.5,.5);
      const start=verts.length/3;
      for(let i=0;i<sides;i++){
        const theta=i*2*Math.PI/sides;
        const x=c.offsetX+c.width*Math.cos(theta),
          z=c.offsetZ+c.depth*Math.sin(theta);
        if(zAxis)verts.push(x,z,c.height);
        else verts.push(x,c.height,z);
        uv.push((1+Math.cos(theta))/2,(1+Math.sin(theta))/2);
      }
      for(let i=0;i<sides;i++){
        const next=(i+1)%sides;
        if((index===0)!==zAxis)indices.push(center,start+i,start+next);
        else indices.push(center,start+next,start+i);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    geometry.computeBoundingSphere();return geometry;
  }
  function sdfGeometry(THREE,doc,resolution=22){
    resolution=clamp(Math.round(resolution),12,32);
    const [lo,hi]=bounds(doc),size=hi.map((x,i)=>x-lo[i]),
      longest=Math.max(...size);
    const counts=size.map(v=>Math.max(3,Math.round(resolution*v/longest)));
    const spacing=size.map((v,i)=>v/counts[i]),verts=[];
    const gradient=(p)=>{
      const e=Math.min(...spacing)*.25;
      const g=[0,1,2].map(j=>{
        const a=p.slice(),b=p.slice();a[j]+=e;b[j]-=e;
        return field(doc,a)-field(doc,b);
      });
      const len=Math.hypot(...g)||1;
      return g.map(x=>x/len);
    };
    let triangles=0;
    function emit(a,b,c){
      if(triangles>48000)return;
      const normal=[
        (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
        (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
        (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
      ];
      const middle=a.map((x,i)=>(x+b[i]+c[i])/3);
      const grad=gradient(middle);
      if(normal.reduce((sum,x,i)=>sum+x*grad[i],0)<0)[b,c]=[c,b];
      verts.push(...a,...b,...c);triangles++;
    }
    for(let x=0;x<counts[0];x++)
      for(let y=0;y<counts[1];y++)
        for(let z=0;z<counts[2];z++){
          const points=CUBE.map(([a,b,c])=>[
            lo[0]+(x+a)*spacing[0],
            lo[1]+(y+b)*spacing[1],
            lo[2]+(z+c)*spacing[2]]);
          const values=points.map(p=>field(doc,p));
          if(values.every(v=>v>=0)||values.every(v=>v<0))continue;
          for(const tetra of TETRA){
            const inside=tetra.filter(i=>values[i]<0),
              outside=tetra.filter(i=>values[i]>=0);
            if(!inside.length||inside.length===4)continue;
            const crossing=(i,j)=>interpolate(points[i],points[j],
              values[i],values[j]);
            if(inside.length===1){
              const a=inside[0];emit(...outside.map(b=>crossing(a,b)));
            }else if(inside.length===3){
              const b=outside[0];emit(...inside.map(a=>crossing(a,b)));
            }else{
              const [a,b]=inside,[c,d]=outside;
              const ac=crossing(a,c),ad=crossing(a,d),
                bc=crossing(b,c),bd=crossing(b,d);
              emit(ac,ad,bc);emit(ad,bd,bc);
            }
          }
        }
    if(!verts.length)return contourGeometry(THREE,doc);
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
    // Non-indexed marching-tetrahedron meshes would otherwise shade each
    // triangle as a flat facet. Field gradients give one smooth surface.
    const normals=[];
    for(let i=0;i<verts.length;i+=3)
      normals.push(...gradient(verts.slice(i,i+3)));
    g.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
    g.computeBoundingSphere();
    g.userData={sdfBaked:true,triangles};
    return g;
  }
  const publishedCache=new Map();
  function make(THREE,doc,opts={}){
    const shape=window.Crossroads3DShapeLibrary.validate(doc);
    const key=opts.published?JSON.stringify(shape):null;
    if(key&&publishedCache.has(key))return publishedCache.get(key);
    const geometry=shape.blend.enabled?
      sdfGeometry(THREE,shape,opts.resolution||22):
      contourGeometry(THREE,shape);
    const transform=shape.transform;
    if(transform){
      geometry.scale(...transform.scale);
      geometry.rotateX(transform.rotation[0]);
      geometry.rotateY(transform.rotation[1]);
      geometry.rotateZ(transform.rotation[2]);
      geometry.translate(...transform.position);
      geometry.computeBoundingSphere();
    }
    if(key){
      geometry.userData=geometry.userData||{};
      geometry.userData.sharedMiniatureGeometry=true;
      publishedCache.set(key,geometry);
    }
    return geometry;
  }
  window.Crossroads3DShapeGeometry=Object.freeze({
    contourGeometry,sdfGeometry,field,smoothMin,make,bounds
  });
})();