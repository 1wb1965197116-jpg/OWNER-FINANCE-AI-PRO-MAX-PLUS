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
let dbReady=false;
async function verifyDatabaseRole(){
 if(!pool){dbReady=false;return}
 try{
  const q=await pool.query("SELECT current_user AS role_name,r.rolsuper,r.rolbypassrls,COALESCE(bool_and(t.relrowsecurity AND t.relforcerowsecurity AND pg_get_userbyid(t.relowner)<>current_user),false) AS tables_secured, count(t.oid)::int AS table_count FROM pg_roles r LEFT JOIN pg_class t ON t.relname=ANY(ARRAY['app_users','app_sessions','workspace_records','audit_events']) AND t.relnamespace='public'::regnamespace WHERE r.rolname=current_user GROUP BY current_user,r.rolsuper,r.rolbypassrls");
  const t=q.rows[0];
  const trig=await pool.query("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.audit_events'::regclass AND tgname='audit_events_append_only' AND NOT tgisinternal) AS present");
  dbReady=Boolean(t&&t.table_count===4&&!t.rolsuper&&!t.rolbypassrls&&t.tables_secured&&trig.rows[0].present);
 }catch{dbReady=false}
}
function makeAdminPool(){if(!process.env.ADMIN_DATABASE_URL)return null;return new Pool({connectionString:process.env.ADMIN_DATABASE_URL,max:1,connectionTimeoutMillis:7000,idleTimeoutMillis:10000,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:false}:undefined})}
async function provisionDatabase(req,res){
 if(req.method!=="POST")return json(res,405,{error:"Method not allowed."});
 if(!originOkay(req))return json(res,403,{error:"Request origin check failed."});
 if(!rateLimit(req))return json(res,429,{error:"Too many attempts. Wait 15 minutes and try again."});
 const expected=String(process.env.DB_SETUP_TOKEN||"");
 if(expected.length<32)return json(res,503,{error:"Add a private DB_SETUP_TOKEN of at least 32 characters in Render Environment first."});
 let body;try{body=await readBody(req,10000)}catch(e){return json(res,400,{error:e.message})}
 const supplied=String(body.setupToken||"");
 if(supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return json(res,403,{error:"Setup authorization failed."});
 const admin=makeAdminPool();
 if(!admin)return json(res,503,{error:"ADMIN_DATABASE_URL is not configured."});
 let appUrl="";
 try{
  const check=await admin.query("SELECT current_database() AS db");
  const rolePassword=crypto.randomBytes(36).toString("base64url");
  // Use a fresh role per provisioning attempt. Render-managed PostgreSQL may not
  // allow the admin login to ALTER an existing role, even when it can create roles.
  const roleName="ofpm_app_"+crypto.randomBytes(6).toString("hex");
  const roleIdent='"'+roleName.replace(/"/g,'""')+'"';
  await admin.query("CREATE ROLE "+roleIdent+" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '"+rolePassword+"'");
  const migration=fs.readFileSync(path.join(ROOT,"database/migrations/001_secure_workspace.sql"),"utf8");
  await admin.query(migration);
  await admin.query("CREATE OR REPLACE FUNCTION public.prevent_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$");
  await admin.query("DROP TRIGGER IF EXISTS audit_events_append_only ON public.audit_events");
  await admin.query("CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation()");
  const dbName='"'+String(check.rows[0].db).replace(/"/g,'""')+'"';
  await admin.query("GRANT CONNECT ON DATABASE "+dbName+" TO "+roleIdent+"");
  await admin.query("GRANT USAGE ON SCHEMA public TO "+roleIdent+"");
  await admin.query("GRANT SELECT,INSERT,UPDATE ON TABLE public.app_users TO "+roleIdent+"");
  await admin.query("GRANT SELECT,INSERT,UPDATE ON TABLE public.app_sessions TO "+roleIdent+"");
  await admin.query("GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.workspace_records TO "+roleIdent+"");
  await admin.query("GRANT SELECT,INSERT ON TABLE public.audit_events TO "+roleIdent+"");
  await admin.query("GRANT USAGE,SELECT ON SEQUENCE public.audit_events_id_seq TO "+roleIdent+"");
  const base=new URL(process.env.ADMIN_DATABASE_URL);
  base.username=roleName;base.password=rolePassword;
  appUrl=base.toString();
  const test=new Pool({connectionString:appUrl,max:1,connectionTimeoutMillis:7000,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:false}:undefined});
  try{
   const v=await test.query("SELECT current_user AS role_name,r.rolsuper,r.rolbypassrls FROM pg_roles r WHERE r.rolname=current_user");
   const owned=await test.query("SELECT count(*)::int AS n FROM pg_class WHERE relname=ANY(ARRAY['app_users','app_sessions','workspace_records','audit_events']) AND relnamespace='public'::regnamespace AND pg_get_userbyid(relowner)=current_user");
   const secured=await test.query("SELECT count(*)::int AS n FROM pg_class WHERE relname=ANY(ARRAY['app_users','app_sessions','workspace_records','audit_events']) AND relnamespace='public'::regnamespace AND relrowsecurity AND relforcerowsecurity");
   const trigger=await test.query("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.audit_events'::regclass AND tgname='audit_events_append_only' AND NOT tgisinternal) AS present");
   if(!v.rowCount||v.rows[0].rolsuper||v.rows[0].rolbypassrls||owned.rows[0].n!==0||secured.rows[0].n!==4||!trigger.rows[0].present)throw new Error("Restricted-role security verification did not pass.");
  }finally{await test.end()}
  return json(res,200,{ok:true,verified:true,appConnectionString:appUrl,message:"Database tables, forced row-level security, append-only audit protection, and restricted application role were created and verified. Copy the one-time connection string into Render DATABASE_URL, then remove ADMIN_DATABASE_URL and DB_SETUP_TOKEN."});
 }catch(e){appUrl="";console.error("Database provisioning failed:",String(e.message||"unknown error").slice(0,240));return json(res,500,{error:"Database provisioning did not finish or verify. No connection string was issued. Check the database migration and Render logs, then retry."})}
 finally{await admin.end().catch(()=>{})}
}
const attempts=new Map();
function send(res,status,body,type="application/json; charset=utf-8",extra={}){res.writeHead(status,{...extra,"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'"});res.end(body)}
function json(res,status,obj,extra={}){return send(res,status,JSON.stringify(obj),"application/json; charset=utf-8",extra)}
function readBody(req,maxBytes=20000){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c;if(s.length>maxBytes){reject(new Error("Request too large"));req.destroy()}});req.on("end",()=>{try{resolve(JSON.parse(s||"{}"))}catch{reject(new Error("Invalid JSON"))}});req.on("error",reject)})}
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

