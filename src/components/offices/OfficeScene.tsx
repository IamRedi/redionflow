import {ReceptionScene} from './ReceptionScene';
import {StudioRoom} from './StudioRoom';
import type {OfficeArtworkState} from '@/lib/offices/artwork';
export type OfficeDoor={id:string;name:string;title:string;href:string;enabled:boolean;seat?:'megi'|'almet'|'staff';officePresence?:'active'|'paused'|null};
export type OfficeObject={kind:'mail'|'tasks'|'documents'|'calendar'|'workbooks'|'assistant';label:string;href:string;count?:number;shortLabel?:string};
export function OfficeScene({reception,company,companyLogo,name,title,doors,objects,sq,artwork,hours}:{reception:boolean;company:string;companyLogo?:string|null;name:string;title:string;doors:OfficeDoor[];objects:OfficeObject[];doorPage?:number;sq:boolean;artwork?:OfficeArtworkState;hours?:string}){
 return reception?<ReceptionScene company={company} companyLogo={companyLogo} doors={doors} sq={sq} hours={hours}/>:<StudioRoom company={company} name={name} title={title} objects={objects} sq={sq} artwork={artwork}/>;
}
