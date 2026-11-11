import {ArrowLeft,ArrowRight,Building2,ChevronDown} from 'lucide-react';
import type {OfficeDoor} from './OfficeScene';
import s from './office.module.css';

function nameLines(name:string){
 const words=name.trim().split(/\s+/),lines:string[]=[];
 for(const word of words){const last=lines.length-1;if(last>=0&&`${lines[last]} ${word}`.length<=15)lines[last]+=` ${word}`;else lines.push(word);}
 return lines.slice(0,3);
}
function Entrance({person,x,y,width,height,prefix}:{person:OfficeDoor;x:number;y:number;width:number;height:number;prefix:string}){
 const lines=nameLines(person.name),font=lines.some(line=>line.length>15)?12:15;
 return <a href={person.href} aria-label={`${person.name} · ${person.title}`} className={s.sceneLink}><g transform={`translate(${x} ${y})`} data-office-entrance>
  <title>{`${person.name} · ${person.title}`}</title>
  <rect x="-8" y="-7" width={width+16} height={height+9} rx="3" fill="var(--frame)" filter={`url(#${prefix}-shadow)`}/>
  <rect width={width} height={height} fill={`url(#${prefix}-glass)`}/>
  <path d={`M4 4H${width-4}V${height-3}H4Z`} fill="none" stroke="#ffffff50"/>
  <path d={`M4 4H${width*.74}L4 ${height*.75}Z`} fill="#fff" opacity=".12"/>
  <path d={`M7 ${height*.7}H${width-7}M7 ${height*.73}H${width-7}`} stroke="#ffffff35"/>
  <rect x="10" y="64" width={width-20} height="100" rx="5" fill="var(--paper)" fillOpacity=".94"/>
  <text x={width/2} y={lines.length===3?86:96} textAnchor="middle" className={s.doorName} style={{fontSize:font}}>{lines.map((line,i)=><tspan key={i} x={width/2} dy={i?19:0}>{line}</tspan>)}</text>
  <circle cx={width/2} cy="150" r="3" fill={person.enabled?'#4b8b6e':'#b38345'}/>
  <rect x={width-20} y={height*.61} width="5" height="31" rx="2" fill="#526461"/>
  <path d={`M${width-17} ${height*.64}h-22`} stroke="#dddccf" strokeWidth="5" strokeLinecap="round"/>
  <path d={`M-8 ${height+2}H${width+8}`} stroke="var(--oak-light)" strokeWidth="3"/>
 </g></a>;
}

