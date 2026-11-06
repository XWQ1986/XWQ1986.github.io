-- ============================================================
-- migration_v3.sql · 超管重置租户密码
-- 用法：整段粘贴到 Supabase 控制台 → SQL Editor → Run
-- 说明：security definer 函数，内部强制校验调用者必须是超管；
--       密码以 bcrypt 哈希写入 auth.users，不落明文。
-- ============================================================

create extension if not exists pgcrypto;

create or replace function public.hc_admin_reset_password(p_user_id uuid, p_password text)
returns json
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_super_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_password is null or length(p_password) < 6 then
    return json_build_object('ok', false, 'error', 'weak_password');
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.hc_admin_reset_password(uuid, text) from public;
grant execute on function public.hc_admin_reset_password(uuid, text) to authenticated;
