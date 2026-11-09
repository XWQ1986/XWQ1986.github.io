(() => {
  'use strict';

  const state = {
    me: null,
    workspaces: [],
    organization: null,
    membership: null,
    role: '',
    members: [],
    archivedProjects: [],
    dashboard: null,
    operations: null,
    activity: null,
    project: null,
    projectDetail: null,
    photoLibrary: null,
    mediaTrash: null,
    siteLogTrash: null,
    unlinkedMedia: null,
    mediaRevision: 0,
    mediaLoadedRevision: -1,
    mediaRequest: 0,
    issueCenter: null,
    clientCenter: null,
    workforce: null,
    constructionPlanPresets: [],
    checklistTemplate: null,
    workforceStartDate: localDateValue(),
    clientShare: null,
    clientBinding: null,
    pendingIssueId: null,
    projectIntent: 'overview',
    projectSection: 'execution',
    projectReturnNav: 'projects',
    activeNav: 'dashboard',
    reportMilestone: null,
    reportLogoPreviewUrl: '',
    reportSettingsLogoPreviewUrl: '',
    projectOrderMode: false,
    projectFocusTargetId: '',
    supplierDirectory: null,
    businessReports: null,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clientSyncFiles = new WeakSet();
  const uploadedFileIds = new WeakMap();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const roleNames = {
    owner: '企业负责人', admin: '企业管理员', finance: '财务', procurement: '采购', quality: '质检',
    designer: '设计师', project_manager: '项目经理', viewer: '只读成员',
  };
  const projectModuleOrder = ['execution', 'finance', 'costs', 'client'];
  const projectModuleLabels = { execution: '施工执行', finance: '合同收款', costs: '成本管理', client: '客户交付' };
  const roleModuleDefaults = {
    owner: projectModuleOrder, admin: projectModuleOrder,
    project_manager: ['execution', 'costs', 'client'],
    finance: ['finance', 'costs'], procurement: ['costs'], quality: ['execution', 'client'],
    designer: ['execution', 'client'], viewer: ['execution', 'client'],
  };
  const statusNames = {
    normal: '正常', attention: '需关注', delayed: '已滞后',
    pending: '待处理', in_progress: '整改中', review: '待复核', closed: '已关闭', canceled: '已撤销',
    completed: '已完成', blocked: '受阻', overdue: '已逾期',
    approved: '内部已通过', published: '已发布给客户', returned: '已退回',
    internal: '仅企业内部', planned: '待采购', ordered: '已下单', in_transit: '运输中',
    arrived: '已到场', accepted: '已验收', unordered: '未下单', measured: '已测量',
    installed: '已安装', other: '例外 / 不适用', confirmed: '已确认', corrected: '已更正',
    voided: '已作废', reversed: '已冲销', draft: '草稿',
  };
  const logStatusNames = { pending: '待审核', approved: '内部已通过', published: '已发布给客户', returned: '已退回' };
  const todoTypeNames = {
    pending_log: '现场审核', issue: '问题整改', milestone: '施工节点',
    progress_delay: '进度风险', client_response: '客户反馈',
    payment_due: '逾期收款', material_delay: '材料延期',
  };
  const todoPriorityNames = { danger: '逾期 / 紧急', attention: '需关注', normal: '常规' };
  const clientDeliveryNames = {
    attention: '有客户意见', waiting_view: '待客户查看', active: '客户已查看',
    shared_link: '链接访问中', unpublished: '尚未发布', unbound: '尚未开通',
  };
  const enterpriseStageOptions = Object.freeze([
    '量房设计', '开工准备', '拆改施工', '水电改造', '水电施工', '防水施工',
    '泥木施工', '瓦工施工', '木工施工', '油漆施工', '安装收尾',
    '竣工验收', '竣工交付', '售后维护',
  ]);
  const customStageValue = '__custom__';
  const defaultWizardNodes = Object.freeze([
    ['开工准备', 2, 2], ['拆改完成', 7, 3], ['水电验收', 12, 4], ['防水验收', 5, 3],
    ['泥木验收', 20, 4], ['油漆验收', 15, 3], ['安装收尾', 10, 4], ['竣工交付', 3, 5],
  ]);
  const defaultWizardPayments = Object.freeze([
    ['开工款', 30, 0], ['水电验收款', 30, 2], ['泥木验收款', 30, 4], ['竣工尾款', 10, 7],
  ]);
  let toastTimer = null;
  let toastHome = null;
  let draggedMilestoneId = null;
  let projectWizardStep = 1;
  let pendingChecklistIssueId = '';
  let projectRequestVersion = 0;

  function showToast(message, error = false) {
    const el = $('#toast');
    toastHome ||= el.parentElement;
    const openDialogs = $$('dialog[open]');
    const activeDialog = openDialogs[openDialogs.length - 1] || null;
    if (activeDialog) activeDialog.appendChild(el);
    else if (toastHome && el.parentElement !== toastHome) toastHome.prepend(el);
    el.textContent = message;
    el.setAttribute('role', error ? 'alert' : 'status');
    el.setAttribute('aria-live', error ? 'assertive' : 'polite');
    el.className = `toast show${error ? ' error' : ''}${activeDialog ? ' in-dialog' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = 'toast';
      if (toastHome && el.parentElement !== toastHome) toastHome.prepend(el);
    }, error ? 5200 : 3400);
  }

  function updateSyncStatus(error = false) {
    const element = $('#syncStatus');
    if (!element) return;
    const now = new Date();
    element.textContent = error
      ? '同步失败，请重试'
      : `已更新 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    element.classList.toggle('error', error);
  }

  async function api(path, options = {}) {
    const { timeoutMs = 20000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const init = { credentials: 'same-origin', cache: 'no-store', ...fetchOptions, signal: fetchOptions.signal || controller.signal };
    init.headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    let response;
    try {
      response = await fetch(path, init);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求超时，保存未完成，请检查网络后重试');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401) {
      location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      throw new Error('请先登录');
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      updateSyncStatus(true);
      throw new Error(payload?.detail || `操作失败（${response.status}）`);
    }
    updateSyncStatus(false);
    if (!['GET', 'HEAD'].includes(String(options.method || 'GET').toUpperCase())
      && /\/(media|site-logs|issues|milestones|unlinked-media|client-share|customer-binding)(\/|$)/.test(path)) {
      state.mediaRevision += 1;
    }
    return payload;
  }

  function setBusy(button, busy, text = '处理中…') {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = text;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function showOnlyState(id) {
    ['loadingState', 'connectionState', 'disabledState', 'setupState', 'enterpriseApp'].forEach((name) => {
      $(`#${name}`).classList.toggle('hidden', name !== id);
    });
    $('#sidebar').classList.toggle('hidden', id !== 'enterpriseApp');
  }

  function isOwner() {
    return state.role === 'owner' || state.role === 'admin';
  }

  function canUseTeamCollaboration() {
    const subscription = state.organization?.subscription || {};
    if (subscription.capabilities && typeof subscription.capabilities.teamCollaboration === 'boolean') {
      return subscription.capabilities.teamCollaboration;
    }
    return subscription.planKey !== 'basic';
  }

  function showTeamPlanUpgrade() {
    const dialog = $('#teamPlanDialog');
    if (dialog && !dialog.open) dialog.showModal();
  }

  function showEnterpriseExpiryPrompt() {
    const preview = state.organization?.subscription?.status === 'preview';
    $('#enterpriseAccessPromptTitle').textContent = preview ? '企业版功能预览' : '企业版已到期';
    $('#enterpriseAccessPromptSummary').textContent = preview ? '普通账号可以查看企业版页面和已有资料。' : '历史项目和资料仍可继续查看。';
    $('#enterpriseAccessPromptAction').textContent = preview ? '当前为只读预览，新增、编辑、上传、审核、邀请和同步功能不可使用。' : '新增、编辑、上传、审核、邀请和同步等写入功能已暂停。';
    $('#enterpriseAccessPromptContact').textContent = preview ? '联系作者开通企业会员后，网页版和小程序会同时恢复完整功能。' : '联系作者续费企业版后，网页版和小程序会同时恢复使用。';
    const dialog = $('#enterpriseExpiryDialog');
    if (dialog && !dialog.open) dialog.showModal();
  }

  function isProjectLead() {
    return Boolean(
      state.membership?.id
      && state.project?.managerMemberId
      && state.membership.id === state.project.managerMemberId
    );
  }

  function canApproveProject() {
    return isOwner() || isProjectLead();
  }

  function canManageFinance() {
    return projectCanWrite() && hasProjectModule('finance')
      && ['finance.plan', 'finance.receive', 'finance.correct'].some((action) => hasActionPermission(action));
  }

  function canUseAction(module, action) {
    return projectCanWrite() && hasProjectModule(module) && hasActionPermission(action);
  }

  function canManageCosts() {
    return projectCanWrite() && hasProjectModule('costs')
      && ['cost.plan', 'cost.confirm', 'cost.correct', 'procurement.manage', 'procurement.pay'].some((action) => hasActionPermission(action));
  }

  function canManageProcurement() {
    return projectCanWrite() && hasProjectModule('costs')
      && ['procurement.manage', 'procurement.pay', 'procurement.correct'].some((action) => hasActionPermission(action));
  }

  function canUseWorkforce() {
    return hasProjectModule('execution') && ['owner', 'admin', 'project_manager'].includes(state.role);
  }

  function canWrite() {
    return state.organization?.accessMode === 'active';
  }

  function projectCanWrite() {
    return canWrite() && state.project?.lifecycleStatus !== 'archived';
  }

  function activeModulePermissions() {
    return state.membership?.modulePermissions || roleModuleDefaults[state.role] || ['execution'];
  }

  function hasActionPermission(action) {
    const configured = state.membership?.actionPermissions;
    if (Array.isArray(configured)) return configured.includes(action);
    if (['owner', 'admin'].includes(state.role)) return true;
    const roleDefaults = {
      project_manager: ['finance.view', 'finance.plan', 'finance.receive', 'cost.view', 'cost.plan', 'procurement.view', 'procurement.manage', 'procurement.pay', 'quality.view', 'quality.manage', 'quality.approve'],
      designer: ['quality.view', 'quality.manage'],
      finance: ['finance.view', 'finance.plan', 'finance.receive', 'finance.correct', 'cost.view', 'cost.plan', 'cost.confirm', 'cost.correct'],
      procurement: ['cost.view', 'procurement.view', 'procurement.manage', 'procurement.pay', 'procurement.correct'],
      quality: ['quality.view', 'quality.manage', 'quality.approve'],
      viewer: ['quality.view'],
    };
    return (roleDefaults[state.role] || []).includes(action);
  }

  function hasProjectModule(module) {
    return activeModulePermissions().includes(module);
  }

  function applyRoleVisibility() {
    const readonly = state.organization?.accessMode === 'readonly';
    $$('.owner-only').forEach((el) => {
      const keepForPrompt = readonly && el.matches('.top-new-project,.mobile-new-project') && isOwner();
      el.classList.toggle('hidden', !isOwner() || (!canWrite() && !keepForPrompt));
      if (keepForPrompt) {
        el.dataset.expiredWrite = 'true';
        el.title = '企业版已到期，点击联系作者续费';
      } else {
        delete el.dataset.expiredWrite;
        el.removeAttribute('title');
      }
    });
    $$('.report-admin-only').forEach((el) => el.classList.toggle('hidden', !['owner', 'admin'].includes(state.role) || !canWrite()));
    $$('.workforce-only').forEach((el) => el.classList.toggle('hidden', !canUseWorkforce()));
    const navigationModules = {
      tasks: 'execution', projects: 'execution', issues: 'execution', photos: 'execution', workforce: 'execution',
      clients: 'client', operations: ['finance', 'costs'],
    };
    $$('.nav-item[data-view]').forEach((element) => {
      const required = navigationModules[element.dataset.view];
      if (!required) return;
      const allowed = (Array.isArray(required) ? required.some(hasProjectModule) : hasProjectModule(required))
        && (element.dataset.view !== 'workforce' || canUseWorkforce());
      element.classList.toggle('hidden', !allowed);
    });
    const accountName = state.me?.nickname || state.me?.username || '当前账号';
    $('#identityText').textContent = `${accountName} · ${roleNames[state.role] || state.role}`;
    $('#accountInitial').innerHTML = '<img class=xz-icon src=assets/icons/user.svg alt aria-hidden=true>';
    $('#accountInitial').setAttribute('aria-label', accountName);
    $('#organizationName').textContent = state.organization?.name || '企业工作空间';
    $('#organizationInitial').innerHTML = '<img class=xz-icon src=assets/icons/building.svg alt aria-hidden=true>';
    const banner = $('#accessBanner');
    const subscription = state.organization?.subscription || {};
    const subscriptionView = enterpriseSubscriptionView(subscription, state.organization?.accessMode);
    const subscriptionChip = $('#subscriptionChip');
    $('#subscriptionPlanLabel').textContent = subscriptionView.planLabel;
    $('#subscriptionExpiryLabel').textContent = subscriptionView.expiryLabel;
    subscriptionChip.classList.toggle('expiring', subscriptionView.tone === 'expiring');
    subscriptionChip.classList.toggle('expired', subscriptionView.tone === 'expired');
    subscriptionChip.title = `${subscriptionView.planLabel} · ${subscriptionView.detailLabel}`;
    if (state.organization?.accessMode === 'readonly') {
      banner.innerHTML = subscription.status === 'preview'
        ? '<b>普通账号 · 企业版只读预览</b>可以查看页面和已有资料；如需新增、编辑或上传，请联系作者开通企业会员。'
        : `<b>企业版当前为只读状态</b>套餐已到期，可继续查看资料至 ${formatDate(subscription.readonlyUntil)}；续费后网页和小程序同时恢复写入。`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    return `${(value / 1024 ** 3).toFixed(2)} GB`;
  }

  function formatMoney(value) {
    return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(value, withTime = false) {
    if (!value) return '未设置';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  }

  function formatDeadline(value) {
    const hasExplicitTime = typeof value !== 'string' || /[T\s]\d{2}:\d{2}/.test(value);
    return formatDate(value, hasExplicitTime);
  }

  function overdueDuration(value) {
    if (!value) return '';
    const due = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T23:59:59`)
      : new Date(value);
    if (Number.isNaN(due.getTime())) return '';
    const elapsed = Date.now() - due.getTime();
    if (elapsed <= 0) return '';
    const totalHours = Math.max(1, Math.floor(elapsed / 3600000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return days ? `${days} 天${hours ? ` ${hours} 小时` : ''}` : `${totalHours} 小时`;
  }

  function datetimeLocalValue(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function scheduleDate(value) {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function scheduleDayDiff(start, end) {
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }

  function drawRoundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function fitCanvasText(context, value, maxWidth) {
    const text = String(value || '');
    if (context.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
    return `${result}…`;
  }

  function localDateValue(value = new Date()) {
    // Date-only fields follow the local calendar; API timestamps still use UTC.
    return datetimeLocalValue(value).slice(0, 10);
  }

  function openMilestoneReportExportDialog(milestoneId, preview = false) {
    const milestone = (state.projectDetail.milestones || []).find((item) => item.id === milestoneId);
    if (!milestone) return;
    const form = $('#milestoneReportExportForm');
    form.elements.milestoneId.value = milestone.id;
    form.elements.preview.value = preview ? 'true' : 'false';
    form.elements.actualFinishedAt.value = datetimeLocalValue(milestone.actualFinishedAt || new Date());
    const latestPassedAt = (state.projectDetail.checklistItems || [])
      .filter((item) => item.milestoneId === milestone.id && item.required && item.status === 'passed' && item.checkedAt)
      .map((item) => new Date(item.checkedAt))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0];
    form.elements.deliveryDate.value = localDateValue(latestPassedAt || milestone.actualFinishedAt || new Date());
    const branding = enterpriseReportBranding();
    form.elements.includeIssueRecords.checked = Boolean(branding.includeIssueRecords);
    form.elements.includeCustomerSyncRecords.checked = Boolean(branding.includeCustomerSyncRecords);
    $('#milestoneReportNodeName').value = milestone.name;
    $('#milestoneReportExportDialog .dialog-head h2').textContent = preview ? '预览节点验收报告' : '生成节点验收报告';
    $('#milestoneReportExportDialog .dialog-head p').textContent = preview
      ? '预览和正式下载共用同一套模板及数据选项；确认时间和内容后打开预览。'
      : '实际完成时间与客户交付日期分开填写，不受报告生成当天限制。';
    $('#milestoneReportExportForm button[type="submit"]').textContent = preview ? '打开正式版式预览' : '生成并下载 PDF';
    $('#milestoneReportExportDialog').showModal();
  }

  function openIssueRectificationReport(issueId, preview = false) {
    if (!state.organization?.id || !state.project?.id || !issueId) return;
    const suffix = preview ? '?preview=true' : '';
    const url = `/api/organizations/${state.organization.id}/projects/${state.project.id}/issues/${issueId}/rectification-report.pdf${suffix}`;
    window.open(url, '_blank', 'noopener');
  }

  function enterpriseReportBranding() {
    return {
      brandMode: 'text',
      brandText: state.organization?.name || '施工企业',
      tagline: '专业施工 · 透明交付 · 节点验收',
      managerTitle: '项目经理',
      managerSource: 'manager',
      includeIssueRecords: true,
      includeCustomerSyncRecords: false,
      logoUrl: '',
      ...(state.organization?.reportBranding || {}),
    };
  }

  const ENTERPRISE_EXPORT_FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

  function reportManagerName(project, source = 'manager') {
    if (source === 'site_manager') return project?.siteManagerName || '待分配';
    if (source === 'designer') return project?.designerName || '待分配';
    return project?.managerName || '待分配';
  }

  function reportManagerSourceLabel(source = 'manager') {
    return { site_manager: '项目经理 / 工长', manager: '项目总负责人', designer: '设计师' }[source] || '项目总负责人';
  }

  function loadCanvasImage(url) {
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  function drawContainedCanvasImage(context, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  async function drawEnterpriseExportHeader(context, { width, padding, font, project, title, subtitle, accent }) {
    const branding = enterpriseReportBranding();
    const logo = branding.brandMode === 'logo' ? await loadCanvasImage(branding.logoUrl) : null;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, 216);
    context.fillStyle = accent;
    context.fillRect(0, 0, width, 12);
    drawRoundedRect(context, padding, 48, 62, 62, 14);
    context.fillStyle = logo ? '#fff' : accent;
    context.fill();
    if (logo) {
      context.strokeStyle = '#dce3e1';
      context.lineWidth = 1;
      context.stroke();
      drawContainedCanvasImage(context, logo, padding + 7, 55, 48, 48);
    } else {
      context.fillStyle = '#fff';
      context.font = `800 27px ${font}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(branding.brandText || '企').slice(0, 1), padding + 31, 79);
    }
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.fillStyle = '#243033';
    context.font = `800 25px ${font}`;
    context.fillText(fitCanvasText(context, branding.brandText, Math.max(280, width * .42)), padding + 82, 68);
    context.fillStyle = '#6f7a7d';
    context.font = `500 14px ${font}`;
    context.fillText(fitCanvasText(context, branding.tagline, Math.max(280, width * .42)), padding + 82, 94);
    context.textAlign = 'right';
    context.fillStyle = accent;
    context.font = `800 34px ${font}`;
    context.fillText(title, width - padding, 70);
    context.fillStyle = '#6f7a7d';
    context.font = `600 13px ${font}`;
    context.fillText(subtitle, width - padding, 98);
    context.textAlign = 'left';
    context.fillStyle = '#243033';
    context.font = `800 22px ${font}`;
    context.fillText(fitCanvasText(context, project.name || '项目名称', width * .48), padding, 154);
    context.fillStyle = '#6f7a7d';
    context.font = `500 14px ${font}`;
    context.fillText(fitCanvasText(context, `${project.customerName || '客户'} · ${project.location || '项目地址未填写'}`, width * .55), padding, 182);
    context.textAlign = 'right';
    context.fillText(`合同号：${project.contractNo || '未填写'}    签约月份：${project.signedMonth || '未填写'}`, width - padding, 154);
    context.fillText(`${branding.managerTitle}：${reportManagerName(project, branding.managerSource)}    生成日期：${formatDate(new Date())}`, width - padding, 182);
  }

  async function renderConstructionScheduleImage(project, milestones) {
    const scheduled = milestones.filter((item) => item.plannedStartDate && item.plannedFinishDate);
    if (!scheduled.length) throw new Error('当前项目还没有可导出的施工排期');
    const starts = scheduled.map((item) => scheduleDate(item.plannedStartDate)).filter(Boolean);
    const finishes = scheduled.map((item) => scheduleDate(item.plannedFinishDate)).filter(Boolean);
    const firstDate = new Date(Math.min(...starts.map((item) => item.getTime())));
    const lastDate = new Date(Math.max(...finishes.map((item) => item.getTime())));
    const dayCount = Math.max(1, scheduleDayDiff(firstDate, lastDate) + 1);
    const dayWidth = dayCount <= 31 ? 52 : dayCount <= 60 ? 38 : dayCount <= 90 ? 30 : 24;
    const timelineWidth = dayCount * dayWidth;
    const leftWidth = 340;
    const sidePadding = 54;
    const topHeight = 216;
    const dateHeaderHeight = 74;
    const rowHeight = 92;
    const footerHeight = 116;
    const width = Math.max(1560, leftWidth + timelineWidth + sidePadding * 2);
    const height = topHeight + dateHeaderHeight + scheduled.length * rowHeight + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const fontFamily = ENTERPRISE_EXPORT_FONT;
    const colors = {
      ink: '#243033', muted: '#6f7a7d', line: '#dce3e1', soft: '#f5f8f7', green: '#246f58',
      greenSoft: '#dceee5', blue: '#426f9a', blueSoft: '#dfeaf4', red: '#a64c43', redSoft: '#f3dfdc', white: '#ffffff',
    };
    context.fillStyle = colors.white;
    context.fillRect(0, 0, width, height);
    await drawEnterpriseExportHeader(context, {
      width, padding: sidePadding, font: fontFamily, project,
      title: '施工进度计划表', subtitle: 'CONSTRUCTION SCHEDULE', accent: colors.green,
    });

    const gridX = sidePadding;
    const timelineX = gridX + leftWidth;
    const gridWidth = leftWidth + dayCount * dayWidth;
    const headerY = topHeight;
    context.fillStyle = '#eef3f1';
    context.fillRect(gridX, headerY, gridWidth, dateHeaderHeight);
    context.strokeStyle = colors.line;
    context.lineWidth = 1;
    context.strokeRect(gridX + 0.5, headerY + 0.5, gridWidth - 1, dateHeaderHeight - 1);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = colors.ink;
    context.font = `800 17px ${fontFamily}`;
    context.fillText('施工节点', gridX + 22, headerY + 31);
    context.fillStyle = colors.muted;
    context.font = `500 12px ${fontFamily}`;
    context.fillText('负责人 / 计划工期', gridX + 22, headerY + 54);

    const todayKey = localDateValue();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const labelStep = dayWidth >= 38 ? 1 : dayWidth >= 28 ? 2 : 3;
    for (let index = 0; index < dayCount; index += 1) {
      const day = new Date(firstDate);
      day.setDate(firstDate.getDate() + index);
      const x = timelineX + index * dayWidth;
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const isToday = localDateValue(day) === todayKey;
      if (isWeekend) {
        context.fillStyle = '#f7f9f8';
        context.fillRect(x, headerY, dayWidth, dateHeaderHeight);
      }
      if (isToday) {
        context.fillStyle = '#e5f1eb';
        context.fillRect(x, headerY, dayWidth, dateHeaderHeight);
      }
      context.strokeStyle = colors.line;
      context.beginPath();
      context.moveTo(x + 0.5, headerY);
      context.lineTo(x + 0.5, headerY + dateHeaderHeight);
      context.stroke();
      if (index % labelStep === 0) {
        context.textAlign = 'center';
        context.fillStyle = isToday ? colors.green : colors.ink;
        context.font = `800 ${dayWidth >= 38 ? 13 : 11}px ${fontFamily}`;
        context.fillText(`${day.getMonth() + 1}/${day.getDate()}`, x + dayWidth / 2, headerY + 29);
        context.fillStyle = colors.muted;
        context.font = `500 11px ${fontFamily}`;
        context.fillText(`周${weekdays[day.getDay()]}`, x + dayWidth / 2, headerY + 53);
      }
    }

    const statusPalette = {
      completed: { fill: colors.green, soft: colors.greenSoft, label: '已完成' },
      in_progress: { fill: colors.blue, soft: colors.blueSoft, label: '进行中' },
      overdue: { fill: colors.red, soft: colors.redSoft, label: '已逾期' },
      blocked: { fill: colors.red, soft: colors.redSoft, label: '受阻' },
      pending: { fill: '#6d8e80', soft: '#e2eee8', label: '待开始' },
    };
    scheduled.forEach((milestone, rowIndex) => {
      const y = headerY + dateHeaderHeight + rowIndex * rowHeight;
      context.fillStyle = rowIndex % 2 ? '#fbfcfc' : colors.white;
      context.fillRect(gridX, y, gridWidth, rowHeight);
      context.strokeStyle = colors.line;
      context.beginPath();
      context.moveTo(gridX, y + rowHeight + 0.5);
      context.lineTo(gridX + gridWidth, y + rowHeight + 0.5);
      context.stroke();
      for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
        const day = new Date(firstDate);
        day.setDate(firstDate.getDate() + dayIndex);
        const dayX = timelineX + dayIndex * dayWidth;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const isToday = localDateValue(day) === todayKey;
        if (isWeekend || isToday) {
          context.fillStyle = isToday ? 'rgba(229,241,235,.72)' : 'rgba(247,249,248,.82)';
          context.fillRect(dayX, y, dayWidth, rowHeight);
        }
        context.strokeStyle = '#edf0ef';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(dayX + 0.5, y);
        context.lineTo(dayX + 0.5, y + rowHeight);
        context.stroke();
      }

      const palette = statusPalette[milestone.status] || statusPalette[milestone.rawStatus] || statusPalette.pending;
      drawRoundedRect(context, gridX + 20, y + 24, 38, 38, 10);
      context.fillStyle = palette.soft;
      context.fill();
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = palette.fill;
      context.font = `800 12px ${fontFamily}`;
      context.fillText(String(rowIndex + 1).padStart(2, '0'), gridX + 39, y + 43);
      context.textAlign = 'left';
      context.fillStyle = colors.ink;
      context.font = `800 16px ${fontFamily}`;
      context.fillText(fitCanvasText(context, milestone.name, 182), gridX + 72, y + 37);
      context.fillStyle = colors.muted;
      context.font = `500 12px ${fontFamily}`;
      context.fillText(fitCanvasText(context, `${milestone.ownerName || '待分配'} · ${Number(milestone.durationDays || 1)} 天 · ${palette.label}`, 230), gridX + 72, y + 61);

      const start = scheduleDate(milestone.plannedStartDate);
      const finish = scheduleDate(milestone.plannedFinishDate);
      const startOffset = Math.max(0, scheduleDayDiff(firstDate, start));
      const spanDays = Math.max(1, scheduleDayDiff(start, finish) + 1);
      const barX = timelineX + startOffset * dayWidth + 5;
      const barY = y + 22;
      const barWidth = Math.max(12, spanDays * dayWidth - 10);
      const barHeight = 48;
      drawRoundedRect(context, barX, barY, barWidth, barHeight, 12);
      context.fillStyle = palette.soft;
      context.fill();
      context.strokeStyle = palette.fill;
      context.lineWidth = 1.5;
      context.stroke();
      if (barWidth >= 92) {
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillStyle = palette.fill;
        context.font = `800 13px ${fontFamily}`;
        context.fillText(fitCanvasText(context, milestone.name, barWidth - 24), barX + 12, barY + 18);
        context.font = `500 11px ${fontFamily}`;
        context.fillText(`${milestone.plannedStartDate.slice(5)} — ${milestone.plannedFinishDate.slice(5)}`, barX + 12, barY + 35);
      } else {
        const externalLabelX = barX + barWidth + 10;
        const externalLabelWidth = timelineX + timelineWidth - externalLabelX - 8;
        if (externalLabelWidth >= 54) {
          context.textAlign = 'left';
          context.textBaseline = 'middle';
          context.fillStyle = palette.fill;
          context.font = `800 12px ${fontFamily}`;
          context.fillText(fitCanvasText(context, milestone.name, externalLabelWidth), externalLabelX, barY + 18);
          context.font = `500 10px ${fontFamily}`;
          context.fillText(fitCanvasText(context, `${milestone.plannedStartDate.slice(5)} — ${milestone.plannedFinishDate.slice(5)}`, externalLabelWidth), externalLabelX, barY + 35);
        } else {
          const fallbackLabelWidth = barX - timelineX - 8;
          if (fallbackLabelWidth >= 54) {
            context.textAlign = 'right';
            context.textBaseline = 'middle';
            context.fillStyle = palette.fill;
            context.font = `800 12px ${fontFamily}`;
            context.fillText(fitCanvasText(context, milestone.name, fallbackLabelWidth), barX - 8, barY + 18);
            context.font = `500 10px ${fontFamily}`;
            context.fillText(fitCanvasText(context, `${milestone.plannedStartDate.slice(5)} — ${milestone.plannedFinishDate.slice(5)}`, fallbackLabelWidth), barX - 8, barY + 35);
          }
        }
      }
    });

    context.strokeStyle = colors.line;
    context.strokeRect(gridX + 0.5, headerY + 0.5, gridWidth - 1, dateHeaderHeight + scheduled.length * rowHeight - 1);
    context.beginPath();
    context.moveTo(timelineX + 0.5, headerY);
    context.lineTo(timelineX + 0.5, headerY + dateHeaderHeight + scheduled.length * rowHeight);
    context.stroke();

    const footerY = headerY + dateHeaderHeight + scheduled.length * rowHeight + 34;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    const legends = [statusPalette.completed, statusPalette.in_progress, statusPalette.pending, statusPalette.overdue];
    let legendX = sidePadding;
    legends.forEach((item) => {
      drawRoundedRect(context, legendX, footerY, 18, 18, 5);
      context.fillStyle = item.fill;
      context.fill();
      context.fillStyle = colors.muted;
      context.font = `600 12px ${fontFamily}`;
      context.fillText(item.label, legendX + 26, footerY + 9);
      legendX += 90;
    });
    context.textAlign = 'right';
    context.fillStyle = colors.muted;
    context.font = `500 12px ${fontFamily}`;
    context.fillText('本表根据项目施工计划生成；如遇设计变更、材料延期等情况，以双方确认后的最新计划为准。', width - sidePadding, footerY + 9);
    context.fillStyle = '#97a19f';
    context.font = `500 11px ${fontFamily}`;
    context.fillText(`由 ${enterpriseReportBranding().brandText} 出具`, width - sidePadding, footerY + 42);
    return canvas;
  }

  async function openConstructionScheduleImage() {
    const milestones = state.projectDetail?.milestones || [];
    const canvas = await renderConstructionScheduleImage(state.project, milestones);
    const dataUrl = canvas.toDataURL('image/png');
    const safeProjectName = String(state.project?.name || '施工项目').replace(/[\\/:*?"<>|]/g, '-');
    const filename = `${safeProjectName}-施工进度计划表.png`;
    const preview = $('#constructionScheduleImagePreview');
    preview.src = dataUrl;
    preview.alt = `${state.project?.name || '项目'}施工进度计划表`;
    $('#constructionScheduleImageMeta').textContent = `${canvas.width} × ${canvas.height}px · PNG 高清图片`;
    const download = $('#downloadConstructionScheduleImage');
    download.dataset.imageUrl = dataUrl;
    download.dataset.filename = filename;
    $('#constructionScheduleImageDialog').showModal();
  }

  async function renderProgressComparisonImage(project, milestones) {
    const rows = (milestones || []).filter((item) => item.plannedStartDate && item.plannedFinishDate);
    if (!rows.length) throw new Error('当前项目还没有可导出的计划日期');
    const dates = rows.flatMap((item) => [scheduleDate(item.plannedStartDate), scheduleDate(item.plannedFinishDate), item.actualFinishedAt ? scheduleDate(String(item.actualFinishedAt).slice(0, 10)) : null]).filter(Boolean);
    const firstDate = new Date(Math.min(...dates.map((item) => item.getTime())));
    const lastDate = new Date(Math.max(...dates.map((item) => item.getTime())));
    const dayCount = Math.max(1, scheduleDayDiff(firstDate, lastDate) + 1);
    const dayWidth = dayCount <= 31 ? 48 : dayCount <= 60 ? 34 : dayCount <= 90 ? 27 : 22;
    const sidePadding = 54;
    const leftWidth = 370;
    const timelineWidth = dayCount * dayWidth;
    const statusWidth = 116;
    const topHeight = 216;
    const dateHeaderHeight = 74;
    const rowHeight = 98;
    const footerHeight = 126;
    const width = Math.max(1560, sidePadding * 2 + leftWidth + timelineWidth + statusWidth);
    const height = topHeight + dateHeaderHeight + rows.length * rowHeight + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const fontFamily = ENTERPRISE_EXPORT_FONT;
    const colors = { ink: '#243033', muted: '#6f7a7d', line: '#dce3e1', green: '#246f58', greenSoft: '#dceee5', blue: '#426f9a', blueSoft: '#dfeaf4', red: '#a64c43', redSoft: '#f3dfdc', white: '#fff' };
    const statusLabels = { completed: '已完成', in_progress: '进行中', overdue: '已逾期', blocked: '受阻', pending: '待开始' };
    const statusColor = (item) => item.status === 'completed' ? colors.green : ['overdue', 'blocked'].includes(item.status) ? colors.red : item.status === 'in_progress' ? colors.blue : '#6d8e80';
    context.fillStyle = colors.white;
    context.fillRect(0, 0, width, height);
    await drawEnterpriseExportHeader(context, {
      width, padding: sidePadding, font: fontFamily, project,
      title: '计划 / 实际进度表', subtitle: 'PLANNED VS ACTUAL PROGRESS', accent: colors.green,
    });

    const gridX = sidePadding;
    const timelineX = gridX + leftWidth;
    const gridWidth = leftWidth + timelineWidth + statusWidth;
    const headerY = topHeight;
    context.fillStyle = '#eef3f1';
    context.fillRect(gridX, headerY, gridWidth, dateHeaderHeight);
    context.strokeStyle = colors.line;
    context.strokeRect(gridX + .5, headerY + .5, gridWidth - 1, dateHeaderHeight - 1);
    context.textAlign = 'left';
    context.fillStyle = colors.ink;
    context.font = `800 17px ${fontFamily}`;
    context.fillText('施工节点', gridX + 22, headerY + 31);
    context.fillStyle = colors.muted;
    context.font = `500 12px ${fontFamily}`;
    context.fillText('计划区间 / 实际完成 / 偏差', gridX + 22, headerY + 54);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const labelStep = dayWidth >= 38 ? 1 : dayWidth >= 28 ? 2 : 3;
    const todayKey = localDateValue();
    for (let index = 0; index < dayCount; index += 1) {
      const day = new Date(firstDate);
      day.setDate(firstDate.getDate() + index);
      const x = timelineX + index * dayWidth;
      const isToday = localDateValue(day) === todayKey;
      if (isToday) { context.fillStyle = '#e5f1eb'; context.fillRect(x, headerY, dayWidth, dateHeaderHeight); }
      context.strokeStyle = colors.line;
      context.beginPath(); context.moveTo(x + .5, headerY); context.lineTo(x + .5, headerY + dateHeaderHeight); context.stroke();
      if (index % labelStep === 0) {
        context.textAlign = 'center'; context.fillStyle = isToday ? colors.green : colors.ink; context.font = `800 ${dayWidth >= 38 ? 13 : 11}px ${fontFamily}`;
        context.fillText(`${day.getMonth() + 1}/${day.getDate()}`, x + dayWidth / 2, headerY + 29);
        context.fillStyle = colors.muted; context.font = `500 11px ${fontFamily}`; context.fillText(`周${weekdays[day.getDay()]}`, x + dayWidth / 2, headerY + 53);
      }
    }
    const statusX = timelineX + timelineWidth;
    context.textAlign = 'center'; context.fillStyle = colors.ink; context.font = `800 13px ${fontFamily}`; context.fillText('状态', statusX + statusWidth / 2, headerY + 31);
    context.fillStyle = colors.muted; context.font = `500 11px ${fontFamily}`; context.fillText('节点状态', statusX + statusWidth / 2, headerY + 53);
    rows.forEach((item, rowIndex) => {
      const y = headerY + dateHeaderHeight + rowIndex * rowHeight;
      context.fillStyle = rowIndex % 2 ? '#fbfcfc' : colors.white; context.fillRect(gridX, y, gridWidth, rowHeight);
      context.strokeStyle = colors.line; context.beginPath(); context.moveTo(gridX, y + rowHeight + .5); context.lineTo(gridX + gridWidth, y + rowHeight + .5); context.stroke();
      for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) { const x = timelineX + dayIndex * dayWidth; context.strokeStyle = '#edf0ef'; context.beginPath(); context.moveTo(x + .5, y); context.lineTo(x + .5, y + rowHeight); context.stroke(); }
      const color = statusColor(item);
      drawRoundedRect(context, gridX + 20, y + 28, 38, 38, 10); context.fillStyle = item.status === 'completed' ? colors.greenSoft : item.status === 'in_progress' ? colors.blueSoft : colors.redSoft; context.fill();
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = color; context.font = `800 12px ${fontFamily}`; context.fillText(String(rowIndex + 1).padStart(2, '0'), gridX + 39, y + 47);
      context.textAlign = 'left'; context.fillStyle = colors.ink; context.font = `800 16px ${fontFamily}`; context.fillText(fitCanvasText(context, item.name, 190), gridX + 72, y + 35);
      const actual = item.actualFinishedAt ? String(item.actualFinishedAt).slice(0, 10) : '';
      const variance = actual ? Math.round((new Date(actual) - new Date(item.plannedFinishDate)) / 86400000) : null;
      const varianceText = variance == null ? '实际：未完成' : `实际：${actual} · ${variance > 0 ? `晚 ${variance} 天` : variance < 0 ? `提前 ${Math.abs(variance)} 天` : '按期完成'}`;
      context.fillStyle = colors.muted; context.font = `500 12px ${fontFamily}`; context.fillText(fitCanvasText(context, `计划：${item.plannedStartDate} — ${item.plannedFinishDate}`, 250), gridX + 72, y + 57); context.fillText(fitCanvasText(context, varianceText, 250), gridX + 72, y + 77);
      const start = scheduleDate(item.plannedStartDate); const finish = scheduleDate(item.plannedFinishDate); const startOffset = Math.max(0, scheduleDayDiff(firstDate, start)); const planSpan = Math.max(1, scheduleDayDiff(start, finish) + 1); const barX = timelineX + startOffset * dayWidth + 5; const barY = y + 24; const barWidth = Math.max(14, planSpan * dayWidth - 10);
      drawRoundedRect(context, barX, barY, barWidth, 24, 8); context.fillStyle = item.status === 'completed' ? colors.greenSoft : '#edf2f0'; context.fill(); context.strokeStyle = color; context.lineWidth = 1.2; context.stroke();
      if (actual) { const actualDate = scheduleDate(actual); const actualOffset = Math.max(0, Math.min(dayCount - 1, scheduleDayDiff(firstDate, actualDate))); context.fillStyle = color; context.fillRect(timelineX + actualOffset * dayWidth + Math.max(2, dayWidth / 2 - 2), y + 17, 4, 38); }
      if (barWidth > 110) {
        context.textAlign = 'left'; context.fillStyle = color; context.font = `700 11px ${fontFamily}`; context.fillText('计划', barX + 9, barY + 16);
      } else {
        const shortBarLabelX = barX + barWidth + 8;
        const shortBarLabelWidth = timelineX + timelineWidth - shortBarLabelX - 8;
        if (shortBarLabelWidth >= 34) {
          context.textAlign = 'left'; context.fillStyle = color; context.font = `700 11px ${fontFamily}`; context.fillText('计划', shortBarLabelX, barY + 16);
        } else if (barX - timelineX >= 42) {
          context.textAlign = 'right'; context.fillStyle = color; context.font = `700 11px ${fontFamily}`; context.fillText('计划', barX - 8, barY + 16);
        }
      }
      context.textAlign = 'center'; context.fillStyle = color; context.font = `700 12px ${fontFamily}`; context.fillText(statusLabels[item.status] || item.status || '待开始', statusX + statusWidth / 2, y + 51);
    });
    context.strokeStyle = colors.line; context.strokeRect(gridX + .5, headerY + .5, gridWidth - 1, dateHeaderHeight + rows.length * rowHeight - 1); context.beginPath(); context.moveTo(timelineX + .5, headerY); context.lineTo(timelineX + .5, headerY + dateHeaderHeight + rows.length * rowHeight); context.moveTo(statusX + .5, headerY); context.lineTo(statusX + .5, headerY + dateHeaderHeight + rows.length * rowHeight); context.stroke();
    const footerY = headerY + dateHeaderHeight + rows.length * rowHeight + 34; context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillStyle = colors.green; context.font = `700 12px ${fontFamily}`; context.fillText('计划区间', sidePadding, footerY + 9); context.fillStyle = colors.muted; context.fillText('浅色横条为计划工期，竖线为实际完成日期。', sidePadding + 70, footerY + 9); context.fillStyle = colors.blue; context.fillText('进行中', sidePadding, footerY + 39); context.fillStyle = colors.muted; context.fillText('未完成节点以当前状态为准。', sidePadding + 70, footerY + 39); context.textAlign = 'right'; context.fillStyle = colors.muted; context.font = `500 12px ${fontFamily}`; context.fillText('本表用于客户沟通，实际工期以双方确认的最新计划为准。', width - sidePadding, footerY + 9); context.fillStyle = '#97a19f'; context.font = `500 11px ${fontFamily}`; context.fillText(`由 ${enterpriseReportBranding().brandText} 出具`, width - sidePadding, footerY + 42);
    return canvas;
  }

  async function openProgressComparisonImage() {
    const milestones = state.projectDetail?.milestones || [];
    const canvas = await renderProgressComparisonImage(state.project, milestones);
    const dataUrl = canvas.toDataURL('image/png');
    const safeProjectName = String(state.project?.name || '施工项目').replace(/[\\/:*?"<>|]/g, '-');
    const filename = `${safeProjectName}-计划实际进度表.png`;
    $('#constructionScheduleImagePreview').src = dataUrl;
    $('#constructionScheduleImageTitle').textContent = '客户版施工进度表';
    $('#constructionScheduleImageDescription').textContent = '横向日期排期样式，带企业抬头，可下载后直接发送给客户。';
    $('#constructionScheduleImagePreview').alt = `${state.project?.name || '项目'}计划实际进度表`;
    $('#constructionScheduleImageMeta').textContent = `${canvas.width} × ${canvas.height}px · PNG 高清图片`;
    $('#constructionScheduleImageTitle').textContent = '客户版计划与实际进度表';
    $('#constructionScheduleImageDescription').textContent = '计划区间与实际完成情况对比，带企业抬头，可下载后直接发送给客户。';
    const download = $('#downloadConstructionScheduleImage'); download.dataset.imageUrl = dataUrl; download.dataset.filename = filename;
    $('#constructionScheduleImageDialog').showModal();
  }

  async function renderPaymentPlanImage(project, business) {
    const payments = business?.payments || [];
    if (!payments.length) throw new Error('当前项目还没有可导出的收款计划');
    const width = 1460;
    const rowHeight = 92;
    const height = 340 + payments.length * rowHeight + 170;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const font = ENTERPRISE_EXPORT_FONT;
    const ink = '#243033'; const muted = '#6f7a7d'; const green = '#246f58'; const line = '#dce3e1';
    context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
    await drawEnterpriseExportHeader(context, {
      width, padding: 56, font, project,
      title: '合同收款计划表', subtitle: 'PAYMENT SCHEDULE', accent: green,
    });
    const summaryY = 220; const cardGap = 14; const cardWidth = (width - 112 - cardGap * 3) / 4;
    const cards = [['合同总价', business.contractAmount], ['已收定金', business.depositAmount], ['累计到账', business.receivedAmount], ['剩余应收', business.remainingAmount]];
    cards.forEach(([label, value], index) => { const x = 56 + index * (cardWidth + cardGap); drawRoundedRect(context, x, summaryY, cardWidth, 82, 12); context.fillStyle = index === 3 ? '#eef7f2' : '#f5f8f7'; context.fill(); context.fillStyle = muted; context.textAlign = 'left'; context.font = `500 13px ${font}`; context.fillText(label, x + 18, summaryY + 28); context.fillStyle = index === 3 ? green : ink; context.font = `800 21px ${font}`; context.fillText(formatMoney(value), x + 18, summaryY + 59); });
    const tableX = 56; const tableY = 330; const tableWidth = width - 112;
    const cols = [80, 350, 150, 205, 205, 180, 178];
    const split = business?.paymentCalculationMode === 'split';
    const headers = ['序号', '收款节点', split ? '组内占比' : '合同占比', '节点目标金额', '本期计划应收', '计划日期', '状态'];
    context.fillStyle = '#edf3f0'; context.fillRect(tableX, tableY, tableWidth, 62);
    let x = tableX; headers.forEach((header, index) => { context.fillStyle = ink; context.textAlign = index === 1 ? 'left' : 'center'; context.font = `800 14px ${font}`; context.fillText(header, x + (index === 1 ? 18 : cols[index] / 2), tableY + 37); x += cols[index]; });
    payments.forEach((item, rowIndex) => { const y = tableY + 62 + rowIndex * rowHeight; context.fillStyle = rowIndex % 2 ? '#fafcfb' : '#fff'; context.fillRect(tableX, y, tableWidth, rowHeight); context.strokeStyle = line; context.beginPath(); context.moveTo(tableX, y + rowHeight + .5); context.lineTo(tableX + tableWidth, y + rowHeight + .5); context.stroke(); const nodeName = split ? `【${item.paymentGroupName || '人辅'}】${item.name}` : item.name; const values = [String(rowIndex + 1).padStart(2, '0'), nodeName, `${Number(item.paymentPercent || 0)}%`, formatMoney(item.targetAmount), formatMoney(item.plannedAmount), item.dueDate, item.status === 'received' ? '已收齐' : item.status === 'partial' ? '部分到账' : item.overdue ? '已逾期' : '待收款']; x = tableX; values.forEach((value, index) => { context.textAlign = index === 1 ? 'left' : 'center'; context.fillStyle = index === 6 && item.overdue ? '#a64c43' : index === 6 && item.status === 'received' ? green : ink; context.font = `${index === 1 || index === 6 ? 700 : 500} 14px ${font}`; context.fillText(fitCanvasText(context, value, cols[index] - 24), x + (index === 1 ? 18 : cols[index] / 2), y + 42); if (index === 1 && Number(item.depositApplied || 0)) { context.fillStyle = muted; context.font = `500 11px ${font}`; context.fillText(`首期已扣定金 ${formatMoney(item.depositApplied)}`, x + 18, y + 66); } x += cols[index]; }); });
    context.strokeStyle = line; context.strokeRect(tableX + .5, tableY + .5, tableWidth - 1, 62 + payments.length * rowHeight - 1);
    const footerY = tableY + 62 + payments.length * rowHeight + 48; context.textAlign = 'left'; context.fillStyle = green; context.font = `700 13px ${font}`; context.fillText('计算说明', 56, footerY); context.fillStyle = muted; context.font = `500 12px ${font}`; context.fillText(split ? '人辅与主材按各自合同金额独立计算比例或金额；定金优先抵扣人辅首期。具体付款以双方合同为准。' : '节点目标金额 = 合同总价 × 合同占比；首期计划应收已扣除定金。具体付款以双方签署的合同及补充协议为准。', 128, footerY);
    context.textAlign = 'right'; context.fillStyle = '#97a19f'; context.fillText(`由 ${enterpriseReportBranding().brandText} 出具`, width - 56, footerY + 40);
    return canvas;
  }

  async function openPaymentPlanImage() {
    const canvas = await renderPaymentPlanImage(state.project, state.projectDetail?.business);
    const dataUrl = canvas.toDataURL('image/png');
    const safeProjectName = String(state.project?.name || '施工项目').replace(/[\\/:*?"<>|]/g, '-');
    $('#constructionScheduleImagePreview').src = dataUrl;
    $('#constructionScheduleImageTitle').textContent = '客户版合同收款计划表';
    $('#constructionScheduleImageDescription').textContent = '含企业抬头、合同总价、定金、各收款节点比例与金额，可直接发送给业主。';
    $('#constructionScheduleImagePreview').alt = `${state.project?.name || '项目'}合同收款计划表`;
    $('#constructionScheduleImageMeta').textContent = `${canvas.width} × ${canvas.height}px · PNG 高清图片`;
    const download = $('#downloadConstructionScheduleImage'); download.dataset.imageUrl = dataUrl; download.dataset.filename = `${safeProjectName}-合同收款计划表.png`;
    $('#constructionScheduleImageDialog').showModal();
  }

  const directoryConfig = {
    overview: { nav: 'projects', eyebrow: '项目管理', title: '所有施工项目', description: '先配置施工计划，再按节点添加现场、整改、验收并同步客户。', action: '打开项目' },
    logs: { nav: 'photos', eyebrow: '现场影像', title: '现场照片与日志', description: '先选择项目，再提交、审核和发布该项目的真实现场照片。', action: '进入现场影像' },
    issues: { nav: 'issues', eyebrow: '问题整改', title: '问题整改闭环', description: '先选择项目，再发起整改、上传整改后照片并完成复核。', action: '进入问题整改' },
    client: { nav: 'client', eyebrow: '客户同步', title: '客户进度同步', description: '先绑定客户账号，审核发布后客户可在个人网页和小程序查看；分享链接作为备用。', action: '进入客户同步' },
  };

  function projectMilestoneCountdown(project) {
    if (!project.planConfigured) return '节点日期待设置';
    if (Number(project.completedMilestoneCount || 0) >= Number(project.milestoneCount || 0)) return '施工节点已全部完成';
    const due = scheduleDate(project.nextActionDueDate);
    if (!due) return '节点日期待设置';
    const today = scheduleDate(localDateValue());
    const days = scheduleDayDiff(today, due);
    if (days < 0) return `节点已超时 ${Math.abs(days)} 天`;
    if (days === 0) return '节点今天到期';
    return `节点还剩 ${days} 天`;
  }

  const enterprisePlanLabels = {
    basic: '企业会员 · 基础版',
    team: '企业会员 · 团队版',
    trial: '企业会员试用版',
    cocreate: '企业共创版',
    standard: '企业标准版（历史）',
  };

  function enterpriseSubscriptionView(subscription = {}, accessMode = 'active') {
    const planLabel = enterprisePlanLabels[subscription.planKey] || '企业版';
    const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      return { planLabel, expiryLabel: '有效期未设置', detailLabel: '请联系管理员确认有效期', tone: 'expired', daysRemaining: null };
    }
    const dayMs = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((endsAt.getTime() - Date.now()) / dayMs);
    const dateLabel = formatDate(subscription.endsAt);
    if (accessMode === 'readonly' || daysRemaining < 0) {
      return { planLabel, expiryLabel: `已到期 · ${dateLabel}`, detailLabel: `到期时间 ${dateLabel}，当前为只读状态`, tone: 'expired', daysRemaining };
    }
    if (accessMode === 'suspended') {
      return { planLabel, expiryLabel: `已暂停 · 原到期 ${dateLabel}`, detailLabel: `原到期时间 ${dateLabel}`, tone: 'expired', daysRemaining };
    }
    const remainingLabel = daysRemaining === 0 ? '今天到期' : `剩余 ${daysRemaining} 天`;
    const reminderDays = ['cocreate', 'trial'].includes(subscription.planKey) ? 7 : 30;
    return {
      planLabel,
      expiryLabel: `${dateLabel} 到期 · ${remainingLabel}`,
      detailLabel: `到期时间 ${dateLabel}，${remainingLabel}`,
      tone: daysRemaining <= reminderDays ? 'expiring' : 'normal',
      daysRemaining,
    };
  }

  function projectCard(project, tab = 'overview', compact = false, orderIndex = -1, orderCount = 0) {
    const archived = project.lifecycleStatus === 'archived';
    const actionLabel = directoryConfig[tab]?.action || '打开项目';
    const canDelete = archived && ['owner', 'admin'].includes(state.role);
    const completed = Number(project.completedMilestoneCount || 0);
    const total = Number(project.milestoneCount || 0);
    const progressText = project.planConfigured ? `${completed}/${total} 个节点完成` : '施工计划待配置';
    const riskText = Number(project.riskMilestoneCount || 0) ? `${project.riskMilestoneCount} 个风险节点 · ${projectMilestoneCountdown(project)}` : projectMilestoneCountdown(project);
    const canAssignSiteManager = !compact && !archived && !project.siteManagerName && canWrite() && ['owner', 'admin'].includes(state.role);
    const siteManagerAction = canAssignSiteManager
      ? `<button type="button" class="project-assign-manager" data-assign-site-manager="${esc(project.id)}">快速分配工长</button>`
      : '';
    const orderControls = !compact && state.projectOrderMode && tab === 'overview' && !archived && orderIndex >= 0
      ? `<div class="project-order-controls"><button type="button" data-project-order="up" data-project-order-id="${esc(project.id)}" ${orderIndex === 0 ? 'disabled' : ''}>↑ 上移</button><button type="button" data-project-order="down" data-project-order-id="${esc(project.id)}" ${orderIndex === orderCount - 1 ? 'disabled' : ''}>↓ 下移</button></div>`
      : '';
    return `
      <article class="project-card${compact ? ' compact' : ''}" data-project-id="${esc(project.id)}" data-project-tab-target="${esc(tab)}" tabindex="0" role="link" aria-label="打开项目：${esc(project.name)}">
        <div class="project-primary">
          <h3>${esc(project.name)}</h3><div class="meta">${esc(project.customerName || '未填写客户')} · ${esc(project.stage)}</div>
        </div>
        <div class="project-owner"><span>设计 ${esc(project.designerName || '待分配')} · 工长 ${esc(project.siteManagerName || '待分配')}</span><b>总负责人 ${esc(project.managerName || '待分配')}</b>${siteManagerAction}</div>
        <div class="progress-row project-progress">
          <div class="progress-label"><span>${progressText}</span><b>${riskText}</b></div>
          <div class="progress-track"><div class="progress-fill ${project.riskMilestoneCount ? 'late' : ''}" style="width:${Math.max(total ? 1 : 0, project.actualProgress)}%"></div></div>
        </div>
        <div class="project-stats"><span>现场 <b>${project.siteLogCount}</b></span><span>问题 <b>${project.openIssues}</b></span></div>
        <span class="badge ${archived ? 'returned' : esc(project.status)}">${archived ? '已归档' : (statusNames[project.status] || project.status)}</span>
        <div class="project-enter">${orderControls || `<span>${actionLabel}</span><b>→</b><small>下一步：${esc(project.nextAction || '待设置')}</small>`}${canDelete ? '<button type="button" class="danger project-delete-button" data-project-delete="' + esc(project.id) + '">永久删除项目（不可恢复）</button>' : ''}</div>
      </article>`;
  }

  function setStageSelectValue(form, currentStage) {
    const select = form?.elements?.stage;
    if (!select || select.tagName !== 'SELECT') return;
    const stage = String(currentStage || select.dataset.defaultStage || '开工准备').trim();
    const isStandard = enterpriseStageOptions.includes(stage);
    const legacyOption = stage && !isStandard
      ? `<option value="${esc(stage)}">${esc(stage)}（现有阶段）</option>` : '';
    select.innerHTML = enterpriseStageOptions.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')
      + legacyOption
      + `<option value="${customStageValue}">自定义阶段…</option>`;
    select.value = stage || '开工准备';
    const customField = $('[data-custom-stage-field]', form);
    const customInput = form.elements.customStage;
    if (customField && customInput) {
      customField.hidden = true;
      customField.classList.add('hidden');
      customInput.required = false;
      customInput.value = '';
    }
  }

  function updateCustomStageField(form) {
    const select = form?.elements?.stage;
    const customField = $('[data-custom-stage-field]', form);
    const customInput = form?.elements?.customStage;
    if (!select || !customField || !customInput) return;
    const isCustom = select.value === customStageValue;
    customField.hidden = !isCustom;
    customField.classList.toggle('hidden', !isCustom);
    customInput.required = isCustom;
    if (isCustom) customInput.focus();
  }

  function stageValueFromForm(form) {
    const selected = String(form.elements.stage?.value || '').trim();
    if (selected !== customStageValue) return selected;
    return String(form.elements.customStage?.value || '').trim();
  }

  function initializeStageSelects() {
    $$('[data-stage-select]').forEach((select) => {
      const form = select.form;
      setStageSelectValue(form, select.dataset.defaultStage || '开工准备');
      select.addEventListener('change', () => updateCustomStageField(form));
    });
  }

  function renderProjectDirectory(projects = state.dashboard?.projects || [], includeArchived = true) {
    const tab = state.projectIntent || 'overview';
    const activeProjects = projects.length
      ? projects.map((project, index) => projectCard(project, tab, false, index, projects.length)).join('')
      : '<div class="empty panel">暂无在管项目</div>';
    const archivedProjects = includeArchived && state.archivedProjects.length
      ? `<div class="archive-heading"><b>已归档项目</b><span>${state.archivedProjects.length} 个 · 不占在管项目额度</span></div>${state.archivedProjects.map((project) => projectCard(project, tab)).join('')}`
      : '';
    $('#allProjects').innerHTML = `${activeProjects}${archivedProjects}`;
    const toggle = $('#toggleProjectOrder');
    const canReorder = state.projectIntent === 'overview' && isOwner() && canWrite() && (state.dashboard?.projects?.length || 0) > 1;
    toggle.hidden = !canReorder;
    toggle.classList.toggle('active', state.projectOrderMode);
    toggle.textContent = state.projectOrderMode ? '完成排序' : '调整项目顺序';
  }

  function todoCard(todo, compact = false) {
    const elapsed = todo.overdueDurationLabel || overdueDuration(todo.dueAt);
    const isOverdue = todo.dueState ? todo.dueState === 'overdue' : Boolean(elapsed);
    const elapsedText = /逾期/.test(String(elapsed || '')) ? String(elapsed) : `已逾期 ${elapsed}`;
    const deadline = todo.dueLabel || formatDeadline(todo.dueAt);
    const dateLabel = todo.dueAt
      ? `${isOverdue ? '已逾期，原截止' : todo.dueState === 'today' ? '今日截止' : '截止'} ${deadline}`
      : `创建 ${formatDate(todo.createdAt, true)}`;
    const actionLabel = todo.actionLabel || '进入处理';
    const actionOwner = todo.actionOwner?.name || todo.actionOwnerName || '';
    const destinationNames = { logs: '现场照片与日志', issues: '问题整改', client: '客户同步', finance: '合同收款', costs: '成本管理', execution: '施工执行', overview: '项目概况' };
    return `<article class="task-center-card${compact ? ' compact' : ''}${isOverdue ? ' is-overdue' : ''}" data-todo-id="${esc(todo.id)}" data-project-id="${esc(todo.projectId)}" data-project-tab-target="${esc(todo.targetTab || 'overview')}" data-project-focus-id="${esc(todo.targetId || '')}" tabindex="0" role="link" aria-label="${esc(actionLabel)}：${esc(todo.title)}">
      <div class="task-center-main"><span class="task-type">${esc(todoTypeNames[todo.type] || todo.type)}</span><div><h3>${esc(todo.title)}</h3><p>${esc(todo.description || '进入项目查看详情')}</p></div></div>
      <div class="task-center-project"><b>${esc(todo.projectName || '未命名项目')}</b><span>${esc(todoTypeNames[todo.type] || '项目事项')}</span></div>
      <div class="task-center-date"><b>${esc(dateLabel)}</b><span class="${isOverdue ? 'overdue-duration' : ''}">${isOverdue ? esc(elapsedText) : todo.priority === 'danger' ? '紧急事项，请优先处理' : '按计划完成'}</span></div>
      <span class="badge ${esc(todo.priority)}">${esc(todoPriorityNames[todo.priority] || '待处理')}</span>
      <div class="task-center-enter"><b>${esc(actionLabel)}</b><span>→</span><small>${actionOwner ? `行动责任：${esc(actionOwner)}` : esc(destinationNames[todo.targetTab] || '项目概况')}</small></div>
    </article>`;
  }

  function renderNoticeDialog() {
    const todos = state.dashboard?.todos || [];
    const urgent = todos.filter((item) => item.priority === 'danger');
    const today = todos.filter((item) => item.dueState === 'today');
    $('#noticeDialogSummary').textContent = `${urgent.length} 项逾期或紧急 · ${today.length} 项今天到期 · 共 ${todos.length} 项待处理`;
    $('#noticeDialogList').innerHTML = todos.length
      ? todos.slice(0, 8).map((todo) => {
        const overdue = todo.dueState === 'overdue';
        const deadline = todo.dueAt ? (todo.dueLabel || formatDeadline(todo.dueAt)) : formatDate(todo.createdAt, true);
        return `<article class="notice-todo${overdue ? ' is-overdue' : ''}" data-todo-id="${esc(todo.id)}" data-project-id="${esc(todo.projectId)}" data-project-tab-target="${esc(todo.targetTab || 'overview')}" data-project-focus-id="${esc(todo.targetId || '')}" tabindex="0" role="link">
          <div class="notice-todo-main"><span class="task-type">${esc(todoTypeNames[todo.type] || todo.type)}</span><div><b>${esc(todo.title)}</b><p>${esc(todo.projectName || '未命名项目')} · ${esc(todo.description || '进入项目查看详情')}</p></div><span class="badge ${esc(todo.priority)}">${esc(todoPriorityNames[todo.priority] || '待处理')}</span></div>
          <div class="notice-todo-meta"><span>${overdue ? esc(todo.overdueDurationLabel || '已逾期') : todo.dueState === 'today' ? '今天到期' : `截止 ${esc(deadline)}`}</span><b>${esc(todo.actionLabel || '进入处理')}　→</b></div>
        </article>`;
      }).join('')
      : '<div class="notice-dialog-empty"><b>当前没有操作提醒</b><span>新的节点、收款、整改和材料事项会自动出现在这里。</span></div>';
  }

  function renderTaskCenter() {
    const todos = state.dashboard?.todos || [];
    const query = String($('#taskSearch')?.value || '').trim().toLowerCase();
    const type = $('#taskTypeFilter')?.value || 'all';
    const priority = $('#taskPriorityFilter')?.value || 'all';
    const filtered = todos.filter((todo) => {
      const haystack = `${todo.title || ''} ${todo.description || ''} ${todo.projectName || ''}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (type === 'all' || todo.type === type)
        && (priority === 'all' || todo.priority === priority);
    });
    const sortMode = $('#taskSort')?.value || 'priority';
    const priorityRank = { danger: 0, attention: 1, normal: 2 };
    const ordered = [...filtered].sort((left, right) => {
      if (sortMode === 'project') return String(left.projectName || '').localeCompare(String(right.projectName || ''), 'zh-CN')
        || (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9);
      if (sortMode === 'due') return String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999'))
        || (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9);
      return (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
        || String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999'));
    });
    const counts = {
      total: todos.length,
      danger: todos.filter((item) => item.priority === 'danger').length,
      attention: todos.filter((item) => item.priority === 'attention').length,
      normal: todos.filter((item) => item.priority === 'normal').length,
      review: todos.filter((item) => item.type === 'pending_log').length,
      issue: todos.filter((item) => item.type === 'issue').length,
      delivery: todos.filter((item) => ['milestone', 'progress_delay'].includes(item.type)).length,
      finance: todos.filter((item) => ['payment_due', 'material_delay'].includes(item.type)).length,
      client: todos.filter((item) => item.type === 'client_response').length,
    };
    const urgencyMetrics = [['全部', counts.total], ['逾期 / 紧急', counts.danger, 'risk'], ['需关注', counts.attention], ['常规', counts.normal]];
    const businessMetrics = [['现场审核', counts.review], ['问题整改', counts.issue], ['施工与进度', counts.delivery], ['收款与材料', counts.finance], ['客户反馈', counts.client]];
    const metricGroup = (title, description, items) => `<section class="task-metric-group"><header><b>${title}</b><span>${description}</span></header><div>${items.map(([label, value, tone]) => `<span class="task-metric-item ${tone || ''}"><b>${value}</b><small>${label}</small></span>`).join('')}</div></section>`;
    $('#taskCenterMetrics').innerHTML = metricGroup('紧急度', '决定先处理什么', urgencyMetrics)
      + metricGroup('业务类型', '决定去哪里处理', businessMetrics);
    const taskContent = sortMode === 'priority'
      ? ['danger', 'attention', 'normal'].map((level) => {
        const rows = ordered.filter((todo) => todo.priority === level);
        if (!rows.length) return '';
        return `<section class="task-group ${level}"><div class="task-group-head"><b>${esc(todoPriorityNames[level])}</b><span>${rows.length} 项</span></div>${rows.map((todo) => todoCard(todo)).join('')}</section>`;
      }).join('')
      : ordered.map((todo) => todoCard(todo)).join('');
    $('#taskCenterList').innerHTML = ordered.length
      ? taskContent
      : `<div class="empty panel"><b>${todos.length ? '没有符合筛选条件的待办' : '当前待办已清空'}</b><p>${todos.length ? '可以更换类型、优先级或搜索条件。' : '新的现场审核、整改、节点和客户反馈会自动进入这里。'}</p></div>`;
  }

  function renderClientCenter() {
    const center = state.clientCenter || { metrics: {}, entries: [] };
    const metrics = center.metrics || {};
    $('#clientCenterMetrics').innerHTML = [
      ['客户项目', metrics.projects || 0], ['客户可访问', metrics.accessReady || 0],
      ['待客户查看', metrics.waitingView || 0], ['待回应意见', metrics.openResponses || 0],
      ['尚未发布', metrics.unpublished || 0],
    ].map(([label, value], index) => `<div class="${index === 3 && value ? 'risk' : ''}"><b>${value}</b><span>${label}</span></div>`).join('');
    const query = String($('#clientSearch')?.value || '').trim().toLowerCase();
    const status = $('#clientStatusFilter')?.value || 'all';
    const entries = (center.entries || []).filter((entry) => {
      const haystack = `${entry.project?.name || ''} ${entry.project?.customerName || ''} ${entry.project?.location || ''} ${entry.binding?.customerName || ''} ${entry.binding?.customerUsername || ''}`.toLowerCase();
      return (!query || haystack.includes(query)) && (status === 'all' || entry.deliveryState === status);
    });
    $('#clientCenterList').innerHTML = entries.length ? entries.map((entry) => {
      const project = entry.project || {};
      const binding = entry.binding || { active: false };
      const publication = entry.latestPublication;
      const latestText = publication
        ? `${formatDate(publication.createdAt, true)} · ${esc(publication.stage || project.stage || '')} · ${Number(publication.progress || 0)}%`
        : '尚未向客户发布进度';
      const responseText = entry.openResponseCount
        ? `${entry.openResponseCount} 条待回应${entry.latestResponse?.content ? ` · ${esc(entry.latestResponse.content)}` : ''}`
        : '暂无待回应意见';
      return `<article class="client-center-card" data-project-id="${esc(project.id)}" data-project-tab-target="client" tabindex="0" role="link" aria-label="打开客户交付：${esc(project.name)}">
        <div class="client-center-project"><h3>${esc(project.customerName || '未填写客户')}</h3><p>${esc(project.name)} · ${esc(project.location || '未填写地址')}</p></div>
        <div class="client-center-binding"><b>${binding.active ? esc(binding.customerName || binding.customerUsername) : entry.shareActive ? '备用链接已启用' : '尚未开通客户访问'}</b><span>${binding.active ? esc(binding.customerUsername) : entry.shareActive ? '客户可通过专属链接查看' : '请绑定账号或生成备用链接'}</span></div>
        <div class="client-center-publication"><b>${latestText}</b><span>${entry.lastViewedAt ? `最近查看 ${formatDate(entry.lastViewedAt, true)}` : publication ? '客户尚未查看' : '发布后才会同步'}</span></div>
        <div class="client-center-response"><b>${responseText}</b><span>${entry.openResponseCount ? '请进入项目处理' : '客户确认与留言正常'}</span></div>
        <div class="client-center-enter"><span class="badge ${esc(entry.deliveryState === 'attention' ? 'attention' : ['active', 'shared_link'].includes(entry.deliveryState) ? 'normal' : entry.deliveryState === 'waiting_view' ? 'attention' : 'returned')}">${esc(clientDeliveryNames[entry.deliveryState] || '待配置')}</span><b>${entry.deliveryState === 'unbound' ? '开通客户访问' : entry.openResponseCount ? '处理客户意见' : '进入客户交付'}　→</b></div>
      </article>`;
    }).join('') : `<div class="empty panel"><b>${center.entries?.length ? '没有符合筛选条件的客户项目' : '还没有客户项目'}</b><p>${center.entries?.length ? '可以更换状态或搜索条件。' : '创建项目后，在项目“客户同步”中绑定客户账号并发布进度。'}</p></div>`;
    $$('#clientCenterList .client-center-card').forEach((card, index) => {
      const entry = entries[index];
      if (!entry) return;
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'secondary client-center-bind-button';
      action.dataset.clientCenterOpen = 'true';
      action.dataset.projectId = entry.project?.id || '';
      action.textContent = entry.binding?.active ? '查看绑定与同步' : '绑定 / 邀请客户';
      card.querySelector('.client-center-enter')?.appendChild(action);
    });
  }

  function renderDashboard() {
    const metrics = state.dashboard.metrics;
    const items = [
      ['在管项目', metrics.projects, '当前可访问项目', '', false],
      ['计划未配置', metrics.planMissing || 0, '项目尚未建立施工基准', metrics.planMissing ? 'coral' : 'quiet', true],
      ['项目已滞后', metrics.delayed || 0, '存在受阻或逾期节点', metrics.delayed ? 'coral' : 'quiet', true],
      ['整改已逾期', metrics.overdueIssues || 0, `${metrics.openIssues || 0} 项整改尚未关闭`, metrics.overdueIssues ? 'coral' : 'quiet', true],
      ['收款已逾期', metrics.overduePayments || 0, `${formatMoney(metrics.overduePaymentAmount || 0)} 待收`, metrics.overduePayments ? 'coral' : 'quiet', true],
      ['材料已延期', metrics.delayedMaterials || 0, '计划到场但尚未到场', metrics.delayedMaterials ? 'coral' : 'quiet', true],
      ['待审现场', metrics.pendingLogs, '现场照片等待审核', metrics.pendingLogs ? '' : 'quiet', true],
      ['客户待回应', metrics.openClientResponses || 0, '调整要求或留言', metrics.openClientResponses ? '' : 'quiet', true],
    ];
    $('#metricGrid').innerHTML = items.map(([label, value, note, tone, healthyZero]) => `
      <div class="metric ${tone}${healthyZero && !Number(value) ? ' is-healthy-zero' : ''}"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('');
    $('#dashboardProjects').innerHTML = state.dashboard.projects.length
      ? state.dashboard.projects.slice(0, 6).map((project) => projectCard(project, 'overview', true)).join('')
      : '<div class="empty">还没有企业项目。企业负责人可以点击“新建项目”。</div>';
    renderProjectDirectory();
    const totalTasks = Number(metrics.todayTodos ?? state.dashboard.todos?.length ?? 0);
    const hour = new Date().getHours();
    $('#greetingText').textContent = `${hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好'}，${state.me?.nickname || state.me?.username || '负责人'}。`;
    $('#dashboardTitle').textContent = `今天有 ${totalTasks} 项需要处理。`;
    $('#dashboardSummary').textContent = `${metrics.planMissing || 0} 个项目未配置计划、${metrics.delayed || 0} 个项目滞后、${metrics.overduePayments || 0} 笔收款逾期、${metrics.delayedMaterials || 0} 项材料延期。`;
    const todoStats = state.dashboard.todoStats || {};
    $('#heroTaskSummary').textContent = `${todoStats.overdue ?? metrics.overdueTodos ?? 0} 项逾期 · ${todoStats.dueToday || 0} 项今日到期 · ${todoStats.pendingReview ?? metrics.pendingLogs ?? 0} 项待审核 · ${todoStats.pendingReply ?? metrics.openClientResponses ?? 0} 项待回复`;
    $('#taskNavCount').textContent = totalTasks;
    $('#projectNavCount').textContent = metrics.projects;
    $('#photoNavCount').textContent = state.photoLibrary?.metrics?.photos
      ?? state.dashboard.projects.reduce((sum, project) => sum + Number(project.siteLogCount || 0), 0);
    $('#trashNavCount').textContent = state.mediaTrash?.metrics?.photos || 0;
    $('#issueNavCount').textContent = metrics.openIssues;
    $('#clientNavCount').textContent = metrics.openClientResponses || 0;
    $('#workerNavCount').textContent = state.workforce?.metrics?.assignedToday || 0;
    $('#operationNavCount').textContent = Number(state.operations?.metrics?.overduePayments || 0) + Number(state.operations?.metrics?.delayedMaterials || 0) + Number(state.operations?.metrics?.pendingChanges || 0);
    $('#noticeCount').textContent = totalTasks;
    const dashboardTodos = (state.dashboard.homeTodos || state.dashboard.todos || []).slice(0, 3);
    const allTaskCount = (state.dashboard.todos || []).length;
    $('#actionQueue').innerHTML = dashboardTodos.length
      ? `<div class="queue-list todo-queue">${dashboardTodos.map((todo) => todoCard(todo, true)).join('')}</div><button class="queue-all" type="button" data-view="tasks" data-nav-key="tasks">进入待办中心查看全部 ${allTaskCount} 项　→</button>`
      : '<div class="empty compact"><b>今天没有待处理事项</b><p>新的审核、整改、节点和客户反馈会自动出现在这里。</p></div>';
    renderNoticeDialog();
    renderTaskCenter();
    renderStorage();
    renderWorkforce();
  }

  function renderOperations() {
    if (!state.operations || !$('#operationsMetrics')) return;
    const metrics = state.operations.metrics || {};
    const remainingReceivable = metrics.remainingReceivableAmount ?? metrics.totalOutstandingAmount
      ?? metrics.totalRemainingReceivable ?? metrics.remainingReceivable ?? metrics.remainingAmount
      ?? Math.max(0, Number(metrics.adjustedContractAmount || 0) - Number(metrics.receivedAmount || 0));
    const expectedGrossProfit = metrics.projectedMarginAmount ?? metrics.budgetedGrossProfit ?? metrics.expectedGrossProfit;
    const confirmedCostBalance = metrics.confirmedCostBalance ?? metrics.currentGrossProfit ?? 0;
    const operationItems = [
      ['调整后合同额', formatMoney(metrics.adjustedContractAmount || 0), '已授权项目合同汇总', ''],
      ['累计已收', formatMoney(metrics.receivedAmount || 0), '当前回款总额', 'green'],
      ['总剩余应收', formatMoney(remainingReceivable), '调整后合同额减累计已收', Number(remainingReceivable) ? 'attention' : 'green'],
      ['项目现金余额', formatMoney(metrics.cashBalance || 0), '累计回款减累计支出', Number(metrics.cashBalance) < 0 ? 'coral' : 'green'],
      ['合同额扣已确认支出余额', formatMoney(confirmedCostBalance), '非最终利润', ''],
      ['未来 30 天应收', formatMoney(metrics.next30DaysReceivable || 0), '近期资金回笼计划', 'attention'],
      ['逾期收款', metrics.overduePayments || 0, `${formatMoney(metrics.overduePaymentAmount || 0)} 待收`, metrics.overduePayments ? 'coral' : 'green'],
      expectedGrossProfit != null
        ? ['预算毛利', formatMoney(expectedGrossProfit), '合同额减成本预算；未设预算时按计划成本', Number(expectedGrossProfit) < 0 ? 'coral' : 'green']
        : ['材料延期', metrics.delayedMaterials || 0, '计划到场但尚未完成', metrics.delayedMaterials ? 'coral' : 'green'],
    ];
    $('#operationsMetrics').innerHTML = operationItems.map(([label, value, note, tone]) => `<div class="operation-metric ${tone}"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('');
    const search = ($('#operationsSearch')?.value || '').trim().toLowerCase();
    const risk = $('#operationsRiskFilter')?.value || 'all';
    const entries = (state.operations.entries || []).filter((entry) => {
      const project = entry.project || {};
      const haystack = `${project.name || ''} ${project.customerName || ''} ${project.managerName || ''} ${project.siteManagerName || ''} ${project.location || ''}`.toLowerCase();
      return (!search || haystack.includes(search)) && (risk === 'all' || entry.riskLevel === risk);
    });
    const operationsSort = $('#operationsSort')?.value || 'risk';
    const riskRank = { danger: 0, attention: 1, normal: 2 };
    entries.sort((left, right) => {
      if (operationsSort === 'receivable') return Number(right.business?.remainingAmount || 0) - Number(left.business?.remainingAmount || 0);
      if (operationsSort === 'material') return Number(right.materials?.delayed || 0) - Number(left.materials?.delayed || 0);
      if (operationsSort === 'cash') return Number(left.business?.cashBalance || 0) - Number(right.business?.cashBalance || 0);
      return (riskRank[left.riskLevel] ?? 9) - (riskRank[right.riskLevel] ?? 9)
        || Number(right.business?.overdueAmount || 0) - Number(left.business?.overdueAmount || 0);
    });
    const materialStatusNames = { planned: '待下单', ordered: '已下单', in_transit: '运输中', arrived: '已到场', accepted: '已验收' };
    $('#operationsList').innerHTML = entries.length ? entries.map((entry) => {
      const project = entry.project || {};
      const business = entry.business;
      const materials = entry.materials || {};
      const nextMaterial = (materials.items || []).find((item) => !['arrived', 'accepted'].includes(item.status));
      const riskLabel = entry.riskLevel === 'danger' ? '需要立即处理' : entry.riskLevel === 'attention' ? '近期需关注' : '当前正常';
      const targetSection = business?.overdueCount ? 'finance' : (materials.delayed || nextMaterial ? 'costs' : (business ? 'finance' : 'costs'));
      const targetId = business?.nextOverduePaymentId || nextMaterial?.id || '';
      return `<article class="operations-row" data-project-id="${esc(project.id)}" data-project-tab-target="${targetSection}" data-project-focus-id="${esc(targetId)}" tabindex="0" role="link" aria-label="打开经营项目：${esc(project.name)}">
        <div class="operations-project"><b>${esc(project.name)}</b><span>${esc(project.customerName || '未填写客户')} · ${esc(project.managerName || '未分配负责人')}</span></div>
        <div class="operations-money">${business ? `<b>${formatMoney(business.cashBalance)} 现金余额</b><span>总剩余应收 ${formatMoney(business.remainingAmount)} · 合同扣支出余额 ${formatMoney(business.currentGrossProfit)}（非最终利润）</span>` : '<b>未开通合同收款权限</b><span>请联系企业负责人开放“合同收款”大项及查看权限</span>'}</div>
        <div class="operations-risk-cell"><b class="${business?.overdueCount ? 'danger-text' : ''}">${business?.overdueCount || 0} 笔</b><span>${business?.overdueCount ? `${formatMoney(business.overdueAmount)} 已逾期` : business ? '暂无逾期收款' : '无查看权限'}</span></div>
        <div class="operations-material"><b class="${materials.delayed ? 'danger-text' : ''}">${materials.delayed || 0} 项延期</b><span>${nextMaterial ? `${esc(nextMaterial.name)} · ${materialStatusNames[nextMaterial.status] || nextMaterial.status} · ${esc(nextMaterial.plannedArrivalDate)}` : '暂无待到场材料'}</span></div>
        <div class="operations-status"><span class="badge ${entry.riskLevel === 'danger' ? 'returned' : entry.riskLevel === 'attention' ? 'attention' : 'normal'}">${riskLabel}</span></div>
        <div class="operations-enter"><button class="secondary" type="button">进入${targetSection === 'finance' ? '合同收款' : '成本管理'}　→</button></div>
      </article>`;
    }).join('') : '<div class="empty panel"><b>没有符合条件的项目</b><p>可更换风险筛选或搜索关键词。</p></div>';
    $('#operationNavCount').textContent = Number(metrics.overduePayments || 0) + Number(metrics.delayedMaterials || 0) + Number(metrics.pendingChanges || 0);
  }

  async function refreshOperations() {
    state.operations = await api(`/api/organizations/${state.organization.id}/operations`);
    renderOperations();
  }

  function activityCategory(action = '') {
    if (/payment|cost|material|change_order|purchase/.test(action)) return 'finance';
    if (/site_log|issue|checklist|milestone|media|worker/.test(action)) return 'site';
    if (/client|customer/.test(action)) return 'client';
    if (/organization|member|owner_transfer|report_branding/.test(action)) return 'organization';
    return 'project';
  }

  function activityLabel(entry) {
    const clientLabels = {
      'enterprise.report_branding_update': '更新报告与表头',
    };
    const label = clientLabels[entry.action] || entry.actionLabel || '';
    return /^[a-z0-9_.-]+$/i.test(label) ? '企业操作' : label;
  }

  function activityDetailText(entry) {
    const details = entry.details || {};
    const parts = [];
    if (details.status) parts.push(`状态：${statusNames[details.status] || details.status}`);
    if (details.stage) parts.push(`阶段：${details.stage}`);
    if (details.trade) parts.push(`工种：${details.trade}`);
    if (details.managerTitle) parts.push(`岗位名称：${details.managerTitle}`);
    if (details.brandMode) parts.push(`抬头：${details.brandMode === 'logo' ? '公司 Logo' : '企业文字'}`);
    if (details.reason) parts.push(`原因：${details.reason}`);
    if (details.amount != null) parts.push(`金额：${formatMoney(details.amount)}`);
    if (details.actualAmount != null) parts.push(`实付：${formatMoney(details.actualAmount)}`);
    if (details.before && details.after) {
      const beforeAmount = details.before.amount ?? details.before.actualAmount ?? details.before.paidAmount;
      const afterAmount = details.after.amount ?? details.after.actualAmount ?? details.after.paidAmount;
      if (beforeAmount != null || afterAmount != null) parts.push(`金额 ${formatMoney(beforeAmount || 0)} → ${formatMoney(afterAmount || 0)}`);
      const beforeStatus = details.before.status;
      const afterStatus = details.after.status;
      if (beforeStatus || afterStatus) parts.push(`状态 ${statusNames[beforeStatus] || beforeStatus || '未设置'} → ${statusNames[afterStatus] || afterStatus || '未设置'}`);
    }
    return parts.join(' · ');
  }

  function renderActivity() {
    if (!state.activity || !$('#activityList')) return;
    const projectSelect = $('#activityProjectFilter');
    const selectedProject = projectSelect.value || 'all';
    projectSelect.innerHTML = '<option value="all">全部项目</option>' + (state.activity.projects || [])
      .map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join('');
    if ([...(state.activity.projects || []).map((project) => project.id), 'all'].includes(selectedProject)) projectSelect.value = selectedProject;
    const search = ($('#activitySearch').value || '').trim().toLowerCase();
    const type = $('#activityTypeFilter')?.value || 'all';
    const entries = (state.activity.entries || []).filter((entry) => {
      const detailText = activityDetailText(entry);
      const haystack = `${activityLabel(entry)} ${entry.actorName || ''} ${entry.projectName || ''} ${detailText}`.toLowerCase();
      return (!search || haystack.includes(search))
        && (projectSelect.value === 'all' || entry.projectId === projectSelect.value)
        && (type === 'all' || activityCategory(entry.action) === type);
    });
    $('#activityList').innerHTML = entries.length ? entries.map((entry) => `<article class="activity-row">
      <span class="activity-icon"><img class=xz-icon src=assets/icons/user.svg alt aria-hidden=true></span>
      <div><b>${esc(activityLabel(entry) || '企业操作')}</b><p>${esc(entry.actorName || '系统')} · ${esc(entry.projectName || '企业设置')}${activityDetailText(entry) ? ` · ${esc(activityDetailText(entry))}` : ''}</p></div>
      <time>${formatDate(entry.createdAt, true)}</time>
    </article>`).join('') : '<div class="empty panel"><b>没有符合条件的操作记录</b><p>调整项目筛选或搜索关键词后再查看。</p></div>';
  }

  async function refreshActivity() {
    const projectId = $('#activityProjectFilter')?.value;
    state.activity = await api(`/api/organizations/${state.organization.id}/activity${projectId && projectId !== 'all' ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
    renderActivity();
  }

  function renderStorage() {
    if (!state.dashboard) return;
    const { storageUsedBytes, storageQuotaBytes } = state.dashboard.metrics;
    const percent = storageQuotaBytes ? Math.min(100, storageUsedBytes / storageQuotaBytes * 100) : 0;
    const subscription = state.organization?.subscription || {};
    const photoMetrics = state.photoLibrary?.metrics || {};
    const subscriptionView = enterpriseSubscriptionView(subscription, state.organization?.accessMode);
    const planLabel = subscriptionView.planLabel;
    const accessLabel = state.organization?.accessMode === 'readonly' ? '到期只读' : '正常使用';
    $('#storagePanel').innerHTML = `
      <div class="storage-plan">
        <div><span>当前套餐</span><b>${esc(planLabel)} · ${accessLabel}</b></div>
        <div><span>服务有效期</span><b>${formatDate(subscription.startsAt)} 至 ${formatDate(subscription.endsAt)} · ${esc(subscriptionView.daysRemaining == null ? '未设置提醒' : subscriptionView.daysRemaining < 0 ? '已到期' : subscriptionView.daysRemaining === 0 ? '今天到期' : `剩余 ${subscriptionView.daysRemaining} 天`)}</b></div>
        <div><span>账号与项目额度</span><b>${subscription.adminLimit || 0} 个管理席位 · ${subscription.memberLimit || 0} 个成员席位 · ${subscription.projectLimit || 0} 个在管项目</b></div>
      </div>
      <div class="storage-number"><b>${formatBytes(storageUsedBytes)}</b><span>/ ${formatBytes(storageQuotaBytes)}</span></div>
      <div class="storage-bar ${percent >= 85 ? 'risk' : percent >= 70 ? 'attention' : ''}"><i style="width:${Math.max(.3, percent)}%"></i></div>
      <div class="storage-breakdown"><span><b>${photoMetrics.siteLogPhotos || 0}</b>现场照片</span><span><b>${photoMetrics.issuePhotos || 0}</b>整改照片</span><span><b>${photoMetrics.acceptancePhotos || 0}</b>验收照片</span><span><b>${photoMetrics.photos || 0}</b>照片合计</span></div>
      <p class="storage-note">已使用 ${percent.toFixed(2)}%。${percent >= 85 ? '空间已接近上限，建议尽快清理回收站或联系管理员扩容。' : percent >= 70 ? '空间使用已超过 70%，建议关注后续现场照片增长。' : '当前空间充足。'}同一企业套餐同时覆盖网页版和小程序端，成员无需重复购买；客户进度页只读取已发布照片。</p>`;
  }

  function dateOffset(value, days) {
    const result = new Date(`${value}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
  }

  function workforceDates(startDate) {
    return Array.from({ length: 14 }, (_, index) => {
      const value = dateOffset(startDate, index);
      const parsed = new Date(`${value}T00:00:00`);
      return {
        value,
        day: `${parsed.getMonth() + 1}/${parsed.getDate()}`,
        weekday: '日一二三四五六'[parsed.getDay()],
        today: value === localDateValue(),
      };
    });
  }

  async function loadWorkforceData(startDate = state.workforceStartDate) {
    if (!canUseWorkforce()) return;
    state.workforceStartDate = startDate;
    state.workforce = await api(`/api/organizations/${state.organization.id}/workforce?dateFrom=${encodeURIComponent(startDate)}&dateTo=${encodeURIComponent(dateOffset(startDate, 13))}`);
    renderWorkforce();
    $('#workerNavCount').textContent = state.workforce?.metrics?.assignedToday || 0;
  }

  function renderWorkforce() {
    if (!canUseWorkforce() || !state.workforce || !$('#workforceBoard')) return;
    const workforce = state.workforce;
    const metrics = workforce.metrics || {};
    $('#workforceMetrics').innerHTML = [
      ['工人档案', metrics.workers || 0, '全部登记工人'],
      ['今日在岗', metrics.assignedToday || 0, '已分配到工地'],
      ['今日可调配', metrics.availableToday || 0, '可安排新工地'],
      ['未来 7 天派工', metrics.next7DayAssignments || 0, '施工安排数量'],
    ].map(([label, value, note], index) => `<div class="${index === 2 && value ? 'available' : ''}"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('');
    $('#workforceStartDate').value = state.workforceStartDate;
    const trades = [...new Set((workforce.workers || []).map((worker) => worker.trade).filter(Boolean))].sort();
    const selectedTrade = $('#workerTradeFilter').value || 'all';
    $('#workerTradeFilter').innerHTML = '<option value="all">全部工种</option>' + trades.map((trade) => `<option value="${esc(trade)}">${esc(trade)}</option>`).join('');
    if (trades.includes(selectedTrade)) $('#workerTradeFilter').value = selectedTrade;
    $('#assignmentWorkerSelect').innerHTML = (workforce.workers || []).filter((worker) => worker.status === 'active').map((worker) => `<option value="${esc(worker.id)}">${esc(worker.name)} · ${esc(worker.trade)}</option>`).join('');
    $('#assignmentProjectSelect').innerHTML = (workforce.projects || []).map((project) => `<option value="${esc(project.id)}">${esc(project.name)} · ${esc(project.stage)}</option>`).join('');

    const query = String($('#workerSearch').value || '').trim().toLowerCase();
    const tradeFilter = $('#workerTradeFilter').value || 'all';
    const statusFilter = $('#workerStatusFilter').value || 'active';
    const today = localDateValue();
    const assignments = workforce.assignments || [];
    const workers = (workforce.workers || []).filter((worker) => {
      const current = Boolean(worker.assignedToday);
      const haystack = `${worker.name} ${worker.trade} ${worker.phone} ${assignments.filter((item) => item.workerId === worker.id).map((item) => item.projectName).join(' ')}`.toLowerCase();
      const statusMatch = statusFilter === 'all'
        || (statusFilter === 'active' && worker.status === 'active')
        || (statusFilter === 'available' && worker.status === 'active' && !current)
        || (statusFilter === 'assigned' && current);
      return (!query || haystack.includes(query)) && (tradeFilter === 'all' || worker.trade === tradeFilter) && statusMatch;
    });
    const dates = workforceDates(state.workforceStartDate);
    const board = [];
    board.push('<div class="workforce-board-corner">工人 / 工种</div>');
    dates.forEach((item) => board.push(`<div class="workforce-date-head ${item.today ? 'today' : ''}"><b>${esc(item.day)}</b><span>周${esc(item.weekday)}</span></div>`));
    workers.forEach((worker, workerIndex) => {
      const row = workerIndex + 2;
      board.push(`<div class="workforce-worker-cell" style="grid-row:${row}"><span class="worker-avatar"><img class=xz-icon src=assets/icons/user.svg alt aria-hidden=true></span><div><b>${esc(worker.name)}</b><small>${esc(worker.trade)} · ${esc(worker.skillLevel)}</small></div><button type="button" data-worker-edit="${esc(worker.id)}" aria-label="编辑${esc(worker.name)}"><img class=xz-icon src=assets/icons/more.svg alt aria-hidden=true></button></div>`);
      dates.forEach((item, dateIndex) => board.push(`<div class="workforce-day-cell ${item.today ? 'today' : ''}" style="grid-row:${row};grid-column:${dateIndex + 2}"></div>`));
      assignments.filter((item) => item.workerId === worker.id).forEach((item) => {
        const clippedStart = item.startDate < dates[0].value ? dates[0].value : item.startDate;
        const clippedEnd = item.endDate > dates[13].value ? dates[13].value : item.endDate;
        if (clippedStart > clippedEnd) return;
        const startIndex = Math.round((new Date(`${clippedStart}T00:00:00`) - new Date(`${dates[0].value}T00:00:00`)) / 86400000);
        const endIndex = Math.round((new Date(`${clippedEnd}T00:00:00`) - new Date(`${dates[0].value}T00:00:00`)) / 86400000);
        board.push(`<button type="button" class="workforce-assignment-bar ${esc(item.timing)}" style="grid-row:${row};grid-column:${startIndex + 2}/span ${endIndex - startIndex + 1}" data-assignment-edit="${esc(item.id)}" title="${esc(`${item.projectName} · ${item.startDate} 至 ${item.endDate}`)}"><b>${esc(item.projectName)}</b><span>${esc(item.workContent || `${item.days} 天`)}</span></button>`);
      });
    });
    $('#workforceBoard').innerHTML = workers.length ? board.join('') : '<div class="empty workforce-empty">没有符合筛选条件的工人</div>';

    const timingNames = { current: '正在施工', upcoming: '待进场', completed: '已结束' };
    $('#workforceAssignmentList').innerHTML = assignments.length ? assignments.map((item) => `
      <article class="workforce-assignment-row">
        <div class="worker-inline"><span class="worker-avatar"><img class=xz-icon src=assets/icons/user.svg alt aria-hidden=true></span><div><b>${esc(item.workerName)}</b><small>${esc(item.workerTrade)}</small></div></div>
        <div><b>${esc(item.projectName)}</b><small>${esc(item.projectLocation || '工地地址未填写')}</small></div>
        <div><b>${esc(item.workContent || '现场施工')}</b><small>${esc(item.note || '无备注')}</small></div>
        <div><b>${esc(item.startDate)} 至 ${esc(item.endDate)}</b><small>${timingNames[item.timing] || item.timing}</small></div>
        <span class="assignment-days">${item.days} 天</span>
        <div class="assignment-actions">${item.editable ? `<button class="ghost" type="button" data-assignment-edit="${esc(item.id)}">调整派工</button><details class="action-more-menu"><summary>更多操作</summary><div><button class="danger" type="button" data-assignment-delete="${esc(item.id)}">取消派工</button></div></details>` : '<span class="badge pending">其他负责人安排</span>'}</div>
      </article>`).join('') : '<div class="empty"><b>当前日期范围没有派工记录</b><p>点击“安排工地”建立第一条排班。</p></div>';
  }

  function updateAssignmentDuration() {
    const form = $('#assignmentForm');
    const start = form.elements.startDate.value;
    const end = form.elements.endDate.value;
    if (!start || !end) {
      $('#assignmentDuration').textContent = '请选择开始和结束日期';
      return;
    }
    const days = Math.floor((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
    $('#assignmentDuration').textContent = days > 0 ? `本次计划施工 ${days} 天` : '结束日期不能早于开始日期';
    $('#assignmentDuration').classList.toggle('error', days <= 0);
  }

  function openWorkerDialog(worker = null) {
    const form = $('#workerForm');
    form.reset();
    form.elements.workerId.value = worker?.id || '';
    form.elements.name.value = worker?.name || '';
    form.elements.phone.value = worker?.phone || '';
    form.elements.trade.value = worker?.trade || '';
    form.elements.skillLevel.value = worker?.skillLevel || '熟练';
    form.elements.status.value = worker?.status || 'active';
    form.elements.note.value = worker?.note || '';
    $('#workerDialog h2').textContent = worker ? '编辑工人档案' : '新增工人档案';
    $('#workerDialog button[type="submit"]').textContent = worker ? '保存修改' : '保存工人';
    $('#workerDialog').showModal();
  }

  function openAssignmentDialog(workerId = '', assignment = null) {
    const form = $('#assignmentForm');
    form.reset();
    delete form.dataset.assignmentId;
    form.elements.startDate.value = assignment?.startDate || localDateValue();
    form.elements.endDate.value = assignment?.endDate || form.elements.startDate.value;
    if (assignment) {
      form.dataset.assignmentId = assignment.id;
      ['workerId', 'projectId', 'workContent', 'startDate', 'endDate', 'note'].forEach((name) => {
        if (form.elements[name] && assignment[name] != null) form.elements[name].value = assignment[name];
      });
      $('#assignmentDialog h2').textContent = '调整派工安排';
      $('#assignmentDialog button[type="submit"]').textContent = '保存派工调整';
    } else {
      $('#assignmentDialog h2').textContent = '安排工地';
      $('#assignmentDialog button[type="submit"]').textContent = '确认派工';
    }
    if (workerId && (state.workforce?.workers || []).some((worker) => worker.id === workerId && worker.status === 'active')) {
      form.elements.workerId.value = workerId;
    }
    updateAssignmentDuration();
    $('#assignmentDialog').showModal();
  }

  function renderPhotoLibrary() {
    const library = state.photoLibrary || { metrics: {}, entries: [] };
    const metrics = library.metrics || {};
    $('#photoLibraryMetrics').innerHTML = [
      ['全部照片', metrics.photos || 0],
      ['现场记录', metrics.siteLogPhotos || 0],
      ['整改照片', metrics.issuePhotos || 0],
      ['验收照片', metrics.acceptancePhotos || 0],
    ].map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join('');
    const projectSelect = $('#photoProjectFilter');
    const selectedProject = projectSelect?.value || 'all';
    const projectOptions = [...new Map((library.entries || []).map((entry) => [entry.projectId, entry.projectName])).entries()];
    if (projectSelect) {
      projectSelect.innerHTML = '<option value="all">全部项目</option>' + projectOptions
        .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
      if (selectedProject === 'all' || projectOptions.some(([id]) => id === selectedProject)) projectSelect.value = selectedProject;
    }
    const query = String($('#photoSearch')?.value || '').trim().toLowerCase();
    const projectId = projectSelect?.value || 'all';
    const sourceType = $('#photoTypeFilter')?.value || 'all';
    const status = $('#photoStatusFilter')?.value || 'all';
    const entries = (library.entries || []).filter((entry) => {
      const haystack = `${entry.projectName || ''} ${entry.projectStage || ''} ${entry.title || ''} ${entry.summary || ''} ${entry.createdByName || ''} ${entry.sourceLabel || ''}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (projectId === 'all' || entry.projectId === projectId)
        && (sourceType === 'all' || entry.sourceType === sourceType)
        && (status === 'all' || entry.status === status);
    });
    const visiblePhotos = entries.reduce((sum, entry) => sum + Number(entry.media?.length || 0), 0);
    if ($('#photoFilterResult')) $('#photoFilterResult').textContent = `当前 ${entries.length} 条记录 · ${visiblePhotos} 张照片`;
    $('#photoLibraryGrid').innerHTML = entries.length
      ? entries.map((entry) => {
        const photos = entry.media || [];
        const displayPhotos = photos.slice(0, 6);
        const remainingPhotos = Math.max(0, photos.length - displayPhotos.length);
        const projectTab = entry.sourceType === 'milestone_acceptance' ? 'overview' : entry.sourceType === 'issue' ? 'issues' : 'logs';
        return `
          <article class="photo-library-card">
            <div class="photo-library-head"><div><h2>${esc(entry.projectName)}</h2><p>${esc(entry.sourceLabel)} · ${esc(entry.createdByName || '企业成员')} · ${esc(formatDate(entry.createdAt, true))}</p></div><div class="photo-library-state"><span class="photo-library-count">${photos.length} 张</span><span class="badge ${esc(entry.status)}">${esc(statusNames[entry.status] || '状态待确认')}</span></div></div>
            <h3>${esc(entry.title)}</h3>
            ${entry.summary ? `<p class="photo-library-summary">${esc(entry.summary)}</p>` : ''}
            <div class="photo-library-strip">${displayPhotos.map((media, index) => `<div class="managed-photo"><button type="button" data-photo-preview data-photo-url="${esc(media.url)}" data-photo-caption="${esc(`${entry.projectName} · ${entry.title} · 第 ${index + 1} 张`)}"><img src="${esc(`${media.url}${media.url.includes('?') ? '&' : '?'}thumbnail=1`)}" alt="${esc(`${entry.projectName} ${entry.sourceLabel} 第 ${index + 1} 张照片`)}" loading="lazy"></button>${photoSyncBadge(media)}${state.role !== 'viewer' ? `<button class="photo-trash-button" type="button" data-media-trash="${esc(media.id)}" data-media-project="${esc(entry.projectId)}" aria-label="删除这张照片">删除</button>` : ''}</div>`).join('')}</div>
            ${remainingPhotos ? `<p class="photo-library-more">当前显示 6 张缩略图，另有 ${remainingPhotos} 张；进入项目后可查看全部照片。</p>` : ''}
            <button class="photo-library-action" type="button" data-project-id="${esc(entry.projectId)}" data-project-tab-target="${esc(projectTab)}">进入项目查看全部照片与操作　→</button>
          </article>`;
      }).join('')
      : `<div class="empty panel"><b>${library.entries?.length ? '没有符合筛选条件的照片' : '还没有企业照片'}</b><p>${library.entries?.length ? '可清空搜索词或更换项目、类型和状态后继续查看。' : '进入项目提交现场照片，或在问题整改中上传图片后，会自动汇总到这里。'}</p></div>`;
  }

  function issueNextAction(entry) {
    if (entry.actionLabel) return {
      label: entry.actionLabel,
      owner: entry.actionOwner?.name || entry.actionOwnerName || entry.ownerName || '项目负责人',
      rank: entry.status === 'review' ? 0 : entry.status === 'in_progress' ? 1 : entry.status === 'pending' ? 2 : 3,
    };
    if (entry.status === 'pending') return { label: '开始整改', owner: entry.ownerName || '整改负责人待分配', rank: 2 };
    if (entry.status === 'in_progress') return { label: '上传整改后照片并提交复核', owner: entry.ownerName || '整改负责人待分配', rank: 1 };
    if (entry.status === 'review') return { label: '复核结果并关闭或退回', owner: '项目负责人 / 企业管理员', rank: 0 };
    if (entry.status === 'closed') return { label: '查看整改闭环记录', owner: entry.ownerName || '项目成员', rank: 3 };
    if (entry.status === 'canceled') return { label: '查看撤销记录', owner: '项目负责人', rank: 4 };
    return { label: '打开整改记录', owner: entry.ownerName || '项目负责人', rank: 5 };
  }

  function renderIssueCenter() {
    const center = state.issueCenter || { metrics: {}, entries: [] };
    const metrics = center.metrics || {};
    $('#issueCenterMetrics').innerHTML = [
      ['未关闭', metrics.open || 0],
      ['已逾期', metrics.overdue || 0],
      ['待复核', metrics.review || 0],
      ['整改中', metrics.inProgress || 0],
      ['已关闭', metrics.closed || 0],
    ].map(([label, value], index) => `<div class="${index === 1 && value ? 'risk' : ''}"><b>${value}</b><span>${label}</span></div>`).join('');

    const query = String($('#issueSearch')?.value || '').trim().toLowerCase();
    const filter = $('#issueStatusFilter')?.value || 'open';
    const sortMode = $('#issueSort')?.value || 'action';
    const entries = (center.entries || []).filter((entry) => {
      const haystack = `${entry.title || ''} ${entry.description || ''} ${entry.projectName || ''} ${entry.ownerName || ''}`.toLowerCase();
      const statusMatch = filter === 'all'
        || (filter === 'open' && !['closed', 'canceled'].includes(entry.status))
        || (filter === 'overdue' && entry.overdue)
        || entry.status === filter;
      return (!query || haystack.includes(query)) && statusMatch;
    });
    entries.sort((left, right) => {
      if (sortMode === 'project') return String(left.projectName || '').localeCompare(String(right.projectName || ''), 'zh-CN')
        || String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999'));
      if (sortMode === 'due') return String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999'));
      return Number(!left.overdue) - Number(!right.overdue)
        || Number(left.priority !== 'urgent') - Number(right.priority !== 'urgent')
        || issueNextAction(left).rank - issueNextAction(right).rank
        || String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999'));
    });

    $('#issueCenterList').innerHTML = entries.length
      ? entries.map((entry) => {
        const beforePhotos = Number(entry.beforePhotoCount || 0);
        const afterPhotos = Number(entry.afterPhotoCount || 0);
        const statusClass = entry.status;
        const statusLabel = statusNames[entry.status] || entry.status;
        const nextAction = issueNextAction(entry);
        const elapsed = entry.overdueDurationLabel || (entry.overdue ? overdueDuration(entry.dueAt) : '');
        const elapsedText = /逾期/.test(String(elapsed || '')) ? String(elapsed) : `已逾期 ${elapsed}`;
        const deadline = entry.dueLabel || formatDeadline(entry.dueAt);
        const dueText = entry.dueAt
          ? `${entry.overdue ? '逾期于' : ['closed', 'canceled'].includes(entry.status) ? '原截止' : '截止'} ${deadline}${elapsed ? ` · ${elapsedText}` : ''}`
          : '未设置截止时间';
        return `
          <article class="issue-center-card" data-project-id="${esc(entry.projectId)}" data-project-tab-target="issues" tabindex="0" role="link" aria-label="${esc(nextAction.label)}：${esc(entry.title)}">
            <div class="issue-center-main">
              <div class="issue-center-title"><span class="issue-priority ${esc(entry.priority)}">${entry.priority === 'urgent' ? '紧急' : '普通'}</span><h3>${esc(entry.title)}</h3></div>
              <p>${esc(entry.description || '暂无整改说明')}</p>
            </div>
            <div class="issue-center-project"><b>${esc(entry.projectName)}</b><span>${esc(entry.projectStage || '未设置阶段')}</span></div>
            <div class="issue-center-owner"><b>${esc(entry.ownerName || '待分配')}</b><span class="${entry.overdue ? 'overdue' : ''}">${esc(dueText)}</span></div>
            <div class="issue-center-state"><span class="badge ${esc(statusClass)}">${esc(statusLabel)}</span>${entry.overdue && !['closed', 'canceled'].includes(entry.status) ? '<span class="issue-overdue-flag">已逾期</span>' : ''}</div>
            <div class="issue-center-enter"><b>${esc(nextAction.label)}</b><span>→</span><small>行动责任：${esc(nextAction.owner)} · 整改前 ${beforePhotos} 张 · 整改后 ${afterPhotos} 张</small></div>
          </article>`;
      }).join('')
      : `<div class="empty panel"><b>${center.entries?.length ? '没有符合筛选条件的整改记录' : '还没有整改任务'}</b><p>${center.entries?.length ? '可以更换状态或搜索条件继续查看。' : '进入具体项目发起整改后，会自动汇总到这里。'}</p></div>`;
  }

  function renderMembers() {
    const teamCollaboration = canUseTeamCollaboration();
    const inviteButton = $('#inviteMemberButton');
    if (inviteButton) {
      inviteButton.textContent = teamCollaboration ? '邀请成员' : '邀请成员（团队版）';
      inviteButton.classList.toggle('team-plan-upgrade', !teamCollaboration);
    }
    const teamPlanNotice = $('#teamPlanNotice');
    if (teamPlanNotice) teamPlanNotice.hidden = teamCollaboration;
    $('#memberList').innerHTML = state.members.map((member) => {
      const editable = canWrite() && member.role !== 'owner'
        && (state.role === 'owner' || (state.role === 'admin' && member.role !== 'admin'));
      const transferable = state.role === 'owner' && canWrite() && member.status === 'active' && member.role !== 'owner';
      const roleOptions = ['admin', 'project_manager', 'designer', 'finance', 'procurement', 'quality', 'viewer'].map((role) => `<option value="${role}" ${member.role === role ? 'selected' : ''}>${roleNames[role]}</option>`).join('');
      const memberModules = member.modulePermissions || roleModuleDefaults[member.role] || ['execution'];
      const moduleBadges = projectModuleOrder.filter((module) => memberModules.includes(module)).map((module) => `<em>${projectModuleLabels[module]}</em>`).join('') || '<em>未开放项目大项</em>';
      const memberActions = member.actionPermissions || [];
      const actionLabels = {
        'finance.plan': '编辑收款计划', 'finance.receive': '登记到账', 'finance.correct': '更正收款',
        'cost.plan': '设置成本计划', 'cost.confirm': '确认支出', 'cost.correct': '更正成本',
        'procurement.manage': '管理材料采购', 'procurement.pay': '登记材料付款', 'procurement.correct': '更正材料付款',
        'quality.manage': '处理质量记录', 'quality.approve': '复核质量结果',
      };
      const permissionEditor = state.role === 'owner' && member.role !== 'owner' && canWrite() ? `<details class="action-more-menu member-permission-menu"><summary>设置权限</summary><div><p>先控制可见大项，再按职责开放具体操作；网页和小程序同步生效。</p><b>可见大项</b>${projectModuleOrder.map((module) => `<label><input type="checkbox" value="${module}" data-member-module="${esc(member.id)}" ${memberModules.includes(module) ? 'checked' : ''}><span>${projectModuleLabels[module]}</span></label>`).join('')}<b>关键操作</b>${Object.entries(actionLabels).map(([action, label]) => `<label><input type="checkbox" value="${action}" data-member-action="${esc(member.id)}" ${memberActions.includes(action) ? 'checked' : ''}><span>${label}</span></label>`).join('')}<button class="primary" type="button" data-member-permissions-save="${esc(member.id)}">保存权限</button></div></details>` : '';
      return `
        <div class="member-row">
          <div class="member-identity"><span class="avatar"><img class=xz-icon src=assets/icons/user.svg alt aria-hidden=true></span><div><b>${esc(member.nickname || member.username)}</b><small>${esc(member.username)}<span class="member-compact-meta"> · ${esc(roleNames[member.role] || member.role)} · ${member.status === 'active' ? '正常' : '已停用'}</span></small><span class="member-module-badges">${moduleBadges}</span></div></div>
          <span>${roleNames[member.role] || member.role}</span>
          <span class="badge ${member.status === 'active' ? 'normal' : 'returned'}">${member.status === 'active' ? '正常' : '已停用'}</span>
          <div class="member-actions">${editable ? `<select data-member-role="${esc(member.id)}" data-original-role="${esc(member.role)}">${roleOptions}</select><button data-member-save="${esc(member.id)}" disabled>角色未更改</button><details class="action-more-menu member-risk-menu"><summary>更多操作</summary><div><button class="${member.status === 'active' ? 'danger' : ''}" data-member-status="${esc(member.id)}" data-next-status="${member.status === 'active' ? 'disabled' : 'active'}">${member.status === 'active' ? '停用企业权限' : '恢复企业权限'}</button>${transferable ? `<button class="danger" data-owner-transfer="${esc(member.id)}" data-member-name="${esc(member.nickname || member.username)}">移交企业负责人</button>` : ''}</div></details>` : ''}${permissionEditor || (!editable ? '<span>—</span>' : '')}</div>
        </div>`;
    }).join('');
    const assignableMembers = state.members;
    const managerOptions = assignableMembers.filter((member) => member.status === 'active' && ['owner', 'admin', 'project_manager'].includes(member.role))
      .map((member) => `<option value="${esc(member.id)}">${esc(member.nickname || member.username)}（${roleNames[member.role]}）</option>`).join('');
    const designerOptions = assignableMembers.filter((member) => member.status === 'active' && ['owner', 'admin', 'designer'].includes(member.role))
      .map((member) => `<option value="${esc(member.id)}">${esc(member.nickname || member.username)}（${roleNames[member.role]}）</option>`).join('');
    const issueOwnerOptions = assignableMembers.filter((member) => member.status === 'active' && member.role !== 'viewer')
      .map((member) => `<option value="${esc(member.id)}">${esc(member.nickname || member.username)}（${roleNames[member.role]}）</option>`).join('');
    $('#projectManagerSelect').innerHTML = managerOptions;
    if (state.membership?.id && assignableMembers.some((member) => (
      member.id === state.membership.id
      && member.status === 'active'
      && ['owner', 'admin', 'project_manager'].includes(member.role)
    ))) {
      $('#projectManagerSelect').value = state.membership.id;
    }
    $('#projectDesignerSelect').innerHTML = `<option value="">暂不指定</option>${designerOptions}`;
    $('#projectSiteManagerSelect').innerHTML = `<option value="">暂不指定</option>${issueOwnerOptions}`;
    $('#projectEditManagerSelect').innerHTML = managerOptions;
    $('#projectEditDesignerSelect').innerHTML = `<option value="">暂不指定</option>${designerOptions}`;
    $('#projectEditSiteManagerSelect').innerHTML = `<option value="">暂不指定</option>${issueOwnerOptions}`;
    $('#projectDesignerFilter').innerHTML = `<option value="">全部设计师</option>${designerOptions}`;
    $('#projectSiteManagerFilter').innerHTML = `<option value="">全部施工负责人（工长）</option>${issueOwnerOptions}`;
    $('#issueOwnerSelect').innerHTML = issueOwnerOptions;
    const purchaserSelect = $('#materialPurchaserSelect');
    if (purchaserSelect) purchaserSelect.innerHTML = `<option value="">暂不指定</option>${issueOwnerOptions}`;
  }

  async function loadOrganization(organizationId, targetView = 'dashboard') {
    projectRequestVersion += 1;
    showOnlyState('loadingState');
    const [organizationPayload, membersPayload, dashboard, operations, projectsPayload, photoLibrary, mediaTrash, issueCenter, clientCenter, activity] = await Promise.all([
      api(`/api/organizations/${organizationId}`),
      api(`/api/organizations/${organizationId}/members`),
      api(`/api/organizations/${organizationId}/dashboard`),
      api(`/api/organizations/${organizationId}/operations`),
      api(`/api/organizations/${organizationId}/projects?includeArchived=true`),
      api(`/api/organizations/${organizationId}/photo-library`),
      api(`/api/organizations/${organizationId}/media-trash`),
      api(`/api/organizations/${organizationId}/issue-center`),
      api(`/api/organizations/${organizationId}/client-center`),
      api(`/api/organizations/${organizationId}/activity`),
    ]);
    state.organization = organizationPayload.organization;
    state.membership = organizationPayload.membership;
    state.role = organizationPayload.membership.role;
    state.workforce = canUseWorkforce()
      ? await api(`/api/organizations/${organizationId}/workforce?dateFrom=${state.workforceStartDate}`)
      : null;
    state.members = membersPayload.members;
    state.dashboard = dashboard;
    state.operations = operations;
    state.photoLibrary = photoLibrary;
    state.mediaTrash = mediaTrash;
    state.siteLogTrash = null;
    state.unlinkedMedia = null;
    state.mediaLoadedRevision = -1;
    state.issueCenter = issueCenter;
    state.clientCenter = clientCenter;
    state.activity = activity;
    state.archivedProjects = (projectsPayload.projects || []).filter((project) => project.lifecycleStatus === 'archived');
    localStorage.setItem('xiaozhuangjia.enterprise.organizationId', organizationId);
    $('#workspaceSelect').value = organizationId;
    renderMembers();
    prepareReportBrandingSettingsForm();
    renderDashboard();
    renderOperations();
    renderPhotoLibrary();
    renderMediaTrash();
    renderIssueCenter();
    renderClientCenter();
    renderActivity();
    renderWorkforce();
    applyRoleVisibility();
    showOnlyState('enterpriseApp');
    showView(targetView);
  }

  function renderWorkspaceSelect() {
    $('#workspaceSelect').innerHTML = [
      '<option value="personal">个人空间</option>',
      ...state.workspaces.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${roleNames[item.role] || item.role}${item.accessMode === 'readonly' ? ' · 只读' : ''}</option>`),
    ].join('');
  }

  function showView(view, navKey = view) {
    const navigation = $$('.nav-item[data-view]').find((item) => item.dataset.view === view);
    if (navigation?.classList.contains('hidden')) {
      showToast('当前账号暂不可使用此功能', true);
      view = 'dashboard';
      navKey = 'dashboard';
    }
    projectRequestVersion += 1;
    state.activeNav = navKey;
    $$('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
    $$('.nav-item').forEach((el) => {
      const active = (el.dataset.navKey || el.dataset.view) === navKey;
      el.classList.toggle('active', active);
      if (active) {
        el.setAttribute('aria-current', 'page');
        if (window.matchMedia('(max-width: 820px)').matches) {
          requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }));
        }
      }
      else el.removeAttribute('aria-current');
    });
    const labels = {
      dashboard: ['核心工作', '企业工作台'], tasks: ['核心工作', '待办中心'], projects: ['项目执行', '施工项目'],
      assets: ['经营协同', view === 'trash' ? '图片回收站' : '影像资料'], issues: ['项目执行', '质量整改'], client: ['经营协同', '客户交付'],
      workforce: ['项目执行', '人员调配'], operations: ['经营协同', '收款与供应'],
      reports: ['企业设置', '报告与表头'], members: ['企业设置', '团队与权限'], storage: ['企业设置', '套餐与存储'], activity: ['企业设置', '操作记录'],
    };
    const label = labels[navKey] || labels.dashboard;
    $('#topbarKicker').textContent = `${state.organization?.name || '企业空间'} / ${label[0]}`;
    $('#topbarTitle').textContent = label[1];
    if (view !== 'project') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showProjectDirectory(intent = 'overview', navKey = '') {
    state.projectIntent = directoryConfig[intent] ? intent : 'overview';
    const config = directoryConfig[state.projectIntent];
    $('#projectDirectoryEyebrow').textContent = config.eyebrow;
    $('#projectDirectoryTitle').textContent = config.title;
    $('#projectDirectoryDescription').textContent = config.description;
    $('#projectSearch').value = '';
    $('#projectStatusFilter').value = '';
    $('#projectDesignerFilter').value = '';
    $('#projectSiteManagerFilter').value = '';
    renderProjectDirectory();
    showView('projects', navKey || config.nav);
  }

  function selectProjectTab(tab) {
    $$('[data-project-tab]').forEach((button) => button.classList.toggle('active', button.dataset.projectTab === tab));
    $$('.project-tab').forEach((el) => el.classList.toggle('active', el.id === `project-tab-${tab}`));
  }

  function selectProjectWorkspaceSection(section = 'execution') {
    const allowedSections = new Set(state.projectDetail?.modulePermissions || activeModulePermissions());
    const fallbackSection = projectModuleOrder.find((module) => allowedSections.has(module)) || '';
    state.projectSection = allowedSections.has(section) ? section : fallbackSection;
    $$('[data-project-section]').forEach((button) => button.classList.toggle('active', button.dataset.projectSection === state.projectSection));
    const overview = $('#project-tab-overview');
    if (overview) {
      overview.classList.remove('project-section-execution', 'project-section-finance', 'project-section-costs');
      if (state.projectSection !== 'client') overview.classList.add(`project-section-${state.projectSection}`);
    }
    selectProjectTab(state.projectSection === 'client' ? 'client' : 'overview');
    const titles = { execution: '施工执行', finance: '合同收款', costs: '成本管理', client: '客户交付' };
    $('#topbarTitle').textContent = titles[state.projectSection] || '项目概况';
  }

  function focusProjectRecord(targetId) {
    if (!targetId) return;
    const escaped = CSS.escape(String(targetId));
    const target = [
      `[data-material-record-id="${escaped}"]`, `[data-cost-record-id="${escaped}"]`,
      `[data-payment-record-id="${escaped}"]`, `[data-issue-id="${escaped}"]`,
      `[data-log-id="${escaped}"]`, `[data-milestone-node="${escaped}"]`,
    ].map((selector) => $(selector, $('#view-project'))).find(Boolean);
    if (!target) return;
    target.classList.add('focus-record');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => target.classList.remove('focus-record'), 2600);
  }

  async function openProject(projectId, tab = 'overview', options = {}) {
    const preservedScrollTop = options.preserveScroll ? window.scrollY : 0;
    const requestVersion = ++projectRequestVersion;
    const organizationId = state.organization.id;
    const isCurrent = () => requestVersion === projectRequestVersion && state.organization?.id === organizationId;
    try {
      const returnNav = state.activeNav;
      const detail = await api(`/api/organizations/${organizationId}/projects/${projectId}`);
      if (!isCurrent()) return;
      const share = detail.modulePermissions?.includes('client')
        ? await api(`/api/organizations/${organizationId}/projects/${projectId}/client-share`)
        : { share: { active: false }, binding: { active: false } };
      if (!isCurrent()) return;
      state.project = detail.project;
      state.projectDetail = detail;
      state.clientShare = share.share;
      state.clientBinding = share.binding || { active: false };
      state.projectReturnNav = returnNav;
      const backLabels = { assets: '← 返回影像资料', photos: '← 返回影像资料', issues: '← 返回整改中心', tasks: '← 返回待办中心', client: '← 返回客户交付中心', operations: '← 返回收款与供应中心' };
      $('#backToProjects').textContent = backLabels[returnNav] || '← 返回项目列表';
      renderProjectWorkspace();
      if (Array.isArray(options.expandedMilestoneIds)) {
        const expandedIds = new Set(options.expandedMilestoneIds);
        $$('[data-milestone-node]', $('#constructionTimeline')).forEach((node) => {
          node.open = expandedIds.has(node.dataset.milestoneNode);
        });
      }
      showView('project', 'projects');
      $('#topbarKicker').textContent = `${state.organization?.name || '企业空间'} / 项目管理 / ${state.project.name}`;
      $('#topbarTitle').textContent = '施工节点总览';
      if (tab === 'logs' || tab === 'issues') {
        selectProjectTab(tab);
        $$('[data-project-section]').forEach((button) => button.classList.remove('active'));
        $('#topbarTitle').textContent = tab === 'logs' ? '现场影像' : '质量整改';
      } else {
        const requestedSection = projectModuleOrder.includes(tab)
          ? tab
          : returnNav === 'operations' ? 'finance'
            : options.preserveScroll ? state.projectSection : 'execution';
        selectProjectWorkspaceSection(requestedSection || 'execution');
      }
      window.scrollTo({ top: preservedScrollTop, behavior: options.preserveScroll ? 'auto' : 'smooth' });
      const focusTargetId = options.focusTargetId || '';
      if (focusTargetId) requestAnimationFrame(() => focusProjectRecord(focusTargetId));
    } catch (error) {
      if (isCurrent()) showToast(error.message, true);
    }
  }

  function renderMediaTrash() {
    const trash = state.mediaTrash || { metrics: {}, items: [] };
    const metrics = trash.metrics || {};
    $('#mediaTrashSummary').innerHTML = `<div><b>${metrics.photos || 0}</b><span>张单独删除的图片</span></div><div><b>${state.siteLogTrash?.metrics?.records || 0}</b><span>条可恢复日志</span></div><p>单独删除图片占用 ${formatBytes(metrics.sizeBytes || 0)}；删除日志及其照片仍保留，恢复不会自动重新发布给客户。</p>`;
    $('#mediaTrashGrid').innerHTML = trash.items?.length
      ? trash.items.map((item) => `<article class="trash-card">
          <button class="trash-preview" type="button" data-photo-preview data-photo-url="${esc(item.url)}" data-photo-caption="${esc(`${item.projectName} · ${item.sourceLabel}`)}"><img src="${esc(item.url)}" alt="${esc(item.originalName || '回收站图片')}" loading="lazy"></button>
          <div class="trash-card-body"><span class="badge returned">${esc(item.sourceLabel)}</span><h3>${esc(item.projectName)}</h3><p>${esc(item.milestoneName ? `${item.milestoneName} · ${item.recordTitle}` : item.recordTitle)}</p><small>${esc(item.deletedByName)} 删除于 ${formatDate(item.deletedAt, true)}</small><button class="primary" type="button" data-media-restore="${esc(item.id)}" data-media-project="${esc(item.projectId)}">恢复图片</button></div>
        </article>`).join('')
      : '<p class="muted">暂无单独删除的图片；整条日志请在下方恢复。</p>';
    const logs = state.siteLogTrash?.items || [];
    $('#siteLogTrashGrid').innerHTML = logs.length ? logs.map((log) => `<article class="panel recovered-log-card"><div><span class="badge returned">已删除日志 · ${log.media?.length || 0} 张照片</span><h3>${esc(log.projectName)}</h3><p>${esc(log.summary || log.stage || '现场日志')}</p><small>现场日期 ${formatDate(log.createdAt, true)} · 删除于 ${formatDate(log.deletedAt, true)}</small></div>${canWrite() && log.canRestore ? `<button class="primary" type="button" data-log-restore="${esc(log.id)}">恢复日志与照片</button>` : ''}</article>`).join('') : '<p class="muted">暂无可恢复的整条日志。</p>';
  }

  function renderUnlinkedMedia() {
    const items = state.unlinkedMedia?.items || [];
    $('#unlinkedMediaCount').textContent = items.length;
    $('#unlinkedMediaGrid').innerHTML = items.length ? items.map((item) => `<article class="panel recovered-log-card"><div><h3>${esc(item.projectName)}</h3><p>${esc(item.originalName)} · 上传于 ${formatDate(item.recordedAt, true)}</p><small>${item.fileExists ? '文件仍在，尚未关联有效业务记录。请确认节点和现场日期后归档。' : '文件缺失，请联系管理员核对备份。'}</small></div><div class="row-actions">${item.fileExists ? `<button type="button" data-photo-preview data-photo-url="${esc(item.url)}" data-photo-caption="${esc(item.originalName)}">查看照片</button>${canWrite() ? `<button class="primary" type="button" data-unlinked-archive="${esc(item.id)}">确认归档</button>` : ''}` : ''}</div></article>`).join('') : '<p class="muted">没有发现待归档照片。此处只盘点文件，不会自动删除或发布给客户。</p>';
  }

  function photoSyncBadge(media) {
    if (!('clientSyncStatus' in media) && !('clientSynced' in media)) return '';
    const status = media.clientSyncStatus || (media.clientSynced ? 'synced' : 'unsynced');
    const labels = { synced: '已同步', pending: '待审核', unsynced: '未同步' };
    return `<span class="photo-client-synced sync-${esc(status)}">${labels[status] || labels.unsynced}</span>`;
  }

  async function refreshMediaCollections() {
    const organizationId = state.organization.id;
    const revision = state.mediaRevision;
    const request = ++state.mediaRequest;
    const [photoLibrary, mediaTrash, siteLogTrash, unlinkedMedia] = await Promise.all([
      api(`/api/organizations/${organizationId}/photo-library`),
      api(`/api/organizations/${organizationId}/media-trash`),
      api(`/api/organizations/${organizationId}/site-log-trash`),
      api(`/api/organizations/${organizationId}/unlinked-media`),
    ]);
    if (state.organization?.id !== organizationId || request !== state.mediaRequest) return;
    state.photoLibrary = photoLibrary;
    state.mediaTrash = mediaTrash;
    state.siteLogTrash = siteLogTrash;
    state.unlinkedMedia = unlinkedMedia;
    state.mediaLoadedRevision = revision;
    renderPhotoLibrary();
    renderMediaTrash();
    renderUnlinkedMedia();
    renderStorage();
    $('#photoNavCount').textContent = photoLibrary.metrics?.photos || 0;
    $('#trashNavCount').textContent = Number(mediaTrash.metrics?.photos || 0) + Number(siteLogTrash.metrics?.records || 0);
  }

  function stageFamily(value) {
    const text = String(value || '').trim();
    const families = [
      ['量房', /量房/], ['设计', /设计/], ['开工', /开工|交底|保护/],
      ['拆改', /拆改|拆除|砌墙/], ['水电', /水电|强电|弱电|给排水/],
      ['防水', /防水|闭水/], ['泥木', /泥木|瓦工|木工|铺砖|吊顶/],
      ['油漆', /油漆|乳胶漆|腻子/], ['安装', /安装|收尾/],
      ['竣工', /竣工|交付/], ['售后', /售后|回访/],
    ];
    return families.find(([, pattern]) => pattern.test(text))?.[0]
      || text.replace(/施工|验收|阶段|完成|准备|改造|收尾|交付/g, '').slice(0, 4);
  }

  function belongsToMilestone(milestone, stage) {
    const stageText = String(stage || '').trim();
    if (!stageText) return false;
    return stageText === milestone.stage
      || stageText === milestone.name
      || stageFamily(stageText) === stageFamily(milestone.stage || milestone.name);
  }

  function logBelongsToMilestone(milestone, log) {
    return log?.milestoneId ? log.milestoneId === milestone.id : belongsToMilestone(milestone, log?.stage);
  }

  function issueMediaGroupsHtml(issue) {
    const issueMedia = issue.media || [];
    const beforeMedia = issueMedia.filter((item) => item.kind !== 'after');
    const afterMedia = issueMedia.filter((item) => item.kind === 'after');
    const mediaGroup = (label, media, emptyText) => `
      <section class="node-issue-media-group">
        <div class="node-issue-media-head"><b>${label}</b><span>${media.length} 张</span></div>
        ${media.length ? photoStrip(media) : `<div class="node-issue-media-empty">${emptyText}</div>`}
      </section>`;
    return `<div class="node-issue-media-grid">${mediaGroup('整改前图片', beforeMedia, '未上传整改前图片')}${mediaGroup('整改后图片', afterMedia, issue.status === 'pending' || issue.status === 'in_progress' ? '整改完成后在此提交图片' : '未上传整改后图片')}</div>`;
  }

  function issueTimelineEntryHtml(issue, nodeLogs) {
    const actions = issueActions(issue);
    const sourceLog = issue.siteLogId ? nodeLogs.find((log) => log.id === issue.siteLogId) : null;
    const dueText = issue.dueAt ? `截止 ${formatDate(issue.dueAt)}` : '未设置截止时间';
    return `
      <article class="node-log-entry node-issue-entry">
        <div class="node-log-marker issue"></div>
        <header>
          <div><span class="node-issue-kicker">整改记录</span><b>${esc(issue.title)}</b></div>
          <div class="node-issue-head-side"><small>${formatDate(issue.updatedAt || issue.createdAt, true)}</small><span class="badge ${issue.status === 'closed' ? 'normal' : issue.priority === 'urgent' ? 'danger' : 'attention'}">${esc(statusNames[issue.status] || issue.status)}</span></div>
        </header>
        <p>${esc(issue.description || '未填写整改要求')}</p>
        <div class="node-issue-meta"><span>负责人：${esc(issue.ownerName || '待分配')}</span><span>${esc(dueText)}</span>${sourceLog ? `<span>来源日志：${formatDate(sourceLog.createdAt)} · ${esc(sourceLog.stage)}</span>` : '<span>独立整改记录</span>'}</div>
        ${issueMediaGroupsHtml(issue)}
        ${actions ? `<div class="node-issue-actions">${actions}</div>` : ''}
      </article>`;
  }

  function constructionTimelineHtml(milestones, checklistItems, canManageWorkflow, canRecordWorkflow, milestoneStatusLabel, checklistStatusLabel) {
    const logs = state.projectDetail.siteLogs || [];
    const issues = state.projectDetail.issues || [];
    const publications = state.projectDetail.publications || [];
    const responses = state.projectDetail.clientResponses || [];
    const fallbackMilestone = milestones.find((milestone) => belongsToMilestone(milestone, state.project.stage))
      || milestones.find((milestone) => ['in_progress', 'blocked', 'overdue'].includes(milestone.status))
      || milestones[0];
    const defaultExpandedMilestone = milestones.find((milestone) => milestone.rawStatus === 'in_progress' || milestone.status === 'in_progress')
      || milestones.find((milestone) => ['blocked', 'overdue'].includes(milestone.status))
      || milestones.find((milestone) => milestone.rawStatus !== 'completed')
      || milestones[milestones.length - 1];

    return milestones.map((milestone, index) => {
      const nodeLogs = logs.filter((log) => logBelongsToMilestone(milestone, log));
      const nodeLogIds = new Set(nodeLogs.map((log) => log.id));
      const nodeIssues = issues.filter((issue) => issue.status !== 'canceled').filter((issue) => issue.milestoneId
        ? issue.milestoneId === milestone.id
        : issue.siteLogId ? nodeLogIds.has(issue.siteLogId) : milestone.id === fallbackMilestone?.id);
      const nodeChecklist = checklistItems.filter((item) => item.milestoneId === milestone.id);
      const requiredChecklist = nodeChecklist.filter((item) => item.required);
      const requiredReady = requiredChecklist.length > 0
        && requiredChecklist.every((item) => item.status === 'passed');
      const nodeCompleted = milestone.rawStatus === 'completed';
      const nodePublications = publications.filter((publication) => {
        if (publication.siteLogId) return nodeLogIds.has(publication.siteLogId);
        return belongsToMilestone(milestone, publication.snapshot?.stage);
      });
      const publicationIds = new Set(nodePublications.map((publication) => publication.id));
      const nodeResponses = responses.filter((response) => response.publicationId && publicationIds.has(response.publicationId));
      const acceptanceMedia = milestone.acceptanceMedia || [];
      const photoCount = nodeLogs.reduce((sum, log) => sum + Number(log.media?.length || 0), 0);
      const requiredPhotoCount = Number(milestone.requiredPhotoCount || 0);
      const photoReady = photoCount >= requiredPhotoCount;
      const openIssueCount = Number.isFinite(Number(milestone.openIssueCount))
        ? Number(milestone.openIssueCount)
        : nodeIssues.filter((issue) => ['pending', 'in_progress', 'review'].includes(issue.status)).length;
      const passedCount = nodeChecklist.filter((item) => item.status === 'passed').length;
      const clientPublished = nodePublications.length;
      const openClientResponses = nodeResponses.filter((response) => response.status === 'open').length;
      const nodeOpenResponses = nodeResponses.filter((response) => response.status === 'open');
      const nodeActionable = milestone.rawStatus !== 'completed';
      const deliveryReady = nodeCompleted && requiredReady && photoReady && openIssueCount === 0 && openClientResponses === 0;
      const expanded = milestone.id === defaultExpandedMilestone?.id;
      const nodeStatusClass = milestone.status === 'overdue' ? 'danger' : milestone.rawStatus;
      const clientAccessReady = Boolean(state.clientBinding?.active || state.clientShare?.active);
      const clientHeadline = clientPublished
        ? `已同步 ${clientPublished} 次`
        : clientAccessReady ? '等待同步' : '未开通客户访问';
      const clientDescription = openClientResponses
        ? `${openClientResponses} 条客户意见待回应`
        : clientPublished ? `最近发布 ${formatDate(nodePublications[0]?.createdAt, true)}`
          : clientAccessReady ? '审核现场日志后可发布给客户' : '绑定账号或启用备用链接后可同步';
      const archiveEntries = [
        ...nodeLogs.map((log) => ({ type: 'log', timestamp: log.createdAt, value: log })),
        ...nodeIssues.map((issue) => ({ type: 'issue', timestamp: issue.updatedAt || issue.createdAt, value: issue })),
      ].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
      const archiveHtml = archiveEntries.length ? archiveEntries.map((entry) => {
        if (entry.type === 'issue') return issueTimelineEntryHtml(entry.value, nodeLogs);
        const log = entry.value;
        const logEditable = projectCanWrite() && state.role !== 'viewer' && (canApproveProject() || log.createdBy === state.me?.id);
        return `
          <article class="node-log-entry">
            <div class="node-log-marker"></div>
            <header><b>${esc(log.createdByName || '现场记录')}</b><small>${formatDate(log.createdAt, true)} · ${(log.media || []).length} 张照片</small></header>
            <p>${esc(log.summary || '未填写现场说明')}</p>
            ${photoStrip(log.media || [])}
            ${logEditable ? `<div class="node-issue-actions"><button type="button" class="primary" data-log-append="${esc(log.id)}">继续添加照片</button><button type="button" class="secondary" data-log-edit="${esc(log.id)}">编辑日志</button><button type="button" class="ghost danger-action" data-log-delete="${esc(log.id)}">删除日志</button></div>` : ''}
          </article>`;
      }).join('') : `<div class="node-empty node-log-empty"><b>当前节点还没有过程记录</b><p>先上传现场照片和施工说明，后续整改、验收和客户交付才有完整依据。</p>${canRecordWorkflow && nodeActionable ? `<button type="button" class="primary" data-node-log="${esc(milestone.id)}">添加第一条现场记录</button>` : ''}</div>`;
      const checklistHtml = nodeChecklist.length ? nodeChecklist.map((item, checklistIndex) => `
        <article class="node-check-item ${esc(item.status)}">
          <div class="node-check-title"><span class="node-check-order">${checklistIndex + 1}</span><div class="node-check-copy"><b>${esc(item.title)}</b><small>${esc(item.note || (item.required ? '节点完成前必须通过' : '普通检查项'))}</small></div></div>
          <span class="badge ${item.status === 'passed' ? 'normal' : item.status === 'failed' ? 'danger' : 'attention'}">${esc(checklistStatusLabel[item.status] || item.status)}</span>
          ${canManageWorkflow ? `<div class="node-check-actions">${milestone.rawStatus !== 'pending' ? `<button type="button" class="check-pass" data-checklist-id="${esc(item.id)}" data-checklist-status="${item.status === 'passed' ? 'pending' : 'passed'}">${item.status === 'passed' ? '取消勾选' : '检查无问题'}</button>${item.status !== 'passed' ? `<button type="button" class="check-problem" data-checklist-problem="${esc(item.id)}" data-milestone-id="${esc(milestone.id)}">有问题 · 发整改</button>` : ''}` : '<span class="muted">节点开始后可执行检查</span>'}<div class="node-check-manage"><button type="button" data-checklist-edit="${esc(item.id)}">编辑</button><button type="button" class="danger-action" data-checklist-delete="${esc(item.id)}">删除</button></div></div>` : ''}
        </article>`).join('') : '<div class="node-empty">暂无节点验收项</div>';
      const missingRequirements = [
        !nodeCompleted ? '将节点状态改为已完成' : '',
        !requiredChecklist.length ? '配置必检验收项' : !requiredReady ? '完成全部必检验收项' : '',
        !photoReady ? `补齐现场照片（${photoCount}/${requiredPhotoCount}）` : '',
        openIssueCount ? `关闭 ${openIssueCount} 项整改` : '',
        openClientResponses ? `处理 ${openClientResponses} 条客户意见` : '',
      ].filter(Boolean);
      const reportMissingText = `还差 ${missingRequirements.length} 项：${missingRequirements.join('、')}`;
      const canComplete = canManageWorkflow && nodeActionable && requiredReady && photoReady && openIssueCount === 0;
      const reportActions = deliveryReady
        ? `<button type="button" class="secondary" data-milestone-report-preview="${esc(milestone.id)}">预览客户版</button><button type="button" class="primary" data-milestone-report="${esc(milestone.id)}">生成并下载 PDF</button>`
        : `${canManageWorkflow && nodeActionable && !requiredReady ? `<button type="button" class="primary" data-focus-node-checklist="${esc(milestone.id)}">处理验收项</button>` : canRecordWorkflow && nodeActionable && !photoReady ? `<button type="button" class="primary" data-node-log="${esc(milestone.id)}">补充现场照片</button>` : canComplete ? `<button type="button" class="primary" data-milestone-complete="${esc(milestone.id)}" data-milestone-owner="${esc(milestone.ownerMemberId || '')}" data-milestone-date="${esc(milestone.plannedFinishDate || '')}" data-milestone-note="${esc(milestone.note || '')}">完成节点并进入下一节点</button>` : ''}<button type="button" class="secondary" data-report-style-preview="${esc(milestone.id)}">预览报告样式</button>`;
      const dateSummary = milestone.actualFinishedAt
        ? `<b>实际完成 ${formatDate(milestone.actualFinishedAt)}</b><small>计划完成 ${formatDate(milestone.plannedFinishDate)}</small>`
        : milestone.plannedFinishDate
          ? `<b>计划 ${formatDate(milestone.plannedStartDate)}—${formatDate(milestone.plannedFinishDate)}</b><small>预计 ${Number(milestone.durationDays || 1)} 天</small>`
          : '<b>尚未排期</b><small>请先编辑施工计划</small>';
      return `
        <details class="construction-node ${esc(milestone.status)} ${expanded ? 'is-current' : ''}" data-milestone-node="${esc(milestone.id)}" data-milestone-row="${esc(milestone.id)}" ${expanded ? 'open' : ''}>
          <summary>
            <span class="node-sequence-mark" aria-hidden="true"></span>
            <div class="node-heading"><div class="node-heading-top"><span class="node-index">${String(index + 1).padStart(2, '0')}</span><h3>${esc(milestone.name)}</h3><span class="badge ${esc(nodeStatusClass)}">${esc(milestoneStatusLabel[milestone.status] || milestone.status)}</span></div><p>${esc(milestone.ownerName || '待分配负责人')} · ${esc(milestone.note || '按施工计划执行')}</p></div>
            <div class="node-date-summary">${dateSummary}</div>
            <div class="node-kpis">
              <span class="node-kpi ${photoReady ? 'done' : 'risk'}"><b>${photoCount}/${requiredPhotoCount}</b>现场照片</span>
              <span class="node-kpi ${openIssueCount ? 'risk' : 'done'}"><b>${openIssueCount}</b>未闭环整改</span>
              <span class="node-kpi ${nodeChecklist.length && passedCount === nodeChecklist.length ? 'done' : ''}"><b>${passedCount}/${nodeChecklist.length}</b>验收通过</span>
              <span class="node-kpi ${openClientResponses ? 'risk' : clientPublished ? 'done' : ''}"><b>${openClientResponses ? `${openClientResponses} 条待处理` : clientPublished ? '已同步' : '未同步'}</b>客户状态</span>
            </div>
            <span class="node-expand"><span class="node-expand-open">查看详情</span><span class="node-expand-close">收起详情</span><i aria-hidden="true"><img class=xz-icon src=assets/icons/chevron-down.svg alt aria-hidden=true></i></span>
          </summary>
          <div class="construction-node-body">
            <div class="node-workspace-grid">
              <section class="node-section node-archive">
                <div class="node-section-head"><div><h4>现场照片、日志与整改</h4><p>日志与整改独立归档；整改只展示自己的前后对比图片</p></div><div class="node-section-actions">${canRecordWorkflow && nodeActionable ? `<button type="button" class="primary" data-node-log="${esc(milestone.id)}">添加现场</button><button type="button" data-node-issue="${esc(milestone.id)}">发起整改</button>` : ''}<span>${nodeLogs.length} 条日志 · ${nodeIssues.length} 项整改</span></div></div>
                <div class="node-log-timeline">${archiveHtml}</div>
              </section>
              <section class="node-section node-workbench">
                ${canManageWorkflow ? `<div class="node-edit-toolbar"><span>已完成节点也可以随时调整计划、负责人和状态</span><button type="button" class="secondary" data-milestone-edit="${esc(milestone.id)}">编辑节点</button></div>` : ''}
                <div class="node-section-head"><div><h4>节点验收与交付</h4><p>完成条件后生成带企业抬头的客户报告</p></div><span class="badge ${esc(nodeStatusClass)}">${esc(milestoneStatusLabel[milestone.status] || milestone.status)}</span></div>
                <div class="node-condition-list">
                  <div class="node-condition"><span class="condition-icon ${nodeCompleted ? 'done' : ''}">${nodeCompleted ? '<img class=xz-icon src=assets/icons/check.svg alt aria-hidden=true>' : '<span class=xz-status-circle aria-hidden=true></span>'}</span><b>节点标记为已完成</b><em class="${nodeCompleted ? 'done' : ''}">${nodeCompleted ? '已完成' : '当前进行中'}</em></div>
                  <div class="node-condition"><span class="condition-icon ${requiredReady ? 'done' : ''}">${requiredReady ? '<img class=xz-icon src=assets/icons/check.svg alt aria-hidden=true>' : '<span class=xz-status-circle aria-hidden=true></span>'}</span><b>必检项全部通过</b><em class="${requiredReady ? 'done' : ''}">${requiredChecklist.length ? `${passedCount}/${requiredChecklist.length} 已通过` : '尚未配置'}</em></div>
                  <div class="node-condition"><span class="condition-icon ${photoReady ? 'done' : ''}">${photoReady ? '<img class=xz-icon src=assets/icons/check.svg alt aria-hidden=true>' : '<span class=xz-status-circle aria-hidden=true></span>'}</span><b>现场照片达到计划要求</b><em class="${photoReady ? 'done' : ''}">${photoCount}/${requiredPhotoCount} 张</em></div>
                  <div class="node-condition"><span class="condition-icon ${openIssueCount === 0 ? 'done' : ''}">${openIssueCount === 0 ? '<img class=xz-icon src=assets/icons/check.svg alt aria-hidden=true>' : '<span class=xz-status-circle aria-hidden=true></span>'}</span><b>整改问题全部闭环</b><em class="${openIssueCount === 0 ? 'done' : ''}">${openIssueCount ? `${openIssueCount} 项待处理` : '已闭环'}</em></div>
                  <div class="node-condition"><span class="condition-icon ${openClientResponses === 0 ? 'done' : ''}">${openClientResponses === 0 ? '<img class=xz-icon src=assets/icons/check.svg alt aria-hidden=true>' : '<span class=xz-status-circle aria-hidden=true></span>'}</span><b>客户意见已处理</b><em class="${openClientResponses === 0 ? 'done' : ''}">${openClientResponses ? `${openClientResponses} 条待处理` : '无待处理意见'}</em></div>
                </div>
                <div class="node-workbench-block" data-node-checklist-block="${esc(milestone.id)}">
                  <div class="node-workbench-title"><b>节点必检项</b><div class="node-workbench-title-actions"><span class="node-check-count">${passedCount}/${nodeChecklist.length} 已通过</span>${canManageWorkflow ? `<button type="button" class="secondary" data-checklist-add="${esc(milestone.id)}">添加必检项</button><button type="button" class="secondary" data-checklist-import="${esc(milestone.id)}">从模板导入</button><button type="button" class="ghost" data-checklist-template>管理企业模板</button>` : ''}</div></div>
                  <div class="node-checklist">${checklistHtml}</div>
                </div>
                <div class="node-workbench-block node-acceptance-media">
                  <div class="node-workbench-title"><div><b>验收单图片</b><small>现场签字单、验收凭证与交付照片将进入本节点报告</small></div>${canRecordWorkflow && milestone.rawStatus !== 'pending' ? `<button type="button" class="secondary" data-node-acceptance-media="${esc(milestone.id)}">添加图片</button>` : `<span>${acceptanceMedia.length} 张</span>`}</div>
                  ${acceptanceMedia.length ? photoStrip(acceptanceMedia) : '<div class="node-empty acceptance-media-empty">尚未添加验收单图片</div>'}
                </div>
                <div class="node-workbench-summary">
                  <div><span>问题整改</span><b class="${openIssueCount ? 'risk-text' : ''}">${openIssueCount ? `${openIssueCount} 项待处理` : '全部已闭环'}</b></div>
                  <div><span>客户同步</span><b>${esc(clientHeadline)}</b><small>${esc(clientDescription)}</small></div>
                </div>
                ${nodeOpenResponses.length ? `<div class="node-client-feedback"><div class="node-workbench-title"><div><b>客户待处理意见</b><small>可直接在当前节点完成处理，无需跳转客户交付页</small></div><span>${nodeOpenResponses.length} 条</span></div>${nodeOpenResponses.map((response) => `<article><div><b>${esc(response.customerName || '客户')}</b><small>${formatDate(response.createdAt, true)}</small></div><p>${esc(response.content || (response.responseType === 'confirm' ? '客户已确认本次进度。' : '客户提交了一条意见。'))}</p>${canManageWorkflow ? `<button type="button" data-client-response="${esc(response.id)}">标记已处理</button>` : ''}</article>`).join('')}</div>` : ''}
                <div class="node-delivery-card ${deliveryReady ? 'ready' : ''}">
                  <div class="node-delivery-head"><span class="node-document-icon">PDF</span><div><b>节点验收图文报告</b><p>将使用“${esc(state.organization?.name || '当前企业')}”抬头，仅汇总本节点的照片、整改、验收和客户同步记录</p></div></div>
                  <div class="node-delivery-counts"><span>${photoCount} 张现场照片</span><span>${acceptanceMedia.length} 张验收图片</span><span>${nodeIssues.length} 项整改记录</span><span>${nodeChecklist.length} 项验收结果</span><span>${clientPublished} 次客户同步</span></div>
                  <div class="node-delivery-status ${deliveryReady ? 'ready' : ''}"><span>${deliveryReady ? '<img class=xz-icon src=assets/icons/check.svg alt aria-hidden=true>' : '<span class=xz-status-circle aria-hidden=true></span>'}</span><b>${deliveryReady ? '节点已具备客户交付条件' : esc(reportMissingText)}</b></div>
                  <div class="node-delivery-actions">${reportActions}</div>
                  <small class="node-delivery-note">节点完成、照片达标、验收通过、整改闭环且客户意见处理完成后，可生成客户版 PDF</small>
                </div>
              </section>
            </div>
          </div>
        </details>`;
    }).join('');
  }

  function proofMediaHtml(media = [], label = '凭证') {
    if (!media.length) return '';
    return `<div class="proof-media">${media.map((item, index) => `<a href="${esc(item.url)}" target="_blank" rel="noopener"><img src="${esc(item.url)}" alt="${esc(label)} ${index + 1}" loading="lazy"></a>`).join('')}</div>`;
  }

  function paymentPlanHtml(item, permissions) {
    const statusLabel = item.status === 'received' ? '已收齐' : item.status === 'partial' ? '部分到账' : item.overdue ? '已逾期' : '待收款';
    const statusClass = item.status === 'received' ? 'normal' : item.overdue ? 'returned' : 'attention';
    const percent = Number(item.plannedAmount) ? Math.min(100, Number(item.receivedAmount) / Number(item.plannedAmount) * 100) : 0;
    const methodNames = { bank: '银行转账', wechat: '微信', alipay: '支付宝', cash: '现金', other: '其他' };
    const receipts = item.receipts?.length ? `<div class="receipt-list">${item.receipts.map((receipt) => `<div class="receipt-entry ${['voided', 'reversed'].includes(receipt.status) ? 'is-voided' : ''}"><div><b>${formatMoney(receipt.amount)} · ${esc(methodNames[receipt.method] || receipt.method)}</b><span>${esc(receipt.receivedDate)}${receipt.reference ? ` · ${esc(receipt.reference)}` : ''}${receipt.status && receipt.status !== 'confirmed' ? ` · ${esc(statusNames[receipt.status] || receipt.status)}` : ''}</span>${proofMediaHtml(receipt.media, '收款凭证')}</div>${permissions.correct && !['voided', 'reversed'].includes(receipt.status) ? `<button class="ghost danger-text" type="button" data-receipt-correct="${esc(receipt.id)}" data-payment-id="${esc(item.id)}" data-receipt-amount="${Number(receipt.amount || 0)}">更正 / 冲销</button>` : ''}</div>`).join('')}</div>` : '';
    const groupLabel = item.paymentGroup && item.paymentGroup !== 'overall' ? `<span class="badge normal">${esc(item.paymentGroupName)}</span>` : '';
    const scheduleLabel = item.milestoneName ? ` · 跟随“${esc(item.milestoneName)}”验收日` : '';
    return `<article class="business-row payment-plan-row ${item.overdue ? 'is-risk' : ''}"><div class="business-row-main"><div class="business-row-title"><b>${esc(item.name)} · ${Number(item.paymentPercent || 0)}%${groupLabel ? '（组内）' : ''}</b>${groupLabel}<span class="badge ${statusClass}">${statusLabel}</span></div><p>节点目标 ${formatMoney(item.targetAmount)}${Number(item.depositApplied || 0) ? ` · 扣定金 ${formatMoney(item.depositApplied)}` : ''} · 本期应收 ${formatMoney(item.plannedAmount)} · 已到账 ${formatMoney(item.receivedAmount)} · 未收 ${formatMoney(item.outstandingAmount)} · ${esc(item.dueDate)}${scheduleLabel}</p><div class="mini-progress"><i style="width:${percent}%"></i></div>${receipts}</div><div class="row-actions">${permissions.receive && item.status !== 'received' ? `<button class="primary" data-payment-receipt="${esc(item.id)}">登记到账</button>` : ''}</div></article>`;
  }

  function paymentPlanListHtml(business, permissions) {
    const payments = business?.payments || [];
    if (!payments.length) return '<div class="empty compact">还没有收款计划。</div>';
    if (business.paymentCalculationMode !== 'split') {
      return payments.map((item) => paymentPlanHtml(item, permissions)).join('');
    }
    const groupMap = new Map((business.paymentGroups || []).map((group) => [group.key, group]));
    return ['labor_auxiliary', 'main_material'].map((groupKey) => {
      const rows = payments.filter((item) => item.paymentGroup === groupKey);
      if (!rows.length) return '';
      const group = groupMap.get(groupKey) || {};
      const target = Number(group.targetAmount || rows.reduce((sum, item) => sum + Number(item.targetAmount || 0), 0));
      const received = Number(group.receivedAmount || rows.reduce((sum, item) => sum + Number(item.receivedAmount || 0) + Number(item.depositApplied || 0), 0));
      const outstanding = Math.max(0, target - received);
      const modeLabel = group.calculationMode === 'amount' ? '自定义金额' : '按组内比例';
      return `<section class="payment-group-section" data-payment-group-section="${esc(groupKey)}">
        <div class="payment-group-summary"><div><span>${esc(group.name || (groupKey === 'main_material' ? '主材' : '人辅'))}收款</span><small>${modeLabel} · ${rows.length} 个节点</small></div><dl><div><dt>组合同额</dt><dd>${formatMoney(group.baseAmount || 0)}</dd></div><div><dt>已收</dt><dd>${formatMoney(received)}</dd></div><div class="${outstanding ? 'risk-number' : ''}"><dt>待收</dt><dd>${formatMoney(outstanding)}</dd></div></dl></div>
        ${rows.map((item) => paymentPlanHtml(item, permissions)).join('')}
      </section>`;
    }).join('');
  }

  function changeOrderHtml(item, canManageWorkflow) {
    const complete = item.status === 'approved' && item.customerConfirmed;
    const label = complete ? '双方已确认' : item.status === 'approved' ? '待客户确认' : item.status === 'rejected' ? '已驳回' : '待内部确认';
    const nextAction = item.status === 'approved' ? '登记客户确认' : '内部审批通过';
    const removeLabel = complete ? '撤销已确认增减项' : '删除增减项';
    return `<article class="business-row"><div class="business-row-main"><div class="business-row-title"><b>${item.kind === 'increase' ? '+' : '−'} ${esc(item.title)} · ${formatMoney(item.amount)}</b><span class="badge ${complete ? 'normal' : item.status === 'rejected' ? 'returned' : 'attention'}">${label}</span></div><p>${item.scheduleImpactDays ? `影响工期 ${item.scheduleImpactDays > 0 ? '+' : ''}${item.scheduleImpactDays} 天 · ` : ''}${esc(item.confirmationNote || item.note || '暂无确认说明')}</p>${proofMediaHtml(item.media, '变更确认单')}</div><div class="row-actions">${canManageWorkflow && !complete && item.status !== 'rejected' ? `<button class="secondary" data-change-approve="${esc(item.id)}">${nextAction}</button>` : ''}${canManageWorkflow ? `<details class="action-more-menu"><summary>更多操作</summary><div><button class="danger" data-change-delete="${esc(item.id)}" data-change-complete="${complete ? 'true' : 'false'}">${removeLabel}</button></div></details>` : ''}</div></article>`;
  }

  function materialItemHtml(item, permissions) {
    const materialStatusNames = { planned: '待采购', ordered: '已下单', in_transit: '运输中', arrived: '已到场', accepted: '已验收' };
    const paymentNames = { unpaid: '未付款', partial: '部分付款', paid: '已付清' };
    const manufacturerStatus = item.manufacturerStatus || 'unordered';
    const manufacturerSteps = [['unordered', '未下单'], ['measured', '已测量'], ['ordered', '已下单'], ['arrived', '已送货'], ['installed', '已安装']];
    const stepper = manufacturerSteps.map(([value, label], index) => `<button type="button" class="manufacturer-step ${value === manufacturerStatus ? 'complete current' : ''}" data-manufacturer-status="${value}" data-material-id="${esc(item.id)}" ${permissions.manage ? '' : 'disabled'}><i>${index + 1}</i><span>${label}</span></button>`).join('');
    const exception = `<button type="button" class="manufacturer-exception ${manufacturerStatus === 'other' ? 'current' : ''}" data-manufacturer-status="other" data-material-id="${esc(item.id)}" ${permissions.manage ? '' : 'disabled'}>例外 / 不适用</button>`;
    const exceptionNote = manufacturerStatus === 'other' ? `<p class="manufacturer-exception-note">例外说明：${esc(item.manufacturerStatusNote || item.note || '未填写，请补充说明')}</p>` : '';
    const materialPayments = item.payments?.length ? `<div class="receipt-list material-payment-list">${item.payments.map((payment) => `<div class="receipt-entry ${payment.status !== 'confirmed' ? 'is-voided' : ''}"><div><b>${formatMoney(payment.amount)} · ${esc(payment.paidDate || '')}</b><span>${esc(payment.reference || payment.note || '')}${payment.status !== 'confirmed' ? ` · ${esc(statusNames[payment.status] || payment.status)}` : ''}</span></div>${permissions.correct && payment.status === 'confirmed' ? `<button class="ghost danger-text" type="button" data-material-payment-correct="${esc(payment.id)}" data-material-id="${esc(item.id)}" data-material-payment-amount="${Number(payment.amount || 0)}">更正 / 作废</button>` : projectCanWrite() && isOwner() && ['corrected', 'voided'].includes(payment.status) ? `<button class="ghost danger-text" type="button" data-material-payment-delete="${esc(payment.id)}" data-material-id="${esc(item.id)}">删除记录</button>` : ''}</div>`).join('')}</div>` : '';
    const costGroup = item.costGroupId ? ` · 费用归属：${esc(item.costGroupTitle || '已关联费用总项')}` : '';
    return `<article class="business-row material-procurement-row ${item.delayed ? 'is-risk' : ''}" data-material-record-id="${esc(item.id)}">${permissions.manage ? `<label class="batch-row-select" title="选择材料"><input type="checkbox" data-material-batch-select value="${esc(item.id)}"><span>选择</span></label>` : ''}<div class="business-row-main"><div class="business-row-title"><b>${esc(item.name)} · ${Number(item.quantity)}${esc(item.unit)}</b><span class="badge ${['arrived','accepted'].includes(item.status) ? 'normal' : item.delayed ? 'returned' : 'attention'}">采购物流：${materialStatusNames[item.status] || item.status}</span></div><p>${esc(item.milestoneName)} · ${esc(item.purchaserName || '调配负责人待定')} · 厂家：${esc(item.supplier || '待设置')}${item.supplierPhone ? ` ${esc(item.supplierPhone)}` : ''}${costGroup}</p><p>材料应付 ${formatMoney(item.purchaseAmount)} · 已付 ${formatMoney(item.paidAmount || 0)} · 待付 ${formatMoney(item.unpaidAmount || 0)} · ${paymentNames[item.paymentStatus] || item.paymentStatus}</p><p>计划 ${esc(item.plannedArrivalDate)} 到场${item.delayed && item.delayReason ? ` · 延期：${esc(item.delayReason)}` : ''}</p><div class="manufacturer-progress-wrap"><span>厂家履约状态</span><div class="manufacturer-progress" aria-label="厂家履约状态">${stepper}</div>${exception}</div>${exceptionNote}${materialPayments}${proofMediaHtml(item.media, '到场验收图片')}</div><div class="row-actions">${permissions.pay && Number(item.unpaidAmount || 0) > 0 ? `<button class="primary" data-material-payment="${esc(item.id)}">确认支出</button>` : ''}${permissions.manage && !['arrived','accepted'].includes(item.status) ? `<button class="secondary" data-material-arrived="${esc(item.id)}">确认到场</button>` : ''}${permissions.manage ? `<details class="action-more-menu"><summary>更多操作</summary><div><button data-material-edit="${esc(item.id)}">编辑材料与采购</button><button class="danger" data-material-delete="${esc(item.id)}">${Number(item.paidAmount || 0) ? '作废材料计划' : '删除材料计划'}</button></div></details>` : ''}</div></article>`;
  }

  function materialUpdatePayload(item, overrides = {}) {
    return { expectedVersion: item.version ?? null, expectedUpdatedAt: item.updatedAt || null, ...overrides };
  }

  function updateCostFormMode() {
    const form = $('#costForm');
    const isGroup = form.elements.entryType.value === 'group';
    $$('[data-cost-item-field]', form).forEach((field) => { field.hidden = isGroup; });
    $('[data-cost-parent-field]', form).hidden = isGroup;
    form.elements.plannedAmount.required = true;
    form.elements.plannedDate.required = !isGroup;
    form.elements.parentId.value = isGroup ? '' : form.elements.parentId.value;
    form.elements.title.placeholder = isGroup ? '例如：工程分包 / 不可预见费' : '例如：水电阶段分包款';
    $('#costAmountLabel').textContent = isGroup ? '费用总额（元）*' : '分项预计金额（元）*';
  }

  function syncCostDateFromMilestone() {
    const form = $('#costForm');
    const milestoneId = form.elements.milestoneId.value;
    form.elements.plannedDate.title = '';
    if (!milestoneId) return;
    const milestone = (state.projectDetail?.milestones || []).find((item) => String(item.id) === String(milestoneId));
    if (!milestone?.plannedFinishDate) return;
    form.elements.plannedDate.value = milestone.plannedFinishDate;
    form.elements.plannedDate.title = `已带入“${milestone.name}”的计划完成日期，可继续手动调整`;
  }

  function openCostDialog(options = {}) {
    const form = $('#costForm');
    const parent = options.parent || null;
    const item = options.item || null;
    form.reset();
    delete form.dataset.costPlanId;
    form.elements.plannedDate.value = localDateValue();
    form.elements.plannedDate.title = '';
    $('#costMilestoneSelect').innerHTML = '<option value="">暂不关联节点</option>' + (state.projectDetail.milestones || []).map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    const groups = (state.projectDetail.cost?.plans || []).filter((item) => item.isGroup);
    const parents = parent && !groups.some((item) => item.id === parent.id) ? [parent, ...groups] : groups;
    $('#costParentSelect').innerHTML = '<option value="">不归入费用总项</option>' + parents.map((item) => `<option value="${esc(item.id)}">${esc(item.title)}${item.isGroup ? '' : '（将转为费用总项）'}</option>`).join('');
    if (item) {
      form.dataset.costPlanId = item.id;
      form.elements.entryType.value = item.isGroup ? 'group' : 'item';
      form.elements.parentId.value = item.parentId || '';
      form.elements.milestoneId.value = item.milestoneId || '';
      form.elements.category.value = item.category || 'other';
      form.elements.title.value = item.title || '';
      form.elements.plannedAmount.value = item.plannedAmount ?? item.payableAmount ?? 0;
      form.elements.plannedDate.value = item.plannedDate || localDateValue();
      form.elements.vendor.value = item.vendor || '';
      form.elements.description.value = item.description || '';
      $('#costDialogTitle').textContent = item.isGroup ? '编辑费用总项' : '编辑支出计划';
      $('#costDialogDescription').textContent = '修改仅影响尚未确认的计划；已经确认的实际支出请使用“更正支出”。';
    } else if (options.contingency) {
      form.elements.entryType.value = 'group';
      form.elements.title.value = '不可预见费';
      form.elements.category.value = 'contingency';
      form.elements.description.value = '用于合同外临时项目和不可预见支出；发生费用后在此总项下增加支出分项。';
      $('#costDialogTitle').textContent = '设置不可预见费';
      $('#costDialogDescription').textContent = '先设置预估总额；实际发生合同外费用时，再逐笔增加支出分项。';
    } else {
      form.elements.entryType.value = parent ? 'item' : 'item';
      if (parent) {
        form.elements.parentId.value = parent.id;
        form.elements.category.value = parent.category || 'other';
      }
      $('#costDialogTitle').textContent = parent ? `给“${parent.title}”增加分项` : '设置支出节点';
      $('#costDialogDescription').textContent = parent ? '填写本阶段或本次支出的预计金额；确认付款后计入实付成本。' : '可直接记录单项支出，也可建立费用总项后按阶段增加分项。';
    }
    updateCostFormMode();
    $('#costDialog').showModal();
  }

  function syncMaterialPaymentFields() {
    const form = $('#materialForm');
    const purchaseAmount = Math.max(0, Number(form.elements.purchaseAmount.value || 0));
    const status = form.elements.paymentStatus.value;
    const paidInput = form.elements.paidAmount;
    const paidDateInput = form.elements.paidDate;
    const paidDateField = $('[data-material-paid-date-field]', form);
    paidInput.max = String(purchaseAmount);
    paidInput.readOnly = status !== 'partial';
    if (status === 'unpaid') paidInput.value = '0';
    if (status === 'paid') paidInput.value = String(purchaseAmount);
    if (status === 'partial' && Number(paidInput.value || 0) > purchaseAmount) paidInput.value = String(purchaseAmount);
    const hasPayment = status !== 'unpaid' && Number(paidInput.value || 0) > 0;
    paidDateField.hidden = !hasPayment;
    paidDateInput.required = hasPayment;
    if (hasPayment && !paidDateInput.value) paidDateInput.value = localDateValue();
  }

  function openMaterialDialog(item = null) {
    const form = $('#materialForm');
    form.reset();
    clearUploadPreview(form);
    $('#materialMilestoneSelect').innerHTML = '<option value="">暂不关联</option>' + (state.projectDetail.milestones || []).map((milestone) => `<option value="${esc(milestone.id)}">${esc(milestone.name)}</option>`).join('');
    const costGroups = (state.projectDetail.cost?.plans || []).filter((plan) => plan.isGroup && !['voided', 'corrected'].includes(plan.status));
    $('#materialCostGroupSelect').innerHTML = '<option value="">不归入费用总项</option>' + costGroups.map((group) => {
      const available = Number(group.unallocatedAmount || 0) + (item?.costGroupId === group.id ? Number(item.purchaseAmount || 0) : 0);
      return `<option value="${esc(group.id)}">${esc(group.title)}（剩余可分配 ${formatMoney(available)}）</option>`;
    }).join('');
    if (item) {
      form.dataset.materialId = item.id;
      ['name', 'supplier', 'supplierPhone', 'purchaserMemberId', 'purchaseAmount', 'paidAmount', 'paymentStatus', 'quantity', 'unit', 'status', 'manufacturerStatus', 'plannedArrivalDate', 'delayReason', 'note', 'milestoneId', 'costGroupId'].forEach((name) => {
        if (form.elements[name]) form.elements[name].value = item[name] ?? '';
      });
      const latestPayment = [...(item.payments || [])].reverse().find((payment) => payment.status === 'confirmed');
      form.elements.paidDate.value = latestPayment?.paidDate || localDateValue();
      $('#materialDialogTitle').textContent = '编辑材料与付款';
      $('#materialDialogSubmit').textContent = '保存材料与成本联动';
    } else {
      delete form.dataset.materialId;
      form.elements.plannedArrivalDate.value = localDateValue();
      form.elements.paidDate.value = localDateValue();
      $('#materialDialogTitle').textContent = '新增材料与厂家调配';
      $('#materialDialogSubmit').textContent = '保存材料计划';
    }
    syncMaterialPaymentFields();
    $('#materialDialog').showModal();
  }

  function openMaterialPaymentDialog(item) {
    const form = $('#materialPaymentForm');
    const outstanding = Math.max(0, Number(item.purchaseAmount || 0) - Number(item.paidAmount || 0));
    if (outstanding <= 0) return showToast('该材料已经付清，无需重复登记', true);
    form.reset();
    form.elements.materialId.value = item.id;
    form.elements.amount.value = String(outstanding);
    form.elements.amount.max = String(outstanding);
    form.elements.paidDate.value = localDateValue();
    $('#materialPaymentDescription').textContent = `“${item.name}”待付 ${formatMoney(outstanding)}，请按真实付款日期登记。`;
    $('#materialPaymentDialog').showModal();
  }

  function renderSupplierDirectory() {
    const rows = state.supplierDirectory?.suppliers || state.supplierDirectory?.items || [];
    const list = $('#supplierList');
    if (!list) return;
    list.innerHTML = rows.length ? rows.map((item) => `<button type="button" class="supplier-directory-row" data-supplier-edit="${esc(item.id)}"><b>${esc(item.name)}</b><span>${esc(item.contactName || '联系人未填写')}${item.phone ? ` · ${esc(item.phone)}` : ''}</span><small>${esc(item.category || '品类未填写')} · 使用 ${Number(item.materialCount || item.projectCount || 0)} 次${item.onTimeRate != null ? ` · 准时率 ${Number(item.onTimeRate)}%` : ''}</small></button>`).join('') : '<div class="empty-state"><b>还没有厂家档案</b><p>在右侧填写第一家合作厂家，后续材料采购可直接引用。</p></div>';
  }

  async function openSupplierDirectory() {
    const dialog = $('#supplierDialog');
    if (!dialog) return;
    const form = $('#supplierForm');
    form.reset();
    delete form.dataset.supplierId;
    $('#supplierList').innerHTML = '<div class="empty-state"><b>正在读取厂家档案…</b></div>';
    if (!dialog.open) dialog.showModal();
    try {
      state.supplierDirectory = await api(`/api/organizations/${state.organization.id}/suppliers`);
      renderSupplierDirectory();
    } catch (error) {
      $('#supplierList').innerHTML = `<div class="empty-state"><b>厂家档案读取失败</b><p>${esc(error.message)}</p></div>`;
    }
  }

  function renderBusinessReport(payload) {
    const content = $('#businessReportContent');
    if (!content) return;
    const metrics = payload?.metrics || payload?.summary || payload || {};
    const projects = payload?.projects || payload?.items || [];
    const range = payload?.dateFrom && payload?.dateTo ? `${payload.dateFrom} 至 ${payload.dateTo}` : '当前周期';
    content.innerHTML = `<p class="business-report-range">统计区间：${esc(range)}</p><div class="report-metrics business-report-metrics"><span><b>${formatMoney(metrics.adjustedContractAmount || metrics.contractAmount || 0)}</b>当前调整后合同额</span><span><b>${formatMoney(metrics.periodReceivedAmount || 0)}</b>本期回款</span><span><b>${formatMoney(metrics.periodPaidCost || 0)}</b>本期实付成本</span><span><b>${formatMoney(metrics.forecastGrossProfit || metrics.expectedGrossProfit || 0)}</b>当前预计毛利</span><span><b>${Number(metrics.overdueCount || 0)}</b>当前逾期事项</span></div>${projects.length ? `<div class="business-report-table">${projects.map((item) => `<article><div><b>${esc(item.projectName || item.name || '未命名项目')}</b><small>${esc(item.managerName || '负责人待定')}</small></div><span>本期回款 ${formatMoney(item.periodReceivedAmount || 0)}</span><span>本期实付 ${formatMoney(item.periodPaidCost || 0)}</span><span>预计成本 ${formatMoney(item.forecastCompletionCost || item.committedCost || 0)}</span><strong>${formatMoney(item.forecastGrossProfit || item.expectedGrossProfit || 0)}</strong></article>`).join('')}</div>` : '<div class="empty-state"><b>当前范围暂无项目数据</b><p>可调整统计范围或周期后重新生成。</p></div>'}`;
  }

  async function loadBusinessReport(scope = 'organization', period = 'month') {
    const content = $('#businessReportContent');
    content.innerHTML = '<div class="empty-state"><b>正在汇总经营数据…</b></div>';
    const params = new URLSearchParams({ scope, period });
    if (scope === 'project' && state.project?.id) params.set('projectId', state.project.id);
    const payload = await api(`/api/organizations/${state.organization.id}/business-reports?${params}`);
    state.businessReports = payload;
    renderBusinessReport(payload);
  }

  function costPlanEntryHtml(entry, permissions, allowSubitem = false) {
    const settled = entry.status === 'confirmed';
    const inactive = ['corrected', 'voided', 'reversed'].includes(entry.status);
    const payableAmount = Number(entry.payableAmount || 0);
    const paidAmount = inactive ? Number(entry.originalActualAmount || 0) : Number(entry.paidAmount || 0);
    const unpaidAmount = Number(entry.unpaidAmount || 0);
    const paymentState = inactive
      ? { className: 'inactive', label: statusNames[entry.status] || '已作废' }
      : settled
        ? { className: 'paid', label: '已付款' }
        : { className: 'unpaid', label: '未付款' };
    const budgetVariance = payableAmount - paidAmount;
    const amountLabels = settled
      ? { payable: '预算', paid: '实际', remaining: budgetVariance >= 0 ? '预算结余' : '超出预算', remainingAmount: Math.abs(budgetVariance) }
      : inactive
        ? { payable: '原应付', paid: '原实付', remaining: budgetVariance >= 0 ? '原差额' : '原超支', remainingAmount: Math.abs(budgetVariance) }
        : { payable: '应付', paid: '实付', remaining: '待付', remainingAmount: unpaidAmount };
    const lifecycleActions = settled && permissions.correct
      ? `<button data-cost-correct="${esc(entry.id)}">更正支出</button><button class="danger" data-cost-void="${esc(entry.id)}">作废 / 冲销</button>`
      : inactive
        ? isOwner() && projectCanWrite() && entry.canPermanentlyDelete ? `<button class="danger" data-cost-plan-delete="${esc(entry.id)}" data-permanent-delete="true">彻底删除</button>` : ''
        : !permissions.plan ? '' : `<button data-cost-edit="${esc(entry.id)}">编辑计划</button><button class="danger" data-cost-plan-delete="${esc(entry.id)}">删除未确认计划</button>`;
    const hasActions = (permissions.plan && allowSubitem && !settled && !inactive) || (permissions.confirm && !settled && !inactive) || lifecycleActions;
    return `<article class="cost-entry cost-plan-entry payment-${paymentState.className} ${settled ? 'confirmed' : ''} ${inactive ? 'is-voided' : ''}" data-cost-record-id="${esc(entry.id)}">${!inactive ? `<label class="batch-row-select cost-plan-select-slot" title="选择支出：${esc(entry.title)}"><input type="checkbox" data-cost-batch-select value="${esc(entry.id)}" aria-label="选择支出：${esc(entry.title)}"><span aria-hidden="true">选择</span></label>` : '<span class="cost-plan-select-slot cost-plan-select-placeholder" aria-hidden="true"></span>'}<div class="cost-plan-main"><div class="cost-plan-heading"><b>${esc(entry.title)}</b><span class="cost-payment-status ${paymentState.className}">${paymentState.label}</span></div><p>${esc(entry.milestoneName)} · ${esc(entry.categoryLabel)} · 计划付款 ${esc(entry.plannedDate)}</p><div class="cost-plan-amounts"><span><em>${amountLabels.payable}</em><strong>${formatMoney(payableAmount)}</strong></span><span><em>${amountLabels.paid}</em><strong>${formatMoney(paidAmount)}</strong></span><span><em>${amountLabels.remaining}</em><strong>${formatMoney(amountLabels.remainingAmount)}</strong></span>${entry.vendor ? `<span class="cost-plan-vendor"><em>收款方</em><strong>${esc(entry.vendor)}</strong></span>` : ''}</div></div>${hasActions ? `<div class="cost-plan-actions">${permissions.plan && allowSubitem && !settled && !inactive ? `<button class="secondary" data-cost-subitem="${esc(entry.id)}">增加分项</button>` : ''}${permissions.confirm && !settled && !inactive ? `<button class="primary" data-cost-confirm="${esc(entry.id)}">确认支出</button>` : ''}${lifecycleActions ? `<details class="action-more-menu"><summary>更多操作</summary><div>${lifecycleActions}</div></details>` : ''}</div>` : ''}</article>`;
  }

  function costPlanListHtml(cost, permissions) {
    const plans = cost.plans || [];
    const materials = cost.materialItems || [];
    const groups = plans.filter((item) => item.isGroup);
    const items = plans.filter((item) => !item.isGroup);
    const groupedIds = new Set(groups.map((group) => group.id));
    const grouped = groups.map((group) => {
      const children = items.filter((item) => item.parentId === group.id);
      const materialChildren = materials.filter((item) => item.costGroupId === group.id);
      const allocationLabel = Number(group.overAllocatedAmount || 0) > 0 ? `已超出总额 ${formatMoney(group.overAllocatedAmount)}` : `未分配 ${formatMoney(group.unallocatedAmount || 0)}`;
      const childRows = `${children.map((entry) => costPlanEntryHtml(entry, permissions)).join('')}${materialChildren.map((item) => materialCostEntryHtml(item, true)).join('')}`;
      const hasChildren = children.length || materialChildren.length;
      return `<section class="cost-plan-group" data-cost-record-id="${esc(group.id)}"><header><div><b>${esc(group.title)}</b><small>${esc(group.categoryLabel)} · 总额 ${formatMoney(group.payableAmount)} · 已分配 ${formatMoney(group.allocatedAmount || 0)} · ${allocationLabel}</small></div><dl><div><dt>总额</dt><dd>${formatMoney(group.payableAmount)}</dd></div><div><dt>实付</dt><dd>${formatMoney(group.paidAmount)}</dd></div><div><dt>剩余</dt><dd>${formatMoney(group.unpaidAmount)}</dd></div></dl>${permissions.plan ? `<div class="cost-group-actions"><button class="primary" data-cost-subitem="${esc(group.id)}">增加分项</button><button class="ghost" data-cost-edit="${esc(group.id)}">编辑总项</button><button class="ghost" data-cost-plan-delete="${esc(group.id)}" ${hasChildren ? 'disabled title="请先调整或移除下属支出及材料分项"' : ''}>删除空总项</button></div>` : ''}</header><div>${hasChildren ? childRows : '<div class="empty compact">还没有分项，可新增支出节点，或在厂家调配中把材料关联到本总项。</div>'}</div></section>`;
    }).join('');
    const standalone = items.filter((item) => !item.parentId || !groupedIds.has(item.parentId));
    return `${grouped}${standalone.length ? `<section class="cost-plan-standalone"><div class="cost-legacy-title">单项支出</div>${standalone.map((entry) => costPlanEntryHtml(entry, permissions, true)).join('')}</section>` : ''}` || '<div class="empty compact">还没有支出计划。</div>';
  }

  function materialCostEntryHtml(item, linked = false) {
    const paymentNames = { unpaid: '未付款', partial: '部分付款', paid: '已付清' };
    return `<article class="cost-entry material-cost-entry"><div><b>${esc(item.title)}</b><p>${esc(item.plannedDate || '未设置日期')} · ${esc(item.vendor || '未填写厂家')} · ${paymentNames[item.paymentStatus] || item.paymentStatus}</p><small>应付 ${formatMoney(item.payableAmount)} · 实付 ${formatMoney(item.paidAmount)} · 待付 ${formatMoney(item.unpaidAmount)}</small></div><span class="badge ${item.unpaidAmount ? 'attention' : 'normal'}">${linked ? '材料分项 · 自动联动' : item.unpaidAmount ? '已联动待付' : '已联动实付'}</span></article>`;
  }

  function materialCostListHtml(cost) {
    const rows = (cost.materialItems || []).filter((item) => !item.costGroupId);
    if (!rows.length) return '';
    return `<section class="material-cost-sync"><div class="cost-legacy-title">未归入费用总项的材料采购（自动同步）</div>${rows.map((item) => materialCostEntryHtml(item)).join('')}</section>`;
  }

  function costStatementRows() {
    const cost = state.projectDetail?.cost || {};
    const plans = (cost.plans || []).filter((item) => !item.isGroup).map((item) => ({
      key: `plan:${item.id}`,
      title: item.title,
      meta: `${item.milestoneName} · ${item.categoryLabel} · ${item.vendor || '未填写收款方'}`,
      payable: Number(item.payableAmount || item.plannedAmount || 0),
      paid: Number(item.paidAmount || item.actualAmount || 0),
      unpaid: Number(item.unpaidAmount || 0),
      vendor: item.vendor || '',
    }));
    const entries = (cost.entries || []).map((item) => ({
      key: `entry:${item.id}`,
      title: item.description || `${item.categoryLabel}（历史实际成本）`,
      meta: `${item.incurredDate} · ${item.categoryLabel} · ${item.vendor || '未填写收款方'}`,
      payable: Number(item.payableAmount || item.amount || 0),
      paid: Number(item.paidAmount || item.amount || 0),
      unpaid: Number(item.unpaidAmount || 0),
      vendor: item.vendor || '',
    }));
    const materials = (cost.materialItems || []).map((item) => ({
      key: `material:${item.id}`,
      title: item.title,
      meta: `材料采购自动同步 · ${item.plannedDate || '未设置日期'} · ${item.vendor || '未填写厂家'}`,
      payable: Number(item.payableAmount || 0),
      paid: Number(item.paidAmount || 0),
      unpaid: Number(item.unpaidAmount || 0),
      vendor: item.vendor || '',
    }));
    return [...plans, ...materials, ...entries];
  }

  function updateCostStatementSelection() {
    const checks = $$('[data-cost-statement-item]', $('#costStatementItems'));
    const selected = checks.filter((input) => input.checked);
    const rows = new Map(costStatementRows().map((item) => [item.key, item]));
    const totals = selected.reduce((sum, input) => {
      const item = rows.get(input.value);
      if (item) {
        sum.payable += item.payable;
        sum.paid += item.paid;
        sum.unpaid += item.unpaid;
      }
      return sum;
    }, { payable: 0, paid: 0, unpaid: 0 });
    $('#costStatementSelectionCount').textContent = `已选择 ${selected.length} 项`;
    $('#costStatementPayable').textContent = formatMoney(totals.payable);
    $('#costStatementPaid').textContent = formatMoney(totals.paid);
    $('#costStatementUnpaid').textContent = formatMoney(totals.unpaid);
    $('#costStatementSelectAll').checked = !!checks.length && selected.length === checks.length;
    $('#costStatementSelectAll').indeterminate = selected.length > 0 && selected.length < checks.length;
    const submit = $('#costStatementForm button[type="submit"]');
    const preview = $('#costStatementForm [data-cost-statement-preview]');
    submit.disabled = !selected.length;
    preview.disabled = !selected.length;
  }

  function openCostStatementDialog() {
    const rows = costStatementRows();
    const form = $('#costStatementForm');
    const vendors = [...new Set(rows.map((item) => item.vendor.trim()).filter(Boolean))];
    form.reset();
    form.elements.counterparty.value = vendors.length === 1 ? vendors[0] : '';
    $('#costStatementItems').innerHTML = rows.length ? rows.map((item) => `
      <label class="cost-statement-item">
        <input type="checkbox" value="${esc(item.key)}" data-cost-statement-item checked>
        <span><b>${esc(item.title)}</b><small>${esc(item.meta)}</small></span>
        <em><small>应付</small>${formatMoney(item.payable)}</em>
        <em><small>实付</small>${formatMoney(item.paid)}</em>
        <em class="${item.unpaid ? 'unpaid' : ''}"><small>待付</small>${formatMoney(item.unpaid)}</em>
      </label>`).join('') : '<div class="empty compact">暂无可导出的成本明细，请先设置支出节点。</div>';
    $('#costStatementSelectAll').checked = true;
    updateCostStatementSelection();
    $('#costStatementDialog').showModal();
  }

  function openCostStatementPdf(preview = false) {
    const selected = $$('[data-cost-statement-item]:checked', $('#costStatementItems')).map((input) => input.value);
    if (!selected.length) return showToast('请至少选择一项成本明细', true);
    const form = $('#costStatementForm');
    const params = new URLSearchParams({ itemIds: selected.join(',') });
    if (form.elements.counterparty.value.trim()) params.set('counterparty', form.elements.counterparty.value.trim());
    if (form.elements.note.value.trim()) params.set('note', form.elements.note.value.trim());
    if (preview) params.set('preview', 'true');
    const url = `/api/organizations/${state.organization.id}/projects/${state.project.id}/cost-statement.pdf?${params}`;
    window.open(url, '_blank', 'noopener');
    if (!preview) $('#costStatementDialog').close();
  }

  function renderProjectWorkspace() {
    const project = state.project;
    const moduleAccess = state.projectDetail.moduleAccess || Object.fromEntries(projectModuleOrder.map((module) => [module, hasProjectModule(module)]));
    const moduleNavigation = projectModuleOrder.filter((module) => moduleAccess[module]).map((module) => `<button type="button" data-project-section="${module}">${projectModuleLabels[module]}</button>`).join('');
    const report = state.projectDetail.report || { daily: {}, weekly: {} };
    const cost = state.projectDetail.cost;
    const business = state.projectDetail.business;
    const materials = state.projectDetail.materials || { items: [] };
    const milestones = state.projectDetail.milestones || [];
    const checklistItems = state.projectDetail.checklistItems || [];
    const canManageWorkflow = projectCanWrite() && canApproveProject();
    const canRecordWorkflow = projectCanWrite() && state.role !== 'viewer';
    const financePermissions = {
      plan: canUseAction('finance', 'finance.plan'),
      receive: canUseAction('finance', 'finance.receive'),
      correct: canUseAction('finance', 'finance.correct'),
    };
    const procurementPermissions = {
      manage: canUseAction('costs', 'procurement.manage'),
      pay: canUseAction('costs', 'procurement.pay'),
      correct: canUseAction('costs', 'procurement.correct'),
    };
    const costPermissions = {
      plan: canUseAction('costs', 'cost.plan'),
      confirm: canUseAction('costs', 'cost.confirm'),
      correct: canUseAction('costs', 'cost.correct'),
    };
    const milestoneStatusLabel = { pending: '待开始', in_progress: '进行中', completed: '已完成', blocked: '受阻', overdue: '已逾期' };
    const checklistStatusLabel = { pending: '待验收', passed: '已通过', failed: '不通过' };
    const completedMilestones = milestones.filter((item) => item.rawStatus === 'completed').length;
    const currentMilestone = milestones.find((item) => ['in_progress', 'blocked', 'overdue'].includes(item.status))
      || milestones.find((item) => item.rawStatus !== 'completed');
    const currentNodeActions = moduleAccess.execution && canManageWorkflow && !project.planConfigured
      ? '<button class="primary" data-construction-plan>配置施工计划</button>'
      : moduleAccess.execution && canRecordWorkflow && currentMilestone
        ? '<button class="primary" data-project-action="log">记录现场</button>'
        : '';
    const projectMoreActions = [
      moduleAccess.client && canApproveProject() && projectCanWrite() ? '<button type="button" data-project-client>绑定客户个人端</button>' : '',
      projectCanWrite() && isOwner() ? '<button type="button" data-project-edit>编辑项目资料</button>' : '',
      '<button type="button" data-project-refresh>刷新数据</button>',
      isOwner() && canWrite() ? `<button type="button" class="danger-action" data-project-lifecycle="${project.lifecycleStatus === 'archived' ? 'active' : 'archived'}">${project.lifecycleStatus === 'archived' ? '恢复项目' : '归档项目'}</button>` : '',
    ].filter(Boolean).join('');
    const planTools = moduleAccess.execution && canManageWorkflow ? `<div class="timeline-plan-actions"><button type="button" class="secondary timeline-primary-action" data-construction-plan>${project.planConfigured ? '编辑施工计划' : '配置施工计划'}</button>${project.planConfigured ? '<details class="timeline-tools-menu"><summary>导出与更多 <img class=xz-icon src=assets/icons/chevron-down.svg alt aria-hidden=true></summary><div><button type="button" data-construction-schedule-image>导出客户版进度表</button><button type="button" data-progress-comparison-export>导出计划/实际表格</button></div></details>' : ''}</div>` : '';
    const cashBalance = state.projectDetail.commercialAccess && business ? formatMoney(business.cashBalance) : '未开通合同收款权限';
    const expectedGrossProfit = business?.budgetedGrossProfit ?? business?.expectedGrossProfit;
    const hasExpectedGrossProfit = expectedGrossProfit != null;
    $('#projectHero').innerHTML = `
      <div class="project-hero-main"><div class="project-hero-copy"><p class="eyebrow">${esc(currentMilestone?.name || '施工计划待配置')} · ${statusNames[project.status]}</p><h1>${esc(project.name)}</h1><div class="project-hero-meta"><span><small>客户</small>${esc(project.customerName || '未填写')}</span><span class="wide"><small>地址</small>${esc(project.location || '未填写')}</span><span><small>设计</small>${esc(project.designerName || '未分配')}</span><span><small>工长</small>${esc(project.siteManagerName || '未分配')}</span><span><small>总负责人</small>${esc(project.managerName || '未分配')}</span></div></div><div class="hero-actions">${currentNodeActions}<details class="project-more-menu"><summary>项目操作 <img class=xz-icon src=assets/icons/chevron-down.svg alt aria-hidden=true></summary><div>${projectMoreActions}</div></details></div></div>
      <nav class="project-workspace-nav" aria-label="项目功能">${moduleNavigation}</nav>
      <div class="project-health-summary"><span><small>当前节点</small><b>${esc(currentMilestone?.name || (milestones.length ? '全部完成' : '待配置'))}</b></span><span><small>节点完成</small><b>${completedMilestones}/${milestones.length}</b></span><span class="${Number(project.riskMilestoneCount || 0) ? 'risk-number' : ''}"><small>风险节点</small><b>${Number(project.riskMilestoneCount || 0)}</b></span><span class="${business && Number(business.cashBalance) < 0 ? 'risk-number' : ''}"><small>项目现金余额</small><b>${cashBalance}</b></span></div>`;
    $('#project-tab-overview').innerHTML = `
      <section class="construction-timeline-panel" data-project-section-panel="execution">
        <div class="panel-head sticky-timeline-head"><div><p class="section-kicker">CONSTRUCTION TIMELINE</p><h2>施工进度与风险</h2><p>按节点查看现场照片、整改、验收与客户同步，当前节点已重点标出。</p></div><div class="timeline-head-side"><div class="timeline-legend"><span class="done"><i></i>已完成</span><span class="active"><i></i>进行中</span><span class="risk"><i></i>受阻 / 逾期</span></div>${planTools}</div></div>
        <div class="timeline-progress-summary"><div><span>节点完成</span><b>${completedMilestones}/${milestones.length}</b></div><div class="timeline-progress-main"><div class="progress-track"><div class="progress-fill ${project.riskMilestoneCount ? 'late' : ''}" style="width:${Math.max(milestones.length ? 1 : 0, project.actualProgress)}%"></div></div><p>${project.planConfigured ? `当前节点 ${esc(currentMilestone?.name || '全部完成')} · 实际 ${project.actualProgress}% / 计划 ${project.plannedProgress}%（按工期加权） · 工期 ${formatDate(project.startDate)}—${formatDate(project.plannedDate)}` : '尚未生成施工进度表，请先配置施工节点和预计工期。'}</p></div>${canManageWorkflow && !project.planConfigured ? '<button class="primary" data-construction-plan>立即生成进度表</button>' : `<span class="timeline-risk-note ${Number(project.riskMilestoneCount || 0) ? 'has-risk' : ''}">${Number(project.riskMilestoneCount || 0) ? `<b>${project.riskMilestoneCount}</b> 个风险节点待处理` : '当前无风险节点'}</span>`}</div>
        <div class="construction-timeline" id="constructionTimeline">${milestones.length ? constructionTimelineHtml(milestones, checklistItems, canManageWorkflow, canRecordWorkflow, milestoneStatusLabel, checklistStatusLabel) : '<div class="empty">暂无施工节点</div>'}</div>
      </section>
      <div class="project-report-grid" data-project-section-panel="execution">
        <section class="panel report-card"><div><p class="section-kicker">TODAY</p><h3>今日过程数据</h3></div><div class="report-metrics"><span><b>${report.daily.siteLogs || 0}</b>现场日志</span><span><b>${report.daily.issues || 0}</b>新增整改</span><span><b>${report.daily.clientUpdates || 0}</b>客户发布</span></div></section>
        <section class="panel report-card"><div><p class="section-kicker">LAST 7 DAYS</p><h3>近七日项目周报</h3></div><div class="report-metrics"><span><b>${report.weekly.siteLogs || 0}</b>现场日志</span><span><b>${report.weekly.issuesClosed || 0}</b>关闭问题</span><span><b>${report.weekly.qualityPassed || 0}/${report.weekly.qualityTotal || 0}</b>验收通过</span></div></section>
      </div>
      ${state.projectDetail.commercialAccess && business ? `<section class="panel workflow-panel enterprise-business-panel" data-project-section-panel="finance">
        <div class="panel-head"><div><p class="section-kicker">CONTRACT & COLLECTION</p><h2>合同与收款</h2><p>合同总价作为收款计算基准，完整收款计划统一编辑，逾期节点自动进入首页待办。</p></div><div class="panel-action-group"><button class="secondary" data-payment-plan-image>导出业主版收款表</button>${financePermissions.plan ? '<button class="secondary" data-open="changeOrderDialog">新增增减项</button><button class="primary" data-payment-plan>编辑收款计划</button>' : ''}</div></div>
        <div class="report-metrics business-summary"><span><b>${formatMoney(business.adjustedContractAmount)}</b>调整后合同额<small>原合同 ${formatMoney(business.contractAmount)}</small></span><span><b>${formatMoney(business.receivedAmount)}</b>累计已收</span><span><b>${formatMoney(business.remainingAmount)}</b>总剩余应收</span><span class="${business.overdueCount ? 'risk-number' : ''}"><b>${business.overdueCount || 0}</b>逾期收款<small>${formatMoney(business.overdueAmount || 0)}</small></span></div>
        <div class="finance-health-strip${hasExpectedGrossProfit ? ' has-expected-gross-profit' : ''}"><span><small>项目成本预算</small><b>${formatMoney(business.costBudget ?? 0)}</b></span><span><small>预计完工成本</small><b>${formatMoney(business.forecastCompletionCost ?? cost?.forecastCompletionCost ?? business.plannedCostAmount)}</b></span><span><small>实际已支付成本</small><b>${formatMoney(business.spentAmount)}</b></span>${hasExpectedGrossProfit ? `<span><small>预算毛利</small><b>${formatMoney(expectedGrossProfit)}</b></span>` : ''}<span><small>合同扣实付成本余额</small><b>${formatMoney(business.actualGrossProfit ?? business.currentGrossProfit)}</b></span><span><small>总剩余应收</small><b>${formatMoney(business.remainingAmount)}</b></span></div>
        <p class="finance-formula-note">预算毛利＝调整后合同额－项目成本预算；未设预算时按已配置支出与材料计划成本计算。“合同扣实付成本余额”只反映合同额扣除已支付成本，并非项目最终利润。材料付款会自动同步计入项目成本。</p>
        <div class="business-columns">
          <div><div class="subsection-title"><b>收款计划</b><span>${business.payments?.length || 0} 个节点 · ${business.paymentCalculationMode === 'split' ? '人辅 / 主材分开核算' : `比例合计 ${Number(business.plannedPercentTotal || 0)}%`} · 支持分次到账</span></div><div class="business-list">${paymentPlanListHtml(business, financePermissions)}</div></div>
          <div><div class="subsection-title"><b>合同增减项</b><span>${business.pendingChangeCount || 0} 项待双方确认</span></div><div class="business-list">${business.changeOrders?.length ? business.changeOrders.map((item) => changeOrderHtml(item, financePermissions.plan)).join('') : '<div class="empty compact">还没有合同增减项。</div>'}</div></div>
        </div>
      </section>` : '<section class="panel project-section-empty" data-project-section-panel="finance"><b>合同与收款仅项目负责人及企业管理员可见</b><p>当前账号可以继续处理施工执行和客户交付内容。</p></section>'}
      <section class="panel workflow-panel enterprise-material-panel" data-project-section-panel="costs">
        <div class="panel-head"><div><p class="section-kicker">MATERIAL & FACTORY</p><h2>材料与厂家调配</h2><p>每个项目独立记录厂家、材料金额；无需测量的材料可直接更新为已下单或已送货。</p></div>${procurementPermissions.manage ? '<button class="primary" data-open="materialDialog">新增厂家调配</button>' : ''}</div>
        <div class="report-metrics material-summary"><span><b>${materials.total || 0}</b>材料项目</span><span><b>${formatMoney(materials.purchaseAmount || 0)}</b>材料总额</span><span><b>${materials.manufacturerProgress?.installed || 0}</b>厂家已安装</span><span><b>${formatMoney(materials.unpaidPurchaseAmount || 0)}</b>材料待付款</span></div>
        ${procurementPermissions.manage && materials.items?.length ? '<div class="batch-toolbar"><span>勾选材料后可统一更新采购物流状态</span><button class="secondary" type="button" data-material-batch-action>批量更新状态</button></div>' : ''}
        <div class="business-list material-list">${materials.items?.length ? materials.items.map((item) => materialItemHtml(item, procurementPermissions)).join('') : '<div class="empty">还没有材料采购计划。</div>'}</div>
      </section>
      ${state.projectDetail.costAccess && cost ? `<section class="panel workflow-panel enterprise-cost-panel" data-project-section-panel="costs">
        <div class="panel-head"><div><p class="section-kicker">PROJECT COST</p><h2>项目成本</h2><p>费用总项只计一次预算，分项按阶段记录实际支付；材料采购继续自动联动。</p></div><div class="panel-action-group"><button class="secondary" data-cost-statement>导出成本对账单</button>${costPermissions.plan ? '<button class="secondary" data-cost-contingency>设置不可预见费</button><button class="primary" data-open="costDialog">设置支出节点</button>' : ''}</div></div>
        <div class="cost-budget-banner"><div><span>项目成本预算</span><b>${formatMoney(cost.budget || project.costBudget || 0)}</b></div><p>立项时设置的项目总成本；预算毛利＝调整后合同额－项目成本预算。未设预算时按已配置支出与材料计划成本计算。</p></div>
        <div class="report-metrics cost-summary"><span><b>${formatMoney(cost.budget ?? project.costBudget ?? 0)}</b>成本预算</span><span><b>${formatMoney(cost.committedCost ?? cost.payable ?? 0)}</b>已承诺成本<small>已确认采购与支出</small></span><span><b>${formatMoney(cost.paid)}</b>实付成本</span><span><b>${formatMoney(cost.forecastCompletionCost ?? cost.payable ?? 0)}</b>预计完工成本</span><span class="${Number(cost.budgetVariance ?? 0) < 0 ? 'risk-number' : ''}"><b>${formatMoney(cost.budgetVariance ?? ((cost.budget || 0) - (cost.forecastCompletionCost ?? cost.payable ?? 0)))}</b>预算差额<small>预算－预计完工成本</small></span></div>
        ${(cost.plans || []).length ? '<div class="batch-toolbar"><span>勾选支出后可批量生成本次对账范围</span><button class="secondary" type="button" data-cost-batch-action>批量加入对账单</button></div>' : ''}
        <div class="cost-entry-list">${costPlanListHtml(cost, costPermissions)}${materialCostListHtml(cost)}${cost.entries?.length ? `<div class="cost-legacy-title">历史实际成本</div>${cost.entries.map((entry) => `<article class="cost-entry"><div><b>${esc(entry.categoryLabel)} · ${esc(entry.description || '历史实际成本')}</b><p>${esc(entry.incurredDate)} · ${esc(entry.vendor || '未填写收款方')}</p><small>应付 ${formatMoney(entry.payableAmount)} · 实付 ${formatMoney(entry.paidAmount)} · 待付 ${formatMoney(entry.unpaidAmount)}</small></div>${costPermissions.correct ? `<details class="action-more-menu"><summary>更多操作</summary><div><button class="danger" data-cost-delete="${esc(entry.id)}">作废历史成本</button></div></details>` : ''}</article>`).join('')}` : ''}</div>
      </section>` : ''}`;
    const progressExportButton = $('#project-tab-overview [data-progress-comparison-export]');
    if (progressExportButton) progressExportButton.textContent = '导出计划/实际图片';
    $$('[data-project-section-panel]', $('#project-tab-overview')).forEach((panel) => {
      panel.classList.toggle('hidden', !moduleAccess[panel.dataset.projectSectionPanel]);
    });
    selectProjectWorkspaceSection(state.projectSection || 'execution');
    renderLogs();
    renderIssues();
    renderClient();
  }

  function photoStrip(media) {
    if (!media?.length) return '';
    const canDelete = projectCanWrite() && state.role !== 'viewer';
    return `<div class="photo-strip">${media.map((item) => `<span class="managed-photo"><a href="${esc(item.url)}" target="_blank" rel="noopener"><img src="${esc(`${item.url}${item.url.includes('?') ? '&' : '?'}thumbnail=1`)}" alt="现场照片" loading="lazy"></a>${photoSyncBadge(item)}${canDelete ? `<button class="photo-trash-button" type="button" data-media-trash="${esc(item.id)}" data-media-project="${esc(state.project?.id || item.projectId || '')}" aria-label="删除这张照片">删除</button>` : ''}</span>`).join('')}</div>`;
  }

  function renderUploadPreview(input) {
    const preview = $('[data-upload-preview]', input?.closest('form'));
    if (!preview) return;
    const files = Array.from(input.files || []);
    preview.hidden = !files.length;
    const isLogUpload = input.closest('form')?.id === 'logForm';
    preview.innerHTML = files.map((file, index) => `<div class="upload-preview-item${isLogUpload && clientSyncFiles.has(file) ? ' client-selected' : ''}"><img src="${URL.createObjectURL(file)}" alt="待上传图片 ${index + 1}">${isLogUpload ? `<label class="upload-client-choice"><input type="checkbox" data-client-upload-index="${index}" ${clientSyncFiles.has(file) ? 'checked' : ''}><span>同步给客户</span></label>` : ''}<b class="upload-preview-name">${esc(file.name)}</b><button type="button" data-upload-remove="${index}" aria-label="移除${esc(file.name)}"><img class=xz-icon src=assets/icons/close.svg alt aria-hidden=true></button></div>`).join('');
    if (isLogUpload) updateLogClientSyncSelectionState();
  }

  function clearUploadPreview(form) {
    const input = $('[data-upload-files]', form);
    const preview = $('[data-upload-preview]', form);
    if (input) input.value = '';
    if (preview) {
      preview.innerHTML = '';
      preview.hidden = true;
    }
  }

  function renderLogs() {
    const logs = state.projectDetail.siteLogs;
    $('#issueLogSelect').innerHTML = '<option value="">不关联</option>' + logs.map((log) => `<option value="${esc(log.id)}">${formatDate(log.createdAt)} · ${esc(log.stage)}</option>`).join('');
    $('#project-tab-logs').innerHTML = `
      ${projectCanWrite() && state.role !== 'viewer' ? '<div class="section-actions"><button class="primary" data-project-action="log">提交现场照片与日志</button></div>' : ''}
      <div class="record-list">${logs.length ? logs.map((log) => {
        const actions = [];
        const logEditable = projectCanWrite() && state.role !== 'viewer' && (canApproveProject() || log.createdBy === state.me?.id);
        if (logEditable) {
          actions.push(`<button class="primary" data-log-append="${esc(log.id)}">继续添加照片</button>`);
          actions.push(`<button class="secondary" data-log-edit="${esc(log.id)}">编辑日志</button>`);
          actions.push(`<button class="ghost danger-text" data-log-delete="${esc(log.id)}">删除日志</button>`);
        }
        if (canApproveProject() && projectCanWrite() && log.reviewStatus === 'pending') {
          actions.push(`<button class="ghost" data-log-action="approve_internal" data-log-id="${esc(log.id)}">仅内部通过</button>`);
          if (hasProjectModule('client')) actions.push(`<button class="primary" data-log-action="publish_client" data-log-id="${esc(log.id)}">审核并发布</button>`);
          actions.push(`<button class="danger" data-log-action="return" data-log-id="${esc(log.id)}">退回</button>`);
        }
        if (canApproveProject() && projectCanWrite() && hasProjectModule('client') && log.reviewStatus === 'approved') {
          actions.push(`<button class="primary" data-log-action="publish_client" data-log-id="${esc(log.id)}">发布给客户</button>`);
        }
        return `<article class="record-card">
          <div class="record-head"><div><h3>${esc(log.stage)} · 现场记录</h3><div class="record-meta"><span>${esc(log.createdByName)}</span><span>${formatDate(log.createdAt, true)}</span><span>${log.media.length} 张照片</span></div></div><span class="badge ${esc(log.reviewStatus)}">${logStatusNames[log.reviewStatus] || log.reviewStatus}</span></div>
          <p>${esc(log.summary || '未填写现场说明')}</p>${photoStrip(log.media)}
          ${actions.length ? `<div class="record-actions">${actions.join('')}</div>` : ''}
        </article>`;
      }).join('') : '<div class="empty panel">暂无现场记录。点击“提交现场照片与日志”开始。</div>'}</div>`;
  }

  function issueActions(issue) {
    const actions = [
      `<button type="button" class="ghost" data-issue-report-preview="${esc(issue.id)}">预览整改 PDF</button>`,
      `<button type="button" class="ghost" data-issue-report-download="${esc(issue.id)}">导出整改 PDF</button>`,
    ];
    const canEdit = projectCanWrite() && state.role !== 'viewer'
      && (canApproveProject() || issue.ownerMemberId === state.membership?.id || issue.createdBy === state.me?.id);
    if (canEdit) actions.push(`<button type="button" class="secondary" data-issue-edit="${esc(issue.id)}">编辑整改</button>`);
    if (!projectCanWrite() || state.role === 'viewer') return actions.join('');
    if (['pending', 'in_progress', 'review'].includes(issue.status)) actions.push(`<button type="button" class="ghost danger-action" data-issue-action="cancel" data-issue-id="${esc(issue.id)}">撤销整改</button>`);
    if (issue.status === 'pending') actions.push(`<button type="button" class="secondary" data-issue-action="start" data-issue-id="${esc(issue.id)}">开始整改</button>`);
    if (issue.status === 'in_progress') actions.push(`<button type="button" class="primary" data-issue-action="submit_review" data-issue-id="${esc(issue.id)}">上传整改后照片并提交复核</button>`);
    if (issue.status === 'pending') actions.push(`<button type="button" class="ghost danger-action" data-issue-delete="true" data-issue-id="${esc(issue.id)}">删除整改</button>`);
    if (issue.status === 'review' && canApproveProject()) {
      actions.push(`<button type="button" class="primary" data-issue-action="approve_close" data-issue-id="${esc(issue.id)}">复核通过并关闭</button>`);
      actions.push(`<button type="button" class="ghost" data-issue-action="reopen" data-issue-id="${esc(issue.id)}">退回继续整改</button>`);
    }
    if (issue.status === 'closed' && canApproveProject()) actions.push(`<button type="button" class="ghost" data-issue-action="reopen" data-issue-id="${esc(issue.id)}">重新打开</button>`);
    return actions.join('');
  }

  function renderIssues() {
    const issues = state.projectDetail.issues.filter((issue) => issue.status !== 'canceled');
    $('#project-tab-issues').innerHTML = `
      ${projectCanWrite() && state.role !== 'viewer' ? '<div class="section-actions"><button class="primary" data-open="issueDialog">发起整改</button></div>' : ''}
      <div class="record-list">${issues.length ? issues.map((issue) => `
        <article class="record-card">
          <div class="record-head"><div><h3>${esc(issue.title)}</h3><div class="record-meta"><span>负责人：${esc(issue.ownerName || '未分配')}</span><span>截止：${formatDate(issue.dueAt, true)}</span><span>${issue.priority === 'urgent' ? '紧急' : '普通'}</span></div></div><span class="badge ${esc(issue.status)}">${statusNames[issue.status] || issue.status}</span></div>
          <p>${esc(issue.description || '未填写整改要求')}</p>${issueMediaGroupsHtml(issue)}
          <div class="record-actions">${issueActions(issue)}</div>
        </article>`).join('') : '<div class="empty panel">暂无整改问题。</div>'}</div>`;
  }

  function renderClient() {
    if (!hasProjectModule('client')) {
      $('#project-tab-client').innerHTML = '';
      return;
    }
    const publications = state.projectDetail.publications;
    const responses = state.projectDetail.clientResponses || [];
    const cachedLink = sessionStorage.getItem(`enterprise.share.${state.project.id}`) || '';
    const binding = state.clientBinding || { active: false };
    $('#project-tab-client').innerHTML = `
      <section class="panel client-box">
        <div class="client-invite-bar"><div><b>邀请客户到个人端</b><span>生成专属邀请链接，客户登录后可直接绑定到自己的网页和小程序账号。</span></div>${canApproveProject() && projectCanWrite() ? '<button class="primary" data-client-action="invite">邀请客户并复制链接</button>' : ''}</div>
        <div class="panel-head" style="padding:0 0 15px;border:0"><div><h2>客户个人端同步</h2><p>绑定客户的装修小账本账号后，审核发布的进度和照片会进入客户个人网页版与微信小程序；企业内部日志、整改和成员信息不会同步。</p></div></div>
        <p><span class="badge ${binding.active ? 'normal' : 'attention'}">${binding.active ? '账号已绑定' : '待绑定客户账号'}</span>${binding.active ? `　${esc(binding.customerName || binding.customerUsername)}（${esc(binding.customerUsername)}）${binding.lastViewedAt ? ` · 最近查看 ${formatDate(binding.lastViewedAt, true)}` : ' · 尚未查看'}` : ''}</p>
        ${canApproveProject() && projectCanWrite() ? (binding.active
          ? `<div class="share-row"><input readonly value="${esc(binding.customerUsername)}"><details class="action-more-menu"><summary>账号管理</summary><div><p>解除后客户将无法继续通过个人账号查看本项目。</p><button class="danger" data-client-action="unbind-account">解除客户账号绑定</button></div></details></div>`
          : '<div class="share-row"><input id="clientAccountLogin" autocomplete="off" placeholder="输入客户的装修小账本用户名或登录邮箱"><button class="primary" data-client-action="bind-account">绑定客户账号</button></div><p class="storage-note">绑定只建立客户与项目的关系，不会自动公开内部内容；负责人点击“发布给客户”后，客户才会在个人网页和小程序中看到。也可以生成下方备用链接，让客户主动绑定。</p>')
          : '<p class="storage-note">只有项目总负责人或企业管理员可以绑定客户账号。</p>'}
      </section>
      <section class="panel client-box" style="margin-top:14px">
        <div class="panel-head" style="padding:0 0 15px;border:0"><div><h2>备用分享链接</h2><p>供尚未注册或临时查看的客户使用；链接访问仍只显示已审核发布的客户内容。</p></div></div>
        <p><span class="badge ${state.clientShare.active ? 'normal' : 'returned'}">${state.clientShare.active ? '链接已启用' : '尚未启用'}</span>${state.clientShare.lastViewedAt ? `　客户最近查看：${formatDate(state.clientShare.lastViewedAt, true)}` : ''}</p>
        ${canApproveProject() && projectCanWrite() ? `<div class="share-row"><input id="clientShareLink" readonly value="${esc(cachedLink)}" placeholder="点击右侧按钮生成客户链接">${state.clientShare.active ? '<details class="action-more-menu"><summary>链接管理</summary><div><p>生成新链接后旧链接立即失效；停用后客户将无法继续访问。</p><button class="danger" data-client-action="generate">生成新链接并停用旧链接</button><button class="danger" data-client-action="revoke">停用客户访问链接</button></div></details>' : '<button class="primary" data-client-action="generate">生成客户链接</button>'}</div>` : '<p class="storage-note">只有项目总负责人或企业管理员可以在套餐和项目均有效时生成、停用客户链接。</p>'}
      </section>
      <section class="panel client-box" style="margin-top:14px"><h2 style="margin-top:0">已发布动态</h2>
        <div class="publication-list">${publications.length ? publications.map((item) => `
          <div class="publication"><b>${formatDate(item.createdAt, true)} · ${esc(item.snapshot.stage || '')} · ${item.snapshot.progress || 0}%</b><p>${esc(item.snapshot.summary || '无说明')}</p></div>`).join('') : '<div class="empty">还没有向客户发布任何动态。请先在“现场照片与日志”中审核并发布。</div>'}</div>
      </section>
      <section class="panel client-box" style="margin-top:14px"><h2 style="margin-top:0">客户确认与留言</h2>
        <div class="client-feedback-list">${responses.length ? responses.map((item) => {
          const label = {confirm:'已确认',adjust:'需要调整',comment:'客户留言'}[item.responseType] || item.responseType;
          const statusLabel = item.status === 'resolved' ? '已处理' : '待回应';
          const action = item.status === 'open' && projectCanWrite() && state.role !== 'viewer'
            ? `<button data-client-response="${esc(item.id)}">标记已处理</button>` : '';
          return `<article class="client-feedback"><div><b>${esc(label)} · ${esc(item.customerName || '客户')}</b><span class="badge ${item.status === 'resolved' ? 'normal' : 'attention'}">${statusLabel}</span></div><small>${formatDate(item.createdAt, true)}${item.publicationId ? ' · 已关联发布版本' : ''}${item.resolvedAt ? ` · ${formatDate(item.resolvedAt, true)}处理` : ''}</small><p>${esc(item.content || (item.responseType === 'confirm' ? '客户确认本次进度。' : ''))}</p>${action}</article>`;
        }).join('') : '<div class="empty">客户尚未提交确认或留言。</div>'}</div>
      </section>`;
  }

  async function refreshProject(tab) {
    const projectId = state.project.id;
    const organizationId = state.organization.id;
    const requestVersion = projectRequestVersion;
    const isCurrent = () => requestVersion === projectRequestVersion && state.organization?.id === organizationId && state.project?.id === projectId;
    const expandedMilestoneIds = $$('[data-milestone-node][open]', $('#constructionTimeline'))
      .map((node) => node.dataset.milestoneNode);
    try {
      if (state.mediaLoadedRevision !== state.mediaRevision) {
        await Promise.all([refreshMediaCollections(), loadClientCenterData()]);
      }
      if (!isCurrent()) return;
      await loadDashboardData();
      if (!isCurrent()) return;
      await openProject(projectId, tab, { preserveScroll: true, expandedMilestoneIds });
    } catch (error) {
      if (isCurrent()) showToast(`操作已保存，但页面刷新失败，请刷新页面查看；不要重复提交。${error.message}`, true);
    }
  }

  async function loadDashboardData() {
    const [dashboard, operations] = await Promise.all([
      api(`/api/organizations/${state.organization.id}/dashboard`),
      api(`/api/organizations/${state.organization.id}/operations`),
    ]);
    state.dashboard = dashboard;
    state.operations = operations;
    renderDashboard();
    renderOperations();
  }

  async function loadClientCenterData() {
    state.clientCenter = await api(`/api/organizations/${state.organization.id}/client-center`);
    renderClientCenter();
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`));
      reader.readAsDataURL(file);
    });
  }

  function renderLogExistingMedia(log = null) {
    const container = $('#logForm [data-log-existing-media]');
    const media = log?.media || [];
    if (!container) return;
    container.hidden = !media.length;
    container.innerHTML = media.length ? `<div class="log-existing-photo-head"><b>已上传图片</b><span>勾选需要在客户进度页展示的照片；普通成员提交后须审核</span></div><div class="log-existing-photo-grid">${media.map((item, index) => `<label class="log-existing-photo${(item.clientSelected ?? item.clientSynced) ? ' client-selected' : ''}"><img src="${esc(`${item.url}${item.url.includes('?') ? '&' : '?'}thumbnail=1`)}" alt="已上传现场照片 ${index + 1}"><input type="checkbox" data-client-media-id="${esc(item.id)}" data-client-was-synced="${item.clientSynced ? '1' : '0'}" data-client-status="${esc(item.clientSyncStatus || '')}" ${(item.clientSelected ?? item.clientSynced) ? 'checked' : ''}><span>${item.clientSynced ? '已同步' : item.clientSyncStatus === 'pending' ? '待审核' : '同步此图'}</span></label>`).join('')}</div>` : '';
  }

  function logClientChoiceInputs(form = $('#logForm')) {
    return $$('[data-client-upload-index], [data-client-media-id]', form);
  }

  function updateLogClientSyncSelectionState(form = $('#logForm')) {
    if (!form) return;
    const master = form.elements.clientAfterReview;
    const choices = logClientChoiceInputs(form);
    const selectedCount = choices.filter((item) => item.checked).length;
    const allSelected = choices.length > 0 && selectedCount === choices.length;
    master.checked = allSelected;
    master.indeterminate = selectedCount > 0 && !allSelected;
    const card = master.closest('.client-sync-card');
    card?.classList.toggle('is-active', selectedCount > 0);
    const off = $('.client-sync-state-off', card);
    const on = $('.client-sync-state-on', card);
    if (off) off.textContent = choices.length ? '未选择' : '请先选图';
    if (on) on.textContent = `${selectedCount}/${choices.length} 已选择`;
    choices.forEach((choice) => {
      choice.closest('.upload-preview-item, .log-existing-photo')?.classList.toggle('client-selected', choice.checked);
      const label = choice.closest('.log-existing-photo')?.querySelector('span');
      if (label) label.textContent = choice.checked
        ? (choice.dataset.clientWasSynced === '1' ? '已同步' : choice.dataset.clientStatus === 'pending' ? '待审核' : '已选择，提交后按权限发布')
        : '同步此图';
    });
    updateLogClientSyncPresentation();
  }

  function selectedExistingClientMediaIds(form = $('#logForm')) {
    return $$('[data-client-media-id]:checked', form).map((item) => item.dataset.clientMediaId);
  }

  function selectedUploadClientIndexes(form = $('#logForm')) {
    return $$('[data-client-upload-index]:checked', form).map((item) => Number(item.dataset.clientUploadIndex));
  }

  const uploadImageMaxEdge = 2048;
  const uploadImageTargetBytes = 1536 * 1024;

  function canvasJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片压缩失败')), 'image/jpeg', quality);
    });
  }

  async function compressUploadImage(file) {
    if (!file || !String(file.type || '').startsWith('image/')) return file;
    let source = null;
    let cleanup = () => {};
    try {
      if (typeof createImageBitmap === 'function') {
        try { source = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
        catch (error) { source = await createImageBitmap(file); }
        cleanup = () => source.close?.();
      } else {
        const objectUrl = URL.createObjectURL(file);
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`${file.name} 无法读取`));
          image.src = objectUrl;
        });
        cleanup = () => URL.revokeObjectURL(objectUrl);
      }
      const width = Number(source.width || source.naturalWidth || 0);
      const height = Number(source.height || source.naturalHeight || 0);
      if (!width || !height) throw new Error(`${file.name} 无法读取`);
      const scale = Math.min(1, uploadImageMaxEdge / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      let blob = await canvasJpegBlob(canvas, .82);
      for (const quality of [.78, .74, .70, .66]) {
        if (blob.size <= uploadImageTargetBytes) break;
        blob = await canvasJpegBlob(canvas, quality);
      }
      const stem = String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
      return new File([blob], `${stem}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
    } catch (error) {
      return file;
    } finally {
      cleanup();
    }
  }

  async function uploadFiles(files, limit = 20) {
    const list = Array.from(files || []);
    if (list.length > limit) throw new Error(`本次最多上传 ${limit} 张照片`);
    const ids = [];
    for (const file of list) {
      const scope = `${state.organization.id}:${state.project.id}`;
      const cached = uploadedFileIds.get(file);
      if (cached?.scope === scope) {
        ids.push(cached.id);
        continue;
      }
      const uploadFile = await compressUploadImage(file);
      if (uploadFile.size > 5 * 1024 * 1024) throw new Error(`${file.name} 压缩后仍超过 5MB，请裁剪后重试`);
      const contentBase64 = await fileToBase64(uploadFile);
      const result = await api(`/api/organizations/${state.organization.id}/media`, {
        method: 'POST',
        body: JSON.stringify({ projectId: state.project.id, filename: uploadFile.name, contentBase64 }),
      });
      ids.push(result.media.id);
      uploadedFileIds.set(file, { scope, id: result.media.id });
    }
    return ids;
  }

  async function reviewLog(logId, action, button) {
    const actionLabels = { approve_internal: '确认仅供企业内部查看？', publish_client: '确认将这条现场动态和照片发布给客户？', return: '确认退回这条现场日志？' };
    if (!confirm(actionLabels[action])) return;
    setBusy(button, true);
    try {
      await api(`/api/organizations/${state.organization.id}/site-logs/${logId}/review`, {
        method: 'POST', body: JSON.stringify({ action, note: '' }),
      });
      showToast(action === 'publish_client' ? '已发布到客户进度页' : '日志状态已更新');
      await refreshProject('logs');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function updateIssue(issueId, action, mediaIds, button, occurredAt = null) {
    setBusy(button, true);
    try {
      await api(`/api/organizations/${state.organization.id}/issues/${issueId}`, {
        method: 'PATCH', body: JSON.stringify({ action, mediaIds, note: '', occurredAt }),
      });
      showToast(action === 'cancel' ? '整改已撤销，待办与关联验收记录已同步' : '整改状态已更新');
      await refreshProject('issues');
      state.issueCenter = await api(`/api/organizations/${state.organization.id}/issue-center`);
      renderIssueCenter();
      return true;
    } catch (error) {
      showToast(error.message, true);
      return false;
    } finally {
      setBusy(button, false);
    }
  }

  async function deleteIssue(issueId, button) {
    if (!confirm('确认删除这条整改？仅适用于误建且尚未开始、没有现场记录或整改照片的问题。删除后无法恢复；如已产生记录，请使用“撤销整改”。')) return;
    setBusy(button, true);
    try {
      await api(`/api/organizations/${state.organization.id}/issues/${issueId}`, { method: 'DELETE' });
      showToast('整改已删除，待办与关联验收记录已同步');
      await refreshProject('issues');
      state.issueCenter = await api(`/api/organizations/${state.organization.id}/issue-center`);
      renderIssueCenter();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function generateClientShare(button) {
    setBusy(button, true);
    try {
      const payload = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/client-share`, { method: 'POST' });
      const link = new URL(payload.share.sharePath, location.origin).href;
      sessionStorage.setItem(`enterprise.share.${state.project.id}`, link);
      await navigator.clipboard?.writeText(link);
      showToast('新的客户链接已生成并复制');
      await refreshProject('client');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function revokeClientShare(button) {
    if (!confirm('停用后，客户手里的旧链接将立即无法访问。确认停用？')) return;
    setBusy(button, true);
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/client-share`, { method: 'DELETE' });
      sessionStorage.removeItem(`enterprise.share.${state.project.id}`);
      showToast('客户链接已停用');
      await refreshProject('client');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function bindCustomerAccount(button) {
    const loginName = $('#clientAccountLogin')?.value.trim() || '';
    if (!loginName) return showToast('请输入客户的装修小账本用户名或登录邮箱', true);
    setBusy(button, true);
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/customer-binding`, {
        method: 'POST', body: JSON.stringify({ loginName }),
      });
      showToast('客户账号已绑定，发布内容会同步到客户网页和小程序');
      await refreshProject('client');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function unbindCustomerAccount(button) {
    if (!confirm('解除后，客户个人端将不再显示该项目；已发布记录和客户反馈仍保留。确认解除？')) return;
    setBusy(button, true);
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/customer-binding`, { method: 'DELETE' });
      showToast('客户账号绑定已解除');
      await refreshProject('client');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function inviteCustomer(button) {
    setBusy(button, true);
    try {
      const payload = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/client-share`, { method: 'POST' });
      const inviteLink = new URL(`/customer-projects.html?claim=${encodeURIComponent(payload.share.shareCode)}`, location.origin).href;
      sessionStorage.setItem(`enterprise.customerInvite.${state.project.id}`, inviteLink);
      await navigator.clipboard?.writeText(inviteLink);
      showToast('客户个人端邀请链接已复制，客户登录后即可绑定项目');
      await refreshProject('client');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  function timelineMilestoneIds() {
    return $$('[data-milestone-node]', $('#constructionTimeline')).map((node) => node.dataset.milestoneNode);
  }

  function updateTimelineOrderUi() {
    const nodes = $$('[data-milestone-node]', $('#constructionTimeline'));
    nodes.forEach((node, index) => {
      const number = $('.node-index', node);
      if (number) number.textContent = String(index + 1).padStart(2, '0');
      const up = $('[data-milestone-move="up"]', node);
      const down = $('[data-milestone-move="down"]', node);
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === nodes.length - 1;
    });
  }

  async function persistMilestoneOrder(milestoneIds) {
    const result = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/order`, {
      method: 'PATCH', body: JSON.stringify({ milestoneIds }),
    });
    const ordered = result.milestones || [];
    if (ordered.length) state.projectDetail.milestones = ordered;
    showToast('施工节点顺序已保存');
  }

  async function moveMilestone(milestoneId, direction) {
    const timeline = $('#constructionTimeline');
    const node = timeline?.querySelector(`[data-milestone-node="${CSS.escape(milestoneId)}"]`);
    if (!timeline || !node) return;
    const sibling = direction === 'up' ? node.previousElementSibling : node.nextElementSibling;
    if (!sibling?.matches('[data-milestone-node]')) return;
    if (direction === 'up') timeline.insertBefore(node, sibling);
    else timeline.insertBefore(sibling, node);
    updateTimelineOrderUi();
    try {
      await persistMilestoneOrder(timelineMilestoneIds());
    } catch (error) {
      showToast(error.message, true);
      await refreshProject('overview');
    }
  }

  function availableLogMilestones(selectedMilestone = null) {
    const rows = (state.projectDetail.milestones || []).filter((item) => item.rawStatus !== 'completed');
    if (selectedMilestone && !rows.some((item) => item.id === selectedMilestone.id)) rows.push(selectedMilestone);
    return rows;
  }

  function suggestedLogMilestone() {
    const rows = availableLogMilestones();
    return rows.find((item) => item.status === 'overdue')
      || rows.find((item) => item.status === 'blocked' || item.rawStatus === 'blocked')
      || rows.find((item) => item.status === 'in_progress' || item.rawStatus === 'in_progress')
      || rows[0];
  }

  function logMilestoneSuggestionHint(milestone, source = 'auto') {
    if (source === 'manual') return `已切换至“${milestone.name}”；本次照片和日志都会归入该节点。`;
    if (source === 'clicked') return `已按你点击的“${milestone.name}”匹配；交叉施工时仍可切换其他节点。`;
    if (milestone.status === 'overdue') return '系统已优先匹配当前逾期节点；如现场正在交叉施工，可切换其他节点。';
    if (milestone.status === 'blocked' || milestone.rawStatus === 'blocked') return '系统已优先匹配当前受阻节点；如本次记录属于其他工种，可切换节点。';
    return '系统已匹配当前施工节点；如现场存在交叉施工，可切换其他节点。';
  }

  function selectLogMilestone(milestone, { allowSwitch = true, source = 'auto' } = {}) {
    if (!milestone) return;
    const form = $('#logForm');
    const select = $('#logMilestoneSelect');
    const statusLabels = { pending: '待开始', in_progress: '进行中', completed: '已完成', blocked: '受阻', overdue: '已逾期' };
    select.innerHTML = availableLogMilestones(milestone).map((item) => `<option value="${esc(item.id)}" ${item.id === milestone.id ? 'selected' : ''}>${esc(item.name)} · ${esc(statusLabels[item.status] || statusLabels[item.rawStatus] || item.status)}</option>`).join('');
    select.disabled = !allowSwitch;
    form.dataset.milestoneId = milestone.id;
    form.elements.milestoneId.value = milestone.id;
    $('#logMilestoneName').textContent = milestone.name;
    $('#logMilestoneHint').textContent = allowSwitch
      ? logMilestoneSuggestionHint(milestone, source)
      : `该记录已归属于“${milestone.name}”，编辑或追加照片时不变更归属节点。`;
    if (form.dataset.logMode === 'create') {
      $('#logDialog .dialog-head h2').textContent = `${milestone.name} · 添加现场照片与日志`;
      $('#logDialog .dialog-head p').textContent = canApproveProject()
        ? `内容将归入“${milestone.name}”；勾选客户同步后可一次提交并发布。`
        : `内容将归入“${milestone.name}”，由项目总负责人或企业管理员审核。`;
    }
  }

  function openNodeLogDialog(milestone = null) {
    const form = $('#logForm');
    const openedFromNode = Boolean(milestone);
    milestone = milestone || suggestedLogMilestone();
    if (!milestone) return showToast('暂无可记录的施工节点，请先配置施工计划', true);
    form.reset();
    clearUploadPreview(form);
    renderLogExistingMedia();
    delete form.dataset.logId;
    form.dataset.logMode = 'create';
    form.elements.logId.value = '';
    form.elements.occurredAt.value = datetimeLocalValue();
    $$('[data-log-details], [data-log-upload]', form).forEach((element) => { element.hidden = false; });
    $('[data-upload-preview]', form).hidden = true;
    $('#logPhotoLabel').textContent = '现场照片（本次最多 50 张）';
    $('#logPhotoHelp').textContent = '可分多次选择后一起提交；同一条记录累计最多 100 张，单张不超过 5MB。';
    selectLogMilestone(milestone, { allowSwitch: true, source: openedFromNode ? 'clicked' : 'auto' });
    $('#logForm [data-client-sync-title]').textContent = '选择同步图片';
    $('#logForm [data-client-sync-help]').textContent = canApproveProject()
      ? '可逐张勾选；保存后仅把已勾选图片发布到客户进度页。'
      : '可逐张勾选；负责人审核通过后，仅把已勾选图片发布给客户。';
    updateLogClientSyncSelectionState();
    $('#logDialog').showModal();
  }

  function openLogEditDialog(log) {
    if (!log) return;
    const form = $('#logForm');
    const milestone = (state.projectDetail.milestones || []).find((item) => item.id === log.milestoneId);
    form.reset(); clearUploadPreview(form);
    form.dataset.logId = log.id; form.dataset.logMode = 'edit'; form.elements.logId.value = log.id;
    form.elements.milestoneId.value = log.milestoneId || '';
    form.elements.occurredAt.value = datetimeLocalValue(log.createdAt || new Date());
    form.elements.summary.value = log.summary || '';
    renderLogExistingMedia(log);
    $$('[data-log-details]', form).forEach((element) => { element.hidden = false; });
    $$('[data-log-upload]', form).forEach((element) => { element.hidden = true; });
    selectLogMilestone(milestone || { id: log.milestoneId || '', name: log.stage || '施工节点', status: 'completed', rawStatus: 'completed' }, { allowSwitch: false });
    $('#logDialog .dialog-head h2').textContent = '编辑现场日志';
    $('#logDialog .dialog-head p').textContent = '可调整记录日期与内容；已有照片和审核状态保留，已发布内容会同步更新客户视图。';
    $('#logForm [data-client-sync-title]').textContent = '选择同步图片';
    $('#logForm [data-client-sync-help]').textContent = log.reviewStatus === 'published'
      ? '带“已同步”标识的图片客户当前可见；可重新勾选并保存。'
      : '勾选需要同步的图片；审核发布后，未勾选图片仍只在企业内部显示。';
    updateLogClientSyncSelectionState();
    $('#logDialog').showModal();
  }

  function reportBrandingValues() {
    const defaults = {
      brandMode: 'text',
      brandText: state.organization?.name || '当前企业',
      tagline: '专业施工 · 透明交付 · 节点验收',
      managerTitle: '项目经理',
      managerSource: 'manager',
      includeIssueRecords: true,
      includeCustomerSyncRecords: false,
      logoUrl: '',
    };
    return { ...defaults, ...(state.organization?.reportBranding || {}) };
  }

  function renderReportStylePreview(forceReload = false) {
    const milestone = state.reportMilestone;
    if (!milestone) return;
    const frame = $('#reportStylePdfFrame');
    if (!frame || !state.organization?.id || !state.project?.id) return;
    const previewUrl = `/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${milestone.id}/acceptance-report.pdf?preview=true`;
    if (forceReload || frame.dataset.milestoneId !== milestone.id || !frame.src) {
      frame.dataset.milestoneId = milestone.id;
      frame.src = `${previewUrl}&refresh=${Date.now()}`;
    }
    const note = $('#reportStylePreviewNote');
    if (note) note.textContent = milestone.status === 'completed'
      ? '当前预览与正式导出共用同一套 PDF 模板、字体和统计口径。'
      : '当前节点尚未完成，预览会显示“待验收”；正式出具后版式保持一致。';
  }

  function prepareReportBrandingForm() {
    populateReportBrandingForm($('#reportBrandingForm'), $('#reportLogoHint'));
    if (state.reportLogoPreviewUrl) URL.revokeObjectURL(state.reportLogoPreviewUrl);
    state.reportLogoPreviewUrl = '';
  }

  function prepareReportBrandingSettingsForm() {
    populateReportBrandingForm($('#reportBrandingSettingsForm'), $('#reportSettingsLogoHint'));
    renderReportSettingsPreview();
  }

  function renderReportSettingsPreview() {
    const form = $('#reportBrandingSettingsForm');
    const preview = $('#reportSettingsPreview');
    if (!form || !preview) return;
    const saved = reportBrandingValues();
    const brandMode = form.elements.brandMode.value || saved.brandMode;
    const brandText = form.elements.brandText.value.trim() || saved.brandText;
    const tagline = form.elements.tagline.value.trim() || saved.tagline;
    const managerTitle = form.elements.managerTitle.value.trim() || saved.managerTitle;
    const managerSource = form.elements.managerSource.value || saved.managerSource;
    const includeIssueRecords = form.elements.includeIssueRecords.checked;
    const includeCustomerSyncRecords = form.elements.includeCustomerSyncRecords.checked;
    const logoUrl = state.reportSettingsLogoPreviewUrl || saved.logoUrl;
    const logo = brandMode === 'logo' && logoUrl
      ? `<img src="${esc(logoUrl)}" alt="当前公司 Logo">`
      : `<span>${esc((brandText || '企').slice(0, 1))}</span>`;
    preview.innerHTML = `<div class="report-settings-preview-mark">${logo}</div><div><small>当前客户文件表头预览</small><b>${esc(brandText)}</b><p>${esc(tagline)}</p></div><em>负责人显示：${esc(managerTitle)} · ${esc(reportManagerSourceLabel(managerSource))}<br>整改闭环：${includeIssueRecords ? '有记录时导出' : '不导出'} · 客户同步：${includeCustomerSyncRecords ? '有记录时导出' : '不导出'}</em>`;
  }

  function populateReportBrandingForm(form, logoHint) {
    if (!form) return;
    const branding = reportBrandingValues();
    form.elements.brandMode.value = branding.brandMode;
    form.elements.brandText.value = branding.brandText;
    form.elements.tagline.value = branding.tagline;
    form.elements.managerTitle.value = branding.managerTitle;
    form.elements.managerSource.value = branding.managerSource;
    form.elements.includeIssueRecords.checked = Boolean(branding.includeIssueRecords);
    form.elements.includeCustomerSyncRecords.checked = Boolean(branding.includeCustomerSyncRecords);
    form.elements.logo.value = '';
    if (logoHint) logoHint.textContent = branding.logoUrl
      ? '已保存公司 Logo；重新选择图片会替换，留空则继续使用。'
      : '选择 Logo 抬头时需要上传图片；保留为空不会替换现有 Logo。';
  }

  async function saveReportBrandingForm(form) {
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const file = form.elements.logo.files?.[0];
    setBusy(button, true, '保存中…');
    try {
      const payload = {
        brandMode: data.brandMode,
        brandText: String(data.brandText || '').trim(),
        tagline: String(data.tagline || '').trim(),
        managerTitle: String(data.managerTitle || '').trim(),
        managerSource: data.managerSource || 'manager',
        includeIssueRecords: form.elements.includeIssueRecords.checked,
        includeCustomerSyncRecords: form.elements.includeCustomerSyncRecords.checked,
        logoFilename: file?.name || 'logo',
        logoContentBase64: file ? await fileToBase64(file) : null,
        clearLogo: false,
      };
      const result = await api(`/api/organizations/${state.organization.id}/report-branding`, {
        method: 'PUT', body: JSON.stringify(payload), timeoutMs: 30000,
      });
      state.organization = result.organization;
      if (state.reportSettingsLogoPreviewUrl) URL.revokeObjectURL(state.reportSettingsLogoPreviewUrl);
      state.reportSettingsLogoPreviewUrl = '';
      prepareReportBrandingForm();
      prepareReportBrandingSettingsForm();
      renderReportStylePreview(true);
      showToast('企业报告设置已保存，网页和小程序报告已同步');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  function openLogAppendDialog(log) {
    if (!log) return;
    const currentCount = Number(log.media?.length || 0);
    const remaining = Math.max(0, 100 - currentCount);
    if (!remaining) return showToast('这条现场记录已达到 100 张照片上限', true);
    const form = $('#logForm');
    const milestone = (state.projectDetail.milestones || []).find((item) => item.id === log.milestoneId);
    form.reset(); clearUploadPreview(form);
    form.dataset.logId = log.id; form.dataset.logMode = 'append'; form.elements.logId.value = log.id;
    form.elements.milestoneId.value = log.milestoneId || '';
    form.elements.occurredAt.value = datetimeLocalValue(log.createdAt || new Date());
    form.elements.summary.value = log.summary || '';
    renderLogExistingMedia(log);
    $$('[data-log-details]', form).forEach((element) => { element.hidden = true; });
    $$('[data-log-upload]', form).forEach((element) => { element.hidden = false; });
    $('[data-upload-preview]', form).hidden = true;
    selectLogMilestone(milestone || { id: log.milestoneId || '', name: log.stage || '施工节点', status: 'completed', rawStatus: 'completed' }, { allowSwitch: false });
    $('#logPhotoLabel').textContent = `继续添加照片（本次最多 ${Math.min(50, remaining)} 张）`;
    $('#logPhotoHelp').textContent = `当前已有 ${currentCount} 张；新增图片可逐张勾选同步，未勾选图片仅企业内部可见。`;
    $('#logDialog .dialog-head h2').textContent = '继续添加现场照片';
    $('#logDialog .dialog-head p').textContent = '照片将直接并入原记录，不会新建第二条现场日志。';
    $('#logForm [data-client-sync-title]').textContent = '选择同步图片';
    $('#logForm [data-client-sync-help]').textContent = '可保留原有同步图片，并从新增图片中继续勾选需要同步的照片。';
    updateLogClientSyncSelectionState();
    $('#logDialog').showModal();
  }

  function updateLogClientSyncPresentation() {
    const form = $('#logForm');
    const checkbox = form?.elements?.clientAfterReview;
    const submitButton = form ? $('button[type="submit"]', form) : null;
    if (!form || !checkbox || !submitButton) return;
    const selectedCount = logClientChoiceInputs(form).filter((item) => item.checked).length;
    const hasClientPhotos = selectedCount > 0;
    form.classList.toggle('client-sync-enabled', hasClientPhotos);
    const mode = form.dataset.logMode || 'create';
    if (mode === 'append') {
      submitButton.textContent = hasClientPhotos ? '追加并更新客户同步' : '追加到这条记录';
      return;
    }
    if (mode === 'edit') {
      submitButton.textContent = hasClientPhotos ? '保存并更新客户同步' : '保存为仅企业内部';
      return;
    }
    if (hasClientPhotos) {
      submitButton.textContent = canApproveProject() ? '保存并同步给客户' : '提交审核并同步客户';
    } else {
      submitButton.textContent = canApproveProject() ? '保存到企业内部' : '上传并提交审核';
    }
  }

  function planRowHtml(milestone = {}, index = 0) {
    const started = false;
    const historyLocked = false;
    const fieldLock = '';
    return `<div class="construction-plan-row ${historyLocked ? 'is-history-locked' : ''}" data-plan-row data-milestone-id="${esc(milestone.id || '')}" data-locked="${started ? 'true' : 'false'}" data-history-locked="${historyLocked ? 'true' : 'false'}" data-planned-start="${esc(milestone.plannedStartDate || '')}" data-planned-finish="${esc(milestone.plannedFinishDate || '')}">
      <div class="plan-node-name"><span class="plan-order">${String(index + 1).padStart(2, '0')}</span><input data-plan-name maxlength="100" value="${esc(milestone.name || '')}" placeholder="输入施工节点名称" required ${fieldLock}></div>
      <label><span class="plan-field-caption">预计工期</span><input data-plan-duration type="number" min="1" max="365" value="${Number(milestone.durationDays || 3)}" aria-label="预计工期（天）" required ${fieldLock}><span>天</span></label>
      <label><span class="plan-field-caption">最低照片数</span><input data-plan-photos type="number" min="0" max="100" value="${Number(milestone.requiredPhotoCount ?? 1)}" aria-label="最低照片数（张）" ${fieldLock}><span>张</span></label>
      <label class="plan-status-field"><span class="plan-field-caption">节点状态</span><select data-plan-status aria-label="节点状态"><option value="pending" ${milestone.rawStatus === 'pending' ? 'selected' : ''}>待开始</option><option value="in_progress" ${milestone.rawStatus === 'in_progress' ? 'selected' : ''}>进行中</option><option value="completed" ${milestone.rawStatus === 'completed' ? 'selected' : ''}>已完成</option><option value="blocked" ${milestone.rawStatus === 'blocked' ? 'selected' : ''}>受阻</option></select></label>
      <label class="plan-schedule-field"><span class="plan-field-caption">计划开始日期</span><input data-plan-start type="date" value="${esc(milestone.plannedStartDate || '')}" aria-label="计划开始日期"><span class="plan-row-dates">待计算</span></label>
      <div class="plan-row-actions"><button type="button" data-plan-move="up" aria-label="上移节点"><img class=xz-icon src=assets/icons/arrow-up.svg alt aria-hidden=true></button><button type="button" data-plan-move="down" aria-label="下移节点"><img class=xz-icon src=assets/icons/arrow-down.svg alt aria-hidden=true></button>${historyLocked ? '<span>已完成 · 历史锁定</span>' : started ? '<span>进行中</span>' : '<button type="button" class="plan-remove" data-plan-remove aria-label="删除节点"><img class=xz-icon src=assets/icons/close.svg alt aria-hidden=true></button>'}</div>
    </div>`;
  }

  function updateConstructionPlanPreview({ cascadeFromIndex = null } = {}) {
    const form = $('#constructionPlanForm');
    const rows = $$('[data-plan-row]', form);
    const startValue = form.elements.startDate.value;
    if (!startValue || !rows.length) {
      $('#constructionPlanSummary').innerHTML = '<b>等待排期</b><span>请设置开工日并保留至少一个节点</span>';
      return;
    }
    let cursor = startValue;
    let totalDays = 0;
    rows.forEach((row, index) => {
      const duration = Math.max(1, Number($('[data-plan-duration]', row).value || 1));
      const historyLocked = false;
      const startInput = $('[data-plan-start]', row);
      const shouldCascade = Number.isInteger(cascadeFromIndex) && index >= cascadeFromIndex;
      const rowStart = shouldCascade ? cursor : (startInput?.value || '').trim() || cursor;
      if (startInput && (shouldCascade || !startInput.value)) startInput.value = rowStart;
      const finish = historyLocked && row.dataset.plannedFinish ? row.dataset.plannedFinish : dateOffset(rowStart, duration - 1);
      $('.plan-order', row).textContent = String(index + 1).padStart(2, '0');
      $('.plan-row-dates', row).textContent = `${formatDate(rowStart)} — ${formatDate(finish)}${historyLocked ? ' · 已锁定' : ''}`;
      $('[data-plan-move="up"]', row).disabled = index === 0;
      $('[data-plan-move="down"]', row).disabled = index === rows.length - 1;
      if (finish >= cursor) cursor = dateOffset(finish, 1);
      totalDays += duration;
    });
    const finish = dateOffset(cursor, -1);
    const workday = window.XjWorkdayCalendar.countWorkdays(startValue, finish);
    const coverageMark = workday.calendarCovered ? '' : '*';
    const coverageLabel = workday.calendarCovered ? '已扣除周末和法定节假日' : '* 含未公布节假日年份，暂只扣周末及已公布节假日';
    $('#constructionPlanSummary').innerHTML = `<b>${rows.length} 个节点 · ${totalDays} 自然日 · <em class="plan-workday-count">${workday.count} 个工作日${coverageMark}</em></b><span>${formatDate(startValue)} 至 ${formatDate(finish)} · ${coverageLabel}</span>`;
  }

  function constructionPlanNodes(form = $('#constructionPlanForm'), includeIds = true) {
    return $$('[data-plan-row]', form).map((row) => ({
      ...(includeIds ? { id: row.dataset.milestoneId || null } : {}),
      name: $('[data-plan-name]', row).value.trim(),
      durationDays: Number($('[data-plan-duration]', row).value || 1),
      requiredPhotoCount: Number($('[data-plan-photos]', row).value || 0),
      plannedStartDate: $('[data-plan-start]', row)?.value || null,
      status: $('[data-plan-status]', row)?.value || null,
    }));
  }

  const PAYMENT_PERCENT_DECIMALS = 4;

  function roundPaymentPercent(value) {
    return Number(Math.max(0, Number(value || 0)).toFixed(PAYMENT_PERCENT_DECIMALS));
  }

  function derivedPaymentPercents(targetAmounts, contractAmount) {
    if (!(contractAmount > 0)) return targetAmounts.map(() => 0);
    const percents = targetAmounts.map((amount) => roundPaymentPercent(Number(amount || 0) * 100 / contractAmount));
    const targetTotal = targetAmounts.reduce((sum, amount) => sum + Number(amount || 0), 0);
    if (percents.length && Math.abs(targetTotal - contractAmount) < .005) {
      const finalIndex = percents.length - 1;
      const allocated = percents.slice(0, finalIndex).reduce((sum, percent) => sum + percent, 0);
      percents[finalIndex] = roundPaymentPercent(100 - allocated);
    }
    return percents;
  }

  function formatPaymentPercent(value) {
    return roundPaymentPercent(value).toFixed(PAYMENT_PERCENT_DECIMALS).replace(/\.?0+$/, '');
  }

  function wizardPaymentRowHtml(payment = {}, index = 0) {
    const paymentGroup = payment.paymentGroup || (/主材/.test(payment.name || '') ? 'main_material' : 'labor_auxiliary');
    return `<div class="wizard-payment-row" data-wizard-payment-row>
      <div class="plan-node-name"><span class="plan-order">${String(index + 1).padStart(2, '0')}</span><input data-wizard-payment-name maxlength="100" value="${esc(payment.name || '')}" placeholder="输入收款节点" required><select class="payment-node-group" data-wizard-payment-group hidden><option value="labor_auxiliary" ${paymentGroup === 'labor_auxiliary' ? 'selected' : ''}>归属：人辅</option><option value="main_material" ${paymentGroup === 'main_material' ? 'selected' : ''}>归属：主材</option></select></div>
      <label data-wizard-value-percent><input data-wizard-payment-percent type="number" min="0" max="100" step="any" value="${roundPaymentPercent(payment.percent || 0)}"><span>%</span></label>
      <label data-wizard-value-amount hidden><span>¥</span><input data-wizard-payment-custom-amount type="number" min="0" step="0.01" value="${Number(payment.amount || 0)}"></label>
      <b data-wizard-payment-amount>${formatMoney(0)}</b>
      <input data-wizard-payment-date type="date" value="${esc(payment.dueDate || '')}" required>
      <div class="payment-plan-row-actions"><button type="button" data-wizard-payment-move="up" aria-label="上移收款节点" title="上移"><img class=xz-icon src=assets/icons/arrow-up.svg alt aria-hidden=true></button><button type="button" data-wizard-payment-move="down" aria-label="下移收款节点" title="下移"><img class=xz-icon src=assets/icons/arrow-down.svg alt aria-hidden=true></button><button type="button" class="plan-remove" data-wizard-payment-remove aria-label="删除收款节点" title="删除"><img class=xz-icon src=assets/icons/close.svg alt aria-hidden=true></button></div>
    </div>`;
  }

  function wizardNodeFinishDates() {
    const startDate = $('#projectWizardStartDate').value;
    if (!startDate) return [];
    let cursor = startDate;
    return $$('[data-plan-row]', $('#projectWizardPlanList')).map((row) => {
      const duration = Math.max(1, Number($('[data-plan-duration]', row).value || 1));
      const finish = dateOffset(cursor, duration - 1);
      cursor = dateOffset(finish, 1);
      return finish;
    });
  }

  function updateProjectWizardPlanPreview({ cascadeFromIndex = null } = {}) {
    const rows = $$('[data-plan-row]', $('#projectWizardPlanList'));
    const startDate = $('#projectWizardStartDate').value;
    let cursor = startDate;
    let totalDays = 0;
    rows.forEach((row, index) => {
      const duration = Math.max(1, Number($('[data-plan-duration]', row).value || 1));
      const startInput = $('[data-plan-start]', row);
      const shouldCascade = Number.isInteger(cascadeFromIndex) && index >= cascadeFromIndex;
      const rowStart = shouldCascade ? cursor : (startInput?.value || '').trim() || cursor;
      if (startInput && rowStart && (shouldCascade || !startInput.value)) startInput.value = rowStart;
      const finish = rowStart ? dateOffset(rowStart, duration - 1) : '';
      $('.plan-order', row).textContent = String(index + 1).padStart(2, '0');
      $('.plan-row-dates', row).textContent = rowStart ? `${formatDate(rowStart)} — ${formatDate(finish)}` : '设置开工日后计算';
      $('[data-plan-move="up"]', row).disabled = index === 0;
      $('[data-plan-move="down"]', row).disabled = index === rows.length - 1;
      if (finish && finish >= cursor) cursor = dateOffset(finish, 1);
      totalDays += duration;
    });
    const finish = cursor ? dateOffset(cursor, -1) : '';
    const workday = finish ? window.XjWorkdayCalendar.countWorkdays(startDate, finish) : { count: 0, calendarCovered: false };
    const coverageMark = workday.calendarCovered ? '' : '*';
    $('#projectWizardPlanSummary').innerHTML = `${rows.length} 个节点 · ${totalDays} 自然日 · <em class="plan-workday-count">${workday.count} 个工作日${coverageMark}</em>${finish ? ` · 预计 ${formatDate(finish)} 完工` : ''}`;
    $('#projectWizardPlanRule').textContent = finish
      ? (workday.calendarCovered ? '工作日已扣除周末和法定节假日；节点仍按自然日连续排期' : '* 含未公布节假日年份，暂只扣周末及已公布节假日')
      : '可调整节点名称、工期和最低照片数';
  }

  function updateProjectWizardPayments(resetDates = false) {
    const contractAmount = Number($('#projectForm').elements.contractAmount.value || 0);
    const depositAmount = Math.min(contractAmount, Number($('#projectForm').elements.depositAmount.value || 0));
    const calculationMode = $('#projectForm').elements.wizardCalculationMode.value || 'percentage';
    const split = calculationMode === 'split';
    const splitPanel = $('#projectWizardPaymentSplitSettings');
    splitPanel.hidden = !split;
    if (split && !Number($('#projectForm').elements.wizardLaborAuxiliaryAmount.value || 0) && !Number($('#projectForm').elements.wizardMainMaterialAmount.value || 0)) {
      $('#projectForm').elements.wizardLaborAuxiliaryAmount.value = contractAmount;
    }
    const groupConfig = {
      overall: { base: contractAmount, mode: calculationMode, deposit: depositAmount, name: '合同' },
      labor_auxiliary: { base: Number($('#projectForm').elements.wizardLaborAuxiliaryAmount.value || 0), mode: $('#projectForm').elements.wizardLaborAuxiliaryMode.value, deposit: depositAmount, name: '人辅' },
      main_material: { base: Number($('#projectForm').elements.wizardMainMaterialAmount.value || 0), mode: $('#projectForm').elements.wizardMainMaterialMode.value, deposit: 0, name: '主材' },
    };
    const finishDates = wizardNodeFinishDates();
    const rows = $$('[data-wizard-payment-row]', $('#projectWizardPaymentList'));
    let percentTotal = 0;
    let amountTotal = 0;
    const groups = rows.map((row) => split ? $('[data-wizard-payment-group]', row).value : 'overall');
    const firstByGroup = Object.fromEntries([...new Set(groups)].map((group) => [group, groups.indexOf(group)]));
    const calculated = rows.map((row, index) => {
      const group = groups[index];
      const config = groupConfig[group];
      const depositApplied = index === firstByGroup[group] ? config.deposit : 0;
      const percentInput = $('[data-wizard-payment-percent]', row);
      const amountInput = $('[data-wizard-payment-custom-amount]', row);
      const dueAmount = config.mode === 'amount'
        ? Math.max(0, Number(amountInput.value || 0))
        : Math.max(0, config.base * Math.max(0, Number(percentInput.value || 0)) / 100 - depositApplied);
      return { group, mode: config.mode, base: config.base, depositApplied, dueAmount, targetAmount: dueAmount + depositApplied };
    });
    const derivedPercents = {};
    Object.keys(groupConfig).forEach((group) => {
      const indices = groups.map((value, index) => value === group ? index : -1).filter((index) => index >= 0);
      if (indices.length && groupConfig[group].mode === 'amount') derivedPercents[group] = derivedPaymentPercents(indices.map((index) => calculated[index].targetAmount), groupConfig[group].base);
    });
    rows.forEach((row, index) => {
      $('.plan-order', row).textContent = String(index + 1).padStart(2, '0');
      $('[data-wizard-payment-move="up"]', row).disabled = index === 0;
      $('[data-wizard-payment-move="down"]', row).disabled = index === rows.length - 1;
      const { group, mode, depositApplied, dueAmount, targetAmount } = calculated[index];
      const percentInput = $('[data-wizard-payment-percent]', row);
      const amountInput = $('[data-wizard-payment-custom-amount]', row);
      const groupIndex = groups.slice(0, index).filter((value) => value === group).length;
      const percent = mode === 'percentage'
        ? roundPaymentPercent(percentInput.value)
        : derivedPercents[group]?.[groupIndex] || 0;
      if (mode === 'amount') percentInput.value = percent;
      else amountInput.value = Number(dueAmount.toFixed(2));
      percentTotal += split && contractAmount ? percent * calculated[index].base / contractAmount : percent;
      amountTotal += dueAmount;
      $('[data-wizard-value-percent]', row).hidden = mode !== 'percentage';
      $('[data-wizard-value-amount]', row).hidden = mode !== 'amount';
      $('[data-wizard-payment-group]', row).hidden = !split;
      $('[data-wizard-payment-amount]', row).innerHTML = `${formatMoney(dueAmount)}<small>${split ? `${groupConfig[group].name} · ` : ''}${depositApplied ? `目标 ${formatMoney(targetAmount)} · 扣定金 ${formatMoney(depositApplied)}` : `节点目标 ${formatMoney(targetAmount)}`}</small>`;
      if (resetDates && !$('[data-wizard-payment-date]', row).value) {
        const milestoneIndex = Number(row.dataset.milestoneIndex ?? Math.min(index * 2, finishDates.length - 1));
        $('[data-wizard-payment-date]', row).value = finishDates[milestoneIndex] || finishDates.at(-1) || $('#projectWizardStartDate').value;
      }
    });
    $('#projectWizardValueLabel').textContent = split ? '组内比例 / 金额' : (calculationMode === 'amount' ? '自定义本期金额' : '合同占比');
    const expectedAmount = Math.max(0, contractAmount - depositAmount);
    const head = $('.wizard-payment-head span');
    if (head && split) {
      const laborRows = calculated.filter((item) => item.group === 'labor_auxiliary');
      const materialRows = calculated.filter((item) => item.group === 'main_material');
      head.textContent = `人辅 ${formatMoney(groupConfig.labor_auxiliary.base)}（${groupConfig.labor_auxiliary.mode === 'percentage' ? '按比例' : '自定义'}）· 主材 ${formatMoney(groupConfig.main_material.base)}（${groupConfig.main_material.mode === 'percentage' ? '按比例' : '自定义'}）· 当前应收合计 ${formatMoney([...laborRows, ...materialRows].reduce((sum, item) => sum + item.dueAmount, 0))}`;
    } else if (head) head.textContent = calculationMode === 'amount'
      ? `合同 ${formatMoney(contractAmount)} · 定金 ${formatMoney(depositAmount)} · 金额合计 ${formatMoney(amountTotal)} / ${formatMoney(expectedAmount)}${Math.abs(amountTotal - expectedAmount) < .005 ? '（完整）' : '（请核对）'}`
      : `${contractAmount > 0 ? `合同 ${formatMoney(contractAmount)} · 定金 ${formatMoney(depositAmount)} · ` : '请先填写合同金额以计算每期金额 · '}当前比例合计 ${percentTotal.toFixed(2).replace(/\.00$/, '')}%${Math.abs(percentTotal - 100) < .001 ? '（完整）' : '（请核对）'}`;
  }

  function inferPaymentMilestoneId(item, index, total) {
    if (item.changeOrderId) return '';
    const milestones = state.projectDetail?.milestones || [];
    if (!milestones.length) return '';
    const paymentKey = String(item.name || '').replace(/合同|工程|收款|款项|尾款|进度款|款/g, '').trim();
    const matched = paymentKey && milestones.find((milestone) => {
      const milestoneKey = String(milestone.name || '').replace(/施工|阶段|完成|交付/g, '').trim();
      return milestone.name.includes(paymentKey) || paymentKey.includes(milestoneKey) || milestoneKey.includes(paymentKey);
    });
    if (matched) return matched.id;
    const position = total <= 1 ? milestones.length - 1 : Math.round(index * (milestones.length - 1) / (total - 1));
    return milestones[Math.max(0, Math.min(position, milestones.length - 1))]?.id || '';
  }

  function paymentMilestoneOptions(selectedId = '') {
    const milestones = state.projectDetail?.milestones || [];
    return '<option value="">不关联节点（手动设置日期）</option>' + milestones.map((milestone) => `<option value="${esc(milestone.id)}" ${milestone.id === selectedId ? 'selected' : ''}>${esc(milestone.name)} · 验收节点</option>`).join('');
  }

  function syncPaymentRowDateFromMilestone(row) {
    const select = $('[data-payment-plan-milestone]', row);
    const input = $('[data-payment-plan-date]', row);
    const note = $('[data-payment-date-note]', row);
    if (!select || !input) return;
    const milestone = (state.projectDetail?.milestones || []).find((item) => item.id === select.value);
    if (milestone?.plannedFinishDate) {
      input.value = milestone.plannedFinishDate;
      input.readOnly = true;
      input.title = `跟随“${milestone.name}”计划验收日期`;
      if (note) note.textContent = `已同步 ${milestone.name} 验收日`;
    } else {
      input.readOnly = false;
      input.title = '';
      if (note) note.textContent = select.disabled ? '增减项收款请单独确认日期' : '未关联节点，可手动设置';
    }
  }

  function paymentPlanEditorRowHtml(item = {}, index = 0) {
    const receiptCount = Number(item.receipts?.length || 0);
    const paymentGroup = item.paymentGroup || (/主材/.test(item.name || '') ? 'main_material' : 'labor_auxiliary');
    const milestoneId = item.milestoneId || '';
    const changeLinked = Boolean(item.changeOrderId);
    const removeDisabled = receiptCount > 0 || changeLinked;
    return `<div class="payment-plan-editor-row" data-payment-plan-row data-payment-id="${esc(item.id || '')}" data-change-order-id="${esc(item.changeOrderId || '')}" data-receipt-count="${receiptCount}">
      <div class="payment-node-name"><span class="plan-order">${String(index + 1).padStart(2, '0')}</span><input data-payment-plan-name maxlength="100" required value="${esc(item.name || '')}" placeholder="例如：水电验收款"><select class="payment-node-group" data-payment-plan-group hidden><option value="labor_auxiliary" ${paymentGroup === 'labor_auxiliary' ? 'selected' : ''}>归属：人辅</option><option value="main_material" ${paymentGroup === 'main_material' ? 'selected' : ''}>归属：主材</option></select><select class="payment-node-milestone" data-payment-plan-milestone ${changeLinked ? 'disabled title="增减项收款不关联施工节点"' : ''}>${paymentMilestoneOptions(milestoneId)}</select></div>
      <label data-payment-value-percent><input data-payment-plan-percent type="number" min="0" max="100" step="any" value="${roundPaymentPercent(item.paymentPercent || 0)}"> %</label>
      <label data-payment-value-amount hidden>¥ <input data-payment-plan-amount type="number" min="0" step="0.01" value="${Number(item.plannedAmount ?? item.amount ?? 0)}"></label>
      <div class="payment-money-cell"><b data-payment-target>${formatMoney(item.targetAmount || 0)}</b><small>合同占比金额</small></div>
      <div class="payment-money-cell"><b data-payment-due>${formatMoney(item.plannedAmount || 0)}</b><small>${Number(item.depositApplied || 0) ? `已扣定金 ${formatMoney(item.depositApplied)}` : '本期计划应收'}</small></div>
      <label class="payment-date-cell"><input data-payment-plan-date type="date" required value="${esc(item.dueDate || localDateValue())}"><small class="payment-date-sync-note" data-payment-date-note></small></label>
      <div class="payment-plan-row-actions"><button type="button" data-payment-plan-move="up" aria-label="上移收款节点" title="上移"><img class=xz-icon src=assets/icons/arrow-up.svg alt aria-hidden=true></button><button type="button" data-payment-plan-move="down" aria-label="下移收款节点" title="下移"><img class=xz-icon src=assets/icons/arrow-down.svg alt aria-hidden=true></button><button class="danger" type="button" data-payment-plan-remove ${removeDisabled ? `disabled title="${changeLinked ? '请在合同增减项中撤销' : '已有到账记录，不能删除'}"` : 'title="删除本期"'}>删除</button></div>
    </div>`;
  }

  function updatePaymentPlanEditor() {
    const contractAmount = Number(state.projectDetail?.business?.adjustedContractAmount ?? state.project?.contractAmount ?? 0);
    const depositAmount = Math.min(contractAmount, Number(state.project?.depositAmount || 0));
    const calculationMode = $('#paymentPlanForm').elements.calculationMode.value || 'percentage';
    const split = calculationMode === 'split';
    const splitPanel = $('#paymentPlanSplitSettings');
    splitPanel.hidden = !split;
    if (split && !Number($('#paymentPlanForm').elements.laborAuxiliaryAmount.value || 0) && !Number($('#paymentPlanForm').elements.mainMaterialAmount.value || 0)) {
      $('#paymentPlanForm').elements.laborAuxiliaryAmount.value = contractAmount;
    }
    const groupConfig = {
      overall: { base: contractAmount, mode: calculationMode, deposit: depositAmount, name: '合同' },
      labor_auxiliary: { base: Number($('#paymentPlanForm').elements.laborAuxiliaryAmount.value || 0), mode: $('#paymentPlanForm').elements.laborAuxiliaryMode.value, deposit: depositAmount, name: '人辅' },
      main_material: { base: Number($('#paymentPlanForm').elements.mainMaterialAmount.value || 0), mode: $('#paymentPlanForm').elements.mainMaterialMode.value, deposit: 0, name: '主材' },
    };
    const rows = $$('[data-payment-plan-row]', $('#paymentPlanList'));
    rows.forEach(syncPaymentRowDateFromMilestone);
    let percentTotal = 0;
    let targetTotal = 0;
    let receivableTotal = 0;
    const groups = rows.map((row) => split ? $('[data-payment-plan-group]', row).value : 'overall');
    const firstByGroup = Object.fromEntries([...new Set(groups)].map((group) => [group, groups.indexOf(group)]));
    const calculated = rows.map((row, index) => {
      const group = groups[index];
      const config = groupConfig[group];
      const depositApplied = index === firstByGroup[group] ? config.deposit : 0;
      const percentInput = $('[data-payment-plan-percent]', row);
      const amountInput = $('[data-payment-plan-amount]', row);
      const due = config.mode === 'amount'
        ? Math.max(0, Number(amountInput.value || 0))
        : Math.max(0, config.base * Math.max(0, Number(percentInput.value || 0)) / 100 - depositApplied);
      return { group, mode: config.mode, base: config.base, depositApplied, due, target: due + depositApplied };
    });
    const derivedPercents = {};
    Object.keys(groupConfig).forEach((group) => {
      const indices = groups.map((value, index) => value === group ? index : -1).filter((index) => index >= 0);
      if (indices.length && groupConfig[group].mode === 'amount') derivedPercents[group] = derivedPaymentPercents(indices.map((index) => calculated[index].target), groupConfig[group].base);
    });
    rows.forEach((row, index) => {
      $('.plan-order', row).textContent = String(index + 1).padStart(2, '0');
      $('[data-payment-plan-move="up"]', row).disabled = index === 0;
      $('[data-payment-plan-move="down"]', row).disabled = index === rows.length - 1;
      const { group, mode, depositApplied, due, target } = calculated[index];
      const percentInput = $('[data-payment-plan-percent]', row);
      const amountInput = $('[data-payment-plan-amount]', row);
      const groupIndex = groups.slice(0, index).filter((value) => value === group).length;
      const percent = mode === 'percentage'
        ? roundPaymentPercent(percentInput.value)
        : derivedPercents[group]?.[groupIndex] || 0;
      if (mode === 'amount') percentInput.value = percent;
      else amountInput.value = Number(due.toFixed(2));
      percentTotal += split && contractAmount ? percent * calculated[index].base / contractAmount : percent;
      targetTotal += target;
      receivableTotal += due;
      $('[data-payment-target]', row).textContent = formatMoney(target);
      $('[data-payment-due]', row).textContent = formatMoney(due);
      $('[data-payment-value-percent]', row).hidden = mode !== 'percentage';
      $('[data-payment-value-amount]', row).hidden = mode !== 'amount';
      $('[data-payment-plan-group]', row).hidden = !split;
      $('.payment-money-cell small', row).textContent = `${split ? `${groupConfig[group].name}组内` : '折算合同'}占比 ${formatPaymentPercent(percent)}%`;
      $$('[data-payment-due]', row)[0]?.parentElement?.querySelector('small') && ($$('[data-payment-due]', row)[0].parentElement.querySelector('small').textContent = depositApplied ? `已扣定金 ${formatMoney(depositApplied)}` : '本期计划应收');
    });
    const expectedReceivable = Math.max(0, contractAmount - depositAmount);
    const splitBaseTotal = groupConfig.labor_auxiliary.base + groupConfig.main_material.base;
    const groupComplete = split && ['labor_auxiliary', 'main_material'].every((group) => {
      const items = calculated.filter((item) => item.group === group);
      if (!items.length && groupConfig[group].base > 0) return false;
      return groupConfig[group].mode === 'amount'
        ? Math.abs(items.reduce((sum, item) => sum + item.due, 0) - Math.max(0, groupConfig[group].base - groupConfig[group].deposit)) < .005
        : Math.abs(items.reduce((sum, item) => sum + roundPaymentPercent($('[data-payment-plan-percent]', rows[calculated.indexOf(item)]).value), 0) - 100) < .001;
    });
    const complete = split ? Math.abs(splitBaseTotal - contractAmount) < .005 && groupComplete : (calculationMode === 'amount' ? Math.abs(receivableTotal - expectedReceivable) < .005 : Math.abs(percentTotal - 100) < .001);
    $('#paymentPlanValueLabel').textContent = split ? '组内比例 / 金额' : (calculationMode === 'amount' ? '自定义本期金额' : '合同占比');
    $('#paymentPlanFormula').innerHTML = split
      ? `<b>人辅 / 主材分开：</b>两类合同金额合计须等于合同总额；每一类可独立选择按比例或自定义金额。定金优先抵扣人辅首期。<br>合同 ${formatMoney(contractAmount)} · 人辅 ${formatMoney(groupConfig.labor_auxiliary.base)} · 主材 ${formatMoney(groupConfig.main_material.base)} · 后续应收 ${formatMoney(receivableTotal)}`
      : calculationMode === 'amount'
      ? `<b>自定义金额：</b>直接填写每期实际应收；合计需等于合同总价减已收定金。首期定金只用于还原节点目标，不会重复计收。<br>合同总价 ${formatMoney(contractAmount)} · 已收定金 ${formatMoney(depositAmount)} · 应分配 ${formatMoney(expectedReceivable)} · 当前 ${formatMoney(receivableTotal)}`
      : `<b>按百分比：</b>节点目标金额 = 合同总价 × 节点比例；首期应收 = 首期目标金额 − 已收定金。<br>合同总价 ${formatMoney(contractAmount)} · 已收定金 ${formatMoney(depositAmount)} · 计划节点目标 ${formatMoney(targetTotal)} · 后续计划应收 ${formatMoney(receivableTotal)}`;
    $('#paymentPlanSummary').innerHTML = split
      ? `<b class="${complete ? '' : 'risk-text'}">分组计划${complete ? '完整' : '需调整'}</b><small>人辅与主材分别核对，保存后在收款计划中标明归属。</small>`
      : calculationMode === 'amount'
      ? `<b class="${complete ? '' : 'risk-text'}">金额合计 ${formatMoney(receivableTotal)} / ${formatMoney(expectedReceivable)}${complete ? '（完整）' : '（需调整）'}</b><small>保存后每期金额保持不变，不随合同金额自动重算。</small>`
      : `<b class="${complete ? '' : 'risk-text'}">比例合计 ${percentTotal.toFixed(2).replace(/\.00$/, '')}%${complete ? '（完整）' : '（需调整为 100%）'}</b><small>合同总价变化时，节点金额会按比例自动重算。</small>`;
  }

  function recalculateProjectWizardPaymentDates() {
    $$('[data-wizard-payment-date]', $('#projectWizardPaymentList')).forEach((input) => { input.value = ''; });
    updateProjectWizardPayments(true);
  }

  function openPaymentPlanDialog() {
    const payments = state.projectDetail?.business?.payments || [];
    const defaults = payments.length ? payments : defaultWizardPayments.map(([name, paymentPercent], index) => ({ name, paymentPercent, dueDate: dateOffset(localDateValue(), index * 30) }));
    const linkedDefaults = defaults.map((item, index) => ({ ...item, milestoneId: item.milestoneId || inferPaymentMilestoneId(item, index, defaults.length) }));
    $('#paymentPlanList').innerHTML = linkedDefaults.map((item, index) => paymentPlanEditorRowHtml(item, index)).join('');
    const calculationMode = state.projectDetail?.business?.paymentCalculationMode || 'percentage';
    const modeInput = $(`#paymentPlanForm input[name="calculationMode"][value="${calculationMode}"]`);
    if (modeInput) modeInput.checked = true;
    const groups = state.projectDetail?.business?.paymentGroups || [];
    const laborGroup = groups.find((item) => item.key === 'labor_auxiliary');
    const materialGroup = groups.find((item) => item.key === 'main_material');
    $('#paymentPlanForm').elements.laborAuxiliaryAmount.value = laborGroup?.baseAmount ?? (calculationMode === 'split' ? 0 : Number(state.projectDetail?.business?.adjustedContractAmount ?? state.project?.contractAmount ?? 0));
    $('#paymentPlanForm').elements.mainMaterialAmount.value = materialGroup?.baseAmount ?? 0;
    $('#paymentPlanForm').elements.laborAuxiliaryMode.value = laborGroup?.calculationMode || 'percentage';
    $('#paymentPlanForm').elements.mainMaterialMode.value = materialGroup?.calculationMode || 'percentage';
    updatePaymentPlanEditor();
    $('#paymentPlanDialog').showModal();
  }

  function setProjectWizardStep(step) {
    projectWizardStep = Math.max(1, Math.min(3, Number(step || 1)));
    $$('[data-project-wizard-step]').forEach((button) => button.classList.toggle('active', Number(button.dataset.projectWizardStep) === projectWizardStep));
    $$('[data-project-wizard-panel]').forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.projectWizardPanel) === projectWizardStep));
    $('#projectWizardPrev').classList.toggle('hidden', projectWizardStep === 1);
    $('#projectWizardNext').classList.toggle('hidden', projectWizardStep === 3);
    $('#projectWizardSubmit').classList.toggle('hidden', projectWizardStep !== 3);
    $('#projectWizardNext').textContent = projectWizardStep === 1 ? '下一步：施工计划' : '下一步：收款计划';
    if (projectWizardStep === 2) updateProjectWizardPlanPreview();
    if (projectWizardStep === 3) updateProjectWizardPayments(true);
  }

  function clearProjectWizardErrors(field = null) {
    const form = $('#projectForm');
    const labels = field ? [field.closest('label')].filter(Boolean) : $$('label.has-error', form);
    labels.forEach((label) => {
      label.classList.remove('has-error');
      $('.field-error', label)?.remove();
      const control = $('input, select, textarea', label);
      if (control) control.removeAttribute('aria-invalid');
    });
    if (!field) {
      const summary = $('#projectWizardErrorSummary');
      summary.textContent = '';
      summary.classList.add('hidden');
    }
  }

  function showProjectWizardFieldError(field, message) {
    clearProjectWizardErrors();
    const label = field.closest('label');
    if (label) {
      label.classList.add('has-error');
      field.setAttribute('aria-invalid', 'true');
      label.insertAdjacentHTML('beforeend', `<small class="field-error">${esc(message)}</small>`);
    }
    const summary = $('#projectWizardErrorSummary');
    summary.textContent = `请先处理：${message}`;
    summary.classList.remove('hidden');
    field.focus();
    field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function resetProjectWizard() {
    const form = $('#projectForm');
    form.reset();
    clearProjectWizardErrors();
    renderMembers();
    $('#projectWizardStartDate').value = localDateValue();
    $('#projectWizardPlanList').innerHTML = defaultWizardNodes.map(([name, durationDays, requiredPhotoCount], index) => planRowHtml({ name, durationDays, requiredPhotoCount }, index)).join('');
    $('#projectWizardPaymentList').innerHTML = defaultWizardPayments.map(([name, percent, milestoneIndex], index) => {
      const html = wizardPaymentRowHtml({ name, percent }, index);
      return html.replace('data-wizard-payment-row', `data-wizard-payment-row data-milestone-index="${milestoneIndex}"`);
    }).join('');
    renderProjectWizardPresets();
    $('#projectWizardPresetHint').textContent = '当前使用系统标准施工流程';
    updateProjectWizardPlanPreview();
    updateProjectWizardPayments(true);
    setProjectWizardStep(1);
  }

  function openProjectEditDialog(focusSiteManager = false) {
    if (!state.project) return;
    const form = $('#projectEditForm');
    ['name', 'customerName', 'area', 'location', 'managerMemberId', 'designerMemberId', 'siteManagerMemberId', 'costBudget', 'contractAmount', 'contractNo', 'signedMonth', 'depositAmount'].forEach((name) => {
      form.elements[name].value = state.project[name] ?? '';
    });
    $('#projectEditDialog').showModal();
    if (focusSiteManager) {
      requestAnimationFrame(() => {
        form.elements.siteManagerMemberId.focus();
        form.elements.siteManagerMemberId.scrollIntoView({ block: 'center' });
      });
    }
  }

  function wizardStepIsValid(step) {
    if (step === 1) {
      const invalid = $$('input, select', $('[data-project-wizard-panel="1"]')).find((field) => !field.checkValidity());
      if (invalid) {
        const messages = {
          name: '请填写项目名称后再继续。',
          managerMemberId: '请选择项目总负责人后再继续。',
        };
        showProjectWizardFieldError(invalid, messages[invalid.name] || invalid.validationMessage || '请检查此项内容。');
        return false;
      }
      clearProjectWizardErrors();
      return true;
    }
    if (step === 2) {
      if (!$('#projectWizardStartDate').value) { showToast('请先选择计划开工日期', true); return false; }
      const nodes = constructionPlanNodes($('#projectWizardPlanList'), false);
      if (!nodes.length || nodes.some((node) => !node.name || node.durationDays < 1)) { showToast('请至少保留一个完整施工节点', true); return false; }
      return true;
    }
    const payments = $$('[data-wizard-payment-row]', $('#projectWizardPaymentList'));
    const calculationMode = $('#projectForm').elements.wizardCalculationMode.value || 'percentage';
    const percentTotal = payments.reduce((sum, row) => sum + Number($('[data-wizard-payment-percent]', row).value || 0), 0);
    const amountTotal = payments.reduce((sum, row) => sum + Number($('[data-wizard-payment-custom-amount]', row).value || 0), 0);
    const contractAmount = Number($('#projectForm').elements.contractAmount.value || 0);
    const depositAmount = Math.min(contractAmount, Number($('#projectForm').elements.depositAmount.value || 0));
    if (payments.some((row) => !$('[data-wizard-payment-name]', row).value.trim() || !$('[data-wizard-payment-date]', row).value)) { showToast('请完整填写每个收款节点', true); return false; }
    if (payments.length && calculationMode === 'percentage' && Math.abs(percentTotal - 100) > .001) { showToast('收款计划比例合计需为 100%', true); return false; }
    if (payments.length && calculationMode === 'amount' && Math.abs(amountTotal - Math.max(0, contractAmount - depositAmount)) > .005) { showToast(`自定义金额合计应为 ${formatMoney(Math.max(0, contractAmount - depositAmount))}`, true); return false; }
    if (payments.length && calculationMode === 'split') {
      const laborBase = Number($('#projectForm').elements.wizardLaborAuxiliaryAmount.value || 0);
      const materialBase = Number($('#projectForm').elements.wizardMainMaterialAmount.value || 0);
      if (Math.abs(laborBase + materialBase - contractAmount) > .005) { showToast('人辅金额与主材金额合计必须等于合同总额', true); return false; }
      if (depositAmount > laborBase) { showToast('已收定金不能大于人辅合同金额', true); return false; }
      const configs = {
        labor_auxiliary: { name: '人辅', base: laborBase, deposit: depositAmount, mode: $('#projectForm').elements.wizardLaborAuxiliaryMode.value },
        main_material: { name: '主材', base: materialBase, deposit: 0, mode: $('#projectForm').elements.wizardMainMaterialMode.value },
      };
      for (const [group, config] of Object.entries(configs)) {
        const groupRows = payments.filter((row) => $('[data-wizard-payment-group]', row).value === group);
        if (config.base > 0 && !groupRows.length) { showToast(`请至少添加一个${config.name}收款节点`, true); return false; }
        const total = groupRows.reduce((sum, row) => sum + Number($(config.mode === 'percentage' ? '[data-wizard-payment-percent]' : '[data-wizard-payment-custom-amount]', row).value || 0), 0);
        const expected = config.mode === 'percentage' ? 100 : Math.max(0, config.base - config.deposit);
        if (Math.abs(total - expected) > (config.mode === 'percentage' ? .001 : .005)) { showToast(`${config.name}${config.mode === 'percentage' ? '比例合计需为 100%' : `自定义金额合计应为 ${formatMoney(expected)}`}`, true); return false; }
      }
    }
    return true;
  }

  function renderConstructionPlanPresets(selectedId = '') {
    const select = $('#constructionPlanPresetSelect');
    if (!select) return;
    select.innerHTML = `<option value="">${state.constructionPlanPresets.length ? '选择企业预设' : '暂无企业预设'}</option>` + state.constructionPlanPresets
      .map((preset) => `<option value="${esc(preset.id)}">${esc(preset.name)} · ${preset.nodes?.length || 0} 个节点</option>`).join('');
    if (selectedId) select.value = selectedId;
  }

  function renderProjectWizardPresets(selectedId = '') {
    const select = $('#projectWizardPresetSelect');
    if (!select) return;
    select.innerHTML = '<option value="">系统标准施工流程 · 8 个节点</option>' + state.constructionPlanPresets
      .map((preset) => `<option value="${esc(preset.id)}">企业预设 · ${esc(preset.name)} · ${preset.nodes?.length || 0} 个节点</option>`).join('');
    select.value = selectedId;
  }

  function applyProjectWizardPreset(preset = null) {
    const nodes = preset?.nodes?.length
      ? preset.nodes
      : defaultWizardNodes.map(([name, durationDays, requiredPhotoCount]) => ({ name, durationDays, requiredPhotoCount }));
    $('#projectWizardPlanList').innerHTML = nodes.map((item, index) => planRowHtml(item, index)).join('');
    updateProjectWizardPlanPreview();
    recalculateProjectWizardPaymentDates();
    const label = preset?.name || '系统标准施工流程';
    $('#projectWizardPresetHint').textContent = `当前使用：${label} · ${nodes.length} 个节点`;
  }

  async function loadConstructionPlanPresets() {
    const result = await api(`/api/organizations/${state.organization.id}/construction-plan-presets`);
    state.constructionPlanPresets = result.presets || [];
    renderConstructionPlanPresets();
    renderProjectWizardPresets($('#projectWizardPresetSelect')?.value || '');
  }

  async function openConstructionPlanDialog() {
    const milestones = state.projectDetail?.milestones || [];
    const form = $('#constructionPlanForm');
    form.elements.startDate.value = state.project.startDate || localDateValue();
    form.elements.startDate.disabled = false;
    form.elements.startDate.title = '计划可随时调整，节点状态由项目负责人手动维护';
    $('#constructionPlanList').innerHTML = milestones.map((item, index) => planRowHtml(item, index)).join('');
    updateConstructionPlanPreview();
    $('#constructionPlanDialog').showModal();
    try {
      await loadConstructionPlanPresets();
    } catch (error) {
      showToast(`无法读取企业预设：${error.message}。请检查网络后重试。`, true);
    }
  }

  function openAcceptanceMediaDialog(milestone) {
    const form = $('#acceptanceMediaForm');
    form.reset();
    clearUploadPreview(form);
    form.elements.milestoneId.value = milestone.id;
    form.elements.occurredAt.value = datetimeLocalValue();
    $('#acceptanceMediaMilestoneName').textContent = milestone.name;
    $('#acceptanceMediaDialog').showModal();
  }

  function openPaymentReceiptDialog(item) {
    const form = $('#paymentReceiptForm');
    form.reset();
    clearUploadPreview(form);
    form.elements.paymentPlanId.value = item.id;
    form.elements.amount.value = Number(item.outstandingAmount || 0) || '';
    form.elements.amount.max = Number(item.outstandingAmount || 0);
    form.elements.receivedDate.value = localDateValue();
    $('#paymentReceiptHint').textContent = `${item.name} · 计划 ${formatMoney(item.plannedAmount)} · 本次最多可登记 ${formatMoney(item.outstandingAmount)}`;
    $('#paymentReceiptDialog').showModal();
  }

  function openNodeIssueDialog(milestone = null) {
    pendingChecklistIssueId = '';
    const form = $('#issueForm');
    form.reset();
    clearUploadPreview(form);
    delete form.dataset.issueId;
    form.elements.issueId.value = '';
    form.elements.occurredAt.value = datetimeLocalValue();
    $$('[data-issue-create-only]', form).forEach((element) => { element.hidden = false; });
    form.elements.milestoneId.value = milestone?.id || '';
    const availableLogs = milestone
      ? (state.projectDetail.siteLogs || []).filter((log) => logBelongsToMilestone(milestone, log))
      : (state.projectDetail.siteLogs || []);
    $('#issueLogSelect').innerHTML = '<option value="">不关联现场日志</option>'
      + availableLogs.map((log) => `<option value="${esc(log.id)}">${formatDate(log.createdAt)} · ${esc(log.stage)}</option>`).join('');
    form.elements.siteLogId.value = '';
    if (state.project.managerMemberId && form.elements.ownerMemberId.querySelector(`option[value="${CSS.escape(state.project.managerMemberId)}"]`)) {
      form.elements.ownerMemberId.value = state.project.managerMemberId;
    }
    $('#issueDialog .dialog-head h2').textContent = milestone ? `${milestone.name} · 发起问题整改` : '发起问题整改';
    $('#issueDialog .dialog-head p').textContent = milestone
      ? '问题会直接归入当前施工节点；关联日志仅用于标记来源，不会带入日志照片。'
      : '指定负责人后，整改人需上传整改后照片并提交复核。';
    $('#issueForm button[type="submit"]').textContent = '创建整改';
    $('#issueDialog').showModal();
  }

  function openIssueEditDialog(issue) {
    if (!issue) return;
    pendingChecklistIssueId = '';
    const form = $('#issueForm');
    form.reset();
    clearUploadPreview(form);
    form.dataset.issueId = issue.id;
    form.elements.issueId.value = issue.id;
    $$('[data-issue-create-only]', form).forEach((element) => { element.hidden = true; });
    form.elements.milestoneId.value = issue.milestoneId || '';
    form.elements.title.value = issue.title || '';
    form.elements.description.value = issue.description || '';
    form.elements.priority.value = issue.priority || 'normal';
    form.elements.ownerMemberId.value = issue.ownerMemberId || '';
    const availableLogs = state.projectDetail.siteLogs || [];
    $('#issueLogSelect').innerHTML = '<option value="">不关联现场日志</option>'
      + availableLogs.map((log) => `<option value="${esc(log.id)}">${formatDate(log.createdAt)} · ${esc(log.stage)}</option>`).join('');
    form.elements.siteLogId.value = issue.siteLogId || '';
    form.elements.dueAt.value = issue.dueAt ? datetimeLocalValue(issue.dueAt) : '';
    $('#issueDialog .dialog-head h2').textContent = '编辑整改问题';
    $('#issueDialog .dialog-head p').textContent = '已完成、已关闭或历史整改均可修改；修改会保留原状态和操作记录。';
    $('#issueForm button[type="submit"]').textContent = '保存整改修改';
    $('#issueDialog').showModal();
  }

  function checklistTemplateItemHtml(item = {}, index = 0) {
    return `<div class="checklist-template-item" data-template-item>
      <span data-template-item-order>${index + 1}</span>
      <input type="text" maxlength="160" required data-template-item-title value="${esc(item.title || '')}" placeholder="必检项名称">
      <input type="text" maxlength="500" data-template-item-note value="${esc(item.note || '')}" placeholder="检查标准或说明（可选）">
      <div class="checklist-template-item-actions">
        <div class="checklist-template-order-actions" role="group" aria-label="调整必检项顺序"><button type="button" class="ghost" data-template-item-move="top" title="移到本阶段最前面">置顶</button><button type="button" class="ghost" data-template-item-move="up" title="向上移动一项">↑ 上移</button><button type="button" class="ghost" data-template-item-move="down" title="向下移动一项">↓ 下移</button></div>
        <div class="checklist-template-item-meta-actions"><label title="勾选后，节点完成前必须通过此项"><input type="checkbox" data-template-item-required ${item.required === false ? '' : 'checked'}><span>节点必检</span></label><button type="button" class="ghost danger-action" data-template-item-remove>删除</button></div>
      </div>
    </div>`;
  }

  function checklistTemplateStageHtml(stage = {}, index = 0) {
    const items = stage.items?.length ? stage.items : [{ title: '', note: '', required: true }];
    return `<section class="checklist-template-stage" data-template-stage>
      <div class="checklist-template-stage-head"><span data-template-stage-order>${String(index + 1).padStart(2, '0')}</span><input type="text" maxlength="100" required data-template-stage-name value="${esc(stage.milestoneName || '')}" placeholder="施工阶段，例如：水电验收"><button type="button" class="secondary" data-template-stage-add-item>添加必检项</button><button type="button" class="ghost danger-action" data-template-stage-remove>删除阶段</button></div>
      <div class="checklist-template-items">${items.map((item, itemIndex) => checklistTemplateItemHtml(item, itemIndex)).join('')}</div>
    </section>`;
  }

  function reindexChecklistTemplate() {
    $$('[data-template-stage]', $('#checklistTemplateStages')).forEach((stage, stageIndex) => {
      $('[data-template-stage-order]', stage).textContent = String(stageIndex + 1).padStart(2, '0');
      const items = $$('[data-template-item]', stage);
      items.forEach((item, itemIndex) => {
        $('[data-template-item-order]', item).textContent = itemIndex + 1;
        const topButton = $('[data-template-item-move="top"]', item);
        const upButton = $('[data-template-item-move="up"]', item);
        const downButton = $('[data-template-item-move="down"]', item);
        if (topButton) topButton.disabled = itemIndex === 0;
        if (upButton) upButton.disabled = itemIndex === 0;
        if (downButton) downButton.disabled = itemIndex === items.length - 1;
      });
    });
  }

  function renderChecklistTemplate(template) {
    $('#checklistTemplateForm').elements.name.value = template?.name || '企业施工必检项模板';
    const stages = template?.stages || [];
    $('#checklistTemplateStages').innerHTML = stages.length
      ? stages.map((stage, index) => checklistTemplateStageHtml(stage, index)).join('')
      : '<div class="checklist-template-empty">还没有阶段，请先添加施工阶段和必检项。</div>';
  }

  function collectChecklistTemplate() {
    return $$('[data-template-stage]', $('#checklistTemplateStages')).map((stage) => ({
      milestoneName: $('[data-template-stage-name]', stage).value.trim(),
      items: $$('[data-template-item]', stage).map((item) => ({
        title: $('[data-template-item-title]', item).value.trim(),
        note: $('[data-template-item-note]', item).value.trim(),
        required: $('[data-template-item-required]', item).checked,
      })),
    }));
  }

  async function openChecklistTemplateDialog() {
    try {
      const result = await api(`/api/organizations/${state.organization.id}/checklist-template`);
      state.checklistTemplate = result.template;
      renderChecklistTemplate(result.template);
      $('#checklistTemplateDialog').showModal();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function openChecklistImportDialog(milestone) {
    if (!milestone) return;
    try {
      const result = await api(`/api/organizations/${state.organization.id}/checklist-template`);
      state.checklistTemplate = result.template;
      const stages = result.template?.stages || [];
      if (!stages.length) return showToast('企业模板还没有可导入的施工阶段', true);
      const form = $('#checklistImportForm');
      form.elements.milestoneId.value = milestone.id;
      $('#checklistImportTarget').value = milestone.name;
      $('#checklistImportStage').innerHTML = stages.map((stage) => `<option value="${esc(stage.milestoneName)}">${esc(stage.milestoneName)} · ${stage.items?.length || 0} 项</option>`).join('');
      const matched = stages.find((stage) => stage.milestoneName === milestone.name || stage.milestoneName === milestone.stage);
      if (matched) form.elements.milestoneName.value = matched.milestoneName;
      $('#checklistImportDialog').showModal();
    } catch (error) { showToast(error.message, true); }
  }

  function openChecklistItemDialog(milestone, item = null) {
    if (!milestone) return;
    const form = $('#checklistItemForm');
    form.reset();
    form.elements.itemId.value = item?.id || '';
    form.elements.milestoneId.value = milestone.id;
    form.elements.title.value = item?.title || '';
    form.elements.note.value = item?.note || '';
    form.elements.required.checked = item?.required !== false;
    $('#checklistItemMilestoneName').textContent = milestone.name;
    $('#checklistItemDialog .dialog-head h2').textContent = item ? '编辑节点必检项' : '新增节点必检项';
    $('#checklistItemDialog').showModal();
  }

  document.addEventListener('click', async (event) => {
    $$('.project-more-menu[open],.timeline-tools-menu[open]').forEach((menu) => {
      if (!menu.contains(event.target) || event.target.closest('button')) menu.open = false;
    });
    const dragHandle = event.target.closest('[data-node-drag]');
    if (dragHandle) {
      event.preventDefault();
      return;
    }
    const dialogClose = event.target.closest('[data-dialog-close]');
    if (dialogClose) {
      const dialog = dialogClose.closest('dialog');
      if (dialog?.open) dialog.close('cancel');
      return;
    }
    if (event.target.closest('[data-notice-dialog]')) {
      renderNoticeDialog();
      $('#noticeDialog').showModal();
      return;
    }
    if (event.target.closest('[data-notice-all]')) {
      $('#noticeDialog').close();
      showView('tasks', 'tasks');
      return;
    }
    const photoPreview = event.target.closest('[data-photo-preview]');
    if (photoPreview) {
      $('#photoPreviewImage').src = photoPreview.dataset.photoUrl;
      $('#photoPreviewCaption').textContent = photoPreview.dataset.photoCaption || '企业现场照片';
      $('#photoPreviewDialog').showModal();
      return;
    }
    const nav = event.target.closest('[data-view]');
    if (nav) {
      const navKey = nav.dataset.navKey || nav.dataset.view;
      if (nav.dataset.view === 'projects') showProjectDirectory(nav.dataset.projectIntent || 'overview', navKey);
      else {
        showView(nav.dataset.view, navKey);
        if (['photos', 'trash'].includes(nav.dataset.view)) {
          refreshMediaCollections().catch((error) => showToast(`照片读取失败，请点击刷新重试。${error.message}`, true));
        }
        if (nav.dataset.view === 'workforce') {
          loadWorkforceData().catch((error) => showToast(error.message, true));
        }
      }
    }
    const target = event.target.closest('[data-view-target]');
    if (target) {
      if (target.dataset.viewTarget === 'projects') showProjectDirectory('overview', 'projects');
      else {
        showView(target.dataset.viewTarget);
        if (['photos', 'trash'].includes(target.dataset.viewTarget)) refreshMediaCollections().catch((error) => showToast(error.message, true));
      }
    }
    const logRestore = event.target.closest('[data-log-restore]');
    if (logRestore) {
      if (!confirm('恢复这条日志及照片？恢复后仅企业内部可见，不会自动重新发布给客户。')) return;
      setBusy(logRestore, true);
      try {
        await api(`/api/organizations/${state.organization.id}/site-logs/${logRestore.dataset.logRestore}/restore`, { method: 'POST', body: '{}' });
        showToast('日志和照片已恢复为内部资料');
        await refreshMediaCollections();
      } catch (error) { showToast(error.message, true); }
      finally { setBusy(logRestore, false); }
      return;
    }
    const archivePhoto = event.target.closest('[data-unlinked-archive]');
    if (archivePhoto) {
      const item = (state.unlinkedMedia?.items || []).find((media) => media.id === archivePhoto.dataset.unlinkedArchive);
      if (!item) return;
      setBusy(archivePhoto, true);
      try {
        const detail = await api(`/api/organizations/${state.organization.id}/projects/${item.projectId}`);
        const form = $('#unlinkedArchiveForm');
        form.reset();
        form.elements.mediaId.value = item.id;
        form.dataset.archiveProjectId = item.projectId;
        $('#unlinkedArchiveMilestone').innerHTML = '<option value="">暂不关联节点</option>' + (detail.milestones || []).map((node) => `<option value="${esc(node.id)}">${esc(node.name)}</option>`).join('');
        $('#unlinkedArchiveDialog').showModal();
      } catch (error) { showToast(error.message, true); }
      finally { setBusy(archivePhoto, false); }
      return;
    }
    const projectDelete = event.target.closest('[data-project-delete]');
    if (projectDelete) {
      event.preventDefault();
      event.stopPropagation();
      const project = (state.archivedProjects || []).find((item) => item.id === projectDelete.dataset.projectDelete);
      if (!project || !confirm(`永久删除“${project.name}”？该操作会删除项目的施工记录、照片、整改、验收和客户同步数据，无法恢复。`)) return;
      setBusy(projectDelete, true);
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${project.id}`, { method: 'DELETE' });
        showToast('项目已永久删除');
        await loadOrganization(state.organization.id);
        showProjectDirectory(state.projectIntent, directoryConfig[state.projectIntent]?.nav);
      } catch (error) {
        showToast(error.message, true);
        setBusy(projectDelete, false);
      }
      return;
    }
    const clientCenterOpen = event.target.closest('[data-client-center-open]');
    if (clientCenterOpen) {
      event.preventDefault();
      event.stopPropagation();
      openProject(clientCenterOpen.dataset.projectId, 'client');
      return;
    }
    const projectClient = event.target.closest('[data-project-client]');
    if (projectClient) {
      selectProjectWorkspaceSection('client');
      $('#project-tab-client')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const projectOrder = event.target.closest('[data-project-order]');
    if (projectOrder) {
      event.preventDefault();
      event.stopPropagation();
      const projects = [...(state.dashboard?.projects || [])];
      const index = projects.findIndex((item) => item.id === projectOrder.dataset.projectOrderId);
      const target = index + (projectOrder.dataset.projectOrder === 'up' ? -1 : 1);
      if (index < 0 || target < 0 || target >= projects.length) return;
      [projects[index], projects[target]] = [projects[target], projects[index]];
      setBusy(projectOrder, true, '保存中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/order`, { method: 'PUT', body: JSON.stringify({ projectIds: projects.map((item) => item.id) }) });
        await loadOrganization(state.organization.id);
        showProjectDirectory('overview', 'projects');
        showToast('项目顺序已保存');
      } catch (error) {
        showToast(error.message, true);
        setBusy(projectOrder, false);
      }
      return;
    }
    const assignSiteManager = event.target.closest('[data-assign-site-manager]');
    if (assignSiteManager) {
      event.preventDefault();
      event.stopPropagation();
      await openProject(assignSiteManager.dataset.assignSiteManager, 'overview');
      if (state.project?.id === assignSiteManager.dataset.assignSiteManager) openProjectEditDialog(true);
      return;
    }
    const card = event.target.closest('[data-project-id]');
    if (card) {
      if (card.closest('#noticeDialog') && $('#noticeDialog').open) $('#noticeDialog').close();
      openProject(card.dataset.projectId, card.dataset.projectTabTarget || state.projectIntent || 'overview', { focusTargetId: card.dataset.projectFocusId || '' });
    }
    const workerEdit = event.target.closest('[data-worker-edit]');
    if (workerEdit) {
      const worker = (state.workforce?.workers || []).find((item) => item.id === workerEdit.dataset.workerEdit);
      if (worker) openWorkerDialog(worker);
      return;
    }
    const uploadRemove = event.target.closest('[data-upload-remove]');
    if (uploadRemove) {
      const form = uploadRemove.closest('form');
      const input = $('[data-upload-files]', form);
      const files = Array.from(input?.files || []);
      files.splice(Number(uploadRemove.dataset.uploadRemove), 1);
      const transfer = new DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      renderUploadPreview(input);
      return;
    }
    const mediaTrash = event.target.closest('[data-media-trash]');
    if (mediaTrash) {
      if (!confirm('删除后图片会移入回收站，并从现场记录、整改记录和客户可见内容中隐藏。确认继续？')) return;
      setBusy(mediaTrash, true, '…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${mediaTrash.dataset.mediaProject}/media/${mediaTrash.dataset.mediaTrash}`, { method: 'DELETE' });
        await refreshMediaCollections();
        if (event.target.closest('#view-project')) await refreshProject('overview');
        showToast('图片已移入回收站，可随时恢复');
      } catch (error) {
        showToast(error.message, true);
        setBusy(mediaTrash, false);
      }
      return;
    }
    const mediaRestore = event.target.closest('[data-media-restore]');
    if (mediaRestore) {
      setBusy(mediaRestore, true, '恢复中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${mediaRestore.dataset.mediaProject}/media/${mediaRestore.dataset.mediaRestore}/restore`, { method: 'POST' });
        await refreshMediaCollections();
        showToast('图片已恢复到原来的项目记录');
      } catch (error) {
        showToast(error.message, true);
        setBusy(mediaRestore, false);
      }
      return;
    }
    const constructionPlan = event.target.closest('[data-construction-plan]');
    if (constructionPlan) {
      await openConstructionPlanDialog();
      return;
    }
    const paymentPlan = event.target.closest('[data-payment-plan]');
    if (paymentPlan) {
      openPaymentPlanDialog();
      return;
    }
    const paymentPlanImage = event.target.closest('[data-payment-plan-image]');
    if (paymentPlanImage) {
      try { await openPaymentPlanImage(); } catch (error) { showToast(error.message, true); }
      return;
    }
    const paymentPlanAdd = event.target.closest('[data-payment-plan-add]');
    if (paymentPlanAdd) {
      const list = $('#paymentPlanList');
      list.insertAdjacentHTML('beforeend', paymentPlanEditorRowHtml({}, list.children.length));
      updatePaymentPlanEditor();
      return;
    }
    const paymentPlanRemove = event.target.closest('[data-payment-plan-remove]');
    if (paymentPlanRemove) {
      if (paymentPlanRemove.disabled) return showToast(paymentPlanRemove.closest('[data-change-order-id]')?.dataset.changeOrderId ? '该节点由增减项自动生成，请在“合同增减项”中撤销，合同额和收款金额会同步回退' : '该节点已有到账记录，不能删除，只能调整名称、比例和日期', true);
      if ($$('[data-payment-plan-row]', $('#paymentPlanList')).length <= 1) return showToast('至少保留一个收款节点', true);
      paymentPlanRemove.closest('[data-payment-plan-row]').remove();
      updatePaymentPlanEditor();
      return;
    }
    const constructionScheduleImage = event.target.closest('[data-construction-schedule-image]');
    if (constructionScheduleImage) {
      try {
        await openConstructionScheduleImage();
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    const progressComparisonExport = event.target.closest('[data-progress-comparison-export]');
    if (progressComparisonExport) {
      try {
        await openProgressComparisonImage();
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    const scheduleImageDownload = event.target.closest('#downloadConstructionScheduleImage');
    if (scheduleImageDownload) {
      const link = document.createElement('a');
      link.href = scheduleImageDownload.dataset.imageUrl;
      link.download = scheduleImageDownload.dataset.filename || '施工进度计划表.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(link.download.includes('合同收款') ? '客户版合同收款计划表图片已下载' : '客户版施工进度表图片已下载');
      return;
    }
    const wizardPresetApply = event.target.closest('[data-project-wizard-preset-apply]');
    if (wizardPresetApply) {
      const selectedId = $('#projectWizardPresetSelect').value;
      const preset = selectedId ? state.constructionPlanPresets.find((item) => item.id === selectedId) : null;
      if (selectedId && !preset) return showToast('所选企业预设已不存在，请重新选择', true);
      applyProjectWizardPreset(preset);
      showToast(`已引用“${preset?.name || '系统标准施工流程'}”，可继续调整本项目节点`);
      return;
    }
    const paymentPlanMove = event.target.closest('[data-payment-plan-move]');
    if (paymentPlanMove) {
      const row = paymentPlanMove.closest('[data-payment-plan-row]');
      const sibling = paymentPlanMove.dataset.paymentPlanMove === 'up' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (paymentPlanMove.dataset.paymentPlanMove === 'up') row.parentElement.insertBefore(row, sibling);
      else row.parentElement.insertBefore(sibling, row);
      updatePaymentPlanEditor();
      return;
    }
    const wizardPresetReset = event.target.closest('[data-project-wizard-preset-reset]');
    if (wizardPresetReset) {
      $('#projectWizardPresetSelect').value = '';
      applyProjectWizardPreset();
      showToast('已恢复系统标准施工流程');
      return;
    }
    const presetApply = event.target.closest('[data-plan-preset-apply]');
    if (presetApply) {
      const presetSelect = $('#constructionPlanPresetSelect');
      const selectedId = presetSelect.value;
      if (!state.constructionPlanPresets.length) {
        $('#constructionPlanPresetName').focus();
        return showToast('无法应用预设：当前企业还没有施工计划预设。请先填写预设名称，并保存当前方案为预设。', true);
      }
      if (!selectedId) {
        presetSelect.focus();
        return showToast('无法应用预设：当前尚未选择企业施工计划预设。请先从下拉框中选择一项，再点击“应用预设”。', true);
      }
      const preset = state.constructionPlanPresets.find((item) => item.id === selectedId);
      if (!preset) {
        presetSelect.value = '';
        presetSelect.focus();
        return showToast('无法应用预设：所选预设已被删除或失效。请重新选择一个企业预设。', true);
      }
      if ($$('[data-plan-row][data-locked="true"]', $('#constructionPlanForm')).length) {
        return showToast('无法整套替换施工计划：当前项目已有节点开始执行。已执行节点会保留，您可以手动调整尚未开始的节点。', true);
      }
      $('#constructionPlanList').innerHTML = (preset.nodes || []).map((item, index) => planRowHtml(item, index)).join('');
      updateConstructionPlanPreview({ cascadeFromIndex: 0 });
      showToast(`已应用“${preset.name}”，确认日期后保存即可`);
      return;
    }
    const presetSave = event.target.closest('[data-plan-preset-save]');
    if (presetSave) {
      const name = $('#constructionPlanPresetName').value.trim();
      const nodes = constructionPlanNodes($('#constructionPlanForm'), false);
      if (!name) return showToast('请填写预设名称', true);
      if (!nodes.length || nodes.some((node) => !node.name)) return showToast('请先填写完整施工节点', true);
      setBusy(presetSave, true, '保存中…');
      try {
        const result = await api(`/api/organizations/${state.organization.id}/construction-plan-presets`, {
          method: 'POST', body: JSON.stringify({ name, nodes }),
        });
        await loadConstructionPlanPresets();
        renderConstructionPlanPresets(result.preset.id);
        $('#constructionPlanPresetName').value = '';
        showToast(result.created ? '施工计划已保存为企业预设' : '同名企业预设已更新');
      } catch (error) {
        showToast(error.message, true);
      } finally {
        setBusy(presetSave, false);
      }
      return;
    }
    const presetDelete = event.target.closest('[data-plan-preset-delete]');
    if (presetDelete) {
      const preset = state.constructionPlanPresets.find((item) => item.id === $('#constructionPlanPresetSelect').value);
      if (!preset) return showToast('请先选择要删除的企业预设', true);
      if (!confirm(`确认删除预设“${preset.name}”？已生成的项目计划不会受影响。`)) return;
      setBusy(presetDelete, true, '删除中…');
      try {
        await api(`/api/organizations/${state.organization.id}/construction-plan-presets/${preset.id}`, { method: 'DELETE' });
        await loadConstructionPlanPresets();
        showToast('施工计划预设已删除');
      } catch (error) {
        showToast(error.message, true);
      } finally {
        setBusy(presetDelete, false);
      }
      return;
    }
    const planAdd = event.target.closest('[data-plan-add]');
    if (planAdd) {
      const list = $('#constructionPlanList');
      list.insertAdjacentHTML('beforeend', planRowHtml({}, list.children.length));
      updateConstructionPlanPreview();
      const input = $('[data-plan-row]:last-child [data-plan-name]', list);
      input?.focus();
      return;
    }
    if (event.target.closest('#projectWizardAddNode')) {
      const list = $('#projectWizardPlanList');
      list.insertAdjacentHTML('beforeend', planRowHtml({ name: '自定义施工节点', durationDays: 3, requiredPhotoCount: 1 }, list.children.length));
      updateProjectWizardPlanPreview();
      recalculateProjectWizardPaymentDates();
      $('[data-plan-row]:last-child [data-plan-name]', list)?.focus();
      return;
    }
    const planRemove = event.target.closest('[data-plan-remove]');
    if (planRemove) {
      const wizard = Boolean(planRemove.closest('#projectWizardPlanList'));
      const root = wizard ? $('#projectWizardPlanList') : $('#constructionPlanForm');
      const rows = $$('[data-plan-row]', root);
      if (rows.length <= 1) return showToast('施工计划至少保留一个节点', true);
      planRemove.closest('[data-plan-row]')?.remove();
      if (wizard) { updateProjectWizardPlanPreview({ cascadeFromIndex: 0 }); recalculateProjectWizardPaymentDates(); }
      else updateConstructionPlanPreview({ cascadeFromIndex: 0 });
      return;
    }
    const planMove = event.target.closest('[data-plan-move]');
    if (planMove) {
      const row = planMove.closest('[data-plan-row]');
      const sibling = planMove.dataset.planMove === 'up' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (planMove.dataset.planMove === 'up') row.parentElement.insertBefore(row, sibling);
      else row.parentElement.insertBefore(sibling, row);
      if (row.closest('#projectWizardPlanList')) { updateProjectWizardPlanPreview({ cascadeFromIndex: 0 }); recalculateProjectWizardPaymentDates(); }
      else updateConstructionPlanPreview({ cascadeFromIndex: 0 });
      return;
    }
    if (event.target.closest('#projectWizardAddPayment')) {
      const list = $('#projectWizardPaymentList');
      list.insertAdjacentHTML('beforeend', wizardPaymentRowHtml({ name: '自定义收款节点', percent: 0, dueDate: $('#projectWizardStartDate').value }, list.children.length));
      updateProjectWizardPayments(false);
      $('[data-wizard-payment-row]:last-child [data-wizard-payment-name]', list)?.focus();
      return;
    }
    const wizardPaymentRemove = event.target.closest('[data-wizard-payment-remove]');
    if (wizardPaymentRemove) {
      wizardPaymentRemove.closest('[data-wizard-payment-row]')?.remove();
      updateProjectWizardPayments(false);
      return;
    }
    const workerAssign = event.target.closest('[data-worker-assign]');
    if (workerAssign) {
      openAssignmentDialog(workerAssign.dataset.workerAssign);
      return;
    }
    const supplierDirectory = event.target.closest('[data-supplier-directory]');
    if (supplierDirectory) {
      await openSupplierDirectory();
      return;
    }
    const businessReports = event.target.closest('[data-business-reports]');
    if (businessReports) {
      const dialog = $('#businessReportDialog');
      if (dialog && !dialog.open) dialog.showModal();
      const form = $('#businessReportForm');
      try { await loadBusinessReport(form.elements.reportScope.value, form.elements.reportPeriod.value); }
      catch (error) { $('#businessReportContent').innerHTML = `<div class="empty-state"><b>经营报表生成失败</b><p>${esc(error.message)}</p></div>`; }
      return;
    }
    const assignmentEdit = event.target.closest('[data-assignment-edit]');
    if (assignmentEdit) {
      const assignment = (state.workforce?.assignments || []).find((item) => item.id === assignmentEdit.dataset.assignmentEdit);
      if (assignment) openAssignmentDialog(assignment.workerId, assignment);
      return;
    }
    const assignmentDelete = event.target.closest('[data-assignment-delete]');
    if (assignmentDelete) {
      if (!confirm('确认取消这条派工安排？取消后该工人对应日期将恢复可调配。')) return;
      setBusy(assignmentDelete, true, '取消中…');
      try {
        await api(`/api/organizations/${state.organization.id}/worker-assignments/${assignmentDelete.dataset.assignmentDelete}`, { method: 'DELETE' });
        showToast('派工安排已取消');
        await loadWorkforceData();
      } catch (error) {
        showToast(error.message, true);
        setBusy(assignmentDelete, false);
      }
      return;
    }
    if (event.target.closest('[data-enterprise-contact]')) {
      const dialog = $('#enterpriseExpiryDialog');
      if (dialog?.open) dialog.close();
      showToast('请在内测群联系作者续费企业版');
      return;
    }
    if (event.target.closest('[data-enterprise-renew], [data-expired-write]')) {
      showEnterpriseExpiryPrompt();
      return;
    }
    if (event.target.closest('[data-team-plan-upgrade]')) {
      showTeamPlanUpgrade();
      return;
    }
    const open = event.target.closest('[data-open]');
    if (open) {
      if (!canWrite() && ['projectDialog', 'costDialog', 'paymentDialog', 'changeOrderDialog', 'materialDialog', 'milestoneDialog', 'inviteDialog'].includes(open.dataset.open)) {
        showEnterpriseExpiryPrompt();
        return;
      }
      if (open.dataset.open === 'inviteDialog' && !canUseTeamCollaboration()) {
        showTeamPlanUpgrade();
        return;
      }
      if (open.dataset.open === 'workerDialog') {
        openWorkerDialog();
        return;
      }
      if (open.dataset.open === 'assignmentDialog') {
        openAssignmentDialog();
        return;
      }
      if (open.dataset.open === 'issueDialog') {
        openNodeIssueDialog();
        return;
      }
      if (open.dataset.open === 'projectDialog') {
        resetProjectWizard();
        $('#projectDialog').showModal();
        try {
          await loadConstructionPlanPresets();
        } catch (error) {
          showToast('企业预设加载失败，可继续使用系统标准施工流程', true);
        }
        return;
      }
      const dialog = $(`#${open.dataset.open}`);
      if (open.dataset.open === 'costDialog') {
        openCostDialog();
        return;
      }
      if (open.dataset.open === 'paymentDialog') {
        const form = $('#paymentForm'); form.reset();
        form.elements.dueDate.value = localDateValue();
      }
      if (open.dataset.open === 'changeOrderDialog') { $('#changeOrderForm').reset(); clearUploadPreview($('#changeOrderForm')); }
      if (open.dataset.open === 'materialDialog') {
        openMaterialDialog();
        return;
      }
      if (open.dataset.open === 'milestoneDialog') {
        $('#milestoneForm').reset();
      }
      if (dialog) dialog.showModal();
    }
    const tab = event.target.closest('[data-project-tab]');
    if (tab) selectProjectTab(tab.dataset.projectTab);
    const projectSection = event.target.closest('[data-project-section]');
    if (projectSection) {
      selectProjectWorkspaceSection(projectSection.dataset.projectSection);
      window.scrollTo({ top: $('#projectHero').offsetTop - 82, behavior: 'smooth' });
    }
    const projectAction = event.target.closest('[data-project-action]');
    if (projectAction?.dataset.projectAction === 'log') openNodeLogDialog();
    const nodeLog = event.target.closest('[data-node-log]');
    if (nodeLog) {
      const milestone = (state.projectDetail.milestones || []).find((item) => item.id === nodeLog.dataset.nodeLog);
      if (milestone) openNodeLogDialog(milestone);
    }
    const nodeIssue = event.target.closest('[data-node-issue]');
    if (nodeIssue) {
      const milestone = (state.projectDetail.milestones || []).find((item) => item.id === nodeIssue.dataset.nodeIssue);
      if (milestone) openNodeIssueDialog(milestone);
    }
    const acceptanceMedia = event.target.closest('[data-node-acceptance-media]');
    if (acceptanceMedia) {
      const milestone = (state.projectDetail.milestones || []).find((item) => item.id === acceptanceMedia.dataset.nodeAcceptanceMedia);
      if (milestone) openAcceptanceMediaDialog(milestone);
    }
    const milestoneReport = event.target.closest('[data-milestone-report]');
    if (milestoneReport && !milestoneReport.disabled) {
      openMilestoneReportExportDialog(milestoneReport.dataset.milestoneReport, false);
    }
    const milestoneReportPreview = event.target.closest('[data-milestone-report-preview]');
    if (milestoneReportPreview) {
      openMilestoneReportExportDialog(milestoneReportPreview.dataset.milestoneReportPreview, true);
    }
    const reportStylePreview = event.target.closest('[data-report-style-preview]');
    if (reportStylePreview) {
      openMilestoneReportExportDialog(reportStylePreview.dataset.reportStylePreview, true);
    }
    const projectRefresh = event.target.closest('[data-project-refresh]');
    if (projectRefresh) {
      setBusy(projectRefresh, true, '刷新中…');
      try {
        await refreshProject('overview');
        showToast('已读取服务器最新数据');
      } catch (error) {
        showToast(error.message, true);
        setBusy(projectRefresh, false);
      }
      return;
    }
    const wizardPaymentMove = event.target.closest('[data-wizard-payment-move]');
    if (wizardPaymentMove) {
      const row = wizardPaymentMove.closest('[data-wizard-payment-row]');
      const sibling = wizardPaymentMove.dataset.wizardPaymentMove === 'up' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (wizardPaymentMove.dataset.wizardPaymentMove === 'up') row.parentElement.insertBefore(row, sibling);
      else row.parentElement.insertBefore(sibling, row);
      updateProjectWizardPayments(false);
      return;
    }
    const projectEdit = event.target.closest('[data-project-edit]');
    if (projectEdit) {
      openProjectEditDialog();
    }
    const costStatement = event.target.closest('[data-cost-statement]');
    if (costStatement) {
      openCostStatementDialog();
      return;
    }
    const costBatchAction = event.target.closest('[data-cost-batch-action]');
    if (costBatchAction) {
      const ids = $$('[data-cost-batch-select]:checked').map((input) => input.value);
      if (!ids.length) return showToast('请先勾选要加入对账单的支出', true);
      openCostStatementDialog();
      $$('[data-cost-statement-item]', $('#costStatementItems')).forEach((input) => { input.checked = ids.includes(String(input.value).replace(/^plan:/, '')); });
      updateCostStatementSelection();
      return;
    }
    const costStatementPreview = event.target.closest('[data-cost-statement-preview]');
    if (costStatementPreview) {
      openCostStatementPdf(true);
      return;
    }
    const costDelete = event.target.closest('[data-cost-delete]');
    if (costDelete) {
      const reason = prompt('历史实际成本不能直接删除，请填写作废原因（必填）：')?.trim();
      if (!reason) return showToast('作废历史成本必须填写原因', true);
      setBusy(costDelete, true, '处理中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/costs/${costDelete.dataset.costDelete}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
        showToast('历史成本已作废，原始记录仍可审计追溯');
        await refreshProject('costs');
      } catch (error) {
        showToast(error.message, true);
        setBusy(costDelete, false);
      }
    }
    const paymentReceipt = event.target.closest('[data-payment-receipt]');
    if (paymentReceipt) {
      const item = state.projectDetail.business?.payments?.find((row) => row.id === paymentReceipt.dataset.paymentReceipt);
      if (item) openPaymentReceiptDialog(item);
    }
    const receiptCorrect = event.target.closest('[data-receipt-correct]');
    if (receiptCorrect) {
      const action = prompt('输入“更正”修改到账金额，或输入“冲销”整笔撤销：', '更正')?.trim();
      if (!action) return;
      const reason = prompt('请填写更正 / 冲销原因（必填）')?.trim();
      if (!reason) return showToast('财务更正必须填写原因', true);
      try {
        if (action === '冲销') {
          await api(`/api/organizations/${state.organization.id}/payment-receipts/${receiptCorrect.dataset.receiptCorrect}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
          showToast('到账记录已冲销，原始凭证已保留');
        } else {
          const amountText = prompt('请输入更正后的到账金额', receiptCorrect.dataset.receiptAmount || '0');
          if (amountText == null) return;
          const amount = Number(amountText);
          if (!Number.isFinite(amount) || amount < 0) return showToast('请输入有效的更正金额', true);
          await api(`/api/organizations/${state.organization.id}/payment-receipts/${receiptCorrect.dataset.receiptCorrect}/corrections`, { method: 'POST', body: JSON.stringify({ amount, reason }) });
          showToast('到账金额已更正，原始凭证已保留');
        }
        await refreshProject('finance');
      } catch (error) { showToast(error.message, true); }
      return;
    }
    const paymentDelete = event.target.closest('[data-payment-delete]');
    if (paymentDelete && confirm('确认删除这个收款节点？')) {
      try { await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/payments/${paymentDelete.dataset.paymentDelete}`, { method: 'DELETE' }); showToast('收款节点已删除'); await refreshProject('overview'); } catch (error) { showToast(error.message, true); }
    }
    const changeApprove = event.target.closest('[data-change-approve]');
    if (changeApprove) {
      const item = state.projectDetail.business?.changeOrders?.find((row) => row.id === changeApprove.dataset.changeApprove);
      if (!item) return;
      const internalApproved = item.status === 'approved';
      let confirmationNote = item.confirmationNote || '';
      if (internalApproved) {
        confirmationNote = prompt('请填写客户确认方式、日期或凭证说明（必填）', confirmationNote)?.trim() || '';
        if (!confirmationNote) return showToast('登记客户确认时必须填写确认依据', true);
      }
      setBusy(changeApprove, true, '确认中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/change-orders/${item.id}`, {
          method: 'PATCH', body: JSON.stringify({
            title: item.title, kind: item.kind, amount: item.amount, status: 'approved', note: item.note || '',
            customerConfirmed: internalApproved, scheduleImpactDays: item.scheduleImpactDays || 0,
            confirmationNote, mediaIds: (item.media || []).map((media) => media.id),
          }),
        });
        showToast(internalApproved ? '客户确认已登记，增减项已计入调整后合同额' : '内部审批已通过，等待客户确认后计入合同');
        await refreshProject('finance');
      } catch (error) { showToast(error.message, true); setBusy(changeApprove, false); }
    }
    const changeDelete = event.target.closest('[data-change-delete]');
    const changeDeleteMessage = changeDelete?.dataset.changeComplete === 'true'
      ? '确认撤销这个已确认增减项？调整后合同额和对应收款计划会同步回退；如已有到账，系统将阻止撤销。'
      : '确认删除这个合同增减项？';
    if (changeDelete && confirm(changeDeleteMessage)) {
      try { await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/change-orders/${changeDelete.dataset.changeDelete}`, { method: 'DELETE' }); showToast(changeDelete.dataset.changeComplete === 'true' ? '增减项已撤销，合同额与收款计划已同步回退' : '增减项已删除'); await refreshProject('finance'); } catch (error) { showToast(error.message, true); }
    }
    const materialArrived = event.target.closest('[data-material-arrived]');
    if (materialArrived) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === materialArrived.dataset.materialArrived);
      if (!item) return;
      setBusy(materialArrived, true, '保存中…');
      try { await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials/${item.id}`, { method: 'PATCH', body: JSON.stringify(materialUpdatePayload(item, { status: 'arrived', manufacturerStatus: ['unordered', 'measured', 'ordered'].includes(item.manufacturerStatus) ? 'arrived' : item.manufacturerStatus, actualArrivalDate: localDateValue() })) }); showToast('采购物流已更新为已到场，厂家履约状态已同步'); await refreshProject('costs'); } catch (error) { showToast(error.message, true); setBusy(materialArrived, false); }
    }
    const materialBatchAction = event.target.closest('[data-material-batch-action]');
    if (materialBatchAction) {
      const ids = $$('[data-material-batch-select]:checked').map((input) => input.value);
      if (!ids.length) return showToast('请先勾选要更新的材料', true);
      const form = $('#materialBatchForm');
      form.dataset.materialIds = ids.join(',');
      $('#materialBatchHint').textContent = `将统一更新已勾选的 ${ids.length} 条材料记录。`;
      $('#materialBatchDialog').showModal();
      return;
    }
    const manufacturerProgress = event.target.closest('[data-manufacturer-status]');
    if (manufacturerProgress) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === manufacturerProgress.dataset.materialId);
      if (!item || item.manufacturerStatus === manufacturerProgress.dataset.manufacturerStatus) return;
      const nextManufacturerStatus = manufacturerProgress.dataset.manufacturerStatus;
      const manufacturerLabel = { unordered: '未下单', measured: '已测量', ordered: '已下单', arrived: '已送货', installed: '已安装', other: '例外 / 不适用' }[nextManufacturerStatus] || '已更新';
      let manufacturerStatusNote = '';
      if (nextManufacturerStatus === 'other') {
        manufacturerStatusNote = prompt('请填写例外或不适用说明，例如“水电材料无需测量，直接采购”')?.trim() || '';
        if (!manufacturerStatusNote) return showToast('选择“例外 / 不适用”时必须填写说明', true);
      }
      const linkedStatus = nextManufacturerStatus === 'ordered' && item.status === 'planned' ? 'ordered'
        : nextManufacturerStatus === 'arrived' && !['arrived', 'accepted'].includes(item.status) ? 'arrived'
          : nextManufacturerStatus === 'installed' && !['arrived', 'accepted'].includes(item.status) ? 'arrived' : item.status;
      setBusy(manufacturerProgress, true, '保存中…');
      try { await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials/${item.id}`, { method: 'PATCH', body: JSON.stringify(materialUpdatePayload(item, { manufacturerStatus: nextManufacturerStatus, manufacturerStatusNote, note: nextManufacturerStatus === 'other' ? manufacturerStatusNote : item.note, status: linkedStatus, actualArrivalDate: ['arrived', 'accepted'].includes(linkedStatus) ? (item.actualArrivalDate || localDateValue()) : null })) }); showToast(`厂家履约状态已更新为${manufacturerLabel}`); await refreshProject('costs'); } catch (error) { showToast(error.message, true); setBusy(manufacturerProgress, false); }
    }
    const materialEdit = event.target.closest('[data-material-edit]');
    if (materialEdit) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === materialEdit.dataset.materialEdit);
      if (item) openMaterialDialog(item);
      return;
    }
    const materialPayment = event.target.closest('[data-material-payment]');
    if (materialPayment) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === materialPayment.dataset.materialPayment);
      if (!item) return;
      openMaterialPaymentDialog(item);
      return;
    }
    const materialPaymentDelete = event.target.closest('[data-material-payment-delete]');
    if (materialPaymentDelete) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === materialPaymentDelete.dataset.materialId);
      const payment = item?.payments?.find((row) => row.id === materialPaymentDelete.dataset.materialPaymentDelete);
      if (!item || !payment || !['corrected', 'voided'].includes(payment.status)) return;
      if (!confirm(`确认删除这条${statusNames[payment.status] || '无效'}付款记录？当前有效付款和项目成本不会改变，删除操作仍会保留在后台审计日志中。`)) return;
      setBusy(materialPaymentDelete, true, '删除中…');
      try {
        await api(`/api/organizations/${state.organization.id}/material-payments/${payment.id}`, { method: 'DELETE' });
        showToast('无效付款记录已删除，当前材料成本未改变');
        await refreshProject('costs');
      } catch (error) { showToast(error.message, true); setBusy(materialPaymentDelete, false); }
      return;
    }
    const materialPaymentCorrect = event.target.closest('[data-material-payment-correct]');
    if (materialPaymentCorrect) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === materialPaymentCorrect.dataset.materialId);
      const payment = item?.payments?.find((row) => row.id === materialPaymentCorrect.dataset.materialPaymentCorrect);
      if (!item || !payment) return;
      const choice = prompt('请输入处理方式：更正 或 作废', '更正')?.trim();
      if (!choice) return;
      const reason = prompt('请填写更正 / 作废原因（将写入审计记录）', '')?.trim();
      if (!reason) return showToast('必须填写处理原因', true);
      try {
        if (choice === '作废') {
          await api(`/api/organizations/${state.organization.id}/material-payments/${payment.id}/void`, {
            method: 'POST', body: JSON.stringify({ reason }),
          });
          showToast('材料付款已作废，原始凭证已保留');
        } else if (choice === '更正') {
          const amount = Number(prompt('请输入更正后的付款金额', String(payment.amount)));
          if (!Number.isFinite(amount) || amount <= 0) return showToast('更正金额必须大于 0', true);
          const paidDate = prompt('请输入更正后的实际支出日期（YYYY-MM-DD）', payment.paidDate || localDateValue())?.trim();
          if (!paidDate || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return showToast('请输入正确的实际支出日期', true);
          await api(`/api/organizations/${state.organization.id}/material-payments/${payment.id}/corrections`, {
            method: 'POST', body: JSON.stringify({ amount, paidDate, method: payment.method || 'bank', reference: payment.reference || '', note: payment.note || '', reason }),
          });
          showToast('材料付款已更正，原始记录已保留');
        } else return showToast('请输入“更正”或“作废”', true);
        await refreshProject('costs');
      } catch (error) { showToast(error.message, true); }
      return;
    }
    const materialDelete = event.target.closest('[data-material-delete]');
    if (materialDelete) {
      const item = state.projectDetail.materials?.items?.find((row) => row.id === materialDelete.dataset.materialDelete);
      if (!item) return;
      const hasPayment = Number(item.paidAmount || 0) > 0;
      if (hasPayment) {
        const reason = prompt('该材料已有付款记录，不能直接删除。请填写作废 / 冲销原因：')?.trim();
        if (!reason) return showToast('作废已付款材料必须填写原因', true);
        try {
          await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials/${item.id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
          showToast('材料计划已作废，原始记录和付款凭证已保留');
          await refreshProject('costs');
        } catch (error) { showToast(error.message, true); }
      } else if (confirm('确认删除这条尚未付款的材料计划？')) {
        try { await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials/${item.id}`, { method: 'DELETE' }); showToast('未付款材料计划已删除'); await refreshProject('costs'); } catch (error) { showToast(error.message, true); }
      }
      return;
    }
    const supplierEdit = event.target.closest('[data-supplier-edit]');
    if (supplierEdit) {
      const item = (state.supplierDirectory?.suppliers || state.supplierDirectory?.items || []).find((row) => row.id === supplierEdit.dataset.supplierEdit);
      if (!item) return;
      const form = $('#supplierForm');
      form.dataset.supplierId = item.id;
      form.elements.supplierName.value = item.name || '';
      form.elements.supplierContact.value = [item.contactName, item.phone].filter(Boolean).join(' / ');
      form.elements.supplierCategories.value = item.category || '';
      form.elements.supplierNote.value = item.note || '';
      form.elements.supplierName.focus();
      return;
    }
    const projectLifecycle = event.target.closest('[data-project-lifecycle]');
    if (projectLifecycle) {
      const nextStatus = projectLifecycle.dataset.projectLifecycle;
      const actionText = nextStatus === 'archived' ? '归档' : '恢复';
      const message = nextStatus === 'archived'
        ? '归档前必须完成待审核日志、整改和客户意见；归档后客户链接会停用，项目不再占用在管额度。确认继续？'
        : '恢复后项目会重新占用一个在管项目额度。确认继续？';
      if (!confirm(message)) return;
      setBusy(projectLifecycle, true);
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/lifecycle`, {
          method: 'PATCH', body: JSON.stringify({ status: nextStatus }),
        });
        showToast(`项目已${actionText}`);
        await loadOrganization(state.organization.id);
        showProjectDirectory(state.projectIntent, directoryConfig[state.projectIntent]?.nav);
      } catch (error) {
        showToast(error.message, true);
        setBusy(projectLifecycle, false);
      }
    }
    const milestoneSave = event.target.closest('[data-milestone-save]');
    const milestoneEdit = event.target.closest('[data-milestone-edit]');
    if (milestoneEdit) {
      await openConstructionPlanDialog();
      const row = $(`[data-plan-row][data-milestone-id="${CSS.escape(milestoneEdit.dataset.milestoneEdit)}"]`, $('#constructionPlanForm'));
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row?.classList.add('is-highlighted');
      window.setTimeout(() => row?.classList.remove('is-highlighted'), 1400);
      showToast('已打开施工计划，可直接修改已完成节点');
      return;
    }
    if (milestoneSave) {
      const row = milestoneSave.closest('[data-milestone-row]');
      const name = $('[data-milestone-name]', row)?.value.trim() || '';
      const stage = $('[data-milestone-stage]', row)?.value.trim() || '';
      const status = $('[data-milestone-status]', row)?.value || 'pending';
      const plannedFinishDate = $('[data-milestone-date]', row)?.value || null;
      const note = $('[data-milestone-note]', row)?.value.trim() || '';
      setBusy(milestoneSave, true, '保存中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${milestoneSave.dataset.milestoneSave}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            stage,
            status,
            ownerMemberId: milestoneSave.dataset.milestoneOwner || null,
            plannedFinishDate,
            note,
          }),
        });
        showToast('施工节点已更新');
        await refreshProject('overview');
        const updatedNode = $(`[data-milestone-node="${milestoneSave.dataset.milestoneSave}"]`);
        if (updatedNode) updatedNode.open = true;
      } catch (error) {
        showToast(error.message, true);
        setBusy(milestoneSave, false);
      }
    }
    const milestoneDelete = event.target.closest('[data-milestone-delete]');
    if (milestoneDelete) {
      const milestoneName = milestoneDelete.dataset.milestoneName || '该施工节点';
      if (!confirm(`确认删除“${milestoneName}”？已有现场日志或整改记录的节点不会被删除。`)) return;
      setBusy(milestoneDelete, true, '删除中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${milestoneDelete.dataset.milestoneDelete}`, { method: 'DELETE' });
        showToast('施工节点已删除');
        await refreshProject('overview');
      } catch (error) {
        showToast(error.message, true);
        setBusy(milestoneDelete, false);
      }
    }
    const milestoneComplete = event.target.closest('[data-milestone-complete]');
    if (milestoneComplete) {
      const milestoneId = milestoneComplete.dataset.milestoneComplete;
      setBusy(milestoneComplete, true, '保存中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${milestoneId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            ownerMemberId: milestoneComplete.dataset.milestoneOwner || null,
            plannedFinishDate: milestoneComplete.dataset.milestoneDate || null,
            note: milestoneComplete.dataset.milestoneNote || '节点已完成',
          }),
        });
        showToast('节点已标记为完成');
        await refreshProject('overview');
        const updatedNode = $(`[data-milestone-node="${milestoneId}"]`);
        if (updatedNode) updatedNode.open = true;
      } catch (error) {
        showToast(error.message, true);
        setBusy(milestoneComplete, false);
      }
    }
    const nodeEditToggle = event.target.closest('[data-node-edit-toggle]');
    if (nodeEditToggle) {
      const settings = $(`[data-node-settings="${nodeEditToggle.dataset.nodeEditToggle}"]`);
      if (settings) {
        settings.hidden = !settings.hidden;
        nodeEditToggle.textContent = settings.hidden ? '编辑与更新节点' : '收起节点设置';
      }
    }
    const focusNodeChecklist = event.target.closest('[data-focus-node-checklist]');
    if (focusNodeChecklist) {
      const checklistBlock = $(`[data-node-checklist-block="${focusNodeChecklist.dataset.focusNodeChecklist}"]`);
      checklistBlock?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      checklistBlock?.classList.add('is-highlighted');
      window.setTimeout(() => checklistBlock?.classList.remove('is-highlighted'), 1200);
    }
    const milestoneMove = event.target.closest('[data-milestone-move]');
    if (milestoneMove) {
      event.preventDefault();
      await moveMilestone(milestoneMove.dataset.milestoneId, milestoneMove.dataset.milestoneMove);
      return;
    }
    const checklistAction = event.target.closest('[data-checklist-id]');
    if (checklistAction) {
      setBusy(checklistAction, true, '保存中…');
      try {
        const expectedStatus = checklistAction.dataset.checklistStatus;
        const result = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/checklist/${checklistAction.dataset.checklistId}`, {
          method: 'PATCH', body: JSON.stringify({ status: checklistAction.dataset.checklistStatus }),
        });
        if (result?.item?.status !== expectedStatus) throw new Error('服务器未确认本次必检项状态，请重试');
        await refreshProject('overview');
        const syncedItem = (state.projectDetail?.checklistItems || []).find((item) => item.id === checklistAction.dataset.checklistId);
        if (!syncedItem || syncedItem.status !== expectedStatus) throw new Error('必检项状态重新读取不一致，请刷新后重试');
        showToast(expectedStatus === 'passed' ? '必检项已通过，网页与小程序已同步' : expectedStatus === 'failed' ? '已标记不通过，网页与小程序已同步' : '已恢复待验收，网页与小程序已同步');
      } catch (error) {
        showToast(error.message, true);
        setBusy(checklistAction, false);
      }
      return;
    }
    const checklistProblem = event.target.closest('[data-checklist-problem]');
    if (checklistProblem) {
      const item = (state.projectDetail.checklistItems || []).find((row) => row.id === checklistProblem.dataset.checklistProblem);
      const milestone = (state.projectDetail.milestones || []).find((row) => row.id === checklistProblem.dataset.milestoneId);
      if (!item || !milestone) return;
      openNodeIssueDialog(milestone);
      pendingChecklistIssueId = item.id;
      const form = $('#issueForm');
      form.elements.title.value = `必检项整改：${item.title}`;
      form.elements.description.value = `检查发现“${item.title}”存在问题，请按验收标准完成整改并提交复核。${item.note ? `\n检查标准：${item.note}` : ''}`;
      $('#issueDialog .dialog-head p').textContent = '整改创建成功后，该必检项会自动标记为“不通过”；整改闭环后请重新检查并打勾。';
      return;
    }
    const checklistAdd = event.target.closest('[data-checklist-add]');
    if (checklistAdd) {
      const milestone = (state.projectDetail.milestones || []).find((row) => row.id === checklistAdd.dataset.checklistAdd);
      openChecklistItemDialog(milestone);
      return;
    }
    const checklistEdit = event.target.closest('[data-checklist-edit]');
    if (checklistEdit) {
      const item = (state.projectDetail.checklistItems || []).find((row) => row.id === checklistEdit.dataset.checklistEdit);
      const milestone = (state.projectDetail.milestones || []).find((row) => row.id === item?.milestoneId);
      openChecklistItemDialog(milestone, item);
      return;
    }
    const checklistDelete = event.target.closest('[data-checklist-delete]');
    if (checklistDelete) {
      const item = (state.projectDetail.checklistItems || []).find((row) => row.id === checklistDelete.dataset.checklistDelete);
      if (!item || !confirm(`确认删除必检项“${item.title}”？历史检查结果也会一并删除。`)) return;
      setBusy(checklistDelete, true, '删除中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/checklist/${item.id}`, { method: 'DELETE' });
        showToast('必检项已删除');
        await refreshProject('overview');
      } catch (error) {
        showToast(error.message, true);
        setBusy(checklistDelete, false);
      }
      return;
    }
    if (event.target.closest('[data-checklist-template]')) {
      openChecklistTemplateDialog();
      return;
    }
    const checklistImport = event.target.closest('[data-checklist-import]');
    if (checklistImport) {
      const milestone = (state.projectDetail.milestones || []).find((item) => item.id === checklistImport.dataset.checklistImport);
      await openChecklistImportDialog(milestone);
      return;
    }
    if (event.target.closest('#addChecklistTemplateStage')) {
      $('.checklist-template-empty', $('#checklistTemplateStages'))?.remove();
      $('#checklistTemplateStages').insertAdjacentHTML('beforeend', checklistTemplateStageHtml({}, $$('[data-template-stage]', $('#checklistTemplateStages')).length));
      reindexChecklistTemplate();
      return;
    }
    const templateAddItem = event.target.closest('[data-template-stage-add-item]');
    if (templateAddItem) {
      const stage = templateAddItem.closest('[data-template-stage]');
      $('.checklist-template-items', stage).insertAdjacentHTML('beforeend', checklistTemplateItemHtml({}, $$('[data-template-item]', stage).length));
      reindexChecklistTemplate();
      return;
    }
    const templateMoveItem = event.target.closest('[data-template-item-move]');
    if (templateMoveItem) {
      const item = templateMoveItem.closest('[data-template-item]');
      const container = item?.parentElement;
      if (!item || !container) return;
      const direction = templateMoveItem.dataset.templateItemMove;
      if (direction === 'top' && item.previousElementSibling) container.prepend(item);
      if (direction === 'up' && item.previousElementSibling) item.previousElementSibling.before(item);
      if (direction === 'down' && item.nextElementSibling) item.nextElementSibling.after(item);
      reindexChecklistTemplate();
      const position = $$('[data-template-item]', container).indexOf(item) + 1;
      showToast(`已调整到第 ${position} 项，保存企业模板后生效`);
      return;
    }
    const templateRemoveItem = event.target.closest('[data-template-item-remove]');
    if (templateRemoveItem) {
      const stage = templateRemoveItem.closest('[data-template-stage]');
      if ($$('[data-template-item]', stage).length <= 1) return showToast('每个施工阶段至少保留一个必检项', true);
      templateRemoveItem.closest('[data-template-item]').remove();
      reindexChecklistTemplate();
      return;
    }
    const templateRemoveStage = event.target.closest('[data-template-stage-remove]');
    if (templateRemoveStage) {
      templateRemoveStage.closest('[data-template-stage]').remove();
      if (!$$('[data-template-stage]', $('#checklistTemplateStages')).length) $('#checklistTemplateStages').innerHTML = '<div class="checklist-template-empty">还没有阶段，请先添加施工阶段和必检项。</div>';
      reindexChecklistTemplate();
      return;
    }
    const logAction = event.target.closest('[data-log-action]');
    if (logAction) reviewLog(logAction.dataset.logId, logAction.dataset.logAction, logAction);
    const logEdit = event.target.closest('[data-log-edit]');
    if (logEdit) {
      openLogEditDialog((state.projectDetail.siteLogs || []).find((item) => item.id === logEdit.dataset.logEdit));
      return;
    }
    const costConfirm = event.target.closest('[data-cost-confirm]');
    if (costConfirm) {
      const item = (state.projectDetail.cost?.plans || []).find((row) => row.id === costConfirm.dataset.costConfirm);
      if (!item) return;
      const form = $('#costConfirmForm');
      form.elements.planId.value = item.id;
      form.elements.actualAmount.value = item.plannedAmount;
      form.elements.actualDate.value = localDateValue();
      $('#costConfirmDescription').textContent = `${item.title} · 预计 ${formatMoney(item.plannedAmount)}；可按实际付款修改金额和日期。`;
      $('#costConfirmDialog').showModal();
    }
    const costSubitem = event.target.closest('[data-cost-subitem]');
    if (costSubitem) {
      const item = (state.projectDetail.cost?.plans || []).find((row) => row.id === costSubitem.dataset.costSubitem);
      if (item) openCostDialog({ parent: item });
      return;
    }
    const costContingency = event.target.closest('[data-cost-contingency]');
    if (costContingency) {
      openCostDialog({ contingency: true });
      return;
    }
    const costEdit = event.target.closest('[data-cost-edit]');
    if (costEdit) {
      const item = (state.projectDetail.cost?.plans || []).find((row) => row.id === costEdit.dataset.costEdit);
      if (item) openCostDialog({ item });
      return;
    }
    const costCorrect = event.target.closest('[data-cost-correct]');
    if (costCorrect) {
      const item = (state.projectDetail.cost?.plans || []).find((row) => row.id === costCorrect.dataset.costCorrect);
      if (!item) return;
      const amountText = prompt(`更正“${item.title}”的实际支出金额`, String(item.actualAmount ?? item.paidAmount ?? item.plannedAmount ?? 0));
      if (amountText == null) return;
      const actualAmount = Number(amountText);
      if (!Number.isFinite(actualAmount) || actualAmount < 0) return showToast('请输入有效的更正金额', true);
      const reason = prompt('请填写更正原因（必填，原记录将保留）')?.trim();
      if (!reason) return showToast('财务更正必须填写原因', true);
      setBusy(costCorrect, true, '更正中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/cost-plans/${item.id}/corrections`, {
          method: 'POST', body: JSON.stringify({ actualAmount, actualDate: localDateValue(), reason }),
        });
        showToast('支出已更正，原始金额和更正原因均已留档');
        await refreshProject('costs');
      } catch (error) { showToast(error.message, true); setBusy(costCorrect, false); }
      return;
    }
    const costVoid = event.target.closest('[data-cost-void]');
    if (costVoid) {
      const item = (state.projectDetail.cost?.plans || []).find((row) => row.id === costVoid.dataset.costVoid);
      if (!item) return;
      const reason = prompt(`请输入作废 / 冲销“${item.title}”的原因（必填）`)?.trim();
      if (!reason) return showToast('作废或冲销必须填写原因', true);
      setBusy(costVoid, true, '处理中…');
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/cost-plans/${item.id}/void`, {
          method: 'POST', body: JSON.stringify({ reason }),
        });
        showToast('该支出已作废 / 冲销，历史记录仍可追溯');
        await refreshProject('costs');
      } catch (error) { showToast(error.message, true); setBusy(costVoid, false); }
      return;
    }
    const costPlanDelete = event.target.closest('[data-cost-plan-delete]');
    if (costPlanDelete) {
      const permanentDelete = costPlanDelete.dataset.permanentDelete === 'true';
      const warning = permanentDelete
        ? '该支出已作废且没有实际付款。彻底删除后将无法在项目中恢复，但后台审计记录仍会保留。确认删除？'
        : '删除后预计成本和实际成本会立即重算，确认删除？';
      if (!confirm(warning)) return;
      try {
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/cost-plans/${costPlanDelete.dataset.costPlanDelete}`, { method: 'DELETE' });
        showToast(permanentDelete ? '已作废支出已彻底删除' : '支出节点已删除');
        await refreshProject('costs');
      } catch (error) { showToast(error.message, true); }
    }
    const logAppend = event.target.closest('[data-log-append]');
    if (logAppend) {
      openLogAppendDialog((state.projectDetail.siteLogs || []).find((item) => item.id === logAppend.dataset.logAppend));
      return;
    }
    const logDelete = event.target.closest('[data-log-delete]');
    if (logDelete) {
      const log = (state.projectDetail.siteLogs || []).find((item) => item.id === logDelete.dataset.logDelete);
      const publishedWarning = log?.reviewStatus === 'published' ? '该日志已发布给客户，删除后客户侧也会同步移除。' : '';
      if (!confirm(`${publishedWarning}确认将这条现场日志及照片移入回收站？可以恢复，不影响独立整改记录。`)) return;
      setBusy(logDelete, true, '删除中…');
      try {
        await api(`/api/organizations/${state.organization.id}/site-logs/${logDelete.dataset.logDelete}`, { method: 'DELETE' });
        showToast('现场日志已移入回收站，可恢复日志与照片'); await refreshProject('overview');
      } catch (error) { showToast(error.message, true); setBusy(logDelete, false); }
      return;
    }
    const issueReportPreview = event.target.closest('[data-issue-report-preview]');
    if (issueReportPreview) {
      openIssueRectificationReport(issueReportPreview.dataset.issueReportPreview, true);
      return;
    }
    const issueReportDownload = event.target.closest('[data-issue-report-download]');
    if (issueReportDownload) {
      openIssueRectificationReport(issueReportDownload.dataset.issueReportDownload, false);
      return;
    }
    const issueAction = event.target.closest('[data-issue-action]');
    if (issueAction) {
      const action = issueAction.dataset.issueAction;
      if (action === 'submit_review') {
        state.pendingIssueId = issueAction.dataset.issueId;
        const form = $('#issueReviewForm');
        form.reset();
        clearUploadPreview(form);
        form.elements.occurredAt.value = datetimeLocalValue();
        $('#issueReviewDialog').showModal();
      } else {
        updateIssue(issueAction.dataset.issueId, action, [], issueAction);
      }
    }
    const issueEdit = event.target.closest('[data-issue-edit]');
    if (issueEdit) {
      const issue = (state.projectDetail.issues || []).find((item) => item.id === issueEdit.dataset.issueEdit);
      openIssueEditDialog(issue);
      return;
    }
    const issueDelete = event.target.closest('[data-issue-delete]');
    if (issueDelete) deleteIssue(issueDelete.dataset.issueId, issueDelete);
    const clientAction = event.target.closest('[data-client-action]');
    if (clientAction) {
      if (clientAction.dataset.clientAction === 'generate') generateClientShare(clientAction);
      if (clientAction.dataset.clientAction === 'invite') inviteCustomer(clientAction);
      if (clientAction.dataset.clientAction === 'revoke') revokeClientShare(clientAction);
      if (clientAction.dataset.clientAction === 'bind-account') bindCustomerAccount(clientAction);
      if (clientAction.dataset.clientAction === 'unbind-account') unbindCustomerAccount(clientAction);
    }
    const clientResponse = event.target.closest('[data-client-response]');
    if (clientResponse) {
      const resolutionNote = prompt('请填写处理结果，客户交付记录中会保留这段说明：')?.trim();
      if (!resolutionNote) return showToast('标记客户意见已处理时必须填写处理结果', true);
      setBusy(clientResponse, true);
      try {
        await api(`/api/organizations/${state.organization.id}/client-responses/${clientResponse.dataset.clientResponse}`, {
          method: 'PATCH', body: JSON.stringify({ status: 'resolved', resolutionNote }),
        });
        showToast('客户意见已标记处理');
        await openProject(state.project.id, 'client');
      } catch (error) {
        showToast(error.message, true);
        setBusy(clientResponse, false);
      }
    }
    const memberSave = event.target.closest('[data-member-save]');
    if (memberSave) {
      event.preventDefault();
      const memberId = memberSave.dataset.memberSave;
      const role = $(`[data-member-role="${memberId}"]`)?.value;
      if (!role) return;
      setBusy(memberSave, true);
      try {
        await api(`/api/organizations/${state.organization.id}/members/${memberId}`, {
          method: 'PATCH', body: JSON.stringify({ role }),
        });
        showToast('成员角色已更新');
        await loadOrganization(state.organization.id, 'members');
      } catch (error) {
        showToast(error.message, true);
        setBusy(memberSave, false);
      }
    }
    const memberPermissionsSave = event.target.closest('[data-member-permissions-save]');
    if (memberPermissionsSave) {
      event.preventDefault();
      event.stopPropagation();
      const memberId = memberPermissionsSave.dataset.memberPermissionsSave;
      const modulePermissions = $$(`[data-member-module="${memberId}"]:checked`).map((input) => input.value);
      const actionPermissions = $$(`[data-member-action="${memberId}"]:checked`).map((input) => input.value);
      if (modulePermissions.includes('finance')) actionPermissions.push('finance.view');
      if (modulePermissions.includes('costs')) actionPermissions.push('cost.view', 'procurement.view');
      if (modulePermissions.includes('execution')) actionPermissions.push('quality.view');
      const normalizedActionPermissions = [...new Set(actionPermissions)];
      if (!confirm(`确认保存该成员权限？可见大项：${modulePermissions.map((module) => projectModuleLabels[module]).join('、') || '全部关闭'}；关键操作 ${normalizedActionPermissions.length} 项。`)) return;
      setBusy(memberPermissionsSave, true);
      try {
        await api(`/api/organizations/${state.organization.id}/members/${memberId}`, {
          method: 'PATCH', body: JSON.stringify({ modulePermissions, actionPermissions: normalizedActionPermissions }),
        });
        showToast('成员可见范围和操作权限已同步到网站和小程序');
        await loadOrganization(state.organization.id, 'members');
      } catch (error) {
        showToast(error.message, true);
        setBusy(memberPermissionsSave, false);
      }
    }
    const memberStatus = event.target.closest('[data-member-status]');
    if (memberStatus) {
      event.preventDefault();
      const actionText = memberStatus.dataset.nextStatus === 'disabled' ? '停用' : '恢复';
      if (!confirm(`确认${actionText}该成员在本企业的权限？成员个人版不受影响。`)) return;
      setBusy(memberStatus, true);
      try {
        await api(`/api/organizations/${state.organization.id}/members/${memberStatus.dataset.memberStatus}`, {
          method: 'PATCH', body: JSON.stringify({ status: memberStatus.dataset.nextStatus }),
        });
        showToast(`成员企业权限已${actionText}`);
        await loadOrganization(state.organization.id, 'members');
      } catch (error) {
        showToast(error.message, true);
        setBusy(memberStatus, false);
      }
    }
    const ownerTransfer = event.target.closest('[data-owner-transfer]');
    if (ownerTransfer) {
      event.preventDefault();
      const memberName = ownerTransfer.dataset.memberName || '该成员';
      if (!confirm(`确认把企业负责人移交给“${memberName}”？移交后你将变为企业管理员，企业项目与个人版数据都不会转移或删除。`)) return;
      setBusy(ownerTransfer, true);
      try {
        await api(`/api/organizations/${state.organization.id}/owner-transfer`, {
          method: 'POST', body: JSON.stringify({ memberId: ownerTransfer.dataset.ownerTransfer }),
        });
        showToast('企业负责人已移交');
        await loadOrganization(state.organization.id, 'members');
      } catch (error) {
        showToast(error.message, true);
        setBusy(ownerTransfer, false);
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    const card = event.target.closest?.('article[role="link"][data-project-id]');
    if (card && event.target === card && event.key === 'Enter') {
      event.preventDefault();
      openProject(card.dataset.projectId, card.dataset.projectTabTarget || state.projectIntent || 'overview', { focusTargetId: card.dataset.projectFocusId || '' });
    }
  });

  $('#backToProjects').addEventListener('click', () => {
    if (['assets', 'photos', 'issues', 'tasks', 'client', 'operations'].includes(state.projectReturnNav)) {
      const view = state.projectReturnNav === 'client' ? 'clients' : state.projectReturnNav === 'assets' ? 'photos' : state.projectReturnNav;
      showView(view, state.projectReturnNav === 'photos' ? 'assets' : state.projectReturnNav);
      return;
    }
    showProjectDirectory(state.projectIntent, directoryConfig[state.projectIntent]?.nav);
  });
  $('#workspaceSelect').addEventListener('change', (event) => {
    if (event.target.value === 'personal') location.href = 'home.html';
    else loadOrganization(event.target.value).catch((error) => showToast(error.message, true));
  });

  $('#reportBrandingForm').addEventListener('input', renderReportStylePreview);
  $('#reportBrandingForm').addEventListener('change', (event) => {
    if (event.target.id !== 'reportLogoInput') return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      event.target.value = '';
      showToast('公司 Logo 请控制在 3MB 以内', true);
      return;
    }
    if (state.reportLogoPreviewUrl) URL.revokeObjectURL(state.reportLogoPreviewUrl);
    state.reportLogoPreviewUrl = URL.createObjectURL(file);
    event.currentTarget.elements.brandMode.value = 'logo';
    renderReportStylePreview();
  });
  $('#reportBrandingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveReportBrandingForm(event.currentTarget);
  });
  $('#reportBrandingSettingsForm').addEventListener('input', renderReportSettingsPreview);
  $('#reportBrandingSettingsForm').addEventListener('change', (event) => {
    renderReportSettingsPreview();
    if (event.target.id !== 'reportSettingsLogoInput') return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      event.target.value = '';
      showToast('公司 Logo 请控制在 3MB 以内', true);
      return;
    }
    if (state.reportSettingsLogoPreviewUrl) URL.revokeObjectURL(state.reportSettingsLogoPreviewUrl);
    state.reportSettingsLogoPreviewUrl = URL.createObjectURL(file);
    event.currentTarget.elements.brandMode.value = 'logo';
    $('#reportSettingsLogoHint').textContent = `已选择 ${file.name}，保存后将替换当前公司 Logo。`;
    renderReportSettingsPreview();
  });
  $('#reportBrandingSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveReportBrandingForm(event.currentTarget);
  });

  $('#organizationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', event.currentTarget);
    setBusy(button, true);
    try {
      const payload = await api('/api/organizations', {
        method: 'POST', body: JSON.stringify({ name: event.currentTarget.elements.name.value.trim() }),
      });
      state.workspaces.push(payload.organization);
      renderWorkspaceSelect();
      await loadOrganization(payload.organization.id);
      showToast('企业空间已创建');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#projectForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (projectWizardStep !== 3) { setProjectWizardStep(projectWizardStep + 1); return; }
    if (!wizardStepIsValid(3)) return;
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const nodes = constructionPlanNodes($('#projectWizardPlanList'), false);
    const paymentRows = $$('[data-wizard-payment-row]', $('#projectWizardPaymentList'));
    const contractAmount = Number(data.contractAmount || 0);
    const calculationMode = data.wizardCalculationMode || 'percentage';
    let createdProject = null;
    setBusy(button, true, '正在创建项目…');
    try {
      const payload = {
        ...data,
        stage: '待制定施工计划',
        area: Number(data.area || 0),
        costBudget: Number(data.costBudget || 0),
        contractAmount: Number(data.contractAmount || 0),
        contractNo: data.contractNo || '',
        signedMonth: data.signedMonth || '',
        depositAmount: Number(data.depositAmount || 0),
        plannedProgress: 0,
        actualProgress: 0,
        plannedDate: null,
        nextAction: '',
        designerMemberId: data.designerMemberId || null,
        siteManagerMemberId: data.siteManagerMemberId || null,
      };
      const result = await api(`/api/organizations/${state.organization.id}/projects`, { method: 'POST', body: JSON.stringify(payload) });
      createdProject = result.project;
      setBusy(button, true, '正在生成施工计划…');
      const savedPlan = await api(`/api/organizations/${state.organization.id}/projects/${createdProject.id}/construction-plan`, {
        method: 'PUT', body: JSON.stringify({ startDate: $('#projectWizardStartDate').value, nodes }),
      });
      setBusy(button, true, '正在保存收款计划…');
      if (contractAmount > 0 && paymentRows.length) {
        const paymentNodes = paymentRows.map((row, index) => {
          const milestoneIndex = Number(row.dataset.milestoneIndex ?? Math.min(index * 2, savedPlan.milestones.length - 1));
          const milestone = savedPlan.milestones[Math.max(0, Math.min(milestoneIndex, savedPlan.milestones.length - 1))];
          return ({
          name: $('[data-wizard-payment-name]', row).value.trim(),
          milestoneId: milestone?.id || null,
          paymentPercent: calculationMode !== 'amount' ? roundPaymentPercent($('[data-wizard-payment-percent]', row).value) : null,
          amount: calculationMode !== 'percentage' ? Number($('[data-wizard-payment-custom-amount]', row).value || 0) : null,
          paymentGroup: calculationMode === 'split' ? $('[data-wizard-payment-group]', row).value : 'overall',
          dueDate: $('[data-wizard-payment-date]', row).value,
          note: calculationMode === 'split' ? '按人辅 / 主材分组创建' : (calculationMode === 'amount' ? '按自定义金额创建' : `合同占比 ${Number($('[data-wizard-payment-percent]', row).value || 0)}%`),
          });
        });
        await api(`/api/organizations/${state.organization.id}/projects/${createdProject.id}/payment-plan`, {
          method: 'PUT', body: JSON.stringify({
            calculationMode,
            laborAuxiliaryAmount: Number(data.wizardLaborAuxiliaryAmount || 0),
            mainMaterialAmount: Number(data.wizardMainMaterialAmount || 0),
            laborAuxiliaryMode: data.wizardLaborAuxiliaryMode || 'percentage',
            mainMaterialMode: data.wizardMainMaterialMode || 'percentage',
            nodes: paymentNodes,
          }),
        });
      }
      $('#projectDialog').close();
      await loadOrganization(state.organization.id);
      await openProject(createdProject.id, 'overview');
      showToast('项目、施工计划和收款计划已一次创建完成');
    } catch (error) {
      if (createdProject) {
        $('#projectDialog').close();
        await loadOrganization(state.organization.id).catch(() => {});
        await openProject(createdProject.id, 'overview').catch(() => {});
        showToast(`项目已创建，但计划保存未完成：${error.message}。可在项目内继续补充。`, true);
      } else showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });
  $('#retryEnterprise').addEventListener('click', () => init());

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-upload-files]')) renderUploadPreview(event.target);
    if (event.target.matches('[data-client-upload-index]')) {
      const form = event.target.closest('form');
      const file = Array.from(form?.elements?.photos?.files || [])[Number(event.target.dataset.clientUploadIndex)];
      if (file) {
        if (event.target.checked) clientSyncFiles.add(file);
        else clientSyncFiles.delete(file);
      }
      updateLogClientSyncSelectionState(form);
    }
    if (event.target.matches('[data-client-media-id]')) updateLogClientSyncSelectionState(event.target.closest('form'));
    if (event.target.matches('#costEntryType')) updateCostFormMode();
    if (event.target.matches('#costMilestoneSelect')) syncCostDateFromMilestone();
    if (event.target.matches('#materialForm [name="paymentStatus"]')) syncMaterialPaymentFields();
    if (event.target.matches('[data-member-role]')) {
      const memberId = event.target.dataset.memberRole;
      const saveButton = $(`[data-member-save="${CSS.escape(memberId)}"]`);
      if (!saveButton) return;
      const changed = event.target.value !== event.target.dataset.originalRole;
      saveButton.disabled = !changed;
      saveButton.textContent = changed ? '保存角色调整' : '角色未更改';
    }
  });

  $('#materialForm').elements.purchaseAmount.addEventListener('input', syncMaterialPaymentFields);
  $('#materialForm').elements.paidAmount.addEventListener('input', syncMaterialPaymentFields);

  document.addEventListener('dragstart', (event) => {
    const handle = event.target.closest?.('[data-node-drag]');
    if (!handle || handle.getAttribute('draggable') !== 'true') return;
    const node = handle.closest('[data-milestone-node]');
    if (!node) return;
    draggedMilestoneId = node.dataset.milestoneNode;
    node.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedMilestoneId);
  });

  document.addEventListener('dragover', (event) => {
    if (!draggedMilestoneId) return;
    const target = event.target.closest?.('[data-milestone-node]');
    if (!target || target.dataset.milestoneNode === draggedMilestoneId) return;
    event.preventDefault();
    $$('[data-milestone-node]').forEach((node) => node.classList.remove('drag-before', 'drag-after'));
    const rect = target.getBoundingClientRect();
    target.classList.add(event.clientY < rect.top + rect.height / 2 ? 'drag-before' : 'drag-after');
    event.dataTransfer.dropEffect = 'move';
  });

  document.addEventListener('drop', async (event) => {
    if (!draggedMilestoneId) return;
    const target = event.target.closest?.('[data-milestone-node]');
    const timeline = $('#constructionTimeline');
    const dragged = timeline?.querySelector(`[data-milestone-node="${CSS.escape(draggedMilestoneId)}"]`);
    if (!target || !dragged || target === dragged || !timeline?.contains(target)) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const insertBefore = event.clientY < rect.top + rect.height / 2;
    timeline.insertBefore(dragged, insertBefore ? target : target.nextElementSibling);
    $$('[data-milestone-node]').forEach((node) => node.classList.remove('dragging', 'drag-before', 'drag-after'));
    draggedMilestoneId = null;
    updateTimelineOrderUi();
    try {
      await persistMilestoneOrder(timelineMilestoneIds());
    } catch (error) {
      showToast(error.message, true);
      await refreshProject('overview');
    }
  });

  document.addEventListener('dragend', () => {
    $$('[data-milestone-node]').forEach((node) => node.classList.remove('dragging', 'drag-before', 'drag-after'));
    draggedMilestoneId = null;
  });

  $('#projectEditForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    setBusy(button, true, '正在保存…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...data,
          area: Number(data.area || 0),
          plannedDate: state.project.plannedDate || null,
          nextAction: state.project.nextAction || '',
          designerMemberId: data.designerMemberId || null,
          siteManagerMemberId: data.siteManagerMemberId || null,
          costBudget: Number(data.costBudget || 0),
          contractAmount: Number(data.contractAmount || 0),
          contractNo: data.contractNo || '',
          signedMonth: data.signedMonth || '',
          depositAmount: Number(data.depositAmount || 0),
        }),
      });
      $('#projectEditDialog').close();
      showToast('项目资料已更新');
      await refreshProject('overview');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#costForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const costPlanId = form.dataset.costPlanId || '';
    setBusy(button, true, '正在保存…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/cost-plans${costPlanId ? `/${costPlanId}` : ''}`, {
        method: costPlanId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          milestoneId: data.entryType === 'group' ? null : (data.milestoneId || null),
          parentId: data.entryType === 'group' ? null : (data.parentId || null),
          isGroup: data.entryType === 'group',
          category: data.category,
          title: data.title.trim(),
          plannedAmount: Number(data.plannedAmount),
          plannedDate: data.entryType === 'group' ? null : data.plannedDate,
          vendor: data.entryType === 'group' ? '' : data.vendor.trim(),
          description: data.description.trim(),
        }),
      });
      form.reset();
      delete form.dataset.costPlanId;
      $('#costDialog').close();
      showToast(costPlanId ? '支出计划已更新' : (data.entryType === 'group' ? '费用总项已创建，可继续增加阶段分项' : '支出分项已加入计划'));
      await refreshProject('costs');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#paymentForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = $('button[type="submit"]', form); const data = formObject(form); setBusy(button, true, '正在保存…');
    try { await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/payments`, { method: 'POST', body: JSON.stringify({ name: data.name.trim(), amount: Number(data.amount), dueDate: data.dueDate, status: data.status, receivedDate: null, note: data.note.trim() }) }); form.reset(); $('#paymentDialog').close(); showToast('收款节点已添加'); await refreshProject('overview'); } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });

  $('#paymentPlanList').addEventListener('input', updatePaymentPlanEditor);
  $('#paymentPlanList').addEventListener('change', updatePaymentPlanEditor);
  $('#paymentPlanSplitSettings').addEventListener('input', updatePaymentPlanEditor);
  $('#paymentPlanSplitSettings').addEventListener('change', updatePaymentPlanEditor);
  $$('input[name="calculationMode"]', $('#paymentPlanForm')).forEach((input) => input.addEventListener('change', updatePaymentPlanEditor));
  $('#paymentPlanForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const button = $('button[type="submit"]', form);
    const calculationMode = form.elements.calculationMode.value || 'percentage';
    const nodes = $$('[data-payment-plan-row]', $('#paymentPlanList')).map((row) => ({
      id: row.dataset.paymentId || null,
      changeOrderId: row.dataset.changeOrderId || null,
      milestoneId: $('[data-payment-plan-milestone]', row)?.value || null,
      name: $('[data-payment-plan-name]', row).value.trim(),
      paymentPercent: roundPaymentPercent($('[data-payment-plan-percent]', row).value),
      amount: Number($('[data-payment-plan-amount]', row).value || 0),
      paymentGroup: calculationMode === 'split' ? $('[data-payment-plan-group]', row).value : 'overall',
      dueDate: $('[data-payment-plan-date]', row).value,
      note: '',
    }));
    const percentTotal = nodes.reduce((sum, node) => sum + node.paymentPercent, 0);
    const amountTotal = nodes.reduce((sum, node) => sum + node.amount, 0);
    const adjustedContractAmount = Number(state.projectDetail?.business?.adjustedContractAmount ?? state.project?.contractAmount ?? 0);
    const expectedAmount = Math.max(0, adjustedContractAmount - Number(state.project?.depositAmount || 0));
    if (nodes.some((node) => !node.name || !node.dueDate)) return showToast('请完整填写每个收款节点', true);
    if (calculationMode === 'percentage' && Math.abs(percentTotal - 100) > .001) return showToast('收款比例合计必须为 100%，请先重新分配', true);
    if (calculationMode === 'amount' && Math.abs(amountTotal - expectedAmount) > .005) return showToast(`自定义金额合计应为 ${formatMoney(expectedAmount)}`, true);
    const splitConfig = {
      laborAuxiliaryAmount: Number(form.elements.laborAuxiliaryAmount.value || 0),
      mainMaterialAmount: Number(form.elements.mainMaterialAmount.value || 0),
      laborAuxiliaryMode: form.elements.laborAuxiliaryMode.value || 'percentage',
      mainMaterialMode: form.elements.mainMaterialMode.value || 'percentage',
    };
    if (calculationMode === 'split') {
      const contractAmount = adjustedContractAmount;
      const depositAmount = Number(state.project?.depositAmount || 0);
      if (Math.abs(splitConfig.laborAuxiliaryAmount + splitConfig.mainMaterialAmount - contractAmount) > .005) return showToast('人辅金额与主材金额合计必须等于合同总额', true);
      if (depositAmount > splitConfig.laborAuxiliaryAmount) return showToast('已收定金不能大于人辅合同金额', true);
      const configs = {
        labor_auxiliary: { name: '人辅', base: splitConfig.laborAuxiliaryAmount, deposit: depositAmount, mode: splitConfig.laborAuxiliaryMode },
        main_material: { name: '主材', base: splitConfig.mainMaterialAmount, deposit: 0, mode: splitConfig.mainMaterialMode },
      };
      for (const [group, config] of Object.entries(configs)) {
        const groupNodes = nodes.filter((node) => node.paymentGroup === group);
        if (config.base > 0 && !groupNodes.length) return showToast(`请至少添加一个${config.name}收款节点`, true);
        const total = groupNodes.reduce((sum, node) => sum + Number(config.mode === 'percentage' ? node.paymentPercent : node.amount), 0);
        const expected = config.mode === 'percentage' ? 100 : Math.max(0, config.base - config.deposit);
        if (Math.abs(total - expected) > (config.mode === 'percentage' ? .001 : .005)) return showToast(`${config.name}${config.mode === 'percentage' ? '比例合计必须为 100%' : `自定义金额合计应为 ${formatMoney(expected)}`}`, true);
      }
    }
    setBusy(button, true, '正在核对并保存…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/payment-plan`, { method: 'PUT', body: JSON.stringify({ calculationMode, ...splitConfig, nodes }) });
      $('#paymentPlanDialog').close(); showToast(calculationMode === 'split' ? '人辅 / 主材分组收款计划已保存' : (calculationMode === 'amount' ? '自定义金额收款计划已保存' : '比例收款计划已重算保存')); await refreshProject('overview');
    } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });

  $('#paymentReceiptForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const button = $('button[type="submit"]', form); const data = formObject(form);
    setBusy(button, true, '正在登记到账…');
    try {
      const mediaIds = await uploadFiles(form.elements.photos.files);
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/payments/${data.paymentPlanId}/receipts`, {
        method: 'POST', body: JSON.stringify({ amount: Number(data.amount), receivedDate: data.receivedDate, method: data.method, reference: data.reference.trim(), note: data.note.trim(), mediaIds }),
      });
      form.reset(); $('#paymentReceiptDialog').close(); showToast('到账记录和收款凭证已保存'); await refreshProject('overview');
    } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });

  $('#changeOrderForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = $('button[type="submit"]', form); const data = formObject(form); setBusy(button, true, '正在保存…');
    try { const mediaIds = await uploadFiles(form.elements.photos.files); await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/change-orders`, { method: 'POST', body: JSON.stringify({ title: data.title.trim(), kind: data.kind, amount: Number(data.amount), status: data.status, note: data.note.trim(), customerConfirmed: form.elements.customerConfirmed.checked, scheduleImpactDays: Number(data.scheduleImpactDays || 0), confirmationNote: data.confirmationNote.trim(), mediaIds }) }); form.reset(); $('#changeOrderDialog').close(); showToast('合同增减项及确认依据已添加'); await refreshProject('overview'); } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });

  $('#materialForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = $('button[type="submit"]', form); const data = formObject(form); setBusy(button, true, '正在保存…');
    try {
      const materialId = form.dataset.materialId || '';
      const existing = materialId ? state.projectDetail.materials?.items?.find((item) => item.id === materialId) : null;
      const uploadedMediaIds = await uploadFiles(form.elements.photos.files);
      const mediaIds = [...new Set([...(existing?.media || []).map((media) => media.id), ...uploadedMediaIds])];
      const payload = {
        milestoneId: data.milestoneId || null,
        costGroupId: data.costGroupId || null,
        name: data.name.trim(), supplierId: data.supplierId || existing?.supplierId || null,
        supplier: data.supplier.trim(), supplierPhone: data.supplierPhone.trim(),
        purchaserMemberId: data.purchaserMemberId || null,
        purchaseAmount: Number(data.purchaseAmount || 0), paidAmount: Number(data.paidAmount || 0), paidDate: data.paidDate || null, paymentStatus: data.paymentStatus,
        quantity: Number(data.quantity), unit: data.unit.trim(), status: data.status, manufacturerStatus: data.manufacturerStatus,
        manufacturerStatusNote: data.manufacturerStatus === 'other' ? (data.manufacturerStatusNote || data.note || '').trim() : '',
        plannedArrivalDate: data.plannedArrivalDate,
        actualArrivalDate: ['arrived','accepted'].includes(data.status) ? (existing?.actualArrivalDate || localDateValue()) : null,
        delayReason: data.delayReason.trim(), note: data.note.trim(), mediaIds,
        expectedVersion: existing?.version ?? null, expectedUpdatedAt: existing?.updatedAt || null,
      };
      if (payload.manufacturerStatus === 'other' && !payload.manufacturerStatusNote) throw new Error('选择“例外 / 不适用”时必须填写说明');
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials${materialId ? `/${materialId}` : ''}`, { method: materialId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      form.reset(); delete form.dataset.materialId; $('#materialDialog').close();
      showToast(materialId ? '材料付款和项目成本已同步更新' : '材料与厂家调配已添加并同步项目成本');
      await refreshProject('overview');
    } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });

  $('#materialPaymentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const item = state.projectDetail.materials?.items?.find((row) => row.id === data.materialId);
    if (!item) return showToast('材料记录不存在，请刷新后重试', true);
    const outstanding = Math.max(0, Number(item.purchaseAmount || 0) - Number(item.paidAmount || 0));
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) return showToast('付款金额必须大于 0 且不能超过待付金额', true);
    setBusy(button, true, '确认中…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials/${item.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, paidDate: data.paidDate, method: data.method, reference: data.reference.trim(), note: data.note.trim() }),
      });
      form.reset();
      $('#materialPaymentDialog').close();
      showToast('支出已确认，实际支出日期和金额已同步计入项目成本');
      await refreshProject('costs');
    } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });

  $('#materialBatchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const ids = (form.dataset.materialIds || '').split(',').filter(Boolean);
    const nextStatus = form.elements.status.value;
    if (!ids.length) return showToast('没有可更新的材料记录', true);
    setBusy(button, true, '批量保存中…');
    try {
      for (const id of ids) {
        const item = state.projectDetail.materials?.items?.find((row) => row.id === id);
        if (!item) continue;
        const linkedManufacturer = nextStatus === 'ordered' && item.manufacturerStatus === 'unordered' ? 'ordered'
          : ['arrived', 'accepted'].includes(nextStatus) && ['unordered', 'measured', 'ordered'].includes(item.manufacturerStatus) ? 'arrived' : item.manufacturerStatus;
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/materials/${id}`, {
          method: 'PATCH', body: JSON.stringify(materialUpdatePayload(item, {
            status: nextStatus, manufacturerStatus: linkedManufacturer,
            actualArrivalDate: ['arrived', 'accepted'].includes(nextStatus) ? (item.actualArrivalDate || localDateValue()) : null,
          })),
        });
      }
      $('#materialBatchDialog').close(); delete form.dataset.materialIds;
      showToast(`已批量更新 ${ids.length} 条材料状态`);
      await refreshProject('costs');
    } catch (error) { showToast(error.message, true); }
    finally { setBusy(button, false); }
  });

  $('#supplierForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const supplierId = form.dataset.supplierId || '';
    const contactText = data.supplierContact.trim();
    const phoneMatch = contactText.match(/(?:^|\s|\/)(1\d{10}|0\d{2,3}[-\s]?\d{7,8}|\d{3,4}[-\s]\d{6,8})$/);
    const phone = phoneMatch?.[1] || '';
    const contactName = phone ? contactText.slice(0, phoneMatch.index).replace(/[\s/]+$/, '') : contactText;
    setBusy(button, true, '正在保存…');
    try {
      await api(`/api/organizations/${state.organization.id}/suppliers${supplierId ? `/${supplierId}` : ''}`, {
        method: supplierId ? 'PATCH' : 'POST', body: JSON.stringify({
          name: data.supplierName.trim(), contactName, phone,
          category: data.supplierCategories.trim(), note: data.supplierNote.trim(), status: 'active',
        }),
      });
      form.reset(); delete form.dataset.supplierId;
      state.supplierDirectory = await api(`/api/organizations/${state.organization.id}/suppliers`);
      renderSupplierDirectory();
      showToast(supplierId ? '厂家档案已更新' : '厂家档案已创建');
    } catch (error) { showToast(error.message, true); }
    finally { setBusy(button, false); }
  });

  $('#businessReportForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    setBusy(button, true, '正在生成…');
    try { await loadBusinessReport(data.reportScope, data.reportPeriod); }
    catch (error) { $('#businessReportContent').innerHTML = `<div class="empty-state"><b>经营报表生成失败</b><p>${esc(error.message)}</p></div>`; }
    finally { setBusy(button, false); }
  });

  $('#milestoneForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    setBusy(button, true, '正在添加…');
    try {
      const result = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name.trim(),
          stage: data.name.trim(),
          plannedFinishDate: null,
          durationDays: Number(data.durationDays || 1),
          requiredPhotoCount: Number(data.requiredPhotoCount || 0),
          note: data.note.trim(),
        }),
      });
      form.reset();
      $('#milestoneDialog').close();
      showToast('自定义施工节点已添加');
      await refreshProject('overview');
      const createdNode = $(`[data-milestone-node="${result.milestone.id}"]`);
      if (createdNode) createdNode.open = true;
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#logMilestoneSelect').addEventListener('change', (event) => {
    const milestone = (state.projectDetail.milestones || []).find((item) => item.id === event.target.value);
    if (milestone) selectLogMilestone(milestone, { allowSwitch: true, source: 'manual' });
  });
  $('#logForm').elements.clientAfterReview.addEventListener('change', (event) => {
    const form = event.target.form;
    const checked = event.target.checked;
    logClientChoiceInputs(form).forEach((choice) => {
      choice.checked = checked;
      if (choice.dataset.clientUploadIndex !== undefined) {
        const file = Array.from(form.elements.photos.files || [])[Number(choice.dataset.clientUploadIndex)];
        if (file) {
          if (checked) clientSyncFiles.add(file);
          else clientSyncFiles.delete(file);
        }
      }
    });
    updateLogClientSyncSelectionState(form);
  });

  $('#logForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const milestoneId = data.milestoneId || form.dataset.milestoneId || '';
    const logId = form.dataset.logId || '';
    const logMode = form.dataset.logMode || (logId ? 'edit' : 'create');
    if (!milestoneId) return showToast('请选择施工节点', true);
    if (logMode === 'append' && !form.elements.photos.files?.length) return showToast('请先选择需要追加的照片', true);
    const selectedExistingMediaIds = selectedExistingClientMediaIds(form);
    const selectedUploadIndexes = selectedUploadClientIndexes(form);
    setBusy(button, true, logMode === 'append' ? '正在追加…' : logId ? '正在保存…' : '正在上传…');
    try {
      let result;
      if (logId) {
        const log = (state.projectDetail.siteLogs || []).find((item) => item.id === logId);
        const currentCount = Number(log?.media?.length || 0);
        const appendMediaIds = logMode === 'append'
          ? await uploadFiles(form.elements.photos.files, Math.min(50, Math.max(0, 100 - currentCount)))
          : [];
        const clientMediaIds = [
          ...selectedExistingMediaIds,
          ...appendMediaIds.filter((_, index) => selectedUploadIndexes.includes(index)),
        ];
        result = await api(`/api/organizations/${state.organization.id}/site-logs/${logId}`, {
          method: 'PATCH', body: JSON.stringify({
            milestoneId,
            summary: logMode === 'append' ? (log?.summary || '') : data.summary,
            occurredAt: new Date(logMode === 'append' ? (log?.createdAt || new Date()) : data.occurredAt).toISOString(),
            visibility: clientMediaIds.length ? 'client_after_review' : 'internal',
            appendMediaIds,
            clientMediaIds,
          }),
        });
      } else {
        const mediaIds = await uploadFiles(form.elements.photos.files, 50);
        const clientMediaIds = mediaIds.filter((_, index) => selectedUploadIndexes.includes(index));
        result = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/site-logs`, {
          method: 'POST',
          body: JSON.stringify({ milestoneId, stage: '', progress: Number(state.project.actualProgress || 0), summary: data.summary, occurredAt: new Date(data.occurredAt).toISOString(), visibility: clientMediaIds.length ? 'client_after_review' : 'internal', mediaIds, clientMediaIds }),
        });
      }
      form.reset();
      delete form.dataset.milestoneId;
      delete form.dataset.logId;
      delete form.dataset.logMode;
      $('#logDialog').close();
      const status = result.siteLog?.reviewStatus;
      showToast(logMode === 'append' ? `照片已并入原记录，共 ${result.siteLog?.media?.length || 0} 张` : logId ? '现场日志已更新' : status === 'published'
        ? '现场记录已一次提交、审核并发布给客户'
        : status === 'approved'
          ? '现场记录已保存为企业内部内容'
          : '现场记录已提交，等待项目总负责人审核');
      await refreshProject(milestoneId ? 'overview' : 'logs');
      const updatedNode = milestoneId ? $(`[data-milestone-node="${milestoneId}"]`) : null;
      if (updatedNode) updatedNode.open = true;
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#checklistItemForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const itemId = data.itemId || '';
    setBusy(button, true, '保存中…');
    try {
      const body = { title: data.title, note: data.note || '', required: form.elements.required.checked };
      await api(itemId
        ? `/api/organizations/${state.organization.id}/projects/${state.project.id}/checklist/${itemId}`
        : `/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${data.milestoneId}/checklist`, {
        method: itemId ? 'PATCH' : 'POST', body: JSON.stringify(body),
      });
      $('#checklistItemDialog').close();
      showToast(itemId ? '必检项已更新' : '必检项已添加到当前节点');
      await refreshProject('overview');
      const node = $(`[data-milestone-node="${CSS.escape(data.milestoneId)}"]`);
      if (node) node.open = true;
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#checklistTemplateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const stages = collectChecklistTemplate();
    if (!stages.length) return showToast('企业模板至少需要一个施工阶段', true);
    if (stages.some((stage) => !stage.milestoneName || !stage.items.length || stage.items.some((item) => !item.title))) return showToast('请完整填写阶段名称和必检项名称', true);
    setBusy(button, true, '保存中…');
    try {
      const result = await api(`/api/organizations/${state.organization.id}/checklist-template`, {
        method: 'PUT', body: JSON.stringify({ name: form.elements.name.value.trim(), stages }),
      });
      state.checklistTemplate = result.template;
      $('#checklistTemplateDialog').close();
      showToast('企业必检项模板已保存，新建项目会自动带入');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#issueForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const issueId = form.dataset.issueId || '';
    const checklistIssueId = !issueId ? pendingChecklistIssueId : '';
    setBusy(button, true, issueId ? '正在保存…' : '正在创建…');
    try {
      if (issueId) {
        await api(`/api/organizations/${state.organization.id}/issues/${issueId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'edit',
            title: data.title,
            description: data.description,
            priority: data.priority,
            ownerMemberId: data.ownerMemberId,
            dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
            siteLogId: data.siteLogId || null,
            milestoneId: data.milestoneId || null,
          }),
        });
      } else {
        const mediaIds = await uploadFiles(form.elements.photos.files);
        await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/issues`, {
          method: 'POST',
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            priority: data.priority,
            ownerMemberId: data.ownerMemberId,
            dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
            siteLogId: data.siteLogId || null,
            milestoneId: data.milestoneId || null,
            checklistItemId: checklistIssueId || null,
            occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
            mediaIds,
          }),
        });
      }
      form.reset();
      delete form.dataset.issueId;
      pendingChecklistIssueId = '';
      $('#issueDialog').close();
      showToast(issueId ? '整改问题已更新' : checklistIssueId ? '整改已创建，必检项已同步标记为不通过' : '整改问题已创建');
      await refreshProject(data.milestoneId ? 'overview' : 'issues');
      const updatedNode = data.milestoneId ? $(`[data-milestone-node="${data.milestoneId}"]`) : null;
      if (updatedNode) updatedNode.open = true;
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#projectWizardNext').addEventListener('click', () => {
    if (wizardStepIsValid(projectWizardStep)) setProjectWizardStep(projectWizardStep + 1);
  });
  $('#projectWizardPrev').addEventListener('click', () => setProjectWizardStep(projectWizardStep - 1));
  $$('[data-project-wizard-step]').forEach((button) => button.addEventListener('click', () => {
    const next = Number(button.dataset.projectWizardStep);
    if (next <= projectWizardStep || wizardStepIsValid(projectWizardStep)) setProjectWizardStep(next);
  }));
  $('#projectForm').addEventListener('input', (event) => {
    if (event.target.matches('input, select, textarea') && event.target.checkValidity()) {
      clearProjectWizardErrors(event.target);
      if (!$('#projectForm label.has-error')) {
        $('#projectWizardErrorSummary').textContent = '';
        $('#projectWizardErrorSummary').classList.add('hidden');
      }
    }
  });
  $('#projectForm').addEventListener('change', (event) => {
    if (event.target.matches('input, select, textarea') && event.target.checkValidity()) {
      clearProjectWizardErrors(event.target);
      if (!$('#projectForm label.has-error')) {
        $('#projectWizardErrorSummary').textContent = '';
        $('#projectWizardErrorSummary').classList.add('hidden');
      }
    }
  });
  $('#projectWizardPlanList').addEventListener('input', (event) => {
    const row = event.target.closest('[data-plan-row]');
    const rowIndex = row ? $$('[data-plan-row]', $('#projectWizardPlanList')).indexOf(row) : -1;
    const cascadeFromIndex = event.target.matches('[data-plan-duration], [data-plan-start]') && rowIndex >= 0 ? rowIndex + 1 : null;
    updateProjectWizardPlanPreview({ cascadeFromIndex });
    recalculateProjectWizardPaymentDates();
  });

  $('#checklistImportForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const button = $('button[type="submit"]', form);
    setBusy(button, true, '正在导入…');
    try {
      const result = await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${data.milestoneId}/checklist/import-template`, {
        method: 'POST', body: JSON.stringify({ milestoneName: data.milestoneName }),
      });
      $('#checklistImportDialog').close();
      showToast(result.importedCount ? `已导入 ${result.importedCount} 项必检项` : '同名必检项已存在，无需重复导入');
      await refreshProject('overview');
      const node = $(`[data-milestone-node="${CSS.escape(data.milestoneId)}"]`);
      if (node) node.open = true;
    } catch (error) { showToast(error.message, true); }
    finally { setBusy(button, false); }
  });

  $('#costConfirmForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const button = $('button[type="submit"]', form);
    setBusy(button, true, '正在确认…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/cost-plans/${data.planId}/confirm`, {
        method: 'PATCH', body: JSON.stringify({ actualAmount: Number(data.actualAmount), actualDate: data.actualDate }),
      });
      $('#costConfirmDialog').close();
      showToast('实际支出已确认，当前账面毛利已更新');
      await refreshProject('overview');
    } catch (error) { showToast(error.message, true); }
    finally { setBusy(button, false); }
  });

  $('#costStatementItems').addEventListener('change', (event) => {
    if (event.target.matches('[data-cost-statement-item]')) updateCostStatementSelection();
  });
  $('#costStatementSelectAll').addEventListener('change', (event) => {
    $$('[data-cost-statement-item]', $('#costStatementItems')).forEach((input) => { input.checked = event.target.checked; });
    updateCostStatementSelection();
  });
  $('#costStatementForm').addEventListener('submit', (event) => {
    event.preventDefault();
    openCostStatementPdf(false);
  });

  $('#milestoneReportExportForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const params = new URLSearchParams({ actualFinishedAt: data.actualFinishedAt });
    params.set('deliveryDate', data.deliveryDate);
    if (data.preview === 'true') params.set('preview', 'true');
    params.set('includeIssueRecords', String(form.elements.includeIssueRecords.checked));
    params.set('includeCustomerSyncRecords', String(form.elements.includeCustomerSyncRecords.checked));
    params.set('refresh', String(Date.now()));
    const url = `/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${data.milestoneId}/acceptance-report.pdf?${params}`;
    $('#milestoneReportExportDialog').close();
    window.open(url, '_blank', 'noopener');
  });
  $('#projectWizardStartDate').addEventListener('change', () => {
    updateProjectWizardPlanPreview({ cascadeFromIndex: 0 });
    recalculateProjectWizardPaymentDates();
  });
  $('#projectWizardPaymentList').addEventListener('input', () => updateProjectWizardPayments(false));
  $('#projectWizardPaymentList').addEventListener('change', () => updateProjectWizardPayments(false));
  $('#projectWizardPaymentSplitSettings').addEventListener('input', () => updateProjectWizardPayments(false));
  $('#projectWizardPaymentSplitSettings').addEventListener('change', () => updateProjectWizardPayments(false));
  $$('input[name="wizardCalculationMode"]', $('#projectForm')).forEach((input) => input.addEventListener('change', () => updateProjectWizardPayments(false)));
  $('#projectForm').elements.contractAmount.addEventListener('input', () => updateProjectWizardPayments(false));
  $('#projectForm').elements.depositAmount.addEventListener('input', () => updateProjectWizardPayments(false));

  $('#constructionPlanForm').addEventListener('input', (event) => {
    if (event.target.matches('[data-plan-name], [data-plan-duration], [data-plan-photos], [data-plan-start], [name="startDate"]')) {
      const row = event.target.closest('[data-plan-row]');
      const rowIndex = row ? $$('[data-plan-row]', $('#constructionPlanForm')).indexOf(row) : -1;
      const cascadeFromIndex = event.target.matches('[name="startDate"]')
        ? 0
        : event.target.matches('[data-plan-duration], [data-plan-start]') && rowIndex >= 0 ? rowIndex + 1 : null;
      updateConstructionPlanPreview({ cascadeFromIndex });
    }
  });

  $('#constructionPlanForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nodes = constructionPlanNodes(form);
    if (!nodes.length) return showToast('施工计划至少保留一个节点', true);
    if (nodes.some((node) => !node.name)) return showToast('请填写全部节点名称', true);
    const button = $('button[type="submit"]', form);
    setBusy(button, true, '正在保存…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/construction-plan`, {
        method: 'PUT',
        body: JSON.stringify({ startDate: form.elements.startDate.value, nodes }),
      });
      $('#constructionPlanDialog').close();
      showToast('施工计划已保存，可在施工节点总览导出客户版进度表图片');
      await refreshProject('overview');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#acceptanceMediaForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const milestoneId = form.elements.milestoneId.value;
    const files = form.elements.photos.files;
    if (!files?.length) return showToast('请先选择验收单图片', true);
    setBusy(button, true, '正在上传…');
    try {
      const mediaIds = await uploadFiles(files);
      await api(`/api/organizations/${state.organization.id}/projects/${state.project.id}/milestones/${milestoneId}/acceptance-media`, {
        method: 'POST', body: JSON.stringify({ mediaIds, occurredAt: new Date(form.elements.occurredAt.value).toISOString() }),
      });
      form.reset();
      clearUploadPreview(form);
      $('#acceptanceMediaDialog').close();
      showToast('验收图片已加入节点验收单与客户报告');
      await refreshProject('overview');
      const updatedNode = $(`[data-milestone-node="${CSS.escape(milestoneId)}"]`);
      if (updatedNode) updatedNode.open = true;
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#workerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    const workerId = data.workerId;
    delete data.workerId;
    setBusy(button, true, '正在保存…');
    try {
      await api(workerId
        ? `/api/organizations/${state.organization.id}/workers/${workerId}`
        : `/api/organizations/${state.organization.id}/workers`, {
        method: workerId ? 'PATCH' : 'POST',
        body: JSON.stringify(data),
      });
      $('#workerDialog').close();
      showToast(workerId ? '工人档案已更新' : '工人已加入调配名单');
      await loadWorkforceData();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#assignmentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    if (data.endDate < data.startDate) return showToast('结束日期不能早于开始日期', true);
    const assignmentId = form.dataset.assignmentId || '';
    setBusy(button, true, assignmentId ? '正在保存调整…' : '正在派工…');
    try {
      const result = await api(`/api/organizations/${state.organization.id}/worker-assignments${assignmentId ? `/${assignmentId}` : ''}`, {
        method: assignmentId ? 'PATCH' : 'POST', body: JSON.stringify(data),
      });
      $('#assignmentDialog').close();
      delete form.dataset.assignmentId;
      showToast(assignmentId ? '派工安排已更新' : `${result.assignment.workerName} 已安排到 ${result.assignment.projectName}，共 ${result.assignment.days} 天`);
      await loadWorkforceData();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#inviteForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canUseTeamCollaboration()) {
      $('#inviteDialog').close();
      showTeamPlanUpgrade();
      return;
    }
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    setBusy(button, true, '正在生成…');
    try {
      const payload = await api(`/api/organizations/${state.organization.id}/invitations`, {
        method: 'POST', body: JSON.stringify(data),
      });
      const link = new URL(payload.invitation.acceptPath, location.origin).href;
      await navigator.clipboard?.writeText(link);
      form.reset();
      $('#inviteDialog').close();
      showToast(`邀请链接已复制，有效期 7 天：${link}`);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#issueReviewForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const files = form.elements.photos.files;
    if (!files?.length || !state.pendingIssueId) return;
    setBusy(button, true, '正在提交…');
    try {
      showToast('正在上传整改后照片…');
      const mediaIds = await uploadFiles(files);
      const issueId = state.pendingIssueId;
      if (await updateIssue(issueId, 'submit_review', mediaIds, null, new Date(form.elements.occurredAt.value).toISOString())) {
        state.pendingIssueId = null;
        form.reset();
        $('#issueReviewDialog').close();
      }
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#unlinkedArchiveForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = formObject(form);
    setBusy(button, true, '正在归档…');
    try {
      await api(`/api/organizations/${state.organization.id}/projects/${form.dataset.archiveProjectId}/unlinked-media/archive`, {
        method: 'POST', body: JSON.stringify({ mediaIds: [data.mediaId], milestoneId: data.milestoneId || null, summary: data.summary.trim(), occurredAt: new Date(data.occurredAt).toISOString() }),
      });
      $('#unlinkedArchiveDialog').close();
      showToast('照片已归档为内部现场记录，未发布给客户');
      try { await refreshMediaCollections(); } catch (error) { showToast(`归档已成功，列表刷新失败，请手动刷新。${error.message}`, true); }
    } catch (error) { showToast(error.message, true); }
    finally { setBusy(button, false); }
  });

  $('#projectSearch').addEventListener('input', filterProjects);
  $('#projectStatusFilter').addEventListener('change', filterProjects);
  $('#projectDesignerFilter').addEventListener('change', filterProjects);
  $('#projectSiteManagerFilter').addEventListener('change', filterProjects);
  $('#toggleProjectOrder').addEventListener('click', () => {
    state.projectOrderMode = !state.projectOrderMode;
    $('#projectSearch').value = '';
    $('#projectStatusFilter').value = '';
    $('#projectDesignerFilter').value = '';
    $('#projectSiteManagerFilter').value = '';
    renderProjectDirectory();
    if (state.projectOrderMode) showToast('点击项目右侧的“上移 / 下移”调整公司项目顺序');
  });
  $('#refreshPhotoLibrary').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      await refreshMediaCollections();
      showToast('企业照片已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#refreshIssueCenter').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      state.issueCenter = await api(`/api/organizations/${state.organization.id}/issue-center`);
      renderIssueCenter();
      $('#issueNavCount').textContent = state.issueCenter?.metrics?.open || 0;
      showToast('整改任务已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  $('#issueSearch').addEventListener('input', renderIssueCenter);
  $('#issueStatusFilter').addEventListener('change', renderIssueCenter);
  $('#issueSort').addEventListener('change', renderIssueCenter);
  $('#taskSearch').addEventListener('input', renderTaskCenter);
  $('#taskTypeFilter').addEventListener('change', renderTaskCenter);
  $('#taskPriorityFilter').addEventListener('change', renderTaskCenter);
  $('#taskSort').addEventListener('change', renderTaskCenter);
  $('#clientSearch').addEventListener('input', renderClientCenter);
  $('#clientStatusFilter').addEventListener('change', renderClientCenter);
  $('#operationsSearch').addEventListener('input', renderOperations);
  $('#operationsRiskFilter').addEventListener('change', renderOperations);
  $('#operationsSort').addEventListener('change', renderOperations);
  $('#photoSearch').addEventListener('input', renderPhotoLibrary);
  $('#photoProjectFilter').addEventListener('change', renderPhotoLibrary);
  $('#photoTypeFilter').addEventListener('change', renderPhotoLibrary);
  $('#photoStatusFilter').addEventListener('change', renderPhotoLibrary);
  $('#activitySearch').addEventListener('input', renderActivity);
  $('#activityProjectFilter').addEventListener('change', renderActivity);
  $('#activityTypeFilter').addEventListener('change', renderActivity);
  $('#refreshActivity').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true, '正在刷新…');
    try { await refreshActivity(); showToast('操作记录已刷新'); } catch (error) { showToast(error.message, true); } finally { setBusy(button, false); }
  });
  $('#workerSearch').addEventListener('input', renderWorkforce);
  $('#workerTradeFilter').addEventListener('change', renderWorkforce);
  $('#workerStatusFilter').addEventListener('change', renderWorkforce);
  $('#assignmentForm').elements.startDate.addEventListener('change', () => {
    const form = $('#assignmentForm');
    if (!form.elements.endDate.value || form.elements.endDate.value < form.elements.startDate.value) {
      form.elements.endDate.value = form.elements.startDate.value;
    }
    updateAssignmentDuration();
  });

  $('#refreshMediaTrash').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      await refreshMediaCollections();
      showToast('图片回收站已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });
  $('#assignmentForm').elements.endDate.addEventListener('change', updateAssignmentDuration);
  $('#workforceStartDate').addEventListener('change', (event) => loadWorkforceData(event.target.value).catch((error) => showToast(error.message, true)));
  $('#workforcePrev').addEventListener('click', () => loadWorkforceData(dateOffset(state.workforceStartDate, -14)).catch((error) => showToast(error.message, true)));
  $('#workforceToday').addEventListener('click', () => loadWorkforceData(localDateValue()).catch((error) => showToast(error.message, true)));
  $('#workforceNext').addEventListener('click', () => loadWorkforceData(dateOffset(state.workforceStartDate, 14)).catch((error) => showToast(error.message, true)));
  $('#refreshWorkforce').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      await loadWorkforceData();
      showToast('工人排班已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });
  $('#refreshTaskCenter').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      await loadDashboardData();
      showToast('待办已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });
  $('#refreshClientCenter').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      await loadClientCenterData();
      $('#clientNavCount').textContent = state.clientCenter?.metrics?.openResponses || 0;
      showToast('客户交付状态已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });
  $('#refreshOperations').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, '正在刷新…');
    try {
      await refreshOperations();
      showToast('收款与供应数据已刷新');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  function filterProjects() {
    state.projectOrderMode = false;
    const query = $('#projectSearch').value.trim().toLowerCase();
    const status = $('#projectStatusFilter').value;
    const designerId = $('#projectDesignerFilter').value;
    const siteManagerId = $('#projectSiteManagerFilter').value;
    const projects = state.dashboard.projects.filter((project) => {
      const haystack = `${project.name} ${project.customerName} ${project.location} ${project.contractNo || ''} ${project.signedMonth || ''} ${project.managerName || ''} ${project.designerName || ''} ${project.siteManagerName || ''}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!status || project.status === status)
        && (!designerId || project.designerMemberId === designerId)
        && (!siteManagerId || project.siteManagerMemberId === siteManagerId);
    });
    renderProjectDirectory(projects, false);
    if (!projects.length) $('#allProjects').innerHTML = '<div class="empty panel">没有符合条件的项目</div>';
  }

  function runGlobalSearch() {
    const query = $('#globalSearch').value.trim();
    showProjectDirectory('overview', 'projects');
    $('#projectSearch').value = query;
    filterProjects();
    $('#projectSearch').focus();
  }

  $('#globalSearch').addEventListener('search', runGlobalSearch);
  $('#globalSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runGlobalSearch();
    }
  });

  $('#joinInvitationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', event.currentTarget);
    const inviteCode = event.currentTarget.elements.inviteCode.value.trim();
    if (!inviteCode) return;
    setBusy(button, true);
    try {
      await api('/api/organization-invitations/accept', {
        method: 'POST', body: JSON.stringify({ inviteCode }),
      });
      event.currentTarget.reset();
      showToast('已加入企业空间');
      await init();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  async function init() {
    showOnlyState('loadingState');
    try {
      let mePayload = await api('/api/me');
      state.me = mePayload.user;
      const inviteCode = new URLSearchParams(location.search).get('invite');
      if (inviteCode) {
        try {
          await api('/api/organization-invitations/accept', {
            method: 'POST', body: JSON.stringify({ inviteCode }),
          });
          history.replaceState(null, '', '/enterprise.html');
          showToast('已加入企业空间');
          mePayload = await api('/api/me');
          state.me = mePayload.user;
        } catch (error) {
          showToast(error.message, true);
        }
      }
      if (!mePayload.features?.enterprise) {
        const suspendedCount = Number(mePayload.features?.enterpriseSuspendedWorkspaceCount || 0);
        $('#disabledTitle').textContent = suspendedCount > 0
          ? '企业套餐已暂停，需要续费恢复'
          : (mePayload.features?.enterpriseAvailable ? '当前账号尚未开通企业版' : '当前环境尚未开放企业版');
        $('#disabledDescription').textContent = suspendedCount > 0
          ? '原企业、项目、照片和成员关系继续保留；续费后网页与小程序同时恢复。'
          : (mePayload.features?.enterpriseAvailable
            ? '企业负责人需先由装修小账本管理员开通资格；企业成员可在下方输入收到的邀请码加入。个人版继续永久免费。'
            : '企业版当前未在此环境开放，个人版不受影响。');
        $('#joinInvitationForm').classList.toggle('hidden', mePayload.features?.enterpriseAvailable === false);
        showOnlyState('disabledState');
        return;
      }
      const workspaces = await api('/api/workspaces');
      state.workspaces = workspaces.organizations;
      renderWorkspaceSelect();
      if (!state.workspaces.length) {
        $('#workspaceSelect').value = 'personal';
        if (workspaces.canCreateOrganization || mePayload.features?.enterpriseCanCreateOrganization) showOnlyState('setupState');
        else showOnlyState('disabledState');
        return;
      }
      const savedId = localStorage.getItem('xiaozhuangjia.enterprise.organizationId');
      const selected = state.workspaces.find((item) => item.id === savedId) || state.workspaces[0];
      await loadOrganization(selected.id);
      const initialView = new URLSearchParams(location.search).get('view');
      if (['tasks', 'issues', 'reports', 'members', 'storage', 'operations', 'activity'].includes(initialView)) showView(initialView, initialView);
      else if (['photos', 'trash', 'assets'].includes(initialView)) showView(initialView === 'trash' ? 'trash' : 'photos', 'assets');
      else if (initialView === 'client') showView('clients', 'client');
      else if (initialView === 'projects') showProjectDirectory('overview', 'projects');
    } catch (error) {
      showToast(error.message, true);
      showOnlyState('connectionState');
    }
  }

  initializeStageSelects();
  init();
})();
