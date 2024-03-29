const chalk = require("chalk");
const { chain } = require("lodash");
const { format, parse, addDays } = require("date-fns");
const { stringifyMdast } = require("muninn-lib/src/markdown");

const DATE_FORMAT = "yyyy-MM-dd";
const TODAY_DATE = Date.now();
const TODAY = format(TODAY_DATE, DATE_FORMAT);

const createSelect = (whereClause) => `
  SELECT notes.path, tags.value, tags.mdast
  FROM tags JOIN notes ON tags.id = notes.id
  WHERE ${whereClause}
  ORDER BY tags.value, notes.path;
`;

const search = (db, args) => {
  const selectAll = db.prepare(
    createSelect(`tags.name = 'due' AND tags.value >= ?`)
  );

  const selectBetween = db.prepare(
    createSelect(`tags.name = 'due' AND tags.value >= ? AND tags.value <= ?`)
  );

  const selectOverdue = db.prepare(
    createSelect(
      `tags.name = 'due' AND tags.value < ? AND json_extract(tags.mdast, '$.checked') = 0`
    )
  );

  const result =
    args.days === undefined
      ? selectAll.all(TODAY)
      : selectBetween.all(
          TODAY,
          format(addDays(TODAY_DATE, args.days), DATE_FORMAT)
        );

  const overdue = args.overdue
    ? selectOverdue.all(TODAY).map((d) => ({ ...d, isOverdue: true }))
    : [];

  const todos = chain(overdue)
    .concat(result)
    .map((d) => {
      const mdast = JSON.parse(d.mdast);
      const text = stringifyMdast(mdast);

      return { ...d, mdast, text };
    })
    .filter(({ mdast }) => args.showDone || !mdast.checked)
    .value();

  return todos;
};

const render = (db, args) => {
  const todos = search(db, args);

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
        let weekday;

        try {
          weekday = format(parse(date, DATE_FORMAT, Date.now()), "EEEE");
        } catch (e) {
          console.log("Parsing error at: ", todos, date);
          console.log(e);
          process.exit(1);
        }

        const dateStr = date === TODAY ? "Today" : date;
        const isOverdue = todos.some((d) => d.isOverdue);
        const color = isOverdue ? "red" : "green";

        console.log(`${chalk[color](dateStr)} ${chalk.grey(weekday)}`);

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

module.exports = { search, render };
