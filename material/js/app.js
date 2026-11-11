// Web 管理后台 SPA
const pageTitles = {
  users: '用户管理',
  categories: '一级分类管理',
  spaces: '空间选项管理',
  templates: '全局前置PDF模板',
  footer: '全局尾页文案',
  config: '系统配置',
  logs: '日志中心'
};

let currentPage = 'users';

async function init() {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
  if (!userInfo || userInfo.role !== 'admin') { location.href = 'login.html'; return; }
  document.getElementById('userName').textContent = userInfo.name || userInfo.username;
  document.querySelectorAll('.menu-item').forEach(el => {
    el.onclick = () => switchPage(el.dataset.page);
  });
  switchPage('users');
}

function logout() {
  localStorage.clear();
  location.href = 'login.html';
}

function switchPage(page) {
  currentPage = page;
  document.getElementById('pageTitle').textContent = pageTitles[page];
  document.querySelectorAll('.menu-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const renderers = { users: renderUsers, categories: renderCategories, spaces: renderSpaces, templates: renderTemplates, footer: renderFooter, config: renderConfig, logs: renderLogs };
  (renderers[page] || (() => {}))();
}

// ========== 用户管理 ==========
async function renderUsers() {
  const users = await api.get('/api/admin/users');
  const rows = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.name || '-'}</td>
      <td>${u.phone || '-'}</td>
      <td>${u.role === 'admin' ? '<span class="tag tag-blue">管理员</span>' : '<span class="tag tag-gray">设计师</span>'}</td>
      <td>${u.enabled ? '<span class="tag tag-green">启用</span>' : '<span class="tag tag-red">禁用</span>'}</td>
      <td>${u.created_at}</td>
      <td>
        ${u.role !== 'admin' ? `<button class="btn-ghost btn-sm" onclick="toggleUser(${u.id})">${u.enabled ? '禁用' : '启用'}</button>
        <button class="btn-danger btn-sm" onclick="delUser(${u.id})">删除</button>` : '-'}
      </td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>设计师账号列表</h2>
      <table><thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>电话</th><th>角色</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" class="empty">暂无用户</td></tr>'}</tbody></table>
    </div>`;
}
async function toggleUser(id) {
  await api.post(`/api/admin/users/${id}/toggle`);
  renderUsers();
}
function delUser(id) {
  if (!confirm('确定删除该用户及其所有数据？')) return;
  api.del(`/api/admin/users/${id}`).then(renderUsers);
}

// ========== 一级分类管理 ==========
async function renderCategories() {
  const list = await api.get('/api/categories');
  const rows = list.map(c => `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.sort_order}</td><td><button class="btn-danger btn-sm" onclick="delCategory(${c.id})">删除</button></td></tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>一级分类</h2>
      <div class="form-row">
        <div class="field"><label>新增分类</label><input id="newCat" placeholder="如：石材" /></div>
        <button class="btn-primary" onclick="addCategory()">添加</button>
      </div>
      <table><thead><tr><th>ID</th><th>名称</th><th>排序</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}
async function addCategory() {
  const name = document.getElementById('newCat').value.trim();
  if (!name) return;
  await api.post('/api/categories', { name });
  renderCategories();
}
function delCategory(id) {
  if (!confirm('删除该分类？')) return;
  api.del(`/api/categories/${id}`).then(renderCategories);
}