/** A single architectural floor line; the directory keeps every office directly reachable. */
export function ReceptionScene({company,doors,doorPage,sq}:{company:string;doors:OfficeDoor[];doorPage:number;sq:boolean}){
 return <div className={s.receptionSurface}>
  {(['wide','narrow','short-wide','short-narrow'] as const).map(mode=>{
   const mobile=mode.includes('narrow'),short=mode.startsWith('short');
   const W=mobile?420:1200,H=short?420:680,floor=short?300:500,perPage=mobile?2:4,prefix='hall-'+mode;
   const page=Math.max(0,Math.min(Math.ceil(doors.length/perPage)-1,doorPage)),shown=doors.slice(page*perPage,(page+1)*perPage);
   const wall=mobile?W*.94:W*.82;
   return <div key={prefix} className={short?(mobile?s.hallShortNarrow:s.hallShortWide):(mobile?s.hallNarrow:s.hallWide)}>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={s.hallArtwork} role="group" aria-label={sq?'Recepsioni dhe dyert e zyrave':'Reception and office doors'}>
     <defs>
      <linearGradient id={`${prefix}-wall`} x2="0" y2="1"><stop stopColor="var(--paper)" stopOpacity=".12"/><stop offset="1" stopColor="var(--wall)"/></linearGradient>
      <linearGradient id={`${prefix}-glass`} x2="1" y2="1"><stop stopColor="var(--glass)"/><stop offset=".55" stopColor="var(--glass)"/><stop offset="1" stopColor="var(--frame)" stopOpacity=".7"/></linearGradient>
      <linearGradient id={`${prefix}-floor`} x2="0" y2="1"><stop stopColor="var(--frame)" stopOpacity=".16"/><stop offset=".18" stopColor="var(--floor)"/><stop offset="1" stopColor="var(--floor)"/></linearGradient>
      <linearGradient id={`${prefix}-oak`}><stop stopColor="var(--oak-light)"/><stop offset="1" stopColor="var(--oak)"/></linearGradient>
      <filter id={`${prefix}-shadow`} x="-30%" y="-20%" width="170%" height="150%"><feDropShadow dx="3" dy="5" stdDeviation="4" floodOpacity=".18"/></filter>
     </defs>
     <rect width={W} height={H} fill="var(--wall)"/>
     <path d={`M0 0H${wall}V${floor}H0Z`} fill={`url(#${prefix}-wall)`}/>
     <path d={`M${wall} 0H${W}V${H}L${wall} ${floor}Z`} fill="var(--oak)" opacity=".25"/>
     {Array.from({length:10},(_,i)=><path key={i} d={`M${wall+(W-wall)*i/10} 0V${floor+(H-floor)*i/10}`} stroke="var(--slats)" strokeWidth={mobile?2:4} opacity=".35"/>)}
     <path d={`M0 ${floor}H${wall}L${W} ${H}H0Z`} fill={`url(#${prefix}-floor)`}/>
     <path d={`M0 ${floor}H${wall}`} stroke="var(--oak-light)" strokeWidth="4"/>
     {[.08,.3,.55,.8].map(t=><path key={t} d={`M${wall*t} ${floor+1}L${W*(t*1.4-.2)} ${H}`} stroke="var(--frame)" opacity=".07"/>)}
     <path d={`M0 ${floor+(H-floor)*.4}H${W}M0 ${floor+(H-floor)*.82}H${W}`} stroke="var(--frame)" opacity=".05"/>
     <path d={`M${mobile?28:58} ${short?8:30}H${wall-30}`} stroke="var(--paper)" strokeWidth="5" strokeLinecap="round"/>
     <text x={mobile?28:64} y={short?42:99} className={s.hallBrand}>{company}</text>
     <text x={mobile?29:66} y={short?66:124} className={s.hallSubtitle}>{sq?'RECEPSIONI · ZYRAT E EKIPIT':'RECEPTION · TEAM OFFICES'}</text>
     <g data-testid="office-hallway">{shown.map((person,i)=><Entrance key={person.id} person={person} x={mobile?37+i*201:68+i*210} y={short?90:mobile?210:218} width={mobile?142:145} height={short?210:mobile?290:282} prefix={prefix}/>)}</g>
     <g transform={`translate(${mobile?258:935} ${short?280:mobile?542:465})`} aria-hidden="true">
      <ellipse cx={mobile?63:100} cy="120" rx={mobile?87:130} ry="18" fill="#142b25" opacity=".14"/>
      <rect x="30" y="-20" width={mobile?65:100} height="55" rx="16" fill="var(--frame)"/>
      <path d={mobile?'M-8 22H120L133 39H-18Z':'M-20 22H190L212 46H-38Z'} fill="var(--oak-light)"/>
      <rect x={mobile?-8:-20} y={mobile?39:46} width={mobile?128:210} height={mobile?76:85} rx="4" fill={`url(#${prefix}-oak)`}/>
      <path d={mobile?'M4 49H108':'M-6 57H176'} stroke="#ffffff30"/>
      <rect x={mobile?60:110} y="-28" width={mobile?44:65} height="43" rx="4" fill="var(--frame)"/>
      <rect x={mobile?65:116} y="-23" width={mobile?34:53} height="31" rx="2" fill="#50736d"/>
      <text x={mobile?56:85} y={mobile?84:95} textAnchor="middle" className={s.deskLabel}>{sq?'Recepsioni':'Reception'}</text>
     </g>
     <g transform={`translate(${mobile?25:62} ${short?335:555})`} aria-hidden="true"><ellipse cx="18" cy="64" rx="33" ry="8" fill="#102920" opacity=".1"/><path d="M0 28H37L31 63H7Z" fill="var(--paper)"/><path d="M18 35V-18M18 7Q-16-18-8-29Q18-28 18 7M18 22Q49-15 45-24Q20-23 18 22M18-4Q8-36 22-42Q36-24 18-4" fill="#688276" stroke="#526e60" strokeWidth="2"/></g>
    </svg>
    <nav className={s.hallPager} aria-label={sq?'Lëviz në korridor':'Move through the hallway'}>
     <span>{doors.length?`${page*perPage+1}–${Math.min((page+1)*perPage,doors.length)} / ${doors.length}`:'0'} {sq?'zyra':'offices'}</span>
     {page>0?<a href={`/workzone/offices?doors=${page-1}`} aria-label={sq?'Zyrat e mëparshme':'Previous offices'}><ArrowLeft size={17}/></a>:<span aria-hidden="true"/>}
     {(page+1)*perPage<doors.length?<a href={`/workzone/offices?doors=${page+1}`} aria-label={sq?'Zyrat e tjera':'Next offices'}><ArrowRight size={17}/></a>:<span aria-hidden="true"/>}
    </nav>
   </div>;
  })}
  <details className={s.officeDirectory} data-testid="office-directory"><summary><Building2 size={16}/>{sq?'Zgjidh zyrën':'Choose office'}<ChevronDown size={14}/></summary><div role="navigation" aria-label={sq?'Të gjitha zyrat':'All offices'}>{doors.map(p=><a key={p.id} href={p.href}><span>{p.name}</span><small>{p.title}</small></a>)}</div></details>
 </div>;
}
