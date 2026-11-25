"use strict";
const KEY="ofpmplus_workspace_v1";
let deals=load(),activeDealId=null,lastOffer="";
function load(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function persist(){localStorage.setItem(KEY,JSON.stringify(deals));renderAll()}
function speakText(t){if(!("speechSynthesis" in window)){alert("Text-to-speech is not supported in this browser.");return}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(t||""));u.rate=.96;window.speechSynthesis.speak(u)}function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel()}function money(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(n)||0)}
function num(v){return Number(v)||0}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function go(view){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+view));document.querySelectorAll(".navitem").forEach(x=>x.classList.toggle("active",x.dataset.view===view));document.getElementById("pageTitle").textContent=({dashboard:"Dashboard",deals:"Deal Analyzer",acquisition:"Acquisition Search",pipeline:"Deal Pipeline",completed:"Deals Completed & Revenue",documents:"Offer & Documents",assistant:"AI Assistant",diligence:"Due Diligence",finance:"Financing Lab",portfolio:"Portfolio Command Center",compare:"Deal Comparison",contracts:"Contracts & Counteroffers",motivated:"Motivated Seller Leads",crm:"Seller CRM",buyers:"Buyer Competition",autopilot:"AI Autopilot",settings:"Settings",contracts:"Contracts & Counteroffers",crm:"Seller CRM",buyers:"Buyer Competition",autopilot:"AI Autopilot"})[view]||"Dashboard";window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
document.getElementById("newDealBtn").onclick=()=>go("deals");
function dealScore(d){const c=d.metrics||calc(d),price=num(d.asking),rent=num(d.rent),arv=num(d.arv),rep=num(d.repairs),cash=num(c.cash);let score=0,flags=[];if(rent>0){if(c.cashflow>0)score+=15;if(c.cashflow>=500)score+=5;if(c.dscr>=1.25)score+=15;else if(c.dscr>=1)score+=9;else flags.push('Rent does not cover estimated debt and entered expenses')}else flags.push('Monthly rent is missing');if(arv>0&&price>0){const margin=(arv-price-rep-num(d.closing))/arv;if(margin>=.20)score+=20;else if(margin>=.10)score+=14;else if(margin>0)score+=7;else flags.push('Entered ARV does not exceed price, repairs and closing costs')}else flags.push('ARV is missing');if(price>0&&rep>=0){const rr=rep/price;if(rr<=.10)score+=10;else if(rr<=.20)score+=6;else score+=2}else flags.push('Asking price or repair estimate is missing');if(cash>0&&rent>0){const coc=(c.cashflow*12)/cash;if(coc>=.15)score+=15;else if(coc>=.08)score+=10;else if(coc>0)score+=5}else flags.push('Cash required or rent data is incomplete');if(num(d.expenses)>0)score+=5;else flags.push('Taxes, insurance and HOA/operating expenses need confirmation');if(num(d.rate)>0)score+=5;else if(d.strategy!=='Cash purchase')flags.push('Financing rate is missing');if(price>0)score+=5;if(num(d.balloon)>0)flags.push('Balloon payoff date requires a repayment plan');if(String(d.strategy||'').includes('Subject-to'))flags.push('Subject-to: review due-on-sale, existing loan and insurance risks');if(!d.address)flags.push('Property address is missing');return{score:Math.max(0,Math.min(100,Math.round(score))),label:score>=80?'Strong preliminary screen':score>=60?'Worth further review':score>=40?'Needs more diligence':'Weak or incomplete screen',flags};}
function calc(d){const price=num(d.asking),arv=num(d.arv),rep=num(d.repairs),down=num(d.down),rate=num(d.rate)/1200,years=num(d.years)||30,loan=Math.max(0,price-down),n=years*12,payment=rate?loan*rate/(1-Math.pow(1+rate,-n)):loan/Math.max(n,1),monthly=payment+num(d.expenses),rent=num(d.rent),cash=down+rep+num(d.closing),equity=arv-price-rep-num(d.closing),cashflow=rent-monthly;return{loan,payment,monthly,cash,equity,cashflow,cap:arv?equity/arv*100:0,dscr:monthly?rent/monthly:0}}
document.getElementById("dealForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget),d=Object.fromEntries(f.entries());d.id=crypto.randomUUID?crypto.randomUUID():String(Date.now());d.created=new Date().toISOString();d.status="New lead";d.approved=false;const c=calc(d);d.metrics=c;deals.unshift(d);activeDealId=d.id;persist();showAnalysis(d);go("deals");});
function showAnalysis(d){const c=d.metrics||calc(d);document.getElementById("analysisResult").classList.remove("hidden");document.getElementById("dealSummary").classList.add("hidden");document.getElementById("dealSummary").textContent="";document.getElementById("analysisContent").innerHTML='<div class="score-panel"><div><span>Preliminary screening score</span><strong>'+dealScore(d).score+'/100</strong><small>'+esc(dealScore(d).label)+'</small></div><div class="score-track"><i style="width:'+dealScore(d).score+'%"></i></div><ul>'+dealScore(d).flags.slice(0,5).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div class="resultgrid"><div class="resultbox"><span>Estimated monthly debt + expenses</span><b>'+money(c.monthly)+'</b></div><div class="resultbox"><span>Estimated monthly cash flow</span><b>'+money(c.cashflow)+'</b></div><div class="resultbox"><span>Estimated equity spread</span><b>'+money(c.equity)+'</b></div><div class="resultbox"><span>Estimated cash required</span><b>'+money(c.cash)+'</b></div><div class="resultbox"><span>Estimated loan amount</span><b>'+money(c.loan)+'</b></div><div class="resultbox"><span>Rent / payment ratio</span><b>'+c.dscr.toFixed(2)+'x</b></div></div><p class="muted">Illustrative only. Payment estimate uses a fully amortizing fixed-rate loan and excludes taxes, insurance, HOA, vacancy, maintenance, management, utilities, closing adjustments and other costs unless entered. For seller financing, the calculator does not model balloon payoff or legal enforceability. Verify every input independently.</p><div class="actions"><button class="secondary" id="toDocs">Prepare offer draft</button><button class="secondary" id="toAI">Ask AI to review</button><button class="secondary" id="summarizeDeal">Summarize this deal</button><button class="secondary" id="speakAnalysis">Talk through numbers</button><button class="secondary" id="stopDealSpeech">Stop</button></div>';document.getElementById("toDocs").onclick=()=>{fillDocSelect(d.id);go("documents")};document.getElementById("speakAnalysis").onclick=()=>speakText("Deal analysis for "+d.address+". Strategy: "+d.strategy+". Asking price: "+money(d.asking)+". Estimated loan: "+money(c.loan)+". Estimated monthly debt and expenses: "+money(c.monthly)+". Estimated monthly cash flow: "+money(c.cashflow)+". Estimated equity spread: "+money(c.equity)+". Estimated cash required: "+money(c.cash)+". These are estimates based only on the information entered.");document.getElementById("stopDealSpeech").onclick=stopSpeaking;document.getElementById("summarizeDeal").onclick=()=>summarizeDeal(d);document.getElementById("toAI").onclick=()=>{document.getElementById("aiPrompt").value="Review this property deal and list risks, missing diligence and possible negotiation points. Facts provided:\n"+JSON.stringify(d,null,2);go("assistant")}}
async function summarizeDeal(d){
 const box=document.getElementById("dealSummary"),btn=document.getElementById("summarizeDeal");
 if(!d)return;box.classList.remove("hidden");box.textContent="Preparing your deal summary…";
 if(btn){btn.disabled=true;btn.textContent="Summarizing…"}
 const prompt="Create a concise spoken-style real-estate deal summary. Include deal at a glance, financing and cash needed, income and estimated cash flow, main risks and missing information, questions before an offer, and a cautious preliminary assessment. Use only supplied facts. Treat blank or zero values as unknown where appropriate. Do not invent comparable sales, market facts, taxes, insurance, legal facts, or verified property details. Clearly label estimates. Deal data:\n"+JSON.stringify({...d,metrics:d.metrics||calc(d)},null,2);
 try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Summary request failed.");box.textContent=data.answer||"No summary returned.";speakText(box.textContent)}
 catch(e){box.textContent=e.message||"Unable to create the summary. Check the AI connection."}
 finally{if(btn){btn.disabled=false;btn.textContent="Summarize this deal"}}
}
function renderReadinessDashboard(){
 const host=document.getElementById("readinessDashboard");if(!host)return;
 const activeDeals=deals.filter(d=>!["Closed","Rejected"].includes(d.status||""));
 const totalChecks=activeDeals.length*DILIGENCE_GROUPS.reduce((n,g)=>n+g[1].length,0);
 const checked=activeDeals.reduce((n,d)=>n+Object.values(d.diligence?.checks||{}).filter(Boolean).length,0);
 const pct=totalChecks?Math.round(checked/totalChecks*100):0;
 const overdue=closingDeadlines.filter(x=>!x.done&&deadlineState(x)==="Overdue");
 const soon=closingDeadlines.filter(x=>!x.done&&(["Due today"].includes(deadlineState(x))||deadlineState(x).startsWith("Due in ")||deadlineState(x)==="Due within 30 days"));
 const needsApproval=contractQueue.filter(x=>x.kind==="Outgoing draft"&&x.status==="Draft - not approved");
 const incomingReview=contractQueue.filter(x=>String(x.status||"").toLowerCase().includes("review"));
 const overdueFollowups=sellerLeads.filter(s=>s.follow&&new Date(s.follow+"T23:59:59")<new Date());
 const openOffers=buyerOffers.filter(o=>!["Accepted","Rejected","Withdrawn","Expired"].includes(o.status||""));
 const items=[
  {label:"Active deals",value:activeDeals.length,detail:"Not closed or rejected",view:"pipeline",tone:""},
  {label:"Due diligence",value:checked+"/"+totalChecks,detail:pct+"% of active-deal checklist items recorded",view:"diligence",tone:pct===100&&totalChecks?"good":""},
  {label:"Contract drafts awaiting your review",value:needsApproval.length,detail:"Not sent; your review is still required",view:"contracts",tone:needsApproval.length?"warn":""},
  {label:"Incoming documents marked for review",value:incomingReview.length,detail:"Open and review the original document",view:"contracts",tone:incomingReview.length?"warn":""},
  {label:"Overdue closing deadlines",value:overdue.length,detail:soon.length+" also due within 30 days",view:"contracts",tone:overdue.length?"risk":""},
  {label:"Overdue seller follow-ups",value:overdueFollowups.length,detail:sellerLeads.length+" seller records total",view:"crm",tone:overdueFollowups.length?"warn":""},
  {label:"Open buyer offers recorded",value:openOffers.length,detail:"Only offers entered by you; no bids are generated",view:"buyers",tone:""}
 ];
 host.innerHTML='<div class="readiness-grid">'+items.map(x=>'<button class="readiness-card '+x.tone+'" data-readiness-go="'+x.view+'"><span>'+esc(x.label)+'</span><b>'+esc(x.value)+'</b><small>'+esc(x.detail)+'</small><i>Open workspace →</i></button>').join("")+'</div><div class="readiness-footnote">Readiness is calculated only from records entered in this browser. A checked item is not independently verified. This dashboard does not confirm title, legal compliance, financing, property condition, buyer funds or contract enforceability.</div>';
 host.querySelectorAll("[data-readiness-go]").forEach(b=>b.onclick=()=>go(b.dataset.readinessGo));
}
function renderCompletedDeals(){
 const host=document.getElementById("completedDealsList"),metrics=document.getElementById("completedMetrics");if(!host||!metrics)return;
 const closed=deals.filter(d=>d.status==="Closed");
 const rows=closed.map(d=>{const c=d.closeout||{},sale=num(c.salePrice),acq=num(c.acquisitionCost),rehab=num(c.rehabCosts),closing=num(c.closingCosts),other=num(c.otherCosts),complete=c.salePrice!==undefined&&c.acquisitionCost!==undefined;return{d,c,sale,acq,rehab,closing,other,profit:complete?sale-acq-rehab-closing-other:null,complete}});
 const gross=rows.reduce((s,x)=>s+x.sale,0),profit=rows.reduce((s,x)=>s+(x.profit??0),0),completeCount=rows.filter(x=>x.complete).length;
 metrics.innerHTML=[["Completed deals",closed.length],["Recorded sale proceeds",money(gross)],["Recorded net deal profit",money(profit)],["Profit figures complete",completeCount+"/"+closed.length]].map(x=>'<div class="portfolio-metric"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join("");
 if(!rows.length){host.className="empty";host.textContent="No deals marked Closed yet. Change a deal's stage to Closed in Deal Pipeline to add its closing figures here.";return}
 host.className="";host.innerHTML=rows.map(x=>'<div class="portfolio-property"><div><b>'+esc(x.d.address||"Address missing")+'</b><small>Closed '+esc(x.c.closedDate||"Date not entered")+' · '+esc(x.d.profile||"")+'</small></div><div class="portfolio-property-values"><span>Sale proceeds: '+money(x.sale)+'</span><span>Net deal profit: '+(x.profit===null?"Incomplete":money(x.profit))+'</span></div><form class="formgrid" data-closeout-form="'+esc(x.d.id)+'" style="margin-top:13px"><label>Sale price / proceeds ($)<input name="salePrice" type="number" min="0" step="0.01" value="'+(x.c.salePrice??"")+'" placeholder="Actual sale price"></label><label>Acquisition cost ($)<input name="acquisitionCost" type="number" min="0" step="0.01" value="'+(x.c.acquisitionCost??x.d.asking??"")+'" placeholder="Actual purchase price"></label><label>Rehab / improvement costs ($)<input name="rehabCosts" type="number" min="0" step="0.01" value="'+(x.c.rehabCosts??"")+'" placeholder="Actual costs"></label><label>Closing costs ($)<input name="closingCosts" type="number" min="0" step="0.01" value="'+(x.c.closingCosts??"")+'" placeholder="Actual costs"></label><label>Other transaction costs ($)<input name="otherCosts" type="number" min="0" step="0.01" value="'+(x.c.otherCosts??"")+'" placeholder="Taxes, holding, commissions, etc."></label><label>Closing date<input name="closedDate" type="date" value="'+esc(x.c.closedDate||"")+'"></label><div class="span2 actions"><button class="primary" type="submit">Save closing figures</button></div></form></div>').join("");
 host.querySelectorAll("[data-closeout-form]").forEach(form=>form.onsubmit=e=>{e.preventDefault();const d=deals.find(z=>z.id===form.dataset.closeoutForm);if(!d)return;const f=new FormData(form),c={};for(const k of ["salePrice","acquisitionCost","rehabCosts","closingCosts","otherCosts"])if(String(f.get(k)||"").trim()!=="")c[k]=Number(f.get(k));c.closedDate=String(f.get("closedDate")||"");d.closeout=c;persist();go("completed")});
}
function renderAll(){renderReadinessDashboard();renderComparisonOptions();renderPortfolio();renderCompletedDeals();renderSellerCRM();renderBuyerBoard();document.getElementById("statDeals").textContent=deals.length;document.getElementById("statEquity").textContent=money(deals.reduce((s,d)=>s+num(d.metrics?.equity),0));document.getElementById("statApprovals").textContent=deals.filter(d=>d.offerDraft&&!d.approved).length;const recent=deals.slice(0,5);document.getElementById("recentDeals").innerHTML=recent.length?'<div class="tablewrap"><table><thead><tr><th>Property</th><th>Profile</th><th>Strategy</th><th>Asking</th></tr></thead><tbody>'+recent.map(d=>'<tr><td>'+esc(d.address)+'</td><td>'+esc(d.profile)+'</td><td>'+esc(d.strategy)+'</td><td>'+money(d.asking)+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty">No deals yet. Start by analyzing your first property.</div>';const pipe=document.getElementById("pipelineTable");pipe.innerHTML=deals.length?'<div class="tablewrap"><table><thead><tr><th>Property</th><th>Profile</th><th>Strategy</th><th>Asking</th><th>Est. equity</th><th>Screen score</th><th>Stage</th><th></th></tr></thead><tbody>'+[...deals].sort((a,b)=>dealScore(b).score-dealScore(a).score).map(d=>'<tr><td>'+esc(d.address)+'</td><td>'+esc(d.profile)+'</td><td>'+esc(d.strategy)+'</td><td>'+money(d.asking)+'</td><td>'+money(d.metrics?.equity)+'</td><td><b>'+dealScore(d).score+'/100</b></td><td><select class="statusselect" data-status="'+d.id+'">'+["New lead","Researching","Contacted","Negotiating","Offer draft","Under contract","Due diligence","Closed","Rejected"].map(s=>'<option '+(d.status===s?'selected':'')+'>'+s+'</option>').join("")+'</select></td><td><button class="textbtn" data-open="'+d.id+'">Open</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">No deals saved yet.</div>';document.querySelectorAll("[data-status]").forEach(el=>el.onchange=()=>{const d=deals.find(x=>x.id===el.dataset.status);if(d){d.status=el.value;persist()}});document.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>{const d=deals.find(x=>x.id===el.dataset.open);if(d){activeDealId=d.id;showAnalysis(d);go("deals")}});fillDocSelect(document.getElementById("documentDeal").value);renderDiligenceDealOptions()}
function fillDocSelect(selected){const el=document.getElementById("documentDeal");const prev=selected||el.value;el.innerHTML='<option value="">Select a deal</option>'+deals.map(d=>'<option value="'+d.id+'">'+esc(d.address)+' — '+esc(d.strategy)+'</option>').join("");if(deals.some(d=>d.id===prev))el.value=prev}
document.getElementById("draftOffer").onclick=()=>{const id=document.getElementById("documentDeal").value,d=deals.find(x=>x.id===id);if(!d){alert("Choose a saved deal first.");return}const amount=num(document.getElementById("offerAmount").value),earnest=num(document.getElementById("earnest").value),terms=document.getElementById("terms").value.trim();if(!amount){alert("Enter a proposed offer amount.");return}const draft='NON-BINDING OFFER DISCUSSION DRAFT — NOT A CONTRACT\n\nProperty: '+d.address+'\nBuyer profile: '+d.profile+'\nProposed strategy: '+d.strategy+'\nAsking price provided: '+money(d.asking)+'\nProposed offer amount: '+money(amount)+'\nProposed earnest money: '+money(earnest)+'\n\nProposed terms / contingencies:\n'+(terms||"To be negotiated and documented in attorney-prepared agreement.")+'\n\nSUBJECT TO: independent property and title due diligence; inspection; financing and underwriting; review of leases, liens, taxes and existing loans; insurance availability; required seller/lender/servicer consents; applicable federal, state and local disclosures; and approval of final written documents by buyer and qualified local counsel. No binding agreement is formed by this planning draft. Do not sign or send this draft as a contract.';lastOffer=draft;d.offerDraft=draft;d.approved=false;persist();const out=document.getElementById("offerOutput");out.textContent=draft;out.classList.remove("hidden");document.getElementById("approveOffer").disabled=false;};
document.getElementById("approveOffer").onclick=()=>{const d=deals.find(x=>x.id===document.getElementById("documentDeal").value);if(!d?.offerDraft)return;if(!confirm("Confirm you reviewed this planning draft and want to mark it approved for your own next-step review? This does not send it or make it a contract."))return;d.approved=true;d.status="Offer draft";persist();alert("Marked approved in this local workspace. Nothing was sent.");};
document.getElementById("documentDeal").onchange=()=>{const d=deals.find(x=>x.id===document.getElementById("documentDeal").value);document.getElementById("offerOutput").classList.add("hidden");document.getElementById("approveOffer").disabled=!d?.offerDraft;if(d?.offerDraft){document.getElementById("offerOutput").textContent=d.offerDraft;document.getElementById("offerOutput").classList.remove("hidden")}};
document.getElementById("askAI").onclick=async()=>{const prompt=document.getElementById("aiPrompt").value.trim(),out=document.getElementById("aiAnswer"),btn=document.getElementById("askAI");if(!prompt){alert("Enter a question first.");return}btn.disabled=true;btn.textContent="Analyzing…";out.classList.remove("hidden");out.textContent="Working…";try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),data=await r.json();out.textContent=data.answer||data.error||"No response received.";document.getElementById("speakAI").disabled=!data.answer;document.getElementById("stopAI").disabled=!data.answer}catch{out.textContent="AI service is unavailable. Deploy the Node server and configure its API key to enable AI."}finally{btn.disabled=false;btn.textContent="Analyze with AI"}};
document.getElementById("speakAI").onclick=()=>speakText(document.getElementById("aiAnswer").textContent);document.getElementById("stopAI").onclick=stopSpeaking;async function checkHealth(){try{const r=await fetch("/api/health"),d=await r.json(),s=d.aiConfigured?"AI connected":"AI key not configured";document.getElementById("aiStatus").textContent=s;document.getElementById("settingsAI").textContent=s;document.getElementById("propertyDataStatus").textContent=d.rentcastConfigured?"Live listings connected":"RentCast key needed";const cloud=document.getElementById("settingsCloud");if(cloud){if(!d.databaseConfigured)cloud.textContent="Not activated — browser storage only";else{try{const a=await fetch("/api/auth/status"),v=await a.json();cloud.textContent=!a.ok?"Database needs setup":v.initialized?"Secure account ready":"Database ready — owner setup required"}catch{cloud.textContent="Account service unavailable"}}}}catch{document.getElementById("aiStatus").textContent="Server unavailable";document.getElementById("settingsAI").textContent="Deploy Node server to enable AI";document.getElementById("propertyDataStatus").textContent="Connection unavailable";const cloud=document.getElementById("settingsCloud");if(cloud)cloud.textContent="Connection unavailable"}}

/* Password-encrypted local workspace backup. Data never leaves this browser. */
const VAULT_ALLOWED_PREFIX="ofpmplus_";
function vaultBytesToBase64(bytes){let binary="";for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary)}
function vaultBase64ToBytes(value){const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function vaultRecords(){const records={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k===KEY||k.startsWith(VAULT_ALLOWED_PREFIX)){const raw=localStorage.getItem(k);try{records[k]=JSON.parse(raw)}catch{throw new Error("A saved workspace record could not be read: "+k)}}}if(!Array.isArray(records[KEY]))records[KEY]=deals;return records}
async function vaultDeriveKey(passphrase,salt){const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(passphrase),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
function vaultStatus(message,isError=false){const el=document.getElementById("vaultStatus");if(el){el.textContent=message;el.classList.toggle("vault-error",isError)}}
document.getElementById("createEncryptedBackup").onclick=async()=>{
 const pass=document.getElementById("vaultPassphrase").value,confirmPass=document.getElementById("vaultPassphraseConfirm").value,btn=document.getElementById("createEncryptedBackup");
 if(pass.length<12){vaultStatus("Use a passphrase with at least 12 characters.",true);return}
 if(pass!==confirmPass){vaultStatus("The passphrases do not match.",true);return}
 if(!window.crypto?.subtle){vaultStatus("This browser does not support the required encryption feature. Try an up-to-date browser over HTTPS.",true);return}
 btn.disabled=true;vaultStatus("Encrypting your workspace on this device…");
 try{
  const records=vaultRecords(),plain=new TextEncoder().encode(JSON.stringify({format:"OFPMPLUS-ENCRYPTED-BACKUP",version:1,createdAt:new Date().toISOString(),records}));
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await vaultDeriveKey(pass,salt);
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain));
  const envelope={format:"OFPMPLUS-VAULT",version:1,kdf:"PBKDF2-SHA256",iterations:310000,cipher:"AES-256-GCM",salt:vaultBytesToBase64(salt),iv:vaultBytesToBase64(iv),data:vaultBytesToBase64(cipher)};
  const blob=new Blob([JSON.stringify(envelope)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="owner-finance-ai-pro-max-plus-"+new Date().toISOString().slice(0,10)+".ofpmvault";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  vaultStatus("Encrypted backup created. Store the file and passphrase separately. Records remain on this device.");
 }catch(e){vaultStatus("Backup failed: "+(e.message||"Unable to encrypt the workspace."),true)}
 finally{btn.disabled=false}
};
document.getElementById("chooseEncryptedBackup").onclick=()=>document.getElementById("encryptedBackupFile").click();
document.getElementById("encryptedBackupFile").onchange=async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 const pass=document.getElementById("vaultPassphrase").value;
 if(!pass){vaultStatus("Enter the backup passphrase first, then choose Restore encrypted backup.",true);ev.target.value="";return}
 if(file.size>25*1024*1024){vaultStatus("This backup is larger than the 25 MB safety limit.",true);ev.target.value="";return}
 if(!window.crypto?.subtle){vaultStatus("This browser does not support the required decryption feature.",true);ev.target.value="";return}
 try{
  const envelope=JSON.parse(await file.text());
  if(envelope.format!=="OFPMPLUS-VAULT"||envelope.version!==1||envelope.kdf!=="PBKDF2-SHA256"||envelope.cipher!=="AES-256-GCM"||envelope.iterations!==310000)throw new Error("This is not a supported encrypted workspace backup.");
  const key=await vaultDeriveKey(pass,vaultBase64ToBytes(envelope.salt));
  const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:vaultBase64ToBytes(envelope.iv)},key,vaultBase64ToBytes(envelope.data));
  const payload=JSON.parse(new TextDecoder().decode(clear));
  if(payload.format!=="OFPMPLUS-ENCRYPTED-BACKUP"||payload.version!==1||!payload.records||typeof payload.records!=="object"||!Array.isArray(payload.records[KEY]))throw new Error("The decrypted backup does not contain valid deal records.");
  const entries=Object.entries(payload.records);
  if(entries.some(([k])=>k!==KEY&&!k.startsWith(VAULT_ALLOWED_PREFIX)))throw new Error("Backup contains an unrecognized storage record. Nothing was restored.");
  for(const [k,v] of entries)if(k!==KEY&&typeof v==="undefined")throw new Error("Backup contains an invalid record.");
  if(!confirm("Restore "+payload.records[KEY].length+" deal(s) and "+(entries.length-1)+" additional workspace record set(s)? This replaces matching app records in this browser. Export the current workspace first if you need to keep it."))return;
  for(const [k,v] of entries)localStorage.setItem(k,JSON.stringify(v));
  vaultStatus("Backup restored. Reloading the workspace…");location.reload();
 }catch(e){vaultStatus("Restore failed. The passphrase may be incorrect, or the backup may be damaged. "+(e.name==="OperationError"?"":(e.message||"")),true)}
 finally{ev.target.value=""}
};