// ========== 空间选项管理 ==========
async function renderSpaces() {
  const list = await api.get('/api/spaces');
  const rows = list.map(s => `<tr><td>${s.id}</td><td><input value="${s.name}" onchange="updateSpace(${s.id}, this.value)" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;" /></td><td>${s.sort_order}</td><td><button class="btn-danger btn-sm" onclick="delSpace(${s.id})">删除</button></td></tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>空间下拉选项</h2>
      <div class="form-row">
        <div class="field"><label>新增空间</label><input id="newSpace" placeholder="如：玄关" /></div>
        <button class="btn-primary" onclick="addSpace()">添加</button>
      </div>
      <table><thead><tr><th>ID</th><th>名称</th><th>排序</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}
async function addSpace() {
  const name = document.getElementById('newSpace').value.trim();
  if (!name) return;
  await api.post('/api/spaces', { name });
  renderSpaces();
}
async function updateSpace(id, name) {
  await api.put(`/api/spaces/${id}`, { name });
}
function delSpace(id) {
  if (!confirm('删除该空间选项？')) return;
  api.del(`/api/spaces/${id}`).then(renderSpaces);
}

// ========== 全局前置PDF模板 ==========
async function renderTemplates() {
  const list = await api.get('/api/templates/front');
  const rows = list.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.name || t.file_path}</td>
      <td><a href="${t.file_url}" target="_blank">预览</a></td>
      <td>${t.sort_order}</td>
      <td>
        <button class="btn-ghost btn-sm" onclick="moveTpl(${t.id}, -1)">上移</button>
        <button class="btn-ghost btn-sm" onclick="moveTpl(${t.id}, 1)">下移</button>
        <button class="btn-danger btn-sm" onclick="delTpl(${t.id})">删除</button>
      </td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>全局前置PDF页面（公司封面、名头、简介、服务流程等）</h2>
      <div class="form-row">
        <div class="field"><label>上传PDF页面</label><input type="file" id="tplFile" accept="application/pdf" /></div>
        <div class="field"><label>名称</label><input id="tplName" placeholder="如：公司封面" /></div>
        <button class="btn-primary" onclick="uploadTpl()">上传</button>
      </div>
      <table><thead><tr><th>ID</th><th>名称</th><th>预览</th><th>排序</th><th>操作</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="empty">暂无模板</td></tr>'}</tbody></table>
    </div>`;
  window._tplList = list;
}
async function uploadTpl() {
  const file = document.getElementById('tplFile').files[0];
  const name = document.getElementById('tplName').value.trim();
  if (!file) { alert('请选择文件'); return; }
  await api.upload('/api/templates/front', file, { name });
  renderTemplates();
}
function delTpl(id) {
  if (!confirm('删除该模板？')) return;
  api.del(`/api/templates/front/${id}`).then(renderTemplates);
}
async function moveTpl(id, dir) {
  const list = window._tplList;
  const idx = list.findIndex(t => t.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
  const ids = list.map(t => t.id);
  await api.post('/api/templates/front/sort', { ids });
  renderTemplates();
}

// ========== 全局尾页文案 ==========
async function renderFooter() {
  const content = await api.get('/api/templates/footer');
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>全局温馨提示 & 售后避坑尾页文案</h2>
      <div class="rich-toolbar">
        <button onclick="execCmd('bold')"><b>B</b></button>
        <button onclick="execCmd('italic')"><i>I</i></button>
        <button onclick="execCmd('underline')"><u>U</u></button>
        <button onclick="execCmd('insertUnorderedList')">• 列表</button>
        <button onclick="execCmd('formatBlock', 'p')">段落</button>
        <button onclick="execCmd('formatBlock', 'h3')">标题</button>
      </div>
      <div id="editor" class="rich-editor" contenteditable="true"></div>
      <div style="margin-top:16px;"><button class="btn-primary" onclick="saveFooter()">保存全局尾页文案</button></div>
    </div>`;
  document.getElementById('editor').innerHTML = content || '';
}
function execCmd(cmd, val = null) { document.execCommand(cmd, false, val); document.getElementById('editor').focus(); }
async function saveFooter() {
  const html = document.getElementById('editor').innerHTML;
  await api.put('/api/templates/footer', { content: html });
  alert('保存成功');
}

// ========== 系统配置 ==========
async function renderConfig() {
  const cfg = await api.get('/api/admin/config');
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>系统配置</h2>
      <h3 style="margin-top:20px;color:#2E6DB4;">NAS 同步</h3>
      <div class="form-row"><div class="field"><label>NAS通信地址</label><input id="cfg_nas_url" value="${cfg.nas_url || ''}" /></div>
        <div class="field"><label>NAS鉴权Token</label><input id="cfg_nas_auth_token" value="${cfg.nas_auth_token || ''}" /></div></div>
      <div class="form-row"><div class="field"><label>Obsidian归档根目录</label><input id="cfg_obsidian_root" value="${cfg.obsidian_root || ''}" /></div>
        <div class="field"><label>文件命名模板</label><input id="cfg_file_naming_template" value="${cfg.file_naming_template || ''}" /></div></div>
      <h3 style="margin-top:20px;color:#2E6DB4;">PDF 模板</h3>
      <div class="form-row"><div class="field"><label>PDF页眉模板</label><input id="cfg_pdf_header_template" value="${cfg.pdf_header_template || ''}" /></div>
        <div class="field"><label>PDF页脚模板</label><input id="cfg_pdf_footer_template" value="${cfg.pdf_footer_template || ''}" /></div></div>
      <h3 style="margin-top:20px;color:#2E6DB4;">OCR 文字识别 <span style="font-size:12px;color:#999;font-weight:normal;">（用于自动识别标签图内容填入对应字段）</span></h3>
      <div class="form-row"><div class="field"><label>OCR 引擎</label>
        <select id="cfg_ocr_engine" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
          <option value="paddle" ${cfg.ocr_engine==='paddle'?'selected':''}>本地 PaddleOCR（推荐，中文最佳）</option>
          <option value="baidu" ${cfg.ocr_engine==='baidu'?'selected':''}>百度 OCR（需配置密钥）</option>
          <option value="ocrspace" ${cfg.ocr_engine==='ocrspace'?'selected':''}>OCR.space 免费版</option>
          <option value="auto" ${(!cfg.ocr_engine||cfg.ocr_engine==='auto')?'selected':''}>自动（PaddleOCR优先，失败降级）</option>
        </select></div>
        <div class="field"><label>当前引擎</label><input value="${cfg.ocr_engine||'auto'}" readonly style="background:#f5f5f5;" /></div></div>
      <div class="form-row"><div class="field"><label>百度OCR API Key</label><input id="cfg_ocr_api_key" value="${cfg.ocr_api_key || ''}" placeholder="选填，引擎选百度时需要" /></div>
        <div class="field"><label>百度OCR Secret Key</label><input id="cfg_ocr_secret_key" value="${cfg.ocr_secret_key || ''}" placeholder="选填，引擎选百度时需要" /></div></div>
      <div class="form-row"><div class="field"><label>自定义OCR接口URL（可选）</label><input id="cfg_ocr_api_url" value="${cfg.ocr_api_url || ''}" placeholder="留空则使用内置引擎" /></div>
        <div class="field"><label>&nbsp;</label><div style="padding:8px 0;font-size:12px;color:#666;">PaddleOCR 首次使用需安装：<code>pip install rapidocr-onnxruntime</code></div></div></div>
      <div style="margin-top:12px;padding:10px;background:#fff8e1;border-radius:4px;font-size:12px;color:#666;line-height:1.6;">
        说明：PaddleOCR 为本地识别，无需联网、无调用次数限制，中文识别准确率最高。百度OCR 需在 <a href="https://cloud.baidu.com" target="_blank">百度智能云</a> 创建文字识别应用获取密钥。
      </div>
      <button class="btn-primary" onclick="saveConfig()">保存配置</button>
    </div>`;
}
async function saveConfig() {
  const keys = ['nas_url', 'nas_auth_token', 'obsidian_root', 'file_naming_template', 'pdf_header_template', 'pdf_footer_template', 'ocr_engine', 'ocr_api_key', 'ocr_secret_key', 'ocr_api_url'];
  const cfg = {};
  keys.forEach(k => cfg[k] = document.getElementById('cfg_' + k).value);
  await api.put('/api/admin/config', cfg);
  alert('保存成功');
}

// ========== 日志中心 ==========
async function renderLogs() {
  document.getElementById('content').innerHTML = `
    <div class="card"><h2>日志中心</h2>
      <div class="form-row">
        <div class="field"><label>类型</label>
          <select id="logType"><option value="">全部</option><option value="upload">上传日志</option><option value="nas">NAS同步日志</option><option value="pdf">PDF生成日志</option><option value="system">系统日志</option></select>
        </div>
        <div class="field"><label>级别</label>
          <select id="logLevel"><option value="">全部</option><option value="info">信息</option><option value="error">错误</option></select>
        </div>
        <button class="btn-primary" onclick="loadLogs()">查询</button>
      </div>
      <div id="logTable"></div>
    </div>`;
  loadLogs();
}
async function loadLogs() {
  const type = document.getElementById('logType').value;
  const level = document.getElementById('logLevel').value;
  let url = '/api/logs?';
  if (type) url += 'type=' + type + '&';
  if (level) url += 'level=' + level;
  const list = await api.get(url);
  const rows = list.map(l => `<tr><td>${l.id}</td><td><span class="tag ${l.type === 'nas' ? 'tag-blue' : (l.type === 'pdf' ? 'tag-gray' : 'tag-green')}">${l.type}</span></td><td><span class="tag ${l.level === 'error' ? 'tag-red' : 'tag-green'}">${l.level}</span></td><td style="max-width:500px;word-break:break-all;">${l.message}</td><td>${l.created_at}</td></tr>`).join('');
  document.getElementById('logTable').innerHTML = `<table><thead><tr><th>ID</th><th>类型</th><th>级别</th><th>内容</th><th>时间</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">暂无日志</td></tr>'}</tbody></table>`;
}

init();
