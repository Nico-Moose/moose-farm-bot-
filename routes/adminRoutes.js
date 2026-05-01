const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");

module.exports = function (db) {
  const router = express.Router();

  // проверка админа
  router.get("/me", (req, res) => {
    const login = (
      req.session?.user?.login ||
      req.session?.user?.username ||
      ""
    ).toLowerCase();

    res.json({ isAdmin: login === "nico_moose" });
  });

  router.use(requireAdmin);
// 👤 посмотреть игрока
router.get("/player/:nick", (req, res) => {
  const nick = String(req.params.nick || "")
    .toLowerCase()
    .replace(/^@/, "");

  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all();

  const result = {
    looking_for: nick,
    tables: tables.map(t => t.name),
    matches: []
  };

  for (const table of result.tables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();

    for (const col of columns) {
      const colName = col.name;

      if (
        colName.includes("login") ||
        colName.includes("nick") ||
        colName.includes("user") ||
        colName.includes("name") ||
        colName.includes("key")
      ) {
        try {
          const rows = db.prepare(`
            SELECT * FROM ${table}
            WHERE LOWER(CAST(${colName} AS TEXT)) LIKE ?
            LIMIT 10
          `).all(`%${nick}%`);

          if (rows.length) {
            result.matches.push({
              table,
              column: colName,
              rows
            });
          }
        } catch (e) {}
      }
    }
  }

  res.json(result);
});
  // 💰 баланс
  router.post("/balance", (req, res) => {
    const nick = String(req.body.nick || "").toLowerCase().replace(/^@/, "");
    const amount = parseInt(req.body.amount, 10);

    if (!nick || isNaN(amount)) {
      return res.status(400).json({ error: "nick/amount required" });
    }

    const row = db
      .prepare("SELECT value FROM variables WHERE key = ?")
      .get("farm_virtual_balance_" + nick);

    const current = parseInt(row?.value || "0", 10);
    const next = current + amount;

    db.prepare(`
      INSERT INTO variables(key,value)
      VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run("farm_virtual_balance_" + nick, String(next));

    res.json({ ok: true, balance: next });
  });

  // 🆙 уровень
  router.post("/level", (req, res) => {
    const nick = String(req.body.nick || "").toLowerCase().replace(/^@/, "");
    const level = parseInt(req.body.level, 10);

    const farmRow = db
      .prepare("SELECT value FROM variables WHERE key = ?")
      .get("farm_" + nick);

    if (!farmRow) {
      return res.status(404).json({ error: "farm not found" });
    }

    const farm = JSON.parse(farmRow.value);
    farm.level = level;

    db.prepare(`
      UPDATE variables SET value=? WHERE key=?
    `).run(JSON.stringify(farm), "farm_" + nick);

    res.json({ ok: true });
  });

  // 🗑 удалить ферму
  router.delete("/farm/:nick", (req, res) => {
    const nick = req.params.nick.toLowerCase();

    db.prepare("DELETE FROM variables WHERE key LIKE ?")
      .run(`%${nick}`);

    res.json({ ok: true });
  });

  return router;
};
