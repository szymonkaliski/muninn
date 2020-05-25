const muninn = require("../");
const path = require("path");

const TEST_DATA_PATH = path.join(__dirname, "/data/");
const WIKI_DATA_PATH = "/Users/szymon/Documents/Dropbox/Wiki";

const REPO = WIKI_DATA_PATH;

console.time("run");

muninn.cache(REPO, () => {
  console.timeEnd("run");
});
