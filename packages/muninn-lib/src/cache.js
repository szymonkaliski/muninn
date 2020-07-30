const frontmatter = require("frontmatter");
const fs = require("fs");
const glob = require("glob");
const md5 = require("md5");
const path = require("path");
const { get, chain, identity, flatten, difference } = require("lodash");

const {
  findLinks,
  findTags,
  findText,
  parse: parseMarkdown,
} = require("./markdown");

const upsertNotes = ({ db, root }, files) => {
  const parseNote = ({ mtime, filePath, fullPath }) => {
    const content = fs.readFileSync(fullPath, "utf-8");

    const id = md5(fullPath); // id is hash of fullPath, as theoretically the same note can exist in multiple places
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

  const deleteLink = db.prepare(`DELETE FROM links WHERE fromid = ?`);

  const batchDeleteLinks = db.transaction((data) => {
    data.forEach((d) => deleteLink.run(d.fromid));
  });

  const insertLink = db.prepare(`
    INSERT INTO links ( fromid,  toid,  mdast,  backlink)
    VALUES            (:fromid, :toid, :mdast, :backlink)
  `);

  const batchInsertLinks = db.transaction((data) => {
    data.forEach((d) => insertLink.run({ ...d, backlink: 0 }));
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

  batchDeleteLinks(linksToInsert);
  batchInsertLinks(linksToInsert);
};

const upsertBacklinks = ({ db, root }, newNotes) => {
  const allNoteTitles = db.prepare(`SELECT id, title FROM notes`).all();

  const searchNotesByText = db.prepare(
    `SELECT * FROM notes WHERE text LIKE ? COLLATE NOCASE`
  );

  const insertBacklink = db.prepare(`
    INSERT OR REPLACE INTO links ( fromid,  toid,  mdast,  backlink)
    VALUES                       (:fromid, :toid, :mdast, :backlink)
  `);

  const batchInsertBacklinks = db.transaction((data) => {
    data.forEach((d) => insertBacklink.run({ ...d, backlink: 1 }));
  });

  const backlinksToNewNotes = chain(newNotes)
    .flatMap(({ title, id: toid }) => {
      return flatten(
        searchNotesByText.all(`%${title}%`).map(({ mdast, id: fromid }) => {
          const backlinks = findText({ mdast: JSON.parse(mdast), text: title });

          return backlinks.map(({ mdast }) => ({
            toid,
            fromid,
            mdast: JSON.stringify(mdast),
          }));
        })
      );
    })
    .value();

  const backlinksFromNewNotes = chain(allNoteTitles)
    .flatMap(({ title, id: toid }) => {
      return flatten(
        newNotes.map(({ mdast, id: fromid }) => {
          const backlinks = findText({ mdast, text: title });

          return backlinks.map(({ mdast }) => ({
            toid,
            fromid,
            mdast: JSON.stringify(mdast),
          }));
        })
      );
    })
    .value();

  const backlinksToInsert = chain(
    backlinksToNewNotes.concat(backlinksFromNewNotes)
  )
    .filter((d) => d.toid !== d.fromid && !!d.mdast)
    .uniqBy((d) => d.toid + "-" + d.fromid + "-" + d.mdast)
    .value();

  batchInsertBacklinks(backlinksToInsert);
};

const upsertTags = ({ db }, newNotes) => {
  const searchNoteByPath = db.prepare(`SELECT * FROM notes WHERE path = ?`);

  const deleteTag = db.prepare(`DELETE FROM tags WHERE id = ?`);

  const batchDeleteTags = db.transaction((data) => {
    data.forEach((d) => deleteTag.run(d.id));
  });

  const insertTag = db.prepare(`
    INSERT INTO tags ( id,  name,  value,  mdast)
    VALUES           (:id, :name, :value, :mdast)
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

  batchDeleteTags(tagsToInsert);
  batchInsertTags(tagsToInsert);
};

const clearStaleData = ({ db, files }) => {
  const dbFiles = db.prepare(`SELECT path, id FROM notes`).all();

  const removedFiles = difference(
    dbFiles.map((d) => d.path),
    files
  );

  const removedIds = removedFiles.map(
    (file) => dbFiles.find((d) => d.path === file).id
  );

  const deleteFile = db.prepare(`DELETE FROM notes WHERE id = ?`);

  const batchDeleteFiles = db.transaction((data) => {
    data.forEach((d) => deleteFile.run(d));
  });

  batchDeleteFiles(removedIds);
};

const cache = (db, root, callback) => {
  glob("**/*.md", { cwd: root }, (error, files) => {
    const params = { db, root };

    if (error) {
      throw error;
    }

    const newNotes = upsertNotes(params, files);

    if (newNotes.length === 0) {
      callback();
      return;
    }

    upsertLinks(params, newNotes);
    upsertBacklinks(params, newNotes);
    upsertTags(params, newNotes);

    clearStaleData({ db, files });

    callback();
  });
};

module.exports = cache;
