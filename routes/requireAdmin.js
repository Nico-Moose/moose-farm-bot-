const ADMIN = "nico_moose";

function requireAdmin(req, res, next) {
  const login = (
    req.session?.user?.login ||
    req.session?.user?.username ||
    ""
  ).toLowerCase();

  if (login !== ADMIN) {
    return res.status(404).json({ error: "Not found" });
  }

  next();
}

module.exports = { requireAdmin };
