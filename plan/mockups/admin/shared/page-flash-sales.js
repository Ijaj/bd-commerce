(function(){
var A=Admin,E=A.esc,$=A.$,$$=A.$$,I=A.icons;
var now=Date.now(),H=3600e3;
var CAT=[
{id:1,n:'Pampers Premium M (64)',e:'🧷',p:2450},{id:2,n:'Huggies Dry Pants L (44)',e:'🧷',p:1890},{id:3,n:'Cerelac Wheat 400g',e:'🥣',p:690},
{id:4,n:'Chicco Natural Feeling Bottle',e:'🍼',p:1350},{id:5,n:'Fisher-Price Rainforest Gym',e:'🧸',p:4200},{id:6,n:'Stroller Foldable 3-in-1',e:'🛒',p:12500},
{id:7,n:'Johnson\'s Baby Lotion 200ml',e:'🧴',p:420},{id:8,n:'Baby Romper Set (3 pcs)',e:'👕',p:950}];
var sales=[
{name:'Midnight Diaper Rush',start:now-2*H,end:now+3*H+25*60e3,items:[{id:1,fp:1990,qty:200,sold:143,per:2},{id:2,fp:1490,qty:150,sold:131,per:2},{id:7,fp:340,qty:300,sold:96,per:3}]},
{name:'Weekend Toy Fest',start:now+20*H,end:now+44*H,items:[{id:5,fp:3200,qty:60,sold:0,per:1},{id:8,fp:690,qty:120,sold:0,per:2}]},
{name:'Feeding Essentials',start:now+4*24*H,end:now+4*24*H+8*H,items:[{id:3,fp:540,qty:250,sold:0,per:3},{id:4,fp:990,qty:100,sold:0,per:2}]},
{name:'Eid Stroller Deal',start:now-6*24*H,end:now-5*24*H,items:[{id:6,fp:9900,qty:40,sold:40,per:1}]},
{name:'Winter Romper Clearance',start:now-12*24*H,end:now-11*24*H,items:[{id:8,fp:600,qty:200,sold:164,per:2}]}
];
function st(s){return s.end<Date.now()?'ended':s.start>Date.now()?'scheduled':'live'}
function cd(ms){if(ms<0)ms=0;var s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);s%=60;var p=function(n){return String(n).padStart(2,'0')};return (d?d+'d ':'')+p(h)+':'+p(m)+':'+p(s)}
function prod(id){return CAT.filter(function(c){return c.id===id})[0]}
var tab='live';
function tabs(){var c={live:0,scheduled:0,ended:0};sales.forEach(function(s){c[st(s)]++});return '<div class="a-tabs">'+['live','scheduled','ended'].map(function(t){return '<button class="a-tab" data-t="'+t+'" aria-selected="'+(tab===t)+'">'+t[0].toUpperCase()+t.slice(1)+' <span class="a-count">'+c[t]+'</span></button>'}).join('')+'</div>'}
function paint(){
 var b=$('#mk'),list=sales.filter(function(s){return st(s)===tab});
 b.innerHTML=tabs()+'<div style="height:12px"></div>'+(list.length?'<div class="m-col">'+list.map(function(s){var i=sales.indexOf(s),stt=st(s),sold=s.items.reduce(function(a,x){return a+x.sold},0),tot=s.items.reduce(function(a,x){return a+x.qty},0),rev=s.items.reduce(function(a,x){return a+x.sold*x.fp},0);
  return '<div class="a-card"><div class="a-card-b"><div class="m-row sp"><div><b style="font-size:15px">'+E(s.name)+'</b> <span class="a-badge '+(stt==='live'?'danger':stt==='scheduled'?'info':'muted')+'">'+(stt==='live'?'● LIVE':stt)+'</span><div class="m-muted" style="margin-top:2px">'+A.fmt.dt(s.start)+' → '+A.fmt.dt(s.end)+' · '+s.items.length+' products</div></div>'+
  '<div class="m-row">'+(stt==='live'?'<div style="text-align:right"><div class="m-muted">Ends in</div><div class="m-cd" data-cd="'+s.end+'" style="font-size:18px;color:var(--sale)"></div></div>':stt==='scheduled'?'<div style="text-align:right"><div class="m-muted">Starts in</div><div class="m-cd" data-cd="'+s.start+'" style="font-size:16px"></div></div>':'<div style="text-align:right"><div class="m-muted">Revenue</div><b>'+A.fmt.bdt(rev)+'</b></div>')+
  '<button class="a-btn sm" data-e="'+i+'">'+I.edit+' '+(stt==='ended'?'View':'Edit')+'</button>'+(stt==='ended'?'<button class="a-btn sm ghost" data-dup="'+i+'">Duplicate</button>':'<button class="a-btn sm danger" data-end="'+i+'">'+(stt==='live'?'End now':'Cancel')+'</button>')+'</div></div>'+
  '<div style="margin-top:10px" class="m-row"><div class="m-grow"><div class="m-bar"><i style="width:'+Math.round(sold/tot*100)+'%"></i></div></div><span class="m-muted"><b>'+sold+'</b> / '+tot+' sold ('+Math.round(sold/tot*100)+'%)</span></div></div></div>'}).join('')+'</div>':'<div class="a-card"><div class="a-empty">No '+tab+' flash sales.</div></div>');
 $$('.a-tab',b).forEach(function(t){t.onclick=function(){tab=t.dataset.t;paint()}});
 $$('[data-e]',b).forEach(function(x){x.onclick=function(){edit(+x.dataset.e)}});
 $$('[data-end]',b).forEach(function(x){x.onclick=function(){var s=sales[+x.dataset.end];s.end=Date.now()-1000;if(st(s)==='ended'&&s.start>s.end)s.start=s.end-H;A.toast('Flash sale ended','warn');tab='ended';paint()}});
 $$('[data-dup]',b).forEach(function(x){x.onclick=function(){var s=sales[+x.dataset.dup];edit(-1,s)}});
 tick()}
function tick(){$$('[data-cd]').forEach(function(e){e.textContent=cd(+e.dataset.cd-Date.now())})}
setInterval(tick,1000);
function lt(ms){var d=new Date(ms-new Date().getTimezoneOffset()*60000);return d.toISOString().slice(0,16)}
function edit(i,tpl){
 var s=i>=0?sales[i]:tpl?{name:tpl.name+' (copy)',start:now+24*H,end:now+32*H,items:tpl.items.map(function(x){return {id:x.id,fp:x.fp,qty:x.qty,sold:0,per:x.per}})}:{name:'',start:now+24*H,end:now+30*H,items:[]};
 var ro=i>=0&&st(s)==='ended',items=s.items.map(function(x){return Object.assign({},x)});
 A.drawer.open('<form id="ff"><div class="m-sec">Sale</div><div class="m-form-grid"><div class="a-field full"><label>Name (internal)</label><input id="fn" class="a-input" value="'+E(s.name)+'"></div><div class="a-field"><label>Starts</label><input id="fs" type="datetime-local" class="a-input" value="'+lt(s.start)+'"></div><div class="a-field"><label>Ends</label><input id="fe" type="datetime-local" class="a-input" value="'+lt(s.end)+'"></div></div><div id="conf"></div>'+
 '<div class="m-sec">Products &amp; flash price</div><div class="m-row" style="margin-bottom:8px"><select id="fa" class="a-input m-grow"><option value="">+ Add product…</option>'+CAT.map(function(c){return '<option value="'+c.id+'">'+c.e+' '+E(c.n)+' — '+A.fmt.bdt(c.p)+'</option>'}).join('')+'</select></div>'+
 '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Product</th><th class="num">Regular</th><th class="num">Flash ৳</th><th class="num">Off</th><th class="num">Qty / sale</th><th class="num">Per cust.</th><th></th></tr></thead><tbody id="fi"></tbody></table></div>'+
 '<div class="m-sec">Storefront preview (sold progress)</div><div id="fp"></div>'+
 '<div class="m-foot"><button type="button" class="a-btn" id="fx">Close</button>'+(ro?'':'<button class="a-btn primary">'+(i<0?'Schedule sale':'Save')+'</button>')+'</div></form>',{title:i<0?'New flash sale':ro?'Flash sale report':'Edit flash sale',width:640});
 function rows(){
  $('#fi').innerHTML=items.length?items.map(function(x,k){var p=prod(x.id),off=Math.round((1-x.fp/p.p)*100);return '<tr><td>'+p.e+' '+E(p.n)+'</td><td class="num">'+A.fmt.bdt(p.p)+'</td><td class="num"><input data-k="'+k+'" data-f="fp" type="number" class="a-input" style="width:90px" value="'+x.fp+'"'+(ro?' disabled':'')+'></td><td class="num"><span class="a-badge '+(off>0?'ok':'danger')+'">'+off+'%</span></td><td class="num"><input data-k="'+k+'" data-f="qty" type="number" class="a-input" style="width:70px" value="'+x.qty+'"'+(ro?' disabled':'')+'></td><td class="num"><input data-k="'+k+'" data-f="per" type="number" class="a-input" style="width:56px" value="'+x.per+'"'+(ro?' disabled':'')+'></td><td>'+(ro?'':'<button type="button" class="a-btn sm icon ghost" data-r="'+k+'">'+I.trash+'</button>')+'</td></tr>'}).join(''):'<tr><td colspan="7"><div class="a-empty">Add products to the sale.</div></td></tr>';
  $$('#fi input').forEach(function(inp){inp.oninput=function(){items[+inp.dataset.k][inp.dataset.f]=+inp.value;pv()}});
  $$('#fi [data-r]').forEach(function(b){b.onclick=function(){items.splice(+b.dataset.r,1);rows();pv()}});pv()}
 function pv(){$('#fp').innerHTML=items.length?'<div class="m-pv-prods" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">'+items.map(function(x){var p=prod(x.id),pc=Math.min(100,Math.round(x.sold/Math.max(1,x.qty)*100));return '<div class="m-pv-prod"><div class="e">'+p.e+'</div><div style="font-weight:600">'+E(p.n.slice(0,22))+'</div><b>'+A.fmt.bdt(x.fp)+'</b><s>'+A.fmt.bdt(p.p)+'</s><div class="m-bar" style="margin-top:6px"><i style="width:'+pc+'%"></i></div><div class="m-muted">'+(x.sold?x.sold+' sold':'Just started')+' · '+Math.max(0,x.qty-x.sold)+' left</div></div>'}).join('')+'</div>':'<div class="m-muted">Nothing to preview.</div>'}
 function conflict(){var a=new Date($('#fs').value).getTime(),z=new Date($('#fe').value).getTime();var cf=sales.filter(function(o,k){return k!==i&&o.end>a&&o.start<z&&st(o)!=='ended'&&o.items.some(function(y){return items.some(function(x){return x.id===y.id})})});
  $('#conf').innerHTML=z<=a?'<div class="m-note danger" style="margin-top:8px">'+I.warn+'<div>End time must be after start.</div></div>':cf.length?'<div class="m-note warn" style="margin-top:8px">'+I.warn+'<div>Overlaps with <b>'+E(cf[0].name)+'</b> for shared products — the lowest price wins during overlap.</div></div>':''}
 $('#fa').onchange=function(){var id=+this.value;if(!id)return;if(items.some(function(x){return x.id===id}))A.toast('Already added','warn');else items.push({id:id,fp:Math.round(prod(id).p*.8),qty:100,sold:0,per:2});this.value='';rows();conflict()};
 $('#fs').onchange=$('#fe').onchange=conflict;$('#fx').onclick=A.drawer.close;rows();conflict();
 $('#ff').onsubmit=function(e){e.preventDefault();if(ro)return;var n={name:$('#fn').value||'Untitled sale',start:new Date($('#fs').value).getTime(),end:new Date($('#fe').value).getTime(),items:items};if(n.end<=n.start){A.toast('Fix the time window','danger');return}if(!items.length){A.toast('Add at least one product','warn');return}
  if(i>=0)sales[i]=n;else sales.push(n);tab=st(n);A.drawer.close();A.toast('Flash sale saved','ok');paint()}}
A.renderPage({active:'flash',title:'Flash sales',crumbs:[['Marketing','#'],['Flash sales']],actions:'<button class="a-btn primary" id="nf">'+I.plus+' New flash sale</button>',body:'<div id="mk"></div>',onReady:function(){paint();$('#nf').onclick=function(){edit(-1)}}});
})();
