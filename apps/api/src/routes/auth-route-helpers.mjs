export function readRegisterPayload(body) {
  return {
    bio: typeof body?.bio === "string" ? body.bio.trim() : "",
    password: typeof body?.password === "string" ? body.password : "",
    realName: typeof body?.realName === "string" ? body.realName.trim() : "",
    userId: typeof body?.userId === "string" ? body.userId.trim() : "",
  };
}

export function readLoginPayload(body) {
  return {
    password: typeof body?.password === "string" ? body.password : "",
    userId: typeof body?.userId === "string" ? body.userId.trim() : "",
  };
}

export function readRefreshToken(body) {
  return typeof body?.refreshToken === "string" ? body.refreshToken : "";
}

export function validateRegisterPayload({ userId, realName, password, bio }) {
  if (!userId || !realName || !password) return "请填写账号、昵称和密码";
  if (!/^[A-Za-z0-9_]{4,32}$/.test(userId)) return "账号需为 4 到 32 位字母、数字或下划线";
  if (realName.length > 40) return "昵称不能超过 40 个字符";
  if (bio.length > 1000) return "签名不能超过 1000 个字符";
  if (password.length < 6 || password.length > 64) return "密码长度需要在 6 到 64 位之间";
  return "";
}

export function unauthenticatedResponse() {
  return { ok: false, code: "UNAUTHENTICATED", message: "账号或密码错误" };
}
