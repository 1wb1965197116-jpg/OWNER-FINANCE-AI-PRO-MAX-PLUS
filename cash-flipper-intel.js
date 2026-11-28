"use strict";
/* Cash Buyer & Flipper Intelligence AI. Public research is a lead signal only;
   deed/closing and funds verification must be independently documented. */
(() => {
 const KEY="ofpmplus_cash_flipper_intel_v1";
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
 let leads=read();
 function init(){
  const nav=$("nav"); if(!nav||$("view-cash-intel"))return;
  const b=document.createElement("button");b.className="navitem";b.dataset.view="cash-intel";b.innerHTML="◈ <span>Cash Buyer & Flipper AI</span>";nav.appendChild(b);
  const section=document.createElement("section");section.className="view";section.id="view-cash-intel";
  section.innerHTML=`
   <article class="panel"><div class="panelhead"><div><h3>Cash Buyer & Flipper Intelligence AI</h3><p>Find recent investor purchases, repeat flippers and local real-estate professionals. Every discovery starts as an unverified lead.</p></div><span class="tag">Sixth AI specialist</span></div>
   <form id="cfiForm" class="formgrid">
    <label class="span2">Market, city/state, county or ZIP<input id="cfiMarket" value="Ocean County, NJ" required placeholder="Example: Ocean County, NJ or United States"></label>
    <label>Look-back period<select id="cfiWindow"><option value="90">Last 90 days</option><option value="180" selected>Last 180 days</option><option value="365">Last 12 months</option><option value="730">Last 24 months</option></select></label>
    <label>Property focus<select id="cfiType"><option>Single-family and small multifamily</option><option>Single-family flips</option><option>2–4 unit multifamily</option><option>5+ unit multifamily</option><option>Land and development</option><option>Commercial</option><option>All property types</option></select></label>
    <label class="span2">Research targets<select id="cfiTargets" multiple size="4"><option selected value="sales">Recent recorded cash sales and deed transfers</option><option selected value="flippers">Repeat buyers, flippers and resale activity</option><option selected value="pros">Local agents, brokers, title and closing professionals</option><option value="networks">REIA groups and investor networks</option></select><small class="muted">On iPhone, tap to select or deselect multiple targets.</small></label>
    <div class="span2 actions"><button class="primary" id="cfiRun" type="submit">Run cash buyer intelligence</button></div>
   </form><p class="notice">Sources vary by county. Public deed records can lag closing, may omit cash/financing details, and can include non-market transfers. Listing-site activity is not proof of a closed transaction. This release uses public web research; direct ATTOM, BatchData, county-record and MLS feeds require separate access or API credentials.</p></article>
   <article class="panel"><div class="panelhead"><div><h3>Research results & AI assessment</h3><p>Each finding retains its source URL and retrieval date.</p></div></div><div id="cfiSearchStatus" class="muted">Search: Ready.</div><div id="cfiAiStatus" class="muted">AI review: Waiting for search results.</div><div id="cfiResults" class="crm-list empty">No research run yet.</div><div id="cfiAnalysis" class="aianswer hidden"></div></article>
   <article class="panel"><div class="panelhead"><div><h3>Buyer verification gate</h3><p>A buyer cannot be marked verified or matched as funding-ready until the evidence is recorded.</p></div><span class="tag">No automatic approval</span></div>
   <div class="formgrid">
    <label class="span2">Buyer / company<input id="cfiBuyerName" placeholder="Legal name or entity"></label>
    <label>Closed transactions evidence<select id="cfiClosed"><option value="none">No verified closings</option><option value="public">Public-record deed located — not independently confirmed</option><option value="confirmed">Closing independently confirmed</option></select></label>
    <label>Recent activity<select id="cfiRecent"><option value="unknown">Unknown</option><option value="12m">At least one closing in last 12 months</option><option value="24m">Closing in last 13–24 months</option><option value="none">No recent closing found</option></select></label>
    <label>Funding evidence<select id="cfiFunds"><option value="none">Not provided</option><option value="letter">Bank / lender letter received, not verified</option><option value="verified">Funding independently verified for this deal</option></select></label>
    <label>Closing speed<select id="cfiSpeed"><option value="unknown">Not confirmed</option><option value="7">Can close in 7 days — independently checked</option><option value="14">Can close in 14 days — independently checked</option><option value="30">Can close in 30 days — independently checked</option></select></label>
    <label class="span2">Evidence source, deed/recording reference, closing contact and verification date<textarea id="cfiEvidence" rows="3" placeholder="Record county, instrument number, recorded date, closing agent confirmation, funding letter verification method and date. Do not enter account numbers or bank credentials."></textarea></label>
    <div class="span2 actions"><button class="primary" type="button" id="cfiSave">Save verification review</button><span id="cfiSaveStatus" class="muted"></span></div>
   </div><div id="cfiBuyerReviews" class="crm-list empty">No buyer verification reviews saved.</div></article>
   <article class="panel"><h3>Funding-ready rule</h3><p>Only label a buyer <b>Funding verified for this deal</b> when a recent closing is independently confirmed, the buyer's identity/entity is checked, and current deal-specific funds are verified through a trusted closing professional or financial institution using a secure process. A past cash deed alone does not establish present liquidity. Do not upload bank credentials or full account numbers.</p><p class="notice">Contact local professionals only through lawful, permission-based channels. Do not scrape login-only MLS portals, bypass access controls, or bulk-message people. Listing sites and public profiles are discovery signals, not proof of purchase capacity.</p></article>`;
  const main=document.querySelector(".main"); const footer=main&&main.querySelector("footer"); if(footer)main.insertBefore(section,footer); else if(main)main.appendChild(section);
  b.addEventListener("click",()=>{document.querySelectorAll(".navitem").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x===section));$("pageTitle").textContent="Cash Buyer & Flipper AI";});
  $("cfiForm").addEventListener("submit",run);
  $("cfiSave").addEventListener("click",saveReview);
  renderReviews();
 }
 async function run(e){
  e.preventDefault();
  const market=$("cfiMarket").value.trim(),days=$("cfiWindow").value,type=$("cfiType").value;
  const selected=[...$("cfiTargets").selectedOptions].map(x=>x.value);
  const out=$("cfiResults"),searchStatus=$("cfiSearchStatus"),aiStatus=$("cfiAiStatus"),btn=$("cfiRun");
  if(!selected.length){searchStatus.textContent="Search: Select at least one research target.";return}
  btn.disabled=true;btn.textContent="Researching…";out.className="crm-list";out.innerHTML="";
  $("cfiAnalysis").classList.add("hidden");
  aiStatus.textContent="AI review: Waiting for search results.";
  const nationwide=market.toLowerCase()==="united states"||market.toLowerCase()==="nationwide";
  const targets={
   sales: nationwide
    ?"nationwide United States real estate investor purchases recorded deed transfers public property sales datasets multi-state transaction data"
    :"Ocean County New Jersey recorded deed transfers property sales buyer grantee seller grantor instrument number recording date county clerk public records "+market+" Jackson Toms River Brick Lakewood recent real estate sales",
   flippers: nationwide
    ?"United States nationwide real estate house flippers repeat property investors buy renovate resell documented transactions"
    :"Ocean County NJ repeat real estate investor buyers LLC purchases resales house flippers recorded transactions Jackson Toms River Brick Lakewood "+market,
   pros:"Ocean County New Jersey investor friendly agents brokers title companies settlement closing attorneys escrow officers REIA investor networking "+market,
   networks:"Ocean County New Jersey real estate investor association REIA meetups networking groups active house flippers cash buyers "+market
  };
  let all=[];
  try{
   for(const key of selected){
    searchStatus.textContent="Search: Searching "+key+" in "+market+"…";
    const r=await fetch("/api/research/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:targets[key]+" "+type+" source records transactions closing date",location:market,limit:8})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||"Public research request failed (HTTP "+r.status+").");
    for(const x of data.results||[])all.push({...x,researchType:key,retrievedAt:data.retrievedAt});
   }
  }catch(err){
   searchStatus.textContent="Search failed: "+(err.message||"Unknown search error.");
   aiStatus.textContent="AI review: Not run because search did not complete.";
   if(!all.length){out.className="empty";out.textContent="No search results were returned. Check the search error above."}
   btn.disabled=false;btn.textContent="Run cash buyer intelligence";return;
  }
  const seen=new Set();
  all=all.filter(x=>{const k=x.url;if(!k||seen.has(k))return false;seen.add(k);return true});
  const localMode=!nationwide, localLeads=[], contextOnly=[];
  const oceanTerms=["ocean county","jackson nj","toms river","brick township","brick, nj","lakewood nj","manchester township nj","berkeley township nj","lacey township nj","stafford township nj","barnegat nj","point pleasant nj","bayville nj","forked river","seaside heights nj","long beach island"];
  const marketTerms=market.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2&&!["county","township","city","state","new","jersey"].includes(w));
  const terms=market.toLowerCase().includes("ocean county")?oceanTerms:marketTerms;
  const otherPlaces=/\b(ohio|pennsylvania|north carolina|south carolina|florida|tennessee|texas|georgia|california|virginia|franklin county|clearfield county|wilson county|muskingum county|raleigh|fayetteville)\b/i;
  for(const x of all){
   const hay=[x.title,x.description,x.markdown,x.url].join(" ").toLowerCase();
   const local=terms.some(t=>hay.includes(t));
   x.marketRelevance=!localMode?"nationwide context":local?"local-market candidate":"context only";
   (local||!localMode?localLeads:contextOnly).push(x);
  }
  if(!all.length){
   out.className="empty";out.textContent="No results returned. Try a narrower city/county or another research target.";
   searchStatus.textContent="Search completed; no usable results.";
   aiStatus.textContent="AI review: Not run because there were no usable results.";
   btn.disabled=false;btn.textContent="Run cash buyer intelligence";return;
  }
  const display=localMode?[...localLeads,...contextOnly]:all;
  out.className="crm-list";
  out.innerHTML=(localMode?'<div class="notice"><b>Local-market candidates: '+localLeads.length+'</b> · General/context sources: '+contextOnly.length+'. Context sources are not local buyer leads.</div>':"")+display.map((x,i)=>{
   const d=Date.parse(x.retrievedAt||"");
   const retrieved=Number.isFinite(d)?new Date(d).toLocaleString():"date unavailable";
   return '<div class="crm-card"><div><b>'+esc(x.title)+'</b><small>'+esc(x.researchType.toUpperCase())+' · '+esc(x.marketRelevance||"Unclassified")+'</small><small>'+esc(x.description||"Public source result")+'</small><small><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">Open source</a> · Retrieved '+esc(retrieved)+'</small></div><div><span class="crm-flag">Unverified</span></div><div class="actions"><button class="textbtn" data-cfi-review="'+i+'">Add to verification review</button></div></div>';
  }).join("");
  out.querySelectorAll("[data-cfi-review]").forEach(b=>b.addEventListener("click",()=>{
   const x=display[Number(b.dataset.cfiReview)];
   $("cfiBuyerName").value=x.title;
   $("cfiEvidence").value="Research type: "+x.researchType+"\nSource: "+x.url+"\nRetrieved: "+(x.retrievedAt||"unknown")+"\nFinding: "+(x.description||"")+"\n\nVerify legal buyer identity, recorded closing and current deal-specific funding.";
   $("cfiSaveStatus").textContent="Research lead loaded. Complete the independent checks before marking verified.";
  }));
  searchStatus.textContent="Search complete: "+all.length+" distinct public sources found. "+(localMode?(localLeads.length+" local-market candidates; "+contextOnly.length+" context-only sources separated. All remain unverified."):"Nationwide research results; all remain unverified.");
  aiStatus.textContent="AI review: Preparing a limited evidence summary…";
  // Keep the prompt below the server's 12,000-character limit. Never let an AI
  // assessment failure erase or relabel the independently returned search results.
  const evidence=(localMode?localLeads:all).concat(localMode?contextOnly:[]).slice(0,5).map(x=>({
   type:String(x.researchType||"").slice(0,20),
   marketRelevance:String(x.marketRelevance||"").slice(0,40),
   title:String(x.title||"").slice(0,140),
   url:String(x.url||"").slice(0,300),
   description:String(x.description||"").slice(0,280),
   content:String(x.markdown||"").slice(0,280),
   retrievedAt:String(x.retrievedAt||"").slice(0,40)
  }));
  const prompt="You are Cash Buyer & Flipper Intelligence AI. Assess public web research for market "+market+", property focus "+type+", lookback "+days+" days. For local searches, assess local-market candidates separately from context-only sources. Reject unrelated county/state deed lists as local leads. Identify the exact jurisdiction; a generic New Jersey mention is not proof of Ocean County. For nationwide searches, distinguish genuinely national datasets from individual county or city sources. Classify each candidate as verified closing, public-record lead only, listing/marketing signal, professional/network contact, or irrelevant. Do not call any buyer verified unless source evidence establishes a closed transaction and identity. A past cash purchase is not proof of current funds. Never infer cash from absence of a mortgage. State unknowns including county coverage, deed type, arm's-length status, closing date and financing. Identify unrelated jurisdictions and recommend excluding them from a local-market shortlist. Do not fabricate contacts or closings. Return concise ranked next steps and a verification checklist. Evidence: "+JSON.stringify(evidence);
  try{
   const ai=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
   const ad=await ai.json().catch(()=>({}));
   if(!ai.ok)throw new Error(ad.error||"AI assessment failed (HTTP "+ai.status+").");
   $("cfiAnalysis").textContent=ad.answer||"No AI assessment returned.";
   $("cfiAnalysis").classList.remove("hidden");
   aiStatus.textContent="AI review complete. Search results remain unverified until independently checked.";
  }catch(err){
   aiStatus.textContent="AI review unavailable: "+(err.message||"Unknown AI error")+". Your "+all.length+" search results are still available above.";
  }finally{
   btn.disabled=false;btn.textContent="Run cash buyer intelligence";
  }
 }
 function saveReview(){
  const name=$("cfiBuyerName").value.trim();if(!name){$("cfiSaveStatus").textContent="Enter a buyer or company name first.";return}
  const closed=$("cfiClosed").value,recent=$("cfiRecent").value,funds=$("cfiFunds").value,speed=$("cfiSpeed").value;
  const fundingReady=closed==="confirmed"&&recent==="12m"&&funds==="verified"&&speed!=="unknown";
  const record={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,closed,recent,funds,speed,evidence:$("cfiEvidence").value.trim(),fundingReady,updated:new Date().toISOString()};
  leads.unshift(record);localStorage.setItem(KEY,JSON.stringify(leads));$("cfiSaveStatus").textContent=fundingReady?"Saved. Eligible for owner review as funding-verified for this deal; recheck immediately before contract.":"Saved as unverified / not funding-ready. More independent evidence is required.";renderReviews();
 }
 function renderReviews(){const host=$("cfiBuyerReviews");if(!host)return;if(!leads.length){host.className="empty";host.textContent="No buyer verification reviews saved.";return}host.className="crm-list";host.innerHTML=leads.map(x=>'<div class="crm-card"><div><b>'+esc(x.name)+'</b><small>Closing: '+esc(x.closed)+' · Recent: '+esc(x.recent)+'</small><small>Funds: '+esc(x.funds)+' · Speed: '+esc(x.speed)+'</small><small>'+esc(x.evidence)+'</small></div><div><span class="crm-flag">'+(x.fundingReady?"Funding verified — owner review":"Not funding-ready")+'</span></div></div>').join("")}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();