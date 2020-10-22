#!/usr/bin/env node

const yargs = require("yargs");
const { createDB, cache } = require("muninn-lib");
const { isArray, last } = require("lodash");

const backlinks = require("./src/backlinks");
const search = require("./src/search");
const tasks = require("./src/tasks");

const args = yargs
  .demandOption("root")
  .command("cache", "update cache")
  .command("backlinks", "find all notes related to given file", (yargs) => {
    // TODO: seperate options for matching --file and --text
    yargs.option("target", {
      demandOption: true,
      describe: "file or phrase to search for backlinks",
    });

    yargs.option("vim", {
      default: false,
      type: "boolean",
      describe: "format output for vim",
    });
  })
  .command("search", "find all notes matching given text search", (yargs) => {
    yargs.option("text", {
      demandOption: true,
      describe: "text to search for",
    });

    yargs.option("vim", {
      default: false,
      type: "boolean",
      describe: "format output for vim",
    });
  })
  .command("tasks", "find tasks for specified timespan", (yargs) => {
    yargs.option("show-done", {
      default: false,
      type: "boolean",
      describe: "show done tasks",
    });

    yargs.option("overdue", {
      default: true,
      type: "boolean",
      describe: "query overdue tasks",
    });

    yargs.option("days", {
      default: undefined,
      type: "number",
      describe: "how many days in the future to look for",
    });

    yargs.option("vim", {
      default: false,
      type: "boolean",
      describe: "format output for vim",
    });
  })
  .demandCommand(1, "you need to provide a command")
  .help().argv;

const [command] = args._;

let root = isArray(args.root) ? last(args.root) : args.root;
root = root.endsWith("/") ? root : root + "/";

const db = createDB(root);

if (command === "cache") {
  console.time("cache");

  cache(db, root, () => {
    console.timeEnd("cache");
    process.exit(0);
  });
} else if (command === "backlinks") {
  backlinks.render(db, { ...args, root });
} else if (command === "search") {
  search.render(db, { ...args, root });
} else if (command === "tasks") {
  tasks.render(db, { ...args, root });
}
