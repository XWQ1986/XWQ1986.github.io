/* 注册页交互（纯前端演示，账号写入 localStorage） */
(function () {
  'use strict';

  var msgError = document.getElementById('msgError');
  var msgOk = document.getElementById('msgOk');

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

  /* ---- 发送验证码（演示倒计时） ---- */
  var sendBtn = document.getElementById('sendCodeBtn');
  var sentCode = null;
  sendBtn.addEventListener('click', function () {
    var email = document.getElementById('email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg(msgError, '请先输入有效的邮箱地址。');
      return;
    }
    sentCode = String(Math.floor(100000 + Math.random() * 900000));
    showMsg(msgOk, '验证码已发送（演示环境，验证码为 ' + sentCode + '）。');
    var left = 60;
    sendBtn.disabled = true;
    sendBtn.textContent = left + 's 后重发';
    var timer = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(timer);
        sendBtn.disabled = false;
        sendBtn.textContent = '发送验证码';
      } else {
        sendBtn.textContent = left + 's 后重发';
      }
    }, 1000);
  });

  /* ---- 密码强度条 ---- */
  var pwdInput = document.getElementById('password');
  var pwdBar = document.getElementById('pwdBar');
  pwdInput.addEventListener('input', function () {
    var v = pwdInput.value;
    var score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^a-zA-Z0-9]/.test(v)) score++;
    var pct = [0, 20, 40, 60, 80, 100][score];
    var color = score <= 2 ? '#d97757' : score <= 3 ? '#e0b34c' : '#4b9f96';
    pwdBar.style.width = v ? pct + '%' : '0';
    pwdBar.style.background = color;
  });

  /* ---- 提交注册 ---- */
  document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    var code = document.getElementById('emailCode').value.trim();
    var name = document.getElementById('username').value.trim();
    var pwd = pwdInput.value;
    var pwd2 = document.getElementById('password2').value;
    var terms = document.getElementById('acceptTerms').checked;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg(msgError, '请输入有效的邮箱地址。'); return; }
    if (!sentCode || code !== sentCode) { showMsg(msgError, '验证码不正确，请先发送并输入收到的 6 位验证码。'); return; }
    if (name.length < 3 || name.length > 20) { showMsg(msgError, '用户名需为 3-20 个字符。'); return; }
    if (pwd.length < 8) { showMsg(msgError, '密码至少 8 个字符。'); return; }
    if (pwd !== pwd2) { showMsg(msgError, '两次输入的密码不一致。'); return; }
    if (!terms) { showMsg(msgError, '请先勾选同意用户协议和隐私政策。'); return; }

    var users = {};
    try { users = JSON.parse(localStorage.getItem('zhangben_users') || '{}'); } catch (err) {}
    if (users[name] || users[email]) { showMsg(msgError, '该用户名或邮箱已被注册。'); return; }
    users[name] = { email: email, password: pwd, nickname: name };
    users[email] = { email: email, password: pwd, nickname: name };
    localStorage.setItem('zhangben_users', JSON.stringify(users));

    showMsg(msgOk, '注册成功，正在跳转登录页……');
    setTimeout(function () { location.href = 'login.html'; }, 800);
  });
})();