document.getElementById("exportData").onclick=()=>{const blob=new Blob([JSON.stringify({exported:new Date().toISOString(),deals},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="owner-finance-ai-deals.json";a.click();URL.revokeObjectURL(url)};
document.getElementById("clearData").onclick=()=>{if(!confirm("Permanently delete all deal data saved in this browser? Export a backup first if needed."))return;deals=[];persist();document.getElementById("analysisResult").classList.add("hidden");document.getElementById("offerOutput").classList.add("hidden")};

function buildAcquisitionSearch(){
 const location=document.getElementById("acqLocation").value.trim()||"United States";
 const min=document.getElementById("acqMin").value.trim(),max=document.getElementById("acqMax").value.trim();
 const type=document.getElementById("acqType").value,strategy=document.getElementById("acqStrategy").value,priority=document.getElementById("acqPriority").value;
 const price=(min||max)?(" price "+(min?"over $"+min:"")+(min&&max?" and":"")+(max?" under $"+max:"")):"";
 const typeTerm=type==="Any property type"?"investment property":type;
 const strategyTerms={"All strategies":"investment property for sale","Owner financing":"owner financing OR owner carry","Seller financing":"seller financing OR seller carryback","Motivated seller":"motivated seller OR must sell OR distressed property","For sale by owner (FSBO)":"for sale by owner FSBO","Subject-to / existing mortgage":"subject to existing mortgage real estate","Lease option":"lease option real estate","Foreclosure / auction":"foreclosure OR auction property","Off-market investment property":"off market investment property"};
 const term=(strategyTerms[strategy]||"investment property")+" "+typeTerm+" "+location+price;
 const q=s=>encodeURIComponent(s);
 const sources=[
  ["Broad web search","https://www.google.com/search?q="+q(term)],
  ["Owner-financed listings","https://www.google.com/search?q="+q('"owner financing" OR "seller financing" '+typeTerm+" "+location)],
  ["For-sale-by-owner leads","https://www.google.com/search?q="+q('"for sale by owner" '+typeTerm+" "+location+price)],
  ["Motivated / distressed sellers","https://www.google.com/search?q="+q('"motivated seller" OR "must sell" OR distressed '+typeTerm+" "+location)],
  ["Zillow search","https://www.google.com/search?q="+q("site:zillow.com "+typeTerm+" "+location+price)],
  ["Realtor.com search","https://www.google.com/search?q="+q("site:realtor.com "+typeTerm+" "+location+price)],
  ["Redfin search","https://www.google.com/search?q="+q("site:redfin.com "+typeTerm+" "+location+price)],
  ["Auction / foreclosure leads","https://www.google.com/search?q="+q("foreclosure auction "+typeTerm+" "+location)]
 ];
 if(strategy==="Owner financing"||strategy==="Seller financing"||strategy==="Subject-to / existing mortgage"||strategy==="Lease option") sources.unshift(["Creative-finance seller leads","https://www.google.com/search?q="+q('"'+strategyTerms[strategy]+'" '+typeTerm+" "+location)]);
 const box=document.getElementById("acqResults");
 box.classList.remove("empty");
 box.innerHTML='<div class="search-intro"><b>Search brief</b><p>'+esc(typeTerm)+' · '+esc(location)+' · '+esc(strategy)+' · '+esc(price||"Any price")+' · '+esc(priority)+'</p><small>These are live search links, not a feed of verified listings. Review each result and confirm details at the source.</small></div><div class="source-grid">'+sources.map(([name,url])=>'<a class="source-link" href="'+url+'" target="_blank" rel="noopener noreferrer"><b>'+esc(name)+'</b><span>Open current search ↗</span></a>').join("")+'</div>';
 window.lastAcqSpeech="Nationwide acquisition search prepared. Location: "+location+". Property type: "+type+". Strategy: "+strategy+". Price range: "+(min?"at least "+money(min):"no minimum")+" to "+(max?money(max):"no maximum")+". I created "+sources.length+" search destinations. These are search links, not verified property leads. Confirm active status, seller terms, title, condition, rents, taxes and all costs before making an offer.";
 return window.lastAcqSpeech;
}
document.getElementById("acquisitionForm").addEventListener("submit",e=>{e.preventDefault();buildAcquisitionSearch()});
document.getElementById("speakSearch").onclick=()=>speakText(window.lastAcqSpeech||buildAcquisitionSearch());


async function searchLiveProperties(){
 const btn=document.getElementById("livePropertySearch"),box=document.getElementById("livePropertyResults");
 const location=document.getElementById("acqLocation").value.trim();
 const minPrice=document.getElementById("acqMin").value,maxPrice=document.getElementById("acqMax").value;
 btn.disabled=true;btn.textContent="Searching live listings…";box.classList.remove("empty");box.textContent="Contacting the property data provider securely…";
 try{
  const r=await fetch("/api/properties/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location,minPrice,maxPrice})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||"Live property search failed.");
  if(!data.listings.length){box.innerHTML='<div class="empty">No matching active sale listings were returned for this search. Try another city, ZIP or state, or widen the price range.</div>';return}
  const rows=data.listings.map(p=>({p,price:Number(p.price)||0,days:Number(p.daysOnMarket)||0}));
  rows.sort((a,b)=>a.price-b.price);
  box.innerHTML='<div class="search-intro"><b>'+data.count+' listings returned by '+esc(data.source)+'</b><p>Retrieved '+esc(new Date(data.retrievedAt).toLocaleString())+' · Sorted by asking price, lowest first · Not an investment recommendation</p></div><div class="live-list-grid">'+rows.map(({p})=>'<article class="live-list-card"><b>'+esc(p.formattedAddress||[p.addressLine1,p.city,p.state,p.zipCode].filter(Boolean).join(", "))+'</b><strong>'+money(p.price)+'</strong><span>'+esc(p.propertyType||"Property type not provided")+' · '+(p.bedrooms??"—")+' bd · '+(p.bathrooms??"—")+' ba · '+(p.squareFootage?Number(p.squareFootage).toLocaleString()+" sq ft":"size not listed")+'</span><span>Status: '+esc(p.status||"Not provided")+' · Days on market: '+(p.daysOnMarket??"—")+'</span><small>MLS: '+esc(p.mlsNumber||"Not provided")+' · Data source: RentCast</small><button class="secondary small add-live-deal" data-address="'+esc(p.formattedAddress||"")+'" data-price="'+(Number(p.price)||0)+'">Add to my deal analyzer</button></article>').join("")+'</div><p class="muted">Listing data is provider-supplied and may be delayed or incomplete. Verify active status, listing terms, seller authority, property condition, title, liens, taxes, insurance, comparable sales and rental assumptions independently. A listing does not establish seller-financing availability.</p>';
  document.querySelectorAll(".add-live-deal").forEach(b=>b.onclick=()=>{go("deals");const form=document.getElementById("dealForm");form.elements.address.value=b.dataset.address;form.elements.asking.value=b.dataset.price;});
  window.lastLiveListingSpeech="The live search returned "+data.count+" property listings from RentCast for "+location+". The lowest asking price in the returned group is "+money(rows[0].price)+". The highest asking price is "+money(rows[rows.length-1].price)+". These are listing prices, not verified values or recommended offers. Check each property independently.";
  const speak=document.createElement("button");speak.className="secondary small";speak.textContent="Read listing results aloud";speak.onclick=()=>speakText(window.lastLiveListingSpeech);box.prepend(speak);
 }catch(e){box.innerHTML='<div class="notice">'+esc(e.message)+'</div>'}
 finally{btn.disabled=false;btn.textContent="Search live property listings"}
}
document.getElementById("livePropertySearch").addEventListener("click",searchLiveProperties);

const DILIGENCE_GROUPS=[
 ["Seller, ownership & title",["Confirm seller identity and legal authority to sell","Obtain current title commitment or preliminary title report","Review recorded liens, mortgages, judgments and tax liens","Confirm vesting, ownership entities and required signatures","Check easements, restrictions, covenants and access rights"]],
 ["Property condition & compliance",["Complete professional property inspection","Review roof, foundation, structure and major systems","Check permits, open permits and code violations","Confirm zoning, legal use and permitted unit count","Review environmental, flood, lead and other applicable risks"]],
 ["Financial & rental verification",["Verify property taxes and any delinquencies","Obtain insurance quote and confirm insurability","Verify HOA/condo fees, rules and special assessments","Review leases, deposits, rent ledger and tenant status","Support rent estimate with current comparable rental evidence","Support ARV and offer assumptions with comparable sales","Estimate vacancy, repairs, maintenance, utilities and management"]],
 ["Financing & transaction terms",["Verify seller's authority and willingness for proposed financing","For existing loans, review due-on-sale, lender consent and loan status with counsel","Review interest, amortization, balloon date and payoff/refinance plan","Confirm title, escrow, servicing, insurance and tax payment arrangements","Have a local real-estate attorney review state-specific documents and disclosures","Confirm closing costs, prorations, contingencies and possession terms"]]
];
function selectedDiligenceDeal(){return deals.find(d=>d.id===document.getElementById("diligenceDeal").value)}
function renderDiligenceDealOptions(){const el=document.getElementById("diligenceDeal");if(!el)return;const prev=el.value;el.innerHTML='<option value="">Select a saved deal</option>'+deals.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.address)+' — '+esc(d.strategy)+'</option>').join("");if(deals.some(d=>d.id===prev))el.value=prev;renderDiligence()}
function renderDiligence(){
 const d=selectedDiligenceDeal(),workspace=document.getElementById("diligenceWorkspace"),empty=document.getElementById("diligenceEmpty");
 if(!d){workspace.classList.add("hidden");empty.classList.remove("hidden");return}
 workspace.classList.remove("hidden");empty.classList.add("hidden");
 d.diligence=d.diligence||{checks:{},notes:""};
 const total=DILIGENCE_GROUPS.reduce((n,g)=>n+g[1].length,0),done=Object.values(d.diligence.checks).filter(Boolean).length,pct=Math.round(done/total*100);
 document.getElementById("diligenceProgressText").textContent=done+" of "+total+" completed";
 document.getElementById("diligenceProgressPercent").textContent=pct+"%";
 document.getElementById("diligenceProgressBar").style.width=pct+"%";
 document.getElementById("diligenceNotes").value=d.diligence.notes||"";
 document.getElementById("diligenceChecklist").innerHTML=DILIGENCE_GROUPS.map((group,gi)=>'<div class="diligence-group"><h4>'+esc(group[0])+'</h4><div class="diligence-items">'+group[1].map((label,i)=>{const key=gi+"-"+i;return '<label class="diligence-item"><input type="checkbox" data-diligence="'+key+'" '+(d.diligence.checks[key]?'checked':'')+'><span>'+esc(label)+'</span></label>'}).join("")+'</div></div>').join("");
 document.querySelectorAll("[data-diligence]").forEach(el=>el.onchange=()=>{const current=selectedDiligenceDeal();if(!current)return;current.diligence=current.diligence||{checks:{},notes:""};current.diligence.checks[el.dataset.diligence]=el.checked;persist();renderDiligence()});
}
document.getElementById("diligenceDeal").addEventListener("change",renderDiligence);
document.getElementById("diligenceNotes").addEventListener("input",e=>{const d=selectedDiligenceDeal();if(!d)return;d.diligence=d.diligence||{checks:{},notes:""};d.diligence.notes=e.target.value;localStorage.setItem(KEY,JSON.stringify(deals))});
document.getElementById("speakDiligence").onclick=()=>{const d=selectedDiligenceDeal();if(!d)return;const total=DILIGENCE_GROUPS.reduce((n,g)=>n+g[1].length,0),done=Object.values((d.diligence||{checks:{}}).checks||{}).filter(Boolean).length;const remaining=[];DILIGENCE_GROUPS.forEach((g,gi)=>g[1].forEach((label,i)=>{if(!(d.diligence?.checks?.[gi+"-"+i]))remaining.push(label)}));speakText("Due diligence status for "+d.address+". "+done+" of "+total+" checklist items completed. "+remaining.length+" remain. Outstanding items include: "+remaining.slice(0,8).join("; ")+(remaining.length>8?"; and more":"")+". Checklist entries are user-tracked and have not been independently verified.");};
document.getElementById("resetDiligence").onclick=()=>{const d=selectedDiligenceDeal();if(!d||!confirm("Reset all due-diligence checkmarks and notes for this property?"))return;d.diligence={checks:{},notes:""};persist();renderDiligence()};

let lastFinanceScenario=null;
function renderFinanceDealOptions(){const el=document.getElementById("financeDeal");if(!el)return;const prev=el.value;el.innerHTML='<option value="">Select a saved deal</option>'+deals.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.address)+' — '+esc(d.strategy)+'</option>').join("");if(deals.some(d=>d.id===prev))el.value=prev}
function selectedFinanceDeal(){return deals.find(d=>d.id===document.getElementById("financeDeal").value)}
function financeField(id){return num(document.getElementById(id).value)}
function loadFinanceFromDeal(){const d=selectedFinanceDeal();if(!d)return;const p=d.financePlan||{};document.getElementById("finPrice").value=p.price??d.asking??"";document.getElementById("finDown").value=p.down??d.down??"";document.getElementById("finRate").value=p.rate??d.rate??"";document.getElementById("finAmort").value=p.amort??d.years??30;document.getElementById("finBalloon").value=p.balloon??d.balloon??"";document.getElementById("finType").value=p.type??"amortizing";document.getElementById("finRent").value=p.rent??d.rent??"";document.getElementById("finExpenses").value=p.expenses??d.expenses??"";document.getElementById("finClosing").value=p.closing??d.closing??"";document.getElementById("financeResults").classList.add("hidden");lastFinanceScenario=null}
function calculateFinanceScenario(){
 const price=financeField("finPrice"),down=financeField("finDown"),annual=financeField("finRate"),amort=financeField("finAmort"),balloon=financeField("finBalloon"),rent=financeField("finRent"),expenses=financeField("finExpenses"),closing=financeField("finClosing"),type=document.getElementById("finType").value;
 if(!(price>0)||down<0||down>price||annual<0||!(amort>0)||amort>50){alert("Enter a valid purchase price, down payment, interest rate and amortization period.");return null}
 if(balloon>50){alert("Balloon period cannot exceed 50 years.");return null}
 const principal=price-down,rate=annual/1200,n=Math.round(amort*12),periods=balloon>0?Math.min(Math.round(balloon*12),n):n;
 let payment=0,balance=principal,totalPaid=0,totalInterest=0,rows=[];
 if(type==="interestOnly"){payment=principal*rate;for(let m=1;m<=periods;m++){const interest=balance*rate;totalPaid+=payment;totalInterest+=interest;if(m<=12)rows.push({m,payment,principal:0,interest,balance})}}
 else{payment=rate===0?principal/n:principal*rate/(1-Math.pow(1+rate,-n));for(let m=1;m<=periods;m++){const interest=balance*rate,principalPaid=Math.min(balance,Math.max(0,payment-interest));balance=Math.max(0,balance-principalPaid);totalPaid+=payment;totalInterest+=interest;if(m<=12)rows.push({m,payment,principal:principalPaid,interest,balance})}}
 const maturityBalance=type==="interestOnly"?principal:balance,monthlyOutflow=payment+expenses,cashToClose=down+closing,monthlyNet=rent-monthlyOutflow;
 const s={price,down,rate:annual,amort,balloon,type,rent,expenses,closing,principal,payment,periods,totalPaid,totalInterest,maturityBalance,monthlyOutflow,cashToClose,monthlyNet,rows};lastFinanceScenario=s;document.getElementById("financeResults").classList.remove("hidden");
 const metrics=[["Seller-financed principal",money(principal)],["Estimated monthly principal + interest",money(payment)],["Buyer cash to close (down + entered costs)",money(cashToClose)],["Monthly payment + entered expenses",money(monthlyOutflow)],["Estimated monthly rent less payment / expenses",money(monthlyNet)],["Estimated balloon / remaining balance",money(maturityBalance)],["Total scheduled payments to maturity",money(totalPaid)],["Estimated interest paid to maturity",money(totalInterest)]];
 document.getElementById("financeMetrics").innerHTML=metrics.map(([k,v])=>'<div class="resultbox"><span>'+esc(k)+'</span><b>'+v+'</b></div>').join("");
 const warnings=[];if(!balloon)warnings.push("No balloon date entered: schedule assumes payments continue through the full amortization term.");else if(balloon<amort)warnings.push("Balloon maturity occurs before the amortization schedule ends. The remaining balance is due at that time under the modeled terms.");if(type==="interestOnly")warnings.push("Interest-only payments do not reduce principal; the modeled principal remains due at maturity.");if(monthlyNet<0)warnings.push("Entered rent is below the modeled monthly payment plus entered expenses. Other costs may make the result lower.");warnings.push("The model excludes vacancy, maintenance, management, utilities, servicing charges and costs not entered above.");
 document.getElementById("financeWarnings").textContent=warnings.join(" ");
 document.getElementById("financeSchedule").innerHTML='<table><thead><tr><th>Payment #</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance after payment</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.m+'</td><td>'+money(r.payment)+'</td><td>'+money(r.principal)+'</td><td>'+money(r.interest)+'</td><td>'+money(r.balance)+'</td></tr>').join("")+'</tbody></table><p class="muted">After '+periods+' scheduled payments, estimated remaining principal is '+money(maturityBalance)+'.</p>';return s
}
document.getElementById("financeDeal").addEventListener("change",loadFinanceFromDeal);
document.getElementById("calculateFinance").onclick=calculateFinanceScenario;
document.getElementById("saveFinance").onclick=()=>{const d=selectedFinanceDeal(),s=calculateFinanceScenario();if(!d||!s){if(!d)alert("Select a saved property first.");return}d.financePlan={price:s.price,down:s.down,rate:s.rate,amort:s.amort,balloon:s.balloon,type:s.type,rent:s.rent,expenses:s.expenses,closing:s.closing,updatedAt:new Date().toISOString()};persist();alert("Scenario saved to this property in this browser.")};
document.getElementById("readFinance").onclick=()=>{const s=calculateFinanceScenario();if(!s)return;speakText("Creative financing scenario. Seller-financed principal "+money(s.principal)+". Estimated monthly payment "+money(s.payment)+". Buyer cash to close "+money(s.cashToClose)+". Monthly rent less payment and entered expenses "+money(s.monthlyNet)+". Estimated remaining balance at maturity "+money(s.maturityBalance)+". Estimated interest paid through maturity "+money(s.totalInterest)+". These are illustrative calculations, not verified financing terms.")};
document.getElementById("makeTermSheet").onclick=()=>{const d=selectedFinanceDeal(),s=calculateFinanceScenario();if(!s)return;const draft="NON-BINDING CREATIVE FINANCING TERM-SHEET DISCUSSION DRAFT — NOT A CONTRACT\n\nProperty: "+(d?.address||"Property to be identified")+"\nProposed purchase price: "+money(s.price)+"\nProposed down payment: "+money(s.down)+"\nProposed seller-financed principal: "+money(s.principal)+"\nProposed annual fixed interest rate: "+s.rate+"%\nPayment structure: "+(s.type==="interestOnly"?"Interest-only":"Fully amortizing")+"\nAmortization period: "+s.amort+" years\nEstimated monthly principal and interest: "+money(s.payment)+"\nProposed balloon maturity: "+(s.balloon?s.balloon+" years":"No balloon entered; modeled through full amortization")+"\nEstimated remaining principal at modeled maturity: "+money(s.maturityBalance)+"\nEstimated buyer cash to close (down payment plus entered closing costs): "+money(s.cashToClose)+"\n\nAll terms are proposed for discussion only and remain subject to seller agreement, independent due diligence, title review, financing and underwriting where applicable, insurance availability, required consents, disclosures, and review and preparation by qualified local counsel. Payment, interest and balloon amounts are estimates from the entered assumptions. This draft creates no obligation, does not constitute a promissory note, mortgage, deed of trust or purchase contract, and must not be signed or treated as final legal documents.";const box=document.getElementById("financeTermSheet");box.textContent=draft;box.classList.remove("hidden")};


