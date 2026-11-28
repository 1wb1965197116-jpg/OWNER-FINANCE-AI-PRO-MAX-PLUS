"use strict";
(()=>{
const $=id=>document.getElementById(id), KEY="ofpmplus_property_intel_profiles_v1";
const fields=["Address","City","State","Zip","Type","Value","Five","Three","One","Six","Rent","Comp","Dom","Repairs","Factor","Mortgages","Balance","Liens","LienAmount","Sale","SaleDate","Mls","Doc","Source"];
const ids=fields.map(x=>"pi"+x);
const val=id=>$(id)?.value??"";
const num=id=>Math.max(0,Number(val(id))||0);
const money=n=>n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function all(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function read(){return Object.fromEntries(fields.map(x=>[x[0].toLowerCase()+x.slice(1),val("pi"+x)]))}
function render(){
 const p=read(),v=num("piValue"),bal=num("piBalance"),liens=num("piLienAmount"),eq=v-bal-liens,ep=v?eq/v*100:0,rent=num("piRent"),yieldPct=v?rent*12/v*100:0,factor=Math.min(100,num("piFactor")||70),wholesale=v*factor/100-num("piRepairs");
 const pct=x=>x&&v?(v-Number(x))/Number(x)*100:null;
 const rows=[["Estimated equity",v?money(eq):"—"],["Equity / value",v?ep.toFixed(1)+"%":"—"],["Wholesale screening estimate",v?money(wholesale):"—"],["Monthly rent",rent?money(rent):"—"],["Gross rental yield",v&&rent?yieldPct.toFixed(2)+"%":"—"],["Average comparable sale",num("piComp")?money(num("piComp")):"—"],["Comparable days on market",num("piDom")||"—"],["Open mortgages",num("piMortgages")],["Estimated mortgage balance",bal?money(bal):"—"],["Liens / recorded amount",num("piLiens")+" / "+money(liens)],["Public-record last sale",num("piSale")?money(num("piSale")):"—"],["MLS last sale",num("piMls")?money(num("piMls")):"—"]];
 $("piMetrics").innerHTML='<div class="pi-summary"><div><small>ESTIMATED VALUE</small><b>'+(v?money(v):"Not entered")+'</b><small>Source must be checked</small></div><div><small>ESTIMATED EQUITY</small><b>'+(v?money(eq):"—")+'</b><small>'+(v?ep.toFixed(1)+"% of value":"Balance not established")+'</small></div><div><small>VALUE CHANGE VS 1 YEAR</small><b>'+(pct(val("piOne"))===null?"—":(pct(val("piOne"))>=0?"+":"")+pct(val("piOne")).toFixed(1)+"%")+'</b><small>Based on entered values</small></div></div><div class="pi-result-grid">'+rows.map(x=>'<div class="resultbox"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join("")+'</div><p class="muted">Equity subtracts entered mortgage and lien balances only; it is not verified available equity. Gross yield excludes operating expenses. Wholesale estimate uses the entered factor and repairs, not a market-validated offer.</p>';
 const key=(val("piAddress")+"|"+val("piZip")).toLowerCase(),p0=all().find(x=>x.key===key),hist=p0?.history||[];
 $("piHistory").innerHTML=hist.length?hist.slice(-12).reverse().map(x=>'<div class="settingsrow"><span>'+esc(new Date(x.date).toLocaleDateString())+'</span><b>'+money(x.value)+'</b></div>').join(""):'<div class="empty">No value snapshots recorded.</div>';
}
function save(){
 const p=read();if(!p.address&&!p.zip){alert("Enter a property address or ZIP.");return}
 const key=(p.address+"|"+p.zip).toLowerCase(),a=all(),i=a.findIndex(x=>x.key===key),obj={...(i>=0?a[i]:{history:[]}),...p,key,updatedAt:new Date().toISOString()};
 if(i>=0)a[i]=obj;else a.push(obj);localStorage.setItem(KEY,JSON.stringify(a));render();alert("Property profile saved on this device.");
}
function snapshot(){
 const p=read(),v=num("piValue");if(!v){alert("Enter the estimated current value first.");return}
 const key=(p.address+"|"+p.zip).toLowerCase(),a=all(),i=a.findIndex(x=>x.key===key),obj=i>=0?a[i]:{...p,key,history:[]};
 obj.history=obj.history||[];obj.history.push({date:new Date().toISOString(),value:v});obj.updatedAt=new Date().toISOString();if(i>=0)a[i]=obj;else a.push(obj);localStorage.setItem(KEY,JSON.stringify(a));render();
}
function fill(p){const m={address:p.address||p.title||"",city:p.city||"",state:p.state||"NJ",zip:p.zip||"",source:p.source||""};Object.entries(m).forEach(([k,v])=>$("pi"+k[0].toUpperCase()+k.slice(1)).value=v);$("piProfile").scrollIntoView({behavior:"smooth",block:"start"});render()}
function init(){
 $("piCalculate").onclick=render;$("piSave").onclick=save;$("piSnapshot").onclick=snapshot;
 $("piClear").onclick=()=>{ids.forEach(id=>{if($(id))$(id).value=id==="piState"?"NJ":id==="piFactor"?"70":""});$("piType").selectedIndex=0;render()};
 ids.forEach(id=>$(id)?.addEventListener("change",render));
 document.getElementById("llImported")?.addEventListener("click",e=>{const b=e.target.closest("[data-pi-open]");if(!b)return;const r=JSON.parse(b.dataset.piOpen);fill(r)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();