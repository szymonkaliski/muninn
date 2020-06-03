const TAG_REGEX = /^@(\w+)(\((.*)\))?/

function tokenizeTags(eat, value, silent) {
  const match = TAG_REGEX.exec(value);

  if (match) {
    if (silent) {
      return true;
    }

    return eat(match[0])({
      type: "tag",
      value: match[0],
      tagName: match[1],
      tagValue: match[3],
      children: [{ type: "text", value: match[0] }]
    });
  }
}

function locateTag(value, fromIndex) {
  return value.indexOf("@", fromIndex);
}

tokenizeTags.notInLink = true;
tokenizeTags.locator = locateTag;

function remarkTags() {
  if (this.Compiler) {
    const Compiler = this.Compiler;
    const visitors = Compiler.prototype.visitors;

    visitors.tag = node => node.value;
  }

  if (this.Parser) {
    const Parser = this.Parser;
    const tokenizers = Parser.prototype.inlineTokenizers;
    const methods = Parser.prototype.inlineMethods;

    tokenizers.tag = tokenizeTags;

    methods.splice(methods.indexOf("text"), 0, "tag");
  }
}

module.exports = remarkTags;
