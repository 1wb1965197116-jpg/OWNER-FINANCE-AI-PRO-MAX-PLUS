"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
function send(res,status,body,type="application/json; charset=utf-8"){res.writeHead(status,{"Content-Type":type,"X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'"});res.end(body);}
function readBody(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c;if(s.length>20000){reject(new Error("Request too large"));req.destroy();}});req.on("end",()=>{try{resolve(JSON.parse(s||"{}"));}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});}
const server=http.createServer(async(req,res)=>{
 if(req.method==="GET" && req.url==="/api/health") return send(res,200,JSON.stringify({ok:true,app:"OWNER FINANCE AI PRO MAX PLUS",aiConfigured:Boolean(process.env.OPENAI_API_KEY),rentcastConfigured:Boolean(process.env.RENTCAST_API_KEY)}));
 if(req.method==="POST" && req.url==="/api/ai/analyze"){
  try{
   const body=await readBody(req);
   const prompt=String(body.prompt||"").trim();
   if(!prompt || prompt.length>12000) return send(res,400,JSON.stringify({error:"Enter a prompt under 12,000 characters."}));
   if(!process.env.OPENAI_API_KEY) return send(res,503,JSON.stringify({error:"AI is not connected yet. Add OPENAI_API_KEY in your hosting provider's environment settings. The deal calculator and workspace work without it."}));
   const system="You are an analytical real-estate acquisition assistant for a U.S. investor. Analyze only the facts provided. Never invent property facts, comparable sales, rents, legal rules, title status, tax status, lender approval, or market data. Identify assumptions and missing diligence. Distinguish estimates from verified facts. Explain risks and alternatives. Do not provide legal, tax, lending, or investment advice as a licensed professional. Never execute offers, sign contracts, move money, contact sellers, or represent that an action was completed. The user must approve all offers, contracts, and money movement. For creative finance, flag due-on-sale, existing-loan consent, insurance, title, servicing, disclosure, and state-law review.";
   const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",instructions:system,input:prompt})});
   const data=await response.json();
   if(!response.ok) return send(res,502,JSON.stringify({error:data.error?.message||"AI provider request failed."}));
   const answer=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n").trim();
   return send(res,200,JSON.stringify({answer:answer||"No text response returned."}));
  }catch(e){return send(res,400,JSON.stringify({error:e.message||"Unable to process request."}));}
 }
 if(req.method==="POST" && req.url==="/api/properties/search"){
  try{
   const body=await readBody(req);
   if(!process.env.RENTCAST_API_KEY) return send(res,503,JSON.stringify({error:"Live property search is not connected yet. Add RENTCAST_API_KEY in Render Environment. Your key stays on the server."}));
   const location=String(body.location||"").trim();
   const params=new URLSearchParams();
   if(/^\\d{5}$/.test(location)) params.set("zipCode",location);
   else if(/^[A-Za-z]{2}$/.test(location)) params.set("state",location.toUpperCase());
   else if(location.includes(",")){
    const parts=location.split(",").map(x=>x.trim()).filter(Boolean);
    if(parts.length<2 || parts[1].length!==2) return send(res,400,JSON.stringify({error:"For city searches, enter City, ST using the two-letter state abbreviation. For statewide searches, enter the two-letter state abbreviation."}));
    params.set("city",parts[0]);params.set("state",parts[1].toUpperCase());
   } else return send(res,400,JSON.stringify({error:"Enter a ZIP code, a two-letter state abbreviation (for example NJ), or City, ST. The provider does not return every U.S. listing in one request."}));
   const min=Number(body.minPrice)||0,max=Number(body.maxPrice)||0;
   if(min<0||max<0||(min&&max&&min>max)) return send(res,400,JSON.stringify({error:"Check the price range; the minimum cannot exceed the maximum."}));
   if(min||max) params.set("price",(min?String(min):"*")+":"+(max?String(max):"*"));
   params.set("status","Active");params.set("limit","20");
   const url="https://api.rentcast.io/v1/listings/sale?"+params.toString();
   const upstream=await fetch(url,{headers:{"Accept":"application/json","X-Api-Key":process.env.RENTCAST_API_KEY}});
   const data=await upstream.json();
   if(!upstream.ok) return send(res,502,JSON.stringify({error:data.message||data.error||"Property data provider request failed. Check the RentCast plan, API key and search location."}));
   const listings=Array.isArray(data)?data:[];
   return send(res,200,JSON.stringify({source:"RentCast",retrievedAt:new Date().toISOString(),count:listings.length,listings:listings.slice(0,20)}));
  }catch(e){return send(res,502,JSON.stringify({error:e.message||"Unable to retrieve property listings."}));}
 }
 if(req.method!=="GET" && req.method!=="HEAD") return send(res,405,JSON.stringify({error:"Method not allowed"}));
 const pathname=decodeURIComponent((req.url||"/").split("?")[0]);
 const rel=pathname==="/"?"index.html":pathname.replace(/^\/+/, "");
 const target=path.resolve(ROOT,rel);
 if(!target.startsWith(ROOT+path.sep) && target!==ROOT) return send(res,403,"Forbidden","text/plain");
 fs.readFile(target,(err,data)=>{if(err)return send(res,404,"Not found","text/plain; charset=utf-8");send(res,200,data,MIME[path.extname(target)]||"application/octet-stream");});
});
server.listen(PORT,"0.0.0.0",()=>console.log("Owner Finance AI listening on "+PORT));
