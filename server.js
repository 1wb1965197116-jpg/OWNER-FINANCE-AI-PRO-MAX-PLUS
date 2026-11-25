"use strict";
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {promisify}=require("node:util");
const {Pool}=require("pg");
const PORT=Number(process.env.PORT||3000),ROOT=__dirname;
const scrypt=promisify(crypto.scrypt);
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:false}:undefined}):null;
const attempts=new Map();
function send(res,status,body,type="application/json; charset=utf-8",extra={}){res.writeHead(status,{...extra,"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'"});res.end(body)}
function json(res,status,obj,extra={}){return send(res,status,JSON.stringify(obj),"application/json; charset=utf-8",extra)}
function readBody(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c;if(s.length>20000){reject(new Error("Request too large"));req.destroy()}});req.on("end",()=>{try{resolve(JSON.parse(s||"{}"))}catch{reject(new Error("Invalid JSON"))}});req.on("error",reject)})}
function parseCookies(req){const out={};for(const part of String(req.headers.cookie||"").split(";")){const i=part.indexOf("=");if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function cookieOptions(req){const secure=process.env.NODE_ENV==="production"||req.headers["x-forwarded-proto"]==="https";return "Path=/; HttpOnly; SameSite=Strict; Max-Age=604800"+(secure?"; Secure":"")}
function clearCookie(req){const secure=process.env.NODE_ENV==="production"||req.headers["x-forwarded-proto"]==="https";return "ofpm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"+(secure?"; Secure":"")}
function originOkay(req){const origin=req.headers.origin;if(!origin)return false;try{return new URL(origin).host===req.headers.host&&new URL(origin).protocol==="https:"||new URL(origin).host===req.headers.host&&new URL(origin).protocol==="http:"}catch{return false}}
function rateLimit(req){const key=(req.socket.remoteAddress||"unknown")+"|"+String(req.url||"").split("?")[0],now=Date.now(),old=attempts.get(key)||[];const fresh=old.filter(t=>now-t<15*60*1000);if(fresh.length>=10){attempts.set(key,fresh);return false}fresh.push(now);attempts.set(key,fresh);if(attempts.size>5000)attempts.clear();return true}
function dbUnavailable(res){return json(res,503,{error:"Secure accounts are not activated yet. Database provisioning and secret configuration are still pending; your local workspace remains available."})}
async function tx(fn){const c=await pool.connect();try{await c.query("BEGIN");const out=await fn(c);await c.query("COMMIT");return out}catch(e){try{await c.query("ROLLBACK")}catch{}throw e}finally{c.release()}}
async function authMode(c){await c.query("SELECT set_config('app.auth_mode','on',true)")}
async function setUser(c,id){await c.query("SELECT set_config('app.user_id',$1,true)",[id]);await c.query("SELECT set_config('app.auth_mode','off',true)")}
async function passwordHash(password){const salt=crypto.randomBytes(16);const key=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});return "scrypt$"+salt.toString("hex")+"$"+Buffer.from(key).toString("hex")}
async function verifyPassword(password,stored){try{const [kind,saltHex,hashHex]=String(stored).split("$");if(kind!=="scrypt"||!saltHex||!hashHex)return false;const salt=Buffer.from(saltHex,"hex"),expected=Buffer.from(hashHex,"hex");const actual=Buffer.from(await scrypt(password,salt,expected.length,{N:16384,r:8,p:1,maxmem:64*1024*1024}));return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}catch{return false}}
function tokenHash(token){return crypto.createHash("sha256").update(token).digest()}
async function currentSession(req){if(!pool)return null;const token=parseCookies(req).ofpm_session;if(!token||token.length<40||token.length>200)return null;return tx(async c=>{await authMode(c);const q=await c.query("SELECT s.user_id,u.email,u.display_name FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.account_status='active' LIMIT 1",[tokenHash(token)]);if(!q.rowCount)return null;const user=q.rows[0];await setUser(c,user.user_id);await c.query("UPDATE app_sessions SET last_seen_at=now() WHERE token_hash=$1",[tokenHash(token)]);return {id:user.user_id,email:user.email,displayName:user.display_name||""}})}
async function issueSession(c,userId){const token=crypto.randomBytes(32).toString("base64url");await c.query("INSERT INTO app_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",[userId,tokenHash(token)]);await c.query("INSERT INTO audit_events(user_id,event_type) VALUES($1,'login_succeeded')",[userId]);return token}
async function handleAuth(req,res,url){
 if(!pool)return dbUnavailable(res);
 if(req.method==="GET"&&url==="/api/auth/status"){try{const initialized=await tx(async c=>{await authMode(c);const q=await c.query("SELECT EXISTS(SELECT 1 FROM app_users) AS has_user");return q.rows[0].has_user});return json(res,200,{configured:true,initialized,bootstrapAvailable:!initialized&&Boolean(process.env.OWNER_BOOTSTRAP_TOKEN&&process.env.OWNER_BOOTSTRAP_TOKEN.length>=32)})}catch{return json(res,503,{configured:false,error:"Database is configured but not ready. Check the database connection and migration."})}}
 if(req.method==="GET"&&url==="/api/auth/me"){try{const user=await currentSession(req);return json(res,200,{authenticated:Boolean(user),user:user?{email:user.email,displayName:user.displayName}:null})}catch{return json(res,503,{error:"Account service temporarily unavailable."})}}
 if(!["POST"].includes(req.method))return json(res,405,{error:"Method not allowed"});
 if(!originOkay(req))return json(res,403,{error:"Request origin check failed."});
 if(!rateLimit(req))return json(res,429,{error:"Too many attempts. Wait 15 minutes and try again."});
 let body;try{body=await readBody(req)}catch(e){return json(res,400,{error:e.message})}
 try{
  if(url==="/api/auth/bootstrap"){
   const supplied=String(body.bootstrapToken||""),expected=String(process.env.OWNER_BOOTSTRAP_TOKEN||"");
   if(expected.length<32||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return json(res,403,{error:"Owner setup is not authorized. Check the one-time bootstrap configuration."});
   const email=String(body.email||"").trim().toLowerCase(),name=String(body.displayName||"").trim(),password=String(body.password||"");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>200)return json(res,400,{error:"Enter a valid email and a password between 12 and 200 characters."});
   const stored=await passwordHash(password),userId=crypto.randomUUID();
   const token=await tx(async c=>{await authMode(c);const count=await c.query("SELECT count(*)::int AS n FROM app_users");if(count.rows[0].n!==0)throw Object.assign(new Error("The first owner account already exists. Public registration is disabled."),{status:409});await c.query("SELECT set_config('app.user_id',$1,true)",[userId]);await c.query("INSERT INTO app_users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)",[userId,email,stored,name||null]);const t=await issueSession(c,userId);await c.query("SELECT set_config('app.auth_mode','off',true)");return t});
   return json(res,201,{ok:true,user:{email}},{"Set-Cookie":"ofpm_session="+encodeURIComponent(token)+"; "+cookieOptions(req)});
  }
  if(url==="/api/auth/login"){
   const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");
   if(!email||!password||password.length>200)return json(res,400,{error:"Enter your email and password."});
   const result=await tx(async c=>{await authMode(c);const q=await c.query("SELECT id,email,password_hash,display_name,account_status FROM app_users WHERE lower(email)=lower($1) LIMIT 1",[email]);if(!q.rowCount)return null;const u=q.rows[0];if(u.account_status!=="active"||!await verifyPassword(password,u.password_hash))return null;await setUser(c,u.id);await c.query("UPDATE app_users SET last_login_at=now(),updated_at=now() WHERE id=$1",[u.id]);const t=await issueSession(c,u.id);return {token:t,email:u.email}});
   if(!result)return json(res,401,{error:"Email or password is incorrect."});
   return json(res,200,{ok:true,user:{email:result.email}},{"Set-Cookie":"ofpm_session="+encodeURIComponent(result.token)+"; "+cookieOptions(req)});
  }
  if(url==="/api/auth/logout"){
   const token=parseCookies(req).ofpm_session;if(token){await tx(async c=>{await authMode(c);const q=await c.query("SELECT user_id FROM app_sessions WHERE token_hash=$1 AND revoked_at IS NULL",[tokenHash(token)]);if(q.rowCount){await setUser(c,q.rows[0].user_id);await c.query("UPDATE app_sessions SET revoked_at=now() WHERE token_hash=$1",[tokenHash(token)]);await c.query("INSERT INTO audit_events(user_id,event_type) VALUES($1,'logout')",[q.rows[0].user_id])}})}
   return json(res,200,{ok:true},{"Set-Cookie":clearCookie(req)});
  }
  return json(res,404,{error:"Unknown account endpoint."});
 }catch(e){if(e.status)return json(res,e.status,{error:e.message});console.error("Account operation failed:",e.message);return json(res,503,{error:"Account service could not complete the request. Check migration and database configuration."})}
}
const server=http.createServer(async(req,res)=>{
 const url=(req.url||"/").split("?")[0];
 if(req.method==="GET"&&url==="/api/health")return json(res,200,{ok:true,app:"OWNER FINANCE AI PRO MAX PLUS",aiConfigured:Boolean(process.env.OPENAI_API_KEY),rentcastConfigured:Boolean(process.env.RENTCAST_API_KEY),databaseConfigured:Boolean(pool)});
 if(url.startsWith("/api/auth/"))return handleAuth(req,res,url);
 if(req.method==="POST"&&url==="/api/ai/analyze"){
  try{const body=await readBody(req),prompt=String(body.prompt||"").trim();if(!prompt||prompt.length>12000)return json(res,400,{error:"Enter a prompt under 12,000 characters."});if(!process.env.OPENAI_API_KEY)return json(res,503,{error:"AI is not connected yet. Add OPENAI_API_KEY in your hosting provider's environment settings."});const system="You are an analytical real-estate acquisition assistant for a U.S. investor. Analyze only facts provided. Never invent property facts, comparable sales, rents, legal rules, title status, tax status, lender approval, or market data. Identify assumptions and missing diligence. Distinguish estimates from verified facts. Do not provide legal, tax, lending, or investment advice as a licensed professional. Never execute offers, sign contracts, move money, contact sellers, or represent that an action was completed. The user must approve all offers, contracts, and money movement. For creative finance, flag due-on-sale, existing-loan consent, insurance, title, servicing, disclosure, and state-law review.";const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",instructions:system,input:prompt})});const data=await response.json();if(!response.ok)return json(res,502,{error:data.error?.message||"AI provider request failed."});const answer=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n").trim();return json(res,200,{answer:answer||"No text response returned."})}catch(e){return json(res,400,{error:e.message||"Unable to process request."})}
 }
 if(req.method==="POST"&&url==="/api/properties/search"){
  try{const body=await readBody(req);if(!process.env.RENTCAST_API_KEY)return json(res,503,{error:"Live property search is not connected yet. Add RENTCAST_API_KEY in Render Environment."});const location=String(body.location||"").trim(),params=new URLSearchParams();if(/^\\d{5}$/.test(location))params.set("zipCode",location);else if(/^[A-Za-z]{2}$/.test(location))params.set("state",location.toUpperCase());else if(location.includes(",")){const parts=location.split(",").map(x=>x.trim()).filter(Boolean);if(parts.length<2||parts[1].length!==2)return json(res,400,{error:"Enter City, ST or a two-letter state abbreviation."});params.set("city",parts[0]);params.set("state",parts[1].toUpperCase())}else return json(res,400,{error:"Enter a ZIP code, state abbreviation or City, ST."});const min=Number(body.minPrice)||0,max=Number(body.maxPrice)||0;if(min<0||max<0||(min&&max&&min>max))return json(res,400,{error:"Check the price range."});if(min||max)params.set("price",(min?String(min):"*")+":"+(max?String(max):"*"));params.set("status","Active");params.set("limit","20");const upstream=await fetch("https://api.rentcast.io/v1/listings/sale?"+params.toString(),{headers:{"Accept":"application/json","X-Api-Key":process.env.RENTCAST_API_KEY}});const data=await upstream.json();if(!upstream.ok)return json(res,502,{error:data.message||data.error||"Property data provider request failed."});const listings=Array.isArray(data)?data:[];return json(res,200,{source:"RentCast",retrievedAt:new Date().toISOString(),count:listings.length,listings:listings.slice(0,20)})}catch(e){return json(res,502,{error:e.message||"Unable to retrieve property listings."})}
 }
 if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{error:"Method not allowed"});
 const pathname=decodeURIComponent(url),rel=pathname==="/ "||pathname==="/"? "index.html":pathname.replace(/^\/+/, ""),target=path.resolve(ROOT,rel);if(!target.startsWith(ROOT+path.sep)&&target!==ROOT)return send(res,403,"Forbidden","text/plain");fs.readFile(target,(err,data)=>{if(err)return send(res,404,"Not found","text/plain; charset=utf-8");send(res,200,data,MIME[path.extname(target)]||"application/octet-stream")});
});
server.listen(PORT,"0.0.0.0",()=>console.log("Owner Finance AI listening on "+PORT));
process.on("SIGTERM",async()=>{server.close();if(pool)await pool.end();process.exit(0)});
