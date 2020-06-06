const Database = require("better-sqlite3");
const md5 = require("md5");
const mkdirp = require("mkdirp");
const path = require("path");

const { CACHE_PATH } = require("./consts");

const createDB = (root) => {
  mkdirp(CACHE_PATH);

  const dbName = md5(root);
  const db = new Database(path.join(CACHE_PATH, `${dbName}.db`));

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS notes (
      id    TEXT PRIMARY KEY,
      mtime REAL NOT NULL,
      path  TEXT NOT NULL,
      text  TEXT NOT NULL,
      mdast TEXT NOT NULL,
      title TEXT NOT NULL
    )
    `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS links (
      fromid   TEXT   NOT NULL,
      toid     TEXT   NOT NULL,
      mdast    TEXT   NOT NULL,
      backlink NUMBER NOT NULL,

      FOREIGN KEY (fromid) REFERENCES notes (id) ON DELETE CASCADE
      FOREIGN KEY (toid)   REFERENCES notes (id) ON DELETE CASCADE
    )
    `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS tags (
      id    TEXT NOT NULL,
      name  TEXT NOT NULL,
      value TEXT,
      mdast TEXT NOT NULL,

      FOREIGN KEY (id) REFERENCES notes (id) ON DELETE CASCADE
    )
    `
  ).run();

  return db;
};

module.exports = createDB;
