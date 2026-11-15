// Hand-authored simplified figures: screen composition, not celestial coordinates.
export const CONSTELLATIONS = [
  { id:'cassiopeia', points:[[-0.6,0.25,1.25],[-0.3,-0.2,1.1],[0,0.1,1.35],[0.28,-0.23,1.15],[0.58,0.28,1.3]],
    edges:[[0,1],[1,2],[2,3],[3,4]], anchor:[0.27,0.96], size:0.105, label:[0.35,0.965] },
  { id:'orion', points:[[-0.35,0.45,1.65,1],[0.32,0.4,1.35],[-0.16,-0.02,1.3],[0,0.01,1.4],[0.16,0.04,1.3],[-0.25,-0.43,1.25],[0.33,-0.48,1.65],[0.02,0.63,1.05],[0.02,-0.18,0.95],[0.03,-0.26,0.8]],
    edges:[[0,7],[7,1],[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[5,6],[3,8],[8,9]], anchor:[0.59,0.92], size:0.105, label:[0.59,0.845] },
  { id:'crux', points:[[0,-0.5,1.6],[-0.06,0.5,1.4],[-0.38,0.06,1.45],[0.29,0.16,1.2],[0.13,-0.12,0.85]],
    edges:[[1,0],[2,3]], anchor:[0.78,0.88], size:0.11, label:[0.75,0.795] },
];

export function constellationLayout(aspect) {
  const safeAspect=Math.max(0.2,Number.isFinite(aspect)?aspect:1);
  const narrow=safeAspect<1;
  return CONSTELLATIONS.filter(c=>!narrow||c.id!=='cassiopeia').map(c=>{
    // Portrait uses the clear painted sky below the diorama, outside the top HUD.
    const anchor=narrow?(c.id==='orion'?[0.62,0.27]:[0.2,0.28]):c.anchor;
    const size=narrow?(c.id==='orion'?0.105:0.075):c.size;
    const label=narrow?[anchor[0],anchor[1]+(c.id==='orion'?0.09:-0.06)]:c.label;
    return {...c,label,points:c.points.map(([x,y,r,warm=0])=>({x:anchor[0]+x*size/safeAspect,y:anchor[1]+y*size,r,warm}))};
  });
}
