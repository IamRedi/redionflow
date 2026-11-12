import {ReceptionScene} from './ReceptionScene';
import {StudioRoom} from './StudioRoom';
import type {OfficeArtworkState} from '@/lib/offices/artwork';
export type OfficeDoor={id:string;name:string;title:string;href:string;enabled:boolean};
export type OfficeObject={kind:'mail'|'tasks'|'documents'|'calendar'|'workbooks'|'assistant';label:string;href:string;count?:number;shortLabel?:string};
export function OfficeScene({reception,company,companyLogo,name,title,doors,objects,sq,artwork}:{reception:boolean;company:string;companyLogo?:string|null;name:string;title:string;doors:OfficeDoor[];objects:OfficeObject[];doorPage?:number;sq:boolean;artwork?:OfficeArtworkState}){
 return reception?<ReceptionScene company={company} companyLogo={companyLogo} doors={doors} sq={sq}/>:<StudioRoom company={company} name={name} title={title} objects={objects} sq={sq} artwork={artwork}/>;
}
