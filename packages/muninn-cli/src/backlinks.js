const chalk = require("chalk");
const { chain } = require("lodash");
const { stringifyMdast } = require("muninn-lib/src/markdown");

const search = (db, args) => {
  const target = args.target.replace(args.root, "");

  const targetInDB = db
    .prepare(
      `
      SELECT id FROM notes WHERE path = :path OR title LIKE :title
      `
    )
    .get({ path: target, title: target });

  if (!targetInDB) {
    return [];
  }

  const targetId = targetInDB.id;

  const query = db
    .prepare(
      `
      SELECT links.fromid, links.mdast, notes.path
      FROM notes JOIN links ON links.fromid = notes.id
      WHERE links.toid = ?
      `
    )
    .all(targetId);

  const backlinks = chain(query)
    .uniqBy((d) => {
      return d.fromid + "-" + d.mdast;
    })
    .map((d) => {
      const mdast = JSON.parse(d.mdast);
      const text = stringifyMdast(mdast);

      return { ...d, mdast, text };
    })
    .sortBy([
      "path",
      "mdast.position.start.line",
      "mdast.position.start.column",
    ])
    .value();

  return backlinks;
};

const render = (db, args) => {
  const backlinks = search(db, args);

  if (args.vim) {
    backlinks.forEach(({ path, mdast, text }) => {
      const { line, column } = mdast.position.start;
      const firstLine = text.split("\n")[0];

      console.log([path, line, column, firstLine].join(":"));
    });
  } else {
    chain(backlinks)
      .groupBy("path")
      .entries()
      .forEach(([path, linked]) => {
        console.log(`${chalk.blue(path)}:`);
        linked.forEach(({ mdast, text }) => console.log(text));
        console.log();
      })
      .value();
  }
};

module.exports = { search, render };
