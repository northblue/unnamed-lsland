import * as THREE from 'three';
import { constellationLayout } from './constellations.js';
import { messages } from './messages.js';

// Blend on the opaque queue, just after the painted sky and BEFORE island meshes.
// This keeps sky annotations behind land instead of overlaying the whole game.
export function createConstellationView(scene) {
  const root=new THREE.Group();root.name='painted-constellations';root.userData.skipWaterReflection=true;scene.add(root);
  const common={night:{value:0},time:{value:0},aspect:{value:1},moon:{value:new THREE.Vector2()},pixelRatio:{value:1}};
  const pointMaterial=new THREE.ShaderMaterial({uniforms:common,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float radius;attribute float phase;attribute vec3 tint;
      uniform float pixelRatio;varying float vPhase;varying vec3 vTint;varying vec2 centerUv;
      void main(){centerUv=position.xy*0.5+0.5;vPhase=phase;vTint=tint;
        gl_Position=vec4(position.xy,0.9998,1.0);gl_PointSize=(radius*8.0+2.0)*pixelRatio;}`,
    fragmentShader:`uniform float night,time,aspect;uniform vec2 moon;
      varying float vPhase;varying vec3 vTint;varying vec2 centerUv;
      void main(){vec2 p=(gl_PointCoord-0.5)*8.0;float d=length(p);
        float light=exp(-d*d)+exp(-d*d/5.5)*0.15;
        float twinkle=0.86+0.14*sin(time*(0.45+vPhase*0.3)+vPhase*25.0);
        float clear=smoothstep(0.026,0.042,length((centerUv-moon)*vec2(aspect,1.0)));
        gl_FragColor=vec4(vTint,light*night*twinkle*clear);
        #include <colorspace_fragment>
      }`,
  });
  const blend={depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor};
  const lineMaterial=new THREE.ShaderMaterial({...blend,uniforms:common,
    vertexShader:`attribute float across;varying float side;varying vec2 skyUv;
      void main(){side=across;skyUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,0.9998,1.0);}`,
    fragmentShader:`uniform float night,aspect;uniform vec2 moon;varying float side;varying vec2 skyUv;
      void main(){float edge=1.0-smoothstep(0.2,1.0,abs(side));
        float clear=smoothstep(0.026,0.045,length((skyUv-moon)*vec2(aspect,1.0)));
        gl_FragColor=vec4(0.65,0.78,0.9,edge*night*0.25*clear);
        #include <colorspace_fragment>
      }`,
  });
  let language='zh',lastKey='',geometries=[],labelMaterials=[],textures=[];
  function clear(){root.clear();geometries.forEach(g=>g.dispose());labelMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());geometries=[];labelMaterials=[];textures=[];}
  function geometry(positions){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometries.push(g);return g;}
  function quad(x,y,w,h){return [x,y,0,x+w,y,0,x,y+h,0,x,y+h,0,x+w,y,0,x+w,y+h,0];}
  function rebuild(aspect,height){
    clear();const width=height*aspect;
    for(const [index,c] of constellationLayout(aspect).entries()){
      const positions=[],radii=[],phases=[],tints=[];
      for(const [i,p] of c.points.entries()){
        positions.push(p.x*2-1,p.y*2-1,0);radii.push(p.r);phases.push((i*0.173+index*0.39)%1);
        const color=new THREE.Color(p.warm?'#f5c58d':'#e2eeff');tints.push(color.r,color.g,color.b);
      }
      const dots=geometry(positions);dots.setAttribute('radius',new THREE.Float32BufferAttribute(radii,1));dots.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));dots.setAttribute('tint',new THREE.Float32BufferAttribute(tints,3));
      const points=new THREE.Points(dots,pointMaterial);points.renderOrder=-988;points.frustumCulled=false;root.add(points);
      const linePositions=[],sides=[];
      for(const [a,b] of c.edges){
        const p=c.points[a],q=c.points[b],dx=(q.x-p.x)*width,dy=(q.y-p.y)*height,length=Math.hypot(dx,dy);
        const ox=-dy/length*0.7/width,oy=dx/length*0.7/height;
        for(const [v,side] of [[p,-1],[q,-1],[p,1],[p,1],[q,-1],[q,1]]){
          linePositions.push((v.x+ox*side)*2-1,(v.y+oy*side)*2-1,0);sides.push(side);
        }
      }
      const lines=geometry(linePositions);lines.setAttribute('across',new THREE.Float32BufferAttribute(sides,1));
      const strokes=new THREE.Mesh(lines,lineMaterial);strokes.renderOrder=-989;strokes.frustumCulled=false;root.add(strokes);
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      const text=messages[language].constellations.names[c.id];
      ctx.font='500 22px system-ui, sans-serif';const labelWidth=Math.ceil(ctx.measureText(text).width)+20;
      canvas.width=labelWidth;canvas.height=40;ctx.font='500 22px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='rgba(5,13,30,0.9)';ctx.shadowBlur=5;ctx.fillStyle='#d4e1ec';ctx.fillText(text,labelWidth/2,20);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
      const labelMaterial=new THREE.ShaderMaterial({...blend,uniforms:{map:{value:texture},night:common.night},
        vertexShader:`varying vec2 labelUv;void main(){labelUv=uv;gl_Position=vec4(position.xy,0.9998,1.0);}`,
        fragmentShader:`uniform sampler2D map;uniform float night;varying vec2 labelUv;
          void main(){vec4 ink=texture2D(map,labelUv);gl_FragColor=vec4(ink.rgb,ink.a*night*0.7);
            #include <colorspace_fragment>
          }`,
      });
      labelMaterials.push(labelMaterial);
      const w=labelWidth/2/width*2,h=20/height*2;
      const labelGeometry=geometry(quad(c.label[0]*2-1-w/2,c.label[1]*2-1-h/2,w,h));
      labelGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,1,1,0,1,1],2));
      const label=new THREE.Mesh(labelGeometry,labelMaterial);label.renderOrder=-987;label.frustumCulled=false;root.add(label);
    }
  }
  return {
    setLanguage(value){const next=value==='en'?'en':'zh';if(next!==language){language=next;lastKey='';}},
    update(time,night,aspect,height,moon,pixelRatio=1){
      const key=`${aspect.toFixed(3)}:${Math.round(height)}:${language}`;
      if(key!==lastKey){lastKey=key;rebuild(aspect,height);}
      common.night.value=night;common.time.value=time;common.aspect.value=aspect;common.moon.value.copy(moon);common.pixelRatio.value=pixelRatio;
      root.visible=night>0.001;
    },
    dispose(){clear();pointMaterial.dispose();lineMaterial.dispose();root.removeFromParent();},
  };
}
