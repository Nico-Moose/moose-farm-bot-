const ADMIN_LOGIN = "nico_moose";

function getSessionLogin(req) {
  return (
    req.session?.twitchUser?.login ||
    req.session?.user?.login ||
    req.session?.user?.username ||
    req.user?.login ||
    req.user?.username ||
    ""
  ).toLowerCase();
}

function requireAdmin(req, res, next) {
  const login = getSessionLogin(req);

  if (login !== ADMIN_LOGIN) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  next();
}

module.exports = { requireAdmin, getSessionLogin, ADMIN_LOGIN };
