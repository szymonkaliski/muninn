const chalk = require("chalk");
const { chain } = require("lodash");
const { format, parse, addDays } = require("date-fns");
const { stringifyMdast } = require("muninn-lib/src/markdown");

const DATE_FORMAT = "yyyy-MM-dd";
const TODAY_DATE = Date.now();
const TODAY = format(TODAY_DATE, DATE_FORMAT);

module.exports = (db, args) => {
  const selectAll = db.prepare(`
    SELECT notes.path, tags.value, tags.mdast
    FROM tags JOIN notes ON tags.id = notes.id
    WHERE tags.name = 'due' AND tags.value >= ?
    ORDER BY tags.value;
  `);

  const selectBetween = db.prepare(`
    SELECT notes.path, tags.value, tags.mdast
    FROM tags JOIN notes ON tags.id = notes.id
    WHERE tags.name = 'due' AND tags.value >= ? AND tags.value <= ?
    ORDER BY tags.value;
  `);

  const result =
    args.days === undefined
      ? selectAll.all(TODAY)
      : selectBetween.all(
          TODAY,
          format(addDays(TODAY_DATE, args.days), DATE_FORMAT)
        );

  const todos = result.map((d) => {
    const mdast = JSON.parse(d.mdast);
    const text = stringifyMdast(mdast);

    return {
      ...d,
      mdast,
      text,
    };
  });

  if (args.vim) {
    todos.forEach(({ mdast, text, path }) => {
      const { line, column } = mdast.position.start;
      const firstLine = text.split("\n")[0];

      console.log([path, line, column, firstLine].join(":"));
    });
  } else {
    chain(todos)
      .groupBy((task) => task.value)
      .forEach((todos, date) => {
        const weekday = format(parse(date, DATE_FORMAT, Date.now()), "EEEE");
        const dateStr = date === TODAY ? "Today" : date;

        console.log(`${chalk.green(dateStr)} ${chalk.grey(weekday)}`);

        chain(todos)
          .groupBy((task) => task.path)
          .forEach((todos, path) => {
            console.log(`- ${chalk.blue(path)}:`);

            todos.forEach(({ text, mdast }) => {
              const isDone = mdast.checked;
              const indendentText = text
                .split("\n")
                .map((line) => `  ${line}`)
                .join("\n");

              if (isDone) {
                console.log(chalk.gray(indendentText));
              } else {
                console.log(indendentText);
              }
            });
          })
          .value();

        console.log();
      })
      .value();
  }
};
