const muninn = require("../");
const path = require("path");
const rimraf = require("rimraf");
const { CACHE_PATH } = require("../src/consts");

// const REPO = path.join(__dirname, "/data/");
const REPO = path.join(__dirname, "/data2/");
// const REPO = "/Users/szymon/Documents/Dropbox/Wiki/";

rimraf.sync(`${CACHE_PATH}/*.db`);

console.time("run");

const db = muninn.createDB(REPO);

muninn.cache(db, REPO, () => {
  console.timeEnd("run");
});
