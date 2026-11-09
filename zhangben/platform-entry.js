(function () {
  'use strict';

  const MINI_PROGRAM = {
    name: '装修小账本',
    qrImage: ''
  };
  const MOBILE_REMINDER_KEY = 'xz_mobile_web_reminder_v1';
  if (!document.querySelector('link[data-personal-enterprise], link[href^="personal-enterprise.css"]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'personal-enterprise.css?v=20261023-platform';
    style.dataset.personalEnterprise = 'true';
    document.head.appendChild(style);
  }

  function isMobileWebVisit() {
    const narrowViewport = window.matchMedia('(max-width: 820px)').matches;
    const mobileUserAgent = /Android|iPhone|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent || '');
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
    return narrowViewport && (mobileUserAgent || coarsePointer || window.innerWidth <= 540);
  }

  function hasSeenMobileReminder() {
    try {
      return sessionStorage.getItem(MOBILE_REMINDER_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function markMobileReminderSeen() {
    try {
      sessionStorage.setItem(MOBILE_REMINDER_KEY, '1');
    } catch (_) {
      // 隐私模式禁用存储时，仍允许用户正常关闭提示。
    }
  }

  function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value);
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    document.body.classList.remove('platform-modal-open');
    window.setTimeout(() => modal.remove(), 180);
  }

  function openModal(options) {
    const existing = document.querySelector('.platform-modal');
    if (existing) return;
    const isMobileReminder = Boolean(options && options.mobileReminder);

    if (isMobileReminder) markMobileReminderSeen();

    const modal = document.createElement('div');
    modal.className = 'platform-modal' + (isMobileReminder ? ' is-mobile-reminder' : '');
    modal.innerHTML =
      '<div class="platform-modal-backdrop" data-platform-close></div>' +
      '<section class="platform-modal-card" role="dialog" aria-modal="true" aria-labelledby="platformModalTitle">' +
      '<button class="platform-modal-close" type="button" aria-label="关闭" data-platform-close><img class=xz-icon src=assets/icons/close.svg alt aria-hidden=true></button>' +
      '<div class="platform-modal-brand"><img src="assets/icons/mini-program.svg" alt="微信小程序"></div>' +
      '<p class="platform-modal-eyebrow">' + (isMobileReminder ? '手机端访问提示' : '微信小程序') + '</p>' +
      '<h2 id="platformModalTitle">' + (isMobileReminder ? '手机端建议使用小程序' : '手机上也能使用装修小账本') + '</h2>' +
      '<p class="platform-modal-copy">' + (isMobileReminder
        ? '网页版按照电脑大屏设计，手机上部分表格、流程和编辑区域可能显示不完整。建议前往微信小程序体验，使用同一账号即可同步数据。'
        : '随时记录账单、待办和装修进度，与网页版使用同一账号即可同步数据。') + '</p>' +
      (MINI_PROGRAM.qrImage
        ? '<img class="platform-modal-qr" src="' + MINI_PROGRAM.qrImage + '" alt="装修小账本微信小程序码">'
        : '<div class="platform-search-guide"><span>1</span><p>打开微信</p><i></i><span>2</span><p>搜索“装修小账本”</p></div>') +
      '<div class="platform-modal-actions">' +
      '<button class="platform-copy-name" type="button" data-copy-mini-name>复制“装修小账本”名称</button>' +
      (isMobileReminder ? '<button class="platform-mobile-continue" type="button" data-platform-close>仍然浏览网页版</button>' : '') +
      '</div>' +
      '<p class="platform-modal-note">' + (isMobileReminder
        ? '关闭后，本次浏览期间不再重复提醒。'
        : '网页端适合集中整理，微信小程序适合在现场随手记录。') + '</p>' +
      '</section>';

    document.body.appendChild(modal);
    document.body.classList.add('platform-modal-open');
    requestAnimationFrame(() => modal.classList.add('is-open'));

    modal.querySelectorAll('[data-platform-close]').forEach((button) => {
      button.addEventListener('click', () => closeModal(modal));
    });
    modal.querySelector('[data-copy-mini-name]').addEventListener('click', (event) => {
      const button = event.currentTarget;
      copyText(MINI_PROGRAM.name).then(() => {
        button.textContent = '已复制“装修小账本”';
        window.setTimeout(() => { button.textContent = '复制“装修小账本”名称'; }, 1800);
      }).catch(() => {
        button.textContent = '请在微信搜索“装修小账本”';
      });
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal(modal);
    });
    modal.querySelector('.platform-modal-close').focus();
  }

  document.addEventListener('click', (event) => {
    const entry = event.target.closest('[data-mini-program-entry]');
    if (!entry) return;
    event.preventDefault();
    if (isMobileWebVisit()) markMobileReminderSeen();
    openModal();
  });

  window.XZPlatformEntry = { openMiniProgram: openModal };

  function scheduleMobileReminder() {
    if (!isMobileWebVisit() || hasSeenMobileReminder()) return;
    let attempts = 0;
    const tryOpen = () => {
      const visibleDialog = Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) => {
        if (dialog.closest('[hidden]')) return false;
        const style = window.getComputedStyle(dialog);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (document.querySelector('.platform-modal') || visibleDialog) {
        attempts += 1;
        if (attempts < 6) window.setTimeout(tryOpen, 800);
        return;
      }
      openModal({ mobileReminder: true });
    };
    window.setTimeout(tryOpen, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleMobileReminder, { once: true });
  } else {
    scheduleMobileReminder();
  }
})();
