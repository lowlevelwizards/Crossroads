"use strict";
// Crossroads sculpting primitives — geometric forms authored for the character,
// not uniform-scale spheres pretending to be clothing. No build step required.
(() => {
  function create(THREE) {
    const cache=new Map();
    const cached=(key,construct)=>{
      if(!cache.has(key)){
        const geometry=construct();
        geometry.userData=geometry.userData||{};
        geometry.userData.sharedMiniatureGeometry=true;
        cache.set(key,geometry);
      }
      return cache.get(key);
    };
    const sphere=cached("sphere",()=>new THREE.SphereGeometry(1,12,8));
    const boxCache=(x,y,z)=>cached(["box",x,y,z].join("/"),
      ()=>new THREE.BoxGeometry(x,y,z));
    function mesh(parent,geometry,material,position=[0,0,0]) {
      const m=new THREE.Mesh(geometry,material);
      m.userData.sharedMiniatureGeometry=!!geometry.userData?.sharedMiniatureGeometry;
      m.position.set(...position);
      m.castShadow=true;m.receiveShadow=true;
      parent.add(m);
      return m;
    }
    function soft(parent,material,p,r){
      const m=mesh(parent,sphere,material,p);m.scale.set(...r);return m;
    }
    function box(parent,material,dimensions,position){
      return mesh(parent,boxCache(...dimensions),material,position);
    }
    // Profiles: [vertical position, X radius, Z radius, X offset, Z offset].
    // Contours are authored in the local segment's +/-0.5 vertical range.
    function loftGeometry(profile,sides=10){
      const verts=[],indices=[],uv=[];
      for(let j=0;j<profile.length;j++){
        const [y,rx,rz,cx=0,cz=0]=profile[j];
        for(let k=0;k<=sides;k++){
          const a=2*Math.PI*k/sides;
          verts.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);
          uv.push(k/sides,j/(profile.length-1));
        }
      }
      for(let j=0;j<profile.length-1;j++)
        for(let k=0;k<sides;k++){
          const a=j*(sides+1)+k,b=a+sides+1;
          indices.push(a,b,a+1,b,b+1,a+1);
        }
      // Close the ends with independent vertices for crisp cloth edges.
      for(const [j,reverse] of [[0,true],[profile.length-1,false]]){
        const [y,rx,rz,cx=0,cz=0]=profile[j];
        const center=verts.length/3;
        verts.push(cx,y,cz);uv.push(.5,.5);
        const begin=verts.length/3;
        for(let k=0;k<sides;k++){
          const a=2*Math.PI*k/sides;
          verts.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);
          uv.push((Math.cos(a)+1)/2,(Math.sin(a)+1)/2);
        }
        for(let k=0;k<sides;k++){
          const next=(k+1)%sides;
          if(reverse)indices.push(center,begin+k,begin+next);
          else indices.push(center,begin+next,begin+k);
        }
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
      g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
      return g;
    }
    const loft=(parent,material,key,profile,p=[0,0,0],sides=10)=>{
      const g=cached("loft:"+key,()=>loftGeometry(profile,sides));
      return mesh(parent,g,material,p);
    };
    const v=(x,y,z)=>new THREE.Vector3(x,y,z);
    const UP=v(0,1,0);
    const segment=(m,a,b)=>{
      const delta=b.clone().sub(a);
      const len=Math.max(.001,delta.length());
      m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(UP,delta.multiplyScalar(1/len));
      // Radii are in the authored geometry: never scale x/z in pose updates.
      m.scale.set(1,len,1);
    };
    function strap(parent,mat,points,width=.037,depth=.012){
      // Small surface-following ribbon: curvature comes from authored anchor
      // points. No physics and no floating vertical box straps.
      const positions=[],indices=[];
      for(const [x,y,z] of points){
        positions.push(x-width/2,y,z-depth/2,x+width/2,y,z+depth/2);
      }
      for(let i=0;i<points.length-1;i++){
        const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      g.setIndex(indices);g.computeVertexNormals();
      return mesh(parent,g,mat);
    }
    // Two-sided surface-conforming fabric ribbon; refreshed only when body
    // proportions change. Crosswise vertices follow the same tunic contour.
    function surfaceRibbon(parent,material,nodes,surface,width=.054){
      const geometry=new THREE.BufferGeometry();
      const positions=new Float32Array(nodes.length*6),indices=[];
      for(let i=0;i<nodes.length-1;i++){
        const a=i*2,b=a+2;indices.push(a,a+1,b,a+1,b+1,b);
      }
      geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      geometry.setIndex(indices);
      const item=mesh(parent,geometry,material);
      item.userData.refreshRibbon=(bodyWidth=1)=>{
        for(let i=0;i<nodes.length;i++){
          const [x,y]=nodes[i];
          for(let side=0;side<2;side++){
            const index=i*6+side*3,px=x+(side?width/2:-width/2);
            positions[index]=px;
            positions[index+1]=y;
            positions[index+2]=surface(px,y,bodyWidth)-.009;
          }
        }
        geometry.attributes.position.needsUpdate=true;
        geometry.computeVertexNormals();geometry.computeBoundingSphere();
      };
      item.userData.refreshRibbon(1);
      return item;
    }
    // One skinned lower-leg surface, rather than independently animated rings
    // or a boot tube stuck to a scaled shin. Material bands share vertices.
    function clothedShin(parent,trousers,leather,style){
      const profile=[
        [-.5,.086,.086],[-.40,.101,.101],[-.29,.105,.107],
        [-.16,.108,.110],[-.04,.112,.111],[.11,.114,.110],
        [.24,.112,.108],[.37,.110,.108],[.5,.097,.096]
      ];
      const key="clothed-shin-"+style;
      const geometry=cached(key,()=>{
        const g=loftGeometry(profile,10);
        if(g.clearGroups)g.clearGroups();else g.groups=[];
        const add=(start,count,material)=>{
          if(g.addGroup)g.addGroup(start,count,material);
          else g.groups.push({start,count,materialIndex:material});
        };
        for(let section=0;section<profile.length-1;section++){
          // Two broad puttee bands or a continuous lower German boot shaft.
          const isBoot=style==="germany"?section<5:
            section===1||section===3;
          add(section*10*6,10*6,isBoot?1:0);
        }
        // Cap faces use the material of their adjacent ring.
        add((profile.length-1)*10*6,10*3,
          style==="germany"?1:0);
        add((profile.length-1)*10*6+10*3,10*3,0);
        return g;
      });
      return mesh(parent,geometry,[trousers,leather]);
    }
    // Feet are shaped longitudinally, with a flattened sole, instep and toe.
    function bootGeometry(){
      const rings=[
        [-.210,.075,.045,-.040], // toe: broad and grounded
        [-.165,.132,.087,-.003],
        [-.060,.124,.101,.029],
        [ .060,.109,.118,.047],
        [ .165,.083,.124,.060],
        [ .205,.071,.090,.057]
      ];
      const verts=[],indices=[],sides=10;
      for(const [z,rx,ry,cy] of rings){
        for(let i=0;i<=sides;i++){
          const a=i/sides*2*Math.PI;
          verts.push(Math.cos(a)*rx,cy+Math.sin(a)*ry,z);
        }
      }
      for(let k=0;k<rings.length-1;k++)
        for(let i=0;i<sides;i++){
          const a=k*(sides+1)+i,b=a+sides+1;
          indices.push(a,a+1,b,b,a+1,b+1);
        }
      // Cap the heel and toe inside the same boot mesh so there are no
      // detached sole plates, visible open ends or floating joint pieces.
      for(const end of [0,rings.length-1]){
        const ring=rings[end],center=verts.length/3;
        verts.push(0,ring[3],ring[0]);
        for(let i=0;i<sides;i++){
          const a=end*(sides+1)+i;
          const b=end*(sides+1)+(i+1)%sides;
          if(end===0)indices.push(center,b,a);
          else indices.push(center,a,b);
        }
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
      return g;
    }
    function boot(parent,leather,soleMat,side,initialY=.18){
      const root=new THREE.Group();root.position.set(side*.145,initialY,-.045);
      parent.add(root);
      const upper=mesh(root,cached("shaped-boot",bootGeometry),leather);
      // One coherent boot mesh. The toe, ankle and heel are all defined by
      // its longitudinal silhouette—no floating sole, heel or cuff meshes.
      return {root,upper};
    }
    const material=(hex,roughness=.94)=>new THREE.MeshStandardMaterial({
      color:hex,roughness,metalness:0,flatShading:false,side:THREE.DoubleSide
    });
    return Object.freeze({mesh,soft,box,loft,loftGeometry,segment,strap,surfaceRibbon,clothedShin,boot,
      cached,v,material});
  }
  window.Crossroads3DSculptShapes=Object.freeze({create});
})();