function workspaceKey(){const raw=String(process.env.WORKSPACE_ENCRYPTION_KEY||"");try{const key=Buffer.from(raw,"base64");return key.length===32?key:null}catch{return null}}
function encryptWorkspace(value){const key=workspaceKey();if(!key)throw new Error("Workspace encryption key is not configured.");const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,nonce),ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return {nonce,authTag:cipher.getAuthTag(),ciphertext}}
function decryptWorkspace(row){const key=workspaceKey();if(!key)throw new Error("Workspace encryption key is not configured.");const decipher=crypto.createDecipheriv("aes-256-gcm",key,row.nonce);decipher.setAuthTag(row.auth_tag);const plain=Buffer.concat([decipher.update(row.ciphertext),decipher.final()]).toString("utf8");return JSON.parse(plain)}
async function handleWorkspace(req,res,url){
 if(!pool||!dbReady)return dbUnavailable(res);
 if(!workspaceKey())return json(res,503,{error:"Cloud storage is not activated. The server-side encryption key must be configured after database setup."});
 let user;try{user=await currentSession(req)}catch{return json(res,503,{error:"Account service temporarily unavailable."})}
 if(!user)return json(res,401,{error:"Sign in before using encrypted cloud storage."});
 if(req.method==="GET"&&url==="/api/workspace/sync"){
  try{const records=await tx(async c=>{await setUser(c,user.id);const q=await c.query("SELECT client_record_id,nonce,auth_tag,ciphertext,updated_at FROM workspace_records WHERE record_type='user_setting' ORDER BY updated_at ASC");return q.rows.map(row=>({key:row.client_record_id,value:decryptWorkspace(row),updatedAt:row.updated_at}))});return json(res,200,{ok:true,count:records.length,records})}catch(e){console.error("Cloud restore failed:",e.message);return json(res,503,{error:"Cloud records could not be decrypted. Verify the encryption key and key version."})}
 }
 if(req.method==="POST"&&url==="/api/workspace/sync"){
  if(!originOkay(req))return json(res,403,{error:"Request origin check failed."});
  let body;try{body=await readBody(req,5*1024*1024)}catch(e){return json(res,400,{error:e.message})}
  const records=body.records;if(!Array.isArray(records)||records.length<1||records.length>100)return json(res,400,{error:"Send between 1 and 100 workspace records per batch."});
  for(const r of records){if(!r||typeof r.key!=="string"||!(r.key==="ofpmplus_workspace_v1"||r.key.startsWith("ofpmplus_"))||r.key.length>180||!Object.prototype.hasOwnProperty.call(r,"value"))return json(res,400,{error:"A workspace record has an invalid key or value."})}
  try{const count=await tx(async c=>{await setUser(c,user.id);let n=0;for(const r of records){const enc=encryptWorkspace(r.value);const q=await c.query("INSERT INTO workspace_records(user_id,record_type,client_record_id,schema_version,encryption_key_version,nonce,auth_tag,ciphertext,safe_metadata) VALUES($1,'user_setting',$2,1,1,$3,$4,$5,'{}'::jsonb) ON CONFLICT(user_id,record_type,client_record_id) DO UPDATE SET schema_version=EXCLUDED.schema_version,encryption_key_version=EXCLUDED.encryption_key_version,nonce=EXCLUDED.nonce,auth_tag=EXCLUDED.auth_tag,ciphertext=EXCLUDED.ciphertext,updated_at=now() RETURNING (xmax=0) AS inserted",[user.id,r.key,enc.nonce,enc.authTag,enc.ciphertext]);await c.query("INSERT INTO audit_events(user_id,event_type,record_type,record_id) VALUES($1,$2,'user_setting',$3)",[user.id,q.rows[0].inserted?"record_created":"record_updated",r.key]);n++}return n});return json(res,200,{ok:true,saved:count,encryptedAtRest:true})}catch(e){console.error("Cloud sync save failed:",e.message);return json(res,503,{error:"Cloud sync could not save this batch. No local data was deleted."})}
 }
 if(req.method==="DELETE"&&url.startsWith("/api/workspace/record/")){
  if(!originOkay(req))return json(res,403,{error:"Request origin check failed."});const id=decodeURIComponent(url.slice("/api/workspace/record/".length));if(!(id==="ofpmplus_workspace_v1"||id.startsWith("ofpmplus_"))||id.length>180)return json(res,400,{error:"Invalid workspace record key."});
  try{const deleted=await tx(async c=>{await setUser(c,user.id);const q=await c.query("DELETE FROM workspace_records WHERE record_type='user_setting' AND client_record_id=$1 RETURNING id",[id]);if(q.rowCount)await c.query("INSERT INTO audit_events(user_id,event_type,record_type,record_id) VALUES($1,'record_deleted','user_setting',$2)",[user.id,id]);return q.rowCount});return json(res,200,{ok:true,deleted})}catch{return json(res,503,{error:"Cloud record could not be deleted."})}
 }
 return json(res,405,{error:"Method not allowed"});
}

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

