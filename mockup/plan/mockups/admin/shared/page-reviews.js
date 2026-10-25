/* Reviews & Q&A (agent C) */
(function () {
  var D = CatalogData, A = Admin, esc = A.esc, PER = 10;
  var st = { tab: 'reviews', q: '', rating: '', status: '', page: 1, openReply: null };
  function stars(n) { return '<span class="c-stars">' + '★★★★★'.slice(0, n) + '<i>' + '★★★★★'.slice(n) + '</i></span>'; }
  function prod(id) { return D.prodById[id] || { title: '(deleted product)', emoji: '❔', color: '#475569' }; }
  function revFilt() { var q = st.q.toLowerCase(); return D.reviews.filter(function (r) { return (!q || (prod(r.pid).title + ' ' + r.text + ' ' + r.user).toLowerCase().indexOf(q) >= 0) && (!st.rating || r.rating === +st.rating) && (!st.status || r.status === st.status); }); }
  function qaFilt() { var q = st.q.toLowerCase(); return D.qa.filter(function (x) { return (!q || (prod(x.pid).title + ' ' + x.q).toLowerCase().indexOf(q) >= 0) && (!st.status || x.status === st.status); }).sort(function (a, b) { return (!!a.answer - !!b.answer) || (b.date > a.date ? 1 : -1); }); }
  function replyBox(id, txt, ph) { return '<div class="c-ans"><textarea rows="2" class="a-input" style="width:100%;height:auto;padding:8px" id="rb" placeholder="' + ph + '">' + esc(txt || '') + '</textarea><div style="margin-top:6px;display:flex;gap:6px"><button class="a-btn sm primary" data-send="' + id + '">Publish</button><button class="a-btn sm ghost" data-cancel="1">Cancel</button><small class="c-sub" style="align-self:center">Shown publicly as “ShopName team”.</small></div></div>'; }
  function revRow(r) {
    var p = prod(r.pid), hid = r.status === 'hidden';
    return '<tr' + (hid ? ' style="opacity:.65"' : '') + '><td><div class="c-cell">' + D.thumb(p, 'sm') + '<div><a class="c-link" href="product-edit.html?id=' + r.pid + '"><b>' + esc(p.title) + '</b></a><small>' + esc(r.user) + ' · ' + A.fmt.date(r.date) + '</small></div></div></td><td>' + stars(r.rating) + '</td>' +
      '<td class="c-rv-text">' + esc(r.text) + (r.reply ? '<div class="c-reply"><b>Staff reply</b><br>' + esc(r.reply.text) + '</div>' : '') + (st.openReply === r.id ? replyBox(r.id, r.reply && r.reply.text, 'Write a public reply…') : '') + '</td>' +
      '<td>' + (r.photos ? '<span class="c-ph">' + Array.apply(null, Array(r.photos)).map(function () { return '<span>📷</span>'; }).join('') + '</span>' : '<span class="c-sub">—</span>') + '</td>' +
      '<td>' + (r.verified ? '<span class="a-badge ok">✔ Verified buyer</span>' : '<span class="a-badge muted">Unverified</span>') + '<span class="sub c-mono">' + r.order + '</span></td><td><span class="a-badge ' + (hid ? 'muted' : 'ok') + '">' + r.status + '</span></td>' +
      '<td class="act"><button class="a-btn sm" data-reply="' + r.id + '">' + (r.reply ? 'Edit reply' : 'Reply') + '</button> <button class="a-btn sm ' + (hid ? 'primary' : 'ghost') + '" data-toggle="' + r.id + '">' + (hid ? 'Unhide' : 'Hide') + '</button></td></tr>';
  }
  function qaCard(x) {
    var p = prod(x.pid), un = !x.answer;
    return '<div class="c-qa' + (un ? ' unans' : '') + (x.status === 'hidden' ? ' hid' : '') + '"><div class="c-qa-h">' + D.thumb(p, 'sm') + '<a class="c-link" href="product-edit.html?id=' + x.pid + '">' + esc(p.title) + '</a><span class="c-sub">asked by ' + esc(x.user) + ' · ' + A.fmt.ago(x.date) + '</span>' + (un ? '<span class="a-badge warn">Unanswered</span>' : '<span class="a-badge ok">Answered</span>') + (x.status === 'hidden' ? '<span class="a-badge muted">hidden</span>' : '') + '</div>' +
      '<div class="q">Q: ' + esc(x.q) + '</div>' + (x.answer ? '<div class="c-reply"><b>' + esc(x.answer.by) + '</b><br>' + esc(x.answer.text) + '</div>' : '') +
      (st.openReply === x.id ? replyBox(x.id, x.answer && x.answer.text, 'Type your answer…') : '') +
      '<div style="margin-top:8px;display:flex;gap:6px"><button class="a-btn sm ' + (un ? 'primary' : '') + '" data-reply="' + x.id + '">' + (un ? 'Answer' : 'Edit answer') + '</button><button class="a-btn sm ghost" data-toggle="' + x.id + '">' + (x.status === 'hidden' ? 'Unhide' : 'Hide') + '</button></div></div>';
  }
  function render() {
    var rv = st.tab === 'reviews';
    A.$$('.a-tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.tab === st.tab); });
    A.$('#c-reviews').textContent = D.reviews.length; A.$('#c-qa').textContent = D.qa.filter(function (x) { return !x.answer; }).length;
    A.$('#rating').hidden = !rv;
    var list = rv ? revFilt() : qaFilt(), pages = Math.max(1, Math.ceil(list.length / PER)); if (st.page > pages) st.page = pages;
    var slice = list.slice((st.page - 1) * PER, st.page * PER);
    var pager = '<div class="a-pager"><span>' + (list.length ? ((st.page - 1) * PER + 1) + '–' + Math.min(list.length, st.page * PER) : 0) + ' of ' + list.length + '</span><div class="pg"><button data-pg="' + (st.page - 1) + '"' + (st.page < 2 ? ' disabled' : '') + '>‹</button>' + Array.apply(null, Array(pages)).map(function (_, i) { return '<button data-pg="' + (i + 1) + '"' + (i + 1 === st.page ? ' class="on"' : '') + '>' + (i + 1) + '</button>'; }).join('') + '<button data-pg="' + (st.page + 1) + '"' + (st.page >= pages ? ' disabled' : '') + '>›</button></div></div>';
    var empty = '<div class="a-empty">' + A.icons.reviews + '<h3>Nothing to show</h3><p>No items match the filters.</p></div>';
    A.$('#list').innerHTML = rv ? '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>Photos</th><th>Buyer</th><th>Status</th><th></th></tr></thead><tbody>' + (slice.length ? slice.map(revRow).join('') : '<tr><td colspan="7">' + empty + '</td></tr>') + '</tbody></table></div>' + pager
      : (slice.length ? slice.map(qaCard).join('') : empty) + pager;
    var ta = A.$('#rb'); if (ta) ta.focus();
  }
  function findItem(id) { return D.reviews.concat(D.qa).filter(function (x) { return x.id === id; })[0]; }
  A.renderPage({
    active: 'reviews', title: 'Reviews & Q&A', crumbs: [['Catalog'], ['Reviews & Q&A']],
    body: '<div class="c-infobox" style="margin-bottom:12px">' + A.icons.info + '<span>Only verified buyers can review. Reviews are published immediately; staff can hide them and reply publicly. Hidden items disappear from the store but stay here.</span></div>' +
      '<div class="a-tabs" role="tablist"><button class="a-tab" role="tab" data-tab="reviews">Reviews <span class="a-count" id="c-reviews"></span></button><button class="a-tab" role="tab" data-tab="qa">Q&amp;A <span class="a-count" id="c-qa"></span></button></div>' +
      '<div class="a-toolbar" style="margin-top:12px"><input type="search" class="grow" id="q" placeholder="Search product, text or customer…" aria-label="Search"><select id="rating" aria-label="Rating"><option value="">All ratings</option>' + [5, 4, 3, 2, 1].map(function (n) { return '<option value="' + n + '">' + n + ' ★</option>'; }).join('') + '</select><select id="status" aria-label="Status"><option value="">Visible + hidden</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select></div><div id="list"></div>',
    onReady: function (root) {
      A.$('#q').oninput = function () { st.q = this.value; st.page = 1; render(); };
      A.$('#rating').onchange = function () { st.rating = this.value; st.page = 1; render(); };
      A.$('#status').onchange = function () { st.status = this.value; st.page = 1; render(); };
      root.addEventListener('click', function (e) {
        var t = e.target, b;
        if ((b = t.closest('[data-tab]'))) { st.tab = b.dataset.tab; st.page = 1; st.openReply = null; render(); }
        else if ((b = t.closest('[data-pg]'))) { if (!b.disabled) { st.page = +b.dataset.pg; render(); } }
        else if ((b = t.closest('[data-reply]'))) { st.openReply = b.dataset.reply; render(); }
        else if (t.closest('[data-cancel]')) { st.openReply = null; render(); }
        else if ((b = t.closest('[data-send]'))) {
          var txt = A.$('#rb').value.trim(), it = findItem(b.dataset.send); if (!txt) { A.toast('Write something first', 'warn'); return; }
          if (it.q) it.answer = { by: 'Catalog team', text: txt, at: new Date().toISOString() }; else it.reply = { by: 'Support team', text: txt, at: new Date().toISOString() };
          st.openReply = null; A.toast(it.q ? 'Answer published' : 'Public reply published'); render();
        } else if ((b = t.closest('[data-toggle]'))) { var x = findItem(b.dataset.toggle); x.status = x.status === 'hidden' ? 'visible' : 'hidden'; A.toast(x.status === 'hidden' ? 'Hidden from the store' : 'Visible again', x.status === 'hidden' ? 'warn' : 'ok'); render(); }
      });
      st.tab = new URLSearchParams(location.search).get('tab') === 'qa' ? 'qa' : 'reviews';
      render();
    }
  });
})();
