#!/usr/bin/env node

const yargs = require("yargs");
const { createDB, cache } = require("muninn-lib");
const { isArray, last } = require("lodash");

const tasks = require("./src/tasks");
const backlinks = require("./src/backlinks");

const args = yargs
  .demandOption("root")
  .command("cache", "update cache")
  .command("tasks", "find tasks for specified timespan", (yargs) => {
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
  .command("backlinks", "find all notes related to given file", (yargs) => {
    yargs.option("file", {
      demandOption: true,
      describe: "input file to search for backlinks",
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
} else if (command === "tasks") {
  tasks(db, { ...args, root });
} else if (command === "backlinks") {
  backlinks(db, { ...args, root });
}
