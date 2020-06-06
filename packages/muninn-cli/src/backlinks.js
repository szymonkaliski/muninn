const chalk = require("chalk");
const { chain } = require("lodash");
const { stringifyMdast } = require("muninn-lib/src/markdown");

module.exports = (db, args) => {
  const targetPath = args.file.replace(`${args.root}/`, "");

  const targetId = db
    .prepare(`SELECT id FROM notes WHERE path = ?`)
    .get(targetPath).id;

  const backlinks = db
    .prepare(
      `
      SELECT links.fromid, links.mdast, notes.path
      FROM notes JOIN links ON links.fromid = notes.id
      WHERE links.toid = ?
    `
    )
    .all(targetId)
    .map((d) => {
      const mdast = JSON.parse(d.mdast);
      const text = stringifyMdast(mdast);

      return { ...d, mdast, text };
    });

  if (args.vim) {
    backlinks.forEach(({ path, mdast }) => {
      const { line, column } = mdast.position.start;
      const firstLine = stringifyMdast(mdast).split("\n")[0];

      console.log([path, line, column, firstLine].join(":"));
    });
  } else {
    chain(backlinks)
      .groupBy("path")
      .entries()
      .forEach(([path, linked]) => {
        console.log(`${chalk.blue(path)}:`);
        linked.forEach(({ mdast }) => console.log(stringifyMdast(mdast)));
        console.log();
      })
      .value();
  }
};
