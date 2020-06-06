#!/usr/bin/env node

const yargs = require("yargs");
const { createDB, cache } = require("muninn-lib");

const tasks = require("./src/tasks")

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
  // .command("backlinks", "find all notes related to given file", (yargs) => {
  //   yargs.option("file", {
  //     demandOption: true,
  //     describe: "input file to search for backlinks",
  //   });

  //   yargs.option("vim", {
  //     default: false,
  //     type: "boolean",
  //     describe: "format output for vim",
  //   });
  // })
  // .command(
  //   "get-asset",
  //   "downloads asset and returns markdown embed/link",
  //   (yargs) => {
  //     yargs
  //       .option("url", { demandOption: true, describe: "url to asset" })
  //       .option("file", {
  //         demandOption: true,
  //         describe: "file where the asset will be added",
  //       });
  //   }
  // )
  // .command("ui", "start web based ui", (yargs) => {
  //   yargs.option("port", { default: 8080 });
  // })
  // .command("clear-cache", "clear cache, will be rebuilt on next command")
  .demandCommand(1, "you need to provide a command")
  .help().argv;

const [command] = args._;

const db = createDB(args.root);

if (command === "cache") {
  console.time("cache");

  cache(db, args.root, () => {
    console.timeEnd("cache");
    process.exit(0);
  });
} else if (command === "tasks") {
  tasks(db, args)
}
