import {ReceptionScene} from './ReceptionScene';
import {StudioRoom} from './StudioRoom';
export type OfficeDoor={id:string;name:string;title:string;href:string;enabled:boolean};
export type OfficeObject={kind:'mail'|'tasks'|'documents'|'calendar'|'workbooks'|'assistant';label:string;href:string;count?:number;shortLabel?:string};
export function OfficeScene({reception,company,name,title,doors,objects,sq}:{reception:boolean;company:string;name:string;title:string;doors:OfficeDoor[];objects:OfficeObject[];doorPage?:number;sq:boolean}){
 return reception?<ReceptionScene company={company} doors={doors} sq={sq}/>:<StudioRoom company={company} name={name} title={title} objects={objects} sq={sq}/>;
}
