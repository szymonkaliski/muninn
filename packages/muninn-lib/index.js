const path = require("path");
const Database = require("better-sqlite3");
const envPaths = require("env-paths");
const fs = require("fs");
const glob = require("glob");
const md5 = require("md5");
const mkdirp = require("mkdirp");

const CACHE_PATH = envPaths("muninn").cache;

console.log({ CACHE_PATH });

const getFiles = (root, callback) => {
  glob("**/*.md", { cwd: root }, callback);
};

const parseNote = ({ mtime, filePath, fullPath }) => {
  const content = fs.readFileSync(fullPath, "utf-8");
  const id = md5(content);
  let title = null;

  if (content.startsWith("# ")) {
    title = content.split("\n")[0].replace(/^# /, "");
  } else {
    title = path.basename(filePath).replace(/.md$/, "");
  }

  return { id, mtime, path: filePath, text: content, title };
};

const cache = (root, callback) => {
  mkdirp(CACHE_PATH);

  const dbName = md5(root);
  const db = new Database(path.join(CACHE_PATH, `${dbName}.db`));

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS notes (
      id    TEXT PRIMARY KEY,
      mtime REAL NOT NULL,
      path  TEXT,
      text  TEXT NOT NULL,
      title TEXT
    )
    `
  ).run();

  const search = db.prepare(`SELECT * FROM notes WHERE path = ? AND mtime = ?`);
  const insert = db.prepare(`
  INSERT OR REPLACE INTO notes (id,   mtime,  path,  text,  title)
  VALUES                       (:id, :mtime, :path, :text, :title)
  `);

  const batchInsert = db.transaction((insertData) => {
    insertData.forEach((d) => insert.run(d));
  });

  const inserts = [];

  getFiles(root, (err, files) => {
    for (const filePath of files) {
      const fullPath = path.join(root, filePath);
      const mtime = fs.statSync(fullPath).mtimeMs;

      const match = search.get(filePath, mtime);

      if (!match) {
        const insertData = parseNote({ mtime, filePath, fullPath });
        inserts.push(insertData);
      }
    }

    if (inserts.length > 0) {
      batchInsert(inserts);
    }

    callback()
  });
};

module.exports = {
  cache,
};
