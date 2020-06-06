const envPaths = require("env-paths");
const CACHE_PATH = envPaths("muninn").cache;

module.exports = { CACHE_PATH };
