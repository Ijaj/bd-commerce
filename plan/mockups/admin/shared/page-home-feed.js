(function(){
var A=Admin,E=A.esc,$=A.$,$$=A.$$,I=A.icons;
var d=function(n){var x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
var slides=[
{t:'Eid Mega Sale',bn:'ঈদ মেগা সেল',link:'/event/eid-mega-sale',from:d(-2),to:d(5),on:true,c1:'#c2185b',c2:'#7b1fa2'},
{t:'Diaper Fest',bn:'ডায়াপার ফেস্ট',link:'/category/diapers',from:d(-20),to:d(30),on:true,c1:'#00897b',c2:'#0277bd'},
{t:'New Arrivals: Toys',bn:'নতুন খেলনা',link:'/category/toys',from:d(0),to:d(45),on:true,c1:'#f57c00',c2:'#e64a19'},
{t:'Free Delivery over ৳3,000',bn:'৳৩,০০০+ অর্ডারে ফ্রি ডেলিভারি',link:'/pages/delivery',from:d(-60),to:d(200),on:true,c1:'#5e35b1',c2:'#3949ab'},
{t:'Boishakhi Fair (teaser)',bn:'বৈশাখী মেলা',link:'/event/boishakhi-fair',from:d(110),to:d(128),on:false,c1:'#e65100',c2:'#c62828'}
];
var tiles=[
{n:'Diapers',e:'🧷',col:'#00897b',on:true},{n:'Feeding',e:'🍼',col:'#f57c00',on:true},{n:'Toys',e:'🧸',col:'#e53935',on:true},{n:'Clothing',e:'👕',col:'#3949ab',on:true},
{n:'Bath & Care',e:'🛁',col:'#0288d1',on:true},{n:'Gear',e:'🛒',col:'#6d4c41',on:true},{n:'Maternity',e:'🤰',col:'#ad1457',on:false},{n:'Gifts',e:'🎁',col:'#7b1fa2',on:true}
];
var W={nw:60,disc:50,rate:40,pin:90,oos:80};
var WL=[['nw','New product boost'],['disc','Discount boost'],['rate','Rating boost'],['pin','Pinned boost'],['oos','Out-of-stock penalty']];
var P=[
{n:'Pampers Premium M (64)',e:'🧷',nw:0,disc:18,rate:4.8,pin:1,oos:0,j:.35},
{n:'Fisher-Price Rainforest Gym',e:'🧸',nw:1,disc:15,rate:4.6,pin:0,oos:0,j:.8},
{n:'Cerelac Wheat 400g',e:'🥣',nw:0,disc:6,rate:4.9,pin:0,oos:0,j:.2},
{n:'Baby Romper Set (3 pcs)',e:'👕',nw:1,disc:26,rate:4.2,pin:0,oos:0,j:.55},
{n:'Chicco Natural Feeling Bottle',e:'🍼',nw:0,disc:0,rate:4.7,pin:0,oos:1,j:.9},
{n:'Stroller Foldable 3-in-1',e:'🛒',nw:0,disc:22,rate:4.1,pin:1,oos:0,j:.15},
{n:'Johnson\'s Baby Lotion 200ml',e:'🧴',nw:0,disc:8,rate:4.5,pin:0,oos:0,j:.6},
{n:'Huggies Dry Pants L (44)',e:'🧷',nw:0,disc:12,rate:4.4,pin:0,oos:0,j:.45},
{n:'Wooden Stacking Rings',e:'🧩',nw:1,disc:0,rate:4.0,pin:0,oos:0,j:.7},
{n:'Muslin Swaddle (2 pk)',e:'🧣',nw:1,disc:30,rate:3.9,pin:0,oos:1,j:.3},
{n:'Teether Giraffe',e:'🦒',nw:0,disc:5,rate:4.3,pin:0,oos:0,j:.5},
{n:'Baby Night Light',e:'🌙',nw:1,disc:10,rate:4.6,pin:0,oos:0,j:.1}
];
var spec={N:6,flash:true,recent:true,event:true};
var pins=['Pampers Premium M (64)','Stroller Foldable 3-in-1'];
function score(p){return Math.round(((W.nw/100)*p.nw*10+(W.disc/100)*(p.disc/30)*10+(W.rate/100)*((p.rate-3)/2)*10+(W.pin/100)*p.pin*10-(W.oos/100)*p.oos*30+p.j*3)*10)/10}
function feed(){
 var l=P.map(function(p){return {p:p,s:score(p)}}).sort(function(a,b){return b.s-a.s}),out=[],rows=[];
 if(spec.flash)rows.push('⚡ Flash sale row');if(spec.recent)rows.push('🕘 Recently viewed');if(spec.event)rows.push('🎉 Event banner');
 var r=0;l.forEach(function(x,k){out.push({item:x});if((k+1)%spec.N===0&&rows.length){out.push({row:rows[r%rows.length]});r++}});return out}
function paint(){
 var b=$('#mk');
 b.innerHTML='<div class="m-split"><div class="m-col">'+
 '<div class="a-card"><div class="a-card-h"><span>Carousel slides</span><button class="a-btn sm primary" id="ns">'+I.plus+' Add slide</button></div><div class="a-card-b" id="sl"></div></div>'+
 '<div class="a-card"><div class="a-card-h"><span>Category tiles</span><span class="m-muted">order, visibility, chip colour</span></div><div class="a-card-b" id="ti"></div></div>'+
 '</div><div class="m-col">'+
 '<div class="a-card"><div class="a-card-h">Feed weights</div><div class="a-card-b">'+WL.map(function(w){return '<div class="m-slider-row"><label>'+w[1]+'</label><input type="range" min="0" max="100" value="'+W[w[0]]+'" data-w="'+w[0]+'"><output id="o-'+w[0]+'">'+W[w[0]]+'</output></div>'}).join('')+
 '<div class="m-note info">'+I.warn+'<div>The feed is a weighted <b>random</b> shuffle: each visitor sees a slightly different order. The preview below shows the expected (average) order.</div></div></div></div>'+
 '<div class="a-card"><div class="a-card-h">Special rows</div><div class="a-card-b"><div class="m-row" style="margin-bottom:8px">Insert a special row after every <input type="number" min="3" max="20" class="a-input" style="width:64px" id="sn" value="'+spec.N+'"> products</div>'+
 [['flash','Flash-sale row'],['recent','Recently viewed row'],['event','Event banner (only when an event is live)']].map(function(s){return '<div class="m-sw-row"><b>'+s[1]+'</b><label class="a-switch"><input type="checkbox" data-sp="'+s[0]+'"'+(spec[s[0]]?' checked':'')+'><span></span></label></div>'}).join('')+'</div></div>'+
 '<div class="a-card"><div class="a-card-h">Pinned products</div><div class="a-card-b"><div class="m-tags" id="pn"></div><div class="m-row" style="margin-top:8px"><select class="a-input m-grow" id="pa"><option value="">+ Pin a product…</option>'+P.filter(function(p){return pins.indexOf(p.n)<0}).map(function(p){return '<option>'+E(p.n)+'</option>'}).join('')+'</select></div><div class="a-hint">Pinned products get the pinned boost on top of their own score.</div></div></div>'+
 '<div class="a-card"><div class="a-card-h"><span>Sample feed order</span><span class="m-muted">live preview</span></div><div class="a-card-b" id="fd"></div></div>'+
 '</div></div>';
 slidesPaint();tilesPaint();pinsPaint();feedPaint(false);
 $$('[data-w]',b).forEach(function(r){r.oninput=function(){W[r.dataset.w]=+r.value;$('#o-'+r.dataset.w).textContent=r.value;feedPaint(true)}});
 $('#sn',b).oninput=function(){spec.N=Math.max(3,+this.value||6);feedPaint(true)};
 $$('[data-sp]',b).forEach(function(c){c.onchange=function(){spec[c.dataset.sp]=c.checked;feedPaint(true)}});
 $('#ns',b).onclick=function(){slideEdit(-1)};
 $('#pa',b).onchange=function(){if(this.value){pins.push(this.value);P.forEach(function(p){if(p.n===pins[pins.length-1])p.pin=1});paint()}};
}
function slidesPaint(){var h=slides.map(function(s,i){var live=s.on&&s.from<=d(0)&&s.to>=d(0);return '<div class="m-slide"><div class="m-ord">'+(i+1)+'</div><div class="m-pv-hero m-thumb lg" style="background:linear-gradient(135deg,'+s.c1+','+s.c2+');font-size:9px;height:48px;width:96px;padding:2px;line-height:1.1">'+E(s.t)+'</div><div style="min-width:0"><b>'+E(s.t)+'</b> <span class="m-muted" style="font-family:\'Noto Sans Bengali\',sans-serif">'+E(s.bn)+'</span><div class="m-muted">'+E(s.link)+' · '+A.fmt.date(s.from)+' → '+A.fmt.date(s.to)+'</div><span class="a-badge '+(live?'ok':s.on?'info':'muted')+'">'+(live?'showing':s.on?'scheduled':'hidden')+'</span></div><div class="acts m-row" style="gap:4px"><button class="a-btn sm ghost" data-su="'+i+'"'+(i?'':' disabled')+'>↑</button><button class="a-btn sm ghost" data-sd="'+i+'"'+(i<slides.length-1?'':' disabled')+'>↓</button><button class="a-btn sm ghost" data-se="'+i+'">'+I.edit+'</button><label class="a-switch"><input type="checkbox" data-so="'+i+'"'+(s.on?' checked':'')+'><span></span></label></div></div>'}).join('');
 var el=$('#sl');el.innerHTML=h;
 $$('[data-su]',el).forEach(function(x){x.onclick=function(){var k=+x.dataset.su;slides.splice(k-1,0,slides.splice(k,1)[0]);slidesPaint()}});
 $$('[data-sd]',el).forEach(function(x){x.onclick=function(){var k=+x.dataset.sd;slides.splice(k+1,0,slides.splice(k,1)[0]);slidesPaint()}});
 $$('[data-so]',el).forEach(function(x){x.onchange=function(){slides[+x.dataset.so].on=x.checked;slidesPaint()}});
 $$('[data-se]',el).forEach(function(x){x.onclick=function(){slideEdit(+x.dataset.se)}})}
function slideEdit(i){var s=i<0?{t:'',bn:'',link:'/',from:d(0),to:d(14),on:true,c1:'#1565c0',c2:'#6a1b9a'}:slides[i];
 A.modal.open('<form id="sf" class="m-form-grid"><div class="a-dropzone full" style="grid-column:1/-1">'+I.upload+' Drop banner image (1600×600 desktop, 800×800 mobile)</div><div class="a-field"><label>Title (EN)</label><input class="a-input" id="st" value="'+E(s.t)+'"></div><div class="a-field"><label>Title (BN)</label><input class="a-input" id="sb" value="'+E(s.bn)+'" style="font-family:\'Noto Sans Bengali\',sans-serif"></div><div class="a-field full"><label>Link</label><input class="a-input" id="sk" value="'+E(s.link)+'"></div><div class="a-field"><label>Show from</label><input type="date" class="a-input" id="sfr" value="'+s.from+'"></div><div class="a-field"><label>Show until</label><input type="date" class="a-input" id="sto" value="'+s.to+'"></div><div class="full m-foot"><button class="a-btn primary">Save slide</button></div></form>',{title:i<0?'Add slide':'Edit slide',size:'md'});
 $('#sf').onsubmit=function(e){e.preventDefault();var o=Object.assign({},s,{t:$('#st').value||'Untitled',bn:$('#sb').value,link:$('#sk').value,from:$('#sfr').value,to:$('#sto').value});if(i<0)slides.push(o);else slides[i]=o;A.modal.close();A.toast('Slide saved','ok');slidesPaint()}}
function tilesPaint(){var el=$('#ti');el.innerHTML=tiles.map(function(t,i){return '<div class="m-list-item"><div class="m-ord">'+(i+1)+'</div><span class="m-chip" style="background:'+t.col+'">'+t.e+' '+E(t.n)+'</span><span style="flex:1"></span><input type="color" value="'+t.col+'" data-tc="'+i+'" title="Chip colour" style="width:30px;height:26px;border:0;background:none;padding:0"><button class="a-btn sm ghost" data-tu="'+i+'"'+(i?'':' disabled')+'>↑</button><button class="a-btn sm ghost" data-td="'+i+'"'+(i<tiles.length-1?'':' disabled')+'>↓</button><label class="a-switch"><input type="checkbox" data-tv="'+i+'"'+(t.on?' checked':'')+'><span></span></label></div>'}).join('');
 $$('[data-tc]',el).forEach(function(x){x.oninput=function(){tiles[+x.dataset.tc].col=x.value;x.parentNode.querySelector('.m-chip').style.background=x.value}});
 $$('[data-tu]',el).forEach(function(x){x.onclick=function(){var k=+x.dataset.tu;tiles.splice(k-1,0,tiles.splice(k,1)[0]);tilesPaint()}});
 $$('[data-td]',el).forEach(function(x){x.onclick=function(){var k=+x.dataset.td;tiles.splice(k+1,0,tiles.splice(k,1)[0]);tilesPaint()}});
 $$('[data-tv]',el).forEach(function(x){x.onchange=function(){tiles[+x.dataset.tv].on=x.checked}})}
function pinsPaint(){var el=$('#pn');el.innerHTML=pins.map(function(p,k){return '<span class="m-tag">📌 '+E(p)+'<button data-pr="'+k+'">×</button></span>'}).join('')||'<span class="m-muted">No pinned products.</span>';
 $$('[data-pr]',el).forEach(function(x){x.onclick=function(){var n=pins.splice(+x.dataset.pr,1)[0];P.forEach(function(p){if(p.n===n)p.pin=0});paint()}})}
function feedPaint(anim){var el=$('#fd'),old={};
 if(anim)$$('.m-feed-item[data-k]',el).forEach(function(n){old[n.dataset.k]=n.getBoundingClientRect().top});
 el.innerHTML=feed().map(function(o,k){if(o.row)return '<div class="m-feed-item row">'+o.row+'<span style="margin-left:auto;font-weight:400">special row</span></div>';var p=o.item.p,t=[];if(p.nw)t.push('<span class="a-badge info">new</span>');if(p.disc)t.push('<span class="a-badge ok">-'+p.disc+'%</span>');if(p.pin)t.push('<span class="a-badge warn">pinned</span>');if(p.oos)t.push('<span class="a-badge danger">out of stock</span>');
  return '<div class="m-feed-item" data-k="'+E(p.n)+'"><span class="m-muted" style="width:20px">'+(k+1)+'</span><span style="font-size:20px">'+p.e+'</span><div style="min-width:0"><div>'+E(p.n)+'</div><div class="tags">'+t.join('')+'<span class="m-muted">★ '+p.rate+'</span></div></div><span class="sc">'+o.item.s+'</span></div>'}).join('');
 if(anim)$$('.m-feed-item[data-k]',el).forEach(function(n){var o=old[n.dataset.k];if(o==null)return;var dy=o-n.getBoundingClientRect().top;if(!dy)return;n.style.transition='none';n.style.transform='translateY('+dy+'px)';requestAnimationFrame(function(){n.style.transition='transform .3s';n.style.transform=''})})}
A.renderPage({active:'homefeed',title:'Home & feed',crumbs:[['Marketing','#'],['Home & feed']],actions:'<button class="a-btn primary" id="sv">Save changes</button>',body:'<div id="mk"></div>',onReady:function(){paint();$('#sv').onclick=function(){A.toast('Home & feed settings saved','ok')}}});
})();