async function handleISpeedWebhook(req,res){
 if(req.method!=="POST")return json(res,405,{error:"Method not allowed."});
 const secret=String(process.env.ISPEEDTOLEAD_WEBHOOK_SECRET||"");
 if(secret.length<40)return json(res,503,{error:"Webhook receiver is not configured."});
 const supplied=String(req.headers["x-ofpm-webhook-secret"]||"");
 const a=Buffer.from(supplied),b=Buffer.from(secret);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return json(res,401,{error:"Webhook authentication failed."});
 if(!pool||!dbReady||!workspaceKey())return json(res,503,{error:"Secure cloud storage is not ready."});
 let body;try{body=await readBody(req,1024*1024)}catch(e){return json(res,400,{error:e.message})}
 const pick=(obj,keys)=>{for(const k of keys){for(const [name,value] of Object.entries(obj||{})){if(name.toLowerCase().replace(/[^a-z0-9]/g,"")===k.toLowerCase().replace(/[^a-z0-9]/g,"")&&value!=null&&String(value).trim())return String(value).trim()}}return""};
 const flat={...(body||{}),...(body.data&&typeof body.data==="object"?body.data:{}),...(body.lead&&typeof body.lead==="object"?body.lead:{})};
 const lead={name:pick(flat,["sellerName","name","contactName","fullName"])||"Seller name not provided",phone:pick(flat,["phone","phoneNumber","mobile"]),email:pick(flat,["email","emailAddress"]),address:pick(flat,["propertyAddress","address","streetAddress"]),price:pick(flat,["askingPrice","price","listPrice"]),estimatedValue:pick(flat,["estimatedValue","arv","marketValue"]),situation:pick(flat,["motivation","reason","sellerSituation"]),timeline:pick(flat,["timeline","sellTimeframe"]),finance:pick(flat,["sellerFinancing","financing","terms"])||"Not discussed",permission:pick(flat,["contactPermission","consent"]),notes:pick(flat,["notes","description","comments"]),source:"iSpeedToLead via Zapier",contact:"Phone",follow:"",history:[],created:new Date().toISOString()};
 if(!lead.address&&!lead.phone&&!lead.email)return json(res,400,{error:"Payload needs a property address, phone number, or email address.",receivedFields:Object.keys(flat).slice(0,40)});
 const identity=(lead.address||lead.phone||lead.email).toLowerCase().replace(/[^a-z0-9]/g,"");
 const clientId="ofpmplus_seller_crm_v1";
 try{
  const result=await tx(async c=>{
   await c.query("SELECT set_config('app.auth_mode','on',true)");
   const u=await c.query("SELECT id FROM app_users WHERE account_status='active' ORDER BY created_at ASC LIMIT 1");
   if(!u.rowCount)throw new Error("Owner account not found.");
   await setUser(c,u.rows[0].id);
   const q=await c.query("SELECT nonce,auth_tag,ciphertext FROM workspace_records WHERE record_type='user_setting' AND client_record_id=$1 LIMIT 1",[clientId]);
   let leads=[];
   if(q.rowCount){const row=q.rows[0];leads=decryptWorkspace({nonce:row.nonce,auth_tag:row.auth_tag,ciphertext:row.ciphertext})||[]}
   const duplicate=leads.some(x=>{const vals=[x.address,x.phone,x.email].filter(Boolean).map(v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,""));return vals.includes(identity)});
   if(duplicate)return {added:false,total:leads.length};
   lead.id=crypto.randomUUID();leads.unshift(lead);
   const enc=encryptWorkspace(leads);
   await c.query("INSERT INTO workspace_records(user_id,record_type,client_record_id,schema_version,encryption_key_version,nonce,auth_tag,ciphertext,safe_metadata) VALUES($1,'user_setting',$2,1,1,$3,$4,$5,'{}'::jsonb) ON CONFLICT(user_id,record_type,client_record_id) DO UPDATE SET nonce=EXCLUDED.nonce,auth_tag=EXCLUDED.auth_tag,ciphertext=EXCLUDED.ciphertext,updated_at=now()",[u.rows[0].id,clientId,enc.nonce,enc.authTag,enc.ciphertext]);
   await c.query("INSERT INTO audit_events(user_id,event_type,record_type,record_id) VALUES($1,'record_updated','user_setting',$2)",[u.rows[0].id,"ispeedtolead_webhook"]);
   return {added:true,total:leads.length};
  });
  return json(res,200,{ok:true,imported:result.added,duplicate:!result.added,totalSellerLeads:result.total,message:result.added?"Lead securely received. Sign in and restore cloud workspace to load it on your device.":"Duplicate lead ignored."});
 }catch(e){console.error("iSpeedToLead webhook failed:",String(e.message||"unknown").slice(0,200));return json(res,503,{error:"Lead could not be securely stored. Check database and encryption configuration."})}
}