function renderComparisonOptions(){
 const host=document.getElementById("comparisonChoices");if(!host)return;
 const selected=new Set([...host.querySelectorAll("input[data-compare]:checked")].map(x=>x.value));
 if(!deals.length){host.innerHTML='<div class="empty">Save properties in Deal Analyzer to compare them here.</div>';return}
 host.innerHTML='<div class="comparison-pick-grid">'+deals.map(d=>'<label class="comparison-pick"><input type="checkbox" data-compare value="'+esc(d.id)+'" '+(selected.has(d.id)?'checked':'')+'><span><b>'+esc(d.address||"Address not entered")+'</b><small>'+esc(d.strategy||"Strategy not entered")+' · '+money(d.asking)+'</small></span></label>').join("")+'</div><p class="muted">Select 2–8 saved properties. These selections are temporary and do not change your saved deals.</p>';
 host.querySelectorAll("input[data-compare]").forEach(el=>el.onchange=()=>{const chosen=host.querySelectorAll("input[data-compare]:checked");if(chosen.length>8){el.checked=false;alert("Compare up to 8 properties at a time.");}});
}
function selectedComparisonDeals(){return [...document.querySelectorAll("#comparisonChoices input[data-compare]:checked")].map(el=>deals.find(d=>d.id===el.value)).filter(Boolean)}
function buildComparison(){
 const chosen=selectedComparisonDeals();if(chosen.length<2){alert("Select at least two saved properties.");return null}
 const ranked=chosen.map(d=>{const c=d.metrics||calc(d),s=dealScore(d);return{d,c,s}}).sort((a,b)=>b.s.score-a.s.score);
 const headers=["Property","Screen score","Asking price","ARV entered","Repairs entered","Est. monthly rent","Est. monthly cash flow","Est. cash required","Est. equity spread","Rent / payment","Key diligence flags"];
 const rows=ranked.map(({d,c,s})=>[esc(d.address||"Address missing"),s.score+"/100",money(d.asking),num(d.arv)>0?money(d.arv):"Not entered",num(d.repairs)>0?money(d.repairs):"Not entered",num(d.rent)>0?money(d.rent):"Not entered",money(c.cashflow),money(c.cash),money(c.equity),c.dscr.toFixed(2)+"x",s.flags.slice(0,4).map(esc).join("<br>")||"No score flags; independent diligence still required"]);
 document.getElementById("comparisonTable").innerHTML='<table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join("")+'</tr>').join("")+'</tbody></table><p class="muted">Sorted by preliminary score, highest first. Cash flow, cash required and equity are estimates derived from entered values and the current calculator assumptions.</p>';
 const best=ranked[0],summary="Compared "+ranked.length+" saved properties. Highest preliminary screen: "+(best.d.address||"address missing")+" at "+best.s.score+" out of 100. Other scores: "+ranked.slice(1).map(x=>(x.d.address||"address missing")+" "+x.s.score+" out of 100").join("; ")+". Review each property's missing information and risk flags. This ranking is not a buy recommendation and is not based on independently verified market data.";
 document.getElementById("comparisonSummary").textContent=summary;
 document.getElementById("comparisonResults").classList.remove("hidden");
 document.getElementById("readComparison").disabled=false;document.getElementById("askComparisonAI").disabled=false;
 return{ranked,summary};
}
document.getElementById("runComparison").onclick=buildComparison;
document.getElementById("readComparison").onclick=()=>{const r=buildComparison();if(r)speakText(r.summary)};
document.getElementById("askComparisonAI").onclick=async()=>{
 const r=buildComparison();if(!r)return;const btn=document.getElementById("askComparisonAI"),box=document.getElementById("comparisonSummary");
 btn.disabled=true;btn.textContent="AI reviewing…";box.textContent="AI is reviewing the entered comparison data…";
 const facts=r.ranked.map(({d,c,s})=>({address:d.address,strategy:d.strategy,profile:d.profile,askingPrice:d.asking,ARVEntered:d.arv,repairsEntered:d.repairs,monthlyRentEntered:d.rent,monthlyExpensesEntered:d.expenses,interestRateEntered:d.rate,estimatedMonthlyCashFlow:c.cashflow,estimatedCashRequired:c.cash,estimatedEquitySpread:c.equity,rentPaymentRatio:c.dscr,preliminaryScore:s.score,scoreLabel:s.label,riskFlags:s.flags}));
 const prompt="Compare these saved real-estate opportunities. Explain the relative strengths, weaknesses, missing data, diligence priorities, and what additional verified facts would be needed before deciding. Do not choose a property as a guaranteed winner or give a buy recommendation. Use only supplied data; do not invent comps, rents, market trends, taxes, insurance, title facts, repairs, or financing availability. Clearly distinguish entered values, calculations, and unknowns. Preliminary heuristic scores are not verified underwriting. Data: "+JSON.stringify(facts);
 try{const response=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});const data=await response.json();if(!response.ok)throw new Error(data.error||"AI comparison failed.");box.textContent=data.answer||"No AI comparison returned.";speakText(box.textContent)}
 catch(e){box.textContent="AI comparison unavailable: "+(e.message||"Check the AI connection.")+"\\n\\n"+r.summary}
 finally{btn.disabled=false;btn.textContent="AI explain the comparison"}
};


