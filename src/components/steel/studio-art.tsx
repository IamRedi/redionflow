import type {CSSProperties} from 'react';

/** Fictional decoration, never a replacement for an uploaded company photo. */
export function SteelEnvironmentPhoto({kind,className=''}:{kind:'site'|'factory'|'workshop';className?:string}){
 return <span aria-hidden="true" data-studio-environment={kind} className={`steelStudioPhoto ${className}`} style={{display:'none',backgroundImage:`url(/steel-studio-v1/${kind}.webp)`}}/>;
}
const processes:Record<string,number>={cutting:0,assembly:1,trusses:1,welding:2,cleaning:3,painting:4,coating:4,loading:5,final:5};
export function SteelProcessPhoto({phase,className=''}:{phase:string;className?:string}){
 const index=Object.hasOwn(processes,phase)?processes[phase]:undefined;
 // Generic site context for other work; never substitute a different operation.
 if(index===undefined)return <SteelEnvironmentPhoto kind={phase==='laser'||phase==='drilling'?'factory':'site'} className={className}/>;
 return <span aria-hidden="true" data-studio-process={phase} className={`steelStudioProcessPhoto ${className}`} style={{display:'none',position:className.split(/\s+/).includes('absolute')?'absolute':'relative'}}><span style={{'--process-x':`${(index%3)*50}%`,'--process-y':`${Math.floor(index/3)*100}%`} as CSSProperties}/></span>;
}
