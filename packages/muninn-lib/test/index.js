const muninn = require("../");
const path = require("path");
const rimraf = require("rimraf");

const REPO = path.join(__dirname, "/data/");
// const REPO = "/Users/szymon/Documents/Dropbox/Wiki/";

console.time("run");

rimraf.sync(`${muninn.CACHE_PATH}/*.db`);

muninn.cache(REPO, () => {
  console.timeEnd("run");
});