function closedPortfolioDeals(){return deals.filter(d=>d.status==="Closed")}
function renderPortfolio(){
 const list=document.getElementById("portfolioPropertyList");if(!list)return;
 const closed=closedPortfolioDeals(),sel=document.getElementById("portfolioDeal"),previous=sel?.value;
 if(sel){sel.innerHTML='<option value="">Select a property marked Closed in Deal Pipeline</option>'+closed.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.address||"Address missing")+'</option>').join("");if(closed.some(d=>d.id===previous))sel.value=previous}
 const items=closed.map(d=>{const p=d.portfolio||{},share=Math.min(100,Math.max(0,num(p.share??100)))/100,value=num(p.value),balance=num(p.balance),rent=num(p.rent),expenses=num(p.expenses),debt=num(p.debt);return{d,p,share,value,balance,rent,expenses,debt,equity:(value-balance)*share,net:(p.rent!==undefined&&p.expenses!==undefined&&p.debt!==undefined)?(rent-expenses-debt)*share:null,complete:(p.rent!==undefined&&p.expenses!==undefined&&p.debt!==undefined)}});
 const totalValue=items.reduce((s,x)=>s+x.value*x.share,0),totalDebt=items.reduce((s,x)=>s+x.balance*x.share,0),totalEquity=items.reduce((s,x)=>s+x.equity,0),gross=items.reduce((s,x)=>s+x.rent*x.share,0),op=items.reduce((s,x)=>s+x.expenses*x.share,0),debtPay=items.reduce((s,x)=>s+x.debt*x.share,0),net=items.reduce((s,x)=>s+x.net,0);
 document.getElementById("portfolioMetrics").innerHTML=[["Properties marked closed",items.length],["Estimated portfolio value",money(totalValue)],["Recorded loan balances",money(totalDebt)],["Estimated equity (ownership-adjusted)",money(totalEquity)],["Monthly rent collected (entered)",money(gross)],["Monthly net (complete entries only)",money(items.filter(x=>x.complete).reduce((s,x)=>s+x.net,0))]].map(([k,v])=>'<div class="portfolio-metric"><span>'+esc(k)+'</span><b>'+v+'</b></div>').join("");
 list.innerHTML=items.length?items.map(x=>'<div class="portfolio-property"><div><b>'+esc(x.d.address||"Address missing")+'</b><small>'+esc(x.d.profile||"Profile not entered")+' · '+esc(x.d.strategy||"Strategy not entered")+' · '+(x.share*100)+'% ownership</small></div><div class="portfolio-property-values"><span>Value: '+(x.value?money(x.value):"Not entered")+'</span><span>Balance: '+(x.p.balance!==undefined?money(x.balance):"Not entered")+'</span><span>Equity share: '+(x.value?money(x.equity):"Not calculated")+'</span><span>Monthly net share: '+(x.complete?money(x.net):"Incomplete inputs") +'</span></div></div>').join(""):'<div class="empty">No properties marked Closed yet. Move a deal to Closed in Deal Pipeline to add it here.</div>';
}
function loadPortfolioDeal(){
 const d=deals.find(x=>x.id===document.getElementById("portfolioDeal").value),p=d?.portfolio||{};
 document.getElementById("portValue").value=p.value??"";
 document.getElementById("portBalance").value=p.balance??"";
 document.getElementById("portRent").value=p.rent??"";
 document.getElementById("portExpenses").value=p.expenses??"";
 document.getElementById("portDebt").value=p.debt??"";
 document.getElementById("portShare").value=p.share??100;
}
document.getElementById("portfolioDeal").addEventListener("change",loadPortfolioDeal);
document.getElementById("savePortfolio").onclick=()=>{
 const d=deals.find(x=>x.id===document.getElementById("portfolioDeal").value);if(!d){alert("Select a property marked Closed first.");return}
 const value=num(document.getElementById("portValue").value),balance=num(document.getElementById("portBalance").value),rent=num(document.getElementById("portRent").value),expenses=num(document.getElementById("portExpenses").value),debt=num(document.getElementById("portDebt").value),share=num(document.getElementById("portShare").value);
 if(share<0||share>100){alert("Ownership share must be between 0 and 100%.");return}
 if(balance>value&&value>0&&!confirm("The entered loan balance is higher than the entered property value. Save these figures anyway?"))return;
 d.portfolio={value,balance,rent,expenses,debt,share,updatedAt:new Date().toISOString()};persist();alert("Portfolio figures saved in this browser.");
};
document.getElementById("readPortfolio").onclick=()=>{
 const closed=closedPortfolioDeals(),total=(fn)=>closed.reduce((s,d)=>s+num(fn(d.portfolio||{}))*num((d.portfolio||{}).share??100)/100,0);
 const value=total(p=>p.value),balance=total(p=>p.balance),rent=total(p=>p.rent),cost=total(p=>p.expenses)+total(p=>p.debt);
 speakText("Portfolio summary. "+closed.length+" properties are marked closed. Entered ownership-adjusted property value: "+money(value)+". Recorded loan balances: "+money(balance)+". Estimated equity: "+money(value-balance)+". Monthly rent collected: "+money(rent)+". Monthly operating expenses and debt payments entered: "+money(cost)+". Estimated monthly net after entered costs: "+money(rent-cost)+". These figures are based only on information entered and are not independently verified.");
};


