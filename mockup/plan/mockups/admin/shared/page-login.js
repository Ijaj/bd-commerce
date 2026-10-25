(function () {
  'use strict';
  var A = Admin, q = /[?&]expired=1/.test(location.search);
  document.body.classList.add('a-login');
  document.title = 'Sign in — ShopName Admin';
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  A.$('#app').innerHTML =
    '<div class="lg-wrap"><section class="lg-art"><div class="wm">Shop<b>Name</b></div><div><h2>Run the shop. Ship the orders.</h2><p>Staff-only admin panel. All sign-ins are logged and protected by two-factor authentication.</p>' +
    '<ul><li>' + A.icons.lock + 'Authenticator-app 2FA on every account</li><li>' + A.icons.device + 'New-device login alerts</li><li>' + A.icons.audit + 'Sensitive actions are audit-logged</li></ul></div><div style="font-size:12px;opacity:.7">Demo build — any credentials work.</div></section>' +
    '<section class="lg-form"><button class="a-btn ghost icon lg-top" id="lg-theme" aria-label="Toggle dark mode">' + (isDark ? A.icons.sun : A.icons.moon) + '</button><div class="lg-card">' +
    (q ? '<div class="a-banner" role="alert">' + A.icons.lock + '<div><b>Session expired</b><br><span class="a-muted">You were signed out after 30 minutes of inactivity. Sign in again to continue.</span></div></div>' : '') +
    '<form class="lg-step on" id="s1" novalidate><h1>Staff sign in</h1><p>Use your work email or phone number.</p>' +
    '<div class="a-field"><label for="id">Email or phone</label><input id="id" autocomplete="username" placeholder="you@shop.com or 01XXXXXXXXX" autofocus><div class="a-err" hidden></div></div>' +
    '<div class="a-field"><label for="pw">Password</label><div class="lg-pw"><input id="pw" type="password" autocomplete="current-password" placeholder="Password"><button type="button" class="a-btn ghost sm" id="showpw">Show</button></div><div class="a-err" hidden></div></div>' +
    '<div class="lg-meta"><label><input type="checkbox" id="rem"> Keep me signed in on this device</label><a href="#" id="forgot">Forgot password?</a></div>' +
    '<button class="a-btn primary" type="submit">Continue</button></form>' +
    '<form class="lg-step" id="s2" novalidate><h1>Two-step verification</h1><p>Enter the 6-digit code from your authenticator app.</p>' +
    '<div class="a-banner info" id="newdev">' + A.icons.device + '<div><b>New device detected</b><br><span class="a-sm a-muted">Chrome on Linux · Dhaka, BD · IP 103.145.22.18. The account owner will get a login alert.</span></div></div>' +
    '<div class="a-field"><label for="otp">Authentication code</label><input id="otp" class="lg-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••"><div class="a-err" hidden></div><div class="a-hint">Demo: any 6 digits works; “000000” shows the error state.</div></div>' +
    '<div class="lg-meta"><label><input type="checkbox" id="trust"> Trust this device for 30 days</label><a href="#" id="lost">Lost device?</a></div>' +
    '<button class="a-btn primary" type="submit">Verify &amp; sign in</button><p class="lg-devices"><a href="#" id="back">← Use a different account</a></p></form>' +
    '</div></section></div>';
  function err(inp, msg) { var f = inp.closest('.a-field'), e = f.querySelector('.a-err'); f.classList.toggle('err', !!msg); e.hidden = !msg; e.textContent = msg || ''; }
  A.$('#lg-theme').onclick = function () { A.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); this.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? A.icons.sun : A.icons.moon; };
  A.$('#showpw').onclick = function () { var p = A.$('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; this.textContent = p.type === 'password' ? 'Show' : 'Hide'; };
  A.$('#forgot').onclick = function (e) { e.preventDefault(); A.toast('Password reset link sent (demo). Staff resets also need 2FA.', 'info'); };
  A.$('#lost').onclick = function (e) { e.preventDefault(); A.toast('Ask the shop Owner to reset your 2FA from Staff.', 'info'); };
  A.$('#s1').onsubmit = function (e) {
    e.preventDefault(); var id = A.$('#id'), pw = A.$('#pw'), ok = true;
    err(id, ''); err(pw, '');
    if (!id.value.trim()) { err(id, 'Enter your email or phone number.'); ok = false; }
    else if (!/^\S+@\S+\.\S+$/.test(id.value.trim()) && !/^(\+?88)?01[3-9]\d{8}$/.test(id.value.replace(/[\s-]/g, ''))) { err(id, 'Enter a valid email or Bangladesh mobile number.'); ok = false; }
    if (pw.value.length < 6) { err(pw, 'Password must be at least 6 characters.'); ok = false; }
    if (!ok) return;
    A.$('#s1').classList.remove('on'); A.$('#s2').classList.add('on'); A.$('#otp').focus();
  };
  A.$('#back').onclick = function (e) { e.preventDefault(); A.$('#s2').classList.remove('on'); A.$('#s1').classList.add('on'); };
  A.$('#otp').oninput = function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); err(this, ''); };
  A.$('#s2').onsubmit = function (e) {
    e.preventDefault(); var o = A.$('#otp');
    if (o.value.length !== 6) { err(o, 'Enter all 6 digits.'); return; }
    if (o.value === '000000') { err(o, 'Invalid or expired code. 2 attempts left.'); return; }
    A.toast('Signed in. New-device alert sent to the Owner.', 'ok');
    A.audit.log('auth.login', 'staff:Sadia Akter', null, { device: 'Chrome / Linux', ip: '103.145.22.18', new_device: true });
    setTimeout(function () { location.href = 'index.html'; }, 700);
  };
})();
