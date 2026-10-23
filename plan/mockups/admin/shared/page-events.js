(function(){
var A=Admin,E=A.esc,$=A.$,$$=A.$$,I=A.icons;
var d=function(n){var x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
var BT={
 hero:{n:'Hero banner',i:'🖼️',def:{title:'Eid Mega Sale',sub:'Up to 40% off baby essentials',c1:'#c2185b',c2:'#7b1fa2',cta:'Shop now'}},
 countdown:{n:'Countdown',i:'⏱️',def:{label:'Sale ends in',endsAt:'event end'}},
 coupon:{n:'Coupon strip',i:'🎟️',def:{codes:'EIDFREE, FRIEND200'}},
 tiles:{n:'Category tiles',i:'🧩',def:{cats:'Diapers, Feeding, Toys, Clothing'}},
 grid:{n:'Product grid',i:'▦',def:{title:'Top deals',count:8,source:'Event price products'}},
 carousel:{n:'Product carousel',i:'🎠',def:{title:'Trending now',count:10,source:'Best sellers'}},
 flash:{n:'Flash-sale block',i:'⚡',def:{sale:'Midnight Diaper Rush'}},
 pair:{n:'Banner pair',i:'◫',def:{t1:'Diapers',t2:'Toys',c1:'#00897b',c2:'#f57c00'}},
 html:{n:'Text / HTML',i:'📝',def:{html:'<h3>Delivery notice</h3><p>Orders placed before Eid eve ship in 24h.</p>'}}
};
var uid=1;function blk(t,o){return {id:uid++,t:t,s:Object.assign({},BT[t].def,o||{})}}
var events=[
{name:'Eid Mega Sale 2026',slug:'eid-mega-sale',start:d(-2),end:d(5),status:'live',blocks:[blk('hero'),blk('countdown'),blk('coupon'),blk('tiles'),blk('flash'),blk('grid'),blk('pair',{})],prices:[{n:'Pampers Premium M (64)',e:'🧷',reg:2450,ev:1999},{n:'Cerelac Wheat 400g',e:'🥣',reg:690,ev:560},{n:'Fisher-Price Rainforest Gym',e:'🧸',reg:4200,ev:3499},{n:'Baby Romper Set (3 pcs)',e:'👕',reg:950,ev:699}]},
{name:'Boishakhi Baby Fair',slug:'boishakhi-fair',start:d(120),end:d(128),status:'scheduled',blocks:[blk('hero',{title:'Pohela Boishakh Fair',c1:'#e65100',c2:'#c62828'}),blk('carousel')],prices:[]},
{name:'Winter Warmers 2025',slug:'winter-2025',start:d(-300),end:d(-290),status:'ended',blocks:[blk('hero',{title:'Winter Warmers'})],prices:[]}
];
var cur=0,tab='builder',sel=null,mode='desktop';
function ev(){return events[cur]}
function ovl(a,b){return events.some(function(e,k){return k!==cur&&e.status!=='ended'&&a<=e.end&&b>=e.start})}
function stB(s){return '<span class="a-badge '+(s==='live'?'danger':s==='scheduled'?'info':'muted')+'">'+(s==='live'?'● live':s)+'</span>'}
function header(){var e=ev();
 return '<div class="m-note info" style="margin-bottom:12px">'+I.warn+'<div><b>Only one active event at a time.</b> Event prices apply site-wide while the event is live. Scheduling a second event whose dates overlap shows a conflict and cannot be published.</div></div>'+
 '<div class="a-card" style="margin-bottom:12px"><div class="a-card-b"><div class="m-row sp"><div class="m-row">'+
 events.map(function(x,k){return '<button class="a-btn sm '+(k===cur?'primary':'')+'" data-ev="'+k+'">'+E(x.name)+' '+stB(x.status)+'</button>'}).join('')+'<button class="a-btn sm ghost" id="newev">'+I.plus+' New event</button></div></div></div></div>'}
function sched(){var e=ev(),cf=ovl(e.start,e.end);
 return '<div class="a-card"><div class="a-card-b"><div class="m-form-grid"><div class="a-field full"><label>Event name</label><input class="a-input" id="en" value="'+E(e.name)+'"></div><div class="a-field"><label>URL slug</label><div class="m-input-unit"><span style="border-left:1px solid var(--border);border-radius:4px 0 0 4px;border-right:0">/event/</span><input class="a-input" id="es" style="border-radius:0 4px 4px 0" value="'+E(e.slug)+'"></div></div><div class="a-field"><label>Status</label><div style="padding-top:6px">'+stB(e.status)+'</div></div><div class="a-field"><label>Starts</label><input type="date" class="a-input" id="est" value="'+e.start+'"></div><div class="a-field"><label>Ends</label><input type="date" class="a-input" id="eed" value="'+e.end+'"></div></div>'+
 (cf?'<div class="m-note danger" style="margin-top:10px">'+I.warn+'<div><b>Conflict:</b> these dates overlap another active/scheduled event. Only one event can run at a time — change the dates before publishing.</div></div>':'')+
 '<div class="m-row" style="margin-top:12px"><button class="a-btn primary" id="pub"'+(e.status==='ended'?' disabled':'')+'>'+(e.status==='live'?'Update live event':'Schedule & publish')+'</button><button class="a-btn" id="draft">Save draft</button>'+(e.status==='live'?'<button class="a-btn ghost danger" id="endev">End event now</button>':'')+'</div></div></div>'}
function tabs(){return '<div class="a-tabs">'+[['builder','Page builder'],['prices','Event prices ('+ev().prices.length+')'],['sched','Schedule & publish']].map(function(t){return '<button class="a-tab" data-t="'+t[0]+'" aria-selected="'+(tab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div><div style="height:12px"></div>'}
function pvBlock(b){var s=b.s,e=ev();
 switch(b.t){
 case 'hero':return '<div class="m-pv-hero" style="background:linear-gradient(135deg,'+s.c1+','+s.c2+')"><div><div style="font-size:18px">'+E(s.title)+'</div><div style="font-size:12px;font-weight:500">'+E(s.sub)+'</div><span class="a-badge" style="background:#fff;color:#000;margin-top:6px">'+E(s.cta)+'</span></div></div>';
 case 'countdown':return '<div style="text-align:center;font-size:12px;margin-bottom:4px">'+E(s.label)+'</div><div class="m-pv-cd"><span>05<small>days</small></span><span>13<small>hrs</small></span><span>42<small>min</small></span><span>09<small>sec</small></span></div>';
 case 'coupon':return '<div class="m-pv-strip">'+s.codes.split(',').map(function(c){return '<div>🎟️ <b>'+E(c.trim())+'</b> · Collect</div>'}).join('')+'</div>';
 case 'tiles':return '<div class="m-pv-tiles">'+s.cats.split(',').map(function(c){return '<div>🧩<br>'+E(c.trim())+'</div>'}).join('')+'</div>';
 case 'grid':case 'carousel':var n=Math.min(+s.count||4,s.t==='grid'?8:6),pr=e.prices.length?e.prices:[{n:'Product',e:'📦',reg:1000,ev:800}];return '<div style="font-weight:700;font-size:13px;margin-bottom:6px">'+E(s.title)+'</div><div class="m-pv-prods">'+Array.from({length:Math.min(n,4)}).map(function(_,k){var p=pr[k%pr.length];return '<div class="m-pv-prod"><div class="e">'+p.e+'</div>'+E(p.n.slice(0,16))+'<b>'+A.fmt.bdt(p.ev)+'</b><s>'+A.fmt.bdt(p.reg)+'</s></div>'}).join('')+'</div>'+(n>4?'<div class="m-muted" style="margin-top:4px">+ '+(n-4)+' more'+(s.t==='carousel'?' (swipe)':'')+'</div>':'');
 case 'flash':return '<div class="m-pv-flash"><span>⚡ '+E(s.sale)+'</span><span class="m-cd">02:41:09</span></div>';
 case 'pair':return '<div class="m-pv-pair"><div style="background:'+s.c1+'">'+E(s.t1)+'</div><div style="background:'+s.c2+'">'+E(s.t2)+'</div></div>';
 default:return '<div style="font-size:13px">'+s.html+'</div>'}}
function settings(b){if(!b)return '<div class="a-empty">Select a block on the canvas to edit its settings.</div>';var s=b.s;
 function f(k,l,t){return '<div class="a-field"><label>'+l+'</label>'+(t==='ta'?'<textarea class="a-input" rows="5" data-k="'+k+'">'+E(s[k])+'</textarea>':'<input class="a-input" data-k="'+k+'" type="'+(t||'text')+'" value="'+E(s[k])+'">')+'</div>'}
 var m={hero:[['title','Title'],['sub','Subtitle'],['cta','Button text'],['c1','Colour A','color'],['c2','Colour B','color']],countdown:[['label','Label']],coupon:[['codes','Coupon codes (comma)']],tiles:[['cats','Categories (comma)']],grid:[['title','Heading'],['count','Products shown','number'],['source','Source']],carousel:[['title','Heading'],['count','Products shown','number'],['source','Source']],flash:[['sale','Flash sale']],pair:[['t1','Left text'],['t2','Right text'],['c1','Left colour','color'],['c2','Right colour','color']],html:[['html','HTML (scripts stripped)','ta']]}[b.t];
 return '<div class="m-col"><div style="font-weight:700">'+BT[b.t].i+' '+BT[b.t].n+'</div>'+m.map(function(x){return f(x[0],x[1],x[2])}).join('')+'<button class="a-btn sm danger" id="delb">'+I.trash+' Remove block</button></div>'}
function builder(){var e=ev(),ro=e.status==='ended';
 return '<div class="m-row sp" style="margin-bottom:8px"><span class="m-muted">Storefront page: /event/'+E(e.slug)+'</span><div class="m-seg"><button data-m="desktop" aria-pressed="'+(mode==='desktop')+'">🖥 Desktop</button><button data-m="mobile" aria-pressed="'+(mode==='mobile')+'">📱 Mobile</button></div></div><div class="m-builder"><div><div class="m-sec" style="border:0;margin-top:0">Blocks</div><div class="m-palette">'+Object.keys(BT).map(function(k){return '<button data-add="'+k+'"'+(ro?' disabled':'')+'><span>'+BT[k].i+'</span> '+BT[k].n+'</button>'}).join('')+'</div></div>'+
 '<div><div class="m-canvas '+mode+'" id="cv">'+(e.blocks.length?e.blocks.map(function(b,k){return '<div class="m-block'+(sel===b.id?' sel':'')+'" data-b="'+b.id+'"><div class="m-block-bar"><span style="flex:1">'+BT[b.t].i+' '+BT[b.t].n+'</span><button class="a-btn sm ghost" data-up="'+k+'" title="Move up"'+(k?'':' disabled')+'>↑</button><button class="a-btn sm ghost" data-dn="'+k+'" title="Move down"'+(k<e.blocks.length-1?'':' disabled')+'>↓</button></div><div class="m-block-body">'+pvBlock(b)+'</div></div>'}).join(''):'<div class="a-empty">Empty page. Add blocks from the left.</div>')+'</div></div>'+
 '<div class="a-card"><div class="a-card-h">Block settings</div><div class="a-card-b" id="bs">'+settings(e.blocks.filter(function(b){return b.id===sel})[0])+'</div></div></div>'}
function prices(){var e=ev();
 return '<div class="m-note">'+I.warn+'<div>Event prices apply <b>site-wide</b> (listing, product page, cart) while the event is live. They override regular price but flash-sale price still wins if lower.</div></div><div style="height:10px"></div><div class="a-card"><div class="a-card-h"><span>Event prices</span><button class="a-btn sm primary" id="addp">'+I.plus+' Add product</button></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Product</th><th class="num">Regular</th><th class="num">Event price</th><th class="num">Off</th><th></th></tr></thead><tbody>'+
 (e.prices.length?e.prices.map(function(p,k){var o=Math.round((1-p.ev/p.reg)*100);return '<tr><td>'+p.e+' '+E(p.n)+'</td><td class="num">'+A.fmt.bdt(p.reg)+'</td><td class="num"><input class="a-input" style="width:100px" type="number" data-pe="'+k+'" value="'+p.ev+'"></td><td class="num"><span class="a-badge '+(o>0?'ok':'danger')+'">'+o+'%</span></td><td><button class="a-btn sm icon ghost" data-pd="'+k+'">'+I.trash+'</button></td></tr>'}).join(''):'<tr><td colspan="5"><div class="a-empty">No event prices yet.</div></td></tr>')+'</tbody></table></div></div>'}
var ALL=[['Pampers Premium M (64)','🧷',2450],['Huggies Dry Pants L (44)','🧷',1890],['Chicco Natural Feeling Bottle','🍼',1350],['Stroller Foldable 3-in-1','🛒',12500],['Johnson\'s Baby Lotion 200ml','🧴',420]];
function paint(){var b=$('#mk');b.innerHTML=header()+tabs()+(tab==='builder'?builder():tab==='prices'?prices():sched());
 $$('[data-ev]',b).forEach(function(x){x.onclick=function(){cur=+x.dataset.ev;sel=null;paint()}});
 $('#newev',b).onclick=function(){events.push({name:'New event',slug:'new-event',start:d(7),end:d(14),status:'draft',blocks:[],prices:[]});cur=events.length-1;tab='builder';paint()};
 $$('.a-tab',b).forEach(function(x){x.onclick=function(){tab=x.dataset.t;paint()}});
 var e=ev();
 if(tab==='builder'){
  $$('[data-m]',b).forEach(function(x){x.onclick=function(){mode=x.dataset.m;paint()}});
  $$('[data-add]',b).forEach(function(x){x.onclick=function(){var n=blk(x.dataset.add);e.blocks.push(n);sel=n.id;paint()}});
  $$('.m-block',b).forEach(function(x){x.querySelector('.m-block-body').onclick=function(){sel=+x.dataset.b;paint()}});
  $$('[data-up]',b).forEach(function(x){x.onclick=function(){var k=+x.dataset.up;e.blocks.splice(k-1,0,e.blocks.splice(k,1)[0]);paint()}});
  $$('[data-dn]',b).forEach(function(x){x.onclick=function(){var k=+x.dataset.dn;e.blocks.splice(k+1,0,e.blocks.splice(k,1)[0]);paint()}});
  var bs=$('#bs',b),cb=e.blocks.filter(function(z){return z.id===sel})[0];
  $$('[data-k]',bs).forEach(function(inp){inp.oninput=function(){cb.s[inp.dataset.k]=inp.value;var el=$('.m-block[data-b="'+cb.id+'"] .m-block-body',b);if(el)el.innerHTML=pvBlock(cb)}});
  var del=$('#delb',b);if(del)del.onclick=function(){e.blocks=e.blocks.filter(function(z){return z.id!==sel});sel=null;paint()};
 }
 if(tab==='prices'){
  $$('[data-pe]',b).forEach(function(x){x.onchange=function(){e.prices[+x.dataset.pe].ev=+x.value;paint()}});
  $$('[data-pd]',b).forEach(function(x){x.onclick=function(){e.prices.splice(+x.dataset.pd,1);paint()}});
  $('#addp',b).onclick=function(){var av=ALL.filter(function(a){return !e.prices.some(function(p){return p.n===a[0]})});if(!av.length){A.toast('All sample products added','info');return}var a=av[0];e.prices.push({n:a[0],e:a[1],reg:a[2],ev:Math.round(a[2]*.85)});paint()};
 }
 if(tab==='sched'){
  $('#en',b).oninput=function(){e.name=this.value};$('#es',b).oninput=function(){e.slug=this.value};
  $('#est',b).onchange=function(){e.start=this.value;paint()};$('#eed',b).onchange=function(){e.end=this.value;paint()};
  $('#draft',b).onclick=function(){A.toast('Draft saved','ok')};
  $('#pub',b).onclick=function(){if(ovl(e.start,e.end)){A.toast('Conflict: another event overlaps these dates','danger');return}if(e.status!=='live')e.status=e.start<=d(0)?'live':'scheduled';A.toast('Event '+e.status+': '+e.name,'ok');paint()};
  var en=$('#endev',b);if(en)en.onclick=function(){e.status='ended';A.toast('Event ended, prices reverted','warn');paint()};
 }
}
A.renderPage({active:'events',title:'Event pages',crumbs:[['Marketing','#'],['Event pages']],actions:'',body:'<div id="mk"></div>',onReady:paint});
})();
