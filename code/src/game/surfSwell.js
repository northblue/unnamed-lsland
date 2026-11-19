// Shared by the rendered swell and riders; lane is distance from the circuit centreline.
export function swellHeight(angle, lane, time) {
  const packet = Math.pow(0.5 + 0.5 * Math.cos(angle * 3 - time * 0.48), 5);
  const crest = Math.exp(-(((lane - 2.9) / (lane < 2.9 ? 0.85 : 1.65)) ** 2));
  const shoulder = Math.exp(-(((lane - 0.7) / 1.8) ** 2));
  const t = Math.max(0, Math.min(1, 5.5 - lane));
  return ((0.16 + packet * 2.6) * crest + (0.07 + packet * 0.2) * shoulder) * t * t * (3 - 2 * t);
}
export const SWELL_GLSL = `
float wavePacket(float a,float t){return pow(.5+.5*cos(a*3.-t*.48),5.);}
float swellHeight(float a,float lane,float t){
  float packet=wavePacket(a,t);
  float width=lane<2.9?.85:1.65;float crest=exp(-pow((lane-2.9)/width,2.));
  float shoulder=exp(-pow((lane-.7)/1.8,2.));
  return ((.16+packet*2.6)*crest+(.07+packet*.2)*shoulder)*(1.-smoothstep(4.5,5.5,lane));
}`;
