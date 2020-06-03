const muninn = require("../");
const path = require("path");
const rimraf = require("rimraf");

const TEST_DATA_PATH = path.join(__dirname, "/data/");
const WIKI_DATA_PATH = "/Users/szymon/Documents/Dropbox/Wiki";

const REPO = TEST_DATA_PATH;

console.time("run");

rimraf.sync(`${muninn.CACHE_PATH}/*.db`);

muninn.cache(REPO, () => {
  console.timeEnd("run");
});
