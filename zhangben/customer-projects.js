(() => {
  'use strict';
  const state = { projects: [], activeId: '', detail: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let toastTimer;
  let detailRequestVersion = 0;
  const pendingResponses = new Set();

  /* ---------- 静态演示数据层 ---------- */
  const STATIC = window.__XZ_STATIC__ !== false;
  const STORE_KEY = 'xzreplica.customerProjects';
  const photo = (caption) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">' +
    '<rect width="640" height="480" fill="#F2F1EC"/>' +
    '<g fill="none" stroke="#B9B4A6" stroke-width="7" stroke-linecap="round">' +
    '<path d="M212 200h44l14-20h74l14 20h60a12 12 0 0 1 12 12v92a12 12 0 0 1-12 12H212a12 12 0 0 1-12-12v-92a12 12 0 0 1 12-12z"/>' +
    '<circle cx="320" cy="272" r="36"/></g>' +
    '<text x="320" y="392" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="22" fill="#9A9486">' + caption + '</text>' +
    '</svg>');

  function demoSeed() {
    const now = Date.now();
    const iso = (offset) => new Date(now - offset).toISOString();
    return {
      projects: [
        {
          id: 'cp-sunshine', organizationId: 'org-zhuchao', organizationName: '筑巢设计工作室',
          name: '阳光里 3-2-1201 · 全包', location: '杭州 · 西湖区', stage: '瓦工阶段',
          progress: 42, plannedProgress: 45, nextAction: '卫生间闭水试验',
          canRespond: true, unreadCount: 2,
          updates: [
            {
              id: 'u-1', stage: '瓦工阶段', progress: 42, publishedAt: iso(2 * 3600000),
              summary: '客厅地砖已完成铺贴，卫生间正在做闭水试验，预计明天下午可验收。请确认现场是否还有需要调整的地方。',
              media: [
                { url: photo('客厅地砖铺贴') },
                { url: photo('卫生间闭水试验') },
                { url: photo('厨房墙砖铺贴') }
              ]
            },
            {
              id: 'u-2', stage: '水电阶段', progress: 30, publishedAt: iso(3 * 86400000),
              summary: '水电管线已全部排布完成并拍照留档，打压测试合格。',
              media: [
                { url: photo('水电管线排布') },
                { url: photo('水管打压测试') }
              ]
            }
          ],
          latestResponse: null
        },
        {
          id: 'cp-mulan', organizationId: 'org-mulan', organizationName: '木兰全案装饰',
          name: '滨江壹号 8-1-602 · 半包', location: '杭州 · 滨江区', stage: '油漆阶段',
          progress: 68, plannedProgress: 70, nextAction: '墙面第二遍腻子',
          canRespond: true, unreadCount: 0,
          updates: [
            {
              id: 'u-3', stage: '油漆阶段', progress: 68, publishedAt: iso(86400000),
              summary: '第一遍腻子已批完，墙面平整度检查通过，明天开始第二遍。',
              media: [
                { url: photo('墙面批腻子') }
              ]
            }
          ],
          latestResponse: null
        }
      ]
    };
  }

  function readDemo() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects)) return parsed;
      }
    } catch (_error) { /* 本地数据损坏时回退到示例 */ }
    const seeded = demoSeed();
    writeDemo(seeded);
    return seeded;
  }

  function writeDemo(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_error) { /* 隐私模式下忽略 */ }
  }

  const stripProject = (project) => {
    const copy = Object.assign({}, project);
    delete copy.updates;
    delete copy.latestResponse;
    return copy;
  };

  async function staticApi(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const data = readDemo();
    if (path === '/api/customer-projects' && method === 'GET') {
      return {
        projects: data.projects.map((item) => Object.assign(stripProject(item), {
          latestUpdate: item.updates && item.updates[0] ? { publishedAt: item.updates[0].publishedAt } : null
        }))
      };
    }
    if (path === '/api/customer-projects/claim' && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const code = shareCode(body.shareCode);
      const project = {
        id: 'cp-' + Date.now(), organizationId: 'org-demo', organizationName: '示例装修公司（演示）',
        name: '演示项目 · ' + (code || '未命名'), location: '本地演示', stage: '开工准备',
        progress: 5, plannedProgress: 8, nextAction: '确认开工交底', canRespond: true, unreadCount: 1,
        updates: [{
          id: 'u-' + Date.now(), stage: '开工准备', progress: 5, publishedAt: new Date().toISOString(),
          summary: '项目已绑定成功。正式版中，装修公司审核发布进度后，施工提醒与现场照片会同步显示在这里。',
          media: []
        }],
        latestResponse: null
      };
      data.projects.unshift(project);
      writeDemo(data);
      return { project: { id: project.id } };
    }
    const matched = path.match(/^\/api\/customer-projects\/([^/]+)(\/responses)?$/);
    if (matched && !matched[2] && method === 'GET') {
      const project = data.projects.find((item) => item.id === decodeURIComponent(matched[1]));
      if (!project) throw new Error('未找到该装修公司项目');
      return { project: stripProject(project), updates: project.updates || [], latestResponse: project.latestResponse || null };
    }
    if (matched && matched[2] && method === 'POST') {
      const project = data.projects.find((item) => item.id === decodeURIComponent(matched[1]));
      if (!project) throw new Error('未找到该装修公司项目');
      const body = JSON.parse(options.body || '{}');
      project.latestResponse = { responseType: body.action, content: body.content || '', createdAt: new Date().toISOString() };
      project.unreadCount = 0;
      writeDemo(data);
      return { ok: true };
    }
    throw new Error('本地演示模式暂不支持该操作');
  }

  async function api(path, options = {}) {
    if (STATIC) return staticApi(path, options);
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } });
    if (response.status === 401) {
      location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      throw new Error('请先登录');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `操作失败（${response.status}）`);
    return payload;
  }

  function updateResponseControls() {
    const busy = pendingResponses.has(state.activeId);
    document.querySelectorAll('[data-response]').forEach((button) => {
      button.disabled = busy || state.detail?.project.canRespond === false;
    });
    const input = $('#customerResponseContent');
    if (input) input.disabled = busy;
  }

  function toast(message, error = false) {
    const node = $('#customerToast');
    node.textContent = message;
    node.className = `customer-toast show${error ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.className = 'customer-toast'; }, 3200);
  }

  function formatDate(value) {
    if (!value) return '尚未更新';
    return new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
  }

  function renderList() {
    const companyCount = new Set(state.projects.map((item) => item.organizationId).filter(Boolean)).size;
    const layout = $('.customer-layout');
    const detailPanel = $('#customerDetail');
    if (layout) layout.classList.toggle('is-empty', state.projects.length === 0);
    if (detailPanel) detailPanel.hidden = state.projects.length === 0;
    $('#projectCount').textContent = `${companyCount} 家 · ${state.projects.length} 个项目`;
    $('#unreadTotal').textContent = state.projects.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
    $('#customerProjectList').innerHTML = state.projects.length ? state.projects.map((item) => `
      <button class="customer-project-item ${item.id === state.activeId ? 'active' : ''}" data-project-id="${esc(item.id)}">
        <div class="customer-project-item-head"><h3>${esc(item.organizationName)}</h3>${item.unreadCount ? `<span class="unread-badge">${item.unreadCount}</span>` : ''}</div>
        <p>${esc(item.name)} · ${esc(item.stage || '待更新')}</p>
        <div class="mini-progress"><i style="width:${Math.max(1, Number(item.progress || 0))}%"></i></div>
        <p>当前 ${Number(item.progress || 0)}%${item.latestUpdate ? ` · ${formatDate(item.latestUpdate.publishedAt)}` : ' · 暂无已发布动态'}</p>
      </button>`).join('') : '<div class="customer-empty"><b>暂无已绑定装修公司</b><span>请让装修公司绑定你的用户名/邮箱，或在上方粘贴客户链接。</span></div>';
  }

  function renderDetail() {
    const payload = state.detail;
    if (!payload) return;
    const project = payload.project;
    const latest = payload.updates[0];
    $('#customerDetail').innerHTML = `
      <div class="customer-detail-head">
        <div class="customer-detail-title"><div><h2>${esc(project.organizationName)}</h2><p>${esc(project.name)}${project.location ? ` · ${esc(project.location)}` : ''}</p></div><span class="customer-stage">${esc(project.stage || '待更新')}</span></div>
        <div class="customer-metrics"><div class="customer-metric"><span>当前进度</span><b>${project.progress}%</b></div><div class="customer-metric"><span>计划进度</span><b>${project.plannedProgress}%</b></div><div class="customer-metric"><span>下一步</span><b>${esc(project.nextAction || '待安排')}</b></div></div>
      </div>
      <div class="customer-updates">
        ${payload.updates.length ? payload.updates.map((item, index) => `
          <article class="customer-update">
            <div class="customer-update-head"><b>${esc(item.stage || '施工动态')} · ${Number(item.progress || 0)}%</b><time>${formatDate(item.publishedAt)}</time></div>
            <p>${esc(item.summary || '装修公司未填写本次说明')}</p>
            ${item.media.length ? `<div class="customer-photos">${item.media.map((media) => `<img src="${esc(media.url)}" alt="${esc(project.name)}现场照片" loading="lazy">`).join('')}</div>` : ''}
            ${index === 0 ? `<div class="customer-response"><h3>对本次提醒进行确认</h3><p>你的确认、修改意见和留言会回到装修公司的企业端待办。</p><textarea id="customerResponseContent" maxlength="1000" placeholder="提出修改或留言时请填写具体内容"></textarea><div class="customer-response-actions"><button data-response="confirm" data-publication-id="${esc(item.id)}">确认本次进度</button><button class="adjust" data-response="adjust" data-publication-id="${esc(item.id)}">需要调整</button><button class="secondary" data-response="comment" data-publication-id="${esc(item.id)}">留言</button></div>${payload.latestResponse ? `<div class="response-state">最近反馈：${{confirm:'已确认',adjust:'需要调整',comment:'已留言'}[payload.latestResponse.responseType] || '已提交'} · ${formatDate(payload.latestResponse.createdAt)}</div>` : ''}</div>` : ''}
          </article>`).join('') : '<div class="customer-empty"><b>暂无施工提醒</b><span>装修公司审核发布后会同步到这里。</span></div>'}
      </div>`;
    if (!latest || !project.canRespond) {
      const response = $('.customer-response');
      if (response && !project.canRespond) response.insertAdjacentHTML('beforeend', '<div class="response-state">当前项目为只读或已归档，暂不能提交新反馈。</div>');
    }
    updateResponseControls();
  }

  async function loadProjects(preferredId = '') {
    const payload = await api('/api/customer-projects');
    state.projects = payload.projects || [];
    state.activeId = preferredId || state.activeId || state.projects[0]?.id || '';
    renderList();
    if (state.activeId) await loadDetail(state.activeId);
    else state.detail = null;
  }

  async function loadDetail(projectId, options = {}) {
    const preserve = options.preserve && state.activeId === projectId && state.detail;
    const requestVersion = ++detailRequestVersion;
    state.activeId = projectId;
    if (!preserve) state.detail = null;
    renderList();
    if (!preserve) $('#customerDetail').innerHTML = '<div class="customer-empty large">正在读取装修公司提醒…</div>';
    let detail;
    try {
      detail = await api(`/api/customer-projects/${projectId}`);
    } catch (error) {
      if (requestVersion === detailRequestVersion) throw error;
      return;
    }
    if (requestVersion !== detailRequestVersion || state.activeId !== projectId) return;
    state.detail = detail;
    const listProject = state.projects.find((item) => item.id === projectId);
    if (listProject) listProject.unreadCount = 0;
    if (STATIC) {
      const saved = readDemo();
      const target = saved.projects.find((item) => item.id === projectId);
      if (target && target.unreadCount) { target.unreadCount = 0; writeDemo(saved); }
    }
    renderList();
    renderDetail();
  }

  function shareCode(value) {
    const raw = String(value || '').trim();
    try { return new URL(raw).searchParams.get('share') || new URL(raw).searchParams.get('claim') || raw; } catch (_error) { return raw; }
  }

  async function claimProject(rawCode) {
    const code = shareCode(rawCode);
    if (!code) return toast('请先粘贴装修公司邀请链接或分享码', true);
    const button = $('#claimForm button');
    if (button) button.disabled = true;
    try {
      const payload = await api('/api/customer-projects/claim', { method:'POST', body:JSON.stringify({ shareCode: code }) });
      $('#claimCode').value = '';
      toast('项目已绑定，网页和微信小程序都会同步显示');
      await loadProjects(payload.project.id);
    } catch (error) {
      toast(error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('click', async (event) => {
    const projectButton = event.target.closest('[data-project-id]');
    if (projectButton) {
      try { await loadDetail(projectButton.dataset.projectId); } catch (error) { toast(error.message, true); }
      return;
    }
    const responseButton = event.target.closest('[data-response]');
    if (!responseButton) return;
    const projectId = state.activeId;
    const requestVersion = detailRequestVersion;
    if (pendingResponses.has(projectId) || !state.detail || state.detail.project.canRespond === false) return;
    const action = responseButton.dataset.response;
    const content = $('#customerResponseContent')?.value.trim() || '';
    if ((action === 'adjust' || action === 'comment') && !content) return toast('请先填写具体内容', true);
    pendingResponses.add(projectId);
    updateResponseControls();
    let submitted = false;
    try {
      await api(`/api/customer-projects/${projectId}/responses`, { method:'POST', body:JSON.stringify({ action, publicationId: responseButton.dataset.publicationId, customerName:'', content }) });
      submitted = true;
      if (state.activeId === projectId && requestVersion === detailRequestVersion) {
        $('#customerResponseContent').value = '';
        toast(action === 'confirm' ? '本次进度已确认' : '反馈已提交给项目负责人');
        await loadDetail(projectId, { preserve: true });
      }
    } catch (error) {
      if (state.activeId === projectId && (submitted || requestVersion === detailRequestVersion)) {
        toast(submitted ? `反馈已提交，但提醒刷新失败，请稍后重新打开项目；不要重复提交。${error.message}` : error.message, true);
      }
    } finally {
      pendingResponses.delete(projectId);
      updateResponseControls();
    }
  });

  $('#claimForm').addEventListener('submit', (event) => {
    event.preventDefault();
    claimProject($('#claimCode').value);
  });

  const inviteCode = new URLSearchParams(location.search).get('claim');
  loadProjects().then(() => {
    if (inviteCode) {
      $('#claimCode').value = inviteCode;
      return claimProject(inviteCode);
    }
    return null;
  }).catch((error) => {
    $('#customerProjectList').innerHTML = `<div class="customer-empty"><b>读取失败</b><span>${esc(error.message)}</span></div>`;
    toast(error.message, true);
  });
})();