const server=http.createServer(async(req,res)=>{
 const url=(req.url||"/").split("?")[0];
 if(url==="/api/admin/provision-database")return provisionDatabase(req,res);
 if(url==="/api/integrations/ispeedtolead")return handleISpeedWebhook(req,res);
 if(req.method==="GET"&&url==="/api/health")return json(res,200,{ok:true,app:"OWNER FINANCE AI PRO MAX PLUS",aiConfigured:Boolean(process.env.OPENAI_API_KEY),rentcastConfigured:Boolean(process.env.RENTCAST_API_KEY),databaseConfigured:Boolean(pool),databaseReady:dbReady,databaseProvisioningAvailable:Boolean(process.env.ADMIN_DATABASE_URL&&String(process.env.DB_SETUP_TOKEN||"").length>=32),cloudEncryptionConfigured:Boolean(workspaceKey())});
 if(url.startsWith("/api/auth/"))return handleAuth(req,res,url);
 if(url.startsWith("/api/workspace/"))return handleWorkspace(req,res,url);
 if(req.method==="POST"&&url==="/api/ai/analyze"){
  try{const body=await readBody(req),prompt=String(body.prompt||"").trim();if(!prompt||prompt.length>12000)return json(res,400,{error:"Enter a prompt under 12,000 characters."});if(!process.env.OPENAI_API_KEY)return json(res,503,{error:"AI is not connected yet. Add OPENAI_API_KEY in your hosting provider's environment settings."});const system="You are an analytical real-estate acquisition assistant for a U.S. investor. Analyze only facts provided. Never invent property facts, comparable sales, rents, legal rules, title status, tax status, lender approval, or market data. Identify assumptions and missing diligence. Distinguish estimates from verified facts. Do not provide legal, tax, lending, or investment advice as a licensed professional. Never execute offers, sign contracts, move money, contact sellers, or represent that an action was completed. The user must approve all offers, contracts, and money movement. For creative finance, flag due-on-sale, existing-loan consent, insurance, title, servicing, disclosure, and state-law review.";const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",instructions:system,input:prompt})});const data=await response.json();if(!response.ok)return json(res,502,{error:data.error?.message||"AI provider request failed."});const answer=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n").trim();return json(res,200,{answer:answer||"No text response returned."})}catch(e){return json(res,400,{error:e.message||"Unable to process request."})}
 }

 if(req.method==="POST"&&url==="/api/research/search"){
  if(!originOkay(req))return json(res,403,{error:"Request origin check failed."});
  if(!rateLimit(req))return json(res,429,{error:"Research limit reached for this session. Wait 15 minutes and try again."});
  try{
   const body=await readBody(req,12000),query=String(body.query||"").trim(),location=String(body.location||"").trim();
   if(!query||query.length>500)return json(res,400,{error:"Enter a research query under 500 characters."});
   if(!process.env.FIRECRAWL_API_KEY)return json(res,503,{error:"Internet research is not connected yet. Add FIRECRAWL_API_KEY in Render Environment."});
   const limit=Math.max(3,Math.min(8,Number(body.limit)||5));
   const payload={query:query+(location?" in "+location:""),limit,sources:["web"],scrapeOptions:{formats:["markdown"],onlyMainContent:true}};
   const upstream=await fetch("https://api.firecrawl.dev/v2/search",{method:"POST",headers:{"Authorization":"Bearer "+process.env.FIRECRAWL_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
   const data=await upstream.json().catch(()=>({}));
   if(!upstream.ok)return json(res,502,{error:data.error||data.message||"Internet search provider request failed."});
   const raw=Array.isArray(data.data)?data.data:(Array.isArray(data.web)?data.web:(Array.isArray(data.data?.web)?data.data.web:[]));
   const results=raw.slice(0,limit).map((item)=>({title:String(item.title||item.metadata?.title||"Untitled page").slice(0,300),url:String(item.url||item.metadata?.sourceURL||""),description:String(item.description||item.metadata?.description||item.snippet||"").slice(0,1200),markdown:String(item.markdown||item.content?.markdown||item.content||"").slice(0,10000)})).filter(x=>/^https?:\/\//i.test(x.url));
   return json(res,200,{source:"Firecrawl",query,location,retrievedAt:new Date().toISOString(),count:results.length,results});
  }catch(e){return json(res,502,{error:e.name==="TimeoutError"?"Internet search timed out. Try again with a narrower search.":e.message||"Internet search failed."})}
 }
 if(req.method==="POST"&&url==="/api/research/scrape"){
  if(!originOkay(req))return json(res,403,{error:"Request origin check failed."});
  if(!rateLimit(req))return json(res,429,{error:"Scraper limit reached for this session. Wait 15 minutes and try again."});
  try{
   const body=await readBody(req,12000),rawUrl=String(body.url||"").trim();
   if(!rawUrl||rawUrl.length>2000)return json(res,400,{error:"Enter a valid webpage URL."});
   let parsed;try{parsed=new URL(rawUrl)}catch{return json(res,400,{error:"Enter a complete URL beginning with https://"});}
   const host=parsed.hostname.toLowerCase(),blocked=host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host==="127.0.0.1"||host==="0.0.0.0"||host==="::1"||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);
   if(!["http:","https:"].includes(parsed.protocol)||parsed.username||parsed.password||blocked)return json(res,400,{error:"Only public HTTP or HTTPS webpages can be scraped."});
   if(!process.env.FIRECRAWL_API_KEY)return json(res,503,{error:"Internet research is not connected yet. Add FIRECRAWL_API_KEY in Render Environment."});
   const upstream=await fetch("https://api.firecrawl.dev/v2/scrape",{method:"POST",headers:{"Authorization":"Bearer "+process.env.FIRECRAWL_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({url:parsed.toString(),formats:["markdown"],onlyMainContent:true}),signal:AbortSignal.timeout(60000)});
   const data=await upstream.json().catch(()=>({}));
   if(!upstream.ok)return json(res,502,{error:data.error||data.message||"Page scraping provider request failed."});
   const doc=data.data||data;
   return json(res,200,{source:"Firecrawl",url:doc.metadata?.sourceURL||parsed.toString(),title:doc.metadata?.title||"Scraped webpage",markdown:String(doc.markdown||"").slice(0,16000),retrievedAt:new Date().toISOString()});
  }catch(e){return json(res,502,{error:e.name==="TimeoutError"?"Page scraping timed out. Try again.":e.message||"Page scraping failed."})}
 }
 if(req.method==="POST"&&url==="/api/properties/search"){
  try{const body=await readBody(req);if(!process.env.RENTCAST_API_KEY)return json(res,503,{error:"Live property search is not connected yet. Add RENTCAST_API_KEY in Render Environment."});const location=String(body.location||"").trim(),params=new URLSearchParams();if(/^\\d{5}$/.test(location))params.set("zipCode",location);else if(/^[A-Za-z]{2}$/.test(location))params.set("state",location.toUpperCase());else if(location.includes(",")){const parts=location.split(",").map(x=>x.trim()).filter(Boolean);if(parts.length<2||parts[1].length!==2)return json(res,400,{error:"Enter City, ST or a two-letter state abbreviation."});params.set("city",parts[0]);params.set("state",parts[1].toUpperCase())}else return json(res,400,{error:"Enter a ZIP code, state abbreviation or City, ST."});const min=Number(body.minPrice)||0,max=Number(body.maxPrice)||0;if(min<0||max<0||(min&&max&&min>max))return json(res,400,{error:"Check the price range."});if(min||max)params.set("price",(min?String(min):"*")+":"+(max?String(max):"*"));params.set("status","Active");params.set("limit","20");const upstream=await fetch("https://api.rentcast.io/v1/listings/sale?"+params.toString(),{headers:{"Accept":"application/json","X-Api-Key":process.env.RENTCAST_API_KEY}});const data=await upstream.json();if(!upstream.ok)return json(res,502,{error:data.message||data.error||"Property data provider request failed."});const listings=Array.isArray(data)?data:[];return json(res,200,{source:"RentCast",retrievedAt:new Date().toISOString(),count:listings.length,listings:listings.slice(0,20)})}catch(e){return json(res,502,{error:e.message||"Unable to retrieve property listings."})}
 }
 if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{error:"Method not allowed"});
 const pathname=decodeURIComponent(url),rel=pathname==="/ "||pathname==="/"? "index.html":pathname.replace(/^\/+/, ""),target=path.resolve(ROOT,rel);if(!target.startsWith(ROOT+path.sep)&&target!==ROOT)return send(res,403,"Forbidden","text/plain");fs.readFile(target,(err,data)=>{if(err)return send(res,404,"Not found","text/plain; charset=utf-8");send(res,200,data,MIME[path.extname(target)]||"application/octet-stream")});
});
server.listen(PORT,"0.0.0.0",()=>{console.log("Owner Finance AI listening on "+PORT);verifyDatabaseRole()});
process.on("SIGTERM",async()=>{server.close();if(pool)await pool.end();process.exit(0)});
