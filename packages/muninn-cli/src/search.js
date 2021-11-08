const chalk = require("chalk");
const { chain } = require("lodash");
const { stringifyMdast } = require("muninn-lib/src/markdown");

const search = (db, args) => {
  const results = db
    .prepare(
      `
      SELECT * FROM notes
      WHERE text LIKE :text
      ${args.limit !== undefined && args.limit > 0 ? `LIMIT ${args.limit}` : ""}
      `
    )
    .all({ text: `%${args.text}%` });

  return chain(results)
    .uniqBy("path")
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
};

const render = (db, args) => {
  const results = search(db, args);

  if (args.vim) {
    results.forEach(({ path, mdast, text }) => {
      const { line, column } = mdast.position.start;
      const firstLine = text.split("\n")[0];

      console.log([path, line, column, firstLine].join(":"));
    });
  } else {
    chain(results)
      .groupBy("path")
      .entries()
      .forEach(([path, d]) => {
        console.log(`${chalk.blue(path)}:`);
        d.forEach(({ mdast, text }) => console.log(text));
        console.log();
      })
      .value();
  }
};

module.exports = { search, render };
