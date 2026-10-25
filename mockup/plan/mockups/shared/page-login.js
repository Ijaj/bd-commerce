/* Login / sign up page: login.html[?mode=signup][&next=checkout.html]. Same component as the modal (Shop.auth.mount). */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, X = Shop.X, icon = Shop.icon, t = Shop.t;
  Shop.i18n({
    en: {
      lg_title: 'Log in', lg_b1: 'Track orders and returns in one place', lg_b2: 'Use coupons, store wallet and loyalty points', lg_b3: 'Save addresses for one-tap checkout', lg_b4: 'Get order updates by SMS, email and push',
      lg_side_h: 'Your ShopName account', lg_already: 'You are already logged in as {name}.', lg_go: 'Go to my account', lg_guest: 'Continue as guest', lg_logout: 'Log out'
    },
    bn: {
      lg_title: 'লগইন', lg_b1: 'অর্ডার ও রিটার্ন এক জায়গায় ট্র্যাক করুন', lg_b2: 'কুপন, স্টোর ওয়ালেট ও লয়্যালটি পয়েন্ট ব্যবহার করুন', lg_b3: 'এক ট্যাপ চেকআউটের জন্য ঠিকানা সেভ করুন', lg_b4: 'এসএমএস, ইমেইল ও পুশে অর্ডার আপডেট পান',
      lg_side_h: 'আপনার ShopName অ্যাকাউন্ট', lg_already: 'আপনি {name} হিসেবে লগইন করা আছেন।', lg_go: 'আমার অ্যাকাউন্টে যান', lg_guest: 'গেস্ট হিসেবে চলুন', lg_logout: 'লগআউট'
    }
  });
  var next = Shop.qparam('next') || 'account.html';
  if (!/^[\w.-]+\.html(#[\w/-]*)?(\?[\w=&.-]*)?$/.test(next)) next = 'account.html';
  var u = Shop.user.get();
  var html = '<div class="wrap lg-pg"><div class="lg-grid"><aside class="lg-side on-dark"><h2 ' + X('lg_side_h') + '</h2><ul>' +
    ['lg_b1', 'lg_b2', 'lg_b3', 'lg_b4'].map(function (k) { return '<li>' + icon('check', 18) + ' <span ' + X(k) + '</span></li>'; }).join('') + '</ul><div class="lg-art" aria-hidden="true">🛍️</div></aside>' +
    '<section class="lg-main card-box"><h1 class="sr-only" ' + X('lg_title') + '</h1><div id="lgHost"></div></section></div></div>';
  Shop.renderPage(html, {
    active: 'account',
    onReady: function () {
      document.title = t('lg_title') + ' - ShopName';
      var host = $('#lgHost');
      if (u) {
        host.innerHTML = '<div class="au-done"><div class="au-ok" aria-hidden="true">' + icon('check', 34) + '</div><p>' + Shop.T('lg_already', { name: Shop.esc(u.name) }) + '</p>' +
          '<a class="btn btn-primary" href="' + next + '" ' + X('lg_go') + '</a> <button class="btn btn-ghost" type="button" id="lgOut" ' + X('lg_logout') + '</button></div>';
        Shop.applyI18n(host);
        $('#lgOut').addEventListener('click', function () { Shop.user.clear(); location.reload(); });
        return;
      }
      Shop.auth.mount(host, { mode: Shop.qparam('mode') === 'signup' ? 'signup' : 'login', noFocus: true, onDone: function () { location.href = next; } });
    }
  });
})();
