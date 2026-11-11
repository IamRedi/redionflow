import { readOfficeAttachment } from '@/lib/offices/work-service';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const file=await readOfficeAttachment((await params).id);
    return new Response(new Uint8Array(file.dataBytes),{headers:{
      'Content-Type':file.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",
    }});
  }catch{return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});}
}