const CRMKEY="ofpmplus_seller_crm_v1",BUYERKEY="ofpmplus_buyer_room_v1",AUTOKEY="ofpmplus_autopilot_v1";
let sellerLeads=readStore(CRMKEY),buyerOffers=readStore(BUYERKEY),autopilotOn=localStorage.getItem(AUTOKEY)==="true";
function readStore(k){try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return[]}}
function saveStore(k,v){localStorage.setItem(k,JSON.stringify(v))}
function dateLabel(v){if(!v)return"Not scheduled";const d=new Date(v);return Number.isNaN(d.getTime())?"Invalid date":d.toLocaleString()}
function renderSellerCRM(){
 const q=document.getElementById("sellerQueue"),sel=document.getElementById("sellerLogSelect");if(!q||!sel)return;
 const old=sel.value;sel.innerHTML='<option value="">Select seller</option>'+sellerLeads.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' — '+esc(s.address)+'</option>').join("");if(sellerLeads.some(s=>s.id===old))sel.value=old;
 const sorted=[...sellerLeads].sort((a,b)=>(a.follow||"9999").localeCompare(b.follow||"9999"));
 q.innerHTML=sorted.length?sorted.map(s=>{const overdue=s.follow&&new Date(s.follow)<new Date();return'<div class="crm-card"><div><b>'+esc(s.name)+'</b><small>'+esc(s.address)+' · '+esc(s.situation)+'</small><small>Next follow-up: '+esc(dateLabel(s.follow))+' · '+esc(s.contact)+'</small></div><span class="crm-flag '+(overdue?'overdue':'')+'">'+(overdue?'OVERDUE':s.follow?'SCHEDULED':'NO DATE')+'</span><div class="actions"><button class="textbtn" data-seller-log="'+esc(s.id)+'">View history</button><button class="textbtn" data-seller-draft="'+esc(s.id)+'">Draft outreach</button><button class="textbtn" data-seller-done="'+esc(s.id)+'">Mark followed up</button></div></div>'}).join(""):'<div class="empty">No seller leads saved yet.</div>';
 q.querySelectorAll("[data-seller-log]").forEach(b=>b.onclick=()=>{sel.value=b.dataset.sellerLog;renderSellerHistory()});
 q.querySelectorAll("[data-seller-draft]").forEach(b=>b.onclick=()=>draftSellerFor(b.dataset.sellerDraft));
 q.querySelectorAll("[data-seller-done]").forEach(b=>b.onclick=()=>{const s=sellerLeads.find(x=>x.id===b.dataset.sellerDone);if(!s)return;s.history=s.history||[];s.history.unshift({at:new Date().toISOString(),channel:"Task",summary:"Follow-up marked complete by owner. Add details in contact history."});s.follow="";saveStore(CRMKEY,sellerLeads);renderSellerCRM();renderSellerHistory()});
}
document.getElementById("sellerForm").addEventListener("submit",e=>{e.preventDefault();const v=id=>document.getElementById(id).value.trim();sellerLeads.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:v("sellerName"),phone:v("sellerPhone"),email:v("sellerEmail"),address:v("sellerAddress"),source:v("sellerSource"),situation:v("sellerSituation"),price:v("sellerPrice"),finance:v("sellerFinance"),contact:v("sellerContact"),follow:v("sellerFollow"),permission:v("sellerPermission"),notes:v("sellerNotes"),history:[],created:new Date().toISOString()});saveStore(CRMKEY,sellerLeads);e.currentTarget.reset();renderSellerCRM();alert("Seller lead saved on this device.");});
document.getElementById("sellerLogSelect").addEventListener("change",renderSellerHistory);
function renderSellerHistory(){const id=document.getElementById("sellerLogSelect").value,s=sellerLeads.find(x=>x.id===id),box=document.getElementById("sellerHistory");if(!s){box.innerHTML='<div class="empty">Select a seller to view contact history.</div>';return}box.innerHTML=(s.history||[]).length?s.history.map(h=>'<div class="crm-card"><b>'+esc(h.channel)+'</b><small>'+esc(dateLabel(h.at))+'</small><p>'+esc(h.summary)+'</p></div>').join(""):'<div class="empty">No interactions logged yet.</div>'}
document.getElementById("saveSellerLog").onclick=()=>{const s=sellerLeads.find(x=>x.id===document.getElementById("sellerLogSelect").value);if(!s){alert("Select a seller first.");return}const summary=document.getElementById("sellerLogSummary").value.trim();if(!summary){alert("Enter an accurate interaction summary.");return}s.history=s.history||[];s.history.unshift({at:new Date().toISOString(),channel:document.getElementById("sellerLogChannel").value,summary});s.follow=document.getElementById("sellerLogFollow").value;saveStore(CRMKEY,sellerLeads);document.getElementById("sellerLogSummary").value="";renderSellerCRM();renderSellerHistory()};
async function draftSellerFor(id){const s=sellerLeads.find(x=>x.id===id);if(!s)return;const out=document.getElementById("sellerDraft");out.classList.remove("hidden");out.textContent="Preparing a respectful, non-pressuring draft…";const prompt="Draft a short first-contact or follow-up message to this property seller. Do not claim facts not provided, do not imply other buyers exist, do not pressure or create false urgency. Include a polite opt-out and ask whether they are open to discussing sale terms. This is a draft only; do not send it. Seller record: "+JSON.stringify(s);try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),d=await r.json();if(!r.ok)throw new Error(d.error||"AI unavailable");out.textContent=d.answer||"No draft returned."}catch(e){out.textContent="AI draft unavailable: "+e.message} }
document.getElementById("draftSellerMessage").onclick=()=>draftSellerFor(document.getElementById("sellerLogSelect").value);
document.getElementById("readSellerQueue").onclick=()=>speakText(sellerLeads.length+" seller leads. "+sellerLeads.filter(s=>s.follow&&new Date(s.follow)<new Date()).length+" overdue follow-ups. "+sellerLeads.map(s=>s.name+", "+s.address+", next follow-up "+dateLabel(s.follow)).join(". "));
function renderBuyerBoard(){const sel=document.getElementById("buyerDeal"),box=document.getElementById("buyerBoard");if(!sel||!box)return;const old=sel.value;sel.innerHTML='<option value="">Select saved property</option>'+deals.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.address||"Address missing")+'</option>').join("");if(deals.some(d=>d.id===old))sel.value=old;const selected=sel.value;const list=buyerOffers.filter(o=>!selected||o.dealId===selected).sort((a,b)=>num(b.price)-num(a.price));box.innerHTML=list.length?list.map(o=>'<div class="crm-card"><div><b>'+esc(o.buyer)+'</b><small>'+esc(o.address)+' · '+esc(o.finance)+'</small><small>'+esc(o.status)+' · Deadline: '+esc(dateLabel(o.deadline))+'</small><small>Proof of funds: '+esc(o.proof)+' · Conditions: '+esc(o.contingency)+'</small></div><strong>'+money(o.price)+'</strong><p>'+esc(o.terms||"No additional terms recorded.")+'</p></div>').join(""):'<div class="empty">No buyer offers recorded for this property yet.</div>'}
document.getElementById("buyerDeal").addEventListener("change",renderBuyerBoard);
document.getElementById("buyerForm").addEventListener("submit",e=>{e.preventDefault();const v=id=>document.getElementById(id).value.trim(),d=deals.find(x=>x.id===v("buyerDeal"));if(!d){alert("Select a saved property.");return}buyerOffers.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),dealId:d.id,address:d.address,buyer:v("buyerName"),contact:v("buyerContact"),price:v("buyerPrice"),finance:v("buyerFinance"),proof:v("buyerProof"),contingency:v("buyerContingency"),deadline:v("buyerDeadline"),status:v("buyerStatus"),terms:v("buyerTerms"),created:new Date().toISOString()});saveStore(BUYERKEY,buyerOffers);e.currentTarget.reset();renderBuyerBoard();alert("Buyer / offer recorded locally. No buyer was contacted.");});
document.getElementById("readBuyerBoard").onclick=()=>{const list=buyerOffers.filter(o=>!document.getElementById("buyerDeal").value||o.dealId===document.getElementById("buyerDeal").value).sort((a,b)=>num(b.price)-num(a.price));speakText(list.length+" recorded buyer offers. "+list.map(o=>o.buyer+" offered "+money(o.price)+", "+o.finance+", proof of funds "+o.proof+", status "+o.status).join(". "))};
document.getElementById("analyzeBuyerCompetition").onclick=async()=>{const id=document.getElementById("buyerDeal").value,items=buyerOffers.filter(o=>!id||o.dealId===id);if(!items.length){alert("Record real buyer offers first.");return}const box=document.getElementById("buyerAnalysis");box.classList.remove("hidden");box.textContent="AI is comparing recorded offers…";const prompt="Compare only these actual offers entered by the user. Identify strongest stated price, financing certainty indicators, proof-of-funds status, contingencies, deadlines, missing details and questions to ask. Do not infer that proof is valid, invent bidders, recommend accepting an offer, disclose confidential details, or create false urgency. Explain that highest price may not be best net or most certain. Data: "+JSON.stringify(items);try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),d=await r.json();if(!r.ok)throw new Error(d.error||"AI unavailable");box.textContent=d.answer||"No comparison returned.";speakText(box.textContent)}catch(e){box.textContent="AI comparison unavailable: "+e.message}};
document.getElementById("autopilotEnabled").checked=autopilotOn;document.getElementById("autopilotEnabled").onchange=e=>{autopilotOn=e.target.checked;localStorage.setItem(AUTOKEY,String(autopilotOn));document.getElementById("autopilotResults").textContent=autopilotOn?"Safe autopilot enabled. It runs only when you press Run AI Autopilot; no background or external actions occur.":"Safe autopilot is off."};
document.getElementById("runAutopilot").onclick=async()=>{const box=document.getElementById("autopilotResults"),btn=document.getElementById("runAutopilot");btn.disabled=true;btn.textContent="Running…";const overdue=sellerLeads.filter(s=>s.follow&&new Date(s.follow)<new Date()),ranked=[...deals].map(d=>({address:d.address,score:dealScore(d).score,flags:dealScore(d).flags,status:d.status})).sort((a,b)=>b.score-a.score),buyers=[...buyerOffers].sort((a,b)=>num(b.price)-num(a.price));const snapshot={savedDeals:ranked,sellerLeads:sellerLeads.map(s=>({name:s.name,address:s.address,followUp:s.follow,overdue:overdue.includes(s),permissionNotes:s.permission})),buyerOffers:buyers.map(o=>({property:o.address,buyer:o.buyer,price:o.price,finance:o.finance,proof:o.proof,contingencies:o.contingency,deadline:o.deadline,status:o.status})),rules:["Never send messages or contact anyone","Never submit, accept or reject offers","Never sign or move money","Never invent listings, sellers, buyers, bids or verification","Prepare recommendations and drafts only"]};box.classList.remove("hidden");box.textContent="Preparing prioritized work plan…";try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"Act as a cautious real-estate operations assistant. Create a prioritized autopilot action plan from this workspace snapshot. Highlight overdue seller follow-ups, high-scoring but incomplete deals, missing proof-of-funds, expiring offers and missing data. Give next safe administrative steps and draft suggestions only. Never claim external research or verification occurred. Never contact anyone, send anything, make decisions, sign or move money. Snapshot: "+JSON.stringify(snapshot)})}),d=await r.json();if(!r.ok)throw new Error(d.error||"AI service unavailable");box.textContent=d.answer||"No plan returned.";speakText(box.textContent)}catch(e){box.textContent="Autopilot could not reach AI: "+e.message+"\n\nLocal summary: "+overdue.length+" overdue seller follow-ups, "+deals.length+" saved deals and "+buyerOffers.length+" recorded buyer offers."}finally{btn.disabled=false;btn.textContent="Run AI Autopilot now"}};
document.getElementById("readAutopilot").onclick=()=>speakText(document.getElementById("autopilotResults").textContent);


const CONTRACTKEY="ofpmplus_contract_queue_v1";let contractQueue=(()=>{try{return JSON.parse(localStorage.getItem(CONTRACTKEY)||"[]")}catch{return[]}})(),lastContractDraft="",lastIncomingReview="",currentQueueDocumentId="";
function saveContractQueue(){localStorage.setItem(CONTRACTKEY,JSON.stringify(contractQueue));renderContractQueue()}
function renderContractDealOptions(){const s=document.getElementById("contractDeal");if(!s)return;const old=s.value;s.innerHTML='<option value="">Select saved property</option>'+deals.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.address||"Address missing")+'</option>').join("");if(deals.some(d=>d.id===old))s.value=old}
function contractFacts(){const d=deals.find(x=>x.id===document.getElementById("contractDeal").value);return{property:d?.address||"",dealStrategy:d?.strategy||"",documentType:document.getElementById("contractType").value,preparedFor:document.getElementById("contractSide").value,otherParty:document.getElementById("contractOther").value,price:document.getElementById("contractPrice").value,earnestMoney:document.getElementById("contractEarnest").value,downPayment:document.getElementById("contractDown").value,interestRate:document.getElementById("contractRate").value,amortizationYears:document.getElementById("contractAmort").value,balloonYears:document.getElementById("contractBalloon").value,closingDate:document.getElementById("contractClose").value,inspectionDays:document.getElementById("contractInspection").value,requestedTerms:document.getElementById("contractTerms").value}}
async function runContractAI(prompt,box,btn){box.classList.remove("hidden");box.textContent="AI is reviewing…";btn.disabled=true;try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),d=await r.json();if(!r.ok)throw new Error(d.error||"AI service unavailable");box.textContent=d.answer||"No response returned.";return d.answer||""}catch(e){box.textContent="AI request failed: "+e.message;return""}finally{btn.disabled=false}}
document.getElementById("generateContract").onclick=async()=>{const f=contractFacts();if(!f.property){alert("Select a saved property first.");return}const prompt="Create a clearly labeled NON-BINDING REAL-ESTATE DISCUSSION DRAFT based only on these facts: "+JSON.stringify(f)+". Do not invent names, legal descriptions, state forms, statutory disclosures, dates, money amounts or terms. Mark unknowns [TO BE COMPLETED]. Include parties/property, price/consideration, deposit, financing and payment terms if provided, contingencies, title/closing/possession, deadlines, blank signature lines and an attorney-review checklist. Flag state-specific review needed for seller financing, balloon notes, subject-to, lease options, consumer lending, usury, licensing, disclosures and recording as applicable. Do not claim enforceability or legal sufficiency. No one has accepted or signed anything.";lastContractDraft=await runContractAI(prompt,document.getElementById("contractDraftOutput"),document.getElementById("generateContract"))};
document.getElementById("readContractDraft").onclick=()=>{if(lastContractDraft)speakText(lastContractDraft)};
document.getElementById("saveContractDraft").onclick=()=>{if(!lastContractDraft){alert("Generate a draft first.");return}const f=contractFacts();contractQueue.unshift({id:String(Date.now()),kind:"Outgoing draft",property:f.property,other:f.otherParty,type:f.documentType,content:lastContractDraft,facts:{...f},status:"Draft - not approved",created:new Date().toISOString()});saveContractQueue();alert("Draft saved locally. It has not been sent or signed.")};
document.getElementById("reviewIncomingContract").onclick=async()=>{const raw=document.getElementById("incomingContractText").value.trim();if(!raw){alert("Paste received contract text first.");return}const prompt="Review this real-estate contract text for informational purposes. Summarize parties/property, price, deposit, financing, contingencies, deadlines, closing costs, title/possession, default/remedies, unusual clauses, blanks, inconsistencies and questions for a qualified local real-estate attorney. Separate stated facts from interpretation; flag urgent dates. Do not declare enforceability, validity or safety to sign. Do not invent missing terms. Text: "+raw;lastIncomingReview=await runContractAI(prompt,document.getElementById("incomingReviewOutput"),document.getElementById("reviewIncomingContract"))};
document.getElementById("saveIncomingContract").onclick=()=>{const raw=document.getElementById("incomingContractText").value.trim();if(!raw){alert("Paste received contract text first.");return}contractQueue.unshift({id:String(Date.now()),kind:"Received document",property:document.getElementById("contractDeal").selectedOptions[0]?.textContent||"Not linked",type:"Incoming contract / counteroffer",content:raw,review:lastIncomingReview,status:"Received - review required",created:new Date().toISOString()});saveContractQueue();alert("Received document record saved in this browser. Keep the original file securely; this is not a document vault.")};

