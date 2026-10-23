(function(){
var A=Admin,E=A.esc,$=A.$,$$=A.$$,I=A.icons;
var CATS=['Baby clothing','Diapers & wipes','Feeding','Toys','Strollers & gear','Bath & skin care','Maternity'];
var BRANDS=['Pampers','Huggies','Cerelac','Nestle Lactogen','Fisher-Price','Chicco','Johnson\'s'];
var PRODS=['Pampers Premium M (64)','Huggies Dry Pants L (44)','Cerelac Wheat 400g','Chicco Natural Feeling Bottle','Fisher-Price Rainforest Gym','Stroller Foldable 3-in-1','Johnson\'s Baby Lotion 200ml'];
var d=function(n){var x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
var coupons=[
{code:'WELCOME10',type:'percent',value:10,cap:300,min:999,from:d(-60),to:d(120),total:2000,per:1,used:612,stack:false,collect:true,showPdp:true,first:true,seg:'new',pay:[],apply:'all',status:'active'},
{code:'EIDFREE',type:'freedel',value:0,cap:0,min:1500,from:d(-5),to:d(20),total:5000,per:1,used:1180,stack:true,collect:true,showPdp:false,first:false,seg:'all',pay:[],apply:'all',status:'active'},
{code:'DIAPER150',type:'fixed',value:150,cap:0,min:1200,from:d(-20),to:d(40),total:1000,per:2,used:233,stack:false,collect:false,showPdp:false,first:false,seg:'all',pay:['cod'],apply:'cats',status:'active'},
{code:'B2G1-CERELAC',type:'bxgy',value:0,cap:0,min:0,from:d(2),to:d(30),total:500,per:3,used:0,stack:false,collect:true,showPdp:true,first:false,seg:'all',pay:[],apply:'brands',status:'scheduled',buy:2,get:1},
{code:'FRIEND200',type:'fixed',value:200,cap:0,min:1000,from:d(-90),to:d(300),total:0,per:1,used:341,stack:false,collect:true,showPdp:false,first:true,seg:'referral',pay:[],apply:'all',status:'active'},
{code:'VIP-RUMA',type:'percent',value:15,cap:500,min:0,from:d(-10),to:d(10),total:1,per:1,used:0,stack:false,collect:false,showPdp:false,first:false,seg:'specific',pay:[],apply:'all',status:'active'},
{code:'SUMMER25',type:'percent',value:25,cap:600,min:2500,from:d(-70),to:d(-15),total:3000,per:1,used:2964,stack:false,collect:true,showPdp:true,first:false,seg:'all',pay:[],apply:'cats',status:'expired'},
{code:'TOYS5',type:'percent',value:5,cap:0,min:0,from:d(-30),to:d(60),total:0,per:5,used:98,stack:true,collect:false,showPdp:false,first:false,seg:'all',pay:[],apply:'cats',status:'paused'}
];
var autos=[
{name:'Free delivery over ৳3,000',desc:'Cart subtotal >= ৳3,000, all zones',on:true,stack:true,used:421},
{name:'৳100 off first order',desc:'New customers, no code needed, min ৳800',on:true,stack:false,used:288},
{name:'10% off Diapers category',desc:'Applies to category Diapers & wipes, weekends',on:false,stack:true,used:0}
];
var pm=[
{m:'bKash',pct:5,cap:300,min:1000,on:false},
{m:'Nagad',pct:3,cap:200,min:1000,on:false},
{m:'Card',pct:2,cap:150,min:2000,on:false},
{m:'COD',pct:0,cap:0,min:0,on:true,note:'No discount (default method)'}
];
var tab='coupons',q='',stF='';
var TYPES={percent:'Percentage',fixed:'Fixed amount',freedel:'Free delivery',bxgy:'Buy X get Y'};
function val(c){return c.type==='percent'?c.value+'%'+(c.cap?' (max '+A.fmt.bdt(c.cap)+')':''):c.type==='fixed'?A.fmt.bdt(c.value):c.type==='freedel'?'Free delivery':'Buy '+(c.buy||2)+' get '+(c.get||1)}
function stBadge(s){var m={active:'ok',scheduled:'info',expired:'muted',paused:'warn'};return '<span class="a-badge '+m[s]+'">'+s+'</span>'}
function head(){return '<div class="a-tabs" role="tablist">'+[['coupons','Coupons',coupons.length],['auto','Auto discounts',autos.length],['pay','Payment-method discounts',pm.length]].map(function(t){return '<button class="a-tab" role="tab" data-t="'+t[0]+'" aria-selected="'+(tab===t[0])+'">'+t[1]+' <span class="a-count">'+t[2]+'</span></button>'}).join('')+'</div>'}
function couponTab(){
 var rows=coupons.filter(function(c){return (!q||c.code.toLowerCase().includes(q.toLowerCase()))&&(!stF||c.status===stF)});
 return '<div class="a-toolbar"><input class="a-input" id="cq" placeholder="Search code" value="'+E(q)+'" style="max-width:220px"><select id="cst"><option value="">All statuses</option>'+['active','scheduled','paused','expired'].map(function(s){return '<option'+(stF===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select><span style="flex:1"></span><button class="a-btn primary" id="newc">'+I.plus+' New coupon</button></div>'+
 '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th class="num">Used / limit</th><th>Valid</th><th>Status</th><th>Flags</th><th></th></tr></thead><tbody>'+
 (rows.length?rows.map(function(c){var i=coupons.indexOf(c);return '<tr><td><span class="m-code">'+E(c.code)+'</span></td><td>'+TYPES[c.type]+'</td><td>'+val(c)+'</td><td class="num">'+A.fmt.num(c.used)+' / '+(c.total?A.fmt.num(c.total):'∞')+'</td><td class="m-muted">'+A.fmt.date(c.from)+' → '+A.fmt.date(c.to)+'</td><td>'+stBadge(c.status)+'</td><td><span class="a-badge '+(c.collect?'info':'muted')+'">'+(c.collect?'collectable':'code only')+'</span> <span class="a-badge '+(c.stack?'ok':'muted')+'">'+(c.stack?'stackable':'exclusive')+'</span>'+(c.first?' <span class="a-badge warn">1st order</span>':'')+'</td><td style="white-space:nowrap"><button class="a-btn sm ghost" data-e="'+i+'">'+I.edit+' Edit</button> <button class="a-btn sm ghost" data-p="'+i+'">'+(c.status==='paused'?'Resume':'Pause')+'</button></td></tr>'}).join(''):'<tr><td colspan="8"><div class="a-empty">No coupons match.</div></td></tr>')+
 '</tbody></table></div></div>'}
function autoTab(){
 return '<div class="a-toolbar"><span class="m-muted">Automatic discounts apply at cart without a code. Best-for-customer wins unless stackable.</span><span style="flex:1"></span><button class="a-btn primary" id="newa">'+I.plus+' New auto discount</button></div><div class="a-card"><div class="a-card-b">'+
 autos.map(function(a,i){return '<div class="m-sw-row"><div><b>'+E(a.name)+'</b><div class="m-muted">'+E(a.desc)+' · used '+a.used+'x · '+(a.stack?'stackable':'exclusive')+'</div></div><div class="m-row"><button class="a-btn sm ghost" data-ae="'+i+'">'+I.edit+'</button><label class="a-switch"><input type="checkbox" data-as="'+i+'"'+(a.on?' checked':'')+'><span></span></label></div></div>'}).join('')+'</div></div>'}
function payTab(){
 return '<div class="m-note info">'+I.warn+'<div>Online payment methods are <b>OFF at launch</b> (flag <code>online_payments_enabled</code>). These discounts are configured now and become active when the method is enabled in Settings.</div></div><div style="height:10px"></div><div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Method</th><th class="num">Discount %</th><th class="num">Max cap</th><th class="num">Min order</th><th>Method status</th><th>Enabled</th><th></th></tr></thead><tbody>'+
 pm.map(function(p,i){var online=p.m!=='COD';return '<tr><td><b>'+p.m+'</b></td><td class="num">'+(p.pct?p.pct+'%':'—')+'</td><td class="num">'+(p.cap?A.fmt.bdt(p.cap):'—')+'</td><td class="num">'+(p.min?A.fmt.bdt(p.min):'—')+'</td><td>'+(online?'<span class="a-badge muted">method off (launch)</span>':'<span class="a-badge ok">live</span>')+'</td><td><label class="a-switch"><input type="checkbox" data-ps="'+i+'"'+(p.on?' checked':'')+(online?'':' disabled')+'><span></span></label></td><td>'+(online?'<button class="a-btn sm ghost" data-pe="'+i+'">'+I.edit+' Edit</button>':'<span class="m-muted">'+p.note+'</span>')+'</td></tr>'}).join('')+'</tbody></table></div></div>'+
 '<div class="m-note" style="margin-top:10px">Example: bKash 5% up to ৳300 on carts from ৳1,000 — a ৳4,000 cart gets ৳200 off; ৳10,000 cart gets the ৳300 cap.</div>'}
function paint(){
 var b=$('#mk');b.innerHTML=head()+'<div style="height:12px"></div>'+(tab==='coupons'?couponTab():tab==='auto'?autoTab():payTab());
 $$('.a-tab',b).forEach(function(t){t.onclick=function(){tab=t.dataset.t;paint()}});
 var cq=$('#cq',b);if(cq){cq.oninput=function(){q=cq.value;var p=cq.selectionStart;paint();var n=$('#cq');n.focus();n.setSelectionRange(p,p)};$('#cst',b).onchange=function(){stF=this.value;paint()};$('#newc',b).onclick=function(){edit(-1)}}
 $$('[data-e]',b).forEach(function(x){x.onclick=function(){edit(+x.dataset.e)}});
 $$('[data-p]',b).forEach(function(x){x.onclick=function(){var c=coupons[+x.dataset.p];c.status=c.status==='paused'?'active':'paused';A.toast('Coupon '+c.code+' '+c.status,'ok');paint()}});
 $$('[data-as]',b).forEach(function(x){x.onchange=function(){autos[+x.dataset.as].on=x.checked;A.toast('Auto discount '+(x.checked?'enabled':'disabled'),'ok')}});
 $$('[data-ps]',b).forEach(function(x){x.onchange=function(){pm[+x.dataset.ps].on=x.checked;A.toast('Payment discount '+(x.checked?'enabled':'disabled'),'ok');paint()}});
 var na=$('#newa',b);if(na)na.onclick=function(){autoEdit(-1)};
 $$('[data-ae]',b).forEach(function(x){x.onclick=function(){autoEdit(+x.dataset.ae)}});
 $$('[data-pe]',b).forEach(function(x){x.onclick=function(){payEdit(+x.dataset.pe)}});
}
function opts(name,list,sel,type){return '<div class="m-opts">'+list.map(function(o){var v=o[0],l=o[1],s=o[2];return '<label class="m-opt"><input type="'+(type||'radio')+'" name="'+name+'" value="'+v+'"'+((Array.isArray(sel)?sel.indexOf(v)>-1:sel===v)?' checked':'')+'><span>'+l+(s?'<small>'+s+'</small>':'')+'</span></label>'}).join('')+'</div>'}
function pick(name,list,sel){return '<div class="m-pick">'+list.map(function(x){return '<label><input type="checkbox" name="'+name+'" value="'+E(x)+'"'+(sel&&sel.indexOf(x)>-1?' checked':'')+'> '+E(x)+'</label>'}).join('')+'</div>'}
function rnd(){var s='';for(var i=0;i<6;i++)s+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)];return s}
function edit(i){
 var c=i<0?{code:'',type:'percent',value:10,cap:0,min:0,from:d(0),to:d(30),total:0,per:1,used:0,stack:false,collect:false,showPdp:false,first:false,seg:'all',pay:[],apply:'all',status:'scheduled',buy:2,get:1}:coupons[i];
 var h='<form id="cf"><div class="m-sec">Code &amp; discount</div><div class="m-form-grid">'+
 '<div class="a-field full"><label>Coupon code</label><div class="m-row"><input id="f-code" class="a-input m-grow" value="'+E(c.code)+'" placeholder="e.g. EID200" style="text-transform:uppercase"><button type="button" class="a-btn" id="gen">Auto-generate</button></div><div class="a-hint">Letters/numbers, unique. Customers type it at checkout.</div></div>'+
 '<div class="a-field full"><label>Type</label>'+opts('type',[['percent','Percentage'],['fixed','Fixed amount'],['freedel','Free delivery'],['bxgy','Buy X get Y']],c.type)+'</div>'+
 '<div class="a-field" id="g-val"><label id="l-val">Value</label><div class="m-input-unit"><input id="f-val" type="number" class="a-input" value="'+c.value+'"><span id="u-val">%</span></div></div>'+
 '<div class="a-field" id="g-cap"><label>Max discount cap (৳)</label><input id="f-cap" type="number" class="a-input" value="'+(c.cap||'')+'" placeholder="no cap"></div>'+
 '<div class="a-field" id="g-bx" style="display:none"><label>Buy X</label><input id="f-buy" type="number" class="a-input" value="'+(c.buy||2)+'"></div>'+
 '<div class="a-field" id="g-gy" style="display:none"><label>Get Y free</label><input id="f-get" type="number" class="a-input" value="'+(c.get||1)+'"></div>'+
 '<div class="a-field"><label>Minimum order (৳)</label><input id="f-min" type="number" class="a-input" value="'+(c.min||'')+'" placeholder="none"></div></div>'+
 '<div class="m-sec">Validity &amp; limits</div><div class="m-form-grid"><div class="a-field"><label>Valid from</label><input id="f-from" type="date" class="a-input" value="'+c.from+'"></div><div class="a-field"><label>Valid to</label><input id="f-to" type="date" class="a-input" value="'+c.to+'"></div>'+
 '<div class="a-field"><label>Total usage limit</label><input id="f-total" type="number" class="a-input" value="'+(c.total||'')+'" placeholder="unlimited"></div><div class="a-field"><label>Per customer limit</label><input id="f-per" type="number" class="a-input" value="'+(c.per||1)+'"></div></div>'+
 '<div class="m-sec">Applies to</div>'+opts('apply',[['all','Everything','whole cart'],['cats','Categories',''],['prods','Products',''],['brands','Brands','']],c.apply)+
 '<div id="ap-list" style="margin-top:8px"></div><div class="a-field" style="margin-top:8px"><label>Exclusions (products never discounted)</label><input class="a-input" id="f-excl" placeholder="Search products to exclude…" value=""><div class="m-tags" id="excl" style="margin-top:6px"></div></div>'+
 '<div class="m-sec">Who &amp; how</div><div class="a-field"><label>Customer segment</label>'+opts('seg',[['all','All customers'],['new','New customers','0 delivered orders'],['specific','Specific customers','pick by phone'],['referral','Referral','friend-invite coupon']],c.seg)+'</div>'+
 '<div class="a-field" id="g-spec" style="display:none"><label>Customers (phone)</label><input class="a-input" value="" placeholder="01712-345678, 01819-000111"></div>'+
 '<div class="a-field"><label>Payment method restriction</label>'+opts('pay',[['cod','COD','live at launch'],['bkash','bKash','online — off at launch'],['nagad','Nagad','online — off at launch'],['card','Card','online — off at launch']],c.pay,'checkbox')+'<div class="a-hint">None selected = any method. Online methods are disabled by feature flag at launch; restriction stays saved.</div></div>'+
 '<div class="m-sec">Behaviour</div>'+
 [['f-stack','Stackable with other coupons/discounts','Per-coupon setting. Off = cannot combine with any other coupon.',c.stack],['f-collect','Collectable into coupon wallet','Customers can claim it and it shows in their wallet.',c.collect],['f-pdp','Show on product page','Banner "Save with code …" on eligible products.',c.showPdp],['f-first','First-order only','Valid only on a customer\'s first order.',c.first]].map(function(s){return '<div class="m-sw-row"><div><b>'+s[1]+'</b><div class="m-muted">'+s[2]+'</div></div><label class="a-switch"><input type="checkbox" id="'+s[0]+'"'+(s[3]?' checked':'')+'><span></span></label></div>'}).join('')+
 '<div class="m-foot"><button type="button" class="a-btn" id="cx">Cancel</button><button class="a-btn primary" type="submit">'+(i<0?'Create coupon':'Save changes')+'</button></div></form>';
 A.drawer.open(h,{title:i<0?'New coupon':'Edit '+c.code,width:560});
 var f=$('#cf');
 function sync(){var t=f.type.value||$('input[name=type]:checked',f).value;
  $('#g-val').style.display=(t==='percent'||t==='fixed')?'':'none';$('#g-cap').style.display=t==='percent'?'':'none';$('#g-bx').style.display=$('#g-gy').style.display=t==='bxgy'?'':'none';
  $('#u-val').textContent=t==='percent'?'%':'৳';
  var ap=$('input[name=apply]:checked',f).value,l={cats:CATS,brands:BRANDS,prods:PRODS}[ap];$('#ap-list').innerHTML=l?pick('aplist',l,l.slice(0,2)):'';
  $('#g-spec').style.display=$('input[name=seg]:checked',f).value==='specific'?'':'none'}
 $$('input[type=radio]',f).forEach(function(r){r.onchange=sync});sync();
 $('#gen').onclick=function(){$('#f-code').value=rnd()};
 var ex=$('#excl'),exl=['Stroller Foldable 3-in-1'];function dx(){ex.innerHTML=exl.map(function(x,k){return '<span class="m-tag">'+E(x)+'<button type="button" data-x="'+k+'">×</button></span>'}).join('');$$('[data-x]',ex).forEach(function(b){b.onclick=function(){exl.splice(+b.dataset.x,1);dx()}})}dx();
 $('#cx').onclick=A.drawer.close;
 f.onsubmit=function(e){e.preventDefault();var code=$('#f-code').value.trim().toUpperCase();if(!code){A.toast('Enter or generate a code','warn');return}
  var o={code:code,type:$('input[name=type]:checked',f).value,value:+$('#f-val').value||0,cap:+$('#f-cap').value||0,min:+$('#f-min').value||0,from:$('#f-from').value,to:$('#f-to').value,total:+$('#f-total').value||0,per:+$('#f-per').value||1,used:c.used,stack:$('#f-stack').checked,collect:$('#f-collect').checked,showPdp:$('#f-pdp').checked,first:$('#f-first').checked,seg:$('input[name=seg]:checked',f).value,pay:$$('input[name=pay]:checked',f).map(function(x){return x.value}),apply:$('input[name=apply]:checked',f).value,status:c.status,buy:+$('#f-buy').value,get:+$('#f-get').value};
  if(i<0)coupons.unshift(o);else coupons[i]=o;A.drawer.close();A.toast('Coupon '+code+(i<0?' created':' saved'),'ok');paint()}
}
function autoEdit(i){var a=i<0?{name:'',desc:'',on:true,stack:true,used:0}:autos[i];
 A.modal.open('<form id="af" class="m-col"><div class="a-field"><label>Name</label><input class="a-input" id="an" value="'+E(a.name)+'"></div><div class="a-field"><label>Rule (shown to staff)</label><input class="a-input" id="ad" value="'+E(a.desc)+'" placeholder="e.g. Cart >= ৳3,000 → free delivery"></div><div class="m-sw-row"><b>Stackable with coupons</b><label class="a-switch"><input type="checkbox" id="as"'+(a.stack?' checked':'')+'><span></span></label></div><div class="m-foot"><button class="a-btn primary">Save</button></div></form>',{title:i<0?'New auto discount':'Edit auto discount',size:'sm'});
 $('#af').onsubmit=function(e){e.preventDefault();var o={name:$('#an').value||'Untitled',desc:$('#ad').value,on:a.on,stack:$('#as').checked,used:a.used};if(i<0)autos.push(o);else autos[i]=o;A.modal.close();A.toast('Saved','ok');paint()}}
function payEdit(i){var p=pm[i];
 A.modal.open('<form id="pf" class="m-form-grid"><div class="a-field"><label>Discount %</label><input class="a-input" id="pp" type="number" value="'+p.pct+'"></div><div class="a-field"><label>Max cap (৳)</label><input class="a-input" id="pc" type="number" value="'+p.cap+'"></div><div class="a-field full"><label>Minimum order (৳)</label><input class="a-input" id="pmn" type="number" value="'+p.min+'"></div><div class="full m-note warn">'+I.warn+'<div>'+p.m+' is disabled at launch; this applies once enabled.</div></div><div class="full m-foot"><button class="a-btn primary">Save</button></div></form>',{title:p.m+' discount',size:'sm'});
 $('#pf').onsubmit=function(e){e.preventDefault();p.pct=+$('#pp').value;p.cap=+$('#pc').value;p.min=+$('#pmn').value;A.modal.close();A.toast('Saved','ok');paint()}}
A.renderPage({active:'coupons',title:'Coupons & discounts',crumbs:[['Marketing','#'],['Coupons & discounts']],actions:'',body:'<div id="mk"></div>',onReady:paint});
})();
