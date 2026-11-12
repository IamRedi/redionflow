import { steelWorkPhoto } from '@/lib/steel-work/photo-style';

/** Fictional decoration, never a replacement for an uploaded company photo. */
export function SteelEnvironmentPhoto({kind,className=''}:{kind:'site'|'factory'|'workshop';className?:string}){
 return <span aria-hidden="true" data-studio-environment={kind} className={`steelStudioPhoto ${className}`} style={{display:'none',backgroundImage:`url(/steel-studio-v1/${kind}.webp)`}}/>;
}
export function SteelProcessPhoto({phase,className=''}:{phase:string;className?:string}){
 const photo=steelWorkPhoto({key:phase});
 return <span aria-hidden="true" data-studio-process={phase} className={`steelStudioProcessPhoto ${className}`} style={{display:'none',position:className.split(/\s+/).includes('absolute')?'absolute':'relative'}}><span style={{backgroundImage:`url(${photo.src})`,backgroundSize:photo.panel===undefined?'cover':'300% 200%',backgroundPosition:photo.panel===undefined?'center':`${(photo.panel%3)*50}% ${Math.floor(photo.panel/3)*100}%`}}/></span>;
}
