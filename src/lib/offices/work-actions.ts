'use server';
import { officeTeamSettings,saveOfficeMember } from './team-service';
import { ZodError } from 'zod';
import { OfficeError } from './work-access';
import { archiveOfficeTask, initializeOfficeCategories, officeWorkSnapshot, readOfficeThread, saveOfficeCategory, saveOfficeTask, sendOfficeMail } from './work-service';
import { UploadValidationError } from '@/lib/storage/upload-validation';
import { officeUnreadCount } from './work-service';

async function safe<T>(fn:()=>Promise<T>){
  try{return {ok:true as const,data:await fn()};}
  catch(error){return {ok:false as const,error:error instanceof OfficeError?error.code:error instanceof ZodError||error instanceof UploadValidationError?'INVALID':'FAILED'};}
}
export async function loadOfficeWork(){return safe(officeWorkSnapshot);}
export async function saveTaskAction(input:unknown){return safe(()=>saveOfficeTask(input));}
export async function archiveTaskAction(input:unknown){return safe(()=>archiveOfficeTask(input));}
export async function saveCategoryAction(input:unknown){return safe(()=>saveOfficeCategory(input));}
export async function initializeCategoriesAction(){return safe(initializeOfficeCategories);}
export async function sendMailAction(form:FormData){return safe(()=>sendOfficeMail(form));}
export async function readThreadAction(id:string){return safe(()=>readOfficeThread(id));}
export async function unreadOfficeAction(){return safe(officeUnreadCount);}

export async function loadOfficeTeamAction(){return safe(officeTeamSettings);}
export async function saveOfficeMemberAction(input:unknown){return safe(()=>saveOfficeMember(input));}
