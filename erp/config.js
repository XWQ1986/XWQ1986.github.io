/* ============================================================
 * 云端配置（已配置：Supabase 项目 hc-erp · 东京节点）
 * ------------------------------------------------------------
 * SUPABASE_URL      : 项目地址
 * SUPABASE_ANON_KEY : anon public 密钥（可公开，受行级安全保护）
 * 注意：不要把数据库密码、service_role 密钥写进本文件，本文件会公开发布
 * ============================================================ */

window.HC_CONFIG = {
  SUPABASE_URL: 'https://fqrtoqnwxpileazohbvr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcnRvcW53eHBpbGVhem9oYnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDE3ODIsImV4cCI6MjEwOTM3Nzc4Mn0.fv2J5Ue2GmuKKmcAc0JMrCd-GgbQlV2ryjYs_Oo082U',

  /* 附件存储桶（私有）。若控制台建桶时用了别的名字，改这里即可 */
  STORAGE_BUCKET: 'tenant-files',

  /* 单文件上限（MB）：图片会先压缩，DWG/PDF/Office 按此上限校验 */
  MAX_FILE_MB: 20,

  /* 单次最多选择文件数 */
  MAX_FILES_PER_PICK: 20
};
