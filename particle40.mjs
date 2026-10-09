// Same streamline geometry and total-parameter model as V3.4; only its azimuthal copies change.
export const BUNDLE_COUNT=24;
export const PARTICLES_PER_BUNDLE=40;
export const MAX_PARTICLES=BUNDLE_COUNT*PARTICLES_PER_BUNDLE;
export function particleSample(index,time){
 const bundle=Math.floor(index/PARTICLES_PER_BUNDLE),j=index%PARTICLES_PER_BUNDLE;
 const phase=(time*.075+j/PARTICLES_PER_BUNDLE+bundle*.61803398875)%1;
 return {phase,angle:bundle*Math.PI*2/BUNDLE_COUNT+.02*Math.sin(phase*6),jitter:.025*Math.sin(j*1.71)};
}
export const particleCount=single=>single?PARTICLES_PER_BUNDLE:MAX_PARTICLES;
