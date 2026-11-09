(function () {
  'use strict';

  const ICONS = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    zoomIn: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6M10 7v6"/>',
    zoomOut: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6"/>',
    fit: '<path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/>',
    rotateCw: '<path d="M19 10a7 7 0 1 0 0 5M19 4v6h-6"/>',
    home: '<path d="M4.5 11.5 12 5l7.5 6.5"/><path d="M6.5 10.5V20h4.2v-5.2h2.6V20h4.2v-9.5"/>',
    cart: '<path d="M6.6 7.4h12.2l-1.4 7H8.7L7.5 4.8H5"/><circle cx="10" cy="18.7" r=".8"/><circle cx="16.8" cy="18.7" r=".8"/>',
    compare: '<path d="M5 7h12M14 4l3 3-3 3M19 17H7M10 14l-3 3 3 3"/>',
    wallet: '<path d="M5.5 7.5h13A1.5 1.5 0 0 1 20 9v9.2A1.8 1.8 0 0 1 18.2 20H5.8A1.8 1.8 0 0 1 4 18.2V6.8A1.8 1.8 0 0 1 5.8 5h11.7"/><path d="M15.5 13h4.5"/><circle cx="16.2" cy="13" r=".7"/>',
    flow: '<path d="M7 4h10v5H7zM7 15h10v5H7zM12 9v6"/>',
    check: '<path d="M6.5 12.4 10.2 16 17.8 8.2"/><circle cx="12" cy="12" r="9"/>',
    diary: '<path d="M6 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
    tool: '<path d="M14.9 6.2a4.2 4.2 0 0 0-5.2 5.2l-4.9 4.9a1.9 1.9 0 0 0 2.7 2.7l4.9-4.9a4.2 4.2 0 0 0 5.2-5.2l-3 3-2.7-2.7z"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    mini: '<path d="M8.5 11.5V7a3.5 3.5 0 1 1 3.5 3.5H8.5a3.5 3.5 0 1 0 3.5 3.5V9.5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    file: '<path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5z"/><path d="M14 4.8V9h4.2M9 13h6M9 16.5h4"/>',
    camera: '<path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3"/>',
    trash: '<path d="M5 7h14M9 7V5h6v2M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    leaf: '<path d="M6 15c3.5-7 9-10 13-10 0 7-4 13-11 13-2.2 0-3.7-1.1-4.6-3"/><path d="M6 19c2-3 5.2-5.4 9.6-7.3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    estimate: '<path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v12A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V6A1.5 1.5 0 0 1 7 4.5z"/><path d="M8.5 8h7M8.5 11h2M13.5 11h2M8.5 14h2M13.5 14h2M8.5 17h7"/>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'
  };

  const svg = (name, className = 'fresh-svg') =>
    '<svg viewBox="0 0 24 24" class="' + className + '" aria-hidden="true">' + (ICONS[name] || ICONS.file) + '</svg>';

  const page = decodeURIComponent(location.pathname.split('/').pop() || '主页.html');
  /* 复刻版文件名与原版不同，渲染导航时统一映射 */
  const LINK_MAP = {
    '主页.html': 'home.html',
    '装修流程.html': 'process.html',
    '采购清单.html': 'procurement.html',
    '材料统计.html': 'materials.html',
    '比价清单.html': 'compare.html',
    '实用工具.html': 'tools.html',
    '装修日记.html': 'diary.html',
    '知识百科.html': 'shuidian.html'
  };
  const realHref = (href) => LINK_MAP[href] || href;
  const nav = [
    ['主页.html', '今日总览', 'home'],
    ['装修流程.html', '装修流程', 'flow'],
    ['采购清单.html', '采购清单', 'cart'],
    ['材料统计.html', '装修记账', 'wallet'],
    ['比价清单.html', '比价选品', 'compare']
  ];

  const supportNav = [
    ['实用工具.html', '实用工具', 'tool'],
    ['装修日记.html', '装修日记', 'diary'],
    ['知识百科.html', '水电知识', 'file']
  ];

  const toolChildren = [
    '面积计算.html',
    '瓷砖用量.html',
    '瓷砖排版模拟器-本地测试.html',
    '线径计算.html',
    '价格估算.html',
    '电路模拟器.html',
    '知识百科.html',
    '装修日记.html'
  ];

  const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

  const pageMeta = {
    '主页.html': { title: '装修小账本 - 装修总览', heading: '装修总览', breadcrumb: '我的装修 / 家庭工作台' },
    '采购清单.html': { title: '装修小账本 - 采购清单', heading: '采购清单', breadcrumb: '我的装修 / 采购管理' },
    '比价清单.html': { title: '装修小账本 - 比价选品', heading: '比价选品', breadcrumb: '我的装修 / 采购管理' },
    '材料统计.html': { title: '装修小账本 - 装修记账', heading: '装修记账', breadcrumb: '我的装修 / 预算与支出' },
    '装修流程.html': { title: '装修小账本 - 装修流程', heading: '装修流程', breadcrumb: '我的装修 / 施工管理' },
    '实用工具.html': { title: '装修小账本 - 实用工具', heading: '实用工具', breadcrumb: '辅助工具 / 工具中心' },
    '装修日记.html': { title: '装修小账本 - 装修日记', heading: '装修日记', breadcrumb: '辅助工具 / 过程记录' },
    '知识百科.html': { title: '装修小账本 - 水电知识', heading: '水电知识', breadcrumb: '辅助工具 / 水电知识' },
    '面积计算.html': { title: '装修小账本 - 面积计算', heading: '面积计算器', breadcrumb: '实用工具 / 面积与用量' },
    '瓷砖用量.html': { title: '装修小账本 - 瓷砖用量', heading: '瓷砖用量计算器', breadcrumb: '实用工具 / 面积与用量' },
    '瓷砖排版模拟器-本地测试.html': { title: '装修小账本 - 瓷砖排版模拟器', heading: '瓷砖排版模拟器', breadcrumb: '实用工具 / 面积与用量' },
    '线径计算.html': { title: '装修小账本 - 线径计算', heading: '线径计算器', breadcrumb: '实用工具 / 电路工具' },
    '价格估算.html': { title: '装修小账本 - 价格估算', heading: '价格估算', breadcrumb: '实用工具 / 装修预算' },
    '电路模拟器.html': { title: '装修小账本 - 电路模拟器', heading: '电路回路模拟器', breadcrumb: '实用工具 / 电路工具' },
    'customer-projects.html': { title: '装修小账本 - 我的装修公司', heading: '我的装修公司', breadcrumb: '我的装修 / 施工提醒' }
  };

  function activeFor(href) {
    const target = realHref(href);
    if (page === target) return true;
    if (target === 'tools.html') {
      return toolChildren.includes(page) && !['知识百科.html', '装修日记.html'].includes(page);
    }
    return false;
  }

  function setText(selector, text, root) {
    const el = (root || document).querySelector(selector);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function setTexts(selector, values, root) {
    const nodes = Array.from((root || document).querySelectorAll(selector));
    values.forEach((value, index) => {
      if (nodes[index] && nodes[index].textContent !== value) nodes[index].textContent = value;
    });
  }

  function setPlaceholder(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('placeholder', text);
  }

  /* 计算器页的表单控件多为快照结构，label 未关联 id，这里按就近 label / placeholder 补 aria-label */
  function enhanceA11y() {
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.type === 'hidden' || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
      let text = '';
      if (el.id) {
        const label = document.querySelector('label[for="' + el.id + '"]');
        if (label) text = label.textContent.trim();
      }
      if (!text) {
        const wrap = el.closest('label');
        if (wrap) text = wrap.textContent.trim();
      }
      if (!text) {
        const group = el.closest('.input-group, .form-group, .field');
        const label = group && group.querySelector('label');
        if (label) text = label.textContent.trim();
      }
      if (!text) text = el.getAttribute('placeholder') || el.getAttribute('title') || '';
      if (text) el.setAttribute('aria-label', text);
    });
  }

  function buildShell() {
    document.querySelectorAll('.navbar, nav.navbar, .topnav, .fresh-navbar, .fresh-mobile-nav, .fresh-sidebar, .fresh-topbar').forEach((n) => n.remove());
    document.querySelectorAll('.bottom-tab').forEach((n) => n.remove());

    document.body.classList.add('personal-enterprise-shell');
    if (!document.querySelector('link[rel="icon"]')) { const icon=document.createElement('link'); icon.rel='icon'; icon.href='assets/yellow/logo.svg'; document.head.append(icon); }
    document.body.classList.toggle('fresh-topbar-title-required', page === '价格估算.html');

    if (!document.querySelector('link[data-personal-enterprise]')) {
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = 'personal-enterprise.css?v=20260802-shell-boot-v1';
      styleLink.dataset.personalEnterprise = 'true';
      document.head.appendChild(styleLink);
    }

    const sidebar = document.createElement('aside');
    sidebar.className = 'fresh-sidebar';
    sidebar.innerHTML =
      '<a class="fresh-brand" href="' + realHref('主页.html') + '"><span class="fresh-brand-mark"><img src="assets/yellow/logo.svg" alt=""></span><span><b>装修小账本</b></span></a>' +

      '<nav class="fresh-navlinks" aria-label="个人版导航">' +
      '<span class="fresh-nav-label">我的装修</span>' +
      nav.map(([href, label, icon]) =>
        '<a href="' + realHref(href) + '" class="' + (activeFor(href) ? 'active' : '') + '"' + (activeFor(href) ? ' aria-current="page"' : '') + '>' + svg(icon) + '<span>' + label + '</span></a>'
      ).join('') +
      '<span class="fresh-nav-label fresh-nav-label-support">辅助工具</span>' +
      supportNav.map(([href, label, icon]) =>
        '<a href="' + realHref(href) + '" class="' + (activeFor(href) ? 'active' : '') + '"' + (activeFor(href) ? ' aria-current="page"' : '') + '>' + svg(icon) + '<span>' + label + '</span></a>'
      ).join('') +
      '</nav>' +
      '<div class="fresh-sidebar-note"><span></span><p><b>装修小提醒</b><small>重要节点先确认，付款与验收都留档。</small></p></div>' +
      '<div class="fresh-nav-actions">' +
      '<button class="fresh-platform-link" type="button" data-mini-program-entry>' + svg('mini') + '<span><b>微信小程序</b><small>手机随时记录</small></span></button>' +
      '<a href="account.html">' + svg('user') + '<span>账号管理</span></a>' +
      '</div>';
    document.body.insertBefore(sidebar, document.body.firstChild);

    const meta = pageMeta[page] || { heading: '个人工作台', breadcrumb: '装修小账本 / 我的装修' };
    const topbar = document.createElement('header');
    topbar.className = 'fresh-topbar';
    /* 已登录时顶栏入口应指向账号管理，避免把用户送回登录页 */
    const signedIn = (function () {
      try {
        const raw = localStorage.getItem('zhangben_session') || sessionStorage.getItem('zhangben_session');
        return !!(raw && JSON.parse(raw).user);
      } catch (e) { return false; }
    })();
    topbar.innerHTML =
      '<div class="fresh-header-project" data-project-host><span class="fresh-project-loading">我的装修</span></div>' +
      '<div class="fresh-topbar-copy"><small>' + meta.breadcrumb + '</small><strong>' + meta.heading + '</strong></div>' +
      '<div class="fresh-topbar-actions">' +
      '<a class="fresh-user-link" href="' + (signedIn ? 'account.html' : 'login.html') + '">' + svg('user') + '<span>' + (signedIn ? '账号管理' : '个人账号') + '</span></a>' +
      '<div class="fresh-global-search">' + svg('search') + '<input type="search" data-shell-search aria-label="搜索本页内容或功能" placeholder="搜索本页内容或功能"></div>' +
      '<a class="fresh-topbar-primary" href="' + realHref('主页.html') + '">' + svg(page === '主页.html' ? 'plus' : 'home') + '<span>' + (page === '主页.html' ? '新增待办' : '返回总览') + '</span></a>' +
      '</div>';
    document.body.insertBefore(topbar, sidebar.nextSibling);

    const primary = topbar.querySelector('.fresh-topbar-primary');
    if (page === '主页.html') {
      primary.href = '#homeTodoCard';
      primary.addEventListener('click', (event) => {
        const input = document.getElementById('todoText');
        if (!input) return;
        event.preventDefault();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
      });
    }

    const shellSearch = topbar.querySelector('[data-shell-search]');
    const searchStatus = document.createElement('span');
    searchStatus.className = 'fresh-search-status';
    searchStatus.setAttribute('role', 'status');
    searchStatus.setAttribute('aria-live', 'polite');
    topbar.querySelector('.fresh-global-search').appendChild(searchStatus);
    const homeSearchResults = page === '主页.html' ? document.getElementById('searchResults') : null;
    if (homeSearchResults) {
      homeSearchResults.classList.add('fresh-shell-search-results');
      topbar.querySelector('.fresh-global-search').appendChild(homeSearchResults);
    }
    const findPageSearch = () => {
      const candidates = Array.from(document.querySelectorAll('input[type="search"], #globalSearch, #searchInput'));
      return candidates.find((input) => input !== shellSearch && (input.id === 'globalSearch' || input.offsetParent !== null));
    };
    const syncSearch = () => {
      const target = findPageSearch();
      searchStatus.textContent = '';
      if (!target) return;
      target.value = shellSearch.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      searchStatus.textContent = shellSearch.value.trim() ? '已按关键词筛选当前页面' : '';
    };
    shellSearch.addEventListener('input', syncSearch);
    shellSearch.addEventListener('search', syncSearch);
    shellSearch.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || findPageSearch() || !shellSearch.value.trim()) return;
      event.preventDefault();
      const found = window.find(shellSearch.value.trim());
      searchStatus.textContent = found ? '已定位到相关内容' : '未找到相关内容，请换个关键词';
    });
  }

  function cleanText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement && ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) return;
      // Functional symbols and SVG text are content, not decorative emoji.
      if (node.parentElement?.closest('svg, .fresh-symbol-button')) return;
      const cleaned = node.nodeValue.replace(emojiPattern, '').replace(/\s{2,}/g, ' ');
      if (!cleaned.trim() && node.parentElement?.closest('button, [role="button"]')) return;
      if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
    });
  }

  function iconForText(text) {
    if (/采购|材料|待购/.test(text)) return 'cart';
    if (/价格估算|估算|报价/.test(text)) return 'estimate';
    if (/预算|记账|金额|价格/.test(text)) return 'wallet';
    if (/流程|进度|阶段/.test(text)) return 'flow';
    if (/验收|检查|完成/.test(text)) return 'check';
    if (/计算|工具|模拟/.test(text)) return 'calculator';
    if (/日记|记录/.test(text)) return 'diary';
    if (/图片|相机/.test(text)) return 'camera';
    return 'file';
  }

  function iconForElement(el) {
    const link = el.closest('a[href]');
    const href = link ? decodeURIComponent(link.getAttribute('href') || '') : '';
    if (href.includes('价格估算')) return 'estimate';
    if (href.includes('装修日记')) return 'diary';
    if (href.includes('电路模拟器')) return 'calculator';
    if (href.includes('线径计算')) return 'calculator';
    if (href.includes('面积计算')) return 'calculator';
    if (href.includes('瓷砖用量')) return 'calculator';
    if (href.includes('瓷砖排版模拟器')) return 'grid';
    if (href.includes('装修流程')) return 'flow';
    const text = (el.textContent || '') + ' ' + (el.parentElement ? el.parentElement.textContent || '' : '');
    return iconForText(text);
  }

  function normalizeActionIcons(root) {
    root.querySelectorAll('button').forEach((button) => {
      if (!/^[✕✖×]$/.test(button.textContent.trim()) || button.querySelector('svg')) return;
      const destructive = /remove|delete|del[A-Z]/.test(button.getAttribute('onclick') || '');
      button.innerHTML = svg(destructive ? 'trash' : 'close');
      button.classList.add('fresh-symbol-button');
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', destructive ? '删除' : '关闭');
      if (!button.hasAttribute('title')) button.title = button.getAttribute('aria-label');
    });
    root.querySelectorAll('[data-fresh-icon]').forEach((el) => {
      const name = el.dataset.freshIcon;
      if (ICONS[name] && !el.querySelector('svg')) el.innerHTML = svg(name);
    });
  }

  function normalizeIcons(root) {
    root.querySelectorAll('.parent-icon, .tool-icon, .category-icon, .feature-icon, .cat-icon, .bill-icon, .step-icon').forEach((el) => {
      if (!el.querySelector('svg, img')) {
        el.textContent = '';
        el.innerHTML = svg(iconForElement(el));
      }
    });
    root.querySelectorAll('svg.fresh-svg').forEach((el) => {
      if (!el.getAttribute('viewBox')) el.setAttribute('viewBox', '0 0 24 24');
    });
  }

  function enhanceComparePage(root) {
    if (page !== '比价清单.html') return;
    document.body.classList.add('page-compare');
    const container = document.querySelector('.container');
    if (!container) return;

    const titlebar = container.querySelector('#comparePageHeading');
    if (titlebar) titlebar.classList.add('compare-titlebar');
    const onlineToolbar = container.querySelector('#onlineToolbar');
    if (onlineToolbar) onlineToolbar.classList.add('compare-toolbar');

    let summary = document.getElementById('compareSummary');
    if (!summary) {
      summary = document.createElement('section');
      summary.id = 'compareSummary';
      summary.className = 'compare-counts';
      summary.innerHTML = '<div><span>品类</span><b id="compareCats">0</b></div><div><span>型号</span><b id="compareProducts">0</b></div><div><span>报价渠道</span><b id="compareQuotes">0</b></div>';
      const sectionHead = container.querySelector('#compareSectionHead') || onlineToolbar;
      if (sectionHead) sectionHead.insertAdjacentElement('afterend', summary);
    }

    const values = {
      compareCats: document.querySelectorAll('.cat-card').length,
      compareProducts: document.querySelectorAll('.prod-card').length,
      compareQuotes: document.querySelectorAll('.quote-card').length
    };
    summary.hidden = Object.values(values).every(value => value === 0);
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== String(value)) el.textContent = String(value);
    });

    root.querySelectorAll('.cat-icon').forEach((el) => {
      if (el.dataset.freshIcon !== 'compare') {
        el.innerHTML = svg('compare');
        el.dataset.freshIcon = 'compare';
      }
    });
    root.querySelectorAll('.prod-img').forEach((el) => {
      if (!el.querySelector('img') && !el.querySelector('svg')) el.innerHTML = svg('camera');
    });
    root.querySelectorAll('.del-btn').forEach((el) => {
      if (!el.querySelector('svg')) el.innerHTML = svg('trash');
      el.setAttribute('title', '删除');
    });
    root.querySelectorAll('.arrow').forEach((el) => {
      if (!el.querySelector('svg')) el.innerHTML = svg('chevron');
    });
  }

  function readShellJson(keys, fallback) {
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed !== null) return parsed;
      } catch (error) {}
    }
    return fallback;
  }

  function shellMoney(value) {
    const amount = Number(value) || 0;
    return (amount < 0 ? '-' : '') + '¥' + Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function shellTransactionType(item) {
    const raw = String((item && (item.transactionType || item.type)) || '').trim().toLowerCase();
    const status = String((item && item.status) || '').trim().toLowerCase();
    return ['refund', '退款', '退回', '冲销'].includes(raw) || ['refund', '退款', '退回', '冲销'].includes(status) || Number(item && item.amount) < 0 ? 'refund' : 'expense';
  }

  function shellPayStatus(item) {
    const raw = String((item && (item.payStatus || item.status)) || '').trim();
    if (['prepaid', '预付', '定金'].includes(raw)) return 'prepaid';
    if (['pending', '待付', '未付', '未付款'].includes(raw)) return 'pending';
    return 'paid';
  }

  function shellLedgerTotals(items) {
    if (typeof window.homeLedgerTotals === 'function') {
      try { return window.homeLedgerTotals(items); } catch (error) {}
    }
    let expenses = 0, refunds = 0, pending = 0, paidCash = 0, prepaid = 0;
    (Array.isArray(items) ? items : []).forEach((item) => {
      const amount = Math.abs(Number(item.amount) || 0);
      const type = shellTransactionType(item);
      const status = shellPayStatus(item);
      if (type === 'refund') { refunds += amount; if (status !== 'pending') paidCash -= amount; return; }
      expenses += amount;
      if (status === 'pending') pending += amount; else paidCash += amount;
      if (status === 'prepaid') prepaid += amount;
    });
    return { expenses, refunds, pending, paidCash, prepaid, occupation: expenses - refunds };
  }

  function shellEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shellDateLabel(value) {
    if (!value) return '未设置日期';
    const raw = String(value).replace(/\./g, '-');
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00' : raw);
    if (Number.isNaN(date.getTime())) return String(value);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const key = XZLocalCalendar.dateKey(date);
    if (key === XZLocalCalendar.dateKey(today)) return '今天';
    if (key === XZLocalCalendar.dateKey(tomorrow)) return '明天';
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function getShellTodos() {
    if (typeof window.readTodos === 'function') {
      try { return window.readTodos(); } catch (error) {}
    }
    const raw = readShellJson(['装修待办v2'], []);
    return Array.isArray(raw) ? raw : [];
  }

  function getShellBills() {
    if (typeof window.loadHomeBills === 'function') {
      try { return window.loadHomeBills(); } catch (error) {}
    }
    const raw = readShellJson(['装修记账数据'], []);
    return Array.isArray(raw) ? raw : [];
  }

  function getShellProcessSteps() {
    if (typeof window.getHomeProcessSteps === 'function') {
      try { return window.getHomeProcessSteps(); } catch (error) {}
    }
    return [
      { name: '设计与开工准备' },
      { name: '墙体拆改' },
      { name: '水电改造' },
      { name: '防水施工' },
      { name: '墙地砖铺贴' },
      { name: '木工吊顶' },
      { name: '墙面涂饰' },
      { name: '安装与软装' }
    ];
  }

  function buildEnterpriseHomeDashboard() {
    if (page !== '主页.html' || document.getElementById('enterpriseHomeDashboard')) return;
    const home = document.querySelector('main.home-pro');
    if (!home) return;
    const dashboard = document.createElement('section');
    dashboard.id = 'enterpriseHomeDashboard';
    dashboard.innerHTML = `
      <header class="yellow-page-heading">
        <div><h1>装修总览</h1><p>先确认，再付款；先留档，再封槽。</p></div>
        <div class="yellow-heading-actions"><button type="button" data-home-section="backup">数据备份</button><button type="button" data-home-project>项目资料</button></div>
      </header>
      <div class="yellow-home-grid">
        <section class="yellow-money-card" aria-label="装修预算占用">
          <span>装修预算占用</span><strong id="yellowHomeOccupation">¥0.00</strong>
          <div class="yellow-money-foot"><p>待付款 <b id="yellowHomePending">¥0.00</b></p><a href="材料统计.html#new">记一笔</a></div>
        </section>
        <section class="yellow-quick-card" aria-label="常用入口">
          <div class="yellow-quick-links">
            <a href="材料统计.html#stats"><img src="assets/yellow/stats.svg" alt="">分类统计</a>
            <a href="装修流程.html"><img src="assets/yellow/flow.svg" alt="">查看流程</a>
            <a href="装修流程.html#acceptance"><img src="assets/yellow/health.svg" alt="">验收要点</a>
          </div>
          <div class="yellow-budget-link"><span>总预算</span><strong id="yellowHomeBudget">未设预算</strong><button type="button" data-home-section="budget">设置预算 ›</button></div>
        </section>
        <article class="yellow-home-panel yellow-progress-panel">
          <header><h2>装修进度</h2><a href="装修流程.html">查看全部 ›</a></header>
          <div class="yellow-stage-current"><div><span>当前阶段</span><b id="yellowHomeStage">准备开始</b></div><div class="yellow-stage-count"><strong id="yellowHomeProgress">0 / 22</strong><small>已完成节点</small></div></div>
          <div class="yellow-stage-track"><i id="yellowHomeProgressBar"></i></div>
          <div class="yellow-stage-route" id="yellowHomeStageRoute"></div>
          <p class="yellow-stage-tip" id="yellowHomeStageTip">先完成验房、量房和物业报备。</p>
        </article>
        <article class="yellow-home-panel yellow-recent-panel"><header><h2>最近账目</h2><a href="材料统计.html">全部账单 ›</a></header><div class="yellow-recent-list" id="yellowHomeRecent"></div></article>
      </div>`;
    home.prepend(dashboard);
    const grid = dashboard.querySelector('.yellow-home-grid');
    const todoCard = document.getElementById('homeTodoCard');
    if (todoCard) {
      grid.insertBefore(todoCard, grid.querySelector('.yellow-progress-panel'));
      todoCard.querySelectorAll('.home-swap-btn').forEach(button => button.remove());
      todoCard.querySelector('.card-hd h3 .iconbox')?.remove();
      const form = todoCard.querySelector('.todo-add-grid');
      if (form) {
        const details = document.createElement('details');
        details.className = 'yellow-todo-add';
        details.innerHTML = '<summary>新增待办</summary>';
        form.before(details);
        details.append(form);
      }
      const filters = document.createElement('div');
      filters.className = 'yellow-todo-filters';
      filters.innerHTML = '<button type="button" data-todo-filter="priority" aria-pressed="true">今日优先</button><button type="button" data-todo-filter="all" aria-pressed="false">全部待办</button>';
      document.getElementById('todoList').before(filters);
      filters.addEventListener('click', event => {
        const button = event.target.closest('[data-todo-filter]');
        if (!button) return;
        filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        applyYellowTodoFilter();
      });
      const note = document.createElement('p');
      note.className = 'yellow-todo-note';
      note.textContent = '先确认，再付款；先留档，再封槽。';
      todoCard.querySelector('.card-bd').append(note);
      new MutationObserver(applyYellowTodoFilter).observe(document.getElementById('todoList'), { childList:true });
    }
    const buyCard = document.getElementById('buyList')?.closest('.card');
    if (buyCard) { buyCard.classList.add('yellow-buy-panel'); buyCard.querySelector('.card-hd h3 .iconbox')?.remove(); setText('.card-hd h3', '待购清单', buyCard); grid.append(buyCard); }
    const secondary = document.createElement('details');
    secondary.className = 'yellow-home-secondary';
    secondary.innerHTML = '<summary>预算设置与数据备份</summary>';
    home.append(secondary);
    const budgetCard = document.getElementById('homeBudgetCard');
    if (budgetCard) { budgetCard.querySelectorAll('.home-swap-btn').forEach(button => button.remove()); secondary.append(budgetCard); }
    const backupCard = document.getElementById('importAll')?.closest('.card');
    if (backupCard) { backupCard.id = 'yellowHomeBackup'; secondary.append(backupCard); }
    secondary.addEventListener('toggle', () => {
      if (secondary.open) window.refreshHomeBudget?.();
    });
    dashboard.querySelectorAll('[data-home-section]').forEach(button => button.addEventListener('click', () => {
      secondary.open = true;
      if (button.dataset.homeSection === 'budget') window.refreshHomeBudget?.();
      const target = button.dataset.homeSection === 'budget' ? budgetCard : backupCard;
      target?.scrollIntoView({ behavior:'smooth', block:'center' });
    }));
    dashboard.querySelector('[data-home-project]').addEventListener('click', () => document.querySelector('[data-account-action="edit-project"]')?.click());
  }

  function applyYellowTodoFilter() {
    const list = document.getElementById('todoList');
    if (!list) return;
    const priorityOnly = document.querySelector('[data-todo-filter="priority"]')?.getAttribute('aria-pressed') === 'true';
    const priorities = new Set(getShellTodos().filter(item => item.priority && !item.done).map(item => 'todo_' + (Number(item.id) || 0)));
    let shown = 0;
    list.querySelectorAll('.fresh-todo').forEach(row => {
      row.hidden = priorityOnly && !priorities.has(row.id);
      if (!row.hidden) shown++;
    });
    let empty = document.getElementById('yellowPriorityEmpty');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'yellowPriorityEmpty'; empty.className = 'yellow-priority-empty';
      empty.textContent = '今天没有优先事项，可以查看全部待办。';
      list.after(empty);
    }
    empty.hidden = !(priorityOnly && !shown && list.querySelector('.fresh-todo'));
  }

  let homeDashboardTimer = 0;
  function scheduleEnterpriseHomeUpdate() {
    clearTimeout(homeDashboardTimer);
    homeDashboardTimer = setTimeout(updateEnterpriseHomeDashboard, 30);
  }

  function updateEnterpriseHomeDashboard() {
    if (page !== '主页.html' || !document.getElementById('enterpriseHomeDashboard')) return;
    const bills = getShellBills().filter(item => {
      if (!item) return false;
      if (typeof window.isHomeExpenseBill === 'function') return window.isHomeExpenseBill(item);
      return item.includeExpense !== false && String(item.includeExpense || '').trim() !== '0';
    });
    const budget = readShellJson(['装修预算v3'], {});
    const totalBudget = Number(budget._total || budget.total) || 0;
    const financial = shellLedgerTotals(bills);
    const set = (id, value) => { const node = document.getElementById(id); if (node && node.textContent !== String(value)) node.textContent = value; };
    set('yellowHomeOccupation', shellMoney(financial.occupation));
    set('yellowHomePending', shellMoney(financial.pending));
    set('yellowHomeBudget', totalBudget ? shellMoney(totalBudget) : '未设预算');
    const steps = getShellProcessSteps();
    const doneMap = readShellJson(['装修流程进度'], {});
    const isDone = (step,index) => typeof window.flowDoneAt === 'function'
      ? window.flowDoneAt(doneMap, index) : !!(doneMap['new_' + index] || doneMap['old_' + index]);
    const doneCount = steps.filter(isDone).length;
    const progress = steps.length ? Math.round(doneCount / steps.length * 100) : 0;
    const firstPending = steps.findIndex((step,index) => !isDone(step,index));
    const currentIndex = firstPending < 0 ? Math.max(0,steps.length - 1) : firstPending;
    const current = steps[currentIndex] || {name:'准备开始'};
    set('yellowHomeStage', firstPending < 0 && steps.length ? '全部完成' : current.name);
    set('yellowHomeProgress', doneCount + ' / ' + steps.length);
    document.getElementById('yellowHomeProgressBar').style.width = progress + '%';
    const route = steps.slice(currentIndex,currentIndex + 3).map(step => '<span>' + shellEscape(step.name) + '</span>').join('<span aria-hidden="true"><img class=xz-icon src=assets/icons/chevron-right.svg alt aria-hidden=true></span>');
    const routeEl = document.getElementById('yellowHomeStageRoute');
    if (routeEl.innerHTML !== route) routeEl.innerHTML = route;
    set('yellowHomeStageTip', /水电/.test(current.name) ? '确认打压、回路与点位，并拍照留档。' : /防水/.test(current.name) ? '完成闭水试验，检查阴角与门槛收口。' : currentIndex === 0 ? '先完成验房、量房和物业报备。' : '确认材料、尺寸与验收结果，并留存现场记录。');
    const cats = typeof window.loadHomeCats === 'function' ? window.loadHomeCats() : [];
    const recent = bills.slice().sort((a,b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0,2);
    const html = recent.length ? recent.map(bill => {
      const cat = cats.find(item => item.key === bill.cat) || {name:'装修支出'};
      const refund = shellTransactionType(bill) === 'refund';
      const status = refund ? '退款' : ({paid:'已付',pending:'待付',prepaid:'预付'}[shellPayStatus(bill)]);
      return '<a class="yellow-recent-row" href="材料统计.html"><span class="yellow-recent-icon">' + svg('wallet') + '</span><span><b>' + shellEscape(cat.name + (bill.sub ? ' · ' + bill.sub : '')) + '</b><small>' + shellEscape((bill.note ? bill.note + ' · ' : '') + shellDateLabel(bill.date)) + '</small></span><span><strong>' + (refund ? '−' : '') + shellMoney(Math.abs(Number(bill.amount) || 0)) + '</strong><small>' + status + '</small></span></a>';
    }).join('') : '<div class="yellow-empty"><b>还没有记账记录</b><span>每一笔装修支出，都记在这里</span><a href="材料统计.html#new">记下第一笔 ›</a></div>';
    const recentEl = document.getElementById('yellowHomeRecent');
    if (recentEl.innerHTML !== html) recentEl.innerHTML = html;
    applyYellowTodoFilter();
  }


  function patchHomePage() {
    if (page !== '主页.html') return;
    buildEnterpriseHomeDashboard();
    scheduleEnterpriseHomeUpdate();
    setText('.eyebrow', '今日提醒');
    setText('.hero h1', '今日装修提醒');
    if (!document.getElementById('homeMainSub')) setText('.hero p', '今天的装修提醒会根据日期自动变化。');
    setTexts('.hero-actions .btn, .hero-actions a', ['新增待办', '记一笔', '看流程']);
    setText('.state-title', '今日重点');
    setText('.action-reminder span', '');
    setTexts('.live-title', ['装修进度', '阶段路线', '当前阶段']);
    setPlaceholder('#globalSearch', '搜索待办、记账、比价...');
    setTexts('.summary .metric-card span:last-child', ['每日语录', '预算余额', '待办 / 待购', '最近支出']);
    setText('#homeTodoCard .card-hd h3', '待办事项');
    setText('#homeBudgetCard .card-hd h3', '预算设置与阶段分配');
    setText('#homeProgressCard .card-hd h3', '装修进度');
    setText('.ep-home-buy-card .card-hd h3', '待购清单');
    setText('.ep-home-bill-card .card-hd h3', '记账概览');
    setText('.ep-home-duplicate-card .card-hd h3', '常用入口');
    setText('.ep-home-backup-card .card-hd h3', '数据备份');
    rootQueryAll('[onclick*="openHomeNewProject"]').forEach((button) => button.remove());

    [
      ['#todoText', '待办内容'],
      ['#todoCategory', '待办分类'],
      ['#todoPlanEnd', '截止日期'],
      ['#globalSearch', '搜索当前页面内容或功能']
    ].forEach(([selector, label]) => {
      const control = document.querySelector(selector);
      if (control) control.setAttribute('aria-label', label);
    });
    rootQueryAll('.home-pro button[title]:not([aria-label])').forEach((button) => {
      button.setAttribute('aria-label', button.getAttribute('title') || '操作');
    });
    rootQueryAll('.card-bd span').forEach((el) => {
      if ((el.textContent || '').includes('数据存在浏览器本地')) {
        el.textContent = '登录后自动同步，仍建议定期导出备份';
      }
    });
  }

  function patchBillPage() {
    if (page !== '材料统计.html') return;
    document.body.classList.add('page-accounting');
    if (document.title !== '装修小账本 - 装修记账') document.title = '装修小账本 - 装修记账';
    // The ledger owns these labels: editing must keep “编辑记录 / 保存修改”.
    setPlaceholder('#inputNote', '备注，例如：客厅地砖人工费');
    setText('.group-setting-copy', '手机先点选小分类，再拖到大分类；也可以点选后直接点目标大分类。下方勾选哪些分组显示在主页预算和统计里。');
    setText('#statsPage button[onclick="exportExcel()"]', '导出 Excel');
    setText('#billsPage button[onclick="triggerImportExcel()"]', '导入 Excel');
    setText('#billsPage button[onclick="exportExcel()"]', '导出 Excel');
    setText('#groupPage .manage-small-btn', '管理小项');
    const amountPrefix = document.querySelector('.amount-input .prefix');
    if (amountPrefix) amountPrefix.textContent = '¥';
  }

  function patchPurchasePage() {
    if (page !== '采购清单.html') return;
    setText('h1', '采购清单');
    setText('.subtitle', '集中管理所有来源的待购物品，需要时先比价，买完即可核销');
    const tip = document.querySelector('.tip');
    if (tip) tip.innerHTML = '<strong>使用方法：</strong>先处理自己的待购清单，也可以从采购参考库补充物品；购买完成后及时核销。';
    setText('.go-link', '去首页查看待购清单');
    setPlaceholder('#searchInput', '搜索材料名称...');
  }

  function patchToolsPage() {
    if (page !== '实用工具.html') return;
    document.body.classList.add('page-tools');
    setText('.page-header h1', '实用工具');
    setText('.page-header p', '把装修过程中常用的计算和辅助工具整理在一起，直接进入使用。');
    setTexts('.section-title', ['电路工具', '面积与用量', '装修管理']);
    setTexts('.tool-name', ['电路回路模拟器', '线径计算器', '面积计算器', '瓷砖用量计算器', '瓷砖排版模拟器', '价格估算', '装修日记']);
    setTexts('.tool-desc', [
      '模拟家庭电路回路配置，快速检查负载和分路。',
      '输入功率计算电流，并给出需由电工复核的线径参考。',
      '支持矩形和 L 型房间面积汇总。',
      '按砖规格和损耗率估算数量与箱数。',
      '导入户型图，校准比例并调整砖缝起铺位置。',
      '按城市、面积和方式快速估算费用。',
      '记录施工过程、图片和关键节点。'
    ]);

    const container = document.querySelector('.container');
    if (container && !container.querySelector('.fresh-tool-groups')) {
      const titles = Array.from(container.querySelectorAll(':scope > .section-title'));
      const pairs = titles.map((title) => [title, title.nextElementSibling])
        .filter((pair) => pair[1] && pair[1].classList.contains('tools-grid'));
      if (pairs.length) {
        const host = document.createElement('div');
        host.className = 'fresh-tool-groups';
        container.insertBefore(host, pairs[0][0]);
        pairs.forEach(([title, grid]) => {
          const group = document.createElement('section');
          group.className = 'fresh-tool-group';
          group.appendChild(title);
          group.appendChild(grid);
          host.appendChild(group);
        });
      }
    }

    const recentHref = localStorage.getItem('装修小账本最近使用工具') || '';
    container?.querySelectorAll('a.tool-card').forEach((card) => {
      const href = card.getAttribute('href') || '';
      if (!card.dataset.recentBound) {
        card.addEventListener('click', () => localStorage.setItem('装修小账本最近使用工具', href));
        card.dataset.recentBound = 'true';
      }
      const toolIcon = card.querySelector('.tool-icon');
      if (toolIcon && !toolIcon.querySelector('img')) {
        const asset = /电路|排版/.test(href) ? 'health' : /面积|日记/.test(href) ? 'flow' : 'stats';
        toolIcon.innerHTML = '<img src="assets/yellow/' + asset + '.svg" alt="">';
      }
      if (href && href === recentHref && !card.querySelector('.tool-recent-badge')) {
        const badge = document.createElement('span');
        badge.className = 'tool-recent-badge';
        badge.textContent = '最近使用';
        card.prepend(badge);
      }
    });
  }

  function patchDiaryPage() {
    if (page !== '装修日记.html') return;
    document.body.classList.add('page-diary');
  }

  function patchKnowledgePage() {
    if (page !== '知识百科.html') return;
    document.body.classList.add('page-knowledge');
    document.title = '装修小账本 - 水电知识';
    setText('h1', '水电知识');
    const container = document.querySelector('.container');
    if (!container) return;

    const subtitle = container.querySelector('.subtitle');
    if (subtitle && !container.querySelector('.fresh-knowledge-overview')) {
      const overview = document.createElement('section');
      overview.className = 'fresh-knowledge-overview';
      overview.innerHTML = '<span>电路安全</span><span>水路施工</span><span>验收留档</span>';
      subtitle.insertAdjacentElement('afterend', overview);
    }

    const summaries = [
      '认识线材、线径与家庭用线标准',
      '掌握功率、电流与线径的换算关系',
      '了解空开规格及其保护范围',
      '区分漏保功能与必要安装位置',
      '规划安全、清晰、便于维护的回路',
      '核对强弱电、穿管与接线规范',
      '了解水管、打压和排水施工要点',
      '按项目逐项完成水电验收'
    ];
    container.querySelectorAll(':scope > .card').forEach((card, index) => {
      const header = card.querySelector(':scope > .card-header');
      const heading = header && header.querySelector('h3');
      if (!header || !heading || header.querySelector('.fresh-knowledge-index')) return;
      const badge = document.createElement('span');
      badge.className = 'fresh-knowledge-index';
      badge.textContent = String(index + 1).padStart(2, '0');
      const copy = document.createElement('span');
      copy.className = 'fresh-knowledge-copy';
      heading.insertAdjacentElement('beforebegin', copy);
      copy.appendChild(heading);
      const summary = document.createElement('small');
      summary.textContent = summaries[index] || '查看装修知识与施工注意事项';
      copy.appendChild(summary);
      header.insertBefore(badge, copy);
    });
  }

  function patchComparePage() {
    if (page !== '比价清单.html') return;
    const importHead = document.querySelector('.import-head h3');
    if (importHead) importHead.textContent = '待导入商品';
    const importDesc = document.querySelector('.import-head p');
    if (importDesc) importDesc.textContent = '可通过配套导入工具整理淘宝、京东商品信息。';
    rootQueryAll('.del-btn').forEach((el) => el.setAttribute('title', '删除'));
  }

  function patchFlowPage() {
    if (page !== '装修流程.html') return;
    setText('.aside-title', '流程阶段');
  }

  function patchCommonTitles() {
    const meta = pageMeta[page];
    if (meta && meta.title) document.title = meta.title;
  }

  function rootQueryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function removePrototypeCopy(root) {
    const phrases = ['测试数据', '视觉稿', '模拟评分'];
    root.querySelectorAll('p, span, small, div').forEach((el) => {
      if (el.children.length) return;
      const text = (el.textContent || '').trim();
      if (phrases.some((phrase) => text.includes(phrase))) el.remove();
    });
  }

  function refresh(root) {
    normalizeActionIcons(root);
    cleanText(root);
    normalizeIcons(root);
    removePrototypeCopy(root);
    enhanceComparePage(root);
    patchCommonTitles();
    patchHomePage();
    patchBillPage();
    patchPurchasePage();
    patchToolsPage();
    patchDiaryPage();
    patchKnowledgePage();
    patchComparePage();
    patchFlowPage();
  }

  function loadCloudSync() {
    /* 复刻版是纯静态站点，不加载云同步脚本（需要接回后端时设置 window.__XZ_STATIC__ = false） */
    if (window.__XZ_STATIC__ !== false) return;
    if (document.querySelector('script[data-cloud-sync]')) return;
    const script = document.createElement('script');
    script.src = 'cloud-sync.js?v=20260802-enterprise-entry-v2';
    script.dataset.cloudSync = 'true';
    document.head.appendChild(script);
  }

  function loadPlatformEntry() {
    if (document.querySelector('script[data-platform-entry]')) return;
    const script = document.createElement('script');
    script.src = 'platform-entry.js?v=20260801-mobile-reminder-v1';
    script.dataset.platformEntry = 'true';
    document.head.appendChild(script);
  }

  function revealFreshShell() {
    document.documentElement.classList.remove('fresh-shell-booting');
    if (document.body) document.body.classList.add('fresh-shell-ready');
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      buildShell();
      refresh(document.body);
      enhanceA11y();
      loadCloudSync();
      loadPlatformEntry();
      if (page === '主页.html') {
        window.addEventListener('storage', scheduleEnterpriseHomeUpdate);
        window.addEventListener('cloud-sync-status', scheduleEnterpriseHomeUpdate);
        setTimeout(scheduleEnterpriseHomeUpdate, 350);
        setTimeout(scheduleEnterpriseHomeUpdate, 1100);
      }
      if (page === '采购清单.html') return;
      const observer = new MutationObserver((records) => {
        let homeDataChanged = false;
        records.forEach((record) => {
          const target = record.target && record.target.nodeType === 1 ? record.target : null;
          if (page === '主页.html' && !(target && target.closest('#enterpriseHomeDashboard'))) homeDataChanged = true;
          record.addedNodes.forEach((node) => {
            if (node.nodeType === 1) refresh(node);
          });
        });
        if (homeDataChanged) scheduleEnterpriseHomeUpdate();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } finally {
      requestAnimationFrame(revealFreshShell);
    }
  });
})();
