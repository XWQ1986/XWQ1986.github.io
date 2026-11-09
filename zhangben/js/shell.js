/* ============================================================
   装修小账本风格复刻 —— 内部功能页共享脚本
   提供：顶部导航渲染、SVG 图标、Toast、本地演示数据仓库
   全部为自主编写的原创实现，数据仅保存在浏览器 localStorage
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 自绘线性图标（24 视图框） ---------- */
  var ICONS = {
    home:   '<path d="M4.5 11.5 12 5l7.5 6.5"/><path d="M6.5 10.5V20h4v-5h3v5h4v-9.5"/>',
    cart:   '<path d="M6.6 7.4h12.2l-1.4 7H8.7L7.5 4.8H5"/><circle cx="10" cy="18.7" r=".9"/><circle cx="16.8" cy="18.7" r=".9"/>',
    chart:  '<path d="M4 19V5"/><path d="M8 17v-6M13 17V7M18 17v-3"/><path d="M3 19h18"/>',
    wallet: '<rect x="4" y="6.5" width="16" height="13" rx="2"/><path d="M4 9.5A2.5 2.5 0 0 1 6.5 7H18"/><path d="M15.5 13.5H20"/>',
    tool:   '<path d="M14.9 6.2a4.2 4.2 0 0 0-5.2 5.2l-4.9 4.9a1.9 1.9 0 0 0 2.7 2.7l4.9-4.9a4.2 4.2 0 0 0 5.2-5.2l-3 3-2.7-2.7z"/>',
    list:   '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    check:  '<path d="M6.5 12.4 10.2 16 17.8 8.2"/>',
    clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert:  '<path d="M12 4.8 20 19H4z"/><path d="M12 10v4M12 17h.01"/>',
    leaf:   '<path d="M5 19c8 0 13-5 14-14-8 1-14 6-14 14z"/><path d="M5 19c3-5 7-8 12-10"/>',
    file:   '<path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M14 4.8V9h4.2M9 13h6M9 16.5h4"/>',
    user:   '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    trash:  '<path d="M5 7h14M9 7V5h6v2M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    edit:   '<path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="m13 7 4 4"/>',
    star:   '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/>',
    book:   '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16H6.5A1.5 1.5 0 0 0 5 20.5z"/><path d="M5 19V4.5M9 7.5h6"/>',
    calc:   '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    ruler:  '<rect x="3" y="9" width="18" height="6" rx="1"/><path d="M7 9v3M11 9v3M15 9v3"/>',
    bolt:   '<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
    diary:  '<path d="M6 3.5h12A1.5 1.5 0 0 1 19.5 5v15A1.5 1.5 0 0 1 18 21.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    grid:   '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>',
    hammer: '<path d="m14 5 5 5M12.5 6.5l3-3 5 5-3 3M13 9l-8.5 11.5-2-2L15 7"/>',
    paint:  '<path d="M4 5h12v6H4zM8 11v3h5v7M13 21h3"/>',
    sofa:   '<path d="M6 12V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4M4 11a2 2 0 0 0-2 2v5h20v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-2-2z"/>',
    tag:    '<path d="m4 4 7-.5L20.5 13a1.8 1.8 0 0 1 0 2.6l-4.9 4.9a1.8 1.8 0 0 1-2.6 0L3.5 11z"/><circle cx="8.5" cy="8.5" r="1"/>',
    money:  '<circle cx="12" cy="12" r="9"/><path d="M8.5 9.5 12 13l3.5-3.5M12 13v5M9 15h6"/>',
    close:  '<path d="M6 6l12 12M18 6 6 18"/>',
    video:  '<path d="M5.5 7.5h9A2.5 2.5 0 0 1 17 10v4a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 14v-4a2.5 2.5 0 0 1 2.5-2.5z"/><path d="m17 11 4-2.5v7L17 13"/>'
  };

  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      (ICONS[name] || ICONS.home) + '</svg>';
  }

  /* ---------- 左侧边栏 + 顶部条 ---------- */
  var NAV_GROUPS = [
    { label: '我的装修', items: [
      { key: 'home',    href: 'home.html',        label: '今日总览', icon: 'home'   },
      { key: 'process', href: 'process.html',     label: '装修流程', icon: 'list'   },
      { key: 'buy',     href: 'procurement.html', label: '采购清单', icon: 'cart'   },
      { key: 'ledger',  href: 'materials.html',   label: '装修记账', icon: 'wallet' },
      { key: 'compare', href: 'compare.html',     label: '比价选品', icon: 'chart'  }
    ]},
    { label: '辅助工具', items: [
      { key: 'tools',   href: 'tools.html',       label: '实用工具', icon: 'tool'   },
      { key: 'diary',   href: 'diary.html',       label: '装修日记', icon: 'diary'  },
      { key: 'water',   href: 'shuidian.html',    label: '水电知识', icon: 'bolt'   },
      { key: 'env',     href: 'static-env.html',  label: '演示说明', icon: 'file'   }
    ]}
  ];

  function sessionUser() {
    try {
      var s = sessionStorage.getItem('zhangben_session') || localStorage.getItem('zhangben_session');
      if (s) return JSON.parse(s).user || '';
    } catch (e) {}
    return '';
  }

  /* 顶部条显示昵称，不直接暴露登录邮箱 */
  function displayName() {
    var user = sessionUser();
    if (!user) return '访客';
    try {
      var users = JSON.parse(localStorage.getItem('zhangben_users') || '{}');
      if (users[user] && users[user].nickname) return users[user].nickname;
    } catch (e) {}
    return user === '15668681555@163.com' ? '王建国' :
      (user.indexOf('@') > -1 ? '装修业主' : user);
  }

  function renderNav(active) {
    var sidebar = document.createElement('aside');
    sidebar.className = 'app-sidebar';

    var groupsHtml = NAV_GROUPS.map(function (g) {
      var links = g.items.map(function (it) {
        return '<a class="nav-link' + (it.key === active ? ' active' : '') + '" href="' + it.href + '">' +
          icon(it.icon) + it.label + '</a>';
      }).join('');
      return '<div class="nav-group-label">' + g.label + '</div>' + links;
    }).join('');

    sidebar.innerHTML =
      '<a class="brand" href="home.html"><span class="brand-mark"><img src="assets/yellow/logo.svg" alt=""></span><span>装修小账本</span></a>' +
      groupsHtml +
      '<div class="nav-spacer"></div>' +
      '<div class="nav-bottom">' +
        '<a class="nav-link" href="#" role="button" data-mini-program-entry="true">' + icon('grid') + '微信小程序</a>' +
        '<a class="nav-link' + (active === 'account' ? ' active' : '') + '" href="account.html">' + icon('user') + '账号管理</a>' +
      '</div>';

    var topbar = document.createElement('header');
    topbar.className = 'app-topbar';
    var crumbHtml = active === 'home'
      ? '<span class="dropdown">我的装修</span>'
      : '<span class="dropdown">我的装修</span><span class="sep">/</span><span class="proj">项目资料</span>';
    var accountText = active === 'home' ? '个人账号' : '账号：' + displayName();
    var entHtml = active === 'home' ? '' : '<a class="ent" href="enterprise.html">企业版 · <b>开通</b></a>';
    topbar.innerHTML =
      '<div class="crumbs">' + crumbHtml + '</div>' +
      '<div class="tb-right">' +
        entHtml +
        '<div class="account-wrap">' +
          '<button class="user" type="button" id="accountTrigger" aria-haspopup="menu" aria-expanded="false">' +
            icon('user', 'ic-sm') + accountText +
          '</button>' +
          '<div class="account-menu" id="accountMenu" role="menu" hidden>' +
            '<div class="am-user"><b>' + displayName() + '</b><span>普通用户账号</span></div>' +
            '<section class="douyin-card" aria-label="抖音关注">' +
              '<div class="dc-head"><span class="dc-logo">' + icon('video', 'ic-sm') + '</span>' +
                '<div><b>关注我的抖音</b><span>装修避坑和选品经验</span></div></div>' +
              '<div class="dc-main">' +
                '<div class="dc-qr"><img src="assets/brand/douyin-qr-thumb.png" alt="抖音二维码"></div>' +
                '<div class="dc-copy"><p><b>主包为爱发电</b><span>网站对你有帮助的话<br>抖音点个免费关注吧</span></p><strong>@金大金自装日记</strong></div>' +
              '</div>' +
            '</section>' +
            '<a class="am-link" href="enterprise.html">企业版 · 开通</a>' +
            '<a class="am-link" href="account.html">账号管理</a>' +
            '<button class="am-link danger" type="button" id="logoutBtn">退出登录</button>' +
          '</div>' +
        '</div>' +
        '<span class="search-ic" title="搜索">' + icon('search', 'ic-sm') + '</span>' +
      '</div>';

    document.body.prepend(topbar);
    document.body.prepend(sidebar);

    /* 账号下拉菜单 */
    var trigger = document.getElementById('accountTrigger');
    var menu = document.getElementById('accountMenu');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () {
      if (!menu.hidden) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    document.getElementById('logoutBtn').addEventListener('click', function () {
      localStorage.removeItem('zhangben_session');
      sessionStorage.removeItem('zhangben_session');
      location.href = 'login.html';
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- 弹层键盘可用性：Esc 关闭、Tab 焦点循环、关闭后焦点回归 ---------- */
  var dialogTrigger = null;

  function visibleDialog() {
    /* DOM 中靠后的弹层层级更高（如日记的照片预览），倒序取最上层 */
    var nodes = document.querySelectorAll('[role="dialog"]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (!nodes[i].hasAttribute('hidden') && nodes[i].getClientRects().length) return nodes[i];
    }
    return null;
  }

  function focusablesIn(el) {
    var list = el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(list, function (n) { return n.getClientRects().length > 0; });
  }

  /* ---------- 弹层背景隔离 ----------
     弹层打开时把遮罩后的页面移出无障碍树（aria-hidden）并禁止交互（inert），
     关闭后按原值恢复。弹层自身及其祖先容器始终排除，避免把自己也隔离掉。 */
  var isolated = [];

  function applyDialogIsolation() {
    var dlg = visibleDialog();
    var targets = [];
    if (dlg) {
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === dlg || el.contains(dlg)) return;
        if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) return;
        if (el.id === 'toast') return;
        /* 跳过浏览器/调试工具注入的浮层，避免把外部 UI 一起隔离 */
        var sig = String(el.id || '') + ' ' + String(el.className || '');
        if (/trae|^__|inspect/i.test(sig) || el.querySelector('[class*="trae-browser"]')) return;
        targets.push(el);
      });
    }
    isolated = isolated.filter(function (item) {
      if (targets.indexOf(item.el) > -1) return true;
      if (item.hadInert) item.el.setAttribute('inert', ''); else item.el.removeAttribute('inert');
      if (item.hadAria === null) item.el.removeAttribute('aria-hidden');
      else item.el.setAttribute('aria-hidden', item.hadAria);
      return false;
    });
    targets.forEach(function (el) {
      for (var i = 0; i < isolated.length; i++) if (isolated[i].el === el) return;
      isolated.push({
        el: el,
        hadInert: el.hasAttribute('inert'),
        hadAria: el.hasAttribute('aria-hidden') ? el.getAttribute('aria-hidden') : null
      });
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function restoreFocus() {
    /* 先撤掉背景隔离，否则焦点无法落回刚解除的触发控件 */
    applyDialogIsolation();
    if (!dialogTrigger) return;
    try { dialogTrigger.focus(); } catch (e) {}
  }

  function initDialogKeyboard() {
    /* 记录打开弹层前的触发控件，关闭后归还焦点：优先按点击控件记录，focusin 作为键盘操作的兜底 */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest || t.closest('[role="dialog"]')) return;
      var ctl = t.closest('button,a,[role="button"]');
      if (ctl) dialogTrigger = ctl;
    }, true);

    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[role="dialog"]')) return;
      dialogTrigger = t;
    });

    document.addEventListener('keydown', function (e) {
      var dlg = visibleDialog();
      if (!dlg) return;
      if (e.key === 'Escape') {
        var closer = dlg.querySelector('[data-close]');
        if (closer) {
          e.preventDefault();
          closer.click();
          setTimeout(restoreFocus, 0);
        }
        return;
      }
      if (e.key !== 'Tab') return;
      var items = focusablesIn(dlg);
      if (!items.length) { e.preventDefault(); return; }
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !dlg.contains(document.activeElement)) { e.preventDefault(); last.focus(); }
      } else if (document.activeElement === last || !dlg.contains(document.activeElement)) {
        e.preventDefault(); first.focus();
      }
    });

    /* 显隐变化后同步背景隔离；由 hidden 关闭的弹层再把焦点还给触发按钮 */
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function (records) {
        var closed = false;
        records.forEach(function (r) {
          if (r.attributeName === 'hidden' && r.target.hasAttribute('hidden')) closed = true;
        });
        applyDialogIsolation();
        if (closed && dialogTrigger) setTimeout(restoreFocus, 0);
      });
      document.querySelectorAll('[role="dialog"]').forEach(function (el) {
        observer.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDialogKeyboard);
  } else {
    initDialogKeyboard();
  }

  /* ---------- 演示数据仓库 ---------- */
  var NS = 'xzreplica.';
  var quotaWarnAt = 0;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(NS + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  /* 本机快照：保留最近 3 次写入前的版本，供误操作/清空后回滚 */
  var SNAP_KEY = 'snapshots';
  var SNAP_MAX = 3;
  var SNAP_SKIP = { lastBackupAt: 1, dataMode: 1, dataModeAck: 1, seeded: 1, snapshots: 1 };
  var snapAt = {};

  function pushSnapshot(key, prevRaw) {
    try {
      if (SNAP_SKIP[key]) return;
      if (prevRaw && prevRaw.length > 300000) return;
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(NS + SNAP_KEY) || '[]') || []; } catch (e2) { arr = []; }
      arr = arr.filter(function (it) { return it && it.key !== key; });
      arr.unshift({ at: Date.now(), key: key, value: prevRaw });
      localStorage.setItem(NS + SNAP_KEY, JSON.stringify(arr.slice(0, SNAP_MAX)));
    } catch (e3) { /* 快照失败不影响业务写入 */ }
  }

  function write(key, value) {
    var raw;
    try { raw = JSON.stringify(value); } catch (e0) { raw = String(value); }
    try {
      var prev = localStorage.getItem(NS + key);
      localStorage.setItem(NS + key, raw);
      if (prev !== raw && Date.now() - (snapAt[key] || 0) > 10000) {
        snapAt[key] = Date.now();
        pushSnapshot(key, prev);
      }
      return true;
    } catch (e) {
      /* 配额已满或隐私模式：延后提示，避免被调用方紧接着的成功提示覆盖；4 秒节流，避免连续输入时刷屏 */
      var now = Date.now();
      if (now - quotaWarnAt > 4000) {
        quotaWarnAt = now;
        setTimeout(function () {
          if (typeof toast === 'function') toast('保存失败：本机存储空间不足，请清理浏览器数据后重试');
        }, 0);
      }
      return false;
    }
  }
  function listSnapshots() {
    try {
      var arr = JSON.parse(localStorage.getItem(NS + SNAP_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(function (it) { return it && it.key; }) : [];
    } catch (e) { return []; }
  }

  function restoreSnapshot(index) {
    var arr = listSnapshots();
    var i = typeof index === 'number' ? index : 0;
    var item = arr[i];
    if (!item) return null;
    try {
      if (item.value === null) localStorage.removeItem(NS + item.key);
      else localStorage.setItem(NS + item.key, item.value);
    } catch (e) { return null; }
    try {
      arr.splice(i, 1);
      localStorage.setItem(NS + SNAP_KEY, JSON.stringify(arr));
    } catch (e) {}
    return item;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* 装修阶段（各页面共用的演示分类） */
  var STAGES = [
    { key: 'prepare',    name: '设计与开工准备', icon: 'file'   },
    { key: 'demolition', name: '墙体拆改', icon: 'hammer' },
    { key: 'water',      name: '水电阶段', icon: 'bolt'   },
    { key: 'masonry',    name: '瓦工阶段', icon: 'grid'   },
    { key: 'wood',       name: '木工阶段', icon: 'ruler'  },
    { key: 'paint',      name: '油漆阶段', icon: 'paint'  },
    { key: 'install',    name: '安装阶段', icon: 'tool'   },
    { key: 'soft',       name: '软装入住', icon: 'sofa'   }
  ];

  /* 装修流程（与原版一致的 22 个节点） */
  var FLOW_STEPS = [
    { t: '设计与开工准备', short: '设计', stage: 'prepare',
      d: '图纸、材料清单、报价单逐项核对，办理物业装修手续，确认施工时间与垃圾清运。',
      tip: '口头承诺写进合同，警惕低价签约后频繁增项。' },
    { t: '墙体拆改', short: '拆改', stage: 'demolition',
      d: '对照图纸标记承重墙，先断电断水再施工，拆除垃圾及时清运。',
      tip: '不确定是否为承重墙时，找物业要结构图。' },
    { t: '新建墙体', short: '砌墙', stage: 'demolition',
      d: '新砌墙体挂钢丝网，新旧墙交接处加固，防止后期开裂。',
      tip: '砌墙后检查垂直度与平整度，尺寸符合图纸。' },
    { t: '门窗封装施工', short: '门窗', stage: 'demolition',
      d: '封窗、窗台石与门窗框安装，打发泡胶并做防水收口。',
      tip: '封窗前确认型材、玻璃与合同约定一致。' },
    { t: '水电改造', short: '水电', stage: 'water',
      d: '水电定位交底后开槽布管，横平竖直，强弱电分管间距 30cm 以上。',
      tip: '定位后拍照留档，后期打孔安装会用到。' },
    { t: '管道隔音施工', short: '管道', stage: 'water',
      d: '下水管包隔音棉，砌砖或包管封闭，检修口要留好。',
      tip: '夜间排水噪音大，隔音棉别省。' },
    { t: '防水施工', short: '防水', stage: 'masonry',
      d: '墙面刚性地面柔性，淋浴区刷到 1.8m，闭水 48 小时。',
      tip: '闭水不合格坚决不贴砖，返工成本最低的时候就是现在。' },
    { t: '墙地砖铺贴', short: '贴砖', stage: 'masonry',
      d: '先墙后地，空鼓率单片不超过 5%，按设计留好缝宽。',
      tip: '铺贴前核对瓷砖色号与批次，避免色差。' },
    { t: '瓷砖美缝', short: '美缝', stage: 'masonry',
      d: '瓷砖干透后清缝、打胶、压缝，24 小时内避免沾水。',
      tip: '美缝颜色先在不显眼处试色。' },
    { t: '成品保护', short: '保护', stage: 'masonry',
      d: '电梯、楼道、入户门、已铺地砖贴膜保护。',
      tip: '保护做在前面，返工最贵。' },
    { t: '木工吊顶', short: '吊顶', stage: 'wood',
      d: '龙骨间距、吊杆牢固度符合规范，石膏板接缝留 V 型槽。',
      tip: '转角用整板 L 型切割，减少开裂。' },
    { t: '墙面基层处理', short: '基层', stage: 'paint',
      d: '刷界面剂，石膏找平，贴网格布防裂。',
      tip: '腻子没干透就打磨上漆，后期必开裂。' },
    { t: '墙面涂饰', short: '涂饰', stage: 'paint',
      d: '抗碱底漆一遍，面漆两遍，第一遍干透后再刷第二遍。',
      tip: '留一桶同批次面漆，后期补漆用。' },
    { t: '室内门安装', short: '木门', stage: 'install',
      d: '先装门套再装门扇，留好与地面的缝隙。',
      tip: '门吸、合页五金当场试开合。' },
    { t: '厨房电器安装', short: '厨电', stage: 'install',
      d: '烟机、灶具、洗碗机按图纸定位安装，通电通气测试。',
      tip: '橱柜开孔尺寸提前和电器确认。' },
    { t: '全屋定制安装', short: '定制', stage: 'install',
      d: '柜体进场安装，检查门板缝隙均匀、五金顺畅。',
      tip: '安装后保留板材色号与五金清单。' },
    { t: '踢脚线安装', short: '踢脚线', stage: 'install',
      d: '踢脚线与墙面贴合，阴阳角收口顺直。',
      tip: '踢脚线颜色跟门套或地面走更稳。' },
    { t: '灯具及开关安装', short: '灯具', stage: 'install',
      d: '对照水电图安装灯具、开关插座，逐个通电测试。',
      tip: '大功率电器单独回路，取暖设备别共用插座。' },
    { t: '卫浴洁具安装', short: '洁具', stage: 'install',
      d: '马桶、花洒、浴室柜安装，打胶收口并试水。',
      tip: '马桶坑距、角阀位置提前量好。' },
    { t: '开荒保洁', short: '保洁', stage: 'soft',
      d: '先粗保洁再精细保洁，玻璃、瓷砖、柜体重点处理。',
      tip: '保洁前确认所有安装与验收都已完成。' },
    { t: '窗帘安装', short: '窗帘', stage: 'soft',
      d: '窗帘杆或轨道安装，窗帘、床品等软装进场。',
      tip: '窗帘尺寸按轨道实际长度计算。' },
    { t: '家具软装进场', short: '软装', stage: 'soft',
      d: '家具家电进场摆放，通风 3 个月以上，检测合格再入住。',
      tip: '除醛没有捷径，通风是最有效的方法。' }
  ];

  /* ---------- 首屏数据模式：demo（示例数据）/ blank（空白开始） ---------- */
  function dataMode() { return read('dataMode', 'demo'); }

  function clearAll() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(NS) === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  /* 预算分类（结构固定，示例数据与空白项目共用） */
  var BUDGET_GROUPS = [
    { key: 'hard',   name: '硬装工程', budget: 90000, color: '#5c7fa8' },
    { key: 'main',   name: '主材选购', budget: 60000, color: '#5f9f77' },
    { key: 'device', name: '设备系统', budget: 25000, color: '#d69a78' },
    { key: 'soft',   name: '软装家电', budget: 20000, color: '#be7b2f' },
    { key: 'other',  name: '服务杂项', budget: 5000,  color: '#8a8077' }
  ];

  /* 首次访问时写入一份演示数据，让各页面有内容可看 */
  function seed() {
    if (read('seeded')) return;
    if (dataMode() === 'blank') { write('seeded', true); return; }

    write('budget', {
      total: 200000,
      groups: BUDGET_GROUPS.map(function (g) {
        return { key: g.key, name: g.name, budget: g.budget, color: g.color };
      })
    });

    write('bills', [
      { id: uid(), cat: 'hard',   sub: '合同款',   amount: 30000, status: 'paid',    date: offset(-12), note: '装修公司首期款' },
      { id: uid(), cat: 'hard',   sub: '水电材料', amount: 8600,  status: 'paid',    date: offset(-6),  note: '电线水管一批' },
      { id: uid(), cat: 'main',   sub: '瓷砖',     amount: 12800, status: 'pending', date: offset(-2),  note: '客厅地砖定金' },
      { id: uid(), cat: 'device', sub: '空调',     amount: 6999,  status: 'paid',    date: offset(-1),  note: '风管机预定' }
    ]);

    write('todos', [
      { id: uid(), text: '水电定位确认', stage: 'water',  done: false, priority: true,  due: offset(1)  },
      { id: uid(), text: '预约瓷砖送货', stage: 'masonry', done: false, priority: false, due: offset(4)  },
      { id: uid(), text: '核对拆改增项单', stage: 'demolition', done: true, priority: false, due: offset(-2) }
    ]);

    write('buylist', [
      { id: uid(), name: '浴室柜', spec: '80cm 悬挂式', qty: 1, stage: 'install', bought: false },
      { id: uid(), name: '开关插座', spec: '五孔 10A', qty: 46, stage: 'water', bought: false },
      { id: uid(), name: '乳胶漆', spec: '面漆 18L', qty: 3, stage: 'paint', bought: true }
    ]);

    write('diary', [
      { id: uid(), title: '水电开槽完成', date: offset(-3), stage: '水电阶段',
        content: '今天师傅把全屋水电槽开好了，强弱电分管走线，间距保持 30cm。晚上核对了一遍点位图，厨房少了一个插座，明天让师傅补上。' }
    ]);

    write('flowSteps', FLOW_STEPS.map(function (s, i) { return i < 4; }));

    write('dataMode', 'demo');
    write('seeded', true);
  }

  /* 清空示例数据，改为空白项目（保留预算分类结构） */
  function resetBlank() {
    clearAll();
    write('budget', {
      total: 0,
      groups: BUDGET_GROUPS.map(function (g) {
        return { key: g.key, name: g.name, budget: 0, color: g.color };
      })
    });
    write('bills', []);
    write('todos', []);
    write('buylist', []);
    write('diary', []);
    write('dataMode', 'blank');
    write('seeded', true);
  }

  /* 重新填充示例数据（会覆盖当前数据） */
  function resetDemo() {
    clearAll();
    write('dataMode', 'demo');
    seed();
  }

  function offset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- 格式化 ---------- */
  function money(n) {
    var v = Number(n) || 0;
    return (v < 0 ? '-' : '') + '¥' + Math.abs(v).toLocaleString('zh-CN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function today() { return offset(0); }

  /* ---------- 账单统计 ---------- */
  function ledgerTotals(bills) {
    var spent = 0, pending = 0, refund = 0;
    (bills || []).forEach(function (b) {
      var amt = Math.abs(Number(b.amount) || 0);
      if (b.status === 'refund') refund += amt;
      else if (b.status === 'pending') { pending += amt; spent += amt; }
      else spent += amt;
    });
    return { spent: spent, pending: pending, refund: refund };
  }

  /* ---------- 流程进度（22 节点，兼容旧版 8 阶段数据） ---------- */
  function readFlow() {
    var arr = read('flowSteps', null);
    if (!Array.isArray(arr) || arr.length !== FLOW_STEPS.length) {
      arr = migrateFlow();
      write('flowSteps', arr);
    }
    return arr.map(function (v) { return !!v; });
  }

  function writeFlow(arr) {
    write('flowSteps', FLOW_STEPS.map(function (s, i) { return !!arr[i]; }));
  }

  function migrateFlow() {
    var old = read('flow', null);
    var result = FLOW_STEPS.map(function () { return false; });
    if (!old || typeof old !== 'object') return result;
    var groups = {};
    FLOW_STEPS.forEach(function (s, i) {
      if (!groups[s.stage]) groups[s.stage] = [];
      groups[s.stage].push(i);
    });
    Object.keys(groups).forEach(function (stage) {
      var checks = Array.isArray(old[stage]) ? old[stage] : [];
      var done = checks.filter(Boolean).length;
      var count = checks.length ? Math.round(done / checks.length * groups[stage].length) : 0;
      for (var k = 0; k < count; k++) result[groups[stage][k]] = true;
    });
    return result;
  }

  function flowSummary() {
    var steps = readFlow();
    var done = steps.filter(Boolean).length;
    var idx = steps.indexOf(false);
    if (idx === -1) idx = FLOW_STEPS.length - 1;
    var current = FLOW_STEPS[idx];
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].key === current.stage) stage = STAGES[i];
    }
    return {
      steps: steps,
      done: done,
      total: FLOW_STEPS.length,
      pct: Math.round(done / FLOW_STEPS.length * 100),
      index: idx,
      current: current,
      stage: stage || STAGES[STAGES.length - 1],
      route: FLOW_STEPS.slice(idx, idx + 3),
      allDone: done === FLOW_STEPS.length
    };
  }

  /* 侧栏“微信小程序”：按需加载 platform-entry.js 后打开小程序引导弹层 */
  document.addEventListener('click', function (e) {
    var entry = e.target && e.target.closest ? e.target.closest('[data-mini-program-entry]') : null;
    if (!entry) return;
    e.preventDefault();
    if (window.XZPlatformEntry) { window.XZPlatformEntry.openMiniProgram(); return; }
    var tag = document.querySelector('script[data-platform-entry]');
    if (!tag) {
      tag = document.createElement('script');
      tag.src = 'platform-entry.js?v=20260801-mobile-reminder-v1';
      tag.dataset.platformEntry = 'true';
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', function () {
      if (window.XZPlatformEntry) window.XZPlatformEntry.openMiniProgram();
    }, { once: true });
  });

  window.shell = {
    icon: icon,
    renderNav: renderNav,
    toast: toast,
    store: {
      read: read, write: write, uid: uid, seed: seed,
      snapshots: listSnapshots, restoreSnapshot: restoreSnapshot,
      dataMode: dataMode, resetBlank: resetBlank, resetDemo: resetDemo
    },
    stages: STAGES,
    flowSteps: FLOW_STEPS,
    flow: { read: readFlow, write: writeFlow, summary: flowSummary },
    displayName: displayName,
    fmt: { money: money, today: today },
    dialog: { restoreFocus: restoreFocus },
    ledgerTotals: ledgerTotals
  };
})();
