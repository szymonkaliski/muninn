const Database = require("better-sqlite3");
const envPaths = require("env-paths");
const frontmatter = require("frontmatter");
const fs = require("fs");
const glob = require("glob");
const md5 = require("md5");
const mkdirp = require("mkdirp");
const path = require("path");
const { get, chain } = require("lodash");

const markdown = require("./markdown");
const { findLinks } = markdown;

const CACHE_PATH = envPaths("muninn").cache;

console.log({ CACHE_PATH });

const getFiles = (root, callback) => {
  glob("**/*.md", { cwd: root }, callback);
};

const parseNote = ({ mtime, filePath, fullPath }) => {
  const content = fs.readFileSync(fullPath, "utf-8");
  const id = md5(content);
  const front = frontmatter(content);
  const mdast = markdown.parse(front.content);

  let title = get(front, ["data", "title"]);

  if (!title) {
    if (front.content.startsWith("# ")) {
      title = front.content.split("\n")[0].replace(/^# /, "");
    } else {
      title = path.basename(filePath).replace(/.md$/, "");
    }
  }

  return { id, mtime, path: filePath, text: content, title, mdast };
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
      path  TEXT NOT NULL,
      text  TEXT NOT NULL,
      mdast TEXT NOT NULL,
      title TEXT
    )
    `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS links (
      fromid TEXT NOT NULL,
      toid   TEXT NOT NULL,
      mdast  TEXT NOT NULL,

      FOREIGN KEY (fromid) REFERENCES notes (id)
      FOREIGN KEY (toid)   REFERENCES notes (id)
    )
    `
  ).run();

  const searchNoteByPath = db.prepare(`SELECT * FROM notes WHERE path = ?`);

  const searchNoteByPathMtime = db.prepare(
    `SELECT * FROM notes WHERE path = ? AND mtime = ?`
  );

  const insertNote = db.prepare(`
    INSERT OR REPLACE INTO notes ( id,  mtime,  path,  text,  mdast,  title)
    VALUES                       (:id, :mtime, :path, :text, :mdast, :title)
  `);

  const insertLink = db.prepare(`
    INSERT OR REPLACE INTO links ( fromid,  toid,  mdast)
    VALUES                       (:fromid, :toid, :mdast)
  `);

  const batchInsertNote = db.transaction((data) => {
    data.forEach((d) => insertNote.run(d));
  });

  const batchInsertLink = db.transaction((data) => {
    data.forEach((d) => insertLink.run(d));
  });

  const toInsert = [];

  getFiles(root, (err, files) => {
    for (const filePath of files) {
      const fullPath = path.join(root, filePath);
      const mtime = fs.statSync(fullPath).mtimeMs;

      const match = searchNoteByPathMtime.get(filePath, mtime);

      if (!match) {
        const data = parseNote({ mtime, filePath, fullPath });

        toInsert.push(data);
      }
    }

    if (toInsert.length > 0) {
      batchInsertNote(
        toInsert.map((d) => ({
          ...d,
          mdast: JSON.stringify(d.mdast),
        }))
      );

      const links = chain(toInsert)
        .flatMap((d) => {
          return findLinks({ mdast: d.mdast, path: d.path, root }).map((l) => [
            d.id,
            l,
          ]);
        })
        .map(([fromid, { path, mdast }]) => {
          const toid = searchNoteByPath.get(path).id;

          return {
            fromid,
            toid,
            mdast: JSON.stringify(mdast),
          };
        })
        .value();

      batchInsertLink(links);
    }

    callback();
  });
};

module.exports = {
  cache,
  CACHE_PATH,
};
