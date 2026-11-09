/* 登录页交互（纯前端演示，无后端依赖） */
(function () {
  'use strict';

  /* ---- 预置演示账号（仅首次访问播种，注销后不再自动恢复） ---- */
  try {
    if (localStorage.getItem('zhangben_users') === null && window.__XZ_DEMO__ !== false) {
      var defaultUser = '15668681555@163.com';
      var defaultPwd = '123456Aa.';
      var _users = {};
      _users[defaultUser] = { email: defaultUser, password: defaultPwd, nickname: '王建国' };
      localStorage.setItem('zhangben_users', JSON.stringify(_users));
    }
  } catch (err) {}

  var tabPwd = document.getElementById('tabPwd');
  var tabPair = document.getElementById('tabPair');
  var loginForm = document.getElementById('loginForm');
  var forgotForm = document.getElementById('forgotForm');
  var pairPanel = document.getElementById('pairPanel');
  var msgError = document.getElementById('msgError');
  var msgOk = document.getElementById('msgOk');
  var cardTitle = document.getElementById('cardTitle');
  var cardHint = document.getElementById('cardHint');

  function showMsg(el, text) {
    clearMsg();
    el.textContent = text;
    el.classList.add('show');
  }
  function clearMsg() {
    [msgError, msgOk].forEach(function (el) {
      el.textContent = '';
      el.classList.remove('show');
    });
  }

  /* ---- 登录方式切换 ---- */
  function setMode(mode) {
    var isPwd = mode === 'password';
    tabPwd.setAttribute('aria-selected', String(isPwd));
    tabPair.setAttribute('aria-selected', String(!isPwd));
    loginForm.hidden = !isPwd;
    pairPanel.hidden = isPwd;
    forgotForm.hidden = true;
    cardTitle.textContent = '登录装修小账本';
    cardHint.textContent = isPwd
      ? '使用同一个账号，继续管理同一份装修项目。'
      : '用小程序扫码或输入登录码完成确认。';
    clearMsg();
    if (!isPwd) refreshCode();
  }
  tabPwd.addEventListener('click', function () { setMode('password'); });
  tabPair.addEventListener('click', function () { setMode('pair'); });

  /* ---- 密码可见性 ---- */
  var pwdInput = document.getElementById('password');
  var pwdToggle = document.getElementById('pwdToggle');
  pwdToggle.addEventListener('click', function () {
    var show = pwdInput.type === 'password';
    pwdInput.type = show ? 'text' : 'password';
    pwdToggle.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
  });

  /* ---- 忘记密码 ---- */
  document.getElementById('forgotLink').addEventListener('click', function () {
    loginForm.hidden = true;
    forgotForm.hidden = false;
    cardTitle.textContent = '找回密码';
    cardHint.textContent = '输入绑定邮箱，我们会发送重置链接。';
    clearMsg();
  });
  document.getElementById('backLogin').addEventListener('click', function () {
    setMode('password');
  });
  forgotForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('forgotEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg(msgError, '请输入有效的邮箱地址。');
      return;
    }
    showMsg(msgOk, '重置链接已发送至 ' + email + '（演示环境，未真实发送）。');
  });

  /* ---- 账号登录提交（演示：localStorage 校验注册用户） ---- */
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('username').value.trim();
    var pwd = pwdInput.value;
    if (!name) { showMsg(msgError, '请输入用户名或邮箱。'); return; }
    if (!pwd) { showMsg(msgError, '请输入密码。'); return; }

    var users = {};
    try { users = JSON.parse(localStorage.getItem('zhangben_users') || '{}'); } catch (err) {}
    var u = users[name];
    if (!u || u.password !== pwd) {
      showMsg(msgError, '账号或密码不正确。如未注册，请先创建账号。');
      return;
    }
    var remember = document.getElementById('rememberMe').checked;
    var store = remember ? localStorage : sessionStorage;
    store.setItem('zhangben_session', JSON.stringify({ user: name, ts: Date.now() }));
    showMsg(msgOk, '登录成功，正在进入主页……');
    setTimeout(function () { location.href = 'index.html'; }, 600);
  });

  /* ---- 微信登录码（与小程序端同算法：按 5 分钟时段生成，可在真机校验） ---- */
  var pairCode = document.getElementById('pairCode');
  var pairStatus = document.getElementById('pairStatus');
  var CODE_SALT = 'zhuangxiu-xiaozhangben|login|';
  var CODE_WINDOW = 5 * 60 * 1000;

  function codeOf(windowIndex) {
    var str = CODE_SALT + windowIndex;
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return ('000000' + (h % 1000000)).slice(-6);
  }

  function currentCode() {
    return codeOf(Math.floor(Date.now() / CODE_WINDOW));
  }

  function refreshCode() {
    var now = Date.now();
    pairCode.textContent = currentCode();
    var left = Math.ceil((CODE_WINDOW - (now % CODE_WINDOW)) / 1000);
    var m = Math.floor(left / 60);
    var s = left % 60;
    pairStatus.textContent = '登录码 ' + m + ':' + (s < 10 ? '0' : '') + s + ' 后更新 · 演示校验';
  }

  refreshCode();
  setInterval(refreshCode, 1000);

  document.getElementById('refreshPair').addEventListener('click', function () {
    var code = currentCode();
    var done = function () { showMsg(msgOk, '登录码 ' + code + ' 已复制，可在小程序“登录码校验”中输入。'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, done);
    } else {
      done();
    }
  });

  /* ---- 小程序入口 ---- */
  document.getElementById('miniEntry').addEventListener('click', function () {
    showMsg(msgOk, '请打开微信，搜索小程序「装修小账本」。');
  });
})();
