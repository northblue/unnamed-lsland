import * as THREE from 'three';

// Original articulated explorer; visual joints never enter gameplay or saves.
export function createExplorerModel() {
  const root=new THREE.Group();root.name='island-explorer';
  const visual=new THREE.Group();visual.scale.setScalar(0.9);root.add(visual);
  const geometries=new Set(),materials=new Set();
  const sphere=new THREE.SphereGeometry(1,28,20);geometries.add(sphere);
  function material(color,roughness=0.8,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,...extra});materials.add(m);return m;}
  const skin=material('#edbd92',0.65),shirt=material('#d87954'),pants=material('#46666b'),boots=material('#65513e'),sole=material('#3c403b'),hair=material('#503d30');
  const canvas=material('#74866a'),strap=material('#b99463'),brass=material('#d4b370',0.45,{metalness:0.25}),eye=material('#253b39',0.3),ivory=material('#fff1d4');
  const hatMaterial=material('#e2bf75',0.95);
  const weave=new Uint8Array(128*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<128;x++){
    const k=(y*128+x)*4,tone=0.87+0.1*Math.sin(x*Math.PI/2)*Math.cos(y*Math.PI/2)+0.025*Math.sin(x*0.7+y);
    weave[k]=Math.round(255*tone);weave[k+1]=Math.round(250*tone);weave[k+2]=Math.round(225*tone);weave[k+3]=255;
  }
  const texture=new THREE.DataTexture(weave,128,64);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;hatMaterial.map=texture;
  function mesh(g,m,x,y,z,parent=visual){geometries.add(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function oval(m,x,y,z,sx,sy,sz,parent=visual){const o=mesh(sphere,m,x,y,z,parent);o.scale.set(sx,sy,sz);return o;}
  function capsule(m,r,length,x,y,z,parent=visual){return mesh(new THREE.CapsuleGeometry(r,length,8,20),m,x,y,z,parent);}
  capsule(shirt,0.225,0.22,0,0.83,0).scale.set(1,1,0.8);
  oval(pants,0,0.54,0,0.22,0.145,0.16);
  // Shirt placket, collar and small buttons catch the light without hard boxes.
  for(let i=0;i<3;i++)oval(brass,0,0.78+i*0.085,-0.187,0.014,0.014,0.009);
  for(const side of [-1,1]){const collar=oval(ivory,side*0.065,1.04,-0.12,0.085,0.025,0.055);collar.rotation.z=side*0.3;}
  capsule(skin,0.075,0.09,0,1.12,0);
  const head=new THREE.Group();head.position.y=1.31;visual.add(head);
  oval(skin,0,0,0,0.215,0.245,0.205,head);
  for(const side of [-1,1]){
    oval(skin,side*0.211,-0.015,0,0.04,0.064,0.035,head);
    oval(eye,side*0.073,0.025,-0.185,0.022,0.03,0.015,head);
    oval(ivory,side*0.073-0.005,0.034,-0.198,0.006,0.008,0.004,head);
    const brow=oval(hair,side*0.076,0.087,-0.182,0.036,0.01,0.012,head);brow.rotation.z=side*0.09;
    oval(material('#d4967c'),side*0.12,-0.045,-0.166,0.033,0.015,0.009,head);
    oval(hair,side*0.182,0.13,0.025,0.04,0.12,0.11,head);
  }
  oval(skin,0,-0.026,-0.209,0.035,0.043,0.038,head);
  const smileCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.039,-0.095,-0.184),new THREE.Vector3(0,-0.104,-0.19),new THREE.Vector3(0.039,-0.095,-0.184)]);
  mesh(new THREE.TubeGeometry(smileCurve,12,0.005,5,false),hair,0,0,0,head);
  const brimProfile=[[0,0],[0.23,0],[0.34,-0.015],[0.375,0],[0.385,0.018],[0.35,0.032],[0.24,0.044],[0,0.04]].map(([r,y])=>new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(brimProfile,48),hatMaterial,0,1.51,0);
  const hatProfile=[[0.25,0],[0.25,0.05],[0.233,0.16],[0.205,0.21],[0.15,0.235],[0,0.24]].map(([r,y])=>new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(hatProfile,48),hatMaterial,0,1.54,0);
  mesh(new THREE.CylinderGeometry(0.245,0.25,0.045,48),strap,0,1.595,0);
  // A soft canvas pack with rolled blanket, flap, straps and brass buckle.
  oval(canvas,0,0.82,0.245,0.19,0.235,0.105);
  oval(canvas,0,1.005,0.28,0.185,0.065,0.095);
  const blanket=capsule(strap,0.065,0.24,0,0.61,0.29);blanket.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
    oval(strap,side*0.12,0.84,0.32,0.018,0.19,0.017);
    const shoulderStrap=new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*0.16,0.65,-0.16),new THREE.Vector3(side*0.185,0.98,-0.14),
      new THREE.Vector3(side*0.17,1.09,-0.02),new THREE.Vector3(side*0.16,1.04,0.18),new THREE.Vector3(side*0.15,0.84,0.315),
    ]);
    mesh(new THREE.TubeGeometry(shoulderStrap,20,0.025,8,false),canvas,0,0,0);
    mesh(new THREE.TorusGeometry(0.028,0.006,6,12),brass,side*0.12,0.74,0.339);
  }
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.name=side<0?'left-leg':'right-leg';leg.position.set(side*0.115,0.53,0);visual.add(leg);
    capsule(pants,0.087,0.16,0,-0.12,0,leg);
    const knee=new THREE.Group();knee.position.y=-0.26;leg.add(knee);
    capsule(pants,0.073,0.1,0,-0.075,0,knee);
    oval(boots,0,-0.185,-0.04,0.095,0.075,0.145,knee);
    oval(sole,0,-0.237,-0.045,0.099,0.022,0.15,knee);
    for(let j=0;j<3;j++)oval(strap,0,-0.15+j*0.018,-0.155,0.05,0.006,0.007,knee);
    legs.push({leg,knee});
    const arm=new THREE.Group();arm.name=side<0?'left-arm':'right-arm';arm.position.set(side*0.265,1,0);arm.rotation.z=side*0.08;visual.add(arm);
    capsule(shirt,0.075,0.1,0,-0.09,0,arm);
    capsule(skin,0.058,0.09,0,-0.19,0,arm);
    const elbow=new THREE.Group();elbow.position.y=-0.26;arm.add(elbow);
    capsule(skin,0.054,0.105,0,-0.09,0,elbow);
    const hand=oval(skin,0,-0.205,-0.01,0.06,0.075,0.045,elbow);hand.name=side<0?'left-hand':'right-hand';
    oval(skin,-side*0.043,-0.19,-0.025,0.025,0.043,0.027,elbow);
    arms.push({arm,elbow,hand});
  }
  let lastTime,motion=0;
  return {root,
    update(time,{moving=false,surfing=false,surfLean=0,fishing=false,jumping=false,carrying=false,shooting=false,reduceMotion=false}={}){
      const dt=lastTime===undefined?0:Math.min(0.1,Math.abs(time-lastTime));lastTime=time;
      motion=reduceMotion?0:THREE.MathUtils.lerp(motion,moving?1:0,1-Math.exp(-dt*14));
      visual.rotation.z=surfing?surfLean:0;
      legs.forEach(({leg,knee},i)=>{const step=Math.sin(time*10+i*Math.PI);leg.rotation.x=surfing?0.3:jumping?0.22:step*0.48*motion;knee.rotation.x=surfing?-0.6:jumping?-0.65:-Math.max(0,-step)*0.55*motion;});
      arms.forEach(({arm,elbow},i)=>{
        arm.rotation.z=surfing?(i===0?-0.65:0.65):(i===0?-0.08:0.08);
        arm.rotation.x=surfing?-0.3:shooting?2.1:jumping?-0.65:fishing?0.95:carrying&&i===1?0.35+Math.sin(time*10)*0.18*motion:-Math.sin(time*10+i*Math.PI)*0.38*motion;
        elbow.rotation.x=shooting?0.25:fishing?0.95:carrying&&i===1?0.4:0.07+Math.max(0,Math.sin(time*10+i*Math.PI))*0.18*motion;
        arm.rotation.y=fishing?(i?0.45:-0.45):0;
      });
      head.rotation.y=reduceMotion||moving||fishing||jumping?0:Math.sin(time*0.45)*0.045;
      visual.position.y=surfing?-0.12:reduceMotion||jumping?0:Math.sin(time*2)*0.006*(1-motion);
    },
    gripPosition(target=new THREE.Vector3()){root.updateWorldMatrix(true,true);return arms[1].hand.getWorldPosition(target);},
    dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();},
  };
}