function renderContractVersionOptions(){
 const a=document.getElementById("contractVersionA"),b=document.getElementById("contractVersionB");
 if(!a||!b)return;
 const opts=contractQueue.map(x=>'<option value="'+esc(x.id)+'">'+esc((x.kind||"Document")+" · "+(x.type||"Untitled")+" · "+(x.property||"Unlinked")+" · "+dateLabel(x.created))+'</option>').join("");
 const oldA=a.value,oldB=b.value;
 a.innerHTML='<option value="">Choose original / earlier version</option>'+opts;
 b.innerHTML='<option value="">Choose counteroffer / later version</option>'+opts;
 if(contractQueue.some(x=>x.id===oldA))a.value=oldA;
 if(contractQueue.some(x=>x.id===oldB))b.value=oldB;
}
function compareContractVersions(){
 const a=contractQueue.find(x=>x.id===document.getElementById("contractVersionA").value);
 const b=contractQueue.find(x=>x.id===document.getElementById("contractVersionB").value);
 const box=document.getElementById("contractVersionResults");
 if(!a||!b){box.textContent="Choose two saved documents to compare.";box.classList.remove("hidden");return}
 if(a.id===b.id){box.textContent="Choose two different saved documents.";box.classList.remove("hidden");return}
 const fields=[["Property","property"],["Document type","documentType"],["Other party","otherParty"],["Price","price"],["Earnest money","earnestMoney"],["Down payment","downPayment"],["Interest rate","interestRate"],["Amortization (years)","amortizationYears"],["Balloon maturity (years)","balloonYears"],["Closing date","closingDate"],["Inspection period (days)","inspectionDays"],["Requested terms / contingencies","requestedTerms"]];
 const fa=a.facts||{},fb=b.facts||{};
 let rows="",changed=0,known=0;
 for(const [label,key] of fields){
  const av=String(fa[key]??(key==="property"?a.property||"":key==="otherParty"?a.other||"":"")).trim();
  const bv=String(fb[key]??(key==="property"?b.property||"":key==="otherParty"?b.other||"":"")).trim();
  if(av||bv){known++;const diff=av!==bv;if(diff)changed++;rows+='<tr><th>'+esc(label)+'</th><td>'+esc(av||"Not recorded")+'</td><td>'+esc(bv||"Not recorded")+'</td><td>'+ (diff?'<b class="version-change">Changed</b>':'<span class="version-same">Same / recorded</span>')+'</td></tr>'}
 }
 const sameProperty=a.property&&b.property&&a.property===b.property;
 box.innerHTML='<div class="version-summary"><b>'+changed+' changed field(s)</b> across '+known+' comparable recorded field(s). '+(sameProperty?'Both records identify the same property.':'Confirm that both records refer to the same property before relying on this comparison.')+'</div>'+
 '<div class="tablewrap"><table><thead><tr><th>Term</th><th>Earlier / original</th><th>Later / counteroffer</th><th>Result</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="4">No structured terms were saved for these records. Open and review the original text manually.</td></tr>')+'</tbody></table></div>'+
 '<p class="muted">This comparison uses only values saved with the documents. “Not recorded” does not mean zero or that a term is absent from the full document. Read both complete documents; this is not legal review or acceptance.</p>';
 box.classList.remove("hidden");
}
document.getElementById("compareContractVersions").onclick=compareContractVersions;
document.getElementById("readContractVersionResults").onclick=()=>{const box=document.getElementById("contractVersionResults");if(!box.classList.contains("hidden"))speakText(box.innerText||box.textContent)};

const DEADLINEKEY="ofpmplus_closing_deadlines_v1";
let closingDeadlines=(()=>{try{return JSON.parse(localStorage.getItem(DEADLINEKEY)||"[]")}catch{return[]}})();
function saveClosingDeadlines(){localStorage.setItem(DEADLINEKEY,JSON.stringify(closingDeadlines));renderClosingDeadlines()}
function renderDeadlineContractOptions(){
 const s=document.getElementById("deadlineContract");if(!s)return;
 const old=s.value;
 s.innerHTML='<option value="">Optional — link to a saved contract record</option>'+contractQueue.map(x=>'<option value="'+esc(x.id)+'">'+esc((x.type||x.kind)+" · "+(x.property||"Unlinked")+" · "+dateLabel(x.created))+'</option>').join("");
 if(closingDeadlines.some(x=>x.contractId===old)||contractQueue.some(x=>x.id===old))s.value=old;
}
function deadlineState(item){
 if(item.done)return "Completed";
 if(!item.date)return "Date missing";
 const due=new Date(item.date+"T23:59:59");
 const today=new Date();today.setHours(0,0,0,0);
 const days=Math.ceil((new Date(item.date+"T00:00:00")-today)/86400000);
 if(days<0)return "Overdue";
 if(days===0)return "Due today";
 if(days<=7)return "Due in "+days+" day(s)";
 if(days<=30)return "Due within 30 days";
 return "Upcoming";
}
function renderClosingDeadlines(){
 renderDeadlineContractOptions();
 const list=document.getElementById("deadlineList"),summary=document.getElementById("deadlineSummary");
 if(!list||!summary)return;
 const sorted=[...closingDeadlines].sort((a,b)=>(a.done?1:0)-(b.done?1:0)||String(a.date||"9999").localeCompare(String(b.date||"9999")));
 const active=closingDeadlines.filter(x=>!x.done),overdue=active.filter(x=>deadlineState(x)==="Overdue").length,soon=active.filter(x=>["Due today"].includes(deadlineState(x))||deadlineState(x).startsWith("Due in ")||deadlineState(x)==="Due within 30 days").length;
 summary.textContent=active.length+" open milestone(s) · "+overdue+" overdue · "+soon+" due within 30 days · "+closingDeadlines.filter(x=>x.done).length+" completed";
 list.innerHTML=sorted.length?sorted.map(x=>{
 const linked=contractQueue.find(c=>c.id===x.contractId);
 const state=deadlineState(x),cls=state==="Overdue"||state==="Due today"?"deadline-alert":state==="Completed"?"deadline-done":"";
 return '<div class="crm-card"><div><b>'+esc(x.title)+'</b><small>'+esc(x.date||"No date")+' · '+esc(x.priority||"Normal")+' priority · '+esc(x.owner||"No owner assigned")+'</small><span class="crm-flag '+cls+'">'+esc(state)+'</span><small>'+esc(linked?(linked.type+" — "+linked.property):"No linked document")+'</small>'+(x.notes?'<p>'+esc(x.notes)+'</p>':"")+'</div><div class="actions">'+(!x.done?'<button class="textbtn" data-deadline-done="'+esc(x.id)+'">Mark complete</button>':'<button class="textbtn" data-deadline-reopen="'+esc(x.id)+'">Reopen</button>')+'<button class="textbtn" data-deadline-delete="'+esc(x.id)+'">Delete</button></div></div>'
 }).join(""):'<div class="empty">No closing milestones yet. Add your first deadline above.</div>';
 list.querySelectorAll("[data-deadline-done]").forEach(b=>b.onclick=()=>{const x=closingDeadlines.find(v=>v.id===b.dataset.deadlineDone);if(x){x.done=true;x.completedAt=new Date().toISOString();saveClosingDeadlines()}});
 list.querySelectorAll("[data-deadline-reopen]").forEach(b=>b.onclick=()=>{const x=closingDeadlines.find(v=>v.id===b.dataset.deadlineReopen);if(x){x.done=false;delete x.completedAt;saveClosingDeadlines()}});
 list.querySelectorAll("[data-deadline-delete]").forEach(b=>b.onclick=()=>{if(confirm("Delete this deadline from this browser?")){closingDeadlines=closingDeadlines.filter(v=>v.id!==b.dataset.deadlineDelete);saveClosingDeadlines()}});
}
document.getElementById("addDeadline").onclick=()=>{
 const title=document.getElementById("deadlineTitle").value.trim(),date=document.getElementById("deadlineDate").value;
 if(!title||!date){alert("Enter a milestone name and due date.");return}
 closingDeadlines.push({id:String(Date.now()),title,date,priority:document.getElementById("deadlinePriority").value,owner:document.getElementById("deadlineOwner").value.trim(),notes:document.getElementById("deadlineNotes").value.trim(),contractId:document.getElementById("deadlineContract").value,done:false,created:new Date().toISOString()});
 saveClosingDeadlines();document.getElementById("deadlineTitle").value="";document.getElementById("deadlineDate").value="";document.getElementById("deadlineOwner").value="";document.getElementById("deadlineNotes").value="";
};
document.getElementById("readDeadlines").onclick=()=>{const open=closingDeadlines.filter(x=>!x.done).sort((a,b)=>String(a.date).localeCompare(String(b.date)));speakText(open.length?open.map(x=>x.title+", "+deadlineState(x)+", due "+x.date).join(". "):"There are no open closing deadlines.")};
function renderContractQueue(){renderContractVersionOptions();const box=document.getElementById("contractQueue");if(!box)return;box.innerHTML=contractQueue.length?contractQueue.map(x=>'<div class="crm-card"><div><b>'+esc(x.kind)+': '+esc(x.type)+'</b><small>'+esc(x.property)+' · '+esc(x.other||"No counterparty")+'</small><small>'+esc(dateLabel(x.created))+'</small><span class="crm-flag">'+esc(x.status)+'</span></div><div class="actions"><button class="textbtn" data-cview="'+esc(x.id)+'">View</button>'+(x.kind==="Outgoing draft"&&x.status==="Draft - not approved"?'<button class="textbtn" data-capprove="'+esc(x.id)+'">Approve this draft for sending</button>':"")+'<button class="textbtn" data-cdelete="'+esc(x.id)+'">Delete</button></div></div>').join(""):'<div class="empty">No contract records yet.</div>';box.querySelectorAll("[data-cview]").forEach(b=>b.onclick=()=>{const x=contractQueue.find(y=>y.id===b.dataset.cview);if(!x)return;currentQueueDocumentId=x.id;lastContractDraft=x.content||"";const out=document.getElementById("contractDraftOutput");out.textContent=lastContractDraft;out.classList.remove("hidden");const review=document.getElementById("incomingReviewOutput");if(x.review){review.classList.remove("hidden");review.textContent="AI review (separate from original document):\\n"+x.review}else{review.classList.add("hidden");review.textContent=""}out.scrollIntoView({behavior:"smooth",block:"center"})});box.querySelectorAll("[data-capprove]").forEach(b=>b.onclick=()=>{const x=contractQueue.find(y=>y.id===b.dataset.capprove);if(!x||!confirm("Have you reviewed this exact draft and do you authorize it to be marked approved for future sending? The app cannot transmit it yet. This is not a signature or acceptance."))return;x.status="Approved by owner - awaiting e-sign connection";x.approvedAt=new Date().toISOString();saveContractQueue()});box.querySelectorAll("[data-cdelete]").forEach(b=>b.onclick=()=>{if(confirm("Delete this local record?")){contractQueue=contractQueue.filter(x=>x.id!==b.dataset.cdelete);saveContractQueue()}})}
document.getElementById("readContractQueue").onclick=()=>speakText(contractQueue.length+" contract records. "+contractQueue.filter(x=>x.status.includes("review")).length+" received documents need review. "+contractQueue.filter(x=>x.status.includes("Approved")).length+" drafts approved by you and awaiting the e-signature connection.");
document.getElementById("contractDeal").addEventListener("change",()=>{const d=deals.find(x=>x.id===document.getElementById("contractDeal").value);if(d)document.getElementById("contractPrice").value=d.asking||""});

renderAll();document.getElementById("refreshReadiness").onclick=renderReadinessDashboard;checkHealth();renderContractDealOptions();renderContractQueue();
renderClosingDeadlines();
renderDiligenceDealOptions();renderFinanceDealOptions();
renderDiligenceDealOptions();


