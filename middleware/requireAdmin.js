function getLogin(req) {
  return (
    req.user?.login ||
    req.user?.username ||
    req.session?.user?.login ||
    req.session?.user?.username ||
    ""
  ).toLowerCase();
}

module.exports = function requireAdmin(req, res, next) {
  const login = getLogin(req);

  if (login !== "nico_moose") {
    return res.status(403).json({
      ok: false,
      error: "Нет доступа",
    });
  }

  next();
};
