import { readPhaseDocumentFile } from '@/lib/site-phase-documents/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const doc=await readPhaseDocumentFile((await params).id),download=new URL(request.url).searchParams.has('download');
    const inline=!download&&(doc.mime==='application/pdf'||doc.mime.startsWith('image/'));
    const encodedName=encodeURIComponent(doc.fileName).replace(/['()*]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(new Uint8Array(doc.dataBytes),{headers:{'Content-Type':doc.mime,'Content-Length':String(doc.size),'Content-Disposition':`${inline?'inline':'attachment'}; filename="document"; filename*=UTF-8''${encodedName}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});
  }catch{return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});}
}
