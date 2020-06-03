const markdown = require("remark-parse");
const path = require("path");
const unified = require("unified");
const visit = require("unist-util-visit-parents");
const { chain, get, last, findLastIndex, identity } = require("lodash");

const remarkTags = require("./remark-tags");

const isAbsoluteUrl = (url) => {
  if (/^[a-zA-Z]:\\/.test(url)) {
    return false;
  }

  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url);
};

const parse = (text) => {
  return unified().use(markdown).use(remarkTags).parse(text);
};

const findMeaningfulParent = (parents) => {
  const parentTypes = ["listItem", "blockquote", "paragraph"];

  return parents[
    chain(parentTypes)
      .map((type) => findLastIndex(parents, (node) => node.type === type))
      .filter((idx) => idx >= 0)
      .min()
      .value()
  ];
};

const findLinks = ({ mdast, path: filePath, root }) => {
  const links = [];

  const containingFolder = path.join(root, path.dirname(filePath));

  visit(mdast, (node, parents) => {
    if (node.type === "link") {
      if (!isAbsoluteUrl(node.url)) {
        const linkedFile = path.join(containingFolder, node.url);

        links.push({
          path: linkedFile.replace(root, ''),
          mdast: findMeaningfulParent(parents),
        });
      }
    }
  });

  return links;
};

module.exports = { parse, findLinks };
