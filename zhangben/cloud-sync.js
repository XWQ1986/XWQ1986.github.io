(function () {
  'use strict';

  // 复刻版是纯静态站点，默认关闭云同步，避免出现“同步不可用 / 重试同步”提示。
  // 如需接回后端，在引入本文件前设置 window.__XZ_STATIC__ = false 即可。
  const STATIC_REPLICA = window.__XZ_STATIC__ !== false;
  if (STATIC_REPLICA) {
    window.ZhuangxiuSync = {
      saveNow: () => Promise.resolve(),
      collectData: () => ({}),
      logoutAndRedirect: () => { location.href = 'login.html'; },
      checkRemoteUpdates: () => Promise.resolve(),
      listConflictBackups: () => Promise.resolve([]),
      exportBackup: () => {},
      useCloudVersion: () => Promise.resolve(),
      restoreConflictBackup: () => Promise.resolve(),
      setEditing: () => {}
    };
    return;
  }

  const TRACKED_KEYS = [
    '装修模式',
    '装修分组',
    '装修预算v3',
    '装修待办v2',
    '装修待购清单',
    '装修采购参考库',
    '装修记账数据',
    '装修记账分类',
    '装修比价v5',
    '装修比价选品v2',
    '装修比价选品',
    '装修比价清单',
    '装修比价v3',
    '装修比价v4',
    '装修小账本比价待导入v1',
    '装修流程进度',
    '装修流程顺序v1',
    '瑁呬慨娴佺▼杩涘害',
    '水电验收清单',
    '装修日记',
    'darkMode',
    '装修小账本小程序数据v1'
  ];
  const VERSION_KEY = '装修小账本云同步版本';
  const APPLIED_KEY = '装修小账本已应用云版本';
  const CURRENT_PROJECT_KEY = '装修小账本当前项目id';
  const PENDING_PREFIX = '装修小账本待同步:';
  const CONFLICT_PREFIX = '装修小账本冲突备份:';
  const OWNER_KEY = '装修小账本本机账号id';
  const LOCAL_ACCOUNT_KEYS = [
    CURRENT_PROJECT_KEY,
    OWNER_KEY,
    '装修日记草稿'
  ];
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let ready = false;
  let captureReady = false;
  let applying = false;
  let version = 0;
  let saveTimer = null;
  let saveInFlight = false;
  let saveAgain = false;
  let conflict = false;
  let currentUser = null;
  let currentProjectId = localStorage.getItem(CURRENT_PROJECT_KEY) || '';
  let projectsState = { projects: [], multiProjectEnabled: false };
  let observedData = collectData();
  let stalePage = false;
  let operationEpoch = 0;
  let acknowledgedData = null;
  let formDirty = false;
  let formEditRevision = 0;
  let remoteCheckInFlight = false;
  let lastRemoteCheck = 0;

  function pauseStalePage() {
    if (!stalePage) operationEpoch++;
    stalePage = true;
    ready = false;
    captureReady = false;
    saveAgain = false;
    clearTimeout(saveTimer);
    updateStatus('stale', '其他标签页已更新数据或切换项目，本页已暂停保存。当前输入仍保留，请先复制未提交内容，再刷新页面继续。');
  }

  function hasCurrentCache() {
    const scopeMatches = currentUser &&
      localStorage.getItem(OWNER_KEY) === String(currentUser.id) &&
      localStorage.getItem(CURRENT_PROJECT_KEY) === currentProjectId;
    if (stalePage || !scopeMatches || !sameData(observedData, collectData())) {
      pauseStalePage();
      return false;
    }
    return true;
  }

  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage) return;
    if (event.key === null || TRACKED_KEYS.includes(event.key) ||
        [OWNER_KEY, CURRENT_PROJECT_KEY, VERSION_KEY].includes(event.key)) {
      // Never replace a live form with another tab's data or let its stale
      // in-memory model overwrite the shared cache and pending snapshot.
      pauseStalePage();
    }
  });

  const PUBLIC_PAGES = new Set(['login.html', 'register.html']);

  function currentPageName() {
    const raw = location.pathname.split('/').pop() || '主页.html';
    try {
      return decodeURIComponent(raw) || '主页.html';
    } catch (_) {
      return raw || '主页.html';
    }
  }

  function isPublicPage() {
    return PUBLIC_PAGES.has(currentPageName());
  }

  function redirectToLogin(mode) {
    if (isPublicPage()) return;
    ready = false;
    captureReady = false;
    clearTrackedData();
    updateStatus('offline', '未登录');
    const query = mode === 'switch' ? '?mode=switch' : '?next=/' + encodeURIComponent(currentPageName());
    location.replace('login.html' + query);
  }

  function collectData() {
    const data = {};
    TRACKED_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    });
    return data;
  }

  function clearTrackedData() {
    applying = true;
    clearTimeout(saveTimer);
    TRACKED_KEYS.forEach((key) => originalRemoveItem.call(localStorage, key));
    LOCAL_ACCOUNT_KEYS.forEach((key) => originalRemoveItem.call(localStorage, key));
    originalRemoveItem.call(localStorage, VERSION_KEY);
    originalRemoveItem.call(sessionStorage, APPLIED_KEY);
    currentProjectId = '';
    observedData = collectData();
    applying = false;
  }

  function updateStatus(state, text) {
    document.documentElement.dataset.syncState = state;
    document.documentElement.dataset.syncText = text;
    window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: { state, text } }));
    renderSyncNotice(state, text);
    renderBackupAccess();
  }

  function pendingKey() {
    return currentUser && currentProjectId
      ? PENDING_PREFIX + encodeURIComponent(String(currentUser.id)) + ':' + encodeURIComponent(currentProjectId)
      : '';
  }

  function appliedVersionKey() {
    return String(currentUser && currentUser.id) + ':' + currentProjectId + ':' + version;
  }

  function readPending() {
    const key = pendingKey();
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const pending = JSON.parse(raw);
    if (!pending || !pending.data || String(pending.userId) !== String(currentUser.id) || pending.projectId !== currentProjectId) {
      throw new Error('本机待同步记录无法读取，请先导出备份');
    }
    return pending;
  }

  function sameData(a, b) {
    return TRACKED_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));
  }

  function markPending() {
    const key = pendingKey();
    if (!key) return;
    const previous = readPending();
    originalSetItem.call(localStorage, key, JSON.stringify({
      userId: currentUser.id, projectId: currentProjectId,
      baseVersion: previous ? previous.baseVersion : version,
      savedAt: new Date().toISOString(), data: collectData()
    }));
  }

  function renderSyncNotice(state, text) {
    if (!document.body) return;
    let notice = document.getElementById('cloudSyncNotice');
    const visible = ['error', 'conflict', 'offline', 'storage-error', 'stale', 'remote-updated', 'restored'].includes(state);
    if (!notice && !visible) return;
    if (!notice) {
      const style = document.createElement('style');
      style.textContent = '#cloudSyncNotice[hidden]{display:none}#cloudSyncNotice{position:fixed;z-index:2300;right:16px;bottom:16px;max-width:430px;padding:14px 16px;border:1px solid #dfc49a;border-radius:12px;background:#fff9e9;color:#493e2d;box-shadow:0 6px 24px #30281818;font:14px/1.6 system-ui,sans-serif}#cloudSyncNotice p{margin:0 0 9px}#cloudSyncNotice button{padding:7px 12px;margin:0 8px 0 0;border:1px solid #d6c89c;border-radius:8px;background:#fff;color:inherit;cursor:pointer}#cloudSyncNotice button:disabled{opacity:.6;cursor:wait}@media(max-width:600px){#cloudSyncNotice{left:80px;right:12px;bottom:12px;max-width:none}}';
      document.head.appendChild(style);
      notice = document.createElement('section');
      notice.id = 'cloudSyncNotice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.innerHTML = '<p></p><button type="button" data-sync-retry>重试同步</button><button type="button" data-sync-export>导出本机备份</button><button type="button" data-sync-cloud>使用云端版本</button>';
      document.body.appendChild(notice);
      notice.querySelector('[data-sync-retry]').addEventListener('click', async (event) => {
        if (stalePage) { location.reload(); return; }
        if (document.documentElement.dataset.syncState === 'restored') { await saveNow(); return; }
        event.target.disabled = true;
        try { await initialize(); } finally { event.target.disabled = false; }
      });
      notice.querySelector('[data-sync-export]').addEventListener('click', () => exportBackup());
      notice.querySelector('[data-sync-cloud]').addEventListener('click', async (event) => {
        if (!confirm('先保留本机备份，再使用最新云端版本？页面将刷新，未提交表单会记录在备份中，可从账号中心导出。')) return;
        event.target.disabled = true;
        try { await useCloudVersion({ confirmed: true }); }
        finally { event.target.disabled = false; }
      });
    }
    notice.hidden = !visible;
    notice.querySelector('[data-sync-retry]').hidden = ['storage-error', 'conflict', 'remote-updated'].includes(state);
    notice.querySelector('[data-sync-cloud]').hidden = !['conflict', 'remote-updated'].includes(state);
    notice.querySelector('[data-sync-retry]').textContent = state === 'stale' ? '刷新页面' : state === 'restored' ? '确认同步恢复数据' : '重试同步';
    notice.querySelector('p').textContent = state === 'conflict'
      ? '其他设备已有更新，本机修改已保留。可导出备份核对，或明确选择使用云端版本；历史备份可在账号中心取回。'
      : ['storage-error', 'stale', 'remote-updated', 'restored'].includes(state) ? text : text + '。本机记录暂未同步，请重试；也可以先导出备份。';
  }

  async function api(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
      ...options
    });
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(body.detail || body.error || '请求失败');
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function syncPath() {
    return '/api/sync' + (currentProjectId ? '?project_id=' + encodeURIComponent(currentProjectId) : '');
  }

  function applyRemote(data, remoteVersion) {
    let changed = false;
    applying = true;
    try { TRACKED_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (localStorage.getItem(key) !== data[key]) changed = true;
        originalSetItem.call(localStorage, key, data[key]);
      } else if (localStorage.getItem(key) !== null) {
        changed = true;
        originalRemoveItem.call(localStorage, key);
      }
    });
    originalSetItem.call(localStorage, VERSION_KEY, String(remoteVersion));
    } finally { applying = false; }
    version = remoteVersion;
    observedData = collectData();
    return changed;
  }

  async function saveNow() {
    if (stalePage) { pauseStalePage(); return false; }
    if (!ready || applying) return false;
    if (!hasCurrentCache()) return false;
    clearTimeout(saveTimer);
    if (conflict) {
      updateStatus('conflict', '发现同步冲突，本机数据已保留');
      return false;
    }
    if (saveInFlight) {
      saveAgain = true;
      return false;
    }
    try {
      if (!readPending() && acknowledgedData && sameData(collectData(), acknowledgedData)) {
        updateStatus('saved', '已同步');
        return true;
      }
    } catch (_) { updateStatus('storage-error', '本机待同步记录无法读取，请先导出备份'); return false; }
    saveInFlight = true;
    updateStatus('saving', '正在保存');
    const localData = collectData();
    const requestEpoch = operationEpoch;
    try {
      // Persist the pending snapshot before any request; reload must never discard it.
      markPending();
      const pending = readPending();
      if (!pending) throw new Error('当前项目尚未就绪');
      const result = await api(syncPath(), {
        method: 'PUT',
        body: JSON.stringify({ version: pending.baseVersion, data: localData })
      });
      if (requestEpoch !== operationEpoch || !hasCurrentCache()) return false;
      version = result.version;
      acknowledgedData = { ...localData };
      originalSetItem.call(localStorage, VERSION_KEY, String(version));
      originalSetItem.call(sessionStorage, APPLIED_KEY, appliedVersionKey());
      if (sameData(collectData(), localData)) {
        originalRemoveItem.call(localStorage, pendingKey());
        updateStatus('saved', '已同步');
      } else {
        originalSetItem.call(localStorage, pendingKey(), JSON.stringify({ ...pending, baseVersion: version, data: collectData(), savedAt: new Date().toISOString() }));
        saveAgain = true;
        updateStatus('saving', '正在保存最新修改');
      }
      return !saveAgain;
    } catch (error) {
      if (requestEpoch !== operationEpoch || stalePage) return false;
      if (error.status === 401) {
        redirectToLogin();
        return false;
      } else if (error.status === 409 && error.body && error.body.detail) {
        conflict = true;
        try { archiveConflict('save-conflict', Number(error.body.detail.version || version)); }
        catch (_) { updateStatus('storage-error', '冲突备份空间不足，待同步记录仍保留，请先导出本机备份'); return false; }
        updateStatus('conflict', '发现同步冲突，本机数据已保留');
        return false;
      } else {
        updateStatus('error', error.status === 413 ? '数据过大，同步失败' : '同步失败');
        return false;
      }
    } finally {
      saveInFlight = false;
      if (saveAgain) {
        saveAgain = false;
        scheduleSave();
      }
    }
  }

  function scheduleSave() {
    if (!ready || applying) return;
    clearTimeout(saveTimer);
    try { markPending(); } catch (_) {
      updateStatus('error', '本机备份空间不足');
      return;
    }
    saveTimer = setTimeout(saveNow, 900);
  }

  function writeTracked(storage, key, value, remove) {
    key = String(key);
    const tracked = storage === localStorage && TRACKED_KEYS.includes(key) && !applying;
    if (tracked && (stalePage || ((ready || captureReady) && !hasCurrentCache()))) {
      pauseStalePage();
      throw new Error('其他标签页已更新数据，请保留输入后刷新本页');
    }
    if (tracked && !ready && !captureReady) {
      updateStatus('storage-error', '账号与项目尚未读取完成，这次修改未保存，请保留输入后重试。');
      throw new Error('账号与项目尚未读取完成');
    }
    const previous = tracked ? storage.getItem(key) : null;
    if (tracked && (remove ? previous === null : previous === String(value))) return;
    try {
      if (remove) originalRemoveItem.call(storage, key);
      else originalSetItem.call(storage, key, value);
      if (tracked) markPending();
    } catch (error) {
      // The business value and its durable upload snapshot form one local write.
      // A failed snapshot must not leave an apparently saved, unprotected value.
      if (tracked) {
        if (previous === null) originalRemoveItem.call(storage, key);
        else originalSetItem.call(storage, key, previous);
        updateStatus('storage-error', '本机存储空间不足，这次修改未保存。请保留输入，释放空间后重试。');
      }
      throw error;
    }
    if (tracked) observedData = collectData();
    if (tracked) scheduleSave();
  }

  Storage.prototype.setItem = function (key, value) { writeTracked(this, key, value, false); };
  Storage.prototype.removeItem = function (key) { writeTracked(this, key, null, true); };

  function backupScope() {
    return currentUser && currentProjectId ? CONFLICT_PREFIX + encodeURIComponent(String(currentUser.id)) + ':' + encodeURIComponent(currentProjectId) + ':' : '';
  }

  function readFormDrafts() {
    return Array.from(document.querySelectorAll('input,textarea,select,[contenteditable="true"]')).filter((field) =>
      !['password', 'hidden', 'file'].includes(field.type) && !field.closest('#cloudSyncNotice') &&
      !field.closest('.password-wrap') && !/password|passwd|pwd|secret|token|one-time-code|verifyCode|verificationCode|emailCode/i.test([field.id, field.name, field.autocomplete].join(' '))
    ).map((field) => ({ id: field.id || '', name: field.name || '', type: field.type || 'text',
      value: field.isContentEditable ? field.textContent : field.value, checked: Boolean(field.checked) }));
  }

  function archiveConflict(reason, serverVersion) {
    const scope = backupScope();
    if (!scope) throw new Error('账号与项目尚未就绪');
    const id = scope + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const backup = { id, savedAt: new Date().toISOString(), reason, userId: currentUser.id,
      projectId: currentProjectId, localVersion: version, serverVersion,
      data: stalePage ? { ...observedData } : collectData(), pending: localStorage.getItem(pendingKey()),
      formDrafts: readFormDrafts() };
    originalSetItem.call(localStorage, id, JSON.stringify(backup));
    return backup;
  }

  function listConflictBackups() {
    const scope = backupScope();
    if (!scope) return [];
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(scope)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (String(entry.userId) === String(currentUser.id) && entry.projectId === currentProjectId) entries.push({ ...entry, id: key });
      } catch (_) { /* Preserve malformed records in storage for manual recovery. */ }
    }
    try {
      const legacy = JSON.parse(localStorage.getItem('装修小账本冲突本机备份') || 'null');
      if (legacy && legacy.projectId === currentProjectId) entries.push({ ...legacy, id: '装修小账本冲突本机备份' });
    } catch (_) {}
    return entries.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  function exportBackup(id) {
    const backup = id ? listConflictBackups().find((entry) => entry.id === id) : {
      savedAt: new Date().toISOString(), userId: currentUser && currentUser.id, projectId: currentProjectId,
      data: stalePage ? observedData : collectData(), pending: localStorage.getItem(pendingKey()),
      formDrafts: readFormDrafts(), conflictBackups: listConflictBackups()
    };
    if (!backup) throw new Error('备份不存在或不属于当前账号和项目');
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '装修小账本-本机数据备份.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return backup;
  }

  function renderBackupAccess() {
    if (!document.body) return;
    const entries = listConflictBackups();
    let access = document.getElementById('cloudBackupAccess');
    if (!access && !entries.length) return;
    if (!access) {
      access = document.createElement('button');
      access.id = 'cloudBackupAccess'; access.type = 'button';
      access.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:2290;padding:8px 12px;border:1px solid #d6c89c;border-radius:8px;background:#fff9e9;color:#493e2d;cursor:pointer';
      access.addEventListener('click', showBackupPanel);
      document.body.appendChild(access);
    }
    access.textContent = '查看本机备份（' + entries.length + '）';
    access.hidden = !entries.length;
  }

  function showBackupPanel() {
    let panel = document.getElementById('cloudBackupPanel');
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'cloudBackupPanel';
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '本机冲突备份');
      panel.style.cssText = 'position:fixed;z-index:2500;left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 32px));max-height:75vh;overflow:auto;padding:20px;box-sizing:border-box;border:1px solid #d6c89c;border-radius:12px;background:#fffdf6;color:#493e2d;box-shadow:0 12px 80px #0005;font:14px/1.6 system-ui,sans-serif';
      document.body.appendChild(panel);
    }
    panel.replaceChildren(); panel.hidden = false;
    const title = document.createElement('h2'); title.textContent = '当前项目的本机备份';
    const help = document.createElement('p'); help.textContent = '这些备份仅保存在当前浏览器。下载文件可长期保留；恢复后还需要明确确认同步，才会替换云端数据。';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭';
    close.addEventListener('click', () => { panel.hidden = true; });
    panel.append(title, help, close);
    listConflictBackups().forEach((entry) => {
      const row = document.createElement('div'); row.style.cssText = 'padding:12px 0;border-top:1px solid #e9dfc9;margin-top:10px';
      const label = document.createElement('p'); label.textContent = new Date(entry.savedAt).toLocaleString('zh-CN') + ' · 本机版本 ' + entry.localVersion;
      const download = document.createElement('button'); download.type = 'button'; download.textContent = '下载这份备份';
      download.addEventListener('click', () => exportBackup(entry.id));
      const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = '恢复到本机'; restore.style.marginLeft = '8px';
      restore.addEventListener('click', async () => {
        if (!confirm('恢复这份备份到当前项目？会先备份当前数据，然后刷新页面。再次点击确认同步后，将用恢复的数据替换云端版本。')) return;
        restore.disabled = true;
        try { await restoreConflictBackup(entry.id, { confirmed: true }); }
        catch (error) { updateStatus('error', error.message); }
        finally { restore.disabled = false; }
      });
      row.append(label, download, restore); panel.appendChild(row);
    });
    close.focus();
  }

  function hasFormEdits() {
    const active = document.activeElement;
    return formDirty || Boolean(active && active.matches && active.matches('input,textarea,select,[contenteditable="true"]'));
  }

  async function checkRemoteUpdates(options = {}) {
    if (!ready || applying || stalePage || saveInFlight || remoteCheckInFlight || !hasCurrentCache()) return false;
    if (!options.force && Date.now() - lastRemoteCheck < 5000) return false;
    lastRemoteCheck = Date.now();
    remoteCheckInFlight = true;
    const epoch = operationEpoch;
    const formRevision = formEditRevision;
    const snapshot = collectData();
    try {
      const remote = await api(syncPath());
      if (epoch !== operationEpoch || !hasCurrentCache() || saveInFlight) return false;
      const remoteVersion = Number(remote.version || 0);
      if (remoteVersion === version) return true;
      const pending = readPending();
      const changedWhileReading = !sameData(snapshot, collectData());
      if (pending || changedWhileReading || hasFormEdits()) {
        if (pending && !sameData(pending.data, remote.data || {}) && remoteVersion !== Number(pending.baseVersion)) {
          if (!conflict) archiveConflict('remote-update-conflict', remoteVersion);
          conflict = true;
          updateStatus('conflict', '云端已有更新，本机修改与表单输入仍保留');
        } else {
          updateStatus('remote-updated', '云端已有更新；当前有未提交内容，已保留输入。完成编辑后再同步，或导出备份并选择使用云端版本。');
        }
        return false;
      }
      const changed = applyRemote(remote.data || {}, remoteVersion);
      acknowledgedData = { ...(remote.data || {}) };
      originalSetItem.call(sessionStorage, APPLIED_KEY, appliedVersionKey());
      updateStatus('saved', '已获取云端更新');
      if (changed) location.reload();
      return true;
    } catch (error) {
      if (epoch !== operationEpoch || stalePage) return false;
      if (error.status === 401) redirectToLogin();
      else updateStatus('error', '检查云端更新失败');
      return false;
    } finally { remoteCheckInFlight = false; }
  }

  async function useCloudVersion(options = {}) {
    if (options.confirmed !== true) throw new Error('请先明确确认使用云端版本');
    if (!ready || stalePage || saveInFlight || !hasCurrentCache()) return false;
    clearTimeout(saveTimer);
    const epoch = operationEpoch;
    const formRevision = formEditRevision;
    const snapshot = collectData();
    try {
      archiveConflict('before-use-cloud', null);
      const remote = await api(syncPath());
      if (epoch !== operationEpoch || !hasCurrentCache() || saveInFlight || formRevision !== formEditRevision || !sameData(snapshot, collectData())) {
        updateStatus('remote-updated', '读取云端期间本机数据有变化，请重新确认');
        return false;
      }
      // Include any form keystrokes during the request in the retained snapshot.
      archiveConflict('use-cloud-confirmed', Number(remote.version || 0));
      applyRemote(remote.data || {}, Number(remote.version || 0));
      acknowledgedData = { ...(remote.data || {}) };
      originalRemoveItem.call(localStorage, pendingKey());
      originalSetItem.call(sessionStorage, APPLIED_KEY, appliedVersionKey());
      conflict = false;
      formDirty = false;
      saveAgain = false;
      updateStatus('saved', '已使用云端版本，本机备份可在账号中心取回');
      location.reload();
      return true;
    } catch (error) {
      if (epoch === operationEpoch && !stalePage) updateStatus('error', error.message || '使用云端版本失败，本机数据仍保留');
      return false;
    }
  }

  async function restoreConflictBackup(id, options = {}) {
    if (options.confirmed !== true) throw new Error('请先确认：恢复备份后再次同步将替换当前云端数据');
    const backup = listConflictBackups().find((entry) => entry.id === id);
    if (!backup || !backup.data) throw new Error('备份不存在或不属于当前账号和项目');
    if (!ready || stalePage || saveInFlight || !hasCurrentCache()) return false;
    clearTimeout(saveTimer);
    const epoch = operationEpoch;
    const formRevision = formEditRevision;
    const snapshot = collectData();
    try {
      const remote = await api(syncPath());
      if (epoch !== operationEpoch || !hasCurrentCache() || saveInFlight || formRevision !== formEditRevision || !sameData(snapshot, collectData())) return false;
      archiveConflict('before-restore-backup', Number(remote.version || 0));
      // Save the recoverable draft first; quota failure must never replace live data.
      originalSetItem.call(localStorage, pendingKey(), JSON.stringify({ userId: currentUser.id,
        projectId: currentProjectId, baseVersion: Number(remote.version || 0), manualReview: true, savedAt: new Date().toISOString(), data: backup.data }));
      applyRemote(backup.data, Number(remote.version || 0));
      acknowledgedData = { ...(remote.data || {}) };
      conflict = false;
      formDirty = false;
      saveAgain = false;
      updateStatus('restored', '备份已恢复到本机待同步记录；点击同步后才会更新云端');
      window.dispatchEvent(new CustomEvent('cloud-sync-backup-restored', { detail: { id, projectId: currentProjectId } }));
      location.reload();
      return true;
    } catch (error) {
      if (epoch === operationEpoch && !stalePage) updateStatus('error', error.message || '恢复失败，原备份仍保留');
      return false;
    }
  }

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (target && !target.closest('#cloudSyncNotice')) { formDirty = true; formEditRevision++; }
  }, true);
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target && !target.closest('#cloudSyncNotice')) { formDirty = true; formEditRevision++; }
  }, true);
  window.addEventListener('focus', () => checkRemoteUpdates());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkRemoteUpdates();
  });

  function ensureProjectStyles() {
    if (document.getElementById('freshProjectStyles')) return;
    const style = document.createElement('style');
    style.id = 'freshProjectStyles';
    style.textContent = '.fresh-project-card{display:grid;gap:7px;margin:4px 8px 8px 42px;padding:9px 10px;border:1px solid #ece7e2;border-radius:8px;background:#fffdfb}.fresh-project-nav{display:grid;grid-template-columns:minmax(116px,160px) auto;align-items:center;gap:6px;margin:0;padding:0;border:0;background:transparent}.fresh-project-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px}.fresh-project-nav .fresh-project-head{display:block;order:2}.fresh-project-head b{font-size:13px;color:#202124;white-space:nowrap}.fresh-project-nav .fresh-project-head b,.fresh-project-nav small{display:none}.fresh-project-head button{height:30px;padding:0 10px;border:1px solid #f0d6cc;border-radius:7px;background:#fff0ea;color:#e45b3f;font-size:12px;font-weight:800;cursor:pointer}.fresh-project-nav .fresh-project-head button{height:34px;white-space:nowrap}.fresh-project-select{width:100%;height:32px;padding:0 8px;border:1px solid #ece7e2;border-radius:7px;background:#fff;color:#202124;font-size:13px}.fresh-project-nav .fresh-project-select{order:1;height:34px;background:#fff}.fresh-project-card small{color:#9b928b;font-size:11px;line-height:1.35}.fresh-project-toggle{display:none;width:38px;height:38px;border:1px solid #f0d6cc;border-radius:12px;background:#fff;color:#e45b3f;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(55,42,31,.05);cursor:pointer}.fresh-project-toggle svg{width:18px;height:18px}.fresh-project-popover[hidden]{display:none}.fresh-project-popover{position:fixed;right:12px;top:58px;z-index:1500;width:min(330px,calc(100vw - 24px));padding:12px;border:1px solid #ece7e2;border-radius:12px;background:#fffdfb;box-shadow:0 18px 46px rgba(55,42,31,.16);display:grid;gap:9px}.fresh-project-popover-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.fresh-project-popover-head b{font-size:14px;color:#202124}.fresh-project-popover .fresh-project-select{height:38px}.fresh-project-popover .fresh-project-new{height:38px;border:1px solid #f0d6cc;border-radius:8px;background:#fff0ea;color:#e45b3f;font-size:13px;font-weight:850;cursor:pointer}.fresh-project-popover small{color:#9b928b;font-size:12px;line-height:1.45}@media(max-width:860px){.fresh-project-nav{grid-template-columns:minmax(96px,1fr) auto;width:100%;grid-column:1/-1;order:8}.fresh-project-nav .fresh-project-head button{padding:0 8px}}@media(max-width:680px){.fresh-navbar{grid-template-columns:auto minmax(0,1fr)!important;align-items:center!important;min-height:58px!important}.fresh-navbar .fresh-brand{width:40px!important;min-width:40px!important;overflow:hidden!important}.fresh-navbar .fresh-brand>span:not(.fresh-iconbox){display:none!important}.fresh-navbar .fresh-nav-actions{grid-column:2!important;display:flex!important;gap:6px!important;width:100%!important;align-items:center!important;justify-content:flex-end!important}.fresh-project-nav{display:none!important}.fresh-project-toggle{display:inline-flex!important;order:2}.fresh-navbar .fresh-notice-link{order:3}.fresh-navbar .fresh-account{order:1;max-width:calc(100vw - 190px)!important}.fresh-navbar .fresh-user-link{max-width:150px!important;padding:0 10px!important}.fresh-navbar .fresh-user-link span{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.fresh-project-popover{top:56px}}.fresh-project-dialog[hidden]{display:none}.fresh-project-dialog{position:fixed;inset:0;z-index:2600;display:grid;place-items:center;padding:18px}.fresh-project-backdrop{position:absolute;inset:0;background:rgba(32,33,36,.35);backdrop-filter:blur(6px)}.fresh-project-panel{position:relative;width:min(420px,100%);display:grid;gap:12px;padding:22px;border:1px solid #ece7e2;border-radius:12px;background:#fffdfb;box-shadow:0 24px 70px rgba(55,42,31,.22)}.fresh-project-panel h2{margin:0;color:#202124;font-size:20px}.fresh-project-panel p{margin:0;color:#68615b;font-size:14px;line-height:1.7}.fresh-project-panel input{height:40px;padding:0 12px;border:1px solid #ece7e2;border-radius:8px;font-size:14px;outline:none}.fresh-project-panel input:focus{border-color:#e45b3f;box-shadow:0 0 0 3px rgba(228,91,63,.08)}.fresh-project-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.fresh-project-actions button{height:36px;padding:0 14px;border:1px solid #ece7e2;border-radius:8px;background:#fff;color:#68615b;font-size:13px;font-weight:800;cursor:pointer}.fresh-project-actions .primary{border-color:#e45b3f;background:#e45b3f;color:#fff}.fresh-project-error{color:#c94b3f;font-size:12px;line-height:1.5}';
    style.textContent += '.fresh-project-head-actions{display:flex;gap:5px}.fresh-project-nav .fresh-project-head-actions{justify-content:flex-end}.fresh-project-popover-head .fresh-project-head-actions button{height:34px;padding:0 9px;border:1px solid #f0d6cc;border-radius:8px;background:#fff0ea;color:#e45b3f;font-size:12px;font-weight:800;cursor:pointer}.fresh-project-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fresh-project-fields label{display:grid;gap:5px;color:#68615b;font-size:12px;font-weight:700}.fresh-project-fields label:first-child{grid-column:1/-1}.fresh-project-fields input,.fresh-project-fields select{width:100%;height:40px;padding:0 10px;border:1px solid #ece7e2;border-radius:8px;background:#fff;color:#202124;box-sizing:border-box;font-size:14px;outline:none}.fresh-project-fields input:focus,.fresh-project-fields select:focus{border-color:#e45b3f;box-shadow:0 0 0 3px rgba(228,91,63,.08)}@media(max-width:520px){.fresh-project-fields{grid-template-columns:1fr}}';
    style.textContent += '.fresh-enterprise-switch{min-height:38px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;border:1px solid #efc6b9;border-radius:10px;background:#fff0ea;color:#c94f36;font-size:13px;font-weight:850;text-decoration:none;white-space:nowrap;box-shadow:0 8px 20px rgba(228,91,63,.10);transition:transform .18s ease,background .18s ease}.fresh-enterprise-switch:hover{background:#ffe6dc;transform:translateY(-1px)}.fresh-enterprise-switch svg{width:17px;height:17px}.fresh-customer-switch{border-color:#cfe5d7;background:#eef7f1;color:#397457;box-shadow:0 8px 20px rgba(63,140,94,.10)}.fresh-customer-switch:hover{background:#e3f2e9}@media(max-width:680px){.fresh-enterprise-switch{width:38px;min-width:38px;padding:0;justify-content:center}.fresh-enterprise-switch span{display:none}}';
    document.head.appendChild(style);
  }

  function updateAccount(user, features) {
    ensureProjectStyles();
    const link = document.querySelector('.fresh-user-link');
    if (!link) return;
    const label = link.querySelector('span');
    const nickname = String(user.nickname || '').trim();
    const displayName = nickname && !/^[?？\uFFFD]+$/.test(nickname) ? nickname : user.username;
    const roleText = user.role === 'admin' ? '管理员账号' : '普通用户账号';
    if (label) label.textContent = '账号：' + displayName;
    link.href = '#';
    link.title = '账号菜单';
    link.setAttribute('aria-haspopup', 'menu');
    link.setAttribute('aria-expanded', 'false');

    const wrapper = document.createElement('div');
    wrapper.className = 'fresh-account';
    link.parentElement.insertBefore(wrapper, link);
    wrapper.appendChild(link);

    const customerProjectCount = Number(features && features.customerProjectCount || 0);
    const customerUnreadCount = Number(features && features.customerUnreadCount || 0);
    if (customerProjectCount > 0) {
      const customerSwitch = document.createElement('a');
      customerSwitch.className = 'fresh-enterprise-switch fresh-customer-switch';
      customerSwitch.href = 'customer-projects.html';
      customerSwitch.title = customerUnreadCount > 0
        ? `我的装修公司有 ${customerUnreadCount} 条新提醒`
        : '查看我的装修公司';
      customerSwitch.setAttribute('aria-label', '查看我的装修公司');
      customerSwitch.innerHTML = menuIcon('project') + `<span>我的装修公司${customerUnreadCount > 0 ? ` ${customerUnreadCount}` : ''}</span>`;
      wrapper.parentElement.insertBefore(customerSwitch, wrapper);
    }

    const enterpriseDiscoverable = Boolean(features && (features.enterprise || features.enterpriseAvailable));
    const enterpriseEntryLabel = features && features.enterprise
      ? '企业版'
      : (Number(features && features.enterpriseSuspendedWorkspaceCount || 0) > 0 ? '企业版 · 续费' : '企业版 · 开通');
    if (enterpriseDiscoverable) {
      const enterpriseSwitch = document.createElement('a');
      enterpriseSwitch.className = 'fresh-enterprise-switch';
      enterpriseSwitch.href = 'enterprise.html';
      enterpriseSwitch.title = features.enterprise ? '从个人版切换到企业版' : '查看企业版开通或加入方式';
      enterpriseSwitch.setAttribute('aria-label', '进入装修小账本企业版');
      enterpriseSwitch.innerHTML = menuIcon('project') + '<span>' + enterpriseEntryLabel + '</span>';
      wrapper.parentElement.insertBefore(enterpriseSwitch, wrapper);
    }

    const menu = document.createElement('div');
    menu.className = 'fresh-account-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    menu.innerHTML =
      '<div class="fresh-account-user"><b>' + escapeHtml(displayName) + '</b><span>' + roleText + '</span></div>' +
      '<div class="fresh-account-status"><i></i><span>已同步</span></div>' +
      '<section class="fresh-douyin-card" aria-label="抖音关注">' +
        '<div class="fresh-douyin-head"><span class="fresh-douyin-logo">' + menuIcon('video') + '</span><div><b>关注我的抖音</b><span>装修避坑和选品经验</span></div></div>' +
        '<div class="fresh-douyin-main"><div class="fresh-douyin-qr"><img src="assets/brand/douyin-qr-thumb.png" alt="金大金自装日记抖音二维码" loading="lazy"></div>' +
        '<div class="fresh-douyin-copy"><p><b>主包为爱发电</b><span>网站对你有帮助的话<br>抖音点个免费关注吧</span></p><strong>@金大金自装日记</strong></div></div>' +
      '</section>' +
      '<a href="customer-projects.html" role="menuitem">' + menuIcon('project') + '<span>' + (customerUnreadCount > 0 ? '我的装修公司（' + customerUnreadCount + ' 条提醒）' : (customerProjectCount > 0 ? '我的装修公司' : '绑定装修公司')) + '</span></a>' +
      (enterpriseDiscoverable ? '<a href="enterprise.html" role="menuitem">' + menuIcon('project') + '<span>' + (features.enterprise ? '进入企业版' : enterpriseEntryLabel) + '</span></a>' : '') +
      '<a href="account.html" role="menuitem">' + menuIcon('account') + '<span>账号管理</span></a>' +
      (user.role === 'admin' ? '<a href="admin.html" role="menuitem">' + menuIcon('admin') + '<span>管理后台</span></a>' : '') +
      '<button type="button" data-account-action="clear" class="account-danger" role="menuitem">' + menuIcon('trash') + '<span>清空数据</span></button>' +
      '<button type="button" data-account-action="switch" role="menuitem">' + menuIcon('switch') + '<span>切换账号</span></button>' +
      '<button type="button" data-account-action="logout" role="menuitem">' + menuIcon('logout') + '<span>退出登录</span></button>';
    wrapper.appendChild(menu);
    const projectCard = document.createElement('section');
    projectCard.className = 'fresh-project-card fresh-project-nav';
    projectCard.setAttribute('aria-label', '项目管理');
    projectCard.innerHTML =
      '<div class="fresh-project-head"><b>项目</b><span class="fresh-project-head-actions"><button type="button" data-account-action="edit-project">项目资料</button></span></div>' +
      '<select class="fresh-project-select" data-project-select aria-label="切换装修项目"><option>正在读取项目...</option></select>' +
      '<small>不同项目之间的数据相互独立。</small>';
    const projectToggle = document.createElement('button');
    projectToggle.type = 'button';
    projectToggle.className = 'fresh-project-toggle';
    projectToggle.title = '切换项目';
    projectToggle.setAttribute('aria-label', '切换项目');
    projectToggle.innerHTML = menuIcon('switch');
    const projectPopover = document.createElement('div');
    projectPopover.className = 'fresh-project-popover';
    projectPopover.hidden = true;
    projectPopover.innerHTML =
      '<div class="fresh-project-popover-head"><b>项目</b><span class="fresh-project-head-actions"><button type="button" data-account-action="edit-project">项目资料</button></span></div>' +
      '<select class="fresh-project-select" data-project-select aria-label="切换装修项目"><option>正在读取项目...</option></select>' +
      '<small>不同项目之间的数据相互独立。</small>';
    const projectHost = document.querySelector('[data-project-host]');
    if (projectHost) {
      projectHost.replaceChildren(projectCard);
    } else {
      wrapper.parentElement.insertBefore(projectCard, wrapper);
    }
    wrapper.parentElement.insertBefore(projectToggle, wrapper);
    document.body.appendChild(projectPopover);

    link.addEventListener('click', (event) => {
      event.preventDefault();
      menu.hidden = !menu.hidden;
      link.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-account-action]');
      if (!button) return;
      const action = button.dataset.accountAction;
      button.disabled = true;
      try {
        if (action === 'clear') await clearAccountData();
        else await logoutAndRedirect(action);
      } finally {
        button.disabled = false;
      }
    });
    document.addEventListener('click', (event) => {
      if (wrapper.contains(event.target)) return;
      menu.hidden = true;
      link.setAttribute('aria-expanded', 'false');
    });
    window.addEventListener('cloud-sync-status', (event) => {
      const status = menu.querySelector('.fresh-account-status');
      status.dataset.state = event.detail.state;
      status.querySelector('span').textContent = event.detail.text;
    });
    projectCard.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-account-action]');
      if (!button) return;
      if (button.dataset.accountAction === 'edit-project') openProjectEditDialog();
    });
    projectPopover.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-account-action]');
      if (!button) return;
      projectPopover.hidden = true;
      if (button.dataset.accountAction === 'edit-project') openProjectEditDialog();
    });
    projectToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      projectPopover.hidden = !projectPopover.hidden;
    });
    const projectSelect = projectCard.querySelector('[data-project-select]');
    projectSelect.addEventListener('change', () => switchProject(projectSelect.value));
    projectPopover.querySelector('[data-project-select]').addEventListener('change', (event) => {
      projectPopover.hidden = true;
      switchProject(event.target.value);
    });
    document.addEventListener('click', (event) => {
      if (projectPopover.hidden) return;
      if (projectPopover.contains(event.target) || projectToggle.contains(event.target)) return;
      projectPopover.hidden = true;
    });
    renderProjectMenu();
  }

  function renderProjectMenu() {
    document.querySelectorAll('[data-project-select]').forEach((select) => {
      const projects = projectsState.projects || [];
      select.innerHTML = projects.length
        ? projects.map((project) => '<option value="' + escapeHtml(project.id) + '">' + escapeHtml((project.name || '未命名项目') + (Number(project.area) > 0 ? ' · ' + project.area + '㎡' : '')) + '</option>').join('')
        : '<option value="">我的装修</option>';
      select.value = currentProjectId || (projects[0] && projects[0].id) || '';
      select.disabled = projects.length === 0;
    });
  }

  async function loadProjects(epoch = operationEpoch) {
    const migrationQuery = currentProjectId ? '?current_project_id=' + encodeURIComponent(currentProjectId) : '';
    const result = await api('/api/projects' + migrationQuery);
    if (epoch !== operationEpoch || stalePage) return null;
    projectsState = {
      projects: result.projects || [],
      multiProjectEnabled: !!result.multiProjectEnabled
    };
    currentProjectId = result.currentProjectId || result.defaultProjectId || (projectsState.projects[0] && projectsState.projects[0].id) || '';
    if (currentProjectId) originalSetItem.call(localStorage, CURRENT_PROJECT_KEY, currentProjectId);
    renderProjectMenu();
    return result;
  }

  function openProjectEditDialog() {
    const project = (projectsState.projects || []).find((item) => item.id === currentProjectId);
    if (!project) return;
    const dialog = ensureProjectDialog();
    dialog.dataset.projectId = project.id;
    dialog.querySelector('h2').textContent = '编辑装修项目';
    dialog.querySelector('p').textContent = '修改后会同步到小程序和其他设备，已有装修数据不会删除。';
    dialog.querySelector('[data-project-name-wrap]').hidden = false;
    dialog.querySelector('[data-project-confirm]').hidden = false;
    dialog.querySelector('[data-project-confirm]').textContent = '保存';
    dialog.querySelector('[data-project-cancel]').textContent = '取消';
    dialog.querySelector('.fresh-project-error').hidden = true;
    setProjectForm(dialog, project);
    dialog.hidden = false;
    dialog.querySelector('[data-project-name]').focus();
  }

  function setProjectForm(dialog, project) {
    dialog.querySelector('[data-project-name]').value = project.name || '';
    dialog.querySelector('[data-project-area]').value = Number(project.area) > 0 ? project.area : '';
    dialog.querySelector('[data-project-mode]').value = project.modeKey === 'old' ? 'old' : 'new';
    dialog.querySelector('[data-project-start]').value = project.startDate || '';
  }

  function closeProjectDialog() {
    const dialog = document.querySelector('.fresh-project-dialog');
    if (dialog) dialog.hidden = true;
  }

  function ensureProjectDialog() {
    let dialog = document.querySelector('.fresh-project-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.className = 'fresh-project-dialog';
    dialog.hidden = true;
    dialog.innerHTML =
      '<div class="fresh-project-backdrop" data-project-cancel></div>' +
      '<section class="fresh-project-panel" role="dialog" aria-modal="true">' +
        '<h2>编辑装修项目</h2>' +
        '<p>修改后会同步到小程序和其他设备，已有装修数据不会删除。</p>' +
        '<div class="fresh-project-fields" data-project-name-wrap>' +
          '<label>项目名称<input data-project-name type="text" maxlength="100" placeholder="例如：湖畔新家"></label>' +
          '<label>建筑面积（㎡）<input data-project-area type="number" min="0.1" max="100000" step="0.1" placeholder="例如：89"></label>' +
          '<label>装修类型<select data-project-mode><option value="new">新房毛坯</option><option value="old">旧房改造</option></select></label>' +
          '<label>计划开工日期<input data-project-start type="date"></label>' +
        '</div>' +
        '<div class="fresh-project-error" hidden></div>' +
        '<div class="fresh-project-actions">' +
          '<button type="button" data-project-cancel>取消</button>' +
          '<button type="button" class="primary" data-project-confirm>保存</button>' +
        '</div>' +
      '</section>';
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-project-cancel]')) closeProjectDialog();
    });
    dialog.querySelector('[data-project-name]').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') confirmProjectSave();
    });
    dialog.querySelector('[data-project-confirm]').addEventListener('click', confirmProjectSave);
    return dialog;
  }

  async function confirmProjectSave() {
    const dialog = ensureProjectDialog();
    const input = dialog.querySelector('[data-project-name]');
    const errorEl = dialog.querySelector('.fresh-project-error');
    const confirmBtn = dialog.querySelector('[data-project-confirm]');
    const name = input.value.trim();
    const area = Number(dialog.querySelector('[data-project-area]').value);
    const modeKey = dialog.querySelector('[data-project-mode]').value === 'old' ? 'old' : 'new';
    const startDate = dialog.querySelector('[data-project-start]').value || null;
    const editingProjectId = dialog.dataset.projectId || '';
    if (!editingProjectId) {
      errorEl.textContent = '当前项目不存在';
      errorEl.hidden = false;
      return;
    }
    if (!name) {
      errorEl.textContent = '请输入项目名称';
      errorEl.hidden = false;
      return;
    }
    if (!(area > 0)) {
      errorEl.textContent = '请输入有效的建筑面积';
      errorEl.hidden = false;
      return;
    }
    confirmBtn.disabled = true;
    errorEl.hidden = true;
    try {
      await api('/api/projects/' + encodeURIComponent(editingProjectId), {
        method: 'PATCH',
        body: JSON.stringify({ name, area, modeKey, startDate })
      });
      closeProjectDialog();
      await loadProjects();
      renderProjectMenu();
    } catch (error) {
      errorEl.textContent = error.message || '保存项目失败';
      errorEl.hidden = false;
    } finally {
      confirmBtn.disabled = false;
    }
  }

  async function switchProject(projectId) {
    if (!projectId || projectId === currentProjectId) return;
    const target = (projectsState.projects || []).find((project) => project.id === projectId);
    if (!target) return;
    const accepted = confirm('切换到“' + (target.name || '未命名项目') + '”？\n\n切换后会加载该项目的独立数据。');
    if (!accepted) {
      renderProjectMenu();
      return;
    }
    if (!await saveNow()) {
      renderProjectMenu();
      return;
    }
    const requestEpoch = ++operationEpoch;
    ready = false;
    updateStatus('loading', '正在切换项目');
    try {
      const remote = await api('/api/sync?project_id=' + encodeURIComponent(projectId));
      if (requestEpoch !== operationEpoch || !hasCurrentCache()) return;
      await api('/api/projects/current', {
        method: 'PUT',
        body: JSON.stringify({ currentProjectId: projectId })
      });
      if (requestEpoch !== operationEpoch || !hasCurrentCache()) return;
      clearTrackedData();
      currentProjectId = projectId;
      originalSetItem.call(localStorage, CURRENT_PROJECT_KEY, currentProjectId);
      originalSetItem.call(localStorage, OWNER_KEY, String(currentUser.id));
      conflict = false;
      version = Number(remote.version || 0);
      const pending = readPending();
      applyRemote(pending ? pending.data : (remote.data || {}), pending ? pending.baseVersion : version);
      ready = true;
      updateStatus(pending ? 'loading' : 'saved', pending ? '正在恢复本机修改' : '已同步');
      location.reload();
    } catch (error) {
      if (requestEpoch !== operationEpoch || stalePage) return;
      ready = true;
      updateStatus('error', '项目切换失败');
      alert(error.message || '项目切换失败');
      renderProjectMenu();
    }
  }

  function requiresEmailBinding(user) {
    return user &&
      user.role !== 'admin' &&
      !user.reviewAccount &&
      !user.emailBound &&
      currentPageName() !== 'account.html';
  }

  function openEmailRequiredDialog() {
    let dialog = document.querySelector('.fresh-email-required-dialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.className = 'fresh-email-required-dialog';
      dialog.innerHTML =
        '<div class="fresh-email-required-backdrop"></div>' +
        '<section class="fresh-email-required-panel" role="dialog" aria-modal="true" aria-labelledby="emailRequiredTitle">' +
          '<span class="fresh-email-required-icon">' + menuIcon('account') + '</span>' +
          '<h2 id="emailRequiredTitle">&#35831;&#20808;&#32465;&#23450;&#37038;&#31665;</h2>' +
          '<p>&#30001;&#20110;&#36817;&#26399;&#29992;&#25143;&#37327;&#24555;&#36895;&#22686;&#38271;&#65292;&#24182;&#20986;&#29616;&#25209;&#37327;&#27880;&#20876;&#31561;&#24322;&#24120;&#34892;&#20026;&#65292;&#29616;&#24050;&#24320;&#21551;&#37038;&#31665;&#32465;&#23450;&#19982;&#37038;&#31665;&#27880;&#20876;&#21151;&#33021;&#12290;</p>' +
          '<strong>&#20026;&#20102;&#20445;&#25252;&#20320;&#30340;&#36134;&#21495;&#21644;&#35013;&#20462;&#25968;&#25454;&#23433;&#20840;&#65292;&#26410;&#32465;&#23450;&#37038;&#31665;&#30340;&#26222;&#36890;&#36134;&#21495;&#38656;&#35201;&#20808;&#23436;&#25104;&#32465;&#23450;&#12290;&#21542;&#21017;&#24536;&#35760;&#23494;&#30721;&#26102;&#23558;&#26080;&#27861;&#36890;&#36807;&#37038;&#20214;&#25214;&#22238;&#12290;</strong>' +
          '<div class="fresh-email-required-actions">' +
            '<button type="button" class="fresh-email-required-secondary" data-email-required-switch>&#20999;&#25442;&#36134;&#21495;</button>' +
            '<button type="button" class="fresh-email-required-primary" data-email-required-bind>&#21435;&#32465;&#23450;&#37038;&#31665;</button>' +
          '</div>' +
        '</section>';
      document.body.appendChild(dialog);
      dialog.querySelector('[data-email-required-bind]').addEventListener('click', () => {
        location.href = 'account.html#email';
      });
      dialog.querySelector('[data-email-required-switch]').addEventListener('click', () => {
        logoutAndRedirect('switch');
      });
    }
    dialog.hidden = false;
    document.body.classList.add('email-required-open');
    dialog.querySelector('[data-email-required-bind]').focus();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function menuIcon(name) {
    const paths = {
      account: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
      project: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5V3h8v2M8 10h8M8 14h5"/>',
      admin: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 7h5M18.5 4.5v5"/>',
      switch: '<path d="M5 7h12M14 4l3 3-3 3M19 17H7M10 14l-3 3 3 3"/>',
      logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/>',
      trash: '<path d="M5 7h14M9 7V5h6v2M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14"/>',
      video: '<path d="M5.5 7.5h9A2.5 2.5 0 0 1 17 10v4a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 14v-4a2.5 2.5 0 0 1 2.5-2.5z"/><path d="m17 11 4-2.5v7L17 13"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 19a2 2 0 0 0 4 0"/>'
    };
    return '<svg viewBox="0 0 24 24" class="fresh-svg" aria-hidden="true">' + paths[name] + '</svg>';
  }

  function clearLocalAccountData() {
    clearTrackedData();
  }

  async function clearAccountData() {
    if (!hasCurrentCache()) return false;
    const accepted = confirm('确定清空当前账号的全部装修数据吗？\n\n清空后，本机和云端的预算、待办、采购、记账、流程进度及日记数据都将删除，且无法恢复。');
    if (!accepted) return false;
    updateStatus('saving', '正在清空');
    // Keep the current user/project identity so the deletion is synced to this project.
    applying = true;
    try { TRACKED_KEYS.forEach((key) => originalRemoveItem.call(localStorage, key)); }
    finally { applying = false; }
    observedData = collectData();
    await saveNow();
    if (document.documentElement.dataset.syncState !== 'saved') {
      alert('数据清空未能同步到云端，请检查网络后重试。');
      return false;
    }
    alert('当前账号的装修数据已清空。');
    location.reload();
    return true;
  }

  async function logoutAndRedirect(mode) {
    if (stalePage || !hasCurrentCache()) return false;
    updateStatus('saving', '正在保存');
    const saved = await saveNow();
    if (!saved) {
      alert('当前还有未成功同步的数据。为避免数据丢失，暂时没有退出，请先处理同步提示后重试。');
      return false;
    }
    const requestEpoch = operationEpoch;
    await api('/api/logout', { method: 'POST' });
    if (requestEpoch !== operationEpoch || !hasCurrentCache()) return false;
    clearLocalAccountData();
    redirectToLogin(mode);
    return true;
  }

  async function initialize() {
    if (stalePage) { pauseStalePage(); return; }
    const requestEpoch = ++operationEpoch;
    if (location.protocol === 'file:' && !isPublicPage()) {
      redirectToLogin();
      return;
    }
    ready = false;
    captureReady = false;
    clearTimeout(saveTimer);
    const localOwner = localStorage.getItem(OWNER_KEY);
    const localProject = currentProjectId;
    const localVersion = Number(localStorage.getItem(VERSION_KEY) || 0);
    try {
      const me = await api('/api/me');
      if (requestEpoch !== operationEpoch || stalePage) return;
      const accountChanged = !currentUser || currentUser.id !== me.user.id;
      currentUser = me.user;
      if (accountChanged) updateAccount(me.user, me.features);
      if (requiresEmailBinding(me.user)) openEmailRequiredDialog();
      if (!await loadProjects(requestEpoch)) return;
      const scopeMatches = localOwner === String(currentUser.id) && localProject === currentProjectId;
      const retained = readPending();
      version = retained ? Number(retained.baseVersion || 0) : (scopeMatches ? localVersion : 0);
      if (!scopeMatches) {
        // Session expiry clears the rendered account data, but not its pending
        // snapshot. Restore it before a failed GET can expose an empty editor.
        const restored = applyRemote(retained ? retained.data : {}, version);
        originalSetItem.call(localStorage, OWNER_KEY, String(currentUser.id));
        if (restored) { location.reload(); return; }
      }
      captureReady = true;
      if (!hasCurrentCache()) return;
      updateStatus('loading', '正在同步');
      const remote = await api(syncPath());
      if (requestEpoch !== operationEpoch || !hasCurrentCache()) return;
      const remoteVersion = Number(remote.version || 0);
      acknowledgedData = { ...(remote.data || {}) };
      const pending = readPending();
      let changed = false;
      conflict = false;
      if (pending && !sameData(pending.data, remote.data || {})) {
        // Keep the original version for conflict detection, never bless stale local data
        // with the server's newer version merely because a GET succeeded.
        changed = applyRemote(pending.data, Number(pending.baseVersion || 0));
        ready = true;
        if (remoteVersion !== version) {
          conflict = true;
          archiveConflict('startup-conflict', remoteVersion);
          updateStatus('conflict', '发现同步冲突，本机数据已保留');
        } else if (pending.manualReview) {
          updateStatus('restored', '备份已恢复到本机；点击确认同步恢复数据后才会替换云端记录');
        } else {
          await saveNow();
          if (requestEpoch !== operationEpoch || stalePage) return;
        }
      } else {
        changed = applyRemote(remote.data || {}, remoteVersion);
        originalRemoveItem.call(localStorage, pendingKey());
        ready = true;
        updateStatus('saved', '已同步');
      }
      if (changed && sessionStorage.getItem(APPLIED_KEY) !== appliedVersionKey()) {
        originalSetItem.call(sessionStorage, APPLIED_KEY, appliedVersionKey());
        originalSetItem.call(localStorage, OWNER_KEY, String(currentUser.id));
        location.reload();
      }
      originalSetItem.call(localStorage, OWNER_KEY, String(currentUser.id));
    } catch (error) {
      if (requestEpoch !== operationEpoch || stalePage) return;
      if (error.status === 401) {
        redirectToLogin();
        return;
      } else {
        // A failed GET must not disable recovery of an already persisted draft.
        try {
          const pending = readPending();
          if (pending) { version = Number(pending.baseVersion || 0); ready = true; }
        } catch (_) { /* Leave malformed pending data intact for export. */ }
        updateStatus('error', '同步不可用');
      }
    }
  }

  window.ZhuangxiuSync = { saveNow, collectData, logoutAndRedirect, checkRemoteUpdates,
    listConflictBackups, exportBackup, useCloudVersion, restoreConflictBackup,
    setEditing: (editing) => { formDirty = Boolean(editing); } };
  initialize();
})();
