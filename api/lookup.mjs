import dictionary from '../lib/lookup.cjs';
export default async function handler(request) {
 if(request.method!=='GET')return Response.json({error:'Only GET is allowed'},{status:405,headers:{Allow:'GET'}});
 const term=(new URL(request.url).searchParams.get('term')||'').trim();
 if(!term||term.length>250)return Response.json({error:'词条需为 1–250 个字符'},{status:400});
 try {const result=await dictionary.lookup(term);if(!result.meaning&&!result.ipa)return Response.json({error:'词典未返回结果，请稍后重试或手动补充'},{status:502});return Response.json(result,{headers:{'Cache-Control':result.meaning&&result.ipa?'public, s-maxage=86400, stale-while-revalidate=3600':'no-store'}})}
 catch{return Response.json({error:'下载失败，请稍后重试'},{status:502})}
}
