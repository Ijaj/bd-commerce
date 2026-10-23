/* ShopName mockups - auth.js  (login / sign up / forgot-password component; used by login.html, the login modal and account.html)
   Load after flow.js.
     Shop.auth.mount(rootEl, { mode: 'login'|'signup', onDone(user) })   renders the tabbed component into rootEl
     Shop.auth.modal(onDone)                                               opens it in a modal (.ovl) - header "login" flows use this
   Rules: phone+password, email+password, Google / Facebook. OTP (SMS) only for phone verification at sign-up and password reset. */
(function () {
  'use strict';
  var Shop = window.Shop, t = Shop.t, esc = Shop.esc, icon = Shop.icon, X = Shop.X, XA = Shop.XA, $ = Shop.$, $$ = Shop.$$;

  Shop.i18n({
    en: {
      au_login: 'Log in', au_signup: 'Sign up', au_welcome: 'Welcome back', au_welcome_s: 'Log in with your phone number or email.',
      au_id: 'Phone number or email', au_id_ph: '01XXXXXXXXX or you@example.com', au_pw: 'Password', au_pw_ph: 'Your password', au_show: 'Show', au_hide: 'Hide',
      au_remember: 'Keep me logged in', au_forgot: 'Forgot password?', au_or: 'or continue with', au_google: 'Google', au_facebook: 'Facebook',
      au_new: 'New to ShopName?', au_have: 'Already have an account?', au_create: 'Create account', au_create_s: 'Sign up with your phone number. We will verify it by SMS.',
      au_name: 'Full name', au_name_ph: 'Your name', au_phone: 'Mobile number', au_phone_ph: '01XXXXXXXXX', au_pw_new: 'Create a password', au_pw_hint: 'At least 6 characters',
      au_ref: 'Referral code', au_ref_ph: 'Friend\'s code, e.g. RAHIM50', au_terms: 'I agree to the Terms and Privacy Policy', au_send: 'Send verification code',
      au_verify_t: 'Verify your phone', au_reset_t: 'Reset password', au_reset_s: 'Enter the mobile number of your account. We will send a code by SMS.',
      au_newpw_t: 'Set a new password', au_newpw: 'New password', au_newpw2: 'Confirm new password', au_save_pw: 'Save password',
      au_done_t: 'Password updated', au_done_s: 'You can now log in with your new password.', au_back_login: 'Back to log in', au_back: 'Back',
      au_err_id: 'Enter a valid mobile number (01XXXXXXXXX) or email.', au_err_pw: 'Password must be at least 6 characters.', au_err_phone: 'Enter a valid mobile number (01XXXXXXXXX).',
      au_err_name: 'Enter your name.', au_err_terms: 'Please accept the terms to continue.', au_err_match: 'Passwords do not match.',
      au_ok_in: 'Logged in. Welcome back!', au_ok_up: 'Account created. Welcome to ShopName!', au_social: 'Signed in with {name} (demo)',
      au_secure: 'Your data is safe with us. We never post without asking.', au_ref_ok: 'Referral coupon will be added to your wallet.',
      au_modal_t: 'Log in to ShopName', au_step: 'Step {n} of {m}'
    },
    bn: {
      au_login: 'লগইন', au_signup: 'সাইন আপ', au_welcome: 'স্বাগতম', au_welcome_s: 'মোবাইল নম্বর বা ইমেইল দিয়ে লগইন করুন।',
      au_id: 'মোবাইল নম্বর বা ইমেইল', au_id_ph: '01XXXXXXXXX বা you@example.com', au_pw: 'পাসওয়ার্ড', au_pw_ph: 'আপনার পাসওয়ার্ড', au_show: 'দেখান', au_hide: 'লুকান',
      au_remember: 'লগইন থাকুন', au_forgot: 'পাসওয়ার্ড ভুলে গেছেন?', au_or: 'অথবা এর মাধ্যমে চালিয়ে যান', au_google: 'গুগল', au_facebook: 'ফেসবুক',
      au_new: 'ShopName-এ নতুন?', au_have: 'আগেই অ্যাকাউন্ট আছে?', au_create: 'অ্যাকাউন্ট খুলুন', au_create_s: 'মোবাইল নম্বর দিয়ে সাইন আপ করুন। এসএমএসে যাচাই করা হবে।',
      au_name: 'পূর্ণ নাম', au_name_ph: 'আপনার নাম', au_phone: 'মোবাইল নম্বর', au_phone_ph: '01XXXXXXXXX', au_pw_new: 'পাসওয়ার্ড তৈরি করুন', au_pw_hint: 'কমপক্ষে 6 অক্ষর',
      au_ref: 'রেফারেল কোড', au_ref_ph: 'বন্ধুর কোড, যেমন RAHIM50', au_terms: 'আমি শর্তাবলী ও গোপনীয়তা নীতিতে সম্মত', au_send: 'ভেরিফিকেশন কোড পাঠান',
      au_verify_t: 'ফোন যাচাই করুন', au_reset_t: 'পাসওয়ার্ড রিসেট', au_reset_s: 'আপনার অ্যাকাউন্টের মোবাইল নম্বর দিন। এসএমএসে কোড পাঠানো হবে।',
      au_newpw_t: 'নতুন পাসওয়ার্ড দিন', au_newpw: 'নতুন পাসওয়ার্ড', au_newpw2: 'নতুন পাসওয়ার্ড নিশ্চিত করুন', au_save_pw: 'পাসওয়ার্ড সংরক্ষণ',
      au_done_t: 'পাসওয়ার্ড বদলানো হয়েছে', au_done_s: 'এখন নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।', au_back_login: 'লগইনে ফিরে যান', au_back: 'পেছনে',
      au_err_id: 'সঠিক মোবাইল নম্বর (01XXXXXXXXX) বা ইমেইল দিন।', au_err_pw: 'পাসওয়ার্ড কমপক্ষে 6 অক্ষরের হতে হবে।', au_err_phone: 'সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন।',
      au_err_name: 'আপনার নাম লিখুন।', au_err_terms: 'চালিয়ে যেতে শর্তে সম্মত হন।', au_err_match: 'পাসওয়ার্ড মিলছে না।',
      au_ok_in: 'লগইন হয়েছে। স্বাগতম!', au_ok_up: 'অ্যাকাউন্ট তৈরি হয়েছে। ShopName-এ স্বাগতম!', au_social: '{name} দিয়ে সাইন ইন হয়েছে (ডেমো)',
      au_secure: 'আপনার তথ্য নিরাপদ। অনুমতি ছাড়া আমরা কিছু পোস্ট করি না।', au_ref_ok: 'রেফারেল কুপন আপনার ওয়ালেটে যোগ হবে।',
      au_modal_t: 'ShopName-এ লগইন করুন', au_step: 'ধাপ {n} / {m}'
    }
  });

  var uid = 0;
  function pwField(id, labelKey, phKey, ac) {
    return '<div class="fld"><label for="' + id + '" ' + X(labelKey) + '</label><div class="inp-wrap">' +
      '<input class="inp" id="' + id + '" name="' + id + '" type="password" autocomplete="' + ac + '" ' + XA('placeholder', phKey) + ' aria-describedby="' + id + '-e">' +
      '<button class="inp-tg" type="button" data-for="' + id + '" aria-pressed="false"><span ' + X('au_show') + '</span></button></div>' +
      '<p class="fld-e" id="' + id + '-e" role="alert" hidden></p></div>';
  }
  function social() {
    return '<div class="au-or"><span ' + X('au_or') + '</span></div><div class="au-soc">' +
      '<button class="btn btn-ghost au-s" type="button" data-prov="Google"><b class="au-g" aria-hidden="true">G</b><span ' + X('au_google') + '</span></button>' +
      '<button class="btn btn-ghost au-s" type="button" data-prov="Facebook"><b class="au-f" aria-hidden="true">f</b><span ' + X('au_facebook') + '</span></button></div>';
  }
  function stepTag(n, m) { return '<p class="au-step muted">' + Shop.T('au_step', { n: n, m: m }) + '</p>'; }

  Shop.auth = {
    mount: function (root, opts) {
      opts = opts || {};
      var p = 'au' + (++uid) + '-', mode = opts.mode === 'signup' ? 'signup' : 'login';
      root.innerHTML = '<div class="auth"><div class="au-tabs" role="tablist">' +
        '<button type="button" role="tab" id="' + p + 'tl" data-tab="login" ' + X('au_login') + '</button>' +
        '<button type="button" role="tab" id="' + p + 'ts" data-tab="signup" ' + X('au_signup') + '</button></div>' +
        '<div class="au-body" role="tabpanel" aria-live="polite"></div></div>';
      var body = $('.au-body', root), tabs = $$('.au-tabs [role=tab]', root), pending = null;

      function setTabs(m) {
        tabs.forEach(function (b) { var on = b.getAttribute('data-tab') === m; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
        $('.au-tabs', root).style.display = (m === 'login' || m === 'signup') ? '' : 'none';
      }
      function done(user, msgKey) {
        Shop.user.set(user); Shop.toast(t(msgKey));
        if (opts.onDone) opts.onDone(user);
      }
      function show(view) {
        var html = '';
        setTabs(view);
        if (view === 'login') {
          html = '<div class="au-h"><h2 ' + X('au_welcome') + '</h2><p class="muted" ' + X('au_welcome_s') + '</p></div>' +
            '<form class="au-form" novalidate>' + Shop.field({ id: p + 'id', label: 'au_id', ph: 'au_id_ph', ac: 'username' }) + pwField(p + 'pw', 'au_pw', 'au_pw_ph', 'current-password') +
            '<div class="au-row"><label class="chk"><input type="checkbox" checked><span ' + X('au_remember') + '</span></label><button class="btn-link" type="button" data-go="f1" ' + X('au_forgot') + '</button></div>' +
            '<button class="btn btn-primary btn-block" type="submit" ' + X('au_login') + '</button></form>' + social() +
            '<p class="au-sw muted"><span ' + X('au_new') + '</span> <button class="btn-link" type="button" data-go="signup" ' + X('au_signup') + '</button></p>';
        } else if (view === 'signup') {
          html = '<div class="au-h"><h2 ' + X('au_create') + '</h2><p class="muted" ' + X('au_create_s') + '</p></div>' +
            '<form class="au-form" novalidate>' + Shop.field({ id: p + 'nm', label: 'au_name', ph: 'au_name_ph', ac: 'name' }) +
            Shop.field({ id: p + 'ph', label: 'au_phone', ph: 'au_phone_ph', ac: 'tel', im: 'tel', type: 'tel', max: 14 }) + pwField(p + 'pw', 'au_pw_new', 'au_pw_new', 'new-password') +
            '<p class="fld-h muted" ' + X('au_pw_hint') + '</p>' + Shop.field({ id: p + 'rf', label: 'au_ref', ph: 'au_ref_ph', opt: true }) +
            '<label class="chk"><input type="checkbox" id="' + p + 'tc"><span ' + X('au_terms') + '</span></label><p class="fld-e" id="' + p + 'tc-e" role="alert" hidden></p>' +
            '<button class="btn btn-primary btn-block" type="submit" ' + X('au_send') + '</button></form>' + social() +
            '<p class="au-sw muted"><span ' + X('au_have') + '</span> <button class="btn-link" type="button" data-go="login" ' + X('au_login') + '</button></p>';
        } else if (view === 'su-otp') {
          html = stepTag(2, 2) + '<div class="au-h"><h2 ' + X('au_verify_t') + '</h2></div>' + Shop.otp.html(p + 'otp', pending.phone) +
            '<p class="au-sw"><button class="btn-link" type="button" data-go="signup" ' + X('au_back') + '</button></p>';
        } else if (view === 'f1') {
          html = stepTag(1, 3) + '<div class="au-h"><h2 ' + X('au_reset_t') + '</h2><p class="muted" ' + X('au_reset_s') + '</p></div>' +
            '<form class="au-form" novalidate>' + Shop.field({ id: p + 'ph', label: 'au_phone', ph: 'au_phone_ph', ac: 'tel', im: 'tel', type: 'tel', max: 14 }) +
            '<button class="btn btn-primary btn-block" type="submit" ' + X('au_send') + '</button></form>' +
            '<p class="au-sw"><button class="btn-link" type="button" data-go="login" ' + X('au_back_login') + '</button></p>';
        } else if (view === 'f2') {
          html = stepTag(2, 3) + '<div class="au-h"><h2 ' + X('au_verify_t') + '</h2></div>' + Shop.otp.html(p + 'otp', pending.phone) +
            '<p class="au-sw"><button class="btn-link" type="button" data-go="f1" ' + X('au_back') + '</button></p>';
        } else if (view === 'f3') {
          html = stepTag(3, 3) + '<div class="au-h"><h2 ' + X('au_newpw_t') + '</h2></div><form class="au-form" novalidate>' +
            pwField(p + 'pw', 'au_newpw', 'au_newpw', 'new-password') + pwField(p + 'pw2', 'au_newpw2', 'au_newpw2', 'new-password') +
            '<button class="btn btn-primary btn-block" type="submit" ' + X('au_save_pw') + '</button></form>';
        } else if (view === 'f4') {
          html = '<div class="au-done"><div class="au-ok" aria-hidden="true">' + icon('check', 34) + '</div><h2 ' + X('au_done_t') + '</h2><p class="muted" ' + X('au_done_s') + '</p>' +
            '<button class="btn btn-primary" type="button" data-go="login" ' + X('au_back_login') + '</button></div>';
        }
        body.innerHTML = html; Shop.applyI18n(body);
        var otpEl = $('.otp', body);
        if (otpEl) {
          var w = Shop.otp.bind(otpEl, { onOk: function () {
            if (view === 'su-otp') done({ name: pending.name, phone: pending.phone, email: '', verified: true, joined: Date.now(), ref: pending.ref }, 'au_ok_up');
            else show('f3');
          } });
          setTimeout(w.focus, 40);
        } else { var f = $('input', body); if (f && !opts.noFocus) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30); }
      }

      root.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-tab]'))) show(b.getAttribute('data-tab'));
        else if ((b = e.target.closest('[data-go]'))) show(b.getAttribute('data-go'));
        else if ((b = e.target.closest('.inp-tg'))) {
          var inp = document.getElementById(b.getAttribute('data-for')), on = inp.type === 'password';
          inp.type = on ? 'text' : 'password'; b.setAttribute('aria-pressed', String(on));
          var s = $('span', b); s.setAttribute('data-i18n', on ? 'au_hide' : 'au_show'); s.textContent = t(on ? 'au_hide' : 'au_show');
        } else if ((b = e.target.closest('[data-prov]'))) {
          var nm = b.getAttribute('data-prov');
          done({ name: nm === 'Google' ? 'Rahim Uddin' : 'Nusrat Jahan', phone: '', email: nm.toLowerCase() + '.user@example.com', verified: false, joined: Date.now(), provider: nm }, 'au_ok_in');
        }
      });
      root.addEventListener('keydown', function (e) {
        if (!e.target.matches || !e.target.matches('[role=tab]')) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var o = tabs.filter(function (x) { return x !== e.target; })[0]; show(o.getAttribute('data-tab')); o.focus(); }
      });
      root.addEventListener('submit', function (e) {
        e.preventDefault();
        var cur = tabs.filter(function (x) { return x.getAttribute('aria-selected') === 'true'; })[0], view = cur ? cur.getAttribute('data-tab') : null;
        var has = function (s) { return !!document.getElementById(p + s); }, val = function (s) { return (document.getElementById(p + s) || {}).value || ''; };
        var bad = false;
        function chk(id, ok, key) { Shop.fieldErr(p + id, ok ? null : key); if (!ok) bad = true; }
        if (view === 'login') {
          var idv = val('id').trim();
          chk('id', Shop.validPhone(idv) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(idv), 'au_err_id'); chk('pw', val('pw').length >= 6, 'au_err_pw');
          if (!bad) done({ name: 'Rahim Uddin', phone: Shop.validPhone(idv) ? idv : '01711000000', email: /@/.test(idv) ? idv : 'rahim@example.com', verified: true, joined: Date.now() - 200 * Shop.DAY, demo: true }, 'au_ok_in');
        } else if (view === 'signup') {
          chk('nm', val('nm').trim().length >= 2, 'au_err_name'); chk('ph', Shop.validPhone(val('ph')), 'au_err_phone'); chk('pw', val('pw').length >= 6, 'au_err_pw');
          var tc = document.getElementById(p + 'tc'), te = document.getElementById(p + 'tc-e');
          te.hidden = tc.checked; if (!tc.checked) { te.setAttribute('data-i18n', 'au_err_terms'); te.textContent = t('au_err_terms'); bad = true; }
          if (!bad) { pending = { name: val('nm').trim(), phone: val('ph').replace(/[\s-]/g, ''), ref: val('rf').trim() }; show('su-otp'); }
        } else if (has('ph') && !has('pw')) { // forgot step 1
          chk('ph', Shop.validPhone(val('ph')), 'au_err_phone');
          if (!bad) { pending = { phone: val('ph').replace(/[\s-]/g, '') }; show('f2'); }
        } else if (has('pw2')) { // forgot step 3
          chk('pw', val('pw').length >= 6, 'au_err_pw'); chk('pw2', val('pw') === val('pw2'), 'au_err_match');
          if (!bad) show('f4');
        }
      });
      show(mode);
      return { show: show };
    },
    modal: function (onDone, mode) {
      var id = 'loginOvl';
      var n = Shop.ovlModal(id, Shop.modalHead(id, 'au_modal_t') + '<div class="sheet-b"><div id="loginHost"></div></div>', 'modal-auth');
      Shop.auth.mount($('#loginHost', n), { mode: mode || 'login', noFocus: false, onDone: function (u) { Shop.ovl.close(n); if (onDone) onDone(u); } });
      Shop.ovl.open(n, 'input');
      return n;
    }
  };
})();
