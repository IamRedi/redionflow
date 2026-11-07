'use server';
import { revalidatePath } from 'next/cache';
import { configureOwnerPin } from '@/lib/auth/owner-pin';
import { assetActionError } from '@/lib/company-assets/action-errors';
export async function configureOwnerPinAction(input:{name:string;email:string;pin:string}){
 try{const data=await configureOwnerPin(input);revalidatePath('/app/profile');revalidatePath('/workzone','layout');return {ok:true as const,data};}catch(e){return assetActionError(e);}
}
