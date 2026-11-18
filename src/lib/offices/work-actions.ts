'use server';
import { scheduleOfficeActivity } from './activity-notifications';
import { changeFieldTime,fieldTimeSnapshot } from './field-time';
import { officeTeamSettings,saveOfficeMember,prepareOfficeTeam } from './team-service';
import { ZodError } from 'zod';
import { OfficeError } from './work-access';
import { archiveOfficeThread,archiveOfficeTask, initializeOfficeCategories, officeWorkSnapshot, readOfficeThread, saveOfficeCategory, saveOfficeTask, sendOfficeMail } from './work-service';
import { UploadValidationError } from '@/lib/storage/upload-validation';
import { officeUnreadCount } from './work-service';

async function safe<T>(fn:()=>Promise<T>){
  try{return {ok:true as const,data:await fn()};}
  catch(error){return {ok:false as const,error:error instanceof OfficeError?error.code:error instanceof ZodError||error instanceof UploadValidationError?'INVALID':'FAILED'};}
}
export async function loadOfficeWork(){return safe(officeWorkSnapshot);}
export async function saveTaskAction(input:unknown){const r=await safe(()=>saveOfficeTask(input));if(r.ok&&r.data.activityVersion)scheduleOfficeActivity({kind:'task',taskId:r.data.id,version:r.data.activityVersion});return r;}
export async function archiveTaskAction(input:unknown){return safe(()=>archiveOfficeTask(input));}
export async function saveCategoryAction(input:unknown){return safe(()=>saveOfficeCategory(input));}
export async function initializeCategoriesAction(){return safe(initializeOfficeCategories);}
export async function sendMailAction(form:FormData){const r=await safe(()=>sendOfficeMail(form));if(r.ok)scheduleOfficeActivity({kind:'mail',messageId:String(form.get('requestId'))});return r;}
export async function readThreadAction(id:string){return safe(()=>readOfficeThread(id));}
export async function unreadOfficeAction(){return safe(officeUnreadCount);}

export async function loadOfficeTeamAction(){return safe(officeTeamSettings);}
export async function saveOfficeMemberAction(input:unknown){return safe(()=>saveOfficeMember(input));}

export async function prepareOfficeTeamAction(){return safe(prepareOfficeTeam);}

export async function loadFieldTimeAction(){return safe(fieldTimeSnapshot);}
export async function changeFieldTimeAction(input:unknown){return safe(()=>changeFieldTime(input));}

export async function archiveThreadAction(input:unknown){return safe(()=>archiveOfficeThread(input));}