/* Document signature, PDF/print and fax packet tools */
const SIGNATURE_KEY="ofpmplus_typed_signature_v1";
function savedTypedSignature(){try{return JSON.parse(localStorage.getItem(SIGNATURE_KEY)||"null")}catch{return null}}
function updateSignatureStatus(){const s=savedTypedSignature(),el=document.getElementById("signatureStatus");if(el)el.textContent=s&&s.name?"Typed signature saved on this device for: "+s.name:"No signature saved."}
document.getElementById("saveSignature").onclick=()=>{const name=document.getElementById("signatureName").value.trim(),consent=document.getElementById("signatureConsent").checked;if(!name){alert("Enter your exact legal name first.");return}if(!consent){alert("Check the authorization box to save and use this typed signature mark.");return}localStorage.setItem(SIGNATURE_KEY,JSON.stringify({name,consentedAt:new Date().toISOString()}));updateSignatureStatus();alert("Typed signature mark saved on this device. It will only be inserted when you click Apply signature to current draft.")};
document.getElementById("applySignature").onclick=()=>{const s=savedTypedSignature();if(!s||!s.name){alert("Save your typed signature first.");return}if(!document.getElementById("signatureConsent").checked){alert("Confirm authorization before applying the signature.");return}if(!lastContractDraft){alert("Generate or open a draft first.");return}if(!confirm("Apply your saved typed signature mark to this draft now? Review the entire document before using it. This does not send, accept, or legally validate the document."))return;const role=(document.getElementById("contractSide").value||"Buyer / investor").toLowerCase().includes("seller")?"Seller / authorized signer":"Buyer / investor / authorized signer";const mark="\n\n"+role+" signature mark: "+s.name+"\nDate applied: "+new Date().toLocaleDateString()+"\n[Typed signature mark — not identity-verified by an e-signature provider]";if(/\[(?:signature|signer)[^\]]*\]/i.test(lastContractDraft)){lastContractDraft=lastContractDraft.replace(/\[(?:signature|signer)[^\]]*\]/gi,s.name+" (typed signature mark; date: "+new Date().toLocaleDateString()+")")}else if(/(?:buyer|seller|owner|purchaser)?\s*signature\s*:\s*_+/i.test(lastContractDraft)){lastContractDraft=lastContractDraft.replace(/((?:buyer|seller|owner|purchaser)?\s*signature\s*:\s*)_+/gi,"$1"+s.name+" (typed signature mark)")}else{lastContractDraft+=mark}const out=document.getElementById("contractDraftOutput");out.textContent=lastContractDraft;out.classList.remove("hidden");if(currentQueueDocumentId){const saved=contractQueue.find(x=>x.id===currentQueueDocumentId);if(saved){saved.content=lastContractDraft;saved.status="Typed signature mark applied - owner review required";saved.signatureAppliedAt=new Date().toISOString();saveContractQueue()}}alert("Typed signature mark applied to the current draft. Inspect the full document and confirm the correct signer and capacity before saving or printing.")};
function currentPrintableDocument(){const out=document.getElementById("contractDraftOutput");if(out&&!out.classList.contains("hidden")&&out.textContent.trim())return out.textContent.trim();const incoming=document.getElementById("incomingReviewOutput");if(incoming&&!incoming.classList.contains("hidden")&&incoming.textContent.trim())return incoming.textContent.trim();alert("Generate a draft or open a saved document first.");return ""}
function printContractDocument(mode){const content=currentPrintableDocument();if(!content)return;const printOut=document.getElementById("contractDraftOutput");printOut.textContent=content;printOut.classList.remove("hidden");document.body.dataset.printMode=mode;document.body.dataset.printTitle=mode==="fax"?"Fax packet":mode==="pdf"?"Document PDF":"Document";if(mode==="fax"){const recipient=document.getElementById("faxRecipient").value.trim(),number=document.getElementById("faxNumber").value.trim();if(!recipient||!number){alert("Enter the fax recipient and fax number to prepare the cover sheet.");return}const cover="FAX COVER SHEET\nTo: "+recipient+"\nFax: "+number+"\nAttention: "+(document.getElementById("faxAttention").value.trim()||"—")+"\nPages (including cover): "+document.getElementById("faxPages").value+"\nDate: "+new Date().toLocaleString()+"\n\nNote: "+(document.getElementById("faxNote").value.trim()||"Confidential real-estate document for review.")+"\n\nDOCUMENT CONTENT\n\n"+content;document.getElementById("faxCoverPreview").textContent=cover;document.getElementById("faxCoverPreview").classList.remove("hidden");window.__ofpmPrintText=cover}else{window.__ofpmPrintText=content}window.print();delete document.body.dataset.printMode}
document.getElementById("documentPdf").onclick=()=>printContractDocument("pdf");
document.getElementById("documentPrint").onclick=()=>printContractDocument("print");
document.getElementById("documentFax").onclick=()=>{document.getElementById("faxPanel").classList.toggle("hidden");document.getElementById("faxPanel").scrollIntoView({behavior:"smooth",block:"nearest"})};
document.getElementById("printFax").onclick=()=>printContractDocument("fax");
const savedSig=savedTypedSignature();if(savedSig)document.getElementById("signatureName").value=savedSig.name;updateSignatureStatus();


/* Secure account and encrypted cloud transfer controls. */
async function cloudApi(url,options={}){const response=await fetch(url,{...options,credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})}});let data={};try{data=await response.json()}catch{}if(!response.ok)throw new Error(data.error||"Cloud request failed.");return data}
function cloudLocalRecords(){const records=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key==="ofpmplus_workspace_v1"||key.startsWith("ofpmplus_")){try{records.push({key,value:JSON.parse(localStorage.getItem(key))})}catch{throw new Error("Could not read local record "+key)}}}return records}
function cloudSetStatus(msg,isError=false){const el=document.getElementById("cloudSyncStatus");if(el){el.textContent=msg;el.classList.toggle("vault-error",isError)}}
const dbProvisionPanel=document.getElementById("dbProvisionPanel");
const runDbProvision=document.getElementById("runDbProvision");
if(runDbProvision)runDbProvision.onclick=async()=>{
 const token=document.getElementById("dbSetupToken").value;
 const status=document.getElementById("dbProvisionStatus");
 const output=document.getElementById("dbConnectionPanel");
 if(token.length<32){status.textContent="Enter the private setup token (at least 32 characters).";return}
 if(!confirm("Create the secure database tables and restricted application login now? This does not transfer local deal data or create an owner account."))return;
 runDbProvision.disabled=true;status.textContent="Provisioning database and checking security…";output.classList.add("hidden");
 try{
  const response=await fetch("/api/admin/provision-database",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({setupToken:token})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Database setup failed.");
  document.getElementById("dbAppConnection").value=data.appConnectionString;
  document.getElementById("dbSetupToken").value="";
  output.classList.remove("hidden");status.textContent="Database security checks passed. Copy the connection string into Render DATABASE_URL. Do not remove the admin variables until the restricted role is confirmed active.";
 }catch(e){status.textContent=e.message}
 finally{runDbProvision.disabled=false}
};
const copyDbConnection=document.getElementById("copyDbConnection");
if(copyDbConnection)copyDbConnection.onclick=async()=>{
 const field=document.getElementById("dbAppConnection");
 try{await navigator.clipboard.writeText(field.value);document.getElementById("dbProvisionStatus").textContent="Connection string copied. Paste it directly into Render DATABASE_URL."}
 catch{field.focus();field.select();document.getElementById("dbProvisionStatus").textContent="Select the full connection string and copy it, then paste directly into Render DATABASE_URL."}
};
async function cloudRefresh(){const badge=document.getElementById("cloudAccountBadge"),notReady=document.getElementById("cloudNotReady"),login=document.getElementById("cloudLoginPanel"),bootstrap=document.getElementById("cloudBootstrapPanel"),sync=document.getElementById("cloudSyncControls"),signed=document.getElementById("cloudSignedIn");if(!badge)return;try{const health=await cloudApi("/api/health");if(!health.databaseConfigured){badge.textContent="Not activated";notReady.classList.remove("hidden");login.classList.add("hidden");return}if(!health.databaseReady){badge.textContent="Database security setup required";login.classList.add("hidden");if(dbProvisionPanel&&health.databaseProvisioningAvailable)dbProvisionPanel.classList.remove("hidden");notReady.textContent="The database connection exists, but secure account access remains locked until the restricted database role and row-level security are verified.";notReady.classList.remove("hidden");return}if(dbProvisionPanel)dbProvisionPanel.classList.add("hidden");if(!health.cloudEncryptionConfigured){badge.textContent="Encryption key needed";notReady.textContent="Database detected, but cloud storage is not ready until WORKSPACE_ENCRYPTION_KEY is configured securely in Render. Do not upload data yet.";notReady.classList.remove("hidden");login.classList.add("hidden");return}const status=await cloudApi("/api/auth/status");notReady.classList.add("hidden");login.classList.remove("hidden");bootstrap.classList.toggle("hidden",!status.bootstrapAvailable);const me=await cloudApi("/api/auth/me");if(me.authenticated){badge.textContent="Signed in";signed.textContent="Signed in as "+me.user.email;signed.classList.remove("hidden");sync.classList.remove("hidden");document.getElementById("cloudLogout").classList.remove("hidden");document.getElementById("cloudLogin").classList.add("hidden")}else{badge.textContent=status.initialized?"Sign in required":"Owner setup available";signed.classList.add("hidden");sync.classList.add("hidden");document.getElementById("cloudLogout").classList.add("hidden");document.getElementById("cloudLogin").classList.remove("hidden")}}catch(e){badge.textContent="Service not ready";notReady.textContent=e.message;notReady.classList.remove("hidden")}}
const cloudLoginButton=document.getElementById("cloudLogin");if(cloudLoginButton)cloudLoginButton.onclick=async()=>{try{await cloudApi("/api/auth/login",{method:"POST",body:JSON.stringify({email:document.getElementById("cloudEmail").value,password:document.getElementById("cloudPassword").value})});document.getElementById("cloudPassword").value="";await cloudRefresh();cloudSetStatus("Signed in. Your local data has not been uploaded yet.")}catch(e){cloudSetStatus(e.message,true)}};
const cloudLogoutButton=document.getElementById("cloudLogout");if(cloudLogoutButton)cloudLogoutButton.onclick=async()=>{try{await cloudApi("/api/auth/logout",{method:"POST",body:"{}"});await cloudRefresh();cloudSetStatus("Signed out. Local records remain on this device.")}catch(e){cloudSetStatus(e.message,true)}};
const cloudCreateButton=document.getElementById("cloudCreateOwner");if(cloudCreateButton)cloudCreateButton.onclick=async()=>{try{const body={bootstrapToken:document.getElementById("cloudBootstrapToken").value,email:document.getElementById("cloudBootstrapEmail").value,displayName:document.getElementById("cloudDisplayName").value,password:document.getElementById("cloudBootstrapPassword").value};if(body.password.length<12)throw new Error("Use a password with at least 12 characters.");await cloudApi("/api/auth/bootstrap",{method:"POST",body:JSON.stringify(body)});document.getElementById("cloudBootstrapToken").value="";document.getElementById("cloudBootstrapPassword").value="";await cloudRefresh();cloudSetStatus("Owner account created. Remove OWNER_BOOTSTRAP_TOKEN from Render Environment immediately.")}catch(e){cloudSetStatus(e.message,true)}};
const cloudUploadButton=document.getElementById("cloudUpload");if(cloudUploadButton)cloudUploadButton.onclick=async()=>{const records=cloudLocalRecords();if(!records.length){cloudSetStatus("No local app records found.",true);return}if(!confirm("Upload "+records.length+" local app records to your encrypted cloud workspace? Matching cloud copies will be replaced. Your local data will remain unchanged."))return;try{let saved=0;for(let i=0;i<records.length;i+=20){const d=await cloudApi("/api/workspace/sync",{method:"POST",body:JSON.stringify({records:records.slice(i,i+20)})});saved+=d.saved;cloudSetStatus("Uploaded "+saved+" of "+records.length+" records…")}cloudSetStatus("Upload complete: "+saved+" records stored encrypted at rest. Local records were kept.")}catch(e){cloudSetStatus("Upload stopped: "+e.message,true)}};
const cloudRestoreButton=document.getElementById("cloudRestore");if(cloudRestoreButton)cloudRestoreButton.onclick=async()=>{if(!confirm("Restore cloud records onto this device? Matching local app records will be overwritten. Create an encrypted backup first. Continue?"))return;try{const d=await cloudApi("/api/workspace/sync");if(!d.records.length){cloudSetStatus("No cloud records were found.");return}if(!confirm("The cloud contains "+d.records.length+" records. Replace matching records on this device and reload the app?"))return;for(const r of d.records){if(!(r.key==="ofpmplus_workspace_v1"||r.key.startsWith("ofpmplus_")))throw new Error("Cloud returned an unexpected record key.");localStorage.setItem(r.key,JSON.stringify(r.value))}cloudSetStatus("Restored "+d.records.length+" records. Reloading…");window.location.reload()}catch(e){cloudSetStatus("Restore stopped: "+e.message,true)}};
cloudRefresh();


/* Firecrawl-powered internet research and public-page scraping. API key stays on the server. */
let webResearchItems=[];
let webResearchSpeech="";
const webResearchForm=document.getElementById("webResearchForm");
if(webResearchForm)webResearchForm.addEventListener("submit",async e=>{
 e.preventDefault();
 const btn=document.getElementById("webResearchSearch"),status=document.getElementById("webResearchStatus"),box=document.getElementById("webResearchResults"),analyze=document.getElementById("webResearchAnalyze");
 const query=document.getElementById("webResearchQuery").value.trim(),location=document.getElementById("webResearchLocation").value.trim(),limit=Number(document.getElementById("webResearchLimit").value)||5;
 if(!query)return;
 btn.disabled=true;btn.textContent="Searching and extracting…";status.textContent="Searching public web sources and extracting readable page content…";box.classList.remove("empty");box.textContent="Research in progress…";analyze.disabled=true;document.getElementById("webResearchAI").classList.add("hidden");
 try{
  const r=await fetch("/api/research/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,location,limit})}),data=await r.json();
  if(!r.ok)throw new Error(data.error||"Internet research failed.");
  webResearchItems=data.results||[];
  if(!webResearchItems.length){box.innerHTML='<div class="empty">No extractable public webpages were returned. Try a broader search phrase.</div>';status.textContent="Search completed · 0 results";return}
  box.innerHTML='<div class="search-intro"><b>'+webResearchItems.length+' web pages found and processed by '+esc(data.source)+'</b><p>Retrieved '+esc(new Date(data.retrievedAt).toLocaleString())+'. Open the source to verify details.</p></div><div class="web-research-grid">'+webResearchItems.map((x,i)=>'<article class="web-research-card"><div><b>'+esc(x.title)+'</b><p>'+esc(x.description||"No search description supplied.")+'</p><small>'+esc((x.markdown||"").length.toLocaleString())+' characters extracted</small></div><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">Open original source ↗</a><button class="secondary small web-result-add" type="button" data-web-index="'+i+'">Use in AI deal research</button></article>').join("")+'</div>';
  status.textContent="Search complete. Results are leads, not verified property records.";analyze.disabled=false;
  webResearchSpeech="Internet research returned "+webResearchItems.length+" pages for "+query+(location?" in "+location:"")+". Review each original source and verify all property and seller details.";
 }catch(err){status.textContent="";box.innerHTML='<div class="notice">'+esc(err.message)+'</div>'}
 finally{btn.disabled=false;btn.textContent="Search internet & extract pages"}
});
const webResearchAnalyze=document.getElementById("webResearchAnalyze");
if(webResearchAnalyze)webResearchAnalyze.onclick=async()=>{
 const out=document.getElementById("webResearchAI");if(!webResearchItems.length)return;
 out.classList.remove("hidden");out.textContent="AI is reviewing extracted webpages…";webResearchAnalyze.disabled=true;
 const sourceText=webResearchItems.map((x,i)=>"SOURCE "+(i+1)+"\nTitle: "+x.title+"\nURL: "+x.url+"\nDescription: "+x.description+"\nExtracted content:\n"+(x.markdown||"").slice(0,3500)).join("\n\n").slice(0,10500);
 const prompt="Review the following live web research for a U.S. real-estate investor. Identify property addresses, asking prices, property type, seller-financing or owner-financing terms, motivated-seller signals, listing status, dates, contact methods explicitly published, and potential deal leads. Make a table-like concise summary per source. Clearly label facts stated on the page versus AI interpretation and unknowns. Cite each finding using its source number and URL. Do not invent prices, addresses, terms, ownership, title, liens, taxes, rents, comps, or contact details. Flag stale pages, duplicates, sponsored content, and unverifiable claims. Recommend next diligence steps only; do not contact anyone or draft/send an offer. User approval is required for all actions.\n\n"+sourceText;
 try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),data=await r.json();if(!r.ok)throw new Error(data.error||"AI analysis failed.");out.textContent=data.answer||"No AI summary returned.";webResearchSpeech=out.textContent}
 catch(e){out.textContent=e.message}
 finally{webResearchAnalyze.disabled=false}
};
const webScrapeForm=document.getElementById("webScrapeForm");
if(webScrapeForm)webScrapeForm.addEventListener("submit",async e=>{
 e.preventDefault();const btn=document.getElementById("webScrapeButton"),out=document.getElementById("webScrapeOutput"),url=document.getElementById("webScrapeUrl").value.trim();
 btn.disabled=true;btn.textContent="Scraping…";out.classList.remove("hidden");out.textContent="Extracting public webpage content…";
 try{const r=await fetch("/api/research/scrape",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})}),data=await r.json();if(!r.ok)throw new Error(data.error||"Page scraping failed.");out.textContent=data.title+"\n"+data.url+"\nRetrieved: "+new Date(data.retrievedAt).toLocaleString()+"\n\n"+(data.markdown||"No readable page text was returned.");webResearchItems=[{title:data.title,url:data.url,description:"Directly scraped webpage",markdown:data.markdown}];document.getElementById("webResearchAnalyze").disabled=!data.markdown;document.getElementById("webResearchStatus").textContent="Page scraped. You can analyze it with AI above."}
 catch(err){out.textContent=err.message}
 finally{btn.disabled=false;btn.textContent="Scrape webpage"}
});
const webResearchSpeak=document.getElementById("webResearchSpeak");
if(webResearchSpeak)webResearchSpeak.onclick=()=>{const t=document.getElementById("webResearchAI").textContent||webResearchSpeech||"Run an internet search first.";speakText(t)};
const webResearchClear=document.getElementById("webResearchClear");
if(webResearchClear)webResearchClear.onclick=()=>{webResearchItems=[];webResearchSpeech="";document.getElementById("webResearchResults").className="empty";document.getElementById("webResearchResults").textContent="Search results and extracted page content will appear here.";document.getElementById("webResearchAI").classList.add("hidden");document.getElementById("webResearchStatus").textContent="";document.getElementById("webResearchAnalyze").disabled=true};


