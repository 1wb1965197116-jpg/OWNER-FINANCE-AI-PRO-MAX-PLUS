"use strict";
/* Multi-agent acquisition, buyer discovery, matching and disposition workspace.
   Buyer profiles and settings are stored locally under the app's existing backup prefix.
   External outreach is draft-only until a provider is connected and the owner approves it. */
(() => {
 const SETTINGS_KEY="ofpmplus_multi_agent_settings_v1";
 const BUYERS_KEY="ofpmplus_cash_buyer_profiles_v1";
 const OUTREACH_KEY="ofpmplus_buyer_outreach_drafts_v1";
 const defaults={markets:"nationwide",buyerTypes:"all",dealTypes:"both",outreach:"qualified"};
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
 const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
 let settings={...defaults,...read(SETTINGS_KEY,{})};
 let buyerProfiles=read(BUYERS_KEY,[]);
 let outreachDrafts=read(OUTREACH_KEY,[]);
 let searchResults=[];
 const el=id=>document.getElementById(id);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(n)||0);
 const stateOf=s=>{const m=String(s||"").match(/\b([A-Z]{2})\b/);return m?m[1]:""};
 const currentDeals=()=>Array.isArray(window.deals)?window.deals:(typeof deals!=="undefined"?deals:[]);
 const currentSellers=()=>typeof sellerLeads!=="undefined"&&Array.isArray(sellerLeads)?sellerLeads:[];
 function saveSettings(){settings={markets:el("agentMarkets").value,buyerTypes:el("agentBuyerTypes").value,dealTypes:el("agentDealTypes").value,outreach:el("agentOutreach").value};write(SETTINGS_KEY,settings);el("agentSettingsStatus").textContent="Settings saved on this device. They are included in the app's encrypted backup/cloud workspace transfer."}
 function hydrateSettings(){for(const [id,key] of [["agentMarkets","markets"],["agentBuyerTypes","buyerTypes"],["agentDealTypes","dealTypes"],["agentOutreach","outreach"]])el(id).value=settings[key]||defaults[key]}
 function parseMarket(b){return [b.states,b.cities,b.zipCodes,b.markets].filter(Boolean).join(" ").toLowerCase()}
 function matchScore(b,d){
  let score=0,why=[],unknown=[];
  const addr=String(d.address||"").toLowerCase(),st=stateOf(d.address);
  const markets=parseMarket(b);
  if(!markets){unknown.push("buyer market not recorded")}else if(markets.includes("nationwide")||markets.includes("all states")||(st&&markets.includes(st.toLowerCase()))||addr.split(",").some(x=>markets.includes(x.trim()))){score+=30;why.push("market appears to fit")}else{why.push("market not matched")}
  const price=Number(d.asking)||0,min=Number(b.minBudget)||0,max=Number(b.maxBudget)||0;
  if(!price){unknown.push("property asking price missing")}else if((!min||price>=min)&&(!max||price<=max)){score+=25;why.push("asking price within buyer range")}else why.push("asking price outside recorded range");
  const type=String(d.propertyType||"Single-family").toLowerCase(),types=String(b.propertyTypes||"").toLowerCase();
  if(!types){unknown.push("property type not recorded")}else if(types.includes("all")||types.includes(type)||types.includes("single")&&/single|house/.test(type)){score+=15;why.push("property type fit")}else why.push("property type mismatch");
  const strat=String(d.strategy||"Cash purchase").toLowerCase(),strats=String(b.strategies||"").toLowerCase();
  if(!strats){unknown.push("buyer strategy not recorded")}else if(strats.includes("all")||strats.includes("both")||strat.includes("seller")&&/owner|seller|creative/.test(strats)||strat.includes("cash")&&/cash|wholesale|flip|rental/.test(strats)){score+=15;why.push("strategy fit")}else why.push("strategy not matched");
  if(b.status==="Active"){score+=5;why.push("buyer marked active")}else if(b.status==="Needs verification"){score+=2;why.push("buyer needs verification")}else why.push("buyer not active");
  if(b.permission==="Yes — documented opt-in"){score+=5;why.push("contact permission documented")}else unknown.push("contact permission not verified");
  if(b.proofFunds==="Verified"){score+=5;why.push("proof of funds marked verified")}else unknown.push("proof of funds not verified");
  return {score:Math.min(100,score),why,unknown};
 }
 function renderBuyers(){
  const host=el("agentBuyerList");if(!host)return;
  el("agentBuyerCount").textContent=buyerProfiles.length;
  if(!buyerProfiles.length){host.className="empty";host.textContent="No buyer profiles saved yet. Add buyers you know or research public investor businesses, then verify their details.";return}
  host.className="crm-list";
  host.innerHTML=buyerProfiles.map(b=>'<div class="crm-card"><div><b>'+esc(b.company||b.name)+'</b><small>'+esc(b.name||"Contact not named")+' · '+esc(b.status||"Needs verification")+'</small><small>'+esc([b.states,b.cities,b.zipCodes].filter(Boolean).join(" · ")||"Market not recorded")+'</small><small>Budget: '+esc(b.minBudget?money(b.minBudget):"Any minimum")+' – '+esc(b.maxBudget?money(b.maxBudget):"Not set")+' · '+esc(b.propertyTypes||"Property type unknown")+'</small><small>Strategies: '+esc(b.strategies||"Not recorded")+' · Contact permission: '+esc(b.permission||"Not recorded")+'</small><small>POF: '+esc(b.proofFunds||"Not reviewed")+'</small></div><div><span class="crm-flag">'+esc(b.status||"Needs verification")+'</span></div><div class="actions"><button class="textbtn" data-buyer-edit="'+esc(b.id)+'">Edit</button><button class="textbtn" data-buyer-delete="'+esc(b.id)+'">Delete</button></div></div>').join("");
  host.querySelectorAll("[data-buyer-delete]").forEach(btn=>btn.onclick=()=>{if(!confirm("Delete this buyer profile from this device?"))return;buyerProfiles=buyerProfiles.filter(x=>x.id!==btn.dataset.buyerDelete);write(BUYERS_KEY,buyerProfiles);renderBuyers();renderMatches()});
  host.querySelectorAll("[data-buyer-edit]").forEach(btn=>btn.onclick=()=>{const b=buyerProfiles.find(x=>x.id===btn.dataset.buyerEdit);if(!b)return;el("buyerContactName").value=b.name||"";el("buyerCompany").value=b.company||"";el("buyerEmail").value=b.email||"";el("buyerPhone").value=b.phone||"";el("buyerStates").value=b.states||"";el("buyerCities").value=b.cities||"";el("buyerZips").value=b.zipCodes||"";el("buyerMinBudget").value=b.minBudget||"";el("buyerMaxBudget").value=b.maxBudget||"";el("buyerPropertyTypes").value=b.propertyTypes||"All";el("buyerStrategies").value=b.strategies||"All";el("buyerStatus").value=b.status||"Needs verification";el("buyerPermission").value=b.permission||"Not recorded";el("buyerProofFunds").value=b.proofFunds||"Not reviewed";el("buyerNotes").value=b.notes||"";el("buyerProfileForm").dataset.editId=b.id;el("buyerProfileSave").textContent="Update buyer profile";el("buyerCompany").focus()});
 }
 function renderMatches(){
  const sel=el("agentMatchDeal"),host=el("agentMatchResults");if(!sel||!host)return;
  const ds=currentDeals(),old=sel.value;sel.innerHTML='<option value="">Choose a saved property</option>'+ds.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.address||"Address missing")+' · '+money(d.asking)+'</option>').join("");if(ds.some(d=>d.id===old))sel.value=old;
  const d=ds.find(x=>x.id===sel.value);if(!d){host.className="empty";host.textContent="Choose a saved property to see ranked buyer matches.";return}
  const ranked=buyerProfiles.map(b=>({b,m:matchScore(b,d)})).sort((a,b)=>b.m.score-a.m.score);
  if(!ranked.length){host.className="empty";host.textContent="Add buyer profiles to calculate matches.";return}
  host.className="crm-list";host.innerHTML=ranked.slice(0,30).map(({b,m})=>'<div class="crm-card"><div><b>'+esc(b.company||b.name)+'</b><small>'+esc(b.name||"Contact not named")+' · '+esc(b.email||b.phone||"No contact details")+'</small><small>'+esc(m.why.join(" · "))+'</small><small>Open items: '+esc(m.unknown.join(" · ")||"No missing matching fields recorded")+'</small></div><div><span class="crm-flag">'+m.score+'/100 match</span><small>'+esc(b.status||"Needs verification")+'</small></div><div class="actions"><button class="textbtn" data-outreach="'+esc(b.id)+'" data-score="'+m.score+'">Prepare contact draft</button></div></div>').join("");
  host.querySelectorAll("[data-outreach]").forEach(btn=>btn.onclick=()=>prepareOutreach(btn.dataset.outreach,d,Number(btn.dataset.score)));
 }
 function prepareOutreach(buyerId,d,score){
  const b=buyerProfiles.find(x=>x.id===buyerId);if(!b)return;
  const eligible=b.permission==="Yes — documented opt-in"&&b.status==="Active";
  const draft={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),buyerId,dealId:d.id,buyer:b.company||b.name,address:d.address,score,eligible,created:new Date().toISOString(),status:"Draft — owner review required",subject:"Property opportunity for review",body:"Hello "+(b.name||"there")+",\n\nI have a property opportunity that may fit your stated buying criteria.\nProperty: "+(d.address||"Address available on request")+"\nAsking price: "+(d.asking?money(d.asking):"Not provided")+"\nStrategy: "+(d.strategy||"Not specified")+"\n\nPlease let me know if you would like the verified property package and additional details. No offer or representation is made by this message.\n\nRegards"};
  outreachDrafts.unshift(draft);write(OUTREACH_KEY,outreachDrafts);renderOutreach();
  el("agentOutreachNotice").textContent=eligible?"Draft prepared. Buyer is marked opted-in and active, but the owner must review and approve before sending. No message was sent.":"Draft prepared only. This buyer is not currently eligible for outreach because documented opt-in and Active status are both required.";
  go("agents");
 }
 function renderOutreach(){
  const host=el("agentOutreachList");if(!host)return;
  if(!outreachDrafts.length){host.className="empty";host.textContent="No buyer outreach drafts yet.";return}
  host.className="crm-list";host.innerHTML=outreachDrafts.slice(0,20).map(x=>'<div class="crm-card"><div><b>'+esc(x.buyer)+' · '+esc(x.address)+'</b><small>'+esc(x.status)+' · '+(x.eligible?"Opt-in recorded":"Permission needs review")+'</small><small>Prepared '+esc(new Date(x.created).toLocaleString())+'</small></div><div><span class="crm-flag">'+x.score+'/100</span></div><div class="actions"><button class="textbtn" data-draft-view="'+esc(x.id)+'">View draft</button><button class="textbtn" data-draft-copy="'+esc(x.id)+'">Copy draft</button></div></div>').join("");
  host.querySelectorAll("[data-draft-view]").forEach(btn=>btn.onclick=()=>{const x=outreachDrafts.find(y=>y.id===btn.dataset.draftView);if(x)el("agentDraftOutput").textContent=x.subject+"\n\n"+x.body});
  host.querySelectorAll("[data-draft-copy]").forEach(btn=>btn.onclick=async()=>{const x=outreachDrafts.find(y=>y.id===btn.dataset.draftCopy);if(!x)return;try{await navigator.clipboard.writeText(x.subject+"\n\n"+x.body);el("agentOutreachNotice").textContent="Draft copied. No message was sent."}catch{el("agentDraftOutput").textContent=x.subject+"\n\n"+x.body}});
 }
 async function researchBuyers(e){
  e.preventDefault();const location=el("buyerResearchLocation").value.trim(),kind=el("buyerResearchKind").value;
  const out=el("buyerResearchResults"),btn=el("buyerResearchButton");btn.disabled=true;btn.textContent="Researching…";out.className="empty";out.textContent="Searching public web sources for buyer businesses and investor networks…";
  const query="publicly listed real estate cash home buyers property investors "+kind+" buyer acquisition companies investor groups real estate investment firms contact information";
  try{const r=await fetch("/api/research/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,location,limit:8})}),data=await r.json();if(!r.ok)throw new Error(data.error||"Buyer research unavailable.");searchResults=data.results||[];if(!searchResults.length){out.className="empty";out.textContent="No useful public search results returned. Try a broader market or different buyer category.";return}
   out.className="crm-list";out.innerHTML=searchResults.map((x,i)=>'<div class="crm-card"><div><b>'+esc(x.title)+'</b><small>'+esc(x.description||"Public webpage result")+'</small><small><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">Open source</a></small></div><div><span class="crm-flag">Unverified lead</span></div><div class="actions"><button class="textbtn" data-research-add="'+i+'">Add to buyer review list</button></div></div>').join("");
   out.querySelectorAll("[data-research-add]").forEach(b=>b.onclick=()=>{const x=searchResults[Number(b.dataset.researchAdd)];if(!x)return;el("buyerCompany").value=x.title;el("buyerNotes").value="Found via public web research. Source: "+x.url+"\n"+(x.description||"")+"\nVerify identity, buying activity, contact details, consent and investment criteria before use.";el("buyerStatus").value="Needs verification";el("buyerPermission").value="Not recorded";el("buyerCompany").focus();el("agentBuyerFormStatus").textContent="Research result loaded into the buyer profile form. Verify all details before saving."});
  }catch(err){out.className="empty";out.textContent=err.message}
  finally{btn.disabled=false;btn.textContent="Find potential buyers"}
 }
 async function runAgentTeam(){
  const ds=currentDeals(),ss=currentSellers(),context={settings,deals:ds.slice(0,20).map(d=>({address:d.address,asking:d.asking,arv:d.arv,repairs:d.repairs,rent:d.rent,strategy:d.strategy,status:d.status})),sellerLeads:ss.slice(0,20).map(s=>({address:s.address,price:s.price,situation:s.situation,timeline:s.timeline,finance:s.finance,source:s.source})),buyerProfiles:buyerProfiles.slice(0,30).map(b=>({company:b.company,name:b.name,markets:b.states+" "+b.cities+" "+b.zipCodes,budget:b.minBudget+"-"+b.maxBudget,types:b.propertyTypes,strategies:b.strategies,status:b.status,permission:b.permission,proofFunds:b.proofFunds})),buyerOffers:buyerOffersSafe()};
  const agents=[
   ["Acquisition Intelligence","Identify the strongest acquisition opportunities, seller follow-up priorities and missing facts. Never infer distress, equity, title or seller intent."],
   ["Property Underwriting","Review property figures, rent assumptions, repairs, valuation gaps and deal risks. Never invent comps, ARV, rents or repair costs."],
   ["Buyer Discovery","Assess gaps in buyer coverage by market, price band, asset type and strategy. Recommend public research queries, not fabricated buyers."],
   ["Buyer Matching","Review saved buyer profiles against saved properties. Explain match evidence, unknowns and verification gaps. Do not treat a score as buyer commitment."],
   ["Disposition Strategy","Recommend a cautious sale/disposition plan, potential cash vs owner-finance pathway, required package items and lawful review points. Do not claim assignment rights or legal compliance."]
  ];
  const host=el("agentTeamOutput"),btn=el("runAgentTeam");btn.disabled=true;btn.textContent="Agents working…";host.className="crm-list";host.innerHTML=agents.map(([n])=>'<div class="crm-card"><div><b>'+esc(n)+'</b><small>Waiting for analysis…</small></div></div>').join("");
  const cards=[...host.querySelectorAll(".crm-card")];
  await Promise.all(agents.map(async([name,role],i)=>{
   const prompt="You are the "+name+" role in a five-agent real-estate investment workflow. "+role+"\nReturn: 1) evidence-based findings; 2) priority actions; 3) missing/unknown information; 4) risk and compliance flags. Distinguish verified inputs, user-entered claims and estimates. Nationwide scope. Deal types: wholesale/assignment opportunities and owner financing. Outreach setting: qualified buyers only, documented opt-in and owner review. Never contact anyone, send offers, sign, or move money. Context JSON: "+JSON.stringify(context);
   try{const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}),data=await r.json();if(!r.ok)throw new Error(data.error||"AI unavailable");cards[i].innerHTML='<div><b>'+esc(name)+'</b><small>'+esc(String(data.answer||"No result").slice(0,8000))+'</small></div>'}
   catch(err){cards[i].innerHTML='<div><b>'+esc(name)+'</b><small>Not available: '+esc(err.message)+'</small></div>'}
  }));
  btn.disabled=false;btn.textContent="Run the five-agent team";
 }
 function buyerOffersSafe(){try{return typeof buyerOffers!=="undefined"?buyerOffers.slice(0,20).map(x=>({deal:x.dealId,price:x.price,status:x.status,finance:x.finance})):[]}catch{return[]}}
 function saveBuyer(e){
  e.preventDefault();const v=id=>el(id).value.trim(),editId=el("buyerProfileForm").dataset.editId;
  const b={id:editId|| (crypto.randomUUID?crypto.randomUUID():String(Date.now())),name:v("buyerContactName"),company:v("buyerCompany"),email:v("buyerEmail"),phone:v("buyerPhone"),states:v("buyerStates"),cities:v("buyerCities"),zipCodes:v("buyerZips"),minBudget:v("buyerMinBudget"),maxBudget:v("buyerMaxBudget"),propertyTypes:el("buyerPropertyTypes").value,strategies:el("buyerStrategies").value,status:el("buyerStatus").value,permission:el("buyerPermission").value,proofFunds:el("buyerProofFunds").value,notes:v("buyerNotes"),updated:new Date().toISOString()};
  if(!b.company&&!b.name){el("agentBuyerFormStatus").textContent="Enter a buyer name or company.";return}
  if(editId){buyerProfiles=buyerProfiles.map(x=>x.id===editId?b:x)}else buyerProfiles.unshift(b);
  write(BUYERS_KEY,buyerProfiles);el("buyerProfileForm").reset();delete el("buyerProfileForm").dataset.editId;el("buyerProfileSave").textContent="Save buyer profile";el("agentBuyerFormStatus").textContent="Buyer profile saved locally. Details and opt-in must be independently verified.";renderBuyers();renderMatches();
 }
 function init(){
  if(!el("view-agents"))return;
  hydrateSettings();el("saveAgentSettings").addEventListener("click",saveSettings);
  el("buyerProfileForm").addEventListener("submit",saveBuyer);
  el("buyerResearchForm").addEventListener("submit",researchBuyers);
  el("agentMatchDeal").addEventListener("change",renderMatches);
  el("runAgentTeam").addEventListener("click",runAgentTeam);
  renderBuyers();renderMatches();renderOutreach();
  document.querySelectorAll('[data-view="agents"]').forEach(x=>x.addEventListener("click",()=>{setTimeout(()=>{renderMatches();renderBuyers();renderOutreach()},0)}));
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();