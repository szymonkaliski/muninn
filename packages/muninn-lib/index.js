const Database = require("better-sqlite3");
const envPaths = require("env-paths");
const frontmatter = require("frontmatter");
const fs = require("fs");
const glob = require("glob");
const md5 = require("md5");
const mkdirp = require("mkdirp");
const path = require("path");
const { get, chain, identity } = require("lodash");

const { findLinks, findTags, parse: parseMarkdown } = require("./markdown");

const CACHE_PATH = envPaths("muninn").cache;

console.log({ CACHE_PATH });

const getFiles = (root, callback) => {
  glob("**/*.md", { cwd: root }, callback);
};

const parseNote = ({ mtime, filePath, fullPath }) => {
  const content = fs.readFileSync(fullPath, "utf-8");
  const id = md5(content);
  const front = frontmatter(content);
  const mdast = parseMarkdown(front.content);

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
      fromid TEXT NOT NULL,
      toid   TEXT NOT NULL,
      mdast  TEXT NOT NULL,

      FOREIGN KEY (fromid) REFERENCES notes (id)
      FOREIGN KEY (toid)   REFERENCES notes (id)
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

      FOREIGN KEY (id) REFERENCES notes (id)
    )
    `
  ).run();

  return db;
};

const upsertNotes = ({ db, root }, files) => {
  const searchNoteByPath = db.prepare(`SELECT * FROM notes WHERE path = ?`);

  const searchNoteByPathMtime = db.prepare(
    `SELECT * FROM notes WHERE path = ? AND mtime = ?`
  );

  const insertNote = db.prepare(`
    INSERT OR REPLACE INTO notes ( id,  mtime,  path,  text,  mdast,  title)
    VALUES                       (:id, :mtime, :path, :text, :mdast, :title)
  `);

  const batchInsertNotes = db.transaction((data) => {
    data.forEach((d) => insertNote.run(d));
  });

  const newNotes = [];

  for (const filePath of files) {
    const fullPath = path.join(root, filePath);
    const mtime = fs.statSync(fullPath).mtimeMs;

    const match = searchNoteByPathMtime.get(filePath, mtime);

    if (!match) {
      newNotes.push(parseNote({ mtime, filePath, fullPath }));
    }
  }

  batchInsertNotes(
    newNotes.map((d) => ({
      ...d,
      mdast: JSON.stringify(d.mdast),
    }))
  );

  return newNotes;
};

const upsertLinks = ({ db, root }, newNotes) => {
  const searchNoteByPath = db.prepare(`SELECT * FROM notes WHERE path = ?`);

  const insertLink = db.prepare(`
    INSERT OR REPLACE INTO links ( fromid,  toid,  mdast)
    VALUES                       (:fromid, :toid, :mdast)
  `);

  const batchInsertLinks = db.transaction((data) => {
    data.forEach((d) => insertLink.run(d));
  });

  const linksToInsert = chain(newNotes)
    .flatMap((d) =>
      findLinks({ mdast: d.mdast, path: d.path, root }).map((l) => [d.id, l])
    )
    .map(([fromid, { path, mdast }]) => {
      const toid = get(searchNoteByPath.get(path), "id");

      if (!toid) {
        console.log(`[link] issue getting id for ${path}`);
        return null;
      }

      return {
        fromid,
        toid,
        mdast: JSON.stringify(mdast),
      };
    })
    .filter(identity)
    .value();

  batchInsertLinks(linksToInsert);
};

const upsertTags = ({ db }, newNotes) => {
  const searchNoteByPath = db.prepare(`SELECT * FROM notes WHERE path = ?`);

  const insertTag = db.prepare(`
    INSERT OR REPLACE INTO tags ( id,  name,  value,  mdast)
    VALUES                      (:id, :name, :value, :mdast)
  `);

  const batchInsertTags = db.transaction((data) => {
    data.forEach((d) => insertTag.run(d));
  });

  const tagsToInsert = chain(newNotes)
    .flatMap((d) =>
      findTags({ mdast: d.mdast }).map(({ name, value, mdast }) => ({
        id: d.id,
        name,
        value,
        mdast: JSON.stringify(mdast),
      }))
    )
    .value();

  // console.log({ tagsToInsert });

  batchInsertTags(tagsToInsert);
};

const cache = (root, callback) => {
  const db = createDB(root);

  getFiles(root, (error, files) => {
    const params = { db, root };

    if (error) {
      throw error;
    }

    const newNotes = upsertNotes(params, files);

    if (newNotes.length === 0) {
      callback();
    }

    upsertLinks(params, newNotes);
    upsertTags(params, newNotes);
    // TODO: text-based backlinks

    callback();
  });
};

module.exports = {
  cache,
  CACHE_PATH,
};