/* Motivated Seller Lead Command Center: authorized CSV import + local CRM ranking */
const MOTIVATED_SOURCE="iSpeedToLead CSV / authorized import";
function motivatedScore(s){
 const text=[s.situation,s.notes,s.timeline,s.finance].join(" ").toLowerCase();
 let urgency=0,signals=[];
 const urgent=[["immediate",25],["0–30",25],["0-30",25],["behind on payments",22],["pre-foreclosure",24],["foreclosure",22],["vacant",14],["inherited",12],["needs repairs",10],["relocation",10],["divorce",12],["landlord exit",12]];
 for(const [term,pts] of urgent){if(text.includes(term)){urgency+=pts;signals.push(term);}}
 if(/31.?60|within 60|60 days/.test(text)){urgency+=15;signals.push("near-term timeline")}
 else if(/61.?90|90 days/.test(text)){urgency+=8;signals.push("90-day timeline")}
 if(/wants monthly income|seller financ|creative terms/.test(text)){urgency+=8;signals.push("possible creative-finance interest")}
 if(s.follow&&new Date(s.follow)<new Date()){urgency+=5;signals.push("follow-up overdue")}
 const ask=Number(s.price)||0,value=Number(s.estimatedValue)||0,rep=Number(s.repairs)||0;
 const spread=value&&ask?value-ask:null,offerPct=Number(s.offerPct)||72,screenOffer=value?Math.max(0,value*offerPct/100-rep):null;
 return {score:Math.min(100,urgency),signals:[...new Set(signals)],spread,screenOffer,financeFit:/seller financ|monthly income|creative terms/.test(text)};
}
function renderMotivatedLeads(){
 const host=document.getElementById("motivatedLeadList");if(!host)return;
 const filter=(document.getElementById("motivatedFilter")?.value||"").toLowerCase(),sort=document.getElementById("motivatedSort")?.value||"score";
 let rows=sellerLeads.map(s=>({s,rank:motivatedScore(s)})).filter(x=>!filter||[x.s.address,x.s.name,x.s.state].join(" ").toLowerCase().includes(filter));
 rows.sort((a,b)=>sort==="equity"?(b.rank.spread??-Infinity)-(a.rank.spread??-Infinity):sort==="newest"?String(b.s.created||"").localeCompare(String(a.s.created||"")):sort==="follow"?String(a.s.follow||"9999").localeCompare(String(b.s.follow||"9999")):b.rank.score-a.rank.score);
 const nj=sellerLeads.filter(s=>/\bNJ\b|New Jersey/i.test(s.address||"")).length;
 document.getElementById("motivatedLeadMetrics").innerHTML=[["Total imported / saved",sellerLeads.length],["New Jersey leads",nj],["Urgent signals",sellerLeads.filter(s=>motivatedScore(s).score>=35).length],["Possible seller-finance fit",sellerLeads.filter(s=>motivatedScore(s).financeFit).length]].map(x=>'<div class="portfolio-metric"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join("");
 if(!rows.length){host.className="empty";host.textContent="No motivated seller leads yet. Import an authorized iSpeedToLead CSV or add a lead above.";return}
 host.className="crm-list";host.innerHTML=rows.map(({s,rank})=>'<div class="crm-card"><div><b>'+esc(s.name||"Seller name not provided")+'</b><small>'+esc(s.address||"Address not provided")+' · '+esc(s.source||"Lead source not recorded")+'</small><small>Motivation: '+esc(s.situation||"Unknown")+' · Timeline: '+esc(s.timeline||"Unknown")+'</small><small>Finance signal: '+esc(s.finance||"Not discussed")+' · Follow-up: '+esc(dateLabel(s.follow))+'</small><small>Urgency signals: '+esc(rank.signals.join(", ")||"No urgency signals recorded")+'</small></div><div><span class="crm-flag">'+rank.score+'/100 priority</span><small>Est. value spread: '+(rank.spread===null?"Unknown":money(rank.spread))+'</small><small>Screening offer ceiling: '+(rank.screenOffer===null?"Unknown":money(rank.screenOffer))+'</small></div><div class="actions"><button class="textbtn" data-ml-ai="'+esc(s.id)+'">AI analyze & offer ideas</button><button class="textbtn" data-ml-crm="'+esc(s.id)+'">Open seller in CRM</button></div></div>').join("");
 host.querySelectorAll("[data-ml-ai]").forEach(b=>b.onclick=()=>analyzeMotivatedLead(b.dataset.mlAi));
 host.querySelectorAll("[data-ml-crm]").forEach(b=>b.onclick=()=>{const s=sellerLeads.find(x=>x.id===b.dataset.mlCrm);if(!s)return;go("crm");const sel=document.getElementById("sellerLogSelect");sel.value=s.id;renderSellerHistory();});
}
function parseMotivatedCSV(text){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"'){quoted=!quoted}else if(ch===","&&!quoted){row.push(cell);cell=""}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=""}else cell+=ch}
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)return [];
 const headers=rows.shift().map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]+/g," "));
 const pick=(obj,terms)=>{const key=headers.find(h=>terms.some(t=>h===t||h.includes(t)));return key?String(obj[key]||"").trim():""};
 return rows.map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]||"");return {
 name:pick(o,["seller name","contact name","owner name","name","seller"]),
 phone:pick(o,["phone","telephone","mobile"]),
 email:pick(o,["email"]),
 address:pick(o,["property address","address","property","street"]),
 price:pick(o,["asking price","desired price","price","asking"]),
 estimatedValue:pick(o,["estimated value","arv","market value"]),
 repairs:pick(o,["repairs","repair estimate"]),
 situation:pick(o,["motivation","reason","seller situation","reason for selling"]),
 timeline:pick(o,["timeline","sell timeframe","timeframe"]),
 finance:pick(o,["financing","seller financing","terms"]),
 permission:pick(o,["consent","permission","contact permission"]),
 notes:pick(o,["notes","description","details","comments"]),
 source:"iSpeedToLead CSV import",created:new Date().toISOString(),history:[]
 }}).filter(x=>x.address||x.name||x.phone);
}
function mergeMotivatedRows(rows){
 let added=0,skipped=0;
 for(const x of rows){const key=(x.address||"").toLowerCase().replace(/[^a-z0-9]/g,""),phone=(x.phone||"").replace(/\D/g,"");const exists=sellerLeads.some(s=>(key&&String(s.address||"").toLowerCase().replace(/[^a-z0-9]/g,"")===key)||(phone&&String(s.phone||"").replace(/\D/g,"")===phone));if(exists){skipped++;continue}
 x.id=crypto.randomUUID?crypto.randomUUID():String(Date.now()+added);x.name=x.name||"Seller name not provided";x.contact="Phone";x.follow="";x.price=x.price||"";x.finance=x.finance||"Not discussed";sellerLeads.unshift(x);added++;
 }
 saveStore(CRMKEY,sellerLeads);renderSellerCRM();renderMotivatedLeads();return{added,skipped};
}
const motivatedCsvInput=document.getElementById("motivatedCsvFile");
if(motivatedCsvInput)motivatedCsvInput.addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;document.getElementById("motivatedCsvText").value=await f.text();document.getElementById("motivatedImportStatus").textContent=f.name+" loaded. Tap Import leads into CRM."});
const importMotivated=document.getElementById("importMotivatedCsv");
if(importMotivated)importMotivated.onclick=()=>{const raw=document.getElementById("motivatedCsvText").value.trim();if(!raw){alert("Choose a CSV file or paste CSV text first.");return}const rows=parseMotivatedCSV(raw);if(!rows.length){alert("No lead rows were recognized. Include a header row and at least a seller name, phone or property address.");return}const result=mergeMotivatedRows(rows);document.getElementById("motivatedImportStatus").textContent=result.added+" leads imported; "+result.skipped+" duplicates skipped. Review the mapped fields before contacting anyone.";};
const motivatedForm=document.getElementById("motivatedLeadForm");
if(motivatedForm)motivatedForm.addEventListener("submit",e=>{e.preventDefault();const v=id=>document.getElementById(id).value.trim();const s={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:v("mlName")||"Seller name not provided",phone:v("mlPhone"),email:v("mlEmail"),address:v("mlAddress"),price:v("mlAsk"),estimatedValue:v("mlValue"),repairs:v("mlRepairs"),offerPct:v("mlOfferPct"),situation:v("mlMotivation"),timeline:v("mlTimeline"),finance:v("mlFinance"),follow:v("mlFollow"),permission:v("mlPermission"),notes:v("mlNotes"),source:"Manual motivated seller lead",contact:"Phone",history:[],created:new Date().toISOString()};sellerLeads.unshift(s);saveStore(CRMKEY,sellerLeads);renderSellerCRM();renderMotivatedLeads();e.currentTarget.reset();alert("Lead saved to Seller CRM and ranked. No seller was contacted.");});
["motivatedFilter","motivatedSort"].forEach(id=>document.getElementById(id)?.addEventListener("input",renderMotivatedLeads));
async function analyzeMotivatedLead(id){
 const s=sellerLeads.find(x=>x.id===id);if(!s)return;const rank=motivatedScore(s),box=document.getElementById("motivatedAI");box.classList.remove("hidden");box.textContent="AI is reviewing the seller signals and possible deal structures…";
 const prompt="Analyze this real-estate motivated-seller lead for a New Jersey / U.S. investor. Separate recorded facts, seller-reported facts, AI interpretation and unknowns. Evaluate urgency, possible seller-financing fit, cash vs seller-finance negotiation questions, missing property valuation and due diligence, and a cautious offer discussion range only if the supplied figures support one. Explain that the calculated screen is not an appraisal, verified equity or an offer. Do not infer distress, mortgage delinquency, ownership, liens, title, contact consent or seller intent beyond recorded fields. Do not contact the seller, send an offer, sign or move money. The owner approves all actions. Lead: "+JSON.stringify({...s,screening:rank});
 try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),d=await r.json();if(!r.ok)throw new Error(d.error||"AI analysis failed");box.textContent=d.answer||"No AI analysis returned.";speakText(box.textContent)}catch(e){box.textContent="AI analysis unavailable: "+e.message}
}
document.getElementById("readMotivatedLeads")?.addEventListener("click",()=>{const list=sellerLeads.map(s=>({s,r:motivatedScore(s)})).sort((a,b)=>b.r.score-a.r.score);speakText(list.length+" motivated seller leads. "+list.slice(0,10).map(x=>(x.s.name||"Seller")+", "+x.s.address+", priority "+x.r.score+" out of 100.").join(" "))});
document.getElementById("exportMotivatedCsv")?.addEventListener("click",()=>{const cols=["name","phone","email","address","price","estimatedValue","repairs","situation","timeline","finance","follow","permission","notes","source"];const csv=[cols.join(","),...sellerLeads.map(s=>cols.map(k=>'"'+String(s[k]??"").replace(/"/g,'""')+'"').join(","))].join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="owner-finance-motivated-seller-leads.csv";a.click();URL.revokeObjectURL(url)});
renderMotivatedLeads();
