'use strict';

var obsidian = require('obsidian');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function Diff() {}
Diff.prototype = {
  diff: function diff(oldString, newString) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var callback = options.callback;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    this.options = options;
    var self = this;

    function done(value) {
      if (callback) {
        setTimeout(function () {
          callback(undefined, value);
        }, 0);
        return true;
      } else {
        return value;
      }
    } // Allow subclasses to massage the input prior to running


    oldString = this.castInput(oldString);
    newString = this.castInput(newString);
    oldString = this.removeEmpty(this.tokenize(oldString));
    newString = this.removeEmpty(this.tokenize(newString));
    var newLen = newString.length,
        oldLen = oldString.length;
    var editLength = 1;
    var maxEditLength = newLen + oldLen;
    var bestPath = [{
      newPos: -1,
      components: []
    }]; // Seed editLength = 0, i.e. the content starts with the same values

    var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);

    if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
      // Identity per the equality and tokenizer
      return done([{
        value: this.join(newString),
        count: newString.length
      }]);
    } // Main worker method. checks all permutations of a given edit length for acceptance.


    function execEditLength() {
      for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
        var basePath = void 0;

        var addPath = bestPath[diagonalPath - 1],
            removePath = bestPath[diagonalPath + 1],
            _oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;

        if (addPath) {
          // No one else is going to attempt to use this value, clear it
          bestPath[diagonalPath - 1] = undefined;
        }

        var canAdd = addPath && addPath.newPos + 1 < newLen,
            canRemove = removePath && 0 <= _oldPos && _oldPos < oldLen;

        if (!canAdd && !canRemove) {
          // If this path is a terminal then prune
          bestPath[diagonalPath] = undefined;
          continue;
        } // Select the diagonal that we want to branch from. We select the prior
        // path whose position in the new string is the farthest from the origin
        // and does not pass the bounds of the diff graph


        if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
          basePath = clonePath(removePath);
          self.pushComponent(basePath.components, undefined, true);
        } else {
          basePath = addPath; // No need to clone, we've pulled it from the list

          basePath.newPos++;
          self.pushComponent(basePath.components, true, undefined);
        }

        _oldPos = self.extractCommon(basePath, newString, oldString, diagonalPath); // If we have hit the end of both strings, then we are done

        if (basePath.newPos + 1 >= newLen && _oldPos + 1 >= oldLen) {
          return done(buildValues(self, basePath.components, newString, oldString, self.useLongestToken));
        } else {
          // Otherwise track this path as a potential candidate and continue.
          bestPath[diagonalPath] = basePath;
        }
      }

      editLength++;
    } // Performs the length of edit iteration. Is a bit fugly as this has to support the
    // sync and async mode which is never fun. Loops over execEditLength until a value
    // is produced.


    if (callback) {
      (function exec() {
        setTimeout(function () {
          // This should not happen, but we want to be safe.

          /* istanbul ignore next */
          if (editLength > maxEditLength) {
            return callback();
          }

          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength) {
        var ret = execEditLength();

        if (ret) {
          return ret;
        }
      }
    }
  },
  pushComponent: function pushComponent(components, added, removed) {
    var last = components[components.length - 1];

    if (last && last.added === added && last.removed === removed) {
      // We need to clone here as the component clone operation is just
      // as shallow array clone
      components[components.length - 1] = {
        count: last.count + 1,
        added: added,
        removed: removed
      };
    } else {
      components.push({
        count: 1,
        added: added,
        removed: removed
      });
    }
  },
  extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
    var newLen = newString.length,
        oldLen = oldString.length,
        newPos = basePath.newPos,
        oldPos = newPos - diagonalPath,
        commonCount = 0;

    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
      newPos++;
      oldPos++;
      commonCount++;
    }

    if (commonCount) {
      basePath.components.push({
        count: commonCount
      });
    }

    basePath.newPos = newPos;
    return oldPos;
  },
  equals: function equals(left, right) {
    if (this.options.comparator) {
      return this.options.comparator(left, right);
    } else {
      return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  },
  removeEmpty: function removeEmpty(array) {
    var ret = [];

    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }

    return ret;
  },
  castInput: function castInput(value) {
    return value;
  },
  tokenize: function tokenize(value) {
    return value.split('');
  },
  join: function join(chars) {
    return chars.join('');
  }
};

function buildValues(diff, components, newString, oldString, useLongestToken) {
  var componentPos = 0,
      componentLen = components.length,
      newPos = 0,
      oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    var component = components[componentPos];

    if (!component.removed) {
      if (!component.added && useLongestToken) {
        var value = newString.slice(newPos, newPos + component.count);
        value = value.map(function (value, i) {
          var oldValue = oldString[oldPos + i];
          return oldValue.length > value.length ? oldValue : value;
        });
        component.value = diff.join(value);
      } else {
        component.value = diff.join(newString.slice(newPos, newPos + component.count));
      }

      newPos += component.count; // Common case

      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = diff.join(oldString.slice(oldPos, oldPos + component.count));
      oldPos += component.count; // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.

      if (componentPos && components[componentPos - 1].added) {
        var tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  } // Special case handle for when one terminal is ignored (i.e. whitespace).
  // For this case we merge the terminal into the prior string and drop the change.
  // This is only available for string mode.


  var lastComponent = components[componentLen - 1];

  if (componentLen > 1 && typeof lastComponent.value === 'string' && (lastComponent.added || lastComponent.removed) && diff.equals('', lastComponent.value)) {
    components[componentLen - 2].value += lastComponent.value;
    components.pop();
  }

  return components;
}

function clonePath(path) {
  return {
    newPos: path.newPos,
    components: path.components.slice(0)
  };
}

//
// Ranges and exceptions:
// Latin-1 Supplement, 0080–00FF
//  - U+00D7  × Multiplication sign
//  - U+00F7  ÷ Division sign
// Latin Extended-A, 0100–017F
// Latin Extended-B, 0180–024F
// IPA Extensions, 0250–02AF
// Spacing Modifier Letters, 02B0–02FF
//  - U+02C7  ˇ &#711;  Caron
//  - U+02D8  ˘ &#728;  Breve
//  - U+02D9  ˙ &#729;  Dot Above
//  - U+02DA  ˚ &#730;  Ring Above
//  - U+02DB  ˛ &#731;  Ogonek
//  - U+02DC  ˜ &#732;  Small Tilde
//  - U+02DD  ˝ &#733;  Double Acute Accent
// Latin Extended Additional, 1E00–1EFF

var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;
var reWhitespace = /\S/;
var wordDiff = new Diff();

wordDiff.equals = function (left, right) {
  if (this.options.ignoreCase) {
    left = left.toLowerCase();
    right = right.toLowerCase();
  }

  return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
};

wordDiff.tokenize = function (value) {
  // All whitespace symbols except newline group into one token, each newline - in separate token
  var tokens = value.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/); // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.

  for (var i = 0; i < tokens.length - 1; i++) {
    // If we have an empty string in the next field and we have only word chars before and after, merge
    if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
      tokens[i] += tokens[i + 2];
      tokens.splice(i + 1, 2);
      i--;
    }
  }

  return tokens;
};

var lineDiff = new Diff();

lineDiff.tokenize = function (value) {
  var retLines = [],
      linesAndNewlines = value.split(/(\n|\r\n)/); // Ignore the final empty token that occurs if the string ends with a new line

  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  } // Merge the content and line separators into single tokens


  for (var i = 0; i < linesAndNewlines.length; i++) {
    var line = linesAndNewlines[i];

    if (i % 2 && !this.options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      if (this.options.ignoreWhitespace) {
        line = line.trim();
      }

      retLines.push(line);
    }
  }

  return retLines;
};

function diffLines(oldStr, newStr, callback) {
  return lineDiff.diff(oldStr, newStr, callback);
}

var sentenceDiff = new Diff();

sentenceDiff.tokenize = function (value) {
  return value.split(/(\S.+?[.!?])(?=\s+|$)/);
};

var cssDiff = new Diff();

cssDiff.tokenize = function (value) {
  return value.split(/([{}:;,]|\s+)/);
};

function _typeof(obj) {
  "@babel/helpers - typeof";

  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

var objectPrototypeToString = Object.prototype.toString;
var jsonDiff = new Diff(); // Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
// dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:

jsonDiff.useLongestToken = true;
jsonDiff.tokenize = lineDiff.tokenize;

jsonDiff.castInput = function (value) {
  var _this$options = this.options,
      undefinedReplacement = _this$options.undefinedReplacement,
      _this$options$stringi = _this$options.stringifyReplacer,
      stringifyReplacer = _this$options$stringi === void 0 ? function (k, v) {
    return typeof v === 'undefined' ? undefinedReplacement : v;
  } : _this$options$stringi;
  return typeof value === 'string' ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, '  ');
};

jsonDiff.equals = function (left, right) {
  return Diff.prototype.equals.call(jsonDiff, left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'));
};
// object that is already on the "stack" of items being processed. Accepts an optional replacer

function canonicalize(obj, stack, replacementStack, replacer, key) {
  stack = stack || [];
  replacementStack = replacementStack || [];

  if (replacer) {
    obj = replacer(key, obj);
  }

  var i;

  for (i = 0; i < stack.length; i += 1) {
    if (stack[i] === obj) {
      return replacementStack[i];
    }
  }

  var canonicalizedObj;

  if ('[object Array]' === objectPrototypeToString.call(obj)) {
    stack.push(obj);
    canonicalizedObj = new Array(obj.length);
    replacementStack.push(canonicalizedObj);

    for (i = 0; i < obj.length; i += 1) {
      canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, key);
    }

    stack.pop();
    replacementStack.pop();
    return canonicalizedObj;
  }

  if (obj && obj.toJSON) {
    obj = obj.toJSON();
  }

  if (_typeof(obj) === 'object' && obj !== null) {
    stack.push(obj);
    canonicalizedObj = {};
    replacementStack.push(canonicalizedObj);

    var sortedKeys = [],
        _key;

    for (_key in obj) {
      /* istanbul ignore else */
      if (obj.hasOwnProperty(_key)) {
        sortedKeys.push(_key);
      }
    }

    sortedKeys.sort();

    for (i = 0; i < sortedKeys.length; i += 1) {
      _key = sortedKeys[i];
      canonicalizedObj[_key] = canonicalize(obj[_key], stack, replacementStack, replacer, _key);
    }

    stack.pop();
    replacementStack.pop();
  } else {
    canonicalizedObj = obj;
  }

  return canonicalizedObj;
}

var arrayDiff = new Diff();

arrayDiff.tokenize = function (value) {
  return value.slice();
};

arrayDiff.join = arrayDiff.removeEmpty = function (value) {
  return value;
};

const DEFAULT_SETTINGS = {
    styleLists: false,
    debug: false,
};
function rangeIsCursor(selection) {
    return (selection.anchor.line === selection.head.line &&
        selection.anchor.ch === selection.head.ch);
}
function testKeydown(e, code, mods = []) {
    const shoudhShift = mods.includes("shift");
    const shoudhMeta = mods.includes("cmd");
    const shoudhAlt = mods.includes("alt");
    const shoudhCtrl = mods.includes("ctrl");
    return (e.code === code &&
        e.shiftKey === shoudhShift &&
        e.metaKey === shoudhMeta &&
        e.altKey === shoudhAlt &&
        e.ctrlKey === shoudhCtrl);
}
class List {
    constructor(indentSign, bullet, content) {
        this.indentSign = indentSign;
        this.bullet = bullet;
        this.content = content;
        this.children = [];
        this.parent = null;
    }
    getChildren() {
        return this.children.concat();
    }
    getFullContent() {
        return (new Array(this.getLevel() - 1).fill(this.indentSign).join("") +
            this.bullet +
            " " +
            this.content);
    }
    appendContent(content) {
        this.content += content;
    }
    setContent(content) {
        this.content = content;
    }
    getContent() {
        return this.content;
    }
    isEmpty() {
        return this.children.length === 0;
    }
    getContentStartCh() {
        const indentLength = (this.getLevel() - 1) * this.indentSign.length;
        return indentLength + 2;
    }
    getContentEndCh() {
        return this.getContentStartCh() + this.content.length;
    }
    getParent() {
        return this.parent;
    }
    getPrevSibling(list) {
        const i = this.children.indexOf(list);
        return i > 0 ? this.children[i - 1] : null;
    }
    getNextSibling(list) {
        const i = this.children.indexOf(list);
        return i >= 0 && i < this.children.length ? this.children[i + 1] : null;
    }
    getLevel() {
        let level = 0;
        let ref = this;
        while (ref.parent) {
            ref = ref.parent;
            level++;
        }
        return level;
    }
    add(list) {
        this.children.push(list);
        list.parent = this;
    }
    addAtBeginning(list) {
        this.children.unshift(list);
        list.parent = this;
    }
    addBefore(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i, 0, list);
        list.parent = this;
    }
    addAfter(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i + 1, 0, list);
        list.parent = this;
    }
    remove(list) {
        const i = this.children.indexOf(list);
        this.children.splice(i, 1);
        list.parent = null;
    }
    print() {
        let res = this.getFullContent() + "\n";
        for (const child of this.children) {
            res += child.print();
        }
        return res;
    }
}
class Root {
    constructor(indentSign, start, end, cursor) {
        this.indentSign = indentSign;
        this.start = start;
        this.end = end;
        this.cursor = cursor;
        this.rootList = new List("", "", "");
    }
    replaceCursor(cursor) {
        this.cursor = cursor;
    }
    getTotalLines() {
        return this.end.line - this.start.line + 1;
    }
    getChildren() {
        return this.rootList.getChildren();
    }
    getIndentSign() {
        return this.indentSign;
    }
    getLevel() {
        return 0;
    }
    getParent() {
        return null;
    }
    add(list) {
        this.rootList.add(list);
    }
    getStart() {
        return this.start;
    }
    getEnd() {
        return this.end;
    }
    getCursor() {
        return this.cursor;
    }
    getCursorOnList() {
        return this.getListUnderLine(this.cursor.line);
    }
    print() {
        let res = "";
        for (const child of this.rootList.getChildren()) {
            res += child.print();
        }
        return res.replace(/\n$/, "");
    }
    getLineNumber(list) {
        let result = null;
        let line = 0;
        const visitArr = (ll) => {
            for (const l of ll) {
                if (l === list) {
                    result = line;
                }
                else {
                    line++;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result + this.start.line;
    }
    getListUnderLine(line) {
        if (line < this.start.line) {
            return;
        }
        let result = null;
        let index = 0;
        const visitArr = (ll) => {
            for (const l of ll) {
                if (index + this.start.line === line) {
                    result = l;
                }
                else {
                    index++;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    moveUp() {
        const list = this.getCursorOnList();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const prev = parent.getPrevSibling(list);
        if (!prev && grandParent) {
            const newParent = grandParent.getPrevSibling(parent);
            if (newParent) {
                parent.remove(list);
                newParent.add(list);
                this.cursor.line = this.getLineNumber(list);
            }
        }
        else if (prev) {
            parent.remove(list);
            parent.addBefore(prev, list);
            this.cursor.line = this.getLineNumber(list);
        }
        return true;
    }
    moveDown() {
        const list = this.getCursorOnList();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const next = parent.getNextSibling(list);
        if (!next && grandParent) {
            const newParent = grandParent.getNextSibling(parent);
            if (newParent) {
                parent.remove(list);
                newParent.addAtBeginning(list);
                this.cursor.line = this.getLineNumber(list);
            }
        }
        else if (next) {
            parent.remove(list);
            parent.addAfter(next, list);
            this.cursor.line = this.getLineNumber(list);
        }
        return true;
    }
    moveLeft() {
        const list = this.getCursorOnList();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        if (!grandParent) {
            return true;
        }
        parent.remove(list);
        grandParent.addAfter(parent, list);
        this.cursor.line = this.getLineNumber(list);
        this.cursor.ch--;
        return true;
    }
    moveRight() {
        const list = this.getCursorOnList();
        const parent = list.getParent();
        const prev = parent.getPrevSibling(list);
        if (!prev) {
            return true;
        }
        parent.remove(list);
        prev.add(list);
        this.cursor.line = this.getLineNumber(list);
        this.cursor.ch++;
        return true;
    }
    delete() {
        const list = this.getCursorOnList();
        if (this.cursor.ch !== list.getContentStartCh()) {
            return false;
        }
        const prev = this.getListUnderLine(this.cursor.line - 1);
        if (!prev) {
            return true;
        }
        const bothAreEmpty = prev.isEmpty() && list.isEmpty();
        const prevIsEmptyAndSameLevel = prev.isEmpty() && !list.isEmpty() && prev.getLevel() == list.getLevel();
        const listIsEmptyAndPrevIsParent = list.isEmpty() && prev.getLevel() == list.getLevel() - 1;
        if (bothAreEmpty || prevIsEmptyAndSameLevel || listIsEmptyAndPrevIsParent) {
            const parent = list.getParent();
            const prevEndCh = prev.getContentEndCh();
            prev.appendContent(list.getContent());
            parent.remove(list);
            for (const c of list.getChildren()) {
                list.remove(c);
                prev.add(c);
            }
            this.cursor.line = this.getLineNumber(prev);
            this.cursor.ch = prevEndCh;
        }
        return true;
    }
    deleteFullLeft() {
        const list = this.getCursorOnList();
        const diff = this.cursor.ch - list.getContentStartCh();
        if (diff > 0) {
            list.setContent(list.getContent().slice(diff));
            this.cursor.ch -= diff;
        }
        return true;
    }
}
class ZoomState {
    constructor(line, header) {
        this.line = line;
        this.header = header;
    }
}
const voidFn = () => { };
class ObsidianOutlinerPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.zoomStates = new WeakMap();
        this.handleKeydown = (cm, e) => {
            let worked = false;
            const metaKey = process.platform === "darwin" ? "cmd" : "ctrl";
            if (testKeydown(e, "Tab", ["shift"])) {
                worked = this.moveListElementLeft(cm);
            }
            else if (testKeydown(e, "Tab")) {
                worked = this.moveListElementRight(cm);
            }
            else if (testKeydown(e, "ArrowUp", ["shift", metaKey])) {
                worked = this.moveListElementUp(cm);
            }
            else if (testKeydown(e, "ArrowDown", ["shift", metaKey])) {
                worked = this.moveListElementDown(cm);
            }
            else if (testKeydown(e, "ArrowUp", [metaKey])) {
                worked = this.fold(cm);
            }
            else if (testKeydown(e, "ArrowDown", [metaKey])) {
                worked = this.unfold(cm);
            }
            else if (testKeydown(e, "ArrowLeft")) {
                worked = this.cursorLeft(cm);
            }
            else if (testKeydown(e, "Backspace", [metaKey])) {
                worked = this.deleteFullLeft(cm);
            }
            else if (testKeydown(e, "Backspace")) {
                worked = this.delete(cm);
            }
            else if (testKeydown(e, "Delete")) {
                worked = this.deleteNext(cm);
            }
            else if (testKeydown(e, "ArrowLeft", [metaKey, "shift"])) {
                worked = this.selectFullLeft(cm);
            }
            else if (testKeydown(e, "KeyA", [metaKey])) {
                worked = this.selectAll(cm);
            }
            else if (testKeydown(e, "Enter")) {
                worked = this.outdentIfLineIsEmpty(cm);
            }
            if (worked) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
    }
    debug(method) {
        if (!this.settings.debug) {
            return voidFn;
        }
        return (...args) => console.info(method, ...args);
    }
    getObsidianTabsSettigns() {
        return Object.assign({ useTab: true, tabSize: 4 }, this.app.vault.config);
    }
    detectListIndentSign(editor, cursor) {
        const d = this.debug("ObsidianOutlinerPlugin::detectListIndentSign");
        const { useTab, tabSize } = this.getObsidianTabsSettigns();
        const defaultIndentSign = useTab
            ? "\t"
            : new Array(tabSize).fill(" ").join("");
        const line = editor.getLine(cursor.line);
        const withTabsRe = /^\t+[-*] /;
        const withSpacesRe = /^[ ]+[-*] /;
        const mayBeWithSpacesRe = /^[ ]*[-*] /;
        if (withTabsRe.test(line)) {
            d("detected tab on current line");
            return "\t";
        }
        if (withSpacesRe.test(line)) {
            d("detected whitespaces on current line, trying to count");
            const spacesA = line.length - line.trimLeft().length;
            let lineNo = cursor.line - 1;
            while (lineNo >= editor.firstLine()) {
                const line = editor.getLine(lineNo);
                if (!mayBeWithSpacesRe.test(line)) {
                    break;
                }
                const spacesB = line.length - line.trimLeft().length;
                if (spacesB < spacesA) {
                    const l = spacesA - spacesB;
                    d(`detected ${l} whitespaces`);
                    return new Array(l).fill(" ").join("");
                }
                lineNo--;
            }
            d("unable to detect");
            return null;
        }
        if (mayBeWithSpacesRe.test(line)) {
            d("detected nothing on current line, looking forward");
            const spacesA = line.length - line.trimLeft().length;
            let lineNo = cursor.line + 1;
            while (lineNo <= editor.lastLine()) {
                const line = editor.getLine(lineNo);
                if (withTabsRe.test(line)) {
                    d("detected tab");
                    return "\t";
                }
                if (!mayBeWithSpacesRe.test(line)) {
                    break;
                }
                const spacesB = line.length - line.trimLeft().length;
                if (spacesB > spacesA) {
                    const l = spacesB - spacesA;
                    d(`detected ${l} whitespaces`);
                    return new Array(l).fill(" ").join("");
                }
                lineNo++;
            }
            d(`detected nothing, using default useTab=${useTab} tabSize=${tabSize}`);
            return defaultIndentSign;
        }
        d("unable to detect");
        return null;
    }
    parseList(editor, cursor = editor.getCursor()) {
        const cursorLine = cursor.line;
        const cursorCh = cursor.ch;
        const line = editor.getLine(cursorLine);
        const indentSign = this.detectListIndentSign(editor, cursor);
        if (indentSign === null) {
            return null;
        }
        let listStartLine = cursorLine;
        const listStartCh = 0;
        while (listStartLine >= 1) {
            const line = editor.getLine(listStartLine - 1);
            if (!this.getListLineInfo(line, indentSign)) {
                break;
            }
            listStartLine--;
        }
        let listEndLine = cursorLine;
        let listEndCh = line.length;
        while (listEndLine < editor.lineCount()) {
            const line = editor.getLine(listEndLine + 1);
            if (!this.getListLineInfo(line, indentSign)) {
                break;
            }
            listEndCh = line.length;
            listEndLine++;
        }
        const root = new Root(indentSign, { line: listStartLine, ch: listStartCh }, { line: listEndLine, ch: listEndCh }, { line: cursorLine, ch: cursorCh });
        let currentLevel = root;
        let lastList = root;
        for (let l = listStartLine; l <= listEndLine; l++) {
            const line = editor.getLine(l);
            const { bullet, content, indentLevel } = this.getListLineInfo(line, indentSign);
            if (indentLevel === currentLevel.getLevel() + 1) {
                currentLevel = lastList;
            }
            else if (indentLevel < currentLevel.getLevel()) {
                while (indentLevel < currentLevel.getLevel()) {
                    currentLevel = currentLevel.getParent();
                }
            }
            else if (indentLevel != currentLevel.getLevel()) {
                console.error(`Unable to parse list`);
                return null;
            }
            const list = new List(indentSign, bullet, content);
            currentLevel.add(list);
            lastList = list;
        }
        return root;
    }
    iterateWhileFolded(editor, pos, inc) {
        let folded = false;
        do {
            inc(pos);
            folded = editor.isFolded(pos);
        } while (folded);
        return pos;
    }
    getListLineInfo(line, indentSign) {
        const prefixRe = new RegExp(`^(?:${indentSign})*([-*]) `);
        const matches = prefixRe.exec(line);
        if (!matches) {
            return null;
        }
        const prefixLength = matches[0].length;
        const bullet = matches[1];
        const content = line.slice(prefixLength);
        const indentLevel = (prefixLength - 2) / indentSign.length;
        return {
            bullet,
            content,
            prefixLength,
            indentLevel,
        };
    }
    isJustCursor(editor) {
        const selections = editor.listSelections();
        return selections.length === 1 && rangeIsCursor(selections[0]);
    }
    evalEnsureCursorInContent(editor) {
        const cursor = editor.getCursor();
        const indentSign = this.detectListIndentSign(editor, cursor);
        if (indentSign === null) {
            return;
        }
        process.nextTick(() => {
            const lineStartCursor = editor.coordsChar(Object.assign(Object.assign({}, editor.cursorCoords()), { left: 0 }));
            if (lineStartCursor.line !== cursor.line) {
                editor.setCursor({
                    line: lineStartCursor.line,
                    ch: editor.getLine(lineStartCursor.line).length,
                });
            }
        });
        const line = editor.getLine(cursor.line);
        const linePrefix = this.getListLineInfo(line, indentSign).prefixLength;
        if (cursor.ch < linePrefix) {
            cursor.ch = linePrefix;
            editor.setCursor(cursor);
        }
    }
    execute(editor, cb, options) {
        const { force, cursor } = Object.assign({ force: false, cursor: editor.getCursor() }, options);
        const root = this.parseList(editor, cursor);
        if (!root) {
            return false;
        }
        const result = cb(root);
        if (force || result) {
            this.applyChanges(editor, root, { force });
        }
        return result;
    }
    applyChanges(editor, root, options) {
        const { force } = Object.assign({ force: false }, options);
        const oldString = editor.getRange(root.getStart(), root.getEnd());
        const newString = root.print();
        const diff = diffLines(oldString, newString);
        let l = root.getStart().line;
        for (const change of diff) {
            if (change.added) {
                editor.replaceRange(change.value, { line: l, ch: 0 });
                l += change.count;
            }
            else if (change.removed) {
                const withNewline = /\n$/.test(change.value);
                const tillLine = withNewline ? l + change.count : l + change.count - 1;
                const tillCh = withNewline ? 0 : editor.getLine(tillLine).length;
                editor.replaceRange("", { line: l, ch: 0 }, { line: tillLine, ch: tillCh });
            }
            else {
                l += change.count;
            }
        }
        const oldCursor = editor.getCursor();
        const newCursor = root.getCursor();
        if (force ||
            oldCursor.line != newCursor.line ||
            oldCursor.ch != newCursor.ch) {
            editor.setCursor(newCursor);
        }
    }
    isCursorInList(editor) {
        const cursor = editor.getCursor();
        const indentSign = this.detectListIndentSign(editor, cursor);
        return indentSign !== null;
    }
    moveListElementDown(editor) {
        return this.execute(editor, (root) => root.moveDown());
    }
    moveListElementUp(editor) {
        return this.execute(editor, (root) => root.moveUp());
    }
    moveListElementRight(editor) {
        return this.execute(editor, (root) => root.moveRight());
    }
    moveListElementLeft(editor) {
        return this.execute(editor, (root) => root.moveLeft());
    }
    delete(editor) {
        if (!this.isJustCursor(editor)) {
            return false;
        }
        const root = this.parseList(editor);
        if (!root) {
            return false;
        }
        if (root.getTotalLines() === 1 &&
            root.getChildren()[0].getContent().length === 0) {
            editor.replaceRange("", root.getStart(), root.getEnd());
            return true;
        }
        const res = root.delete();
        if (res) {
            this.applyChanges(editor, root);
        }
        return res;
    }
    deleteNext(editor) {
        if (!this.isJustCursor(editor)) {
            return false;
        }
        const root = this.parseList(editor);
        if (!root) {
            return false;
        }
        const list = root.getCursorOnList();
        const nextLineNo = root.getCursor().line + 1;
        const nextList = root.getListUnderLine(nextLineNo);
        if (!nextList || root.getCursor().ch !== list.getContentEndCh()) {
            return false;
        }
        root.replaceCursor({
            line: nextLineNo,
            ch: nextList.getContentStartCh(),
        });
        const res = root.delete();
        const reallyChanged = root.getCursor().line !== nextLineNo;
        if (reallyChanged) {
            this.applyChanges(editor, root);
        }
        return res;
    }
    deleteFullLeft(editor) {
        const selection = editor.listSelections()[0];
        if (!rangeIsCursor(selection)) {
            editor.replaceRange("", selection.from(), selection.to());
            return true;
        }
        return this.execute(editor, (root) => root.deleteFullLeft());
    }
    setFold(editor, type) {
        if (!this.isCursorInList(editor)) {
            return false;
        }
        editor.foldCode(editor.getCursor(), null, type);
        return true;
    }
    fold(editor) {
        return this.setFold(editor, "fold");
    }
    unfold(editor) {
        return this.setFold(editor, "unfold");
    }
    cursorLeft(editor) {
        const cursor = editor.getCursor();
        const indentSign = this.detectListIndentSign(editor, cursor);
        if (indentSign === null) {
            return false;
        }
        const line = editor.getLine(cursor.line);
        const linePrefix = this.getListLineInfo(line, indentSign).prefixLength;
        if (cursor.ch > linePrefix) {
            return false;
        }
        const newCursor = this.iterateWhileFolded(editor, {
            line: cursor.line,
            ch: 0,
        }, (pos) => {
            pos.line--;
            pos.ch = editor.getLine(pos.line).length - 1;
        });
        newCursor.ch++;
        editor.setCursor(newCursor);
        return true;
    }
    selectFullLeft(editor) {
        const cursor = editor.getCursor();
        const root = this.parseList(editor, cursor);
        if (!root) {
            return false;
        }
        const list = root.getCursorOnList();
        const startCh = list.getContentStartCh();
        const selection = editor.listSelections()[0];
        editor.setSelection(selection.anchor, {
            line: cursor.line,
            ch: startCh,
        });
        return true;
    }
    zoomOut(editor) {
        const zoomState = this.zoomStates.get(editor);
        if (!zoomState) {
            return false;
        }
        for (let i = editor.firstLine(), l = editor.lastLine(); i <= l; i++) {
            editor.removeLineClass(i, "wrap", "outliner-plugin-hidden-row");
        }
        zoomState.header.parentElement.removeChild(zoomState.header);
        this.zoomStates.delete(editor);
        return true;
    }
    zoomIn(editor, cursor = editor.getCursor()) {
        const lineNo = cursor.line;
        const root = this.parseList(editor, cursor);
        if (!root) {
            return false;
        }
        this.zoomOut(editor);
        const { indentLevel } = this.getListLineInfo(editor.getLine(lineNo), root.getIndentSign());
        let after = false;
        for (let i = editor.firstLine(), l = editor.lastLine(); i <= l; i++) {
            if (i < lineNo) {
                editor.addLineClass(i, "wrap", "outliner-plugin-hidden-row");
            }
            else if (i > lineNo && !after) {
                const afterLineInfo = this.getListLineInfo(editor.getLine(i), root.getIndentSign());
                after = !afterLineInfo || afterLineInfo.indentLevel <= indentLevel;
            }
            if (after) {
                editor.addLineClass(i, "wrap", "outliner-plugin-hidden-row");
            }
        }
        const createSeparator = () => {
            const span = document.createElement("span");
            span.textContent = " > ";
            return span;
        };
        const createTitle = (content, cb) => {
            const a = document.createElement("a");
            a.className = "outliner-plugin-zoom-title";
            if (content) {
                a.textContent = content;
            }
            else {
                a.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
            }
            a.onclick = (e) => {
                e.preventDefault();
                cb();
            };
            return a;
        };
        const createHeader = () => {
            const div = document.createElement("div");
            div.className = "outliner-plugin-zoom-header";
            let list = root.getListUnderLine(lineNo).getParent();
            while (list && list.getParent()) {
                const lineNo = root.getLineNumber(list);
                div.prepend(createTitle(list.getContent(), () => this.zoomIn(editor, { line: lineNo, ch: 0 })));
                div.prepend(createSeparator());
                list = list.getParent();
            }
            div.prepend(createTitle(this.app.workspace.activeLeaf.getDisplayText(), () => this.zoomOut(editor)));
            return div;
        };
        const zoomHeader = createHeader();
        editor.getWrapperElement().prepend(zoomHeader);
        this.zoomStates.set(editor, new ZoomState(editor.getLineHandle(lineNo), zoomHeader));
        return true;
    }
    selectAll(editor) {
        const selections = editor.listSelections();
        if (selections.length !== 1) {
            return false;
        }
        const selection = selections[0];
        if (selection.anchor.line !== selection.head.line) {
            return false;
        }
        const root = this.parseList(editor, selection.anchor);
        if (!root) {
            return false;
        }
        const list = root.getCursorOnList();
        const startCh = list.getContentStartCh();
        const endCh = list.getContentEndCh();
        if (selection.from().ch === startCh && selection.to().ch === endCh) {
            // select all list
            editor.setSelection(root.getStart(), root.getEnd());
        }
        else {
            // select all line
            editor.setSelection({
                line: selection.anchor.line,
                ch: startCh,
            }, {
                line: selection.anchor.line,
                ch: endCh,
            });
        }
        return true;
    }
    outdentIfLineIsEmpty(editor) {
        if (!this.isJustCursor(editor)) {
            return false;
        }
        const root = this.parseList(editor);
        if (!root) {
            return false;
        }
        const list = root.getCursorOnList();
        if (list.getContent().length > 0 || list.getLevel() === 1) {
            return false;
        }
        root.moveLeft();
        this.applyChanges(editor, root);
        return true;
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    addListsStyles() {
        document.body.classList.add("outliner-plugin-bls");
        const text = (size) => `Outliner styles doesn't work with ${size}-spaces-tabs. Please check your Obsidian settings.`;
        const item = this.addStatusBarItem();
        item.style.color = "red";
        item.style.display = "none";
        let visible = null;
        this.registerInterval(window.setInterval(() => {
            const { useTab, tabSize } = this.getObsidianTabsSettigns();
            const shouldBeVisible = useTab && tabSize !== 4;
            if (shouldBeVisible && visible !== tabSize) {
                item.style.display = "block";
                item.setText(text(tabSize));
                visible = tabSize;
            }
            else if (!shouldBeVisible && visible !== null) {
                item.style.display = "none";
                visible = null;
            }
        }, 1000));
    }
    removeListsStyles() {
        document.body.classList.remove("outliner-plugin-bls");
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Loading obsidian-outliner`);
            yield this.loadSettings();
            this.addSettingTab(new ObsidianOutlinerPluginSettingTab(this.app, this));
            if (this.settings.styleLists) {
                this.addListsStyles();
            }
            this.addCommand({
                id: "zoom-in",
                name: "Zoom In",
                callback: () => {
                    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                    if (!view) {
                        return;
                    }
                    this.zoomIn(view.sourceMode.cmEditor);
                },
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: ".",
                    },
                ],
            });
            this.addCommand({
                id: "zoom-out",
                name: "Zoom Out",
                callback: () => {
                    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                    if (!view) {
                        return;
                    }
                    this.zoomOut(view.sourceMode.cmEditor);
                },
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: ".",
                    },
                ],
            });
            this.registerCodeMirror((cm) => {
                cm.on("beforeChange", (cm, changeObj) => {
                    const zoomState = this.zoomStates.get(cm);
                    if (!zoomState ||
                        changeObj.origin !== "setValue" ||
                        changeObj.from.line !== 0 ||
                        changeObj.from.ch !== 0) {
                        return;
                    }
                    const tillLine = cm.lastLine();
                    const tillCh = cm.getLine(tillLine).length;
                    if (changeObj.to.line !== tillLine || changeObj.to.ch !== tillCh) {
                        return;
                    }
                    this.zoomOut(cm);
                });
                cm.on("change", (cm, changeObj) => {
                    const zoomState = this.zoomStates.get(cm);
                    if (!zoomState || changeObj.origin !== "setValue") {
                        return;
                    }
                    this.zoomIn(cm, {
                        line: cm.getLineNumber(zoomState.line),
                        ch: 0,
                    });
                });
                cm.on("beforeChange", (cm, changeObj) => {
                    const currentLine = cm.getLine(changeObj.from.line);
                    const nextLine = cm.getLine(changeObj.from.line + 1);
                    if (!currentLine || !nextLine) {
                        return;
                    }
                    const indentSign = this.detectListIndentSign(cm, changeObj.from);
                    if (indentSign === null) {
                        return;
                    }
                    const currentLineInfo = this.getListLineInfo(currentLine, indentSign);
                    const nextLineInfo = this.getListLineInfo(nextLine, indentSign);
                    if (!currentLineInfo || !nextLineInfo) {
                        return;
                    }
                    const changeIsNewline = changeObj.text.length === 2 &&
                        changeObj.text[0] === "" &&
                        !!this.getListLineInfo(changeObj.text[1], indentSign);
                    const nexlineLevelIsBigger = currentLineInfo.indentLevel + 1 == nextLineInfo.indentLevel;
                    const nextLineIsEmpty = cm.getRange(changeObj.from, {
                        line: changeObj.from.line,
                        ch: changeObj.from.ch + 1,
                    }).length === 0;
                    if (changeIsNewline && nexlineLevelIsBigger && nextLineIsEmpty) {
                        changeObj.text[1] = indentSign + changeObj.text[1];
                        changeObj.update(changeObj.from, changeObj.to, changeObj.text);
                    }
                });
                cm.on("beforeSelectionChange", (cm, changeObj) => {
                    if (!this.zoomStates.has(cm)) {
                        return;
                    }
                    let visibleFrom = null;
                    let visibleTill = null;
                    for (let i = cm.firstLine(); i <= cm.lastLine(); i++) {
                        const wrapClass = cm.lineInfo(i).wrapClass || "";
                        const isHidden = wrapClass.includes("outliner-plugin-hidden-row");
                        if (visibleFrom === null && !isHidden) {
                            visibleFrom = { line: i, ch: 0 };
                        }
                        if (visibleFrom !== null && visibleTill !== null && isHidden) {
                            break;
                        }
                        if (visibleFrom !== null) {
                            visibleTill = { line: i, ch: cm.getLine(i).length };
                        }
                    }
                    let changed = false;
                    for (const range of changeObj.ranges) {
                        if (range.anchor.line < visibleFrom.line) {
                            changed = true;
                            range.anchor.line = visibleFrom.line;
                            range.anchor.ch = visibleFrom.ch;
                        }
                        if (range.anchor.line > visibleTill.line) {
                            changed = true;
                            range.anchor.line = visibleTill.line;
                            range.anchor.ch = visibleTill.ch;
                        }
                        if (range.head.line < visibleFrom.line) {
                            changed = true;
                            range.head.line = visibleFrom.line;
                            range.head.ch = visibleFrom.ch;
                        }
                        if (range.head.line > visibleTill.line) {
                            changed = true;
                            range.head.line = visibleTill.line;
                            range.head.ch = visibleTill.ch;
                        }
                    }
                    if (changed) {
                        changeObj.update(changeObj.ranges);
                    }
                });
                cm.on("cursorActivity", (cm) => {
                    if (this.isJustCursor(cm) && this.isCursorInList(cm)) {
                        this.evalEnsureCursorInContent(cm);
                    }
                });
                cm.on("keydown", this.handleKeydown);
            });
        });
    }
    onunload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Unloading obsidian-outliner`);
            this.removeListsStyles();
            this.app.workspace.iterateCodeMirrors((cm) => {
                cm.off("keydown", this.handleKeydown);
            });
        });
    }
}
class ObsidianOutlinerPluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Style lists")
            .setDesc("Enable better lists styles (works well only with spaces or 4-spaces-tabs)")
            .addToggle((toggle) => {
            toggle
                .setValue(this.plugin.settings.styleLists)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.styleLists = value;
                yield this.plugin.saveSettings();
                if (value) {
                    this.plugin.addListsStyles();
                }
                else {
                    this.plugin.removeListsStyles();
                }
            }));
        });
        new obsidian.Setting(containerEl).setName("Debug mode").addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.debug).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.debug = value;
                yield this.plugin.saveSettings();
            }));
        });
    }
}

module.exports = ObsidianOutlinerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmL2xpYi9pbmRleC5tanMiLCJtYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBmcm9tLmxlbmd0aCwgaiA9IHRvLmxlbmd0aDsgaSA8IGlsOyBpKyssIGorKylcclxuICAgICAgICB0b1tqXSA9IGZyb21baV07XHJcbiAgICByZXR1cm4gdG87XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHByaXZhdGVNYXApIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBnZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcHJpdmF0ZU1hcC5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgcHJpdmF0ZU1hcCwgdmFsdWUpIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBzZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICBwcml2YXRlTWFwLnNldChyZWNlaXZlciwgdmFsdWUpO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59XHJcbiIsImZ1bmN0aW9uIERpZmYoKSB7fVxuRGlmZi5wcm90b3R5cGUgPSB7XG4gIGRpZmY6IGZ1bmN0aW9uIGRpZmYob2xkU3RyaW5nLCBuZXdTdHJpbmcpIHtcbiAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG4gICAgdmFyIGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gZG9uZSh2YWx1ZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgdmFsdWUpO1xuICAgICAgICB9LCAwKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgfSAvLyBBbGxvdyBzdWJjbGFzc2VzIHRvIG1hc3NhZ2UgdGhlIGlucHV0IHByaW9yIHRvIHJ1bm5pbmdcblxuXG4gICAgb2xkU3RyaW5nID0gdGhpcy5jYXN0SW5wdXQob2xkU3RyaW5nKTtcbiAgICBuZXdTdHJpbmcgPSB0aGlzLmNhc3RJbnB1dChuZXdTdHJpbmcpO1xuICAgIG9sZFN0cmluZyA9IHRoaXMucmVtb3ZlRW1wdHkodGhpcy50b2tlbml6ZShvbGRTdHJpbmcpKTtcbiAgICBuZXdTdHJpbmcgPSB0aGlzLnJlbW92ZUVtcHR5KHRoaXMudG9rZW5pemUobmV3U3RyaW5nKSk7XG4gICAgdmFyIG5ld0xlbiA9IG5ld1N0cmluZy5sZW5ndGgsXG4gICAgICAgIG9sZExlbiA9IG9sZFN0cmluZy5sZW5ndGg7XG4gICAgdmFyIGVkaXRMZW5ndGggPSAxO1xuICAgIHZhciBtYXhFZGl0TGVuZ3RoID0gbmV3TGVuICsgb2xkTGVuO1xuICAgIHZhciBiZXN0UGF0aCA9IFt7XG4gICAgICBuZXdQb3M6IC0xLFxuICAgICAgY29tcG9uZW50czogW11cbiAgICB9XTsgLy8gU2VlZCBlZGl0TGVuZ3RoID0gMCwgaS5lLiB0aGUgY29udGVudCBzdGFydHMgd2l0aCB0aGUgc2FtZSB2YWx1ZXNcblxuICAgIHZhciBvbGRQb3MgPSB0aGlzLmV4dHJhY3RDb21tb24oYmVzdFBhdGhbMF0sIG5ld1N0cmluZywgb2xkU3RyaW5nLCAwKTtcblxuICAgIGlmIChiZXN0UGF0aFswXS5uZXdQb3MgKyAxID49IG5ld0xlbiAmJiBvbGRQb3MgKyAxID49IG9sZExlbikge1xuICAgICAgLy8gSWRlbnRpdHkgcGVyIHRoZSBlcXVhbGl0eSBhbmQgdG9rZW5pemVyXG4gICAgICByZXR1cm4gZG9uZShbe1xuICAgICAgICB2YWx1ZTogdGhpcy5qb2luKG5ld1N0cmluZyksXG4gICAgICAgIGNvdW50OiBuZXdTdHJpbmcubGVuZ3RoXG4gICAgICB9XSk7XG4gICAgfSAvLyBNYWluIHdvcmtlciBtZXRob2QuIGNoZWNrcyBhbGwgcGVybXV0YXRpb25zIG9mIGEgZ2l2ZW4gZWRpdCBsZW5ndGggZm9yIGFjY2VwdGFuY2UuXG5cblxuICAgIGZ1bmN0aW9uIGV4ZWNFZGl0TGVuZ3RoKCkge1xuICAgICAgZm9yICh2YXIgZGlhZ29uYWxQYXRoID0gLTEgKiBlZGl0TGVuZ3RoOyBkaWFnb25hbFBhdGggPD0gZWRpdExlbmd0aDsgZGlhZ29uYWxQYXRoICs9IDIpIHtcbiAgICAgICAgdmFyIGJhc2VQYXRoID0gdm9pZCAwO1xuXG4gICAgICAgIHZhciBhZGRQYXRoID0gYmVzdFBhdGhbZGlhZ29uYWxQYXRoIC0gMV0sXG4gICAgICAgICAgICByZW1vdmVQYXRoID0gYmVzdFBhdGhbZGlhZ29uYWxQYXRoICsgMV0sXG4gICAgICAgICAgICBfb2xkUG9zID0gKHJlbW92ZVBhdGggPyByZW1vdmVQYXRoLm5ld1BvcyA6IDApIC0gZGlhZ29uYWxQYXRoO1xuXG4gICAgICAgIGlmIChhZGRQYXRoKSB7XG4gICAgICAgICAgLy8gTm8gb25lIGVsc2UgaXMgZ29pbmcgdG8gYXR0ZW1wdCB0byB1c2UgdGhpcyB2YWx1ZSwgY2xlYXIgaXRcbiAgICAgICAgICBiZXN0UGF0aFtkaWFnb25hbFBhdGggLSAxXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYW5BZGQgPSBhZGRQYXRoICYmIGFkZFBhdGgubmV3UG9zICsgMSA8IG5ld0xlbixcbiAgICAgICAgICAgIGNhblJlbW92ZSA9IHJlbW92ZVBhdGggJiYgMCA8PSBfb2xkUG9zICYmIF9vbGRQb3MgPCBvbGRMZW47XG5cbiAgICAgICAgaWYgKCFjYW5BZGQgJiYgIWNhblJlbW92ZSkge1xuICAgICAgICAgIC8vIElmIHRoaXMgcGF0aCBpcyBhIHRlcm1pbmFsIHRoZW4gcHJ1bmVcbiAgICAgICAgICBiZXN0UGF0aFtkaWFnb25hbFBhdGhdID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IC8vIFNlbGVjdCB0aGUgZGlhZ29uYWwgdGhhdCB3ZSB3YW50IHRvIGJyYW5jaCBmcm9tLiBXZSBzZWxlY3QgdGhlIHByaW9yXG4gICAgICAgIC8vIHBhdGggd2hvc2UgcG9zaXRpb24gaW4gdGhlIG5ldyBzdHJpbmcgaXMgdGhlIGZhcnRoZXN0IGZyb20gdGhlIG9yaWdpblxuICAgICAgICAvLyBhbmQgZG9lcyBub3QgcGFzcyB0aGUgYm91bmRzIG9mIHRoZSBkaWZmIGdyYXBoXG5cblxuICAgICAgICBpZiAoIWNhbkFkZCB8fCBjYW5SZW1vdmUgJiYgYWRkUGF0aC5uZXdQb3MgPCByZW1vdmVQYXRoLm5ld1Bvcykge1xuICAgICAgICAgIGJhc2VQYXRoID0gY2xvbmVQYXRoKHJlbW92ZVBhdGgpO1xuICAgICAgICAgIHNlbGYucHVzaENvbXBvbmVudChiYXNlUGF0aC5jb21wb25lbnRzLCB1bmRlZmluZWQsIHRydWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJhc2VQYXRoID0gYWRkUGF0aDsgLy8gTm8gbmVlZCB0byBjbG9uZSwgd2UndmUgcHVsbGVkIGl0IGZyb20gdGhlIGxpc3RcblxuICAgICAgICAgIGJhc2VQYXRoLm5ld1BvcysrO1xuICAgICAgICAgIHNlbGYucHVzaENvbXBvbmVudChiYXNlUGF0aC5jb21wb25lbnRzLCB0cnVlLCB1bmRlZmluZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgX29sZFBvcyA9IHNlbGYuZXh0cmFjdENvbW1vbihiYXNlUGF0aCwgbmV3U3RyaW5nLCBvbGRTdHJpbmcsIGRpYWdvbmFsUGF0aCk7IC8vIElmIHdlIGhhdmUgaGl0IHRoZSBlbmQgb2YgYm90aCBzdHJpbmdzLCB0aGVuIHdlIGFyZSBkb25lXG5cbiAgICAgICAgaWYgKGJhc2VQYXRoLm5ld1BvcyArIDEgPj0gbmV3TGVuICYmIF9vbGRQb3MgKyAxID49IG9sZExlbikge1xuICAgICAgICAgIHJldHVybiBkb25lKGJ1aWxkVmFsdWVzKHNlbGYsIGJhc2VQYXRoLmNvbXBvbmVudHMsIG5ld1N0cmluZywgb2xkU3RyaW5nLCBzZWxmLnVzZUxvbmdlc3RUb2tlbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0cmFjayB0aGlzIHBhdGggYXMgYSBwb3RlbnRpYWwgY2FuZGlkYXRlIGFuZCBjb250aW51ZS5cbiAgICAgICAgICBiZXN0UGF0aFtkaWFnb25hbFBhdGhdID0gYmFzZVBhdGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdExlbmd0aCsrO1xuICAgIH0gLy8gUGVyZm9ybXMgdGhlIGxlbmd0aCBvZiBlZGl0IGl0ZXJhdGlvbi4gSXMgYSBiaXQgZnVnbHkgYXMgdGhpcyBoYXMgdG8gc3VwcG9ydCB0aGVcbiAgICAvLyBzeW5jIGFuZCBhc3luYyBtb2RlIHdoaWNoIGlzIG5ldmVyIGZ1bi4gTG9vcHMgb3ZlciBleGVjRWRpdExlbmd0aCB1bnRpbCBhIHZhbHVlXG4gICAgLy8gaXMgcHJvZHVjZWQuXG5cblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgKGZ1bmN0aW9uIGV4ZWMoKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIG5vdCBoYXBwZW4sIGJ1dCB3ZSB3YW50IHRvIGJlIHNhZmUuXG5cbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgIGlmIChlZGl0TGVuZ3RoID4gbWF4RWRpdExlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFleGVjRWRpdExlbmd0aCgpKSB7XG4gICAgICAgICAgICBleGVjKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAwKTtcbiAgICAgIH0pKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdoaWxlIChlZGl0TGVuZ3RoIDw9IG1heEVkaXRMZW5ndGgpIHtcbiAgICAgICAgdmFyIHJldCA9IGV4ZWNFZGl0TGVuZ3RoKCk7XG5cbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIHB1c2hDb21wb25lbnQ6IGZ1bmN0aW9uIHB1c2hDb21wb25lbnQoY29tcG9uZW50cywgYWRkZWQsIHJlbW92ZWQpIHtcbiAgICB2YXIgbGFzdCA9IGNvbXBvbmVudHNbY29tcG9uZW50cy5sZW5ndGggLSAxXTtcblxuICAgIGlmIChsYXN0ICYmIGxhc3QuYWRkZWQgPT09IGFkZGVkICYmIGxhc3QucmVtb3ZlZCA9PT0gcmVtb3ZlZCkge1xuICAgICAgLy8gV2UgbmVlZCB0byBjbG9uZSBoZXJlIGFzIHRoZSBjb21wb25lbnQgY2xvbmUgb3BlcmF0aW9uIGlzIGp1c3RcbiAgICAgIC8vIGFzIHNoYWxsb3cgYXJyYXkgY2xvbmVcbiAgICAgIGNvbXBvbmVudHNbY29tcG9uZW50cy5sZW5ndGggLSAxXSA9IHtcbiAgICAgICAgY291bnQ6IGxhc3QuY291bnQgKyAxLFxuICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbXBvbmVudHMucHVzaCh7XG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgZXh0cmFjdENvbW1vbjogZnVuY3Rpb24gZXh0cmFjdENvbW1vbihiYXNlUGF0aCwgbmV3U3RyaW5nLCBvbGRTdHJpbmcsIGRpYWdvbmFsUGF0aCkge1xuICAgIHZhciBuZXdMZW4gPSBuZXdTdHJpbmcubGVuZ3RoLFxuICAgICAgICBvbGRMZW4gPSBvbGRTdHJpbmcubGVuZ3RoLFxuICAgICAgICBuZXdQb3MgPSBiYXNlUGF0aC5uZXdQb3MsXG4gICAgICAgIG9sZFBvcyA9IG5ld1BvcyAtIGRpYWdvbmFsUGF0aCxcbiAgICAgICAgY29tbW9uQ291bnQgPSAwO1xuXG4gICAgd2hpbGUgKG5ld1BvcyArIDEgPCBuZXdMZW4gJiYgb2xkUG9zICsgMSA8IG9sZExlbiAmJiB0aGlzLmVxdWFscyhuZXdTdHJpbmdbbmV3UG9zICsgMV0sIG9sZFN0cmluZ1tvbGRQb3MgKyAxXSkpIHtcbiAgICAgIG5ld1BvcysrO1xuICAgICAgb2xkUG9zKys7XG4gICAgICBjb21tb25Db3VudCsrO1xuICAgIH1cblxuICAgIGlmIChjb21tb25Db3VudCkge1xuICAgICAgYmFzZVBhdGguY29tcG9uZW50cy5wdXNoKHtcbiAgICAgICAgY291bnQ6IGNvbW1vbkNvdW50XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBiYXNlUGF0aC5uZXdQb3MgPSBuZXdQb3M7XG4gICAgcmV0dXJuIG9sZFBvcztcbiAgfSxcbiAgZXF1YWxzOiBmdW5jdGlvbiBlcXVhbHMobGVmdCwgcmlnaHQpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbXBhcmF0b3IpIHtcbiAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuY29tcGFyYXRvcihsZWZ0LCByaWdodCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBsZWZ0ID09PSByaWdodCB8fCB0aGlzLm9wdGlvbnMuaWdub3JlQ2FzZSAmJiBsZWZ0LnRvTG93ZXJDYXNlKCkgPT09IHJpZ2h0LnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuICB9LFxuICByZW1vdmVFbXB0eTogZnVuY3Rpb24gcmVtb3ZlRW1wdHkoYXJyYXkpIHtcbiAgICB2YXIgcmV0ID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyYXlbaV0pIHtcbiAgICAgICAgcmV0LnB1c2goYXJyYXlbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0sXG4gIGNhc3RJbnB1dDogZnVuY3Rpb24gY2FzdElucHV0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9LFxuICB0b2tlbml6ZTogZnVuY3Rpb24gdG9rZW5pemUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUuc3BsaXQoJycpO1xuICB9LFxuICBqb2luOiBmdW5jdGlvbiBqb2luKGNoYXJzKSB7XG4gICAgcmV0dXJuIGNoYXJzLmpvaW4oJycpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBidWlsZFZhbHVlcyhkaWZmLCBjb21wb25lbnRzLCBuZXdTdHJpbmcsIG9sZFN0cmluZywgdXNlTG9uZ2VzdFRva2VuKSB7XG4gIHZhciBjb21wb25lbnRQb3MgPSAwLFxuICAgICAgY29tcG9uZW50TGVuID0gY29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBuZXdQb3MgPSAwLFxuICAgICAgb2xkUG9zID0gMDtcblxuICBmb3IgKDsgY29tcG9uZW50UG9zIDwgY29tcG9uZW50TGVuOyBjb21wb25lbnRQb3MrKykge1xuICAgIHZhciBjb21wb25lbnQgPSBjb21wb25lbnRzW2NvbXBvbmVudFBvc107XG5cbiAgICBpZiAoIWNvbXBvbmVudC5yZW1vdmVkKSB7XG4gICAgICBpZiAoIWNvbXBvbmVudC5hZGRlZCAmJiB1c2VMb25nZXN0VG9rZW4pIHtcbiAgICAgICAgdmFyIHZhbHVlID0gbmV3U3RyaW5nLnNsaWNlKG5ld1BvcywgbmV3UG9zICsgY29tcG9uZW50LmNvdW50KTtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5tYXAoZnVuY3Rpb24gKHZhbHVlLCBpKSB7XG4gICAgICAgICAgdmFyIG9sZFZhbHVlID0gb2xkU3RyaW5nW29sZFBvcyArIGldO1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZS5sZW5ndGggPiB2YWx1ZS5sZW5ndGggPyBvbGRWYWx1ZSA6IHZhbHVlO1xuICAgICAgICB9KTtcbiAgICAgICAgY29tcG9uZW50LnZhbHVlID0gZGlmZi5qb2luKHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudC52YWx1ZSA9IGRpZmYuam9pbihuZXdTdHJpbmcuc2xpY2UobmV3UG9zLCBuZXdQb3MgKyBjb21wb25lbnQuY291bnQpKTtcbiAgICAgIH1cblxuICAgICAgbmV3UG9zICs9IGNvbXBvbmVudC5jb3VudDsgLy8gQ29tbW9uIGNhc2VcblxuICAgICAgaWYgKCFjb21wb25lbnQuYWRkZWQpIHtcbiAgICAgICAgb2xkUG9zICs9IGNvbXBvbmVudC5jb3VudDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29tcG9uZW50LnZhbHVlID0gZGlmZi5qb2luKG9sZFN0cmluZy5zbGljZShvbGRQb3MsIG9sZFBvcyArIGNvbXBvbmVudC5jb3VudCkpO1xuICAgICAgb2xkUG9zICs9IGNvbXBvbmVudC5jb3VudDsgLy8gUmV2ZXJzZSBhZGQgYW5kIHJlbW92ZSBzbyByZW1vdmVzIGFyZSBvdXRwdXQgZmlyc3QgdG8gbWF0Y2ggY29tbW9uIGNvbnZlbnRpb25cbiAgICAgIC8vIFRoZSBkaWZmaW5nIGFsZ29yaXRobSBpcyB0aWVkIHRvIGFkZCB0aGVuIHJlbW92ZSBvdXRwdXQgYW5kIHRoaXMgaXMgdGhlIHNpbXBsZXN0XG4gICAgICAvLyByb3V0ZSB0byBnZXQgdGhlIGRlc2lyZWQgb3V0cHV0IHdpdGggbWluaW1hbCBvdmVyaGVhZC5cblxuICAgICAgaWYgKGNvbXBvbmVudFBvcyAmJiBjb21wb25lbnRzW2NvbXBvbmVudFBvcyAtIDFdLmFkZGVkKSB7XG4gICAgICAgIHZhciB0bXAgPSBjb21wb25lbnRzW2NvbXBvbmVudFBvcyAtIDFdO1xuICAgICAgICBjb21wb25lbnRzW2NvbXBvbmVudFBvcyAtIDFdID0gY29tcG9uZW50c1tjb21wb25lbnRQb3NdO1xuICAgICAgICBjb21wb25lbnRzW2NvbXBvbmVudFBvc10gPSB0bXA7XG4gICAgICB9XG4gICAgfVxuICB9IC8vIFNwZWNpYWwgY2FzZSBoYW5kbGUgZm9yIHdoZW4gb25lIHRlcm1pbmFsIGlzIGlnbm9yZWQgKGkuZS4gd2hpdGVzcGFjZSkuXG4gIC8vIEZvciB0aGlzIGNhc2Ugd2UgbWVyZ2UgdGhlIHRlcm1pbmFsIGludG8gdGhlIHByaW9yIHN0cmluZyBhbmQgZHJvcCB0aGUgY2hhbmdlLlxuICAvLyBUaGlzIGlzIG9ubHkgYXZhaWxhYmxlIGZvciBzdHJpbmcgbW9kZS5cblxuXG4gIHZhciBsYXN0Q29tcG9uZW50ID0gY29tcG9uZW50c1tjb21wb25lbnRMZW4gLSAxXTtcblxuICBpZiAoY29tcG9uZW50TGVuID4gMSAmJiB0eXBlb2YgbGFzdENvbXBvbmVudC52YWx1ZSA9PT0gJ3N0cmluZycgJiYgKGxhc3RDb21wb25lbnQuYWRkZWQgfHwgbGFzdENvbXBvbmVudC5yZW1vdmVkKSAmJiBkaWZmLmVxdWFscygnJywgbGFzdENvbXBvbmVudC52YWx1ZSkpIHtcbiAgICBjb21wb25lbnRzW2NvbXBvbmVudExlbiAtIDJdLnZhbHVlICs9IGxhc3RDb21wb25lbnQudmFsdWU7XG4gICAgY29tcG9uZW50cy5wb3AoKTtcbiAgfVxuXG4gIHJldHVybiBjb21wb25lbnRzO1xufVxuXG5mdW5jdGlvbiBjbG9uZVBhdGgocGF0aCkge1xuICByZXR1cm4ge1xuICAgIG5ld1BvczogcGF0aC5uZXdQb3MsXG4gICAgY29tcG9uZW50czogcGF0aC5jb21wb25lbnRzLnNsaWNlKDApXG4gIH07XG59XG5cbnZhciBjaGFyYWN0ZXJEaWZmID0gbmV3IERpZmYoKTtcbmZ1bmN0aW9uIGRpZmZDaGFycyhvbGRTdHIsIG5ld1N0ciwgb3B0aW9ucykge1xuICByZXR1cm4gY2hhcmFjdGVyRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVPcHRpb25zKG9wdGlvbnMsIGRlZmF1bHRzKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGRlZmF1bHRzLmNhbGxiYWNrID0gb3B0aW9ucztcbiAgfSBlbHNlIGlmIChvcHRpb25zKSB7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBvcHRpb25zKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgZGVmYXVsdHNbbmFtZV0gPSBvcHRpb25zW25hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZWZhdWx0cztcbn1cblxuLy9cbi8vIFJhbmdlcyBhbmQgZXhjZXB0aW9uczpcbi8vIExhdGluLTEgU3VwcGxlbWVudCwgMDA4MOKAkzAwRkZcbi8vICAtIFUrMDBENyAgw5cgTXVsdGlwbGljYXRpb24gc2lnblxuLy8gIC0gVSswMEY3ICDDtyBEaXZpc2lvbiBzaWduXG4vLyBMYXRpbiBFeHRlbmRlZC1BLCAwMTAw4oCTMDE3RlxuLy8gTGF0aW4gRXh0ZW5kZWQtQiwgMDE4MOKAkzAyNEZcbi8vIElQQSBFeHRlbnNpb25zLCAwMjUw4oCTMDJBRlxuLy8gU3BhY2luZyBNb2RpZmllciBMZXR0ZXJzLCAwMkIw4oCTMDJGRlxuLy8gIC0gVSswMkM3ICDLhyAmIzcxMTsgIENhcm9uXG4vLyAgLSBVKzAyRDggIMuYICYjNzI4OyAgQnJldmVcbi8vICAtIFUrMDJEOSAgy5kgJiM3Mjk7ICBEb3QgQWJvdmVcbi8vICAtIFUrMDJEQSAgy5ogJiM3MzA7ICBSaW5nIEFib3ZlXG4vLyAgLSBVKzAyREIgIMubICYjNzMxOyAgT2dvbmVrXG4vLyAgLSBVKzAyREMgIMucICYjNzMyOyAgU21hbGwgVGlsZGVcbi8vICAtIFUrMDJERCAgy50gJiM3MzM7ICBEb3VibGUgQWN1dGUgQWNjZW50XG4vLyBMYXRpbiBFeHRlbmRlZCBBZGRpdGlvbmFsLCAxRTAw4oCTMUVGRlxuXG52YXIgZXh0ZW5kZWRXb3JkQ2hhcnMgPSAvXltBLVphLXpcXHhDMC1cXHUwMkM2XFx1MDJDOC1cXHUwMkQ3XFx1MDJERS1cXHUwMkZGXFx1MUUwMC1cXHUxRUZGXSskLztcbnZhciByZVdoaXRlc3BhY2UgPSAvXFxTLztcbnZhciB3b3JkRGlmZiA9IG5ldyBEaWZmKCk7XG5cbndvcmREaWZmLmVxdWFscyA9IGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICBpZiAodGhpcy5vcHRpb25zLmlnbm9yZUNhc2UpIHtcbiAgICBsZWZ0ID0gbGVmdC50b0xvd2VyQ2FzZSgpO1xuICAgIHJpZ2h0ID0gcmlnaHQudG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIHJldHVybiBsZWZ0ID09PSByaWdodCB8fCB0aGlzLm9wdGlvbnMuaWdub3JlV2hpdGVzcGFjZSAmJiAhcmVXaGl0ZXNwYWNlLnRlc3QobGVmdCkgJiYgIXJlV2hpdGVzcGFjZS50ZXN0KHJpZ2h0KTtcbn07XG5cbndvcmREaWZmLnRva2VuaXplID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIC8vIEFsbCB3aGl0ZXNwYWNlIHN5bWJvbHMgZXhjZXB0IG5ld2xpbmUgZ3JvdXAgaW50byBvbmUgdG9rZW4sIGVhY2ggbmV3bGluZSAtIGluIHNlcGFyYXRlIHRva2VuXG4gIHZhciB0b2tlbnMgPSB2YWx1ZS5zcGxpdCgvKFteXFxTXFxyXFxuXSt8WygpW1xcXXt9J1wiXFxyXFxuXXxcXGIpLyk7IC8vIEpvaW4gdGhlIGJvdW5kYXJ5IHNwbGl0cyB0aGF0IHdlIGRvIG5vdCBjb25zaWRlciB0byBiZSBib3VuZGFyaWVzLiBUaGlzIGlzIHByaW1hcmlseSB0aGUgZXh0ZW5kZWQgTGF0aW4gY2hhcmFjdGVyIHNldC5cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAvLyBJZiB3ZSBoYXZlIGFuIGVtcHR5IHN0cmluZyBpbiB0aGUgbmV4dCBmaWVsZCBhbmQgd2UgaGF2ZSBvbmx5IHdvcmQgY2hhcnMgYmVmb3JlIGFuZCBhZnRlciwgbWVyZ2VcbiAgICBpZiAoIXRva2Vuc1tpICsgMV0gJiYgdG9rZW5zW2kgKyAyXSAmJiBleHRlbmRlZFdvcmRDaGFycy50ZXN0KHRva2Vuc1tpXSkgJiYgZXh0ZW5kZWRXb3JkQ2hhcnMudGVzdCh0b2tlbnNbaSArIDJdKSkge1xuICAgICAgdG9rZW5zW2ldICs9IHRva2Vuc1tpICsgMl07XG4gICAgICB0b2tlbnMuc3BsaWNlKGkgKyAxLCAyKTtcbiAgICAgIGktLTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdG9rZW5zO1xufTtcblxuZnVuY3Rpb24gZGlmZldvcmRzKG9sZFN0ciwgbmV3U3RyLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBnZW5lcmF0ZU9wdGlvbnMob3B0aW9ucywge1xuICAgIGlnbm9yZVdoaXRlc3BhY2U6IHRydWVcbiAgfSk7XG4gIHJldHVybiB3b3JkRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBvcHRpb25zKTtcbn1cbmZ1bmN0aW9uIGRpZmZXb3Jkc1dpdGhTcGFjZShvbGRTdHIsIG5ld1N0ciwgb3B0aW9ucykge1xuICByZXR1cm4gd29yZERpZmYuZGlmZihvbGRTdHIsIG5ld1N0ciwgb3B0aW9ucyk7XG59XG5cbnZhciBsaW5lRGlmZiA9IG5ldyBEaWZmKCk7XG5cbmxpbmVEaWZmLnRva2VuaXplID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciByZXRMaW5lcyA9IFtdLFxuICAgICAgbGluZXNBbmROZXdsaW5lcyA9IHZhbHVlLnNwbGl0KC8oXFxufFxcclxcbikvKTsgLy8gSWdub3JlIHRoZSBmaW5hbCBlbXB0eSB0b2tlbiB0aGF0IG9jY3VycyBpZiB0aGUgc3RyaW5nIGVuZHMgd2l0aCBhIG5ldyBsaW5lXG5cbiAgaWYgKCFsaW5lc0FuZE5ld2xpbmVzW2xpbmVzQW5kTmV3bGluZXMubGVuZ3RoIC0gMV0pIHtcbiAgICBsaW5lc0FuZE5ld2xpbmVzLnBvcCgpO1xuICB9IC8vIE1lcmdlIHRoZSBjb250ZW50IGFuZCBsaW5lIHNlcGFyYXRvcnMgaW50byBzaW5nbGUgdG9rZW5zXG5cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzQW5kTmV3bGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgbGluZSA9IGxpbmVzQW5kTmV3bGluZXNbaV07XG5cbiAgICBpZiAoaSAlIDIgJiYgIXRoaXMub3B0aW9ucy5uZXdsaW5lSXNUb2tlbikge1xuICAgICAgcmV0TGluZXNbcmV0TGluZXMubGVuZ3RoIC0gMV0gKz0gbGluZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5pZ25vcmVXaGl0ZXNwYWNlKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnRyaW0oKTtcbiAgICAgIH1cblxuICAgICAgcmV0TGluZXMucHVzaChsaW5lKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0TGluZXM7XG59O1xuXG5mdW5jdGlvbiBkaWZmTGluZXMob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBsaW5lRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBjYWxsYmFjayk7XG59XG5mdW5jdGlvbiBkaWZmVHJpbW1lZExpbmVzKG9sZFN0ciwgbmV3U3RyLCBjYWxsYmFjaykge1xuICB2YXIgb3B0aW9ucyA9IGdlbmVyYXRlT3B0aW9ucyhjYWxsYmFjaywge1xuICAgIGlnbm9yZVdoaXRlc3BhY2U6IHRydWVcbiAgfSk7XG4gIHJldHVybiBsaW5lRGlmZi5kaWZmKG9sZFN0ciwgbmV3U3RyLCBvcHRpb25zKTtcbn1cblxudmFyIHNlbnRlbmNlRGlmZiA9IG5ldyBEaWZmKCk7XG5cbnNlbnRlbmNlRGlmZi50b2tlbml6ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUuc3BsaXQoLyhcXFMuKz9bLiE/XSkoPz1cXHMrfCQpLyk7XG59O1xuXG5mdW5jdGlvbiBkaWZmU2VudGVuY2VzKG9sZFN0ciwgbmV3U3RyLCBjYWxsYmFjaykge1xuICByZXR1cm4gc2VudGVuY2VEaWZmLmRpZmYob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKTtcbn1cblxudmFyIGNzc0RpZmYgPSBuZXcgRGlmZigpO1xuXG5jc3NEaWZmLnRva2VuaXplID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZS5zcGxpdCgvKFt7fTo7LF18XFxzKykvKTtcbn07XG5cbmZ1bmN0aW9uIGRpZmZDc3Mob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBjc3NEaWZmLmRpZmYob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gX3R5cGVvZihvYmopIHtcbiAgXCJAYmFiZWwvaGVscGVycyAtIHR5cGVvZlwiO1xuXG4gIGlmICh0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIikge1xuICAgIF90eXBlb2YgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9iajtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIF90eXBlb2YgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajtcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIF90eXBlb2Yob2JqKTtcbn1cblxuZnVuY3Rpb24gX3RvQ29uc3VtYWJsZUFycmF5KGFycikge1xuICByZXR1cm4gX2FycmF5V2l0aG91dEhvbGVzKGFycikgfHwgX2l0ZXJhYmxlVG9BcnJheShhcnIpIHx8IF91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheShhcnIpIHx8IF9ub25JdGVyYWJsZVNwcmVhZCgpO1xufVxuXG5mdW5jdGlvbiBfYXJyYXlXaXRob3V0SG9sZXMoYXJyKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KGFycikpIHJldHVybiBfYXJyYXlMaWtlVG9BcnJheShhcnIpO1xufVxuXG5mdW5jdGlvbiBfaXRlcmFibGVUb0FycmF5KGl0ZXIpIHtcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09IFwidW5kZWZpbmVkXCIgJiYgU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChpdGVyKSkgcmV0dXJuIEFycmF5LmZyb20oaXRlcik7XG59XG5cbmZ1bmN0aW9uIF91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheShvLCBtaW5MZW4pIHtcbiAgaWYgKCFvKSByZXR1cm47XG4gIGlmICh0eXBlb2YgbyA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KG8sIG1pbkxlbik7XG4gIHZhciBuID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLnNsaWNlKDgsIC0xKTtcbiAgaWYgKG4gPT09IFwiT2JqZWN0XCIgJiYgby5jb25zdHJ1Y3RvcikgbiA9IG8uY29uc3RydWN0b3IubmFtZTtcbiAgaWYgKG4gPT09IFwiTWFwXCIgfHwgbiA9PT0gXCJTZXRcIikgcmV0dXJuIEFycmF5LmZyb20obyk7XG4gIGlmIChuID09PSBcIkFyZ3VtZW50c1wiIHx8IC9eKD86VWl8SSludCg/Ojh8MTZ8MzIpKD86Q2xhbXBlZCk/QXJyYXkkLy50ZXN0KG4pKSByZXR1cm4gX2FycmF5TGlrZVRvQXJyYXkobywgbWluTGVuKTtcbn1cblxuZnVuY3Rpb24gX2FycmF5TGlrZVRvQXJyYXkoYXJyLCBsZW4pIHtcbiAgaWYgKGxlbiA9PSBudWxsIHx8IGxlbiA+IGFyci5sZW5ndGgpIGxlbiA9IGFyci5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGFycjIgPSBuZXcgQXJyYXkobGVuKTsgaSA8IGxlbjsgaSsrKSBhcnIyW2ldID0gYXJyW2ldO1xuXG4gIHJldHVybiBhcnIyO1xufVxuXG5mdW5jdGlvbiBfbm9uSXRlcmFibGVTcHJlYWQoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gc3ByZWFkIG5vbi1pdGVyYWJsZSBpbnN0YW5jZS5cXG5JbiBvcmRlciB0byBiZSBpdGVyYWJsZSwgbm9uLWFycmF5IG9iamVjdHMgbXVzdCBoYXZlIGEgW1N5bWJvbC5pdGVyYXRvcl0oKSBtZXRob2QuXCIpO1xufVxuXG52YXIgb2JqZWN0UHJvdG90eXBlVG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIGpzb25EaWZmID0gbmV3IERpZmYoKTsgLy8gRGlzY3JpbWluYXRlIGJldHdlZW4gdHdvIGxpbmVzIG9mIHByZXR0eS1wcmludGVkLCBzZXJpYWxpemVkIEpTT04gd2hlcmUgb25lIG9mIHRoZW0gaGFzIGFcbi8vIGRhbmdsaW5nIGNvbW1hIGFuZCB0aGUgb3RoZXIgZG9lc24ndC4gVHVybnMgb3V0IGluY2x1ZGluZyB0aGUgZGFuZ2xpbmcgY29tbWEgeWllbGRzIHRoZSBuaWNlc3Qgb3V0cHV0OlxuXG5qc29uRGlmZi51c2VMb25nZXN0VG9rZW4gPSB0cnVlO1xuanNvbkRpZmYudG9rZW5pemUgPSBsaW5lRGlmZi50b2tlbml6ZTtcblxuanNvbkRpZmYuY2FzdElucHV0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciBfdGhpcyRvcHRpb25zID0gdGhpcy5vcHRpb25zLFxuICAgICAgdW5kZWZpbmVkUmVwbGFjZW1lbnQgPSBfdGhpcyRvcHRpb25zLnVuZGVmaW5lZFJlcGxhY2VtZW50LFxuICAgICAgX3RoaXMkb3B0aW9ucyRzdHJpbmdpID0gX3RoaXMkb3B0aW9ucy5zdHJpbmdpZnlSZXBsYWNlcixcbiAgICAgIHN0cmluZ2lmeVJlcGxhY2VyID0gX3RoaXMkb3B0aW9ucyRzdHJpbmdpID09PSB2b2lkIDAgPyBmdW5jdGlvbiAoaywgdikge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWRSZXBsYWNlbWVudCA6IHY7XG4gIH0gOiBfdGhpcyRvcHRpb25zJHN0cmluZ2k7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gdmFsdWUgOiBKU09OLnN0cmluZ2lmeShjYW5vbmljYWxpemUodmFsdWUsIG51bGwsIG51bGwsIHN0cmluZ2lmeVJlcGxhY2VyKSwgc3RyaW5naWZ5UmVwbGFjZXIsICcgICcpO1xufTtcblxuanNvbkRpZmYuZXF1YWxzID0gZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gIHJldHVybiBEaWZmLnByb3RvdHlwZS5lcXVhbHMuY2FsbChqc29uRGlmZiwgbGVmdC5yZXBsYWNlKC8sKFtcXHJcXG5dKS9nLCAnJDEnKSwgcmlnaHQucmVwbGFjZSgvLChbXFxyXFxuXSkvZywgJyQxJykpO1xufTtcblxuZnVuY3Rpb24gZGlmZkpzb24ob2xkT2JqLCBuZXdPYmosIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGpzb25EaWZmLmRpZmYob2xkT2JqLCBuZXdPYmosIG9wdGlvbnMpO1xufSAvLyBUaGlzIGZ1bmN0aW9uIGhhbmRsZXMgdGhlIHByZXNlbmNlIG9mIGNpcmN1bGFyIHJlZmVyZW5jZXMgYnkgYmFpbGluZyBvdXQgd2hlbiBlbmNvdW50ZXJpbmcgYW5cbi8vIG9iamVjdCB0aGF0IGlzIGFscmVhZHkgb24gdGhlIFwic3RhY2tcIiBvZiBpdGVtcyBiZWluZyBwcm9jZXNzZWQuIEFjY2VwdHMgYW4gb3B0aW9uYWwgcmVwbGFjZXJcblxuZnVuY3Rpb24gY2Fub25pY2FsaXplKG9iaiwgc3RhY2ssIHJlcGxhY2VtZW50U3RhY2ssIHJlcGxhY2VyLCBrZXkpIHtcbiAgc3RhY2sgPSBzdGFjayB8fCBbXTtcbiAgcmVwbGFjZW1lbnRTdGFjayA9IHJlcGxhY2VtZW50U3RhY2sgfHwgW107XG5cbiAgaWYgKHJlcGxhY2VyKSB7XG4gICAgb2JqID0gcmVwbGFjZXIoa2V5LCBvYmopO1xuICB9XG5cbiAgdmFyIGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IHN0YWNrLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgaWYgKHN0YWNrW2ldID09PSBvYmopIHtcbiAgICAgIHJldHVybiByZXBsYWNlbWVudFN0YWNrW2ldO1xuICAgIH1cbiAgfVxuXG4gIHZhciBjYW5vbmljYWxpemVkT2JqO1xuXG4gIGlmICgnW29iamVjdCBBcnJheV0nID09PSBvYmplY3RQcm90b3R5cGVUb1N0cmluZy5jYWxsKG9iaikpIHtcbiAgICBzdGFjay5wdXNoKG9iaik7XG4gICAgY2Fub25pY2FsaXplZE9iaiA9IG5ldyBBcnJheShvYmoubGVuZ3RoKTtcbiAgICByZXBsYWNlbWVudFN0YWNrLnB1c2goY2Fub25pY2FsaXplZE9iaik7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICBjYW5vbmljYWxpemVkT2JqW2ldID0gY2Fub25pY2FsaXplKG9ialtpXSwgc3RhY2ssIHJlcGxhY2VtZW50U3RhY2ssIHJlcGxhY2VyLCBrZXkpO1xuICAgIH1cblxuICAgIHN0YWNrLnBvcCgpO1xuICAgIHJlcGxhY2VtZW50U3RhY2sucG9wKCk7XG4gICAgcmV0dXJuIGNhbm9uaWNhbGl6ZWRPYmo7XG4gIH1cblxuICBpZiAob2JqICYmIG9iai50b0pTT04pIHtcbiAgICBvYmogPSBvYmoudG9KU09OKCk7XG4gIH1cblxuICBpZiAoX3R5cGVvZihvYmopID09PSAnb2JqZWN0JyAmJiBvYmogIT09IG51bGwpIHtcbiAgICBzdGFjay5wdXNoKG9iaik7XG4gICAgY2Fub25pY2FsaXplZE9iaiA9IHt9O1xuICAgIHJlcGxhY2VtZW50U3RhY2sucHVzaChjYW5vbmljYWxpemVkT2JqKTtcblxuICAgIHZhciBzb3J0ZWRLZXlzID0gW10sXG4gICAgICAgIF9rZXk7XG5cbiAgICBmb3IgKF9rZXkgaW4gb2JqKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShfa2V5KSkge1xuICAgICAgICBzb3J0ZWRLZXlzLnB1c2goX2tleSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc29ydGVkS2V5cy5zb3J0KCk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgc29ydGVkS2V5cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgX2tleSA9IHNvcnRlZEtleXNbaV07XG4gICAgICBjYW5vbmljYWxpemVkT2JqW19rZXldID0gY2Fub25pY2FsaXplKG9ialtfa2V5XSwgc3RhY2ssIHJlcGxhY2VtZW50U3RhY2ssIHJlcGxhY2VyLCBfa2V5KTtcbiAgICB9XG5cbiAgICBzdGFjay5wb3AoKTtcbiAgICByZXBsYWNlbWVudFN0YWNrLnBvcCgpO1xuICB9IGVsc2Uge1xuICAgIGNhbm9uaWNhbGl6ZWRPYmogPSBvYmo7XG4gIH1cblxuICByZXR1cm4gY2Fub25pY2FsaXplZE9iajtcbn1cblxudmFyIGFycmF5RGlmZiA9IG5ldyBEaWZmKCk7XG5cbmFycmF5RGlmZi50b2tlbml6ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUuc2xpY2UoKTtcbn07XG5cbmFycmF5RGlmZi5qb2luID0gYXJyYXlEaWZmLnJlbW92ZUVtcHR5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbmZ1bmN0aW9uIGRpZmZBcnJheXMob2xkQXJyLCBuZXdBcnIsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBhcnJheURpZmYuZGlmZihvbGRBcnIsIG5ld0FyciwgY2FsbGJhY2spO1xufVxuXG5mdW5jdGlvbiBwYXJzZVBhdGNoKHVuaURpZmYpIHtcbiAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMSAmJiBhcmd1bWVudHNbMV0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1sxXSA6IHt9O1xuICB2YXIgZGlmZnN0ciA9IHVuaURpZmYuc3BsaXQoL1xcclxcbnxbXFxuXFx2XFxmXFxyXFx4ODVdLyksXG4gICAgICBkZWxpbWl0ZXJzID0gdW5pRGlmZi5tYXRjaCgvXFxyXFxufFtcXG5cXHZcXGZcXHJcXHg4NV0vZykgfHwgW10sXG4gICAgICBsaXN0ID0gW10sXG4gICAgICBpID0gMDtcblxuICBmdW5jdGlvbiBwYXJzZUluZGV4KCkge1xuICAgIHZhciBpbmRleCA9IHt9O1xuICAgIGxpc3QucHVzaChpbmRleCk7IC8vIFBhcnNlIGRpZmYgbWV0YWRhdGFcblxuICAgIHdoaWxlIChpIDwgZGlmZnN0ci5sZW5ndGgpIHtcbiAgICAgIHZhciBsaW5lID0gZGlmZnN0cltpXTsgLy8gRmlsZSBoZWFkZXIgZm91bmQsIGVuZCBwYXJzaW5nIGRpZmYgbWV0YWRhdGFcblxuICAgICAgaWYgKC9eKFxcLVxcLVxcLXxcXCtcXCtcXCt8QEApXFxzLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSAvLyBEaWZmIGluZGV4XG5cblxuICAgICAgdmFyIGhlYWRlciA9IC9eKD86SW5kZXg6fGRpZmYoPzogLXIgXFx3KykrKVxccysoLis/KVxccyokLy5leGVjKGxpbmUpO1xuXG4gICAgICBpZiAoaGVhZGVyKSB7XG4gICAgICAgIGluZGV4LmluZGV4ID0gaGVhZGVyWzFdO1xuICAgICAgfVxuXG4gICAgICBpKys7XG4gICAgfSAvLyBQYXJzZSBmaWxlIGhlYWRlcnMgaWYgdGhleSBhcmUgZGVmaW5lZC4gVW5pZmllZCBkaWZmIHJlcXVpcmVzIHRoZW0sIGJ1dFxuICAgIC8vIHRoZXJlJ3Mgbm8gdGVjaG5pY2FsIGlzc3VlcyB0byBoYXZlIGFuIGlzb2xhdGVkIGh1bmsgd2l0aG91dCBmaWxlIGhlYWRlclxuXG5cbiAgICBwYXJzZUZpbGVIZWFkZXIoaW5kZXgpO1xuICAgIHBhcnNlRmlsZUhlYWRlcihpbmRleCk7IC8vIFBhcnNlIGh1bmtzXG5cbiAgICBpbmRleC5odW5rcyA9IFtdO1xuXG4gICAgd2hpbGUgKGkgPCBkaWZmc3RyLmxlbmd0aCkge1xuICAgICAgdmFyIF9saW5lID0gZGlmZnN0cltpXTtcblxuICAgICAgaWYgKC9eKEluZGV4OnxkaWZmfFxcLVxcLVxcLXxcXCtcXCtcXCspXFxzLy50ZXN0KF9saW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSBpZiAoL15AQC8udGVzdChfbGluZSkpIHtcbiAgICAgICAgaW5kZXguaHVua3MucHVzaChwYXJzZUh1bmsoKSk7XG4gICAgICB9IGVsc2UgaWYgKF9saW5lICYmIG9wdGlvbnMuc3RyaWN0KSB7XG4gICAgICAgIC8vIElnbm9yZSB1bmV4cGVjdGVkIGNvbnRlbnQgdW5sZXNzIGluIHN0cmljdCBtb2RlXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBsaW5lICcgKyAoaSArIDEpICsgJyAnICsgSlNPTi5zdHJpbmdpZnkoX2xpbmUpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICB9XG4gIH0gLy8gUGFyc2VzIHRoZSAtLS0gYW5kICsrKyBoZWFkZXJzLCBpZiBub25lIGFyZSBmb3VuZCwgbm8gbGluZXNcbiAgLy8gYXJlIGNvbnN1bWVkLlxuXG5cbiAgZnVuY3Rpb24gcGFyc2VGaWxlSGVhZGVyKGluZGV4KSB7XG4gICAgdmFyIGZpbGVIZWFkZXIgPSAvXigtLS18XFwrXFwrXFwrKVxccysoLiopJC8uZXhlYyhkaWZmc3RyW2ldKTtcblxuICAgIGlmIChmaWxlSGVhZGVyKSB7XG4gICAgICB2YXIga2V5UHJlZml4ID0gZmlsZUhlYWRlclsxXSA9PT0gJy0tLScgPyAnb2xkJyA6ICduZXcnO1xuICAgICAgdmFyIGRhdGEgPSBmaWxlSGVhZGVyWzJdLnNwbGl0KCdcXHQnLCAyKTtcbiAgICAgIHZhciBmaWxlTmFtZSA9IGRhdGFbMF0ucmVwbGFjZSgvXFxcXFxcXFwvZywgJ1xcXFwnKTtcblxuICAgICAgaWYgKC9eXCIuKlwiJC8udGVzdChmaWxlTmFtZSkpIHtcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlTmFtZS5zdWJzdHIoMSwgZmlsZU5hbWUubGVuZ3RoIC0gMik7XG4gICAgICB9XG5cbiAgICAgIGluZGV4W2tleVByZWZpeCArICdGaWxlTmFtZSddID0gZmlsZU5hbWU7XG4gICAgICBpbmRleFtrZXlQcmVmaXggKyAnSGVhZGVyJ10gPSAoZGF0YVsxXSB8fCAnJykudHJpbSgpO1xuICAgICAgaSsrO1xuICAgIH1cbiAgfSAvLyBQYXJzZXMgYSBodW5rXG4gIC8vIFRoaXMgYXNzdW1lcyB0aGF0IHdlIGFyZSBhdCB0aGUgc3RhcnQgb2YgYSBodW5rLlxuXG5cbiAgZnVuY3Rpb24gcGFyc2VIdW5rKCkge1xuICAgIHZhciBjaHVua0hlYWRlckluZGV4ID0gaSxcbiAgICAgICAgY2h1bmtIZWFkZXJMaW5lID0gZGlmZnN0cltpKytdLFxuICAgICAgICBjaHVua0hlYWRlciA9IGNodW5rSGVhZGVyTGluZS5zcGxpdCgvQEAgLShcXGQrKSg/OiwoXFxkKykpPyBcXCsoXFxkKykoPzosKFxcZCspKT8gQEAvKTtcbiAgICB2YXIgaHVuayA9IHtcbiAgICAgIG9sZFN0YXJ0OiArY2h1bmtIZWFkZXJbMV0sXG4gICAgICBvbGRMaW5lczogdHlwZW9mIGNodW5rSGVhZGVyWzJdID09PSAndW5kZWZpbmVkJyA/IDEgOiArY2h1bmtIZWFkZXJbMl0sXG4gICAgICBuZXdTdGFydDogK2NodW5rSGVhZGVyWzNdLFxuICAgICAgbmV3TGluZXM6IHR5cGVvZiBjaHVua0hlYWRlcls0XSA9PT0gJ3VuZGVmaW5lZCcgPyAxIDogK2NodW5rSGVhZGVyWzRdLFxuICAgICAgbGluZXM6IFtdLFxuICAgICAgbGluZWRlbGltaXRlcnM6IFtdXG4gICAgfTsgLy8gVW5pZmllZCBEaWZmIEZvcm1hdCBxdWlyazogSWYgdGhlIGNodW5rIHNpemUgaXMgMCxcbiAgICAvLyB0aGUgZmlyc3QgbnVtYmVyIGlzIG9uZSBsb3dlciB0aGFuIG9uZSB3b3VsZCBleHBlY3QuXG4gICAgLy8gaHR0cHM6Ly93d3cuYXJ0aW1hLmNvbS93ZWJsb2dzL3ZpZXdwb3N0LmpzcD90aHJlYWQ9MTY0MjkzXG5cbiAgICBpZiAoaHVuay5vbGRMaW5lcyA9PT0gMCkge1xuICAgICAgaHVuay5vbGRTdGFydCArPSAxO1xuICAgIH1cblxuICAgIGlmIChodW5rLm5ld0xpbmVzID09PSAwKSB7XG4gICAgICBodW5rLm5ld1N0YXJ0ICs9IDE7XG4gICAgfVxuXG4gICAgdmFyIGFkZENvdW50ID0gMCxcbiAgICAgICAgcmVtb3ZlQ291bnQgPSAwO1xuXG4gICAgZm9yICg7IGkgPCBkaWZmc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBMaW5lcyBzdGFydGluZyB3aXRoICctLS0nIGNvdWxkIGJlIG1pc3Rha2VuIGZvciB0aGUgXCJyZW1vdmUgbGluZVwiIG9wZXJhdGlvblxuICAgICAgLy8gQnV0IHRoZXkgY291bGQgYmUgdGhlIGhlYWRlciBmb3IgdGhlIG5leHQgZmlsZS4gVGhlcmVmb3JlIHBydW5lIHN1Y2ggY2FzZXMgb3V0LlxuICAgICAgaWYgKGRpZmZzdHJbaV0uaW5kZXhPZignLS0tICcpID09PSAwICYmIGkgKyAyIDwgZGlmZnN0ci5sZW5ndGggJiYgZGlmZnN0cltpICsgMV0uaW5kZXhPZignKysrICcpID09PSAwICYmIGRpZmZzdHJbaSArIDJdLmluZGV4T2YoJ0BAJykgPT09IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHZhciBvcGVyYXRpb24gPSBkaWZmc3RyW2ldLmxlbmd0aCA9PSAwICYmIGkgIT0gZGlmZnN0ci5sZW5ndGggLSAxID8gJyAnIDogZGlmZnN0cltpXVswXTtcblxuICAgICAgaWYgKG9wZXJhdGlvbiA9PT0gJysnIHx8IG9wZXJhdGlvbiA9PT0gJy0nIHx8IG9wZXJhdGlvbiA9PT0gJyAnIHx8IG9wZXJhdGlvbiA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGh1bmsubGluZXMucHVzaChkaWZmc3RyW2ldKTtcbiAgICAgICAgaHVuay5saW5lZGVsaW1pdGVycy5wdXNoKGRlbGltaXRlcnNbaV0gfHwgJ1xcbicpO1xuXG4gICAgICAgIGlmIChvcGVyYXRpb24gPT09ICcrJykge1xuICAgICAgICAgIGFkZENvdW50Kys7XG4gICAgICAgIH0gZWxzZSBpZiAob3BlcmF0aW9uID09PSAnLScpIHtcbiAgICAgICAgICByZW1vdmVDb3VudCsrO1xuICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdGlvbiA9PT0gJyAnKSB7XG4gICAgICAgICAgYWRkQ291bnQrKztcbiAgICAgICAgICByZW1vdmVDb3VudCsrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IC8vIEhhbmRsZSB0aGUgZW1wdHkgYmxvY2sgY291bnQgY2FzZVxuXG5cbiAgICBpZiAoIWFkZENvdW50ICYmIGh1bmsubmV3TGluZXMgPT09IDEpIHtcbiAgICAgIGh1bmsubmV3TGluZXMgPSAwO1xuICAgIH1cblxuICAgIGlmICghcmVtb3ZlQ291bnQgJiYgaHVuay5vbGRMaW5lcyA9PT0gMSkge1xuICAgICAgaHVuay5vbGRMaW5lcyA9IDA7XG4gICAgfSAvLyBQZXJmb3JtIG9wdGlvbmFsIHNhbml0eSBjaGVja2luZ1xuXG5cbiAgICBpZiAob3B0aW9ucy5zdHJpY3QpIHtcbiAgICAgIGlmIChhZGRDb3VudCAhPT0gaHVuay5uZXdMaW5lcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FkZGVkIGxpbmUgY291bnQgZGlkIG5vdCBtYXRjaCBmb3IgaHVuayBhdCBsaW5lICcgKyAoY2h1bmtIZWFkZXJJbmRleCArIDEpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlbW92ZUNvdW50ICE9PSBodW5rLm9sZExpbmVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVtb3ZlZCBsaW5lIGNvdW50IGRpZCBub3QgbWF0Y2ggZm9yIGh1bmsgYXQgbGluZSAnICsgKGNodW5rSGVhZGVySW5kZXggKyAxKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGh1bms7XG4gIH1cblxuICB3aGlsZSAoaSA8IGRpZmZzdHIubGVuZ3RoKSB7XG4gICAgcGFyc2VJbmRleCgpO1xuICB9XG5cbiAgcmV0dXJuIGxpc3Q7XG59XG5cbi8vIEl0ZXJhdG9yIHRoYXQgdHJhdmVyc2VzIGluIHRoZSByYW5nZSBvZiBbbWluLCBtYXhdLCBzdGVwcGluZ1xuLy8gYnkgZGlzdGFuY2UgZnJvbSBhIGdpdmVuIHN0YXJ0IHBvc2l0aW9uLiBJLmUuIGZvciBbMCwgNF0sIHdpdGhcbi8vIHN0YXJ0IG9mIDIsIHRoaXMgd2lsbCBpdGVyYXRlIDIsIDMsIDEsIDQsIDAuXG5mdW5jdGlvbiBkaXN0YW5jZUl0ZXJhdG9yIChzdGFydCwgbWluTGluZSwgbWF4TGluZSkge1xuICB2YXIgd2FudEZvcndhcmQgPSB0cnVlLFxuICAgICAgYmFja3dhcmRFeGhhdXN0ZWQgPSBmYWxzZSxcbiAgICAgIGZvcndhcmRFeGhhdXN0ZWQgPSBmYWxzZSxcbiAgICAgIGxvY2FsT2Zmc2V0ID0gMTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGl0ZXJhdG9yKCkge1xuICAgIGlmICh3YW50Rm9yd2FyZCAmJiAhZm9yd2FyZEV4aGF1c3RlZCkge1xuICAgICAgaWYgKGJhY2t3YXJkRXhoYXVzdGVkKSB7XG4gICAgICAgIGxvY2FsT2Zmc2V0Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3YW50Rm9yd2FyZCA9IGZhbHNlO1xuICAgICAgfSAvLyBDaGVjayBpZiB0cnlpbmcgdG8gZml0IGJleW9uZCB0ZXh0IGxlbmd0aCwgYW5kIGlmIG5vdCwgY2hlY2sgaXQgZml0c1xuICAgICAgLy8gYWZ0ZXIgb2Zmc2V0IGxvY2F0aW9uIChvciBkZXNpcmVkIGxvY2F0aW9uIG9uIGZpcnN0IGl0ZXJhdGlvbilcblxuXG4gICAgICBpZiAoc3RhcnQgKyBsb2NhbE9mZnNldCA8PSBtYXhMaW5lKSB7XG4gICAgICAgIHJldHVybiBsb2NhbE9mZnNldDtcbiAgICAgIH1cblxuICAgICAgZm9yd2FyZEV4aGF1c3RlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCFiYWNrd2FyZEV4aGF1c3RlZCkge1xuICAgICAgaWYgKCFmb3J3YXJkRXhoYXVzdGVkKSB7XG4gICAgICAgIHdhbnRGb3J3YXJkID0gdHJ1ZTtcbiAgICAgIH0gLy8gQ2hlY2sgaWYgdHJ5aW5nIHRvIGZpdCBiZWZvcmUgdGV4dCBiZWdpbm5pbmcsIGFuZCBpZiBub3QsIGNoZWNrIGl0IGZpdHNcbiAgICAgIC8vIGJlZm9yZSBvZmZzZXQgbG9jYXRpb25cblxuXG4gICAgICBpZiAobWluTGluZSA8PSBzdGFydCAtIGxvY2FsT2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiAtbG9jYWxPZmZzZXQrKztcbiAgICAgIH1cblxuICAgICAgYmFja3dhcmRFeGhhdXN0ZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIGl0ZXJhdG9yKCk7XG4gICAgfSAvLyBXZSB0cmllZCB0byBmaXQgaHVuayBiZWZvcmUgdGV4dCBiZWdpbm5pbmcgYW5kIGJleW9uZCB0ZXh0IGxlbmd0aCwgdGhlblxuICAgIC8vIGh1bmsgY2FuJ3QgZml0IG9uIHRoZSB0ZXh0LiBSZXR1cm4gdW5kZWZpbmVkXG5cbiAgfTtcbn1cblxuZnVuY3Rpb24gYXBwbHlQYXRjaChzb3VyY2UsIHVuaURpZmYpIHtcbiAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gIGlmICh0eXBlb2YgdW5pRGlmZiA9PT0gJ3N0cmluZycpIHtcbiAgICB1bmlEaWZmID0gcGFyc2VQYXRjaCh1bmlEaWZmKTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHVuaURpZmYpKSB7XG4gICAgaWYgKHVuaURpZmYubGVuZ3RoID4gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcHBseVBhdGNoIG9ubHkgd29ya3Mgd2l0aCBhIHNpbmdsZSBpbnB1dC4nKTtcbiAgICB9XG5cbiAgICB1bmlEaWZmID0gdW5pRGlmZlswXTtcbiAgfSAvLyBBcHBseSB0aGUgZGlmZiB0byB0aGUgaW5wdXRcblxuXG4gIHZhciBsaW5lcyA9IHNvdXJjZS5zcGxpdCgvXFxyXFxufFtcXG5cXHZcXGZcXHJcXHg4NV0vKSxcbiAgICAgIGRlbGltaXRlcnMgPSBzb3VyY2UubWF0Y2goL1xcclxcbnxbXFxuXFx2XFxmXFxyXFx4ODVdL2cpIHx8IFtdLFxuICAgICAgaHVua3MgPSB1bmlEaWZmLmh1bmtzLFxuICAgICAgY29tcGFyZUxpbmUgPSBvcHRpb25zLmNvbXBhcmVMaW5lIHx8IGZ1bmN0aW9uIChsaW5lTnVtYmVyLCBsaW5lLCBvcGVyYXRpb24sIHBhdGNoQ29udGVudCkge1xuICAgIHJldHVybiBsaW5lID09PSBwYXRjaENvbnRlbnQ7XG4gIH0sXG4gICAgICBlcnJvckNvdW50ID0gMCxcbiAgICAgIGZ1enpGYWN0b3IgPSBvcHRpb25zLmZ1enpGYWN0b3IgfHwgMCxcbiAgICAgIG1pbkxpbmUgPSAwLFxuICAgICAgb2Zmc2V0ID0gMCxcbiAgICAgIHJlbW92ZUVPRk5MLFxuICAgICAgYWRkRU9GTkw7XG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIGh1bmsgZXhhY3RseSBmaXRzIG9uIHRoZSBwcm92aWRlZCBsb2NhdGlvblxuICAgKi9cblxuXG4gIGZ1bmN0aW9uIGh1bmtGaXRzKGh1bmssIHRvUG9zKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBodW5rLmxpbmVzLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgbGluZSA9IGh1bmsubGluZXNbal0sXG4gICAgICAgICAgb3BlcmF0aW9uID0gbGluZS5sZW5ndGggPiAwID8gbGluZVswXSA6ICcgJyxcbiAgICAgICAgICBjb250ZW50ID0gbGluZS5sZW5ndGggPiAwID8gbGluZS5zdWJzdHIoMSkgOiBsaW5lO1xuXG4gICAgICBpZiAob3BlcmF0aW9uID09PSAnICcgfHwgb3BlcmF0aW9uID09PSAnLScpIHtcbiAgICAgICAgLy8gQ29udGV4dCBzYW5pdHkgY2hlY2tcbiAgICAgICAgaWYgKCFjb21wYXJlTGluZSh0b1BvcyArIDEsIGxpbmVzW3RvUG9zXSwgb3BlcmF0aW9uLCBjb250ZW50KSkge1xuICAgICAgICAgIGVycm9yQ291bnQrKztcblxuICAgICAgICAgIGlmIChlcnJvckNvdW50ID4gZnV6ekZhY3Rvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRvUG9zKys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH0gLy8gU2VhcmNoIGJlc3QgZml0IG9mZnNldHMgZm9yIGVhY2ggaHVuayBiYXNlZCBvbiB0aGUgcHJldmlvdXMgb25lc1xuXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBodW5rcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBodW5rID0gaHVua3NbaV0sXG4gICAgICAgIG1heExpbmUgPSBsaW5lcy5sZW5ndGggLSBodW5rLm9sZExpbmVzLFxuICAgICAgICBsb2NhbE9mZnNldCA9IDAsXG4gICAgICAgIHRvUG9zID0gb2Zmc2V0ICsgaHVuay5vbGRTdGFydCAtIDE7XG4gICAgdmFyIGl0ZXJhdG9yID0gZGlzdGFuY2VJdGVyYXRvcih0b1BvcywgbWluTGluZSwgbWF4TGluZSk7XG5cbiAgICBmb3IgKDsgbG9jYWxPZmZzZXQgIT09IHVuZGVmaW5lZDsgbG9jYWxPZmZzZXQgPSBpdGVyYXRvcigpKSB7XG4gICAgICBpZiAoaHVua0ZpdHMoaHVuaywgdG9Qb3MgKyBsb2NhbE9mZnNldCkpIHtcbiAgICAgICAgaHVuay5vZmZzZXQgPSBvZmZzZXQgKz0gbG9jYWxPZmZzZXQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsb2NhbE9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSAvLyBTZXQgbG93ZXIgdGV4dCBsaW1pdCB0byBlbmQgb2YgdGhlIGN1cnJlbnQgaHVuaywgc28gbmV4dCBvbmVzIGRvbid0IHRyeVxuICAgIC8vIHRvIGZpdCBvdmVyIGFscmVhZHkgcGF0Y2hlZCB0ZXh0XG5cblxuICAgIG1pbkxpbmUgPSBodW5rLm9mZnNldCArIGh1bmsub2xkU3RhcnQgKyBodW5rLm9sZExpbmVzO1xuICB9IC8vIEFwcGx5IHBhdGNoIGh1bmtzXG5cblxuICB2YXIgZGlmZk9mZnNldCA9IDA7XG5cbiAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGh1bmtzLmxlbmd0aDsgX2krKykge1xuICAgIHZhciBfaHVuayA9IGh1bmtzW19pXSxcbiAgICAgICAgX3RvUG9zID0gX2h1bmsub2xkU3RhcnQgKyBfaHVuay5vZmZzZXQgKyBkaWZmT2Zmc2V0IC0gMTtcblxuICAgIGRpZmZPZmZzZXQgKz0gX2h1bmsubmV3TGluZXMgLSBfaHVuay5vbGRMaW5lcztcblxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgX2h1bmsubGluZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBsaW5lID0gX2h1bmsubGluZXNbal0sXG4gICAgICAgICAgb3BlcmF0aW9uID0gbGluZS5sZW5ndGggPiAwID8gbGluZVswXSA6ICcgJyxcbiAgICAgICAgICBjb250ZW50ID0gbGluZS5sZW5ndGggPiAwID8gbGluZS5zdWJzdHIoMSkgOiBsaW5lLFxuICAgICAgICAgIGRlbGltaXRlciA9IF9odW5rLmxpbmVkZWxpbWl0ZXJzW2pdO1xuXG4gICAgICBpZiAob3BlcmF0aW9uID09PSAnICcpIHtcbiAgICAgICAgX3RvUG9zKys7XG4gICAgICB9IGVsc2UgaWYgKG9wZXJhdGlvbiA9PT0gJy0nKSB7XG4gICAgICAgIGxpbmVzLnNwbGljZShfdG9Qb3MsIDEpO1xuICAgICAgICBkZWxpbWl0ZXJzLnNwbGljZShfdG9Qb3MsIDEpO1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgfSBlbHNlIGlmIChvcGVyYXRpb24gPT09ICcrJykge1xuICAgICAgICBsaW5lcy5zcGxpY2UoX3RvUG9zLCAwLCBjb250ZW50KTtcbiAgICAgICAgZGVsaW1pdGVycy5zcGxpY2UoX3RvUG9zLCAwLCBkZWxpbWl0ZXIpO1xuICAgICAgICBfdG9Qb3MrKztcbiAgICAgIH0gZWxzZSBpZiAob3BlcmF0aW9uID09PSAnXFxcXCcpIHtcbiAgICAgICAgdmFyIHByZXZpb3VzT3BlcmF0aW9uID0gX2h1bmsubGluZXNbaiAtIDFdID8gX2h1bmsubGluZXNbaiAtIDFdWzBdIDogbnVsbDtcblxuICAgICAgICBpZiAocHJldmlvdXNPcGVyYXRpb24gPT09ICcrJykge1xuICAgICAgICAgIHJlbW92ZUVPRk5MID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChwcmV2aW91c09wZXJhdGlvbiA9PT0gJy0nKSB7XG4gICAgICAgICAgYWRkRU9GTkwgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IC8vIEhhbmRsZSBFT0ZOTCBpbnNlcnRpb24vcmVtb3ZhbFxuXG5cbiAgaWYgKHJlbW92ZUVPRk5MKSB7XG4gICAgd2hpbGUgKCFsaW5lc1tsaW5lcy5sZW5ndGggLSAxXSkge1xuICAgICAgbGluZXMucG9wKCk7XG4gICAgICBkZWxpbWl0ZXJzLnBvcCgpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhZGRFT0ZOTCkge1xuICAgIGxpbmVzLnB1c2goJycpO1xuICAgIGRlbGltaXRlcnMucHVzaCgnXFxuJyk7XG4gIH1cblxuICBmb3IgKHZhciBfayA9IDA7IF9rIDwgbGluZXMubGVuZ3RoIC0gMTsgX2srKykge1xuICAgIGxpbmVzW19rXSA9IGxpbmVzW19rXSArIGRlbGltaXRlcnNbX2tdO1xuICB9XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oJycpO1xufSAvLyBXcmFwcGVyIHRoYXQgc3VwcG9ydHMgbXVsdGlwbGUgZmlsZSBwYXRjaGVzIHZpYSBjYWxsYmFja3MuXG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2hlcyh1bmlEaWZmLCBvcHRpb25zKSB7XG4gIGlmICh0eXBlb2YgdW5pRGlmZiA9PT0gJ3N0cmluZycpIHtcbiAgICB1bmlEaWZmID0gcGFyc2VQYXRjaCh1bmlEaWZmKTtcbiAgfVxuXG4gIHZhciBjdXJyZW50SW5kZXggPSAwO1xuXG4gIGZ1bmN0aW9uIHByb2Nlc3NJbmRleCgpIHtcbiAgICB2YXIgaW5kZXggPSB1bmlEaWZmW2N1cnJlbnRJbmRleCsrXTtcblxuICAgIGlmICghaW5kZXgpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmNvbXBsZXRlKCk7XG4gICAgfVxuXG4gICAgb3B0aW9ucy5sb2FkRmlsZShpbmRleCwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5jb21wbGV0ZShlcnIpO1xuICAgICAgfVxuXG4gICAgICB2YXIgdXBkYXRlZENvbnRlbnQgPSBhcHBseVBhdGNoKGRhdGEsIGluZGV4LCBvcHRpb25zKTtcbiAgICAgIG9wdGlvbnMucGF0Y2hlZChpbmRleCwgdXBkYXRlZENvbnRlbnQsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBvcHRpb25zLmNvbXBsZXRlKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzSW5kZXgoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJvY2Vzc0luZGV4KCk7XG59XG5cbmZ1bmN0aW9uIHN0cnVjdHVyZWRQYXRjaChvbGRGaWxlTmFtZSwgbmV3RmlsZU5hbWUsIG9sZFN0ciwgbmV3U3RyLCBvbGRIZWFkZXIsIG5ld0hlYWRlciwgb3B0aW9ucykge1xuICBpZiAoIW9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cblxuICBpZiAodHlwZW9mIG9wdGlvbnMuY29udGV4dCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBvcHRpb25zLmNvbnRleHQgPSA0O1xuICB9XG5cbiAgdmFyIGRpZmYgPSBkaWZmTGluZXMob2xkU3RyLCBuZXdTdHIsIG9wdGlvbnMpO1xuICBkaWZmLnB1c2goe1xuICAgIHZhbHVlOiAnJyxcbiAgICBsaW5lczogW11cbiAgfSk7IC8vIEFwcGVuZCBhbiBlbXB0eSB2YWx1ZSB0byBtYWtlIGNsZWFudXAgZWFzaWVyXG5cbiAgZnVuY3Rpb24gY29udGV4dExpbmVzKGxpbmVzKSB7XG4gICAgcmV0dXJuIGxpbmVzLm1hcChmdW5jdGlvbiAoZW50cnkpIHtcbiAgICAgIHJldHVybiAnICcgKyBlbnRyeTtcbiAgICB9KTtcbiAgfVxuXG4gIHZhciBodW5rcyA9IFtdO1xuICB2YXIgb2xkUmFuZ2VTdGFydCA9IDAsXG4gICAgICBuZXdSYW5nZVN0YXJ0ID0gMCxcbiAgICAgIGN1clJhbmdlID0gW10sXG4gICAgICBvbGRMaW5lID0gMSxcbiAgICAgIG5ld0xpbmUgPSAxO1xuXG4gIHZhciBfbG9vcCA9IGZ1bmN0aW9uIF9sb29wKGkpIHtcbiAgICB2YXIgY3VycmVudCA9IGRpZmZbaV0sXG4gICAgICAgIGxpbmVzID0gY3VycmVudC5saW5lcyB8fCBjdXJyZW50LnZhbHVlLnJlcGxhY2UoL1xcbiQvLCAnJykuc3BsaXQoJ1xcbicpO1xuICAgIGN1cnJlbnQubGluZXMgPSBsaW5lcztcblxuICAgIGlmIChjdXJyZW50LmFkZGVkIHx8IGN1cnJlbnQucmVtb3ZlZCkge1xuICAgICAgdmFyIF9jdXJSYW5nZTtcblxuICAgICAgLy8gSWYgd2UgaGF2ZSBwcmV2aW91cyBjb250ZXh0LCBzdGFydCB3aXRoIHRoYXRcbiAgICAgIGlmICghb2xkUmFuZ2VTdGFydCkge1xuICAgICAgICB2YXIgcHJldiA9IGRpZmZbaSAtIDFdO1xuICAgICAgICBvbGRSYW5nZVN0YXJ0ID0gb2xkTGluZTtcbiAgICAgICAgbmV3UmFuZ2VTdGFydCA9IG5ld0xpbmU7XG5cbiAgICAgICAgaWYgKHByZXYpIHtcbiAgICAgICAgICBjdXJSYW5nZSA9IG9wdGlvbnMuY29udGV4dCA+IDAgPyBjb250ZXh0TGluZXMocHJldi5saW5lcy5zbGljZSgtb3B0aW9ucy5jb250ZXh0KSkgOiBbXTtcbiAgICAgICAgICBvbGRSYW5nZVN0YXJ0IC09IGN1clJhbmdlLmxlbmd0aDtcbiAgICAgICAgICBuZXdSYW5nZVN0YXJ0IC09IGN1clJhbmdlLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfSAvLyBPdXRwdXQgb3VyIGNoYW5nZXNcblxuXG4gICAgICAoX2N1clJhbmdlID0gY3VyUmFuZ2UpLnB1c2guYXBwbHkoX2N1clJhbmdlLCBfdG9Db25zdW1hYmxlQXJyYXkobGluZXMubWFwKGZ1bmN0aW9uIChlbnRyeSkge1xuICAgICAgICByZXR1cm4gKGN1cnJlbnQuYWRkZWQgPyAnKycgOiAnLScpICsgZW50cnk7XG4gICAgICB9KSkpOyAvLyBUcmFjayB0aGUgdXBkYXRlZCBmaWxlIHBvc2l0aW9uXG5cblxuICAgICAgaWYgKGN1cnJlbnQuYWRkZWQpIHtcbiAgICAgICAgbmV3TGluZSArPSBsaW5lcy5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRMaW5lICs9IGxpbmVzLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWRlbnRpY2FsIGNvbnRleHQgbGluZXMuIFRyYWNrIGxpbmUgY2hhbmdlc1xuICAgICAgaWYgKG9sZFJhbmdlU3RhcnQpIHtcbiAgICAgICAgLy8gQ2xvc2Ugb3V0IGFueSBjaGFuZ2VzIHRoYXQgaGF2ZSBiZWVuIG91dHB1dCAob3Igam9pbiBvdmVybGFwcGluZylcbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA8PSBvcHRpb25zLmNvbnRleHQgKiAyICYmIGkgPCBkaWZmLmxlbmd0aCAtIDIpIHtcbiAgICAgICAgICB2YXIgX2N1clJhbmdlMjtcblxuICAgICAgICAgIC8vIE92ZXJsYXBwaW5nXG4gICAgICAgICAgKF9jdXJSYW5nZTIgPSBjdXJSYW5nZSkucHVzaC5hcHBseShfY3VyUmFuZ2UyLCBfdG9Db25zdW1hYmxlQXJyYXkoY29udGV4dExpbmVzKGxpbmVzKSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBfY3VyUmFuZ2UzO1xuXG4gICAgICAgICAgLy8gZW5kIHRoZSByYW5nZSBhbmQgb3V0cHV0XG4gICAgICAgICAgdmFyIGNvbnRleHRTaXplID0gTWF0aC5taW4obGluZXMubGVuZ3RoLCBvcHRpb25zLmNvbnRleHQpO1xuXG4gICAgICAgICAgKF9jdXJSYW5nZTMgPSBjdXJSYW5nZSkucHVzaC5hcHBseShfY3VyUmFuZ2UzLCBfdG9Db25zdW1hYmxlQXJyYXkoY29udGV4dExpbmVzKGxpbmVzLnNsaWNlKDAsIGNvbnRleHRTaXplKSkpKTtcblxuICAgICAgICAgIHZhciBodW5rID0ge1xuICAgICAgICAgICAgb2xkU3RhcnQ6IG9sZFJhbmdlU3RhcnQsXG4gICAgICAgICAgICBvbGRMaW5lczogb2xkTGluZSAtIG9sZFJhbmdlU3RhcnQgKyBjb250ZXh0U2l6ZSxcbiAgICAgICAgICAgIG5ld1N0YXJ0OiBuZXdSYW5nZVN0YXJ0LFxuICAgICAgICAgICAgbmV3TGluZXM6IG5ld0xpbmUgLSBuZXdSYW5nZVN0YXJ0ICsgY29udGV4dFNpemUsXG4gICAgICAgICAgICBsaW5lczogY3VyUmFuZ2VcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKGkgPj0gZGlmZi5sZW5ndGggLSAyICYmIGxpbmVzLmxlbmd0aCA8PSBvcHRpb25zLmNvbnRleHQpIHtcbiAgICAgICAgICAgIC8vIEVPRiBpcyBpbnNpZGUgdGhpcyBodW5rXG4gICAgICAgICAgICB2YXIgb2xkRU9GTmV3bGluZSA9IC9cXG4kLy50ZXN0KG9sZFN0cik7XG4gICAgICAgICAgICB2YXIgbmV3RU9GTmV3bGluZSA9IC9cXG4kLy50ZXN0KG5ld1N0cik7XG4gICAgICAgICAgICB2YXIgbm9ObEJlZm9yZUFkZHMgPSBsaW5lcy5sZW5ndGggPT0gMCAmJiBjdXJSYW5nZS5sZW5ndGggPiBodW5rLm9sZExpbmVzO1xuXG4gICAgICAgICAgICBpZiAoIW9sZEVPRk5ld2xpbmUgJiYgbm9ObEJlZm9yZUFkZHMgJiYgb2xkU3RyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgLy8gc3BlY2lhbCBjYXNlOiBvbGQgaGFzIG5vIGVvbCBhbmQgbm8gdHJhaWxpbmcgY29udGV4dDsgbm8tbmwgY2FuIGVuZCB1cCBiZWZvcmUgYWRkc1xuICAgICAgICAgICAgICAvLyBob3dldmVyLCBpZiB0aGUgb2xkIGZpbGUgaXMgZW1wdHksIGRvIG5vdCBvdXRwdXQgdGhlIG5vLW5sIGxpbmVcbiAgICAgICAgICAgICAgY3VyUmFuZ2Uuc3BsaWNlKGh1bmsub2xkTGluZXMsIDAsICdcXFxcIE5vIG5ld2xpbmUgYXQgZW5kIG9mIGZpbGUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFvbGRFT0ZOZXdsaW5lICYmICFub05sQmVmb3JlQWRkcyB8fCAhbmV3RU9GTmV3bGluZSkge1xuICAgICAgICAgICAgICBjdXJSYW5nZS5wdXNoKCdcXFxcIE5vIG5ld2xpbmUgYXQgZW5kIG9mIGZpbGUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBodW5rcy5wdXNoKGh1bmspO1xuICAgICAgICAgIG9sZFJhbmdlU3RhcnQgPSAwO1xuICAgICAgICAgIG5ld1JhbmdlU3RhcnQgPSAwO1xuICAgICAgICAgIGN1clJhbmdlID0gW107XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgb2xkTGluZSArPSBsaW5lcy5sZW5ndGg7XG4gICAgICBuZXdMaW5lICs9IGxpbmVzLmxlbmd0aDtcbiAgICB9XG4gIH07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaWZmLmxlbmd0aDsgaSsrKSB7XG4gICAgX2xvb3AoaSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG9sZEZpbGVOYW1lOiBvbGRGaWxlTmFtZSxcbiAgICBuZXdGaWxlTmFtZTogbmV3RmlsZU5hbWUsXG4gICAgb2xkSGVhZGVyOiBvbGRIZWFkZXIsXG4gICAgbmV3SGVhZGVyOiBuZXdIZWFkZXIsXG4gICAgaHVua3M6IGh1bmtzXG4gIH07XG59XG5mdW5jdGlvbiBmb3JtYXRQYXRjaChkaWZmKSB7XG4gIHZhciByZXQgPSBbXTtcblxuICBpZiAoZGlmZi5vbGRGaWxlTmFtZSA9PSBkaWZmLm5ld0ZpbGVOYW1lKSB7XG4gICAgcmV0LnB1c2goJ0luZGV4OiAnICsgZGlmZi5vbGRGaWxlTmFtZSk7XG4gIH1cblxuICByZXQucHVzaCgnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICByZXQucHVzaCgnLS0tICcgKyBkaWZmLm9sZEZpbGVOYW1lICsgKHR5cGVvZiBkaWZmLm9sZEhlYWRlciA9PT0gJ3VuZGVmaW5lZCcgPyAnJyA6ICdcXHQnICsgZGlmZi5vbGRIZWFkZXIpKTtcbiAgcmV0LnB1c2goJysrKyAnICsgZGlmZi5uZXdGaWxlTmFtZSArICh0eXBlb2YgZGlmZi5uZXdIZWFkZXIgPT09ICd1bmRlZmluZWQnID8gJycgOiAnXFx0JyArIGRpZmYubmV3SGVhZGVyKSk7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaWZmLmh1bmtzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGh1bmsgPSBkaWZmLmh1bmtzW2ldOyAvLyBVbmlmaWVkIERpZmYgRm9ybWF0IHF1aXJrOiBJZiB0aGUgY2h1bmsgc2l6ZSBpcyAwLFxuICAgIC8vIHRoZSBmaXJzdCBudW1iZXIgaXMgb25lIGxvd2VyIHRoYW4gb25lIHdvdWxkIGV4cGVjdC5cbiAgICAvLyBodHRwczovL3d3dy5hcnRpbWEuY29tL3dlYmxvZ3Mvdmlld3Bvc3QuanNwP3RocmVhZD0xNjQyOTNcblxuICAgIGlmIChodW5rLm9sZExpbmVzID09PSAwKSB7XG4gICAgICBodW5rLm9sZFN0YXJ0IC09IDE7XG4gICAgfVxuXG4gICAgaWYgKGh1bmsubmV3TGluZXMgPT09IDApIHtcbiAgICAgIGh1bmsubmV3U3RhcnQgLT0gMTtcbiAgICB9XG5cbiAgICByZXQucHVzaCgnQEAgLScgKyBodW5rLm9sZFN0YXJ0ICsgJywnICsgaHVuay5vbGRMaW5lcyArICcgKycgKyBodW5rLm5ld1N0YXJ0ICsgJywnICsgaHVuay5uZXdMaW5lcyArICcgQEAnKTtcbiAgICByZXQucHVzaC5hcHBseShyZXQsIGh1bmsubGluZXMpO1xuICB9XG5cbiAgcmV0dXJuIHJldC5qb2luKCdcXG4nKSArICdcXG4nO1xufVxuZnVuY3Rpb24gY3JlYXRlVHdvRmlsZXNQYXRjaChvbGRGaWxlTmFtZSwgbmV3RmlsZU5hbWUsIG9sZFN0ciwgbmV3U3RyLCBvbGRIZWFkZXIsIG5ld0hlYWRlciwgb3B0aW9ucykge1xuICByZXR1cm4gZm9ybWF0UGF0Y2goc3RydWN0dXJlZFBhdGNoKG9sZEZpbGVOYW1lLCBuZXdGaWxlTmFtZSwgb2xkU3RyLCBuZXdTdHIsIG9sZEhlYWRlciwgbmV3SGVhZGVyLCBvcHRpb25zKSk7XG59XG5mdW5jdGlvbiBjcmVhdGVQYXRjaChmaWxlTmFtZSwgb2xkU3RyLCBuZXdTdHIsIG9sZEhlYWRlciwgbmV3SGVhZGVyLCBvcHRpb25zKSB7XG4gIHJldHVybiBjcmVhdGVUd29GaWxlc1BhdGNoKGZpbGVOYW1lLCBmaWxlTmFtZSwgb2xkU3RyLCBuZXdTdHIsIG9sZEhlYWRlciwgbmV3SGVhZGVyLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gYXJyYXlFcXVhbChhLCBiKSB7XG4gIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYXJyYXlTdGFydHNXaXRoKGEsIGIpO1xufVxuZnVuY3Rpb24gYXJyYXlTdGFydHNXaXRoKGFycmF5LCBzdGFydCkge1xuICBpZiAoc3RhcnQubGVuZ3RoID4gYXJyYXkubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdGFydC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzdGFydFtpXSAhPT0gYXJyYXlbaV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gY2FsY0xpbmVDb3VudChodW5rKSB7XG4gIHZhciBfY2FsY09sZE5ld0xpbmVDb3VudCA9IGNhbGNPbGROZXdMaW5lQ291bnQoaHVuay5saW5lcyksXG4gICAgICBvbGRMaW5lcyA9IF9jYWxjT2xkTmV3TGluZUNvdW50Lm9sZExpbmVzLFxuICAgICAgbmV3TGluZXMgPSBfY2FsY09sZE5ld0xpbmVDb3VudC5uZXdMaW5lcztcblxuICBpZiAob2xkTGluZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGh1bmsub2xkTGluZXMgPSBvbGRMaW5lcztcbiAgfSBlbHNlIHtcbiAgICBkZWxldGUgaHVuay5vbGRMaW5lcztcbiAgfVxuXG4gIGlmIChuZXdMaW5lcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaHVuay5uZXdMaW5lcyA9IG5ld0xpbmVzO1xuICB9IGVsc2Uge1xuICAgIGRlbGV0ZSBodW5rLm5ld0xpbmVzO1xuICB9XG59XG5mdW5jdGlvbiBtZXJnZShtaW5lLCB0aGVpcnMsIGJhc2UpIHtcbiAgbWluZSA9IGxvYWRQYXRjaChtaW5lLCBiYXNlKTtcbiAgdGhlaXJzID0gbG9hZFBhdGNoKHRoZWlycywgYmFzZSk7XG4gIHZhciByZXQgPSB7fTsgLy8gRm9yIGluZGV4IHdlIGp1c3QgbGV0IGl0IHBhc3MgdGhyb3VnaCBhcyBpdCBkb2Vzbid0IGhhdmUgYW55IG5lY2Vzc2FyeSBtZWFuaW5nLlxuICAvLyBMZWF2aW5nIHNhbml0eSBjaGVja3Mgb24gdGhpcyB0byB0aGUgQVBJIGNvbnN1bWVyIHRoYXQgbWF5IGtub3cgbW9yZSBhYm91dCB0aGVcbiAgLy8gbWVhbmluZyBpbiB0aGVpciBvd24gY29udGV4dC5cblxuICBpZiAobWluZS5pbmRleCB8fCB0aGVpcnMuaW5kZXgpIHtcbiAgICByZXQuaW5kZXggPSBtaW5lLmluZGV4IHx8IHRoZWlycy5pbmRleDtcbiAgfVxuXG4gIGlmIChtaW5lLm5ld0ZpbGVOYW1lIHx8IHRoZWlycy5uZXdGaWxlTmFtZSkge1xuICAgIGlmICghZmlsZU5hbWVDaGFuZ2VkKG1pbmUpKSB7XG4gICAgICAvLyBObyBoZWFkZXIgb3Igbm8gY2hhbmdlIGluIG91cnMsIHVzZSB0aGVpcnMgKGFuZCBvdXJzIGlmIHRoZWlycyBkb2VzIG5vdCBleGlzdClcbiAgICAgIHJldC5vbGRGaWxlTmFtZSA9IHRoZWlycy5vbGRGaWxlTmFtZSB8fCBtaW5lLm9sZEZpbGVOYW1lO1xuICAgICAgcmV0Lm5ld0ZpbGVOYW1lID0gdGhlaXJzLm5ld0ZpbGVOYW1lIHx8IG1pbmUubmV3RmlsZU5hbWU7XG4gICAgICByZXQub2xkSGVhZGVyID0gdGhlaXJzLm9sZEhlYWRlciB8fCBtaW5lLm9sZEhlYWRlcjtcbiAgICAgIHJldC5uZXdIZWFkZXIgPSB0aGVpcnMubmV3SGVhZGVyIHx8IG1pbmUubmV3SGVhZGVyO1xuICAgIH0gZWxzZSBpZiAoIWZpbGVOYW1lQ2hhbmdlZCh0aGVpcnMpKSB7XG4gICAgICAvLyBObyBoZWFkZXIgb3Igbm8gY2hhbmdlIGluIHRoZWlycywgdXNlIG91cnNcbiAgICAgIHJldC5vbGRGaWxlTmFtZSA9IG1pbmUub2xkRmlsZU5hbWU7XG4gICAgICByZXQubmV3RmlsZU5hbWUgPSBtaW5lLm5ld0ZpbGVOYW1lO1xuICAgICAgcmV0Lm9sZEhlYWRlciA9IG1pbmUub2xkSGVhZGVyO1xuICAgICAgcmV0Lm5ld0hlYWRlciA9IG1pbmUubmV3SGVhZGVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBCb3RoIGNoYW5nZWQuLi4gZmlndXJlIGl0IG91dFxuICAgICAgcmV0Lm9sZEZpbGVOYW1lID0gc2VsZWN0RmllbGQocmV0LCBtaW5lLm9sZEZpbGVOYW1lLCB0aGVpcnMub2xkRmlsZU5hbWUpO1xuICAgICAgcmV0Lm5ld0ZpbGVOYW1lID0gc2VsZWN0RmllbGQocmV0LCBtaW5lLm5ld0ZpbGVOYW1lLCB0aGVpcnMubmV3RmlsZU5hbWUpO1xuICAgICAgcmV0Lm9sZEhlYWRlciA9IHNlbGVjdEZpZWxkKHJldCwgbWluZS5vbGRIZWFkZXIsIHRoZWlycy5vbGRIZWFkZXIpO1xuICAgICAgcmV0Lm5ld0hlYWRlciA9IHNlbGVjdEZpZWxkKHJldCwgbWluZS5uZXdIZWFkZXIsIHRoZWlycy5uZXdIZWFkZXIpO1xuICAgIH1cbiAgfVxuXG4gIHJldC5odW5rcyA9IFtdO1xuICB2YXIgbWluZUluZGV4ID0gMCxcbiAgICAgIHRoZWlyc0luZGV4ID0gMCxcbiAgICAgIG1pbmVPZmZzZXQgPSAwLFxuICAgICAgdGhlaXJzT2Zmc2V0ID0gMDtcblxuICB3aGlsZSAobWluZUluZGV4IDwgbWluZS5odW5rcy5sZW5ndGggfHwgdGhlaXJzSW5kZXggPCB0aGVpcnMuaHVua3MubGVuZ3RoKSB7XG4gICAgdmFyIG1pbmVDdXJyZW50ID0gbWluZS5odW5rc1ttaW5lSW5kZXhdIHx8IHtcbiAgICAgIG9sZFN0YXJ0OiBJbmZpbml0eVxuICAgIH0sXG4gICAgICAgIHRoZWlyc0N1cnJlbnQgPSB0aGVpcnMuaHVua3NbdGhlaXJzSW5kZXhdIHx8IHtcbiAgICAgIG9sZFN0YXJ0OiBJbmZpbml0eVxuICAgIH07XG5cbiAgICBpZiAoaHVua0JlZm9yZShtaW5lQ3VycmVudCwgdGhlaXJzQ3VycmVudCkpIHtcbiAgICAgIC8vIFRoaXMgcGF0Y2ggZG9lcyBub3Qgb3ZlcmxhcCB3aXRoIGFueSBvZiB0aGUgb3RoZXJzLCB5YXkuXG4gICAgICByZXQuaHVua3MucHVzaChjbG9uZUh1bmsobWluZUN1cnJlbnQsIG1pbmVPZmZzZXQpKTtcbiAgICAgIG1pbmVJbmRleCsrO1xuICAgICAgdGhlaXJzT2Zmc2V0ICs9IG1pbmVDdXJyZW50Lm5ld0xpbmVzIC0gbWluZUN1cnJlbnQub2xkTGluZXM7XG4gICAgfSBlbHNlIGlmIChodW5rQmVmb3JlKHRoZWlyc0N1cnJlbnQsIG1pbmVDdXJyZW50KSkge1xuICAgICAgLy8gVGhpcyBwYXRjaCBkb2VzIG5vdCBvdmVybGFwIHdpdGggYW55IG9mIHRoZSBvdGhlcnMsIHlheS5cbiAgICAgIHJldC5odW5rcy5wdXNoKGNsb25lSHVuayh0aGVpcnNDdXJyZW50LCB0aGVpcnNPZmZzZXQpKTtcbiAgICAgIHRoZWlyc0luZGV4Kys7XG4gICAgICBtaW5lT2Zmc2V0ICs9IHRoZWlyc0N1cnJlbnQubmV3TGluZXMgLSB0aGVpcnNDdXJyZW50Lm9sZExpbmVzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBPdmVybGFwLCBtZXJnZSBhcyBiZXN0IHdlIGNhblxuICAgICAgdmFyIG1lcmdlZEh1bmsgPSB7XG4gICAgICAgIG9sZFN0YXJ0OiBNYXRoLm1pbihtaW5lQ3VycmVudC5vbGRTdGFydCwgdGhlaXJzQ3VycmVudC5vbGRTdGFydCksXG4gICAgICAgIG9sZExpbmVzOiAwLFxuICAgICAgICBuZXdTdGFydDogTWF0aC5taW4obWluZUN1cnJlbnQubmV3U3RhcnQgKyBtaW5lT2Zmc2V0LCB0aGVpcnNDdXJyZW50Lm9sZFN0YXJ0ICsgdGhlaXJzT2Zmc2V0KSxcbiAgICAgICAgbmV3TGluZXM6IDAsXG4gICAgICAgIGxpbmVzOiBbXVxuICAgICAgfTtcbiAgICAgIG1lcmdlTGluZXMobWVyZ2VkSHVuaywgbWluZUN1cnJlbnQub2xkU3RhcnQsIG1pbmVDdXJyZW50LmxpbmVzLCB0aGVpcnNDdXJyZW50Lm9sZFN0YXJ0LCB0aGVpcnNDdXJyZW50LmxpbmVzKTtcbiAgICAgIHRoZWlyc0luZGV4Kys7XG4gICAgICBtaW5lSW5kZXgrKztcbiAgICAgIHJldC5odW5rcy5wdXNoKG1lcmdlZEh1bmspO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGxvYWRQYXRjaChwYXJhbSwgYmFzZSkge1xuICBpZiAodHlwZW9mIHBhcmFtID09PSAnc3RyaW5nJykge1xuICAgIGlmICgvXkBAL20udGVzdChwYXJhbSkgfHwgL15JbmRleDovbS50ZXN0KHBhcmFtKSkge1xuICAgICAgcmV0dXJuIHBhcnNlUGF0Y2gocGFyYW0pWzBdO1xuICAgIH1cblxuICAgIGlmICghYmFzZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHByb3ZpZGUgYSBiYXNlIHJlZmVyZW5jZSBvciBwYXNzIGluIGEgcGF0Y2gnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RydWN0dXJlZFBhdGNoKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBiYXNlLCBwYXJhbSk7XG4gIH1cblxuICByZXR1cm4gcGFyYW07XG59XG5cbmZ1bmN0aW9uIGZpbGVOYW1lQ2hhbmdlZChwYXRjaCkge1xuICByZXR1cm4gcGF0Y2gubmV3RmlsZU5hbWUgJiYgcGF0Y2gubmV3RmlsZU5hbWUgIT09IHBhdGNoLm9sZEZpbGVOYW1lO1xufVxuXG5mdW5jdGlvbiBzZWxlY3RGaWVsZChpbmRleCwgbWluZSwgdGhlaXJzKSB7XG4gIGlmIChtaW5lID09PSB0aGVpcnMpIHtcbiAgICByZXR1cm4gbWluZTtcbiAgfSBlbHNlIHtcbiAgICBpbmRleC5jb25mbGljdCA9IHRydWU7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1pbmU6IG1pbmUsXG4gICAgICB0aGVpcnM6IHRoZWlyc1xuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gaHVua0JlZm9yZSh0ZXN0LCBjaGVjaykge1xuICByZXR1cm4gdGVzdC5vbGRTdGFydCA8IGNoZWNrLm9sZFN0YXJ0ICYmIHRlc3Qub2xkU3RhcnQgKyB0ZXN0Lm9sZExpbmVzIDwgY2hlY2sub2xkU3RhcnQ7XG59XG5cbmZ1bmN0aW9uIGNsb25lSHVuayhodW5rLCBvZmZzZXQpIHtcbiAgcmV0dXJuIHtcbiAgICBvbGRTdGFydDogaHVuay5vbGRTdGFydCxcbiAgICBvbGRMaW5lczogaHVuay5vbGRMaW5lcyxcbiAgICBuZXdTdGFydDogaHVuay5uZXdTdGFydCArIG9mZnNldCxcbiAgICBuZXdMaW5lczogaHVuay5uZXdMaW5lcyxcbiAgICBsaW5lczogaHVuay5saW5lc1xuICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZUxpbmVzKGh1bmssIG1pbmVPZmZzZXQsIG1pbmVMaW5lcywgdGhlaXJPZmZzZXQsIHRoZWlyTGluZXMpIHtcbiAgLy8gVGhpcyB3aWxsIGdlbmVyYWxseSByZXN1bHQgaW4gYSBjb25mbGljdGVkIGh1bmssIGJ1dCB0aGVyZSBhcmUgY2FzZXMgd2hlcmUgdGhlIGNvbnRleHRcbiAgLy8gaXMgdGhlIG9ubHkgb3ZlcmxhcCB3aGVyZSB3ZSBjYW4gc3VjY2Vzc2Z1bGx5IG1lcmdlIHRoZSBjb250ZW50IGhlcmUuXG4gIHZhciBtaW5lID0ge1xuICAgIG9mZnNldDogbWluZU9mZnNldCxcbiAgICBsaW5lczogbWluZUxpbmVzLFxuICAgIGluZGV4OiAwXG4gIH0sXG4gICAgICB0aGVpciA9IHtcbiAgICBvZmZzZXQ6IHRoZWlyT2Zmc2V0LFxuICAgIGxpbmVzOiB0aGVpckxpbmVzLFxuICAgIGluZGV4OiAwXG4gIH07IC8vIEhhbmRsZSBhbnkgbGVhZGluZyBjb250ZW50XG5cbiAgaW5zZXJ0TGVhZGluZyhodW5rLCBtaW5lLCB0aGVpcik7XG4gIGluc2VydExlYWRpbmcoaHVuaywgdGhlaXIsIG1pbmUpOyAvLyBOb3cgaW4gdGhlIG92ZXJsYXAgY29udGVudC4gU2NhbiB0aHJvdWdoIGFuZCBzZWxlY3QgdGhlIGJlc3QgY2hhbmdlcyBmcm9tIGVhY2guXG5cbiAgd2hpbGUgKG1pbmUuaW5kZXggPCBtaW5lLmxpbmVzLmxlbmd0aCAmJiB0aGVpci5pbmRleCA8IHRoZWlyLmxpbmVzLmxlbmd0aCkge1xuICAgIHZhciBtaW5lQ3VycmVudCA9IG1pbmUubGluZXNbbWluZS5pbmRleF0sXG4gICAgICAgIHRoZWlyQ3VycmVudCA9IHRoZWlyLmxpbmVzW3RoZWlyLmluZGV4XTtcblxuICAgIGlmICgobWluZUN1cnJlbnRbMF0gPT09ICctJyB8fCBtaW5lQ3VycmVudFswXSA9PT0gJysnKSAmJiAodGhlaXJDdXJyZW50WzBdID09PSAnLScgfHwgdGhlaXJDdXJyZW50WzBdID09PSAnKycpKSB7XG4gICAgICAvLyBCb3RoIG1vZGlmaWVkIC4uLlxuICAgICAgbXV0dWFsQ2hhbmdlKGh1bmssIG1pbmUsIHRoZWlyKTtcbiAgICB9IGVsc2UgaWYgKG1pbmVDdXJyZW50WzBdID09PSAnKycgJiYgdGhlaXJDdXJyZW50WzBdID09PSAnICcpIHtcbiAgICAgIHZhciBfaHVuayRsaW5lcztcblxuICAgICAgLy8gTWluZSBpbnNlcnRlZFxuICAgICAgKF9odW5rJGxpbmVzID0gaHVuay5saW5lcykucHVzaC5hcHBseShfaHVuayRsaW5lcywgX3RvQ29uc3VtYWJsZUFycmF5KGNvbGxlY3RDaGFuZ2UobWluZSkpKTtcbiAgICB9IGVsc2UgaWYgKHRoZWlyQ3VycmVudFswXSA9PT0gJysnICYmIG1pbmVDdXJyZW50WzBdID09PSAnICcpIHtcbiAgICAgIHZhciBfaHVuayRsaW5lczI7XG5cbiAgICAgIC8vIFRoZWlycyBpbnNlcnRlZFxuICAgICAgKF9odW5rJGxpbmVzMiA9IGh1bmsubGluZXMpLnB1c2guYXBwbHkoX2h1bmskbGluZXMyLCBfdG9Db25zdW1hYmxlQXJyYXkoY29sbGVjdENoYW5nZSh0aGVpcikpKTtcbiAgICB9IGVsc2UgaWYgKG1pbmVDdXJyZW50WzBdID09PSAnLScgJiYgdGhlaXJDdXJyZW50WzBdID09PSAnICcpIHtcbiAgICAgIC8vIE1pbmUgcmVtb3ZlZCBvciBlZGl0ZWRcbiAgICAgIHJlbW92YWwoaHVuaywgbWluZSwgdGhlaXIpO1xuICAgIH0gZWxzZSBpZiAodGhlaXJDdXJyZW50WzBdID09PSAnLScgJiYgbWluZUN1cnJlbnRbMF0gPT09ICcgJykge1xuICAgICAgLy8gVGhlaXIgcmVtb3ZlZCBvciBlZGl0ZWRcbiAgICAgIHJlbW92YWwoaHVuaywgdGhlaXIsIG1pbmUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAobWluZUN1cnJlbnQgPT09IHRoZWlyQ3VycmVudCkge1xuICAgICAgLy8gQ29udGV4dCBpZGVudGl0eVxuICAgICAgaHVuay5saW5lcy5wdXNoKG1pbmVDdXJyZW50KTtcbiAgICAgIG1pbmUuaW5kZXgrKztcbiAgICAgIHRoZWlyLmluZGV4Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENvbnRleHQgbWlzbWF0Y2hcbiAgICAgIGNvbmZsaWN0KGh1bmssIGNvbGxlY3RDaGFuZ2UobWluZSksIGNvbGxlY3RDaGFuZ2UodGhlaXIpKTtcbiAgICB9XG4gIH0gLy8gTm93IHB1c2ggYW55dGhpbmcgdGhhdCBtYXkgYmUgcmVtYWluaW5nXG5cblxuICBpbnNlcnRUcmFpbGluZyhodW5rLCBtaW5lKTtcbiAgaW5zZXJ0VHJhaWxpbmcoaHVuaywgdGhlaXIpO1xuICBjYWxjTGluZUNvdW50KGh1bmspO1xufVxuXG5mdW5jdGlvbiBtdXR1YWxDaGFuZ2UoaHVuaywgbWluZSwgdGhlaXIpIHtcbiAgdmFyIG15Q2hhbmdlcyA9IGNvbGxlY3RDaGFuZ2UobWluZSksXG4gICAgICB0aGVpckNoYW5nZXMgPSBjb2xsZWN0Q2hhbmdlKHRoZWlyKTtcblxuICBpZiAoYWxsUmVtb3ZlcyhteUNoYW5nZXMpICYmIGFsbFJlbW92ZXModGhlaXJDaGFuZ2VzKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgcmVtb3ZlIGNoYW5nZXMgdGhhdCBhcmUgc3VwZXJzZXRzIG9mIG9uZSBhbm90aGVyXG4gICAgaWYgKGFycmF5U3RhcnRzV2l0aChteUNoYW5nZXMsIHRoZWlyQ2hhbmdlcykgJiYgc2tpcFJlbW92ZVN1cGVyc2V0KHRoZWlyLCBteUNoYW5nZXMsIG15Q2hhbmdlcy5sZW5ndGggLSB0aGVpckNoYW5nZXMubGVuZ3RoKSkge1xuICAgICAgdmFyIF9odW5rJGxpbmVzMztcblxuICAgICAgKF9odW5rJGxpbmVzMyA9IGh1bmsubGluZXMpLnB1c2guYXBwbHkoX2h1bmskbGluZXMzLCBfdG9Db25zdW1hYmxlQXJyYXkobXlDaGFuZ2VzKSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGFycmF5U3RhcnRzV2l0aCh0aGVpckNoYW5nZXMsIG15Q2hhbmdlcykgJiYgc2tpcFJlbW92ZVN1cGVyc2V0KG1pbmUsIHRoZWlyQ2hhbmdlcywgdGhlaXJDaGFuZ2VzLmxlbmd0aCAtIG15Q2hhbmdlcy5sZW5ndGgpKSB7XG4gICAgICB2YXIgX2h1bmskbGluZXM0O1xuXG4gICAgICAoX2h1bmskbGluZXM0ID0gaHVuay5saW5lcykucHVzaC5hcHBseShfaHVuayRsaW5lczQsIF90b0NvbnN1bWFibGVBcnJheSh0aGVpckNoYW5nZXMpKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhcnJheUVxdWFsKG15Q2hhbmdlcywgdGhlaXJDaGFuZ2VzKSkge1xuICAgIHZhciBfaHVuayRsaW5lczU7XG5cbiAgICAoX2h1bmskbGluZXM1ID0gaHVuay5saW5lcykucHVzaC5hcHBseShfaHVuayRsaW5lczUsIF90b0NvbnN1bWFibGVBcnJheShteUNoYW5nZXMpKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbmZsaWN0KGh1bmssIG15Q2hhbmdlcywgdGhlaXJDaGFuZ2VzKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZhbChodW5rLCBtaW5lLCB0aGVpciwgc3dhcCkge1xuICB2YXIgbXlDaGFuZ2VzID0gY29sbGVjdENoYW5nZShtaW5lKSxcbiAgICAgIHRoZWlyQ2hhbmdlcyA9IGNvbGxlY3RDb250ZXh0KHRoZWlyLCBteUNoYW5nZXMpO1xuXG4gIGlmICh0aGVpckNoYW5nZXMubWVyZ2VkKSB7XG4gICAgdmFyIF9odW5rJGxpbmVzNjtcblxuICAgIChfaHVuayRsaW5lczYgPSBodW5rLmxpbmVzKS5wdXNoLmFwcGx5KF9odW5rJGxpbmVzNiwgX3RvQ29uc3VtYWJsZUFycmF5KHRoZWlyQ2hhbmdlcy5tZXJnZWQpKTtcbiAgfSBlbHNlIHtcbiAgICBjb25mbGljdChodW5rLCBzd2FwID8gdGhlaXJDaGFuZ2VzIDogbXlDaGFuZ2VzLCBzd2FwID8gbXlDaGFuZ2VzIDogdGhlaXJDaGFuZ2VzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb25mbGljdChodW5rLCBtaW5lLCB0aGVpcikge1xuICBodW5rLmNvbmZsaWN0ID0gdHJ1ZTtcbiAgaHVuay5saW5lcy5wdXNoKHtcbiAgICBjb25mbGljdDogdHJ1ZSxcbiAgICBtaW5lOiBtaW5lLFxuICAgIHRoZWlyczogdGhlaXJcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGluc2VydExlYWRpbmcoaHVuaywgaW5zZXJ0LCB0aGVpcikge1xuICB3aGlsZSAoaW5zZXJ0Lm9mZnNldCA8IHRoZWlyLm9mZnNldCAmJiBpbnNlcnQuaW5kZXggPCBpbnNlcnQubGluZXMubGVuZ3RoKSB7XG4gICAgdmFyIGxpbmUgPSBpbnNlcnQubGluZXNbaW5zZXJ0LmluZGV4KytdO1xuICAgIGh1bmsubGluZXMucHVzaChsaW5lKTtcbiAgICBpbnNlcnQub2Zmc2V0Kys7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0VHJhaWxpbmcoaHVuaywgaW5zZXJ0KSB7XG4gIHdoaWxlIChpbnNlcnQuaW5kZXggPCBpbnNlcnQubGluZXMubGVuZ3RoKSB7XG4gICAgdmFyIGxpbmUgPSBpbnNlcnQubGluZXNbaW5zZXJ0LmluZGV4KytdO1xuICAgIGh1bmsubGluZXMucHVzaChsaW5lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0Q2hhbmdlKHN0YXRlKSB7XG4gIHZhciByZXQgPSBbXSxcbiAgICAgIG9wZXJhdGlvbiA9IHN0YXRlLmxpbmVzW3N0YXRlLmluZGV4XVswXTtcblxuICB3aGlsZSAoc3RhdGUuaW5kZXggPCBzdGF0ZS5saW5lcy5sZW5ndGgpIHtcbiAgICB2YXIgbGluZSA9IHN0YXRlLmxpbmVzW3N0YXRlLmluZGV4XTsgLy8gR3JvdXAgYWRkaXRpb25zIHRoYXQgYXJlIGltbWVkaWF0ZWx5IGFmdGVyIHN1YnRyYWN0aW9ucyBhbmQgdHJlYXQgdGhlbSBhcyBvbmUgXCJhdG9taWNcIiBtb2RpZnkgY2hhbmdlLlxuXG4gICAgaWYgKG9wZXJhdGlvbiA9PT0gJy0nICYmIGxpbmVbMF0gPT09ICcrJykge1xuICAgICAgb3BlcmF0aW9uID0gJysnO1xuICAgIH1cblxuICAgIGlmIChvcGVyYXRpb24gPT09IGxpbmVbMF0pIHtcbiAgICAgIHJldC5wdXNoKGxpbmUpO1xuICAgICAgc3RhdGUuaW5kZXgrKztcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gY29sbGVjdENvbnRleHQoc3RhdGUsIG1hdGNoQ2hhbmdlcykge1xuICB2YXIgY2hhbmdlcyA9IFtdLFxuICAgICAgbWVyZ2VkID0gW10sXG4gICAgICBtYXRjaEluZGV4ID0gMCxcbiAgICAgIGNvbnRleHRDaGFuZ2VzID0gZmFsc2UsXG4gICAgICBjb25mbGljdGVkID0gZmFsc2U7XG5cbiAgd2hpbGUgKG1hdGNoSW5kZXggPCBtYXRjaENoYW5nZXMubGVuZ3RoICYmIHN0YXRlLmluZGV4IDwgc3RhdGUubGluZXMubGVuZ3RoKSB7XG4gICAgdmFyIGNoYW5nZSA9IHN0YXRlLmxpbmVzW3N0YXRlLmluZGV4XSxcbiAgICAgICAgbWF0Y2ggPSBtYXRjaENoYW5nZXNbbWF0Y2hJbmRleF07IC8vIE9uY2Ugd2UndmUgaGl0IG91ciBhZGQsIHRoZW4gd2UgYXJlIGRvbmVcblxuICAgIGlmIChtYXRjaFswXSA9PT0gJysnKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb250ZXh0Q2hhbmdlcyA9IGNvbnRleHRDaGFuZ2VzIHx8IGNoYW5nZVswXSAhPT0gJyAnO1xuICAgIG1lcmdlZC5wdXNoKG1hdGNoKTtcbiAgICBtYXRjaEluZGV4Kys7IC8vIENvbnN1bWUgYW55IGFkZGl0aW9ucyBpbiB0aGUgb3RoZXIgYmxvY2sgYXMgYSBjb25mbGljdCB0byBhdHRlbXB0XG4gICAgLy8gdG8gcHVsbCBpbiB0aGUgcmVtYWluaW5nIGNvbnRleHQgYWZ0ZXIgdGhpc1xuXG4gICAgaWYgKGNoYW5nZVswXSA9PT0gJysnKSB7XG4gICAgICBjb25mbGljdGVkID0gdHJ1ZTtcblxuICAgICAgd2hpbGUgKGNoYW5nZVswXSA9PT0gJysnKSB7XG4gICAgICAgIGNoYW5nZXMucHVzaChjaGFuZ2UpO1xuICAgICAgICBjaGFuZ2UgPSBzdGF0ZS5saW5lc1srK3N0YXRlLmluZGV4XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF0Y2guc3Vic3RyKDEpID09PSBjaGFuZ2Uuc3Vic3RyKDEpKSB7XG4gICAgICBjaGFuZ2VzLnB1c2goY2hhbmdlKTtcbiAgICAgIHN0YXRlLmluZGV4Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbmZsaWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICgobWF0Y2hDaGFuZ2VzW21hdGNoSW5kZXhdIHx8ICcnKVswXSA9PT0gJysnICYmIGNvbnRleHRDaGFuZ2VzKSB7XG4gICAgY29uZmxpY3RlZCA9IHRydWU7XG4gIH1cblxuICBpZiAoY29uZmxpY3RlZCkge1xuICAgIHJldHVybiBjaGFuZ2VzO1xuICB9XG5cbiAgd2hpbGUgKG1hdGNoSW5kZXggPCBtYXRjaENoYW5nZXMubGVuZ3RoKSB7XG4gICAgbWVyZ2VkLnB1c2gobWF0Y2hDaGFuZ2VzW21hdGNoSW5kZXgrK10pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtZXJnZWQ6IG1lcmdlZCxcbiAgICBjaGFuZ2VzOiBjaGFuZ2VzXG4gIH07XG59XG5cbmZ1bmN0aW9uIGFsbFJlbW92ZXMoY2hhbmdlcykge1xuICByZXR1cm4gY2hhbmdlcy5yZWR1Y2UoZnVuY3Rpb24gKHByZXYsIGNoYW5nZSkge1xuICAgIHJldHVybiBwcmV2ICYmIGNoYW5nZVswXSA9PT0gJy0nO1xuICB9LCB0cnVlKTtcbn1cblxuZnVuY3Rpb24gc2tpcFJlbW92ZVN1cGVyc2V0KHN0YXRlLCByZW1vdmVDaGFuZ2VzLCBkZWx0YSkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGRlbHRhOyBpKyspIHtcbiAgICB2YXIgY2hhbmdlQ29udGVudCA9IHJlbW92ZUNoYW5nZXNbcmVtb3ZlQ2hhbmdlcy5sZW5ndGggLSBkZWx0YSArIGldLnN1YnN0cigxKTtcblxuICAgIGlmIChzdGF0ZS5saW5lc1tzdGF0ZS5pbmRleCArIGldICE9PSAnICcgKyBjaGFuZ2VDb250ZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgc3RhdGUuaW5kZXggKz0gZGVsdGE7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBjYWxjT2xkTmV3TGluZUNvdW50KGxpbmVzKSB7XG4gIHZhciBvbGRMaW5lcyA9IDA7XG4gIHZhciBuZXdMaW5lcyA9IDA7XG4gIGxpbmVzLmZvckVhY2goZnVuY3Rpb24gKGxpbmUpIHtcbiAgICBpZiAodHlwZW9mIGxpbmUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB2YXIgbXlDb3VudCA9IGNhbGNPbGROZXdMaW5lQ291bnQobGluZS5taW5lKTtcbiAgICAgIHZhciB0aGVpckNvdW50ID0gY2FsY09sZE5ld0xpbmVDb3VudChsaW5lLnRoZWlycyk7XG5cbiAgICAgIGlmIChvbGRMaW5lcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChteUNvdW50Lm9sZExpbmVzID09PSB0aGVpckNvdW50Lm9sZExpbmVzKSB7XG4gICAgICAgICAgb2xkTGluZXMgKz0gbXlDb3VudC5vbGRMaW5lcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvbGRMaW5lcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobmV3TGluZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAobXlDb3VudC5uZXdMaW5lcyA9PT0gdGhlaXJDb3VudC5uZXdMaW5lcykge1xuICAgICAgICAgIG5ld0xpbmVzICs9IG15Q291bnQubmV3TGluZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3TGluZXMgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5ld0xpbmVzICE9PSB1bmRlZmluZWQgJiYgKGxpbmVbMF0gPT09ICcrJyB8fCBsaW5lWzBdID09PSAnICcpKSB7XG4gICAgICAgIG5ld0xpbmVzKys7XG4gICAgICB9XG5cbiAgICAgIGlmIChvbGRMaW5lcyAhPT0gdW5kZWZpbmVkICYmIChsaW5lWzBdID09PSAnLScgfHwgbGluZVswXSA9PT0gJyAnKSkge1xuICAgICAgICBvbGRMaW5lcysrO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHJldHVybiB7XG4gICAgb2xkTGluZXM6IG9sZExpbmVzLFxuICAgIG5ld0xpbmVzOiBuZXdMaW5lc1xuICB9O1xufVxuXG4vLyBTZWU6IGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9nb29nbGUtZGlmZi1tYXRjaC1wYXRjaC93aWtpL0FQSVxuZnVuY3Rpb24gY29udmVydENoYW5nZXNUb0RNUChjaGFuZ2VzKSB7XG4gIHZhciByZXQgPSBbXSxcbiAgICAgIGNoYW5nZSxcbiAgICAgIG9wZXJhdGlvbjtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjaGFuZ2UgPSBjaGFuZ2VzW2ldO1xuXG4gICAgaWYgKGNoYW5nZS5hZGRlZCkge1xuICAgICAgb3BlcmF0aW9uID0gMTtcbiAgICB9IGVsc2UgaWYgKGNoYW5nZS5yZW1vdmVkKSB7XG4gICAgICBvcGVyYXRpb24gPSAtMTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3BlcmF0aW9uID0gMDtcbiAgICB9XG5cbiAgICByZXQucHVzaChbb3BlcmF0aW9uLCBjaGFuZ2UudmFsdWVdKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRDaGFuZ2VzVG9YTUwoY2hhbmdlcykge1xuICB2YXIgcmV0ID0gW107XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNoYW5nZSA9IGNoYW5nZXNbaV07XG5cbiAgICBpZiAoY2hhbmdlLmFkZGVkKSB7XG4gICAgICByZXQucHVzaCgnPGlucz4nKTtcbiAgICB9IGVsc2UgaWYgKGNoYW5nZS5yZW1vdmVkKSB7XG4gICAgICByZXQucHVzaCgnPGRlbD4nKTtcbiAgICB9XG5cbiAgICByZXQucHVzaChlc2NhcGVIVE1MKGNoYW5nZS52YWx1ZSkpO1xuXG4gICAgaWYgKGNoYW5nZS5hZGRlZCkge1xuICAgICAgcmV0LnB1c2goJzwvaW5zPicpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlLnJlbW92ZWQpIHtcbiAgICAgIHJldC5wdXNoKCc8L2RlbD4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0LmpvaW4oJycpO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVIVE1MKHMpIHtcbiAgdmFyIG4gPSBzO1xuICBuID0gbi5yZXBsYWNlKC8mL2csICcmYW1wOycpO1xuICBuID0gbi5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG4gIG4gPSBuLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbiAgbiA9IG4ucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xuICByZXR1cm4gbjtcbn1cblxuZXhwb3J0IHsgRGlmZiwgYXBwbHlQYXRjaCwgYXBwbHlQYXRjaGVzLCBjYW5vbmljYWxpemUsIGNvbnZlcnRDaGFuZ2VzVG9ETVAsIGNvbnZlcnRDaGFuZ2VzVG9YTUwsIGNyZWF0ZVBhdGNoLCBjcmVhdGVUd29GaWxlc1BhdGNoLCBkaWZmQXJyYXlzLCBkaWZmQ2hhcnMsIGRpZmZDc3MsIGRpZmZKc29uLCBkaWZmTGluZXMsIGRpZmZTZW50ZW5jZXMsIGRpZmZUcmltbWVkTGluZXMsIGRpZmZXb3JkcywgZGlmZldvcmRzV2l0aFNwYWNlLCBtZXJnZSwgcGFyc2VQYXRjaCwgc3RydWN0dXJlZFBhdGNoIH07XG4iLCJpbXBvcnQgeyBBcHAsIE1hcmtkb3duVmlldywgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IGRpZmZMaW5lcyB9IGZyb20gXCJkaWZmXCI7XHJcblxyXG5pbnRlcmZhY2UgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdzIHtcclxuICBzdHlsZUxpc3RzOiBib29sZWFuO1xyXG4gIGRlYnVnOiBib29sZWFuO1xyXG59XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBPYnNpZGlhbk91dGxpbmVyUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgc3R5bGVMaXN0czogZmFsc2UsXHJcbiAgZGVidWc6IGZhbHNlLFxyXG59O1xyXG5cclxudHlwZSBNb2QgPSBcInNoaWZ0XCIgfCBcImN0cmxcIiB8IFwiY21kXCIgfCBcImFsdFwiO1xyXG5cclxuZnVuY3Rpb24gcmFuZ2VJc0N1cnNvcihzZWxlY3Rpb246IENvZGVNaXJyb3IuUmFuZ2UpIHtcclxuICByZXR1cm4gKFxyXG4gICAgc2VsZWN0aW9uLmFuY2hvci5saW5lID09PSBzZWxlY3Rpb24uaGVhZC5saW5lICYmXHJcbiAgICBzZWxlY3Rpb24uYW5jaG9yLmNoID09PSBzZWxlY3Rpb24uaGVhZC5jaFxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRlc3RLZXlkb3duKGU6IEtleWJvYXJkRXZlbnQsIGNvZGU6IHN0cmluZywgbW9kczogTW9kW10gPSBbXSkge1xyXG4gIGNvbnN0IHNob3VkaFNoaWZ0ID0gbW9kcy5pbmNsdWRlcyhcInNoaWZ0XCIpO1xyXG4gIGNvbnN0IHNob3VkaE1ldGEgPSBtb2RzLmluY2x1ZGVzKFwiY21kXCIpO1xyXG4gIGNvbnN0IHNob3VkaEFsdCA9IG1vZHMuaW5jbHVkZXMoXCJhbHRcIik7XHJcbiAgY29uc3Qgc2hvdWRoQ3RybCA9IG1vZHMuaW5jbHVkZXMoXCJjdHJsXCIpO1xyXG5cclxuICByZXR1cm4gKFxyXG4gICAgZS5jb2RlID09PSBjb2RlICYmXHJcbiAgICBlLnNoaWZ0S2V5ID09PSBzaG91ZGhTaGlmdCAmJlxyXG4gICAgZS5tZXRhS2V5ID09PSBzaG91ZGhNZXRhICYmXHJcbiAgICBlLmFsdEtleSA9PT0gc2hvdWRoQWx0ICYmXHJcbiAgICBlLmN0cmxLZXkgPT09IHNob3VkaEN0cmxcclxuICApO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgSUxpc3Qge1xyXG4gIGdldExldmVsKCk6IG51bWJlcjtcclxuICBnZXRQYXJlbnQoKTogSUxpc3QgfCBudWxsO1xyXG4gIGFkZChsaXN0OiBJTGlzdCk6IHZvaWQ7XHJcbn1cclxuXHJcbmNsYXNzIExpc3QgaW1wbGVtZW50cyBJTGlzdCB7XHJcbiAgcHJpdmF0ZSBpbmRlbnRTaWduOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBidWxsZXQ6IHN0cmluZztcclxuICBwcml2YXRlIGNvbnRlbnQ6IHN0cmluZztcclxuICBwcml2YXRlIGNoaWxkcmVuOiBMaXN0W107XHJcbiAgcHJpdmF0ZSBwYXJlbnQ6IExpc3Q7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGluZGVudFNpZ246IHN0cmluZywgYnVsbGV0OiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZykge1xyXG4gICAgdGhpcy5pbmRlbnRTaWduID0gaW5kZW50U2lnbjtcclxuICAgIHRoaXMuYnVsbGV0ID0gYnVsbGV0O1xyXG4gICAgdGhpcy5jb250ZW50ID0gY29udGVudDtcclxuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcclxuICAgIHRoaXMucGFyZW50ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGdldENoaWxkcmVuKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uY29uY2F0KCk7XHJcbiAgfVxyXG5cclxuICBnZXRGdWxsQ29udGVudCgpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIG5ldyBBcnJheSh0aGlzLmdldExldmVsKCkgLSAxKS5maWxsKHRoaXMuaW5kZW50U2lnbikuam9pbihcIlwiKSArXHJcbiAgICAgIHRoaXMuYnVsbGV0ICtcclxuICAgICAgXCIgXCIgK1xyXG4gICAgICB0aGlzLmNvbnRlbnRcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBhcHBlbmRDb250ZW50KGNvbnRlbnQ6IHN0cmluZykge1xyXG4gICAgdGhpcy5jb250ZW50ICs9IGNvbnRlbnQ7XHJcbiAgfVxyXG5cclxuICBzZXRDb250ZW50KGNvbnRlbnQ6IHN0cmluZykge1xyXG4gICAgdGhpcy5jb250ZW50ID0gY29udGVudDtcclxuICB9XHJcblxyXG4gIGdldENvbnRlbnQoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jb250ZW50O1xyXG4gIH1cclxuXHJcbiAgaXNFbXB0eSgpIHtcclxuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PT0gMDtcclxuICB9XHJcblxyXG4gIGdldENvbnRlbnRTdGFydENoKCkge1xyXG4gICAgY29uc3QgaW5kZW50TGVuZ3RoID0gKHRoaXMuZ2V0TGV2ZWwoKSAtIDEpICogdGhpcy5pbmRlbnRTaWduLmxlbmd0aDtcclxuICAgIHJldHVybiBpbmRlbnRMZW5ndGggKyAyO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29udGVudEVuZENoKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29udGVudFN0YXJ0Q2goKSArIHRoaXMuY29udGVudC5sZW5ndGg7XHJcbiAgfVxyXG5cclxuICBnZXRQYXJlbnQoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQ7XHJcbiAgfVxyXG5cclxuICBnZXRQcmV2U2libGluZyhsaXN0OiBMaXN0KSB7XHJcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGxpc3QpO1xyXG4gICAgcmV0dXJuIGkgPiAwID8gdGhpcy5jaGlsZHJlbltpIC0gMV0gOiBudWxsO1xyXG4gIH1cclxuXHJcbiAgZ2V0TmV4dFNpYmxpbmcobGlzdDogTGlzdCkge1xyXG4gICAgY29uc3QgaSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihsaXN0KTtcclxuICAgIHJldHVybiBpID49IDAgJiYgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoID8gdGhpcy5jaGlsZHJlbltpICsgMV0gOiBudWxsO1xyXG4gIH1cclxuXHJcbiAgZ2V0TGV2ZWwoKSB7XHJcbiAgICBsZXQgbGV2ZWwgPSAwO1xyXG4gICAgbGV0IHJlZjogTGlzdCA9IHRoaXM7XHJcbiAgICB3aGlsZSAocmVmLnBhcmVudCkge1xyXG4gICAgICByZWYgPSByZWYucGFyZW50O1xyXG4gICAgICBsZXZlbCsrO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGxldmVsO1xyXG4gIH1cclxuXHJcbiAgYWRkKGxpc3Q6IExpc3QpIHtcclxuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChsaXN0KTtcclxuICAgIGxpc3QucGFyZW50ID0gdGhpcztcclxuICB9XHJcblxyXG4gIGFkZEF0QmVnaW5uaW5nKGxpc3Q6IExpc3QpIHtcclxuICAgIHRoaXMuY2hpbGRyZW4udW5zaGlmdChsaXN0KTtcclxuICAgIGxpc3QucGFyZW50ID0gdGhpcztcclxuICB9XHJcblxyXG4gIGFkZEJlZm9yZShiZWZvcmU6IExpc3QsIGxpc3Q6IExpc3QpIHtcclxuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoYmVmb3JlKTtcclxuICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKGksIDAsIGxpc3QpO1xyXG4gICAgbGlzdC5wYXJlbnQgPSB0aGlzO1xyXG4gIH1cclxuXHJcbiAgYWRkQWZ0ZXIoYmVmb3JlOiBMaXN0LCBsaXN0OiBMaXN0KSB7XHJcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGJlZm9yZSk7XHJcbiAgICB0aGlzLmNoaWxkcmVuLnNwbGljZShpICsgMSwgMCwgbGlzdCk7XHJcbiAgICBsaXN0LnBhcmVudCA9IHRoaXM7XHJcbiAgfVxyXG5cclxuICByZW1vdmUobGlzdDogTGlzdCkge1xyXG4gICAgY29uc3QgaSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihsaXN0KTtcclxuICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKGksIDEpO1xyXG4gICAgbGlzdC5wYXJlbnQgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpbnQoKSB7XHJcbiAgICBsZXQgcmVzID0gdGhpcy5nZXRGdWxsQ29udGVudCgpICsgXCJcXG5cIjtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcclxuICAgICAgcmVzICs9IGNoaWxkLnByaW50KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlcztcclxuICB9XHJcbn1cclxuXHJcbmNsYXNzIFJvb3QgaW1wbGVtZW50cyBJTGlzdCB7XHJcbiAgcHJpdmF0ZSBpbmRlbnRTaWduOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSByb290TGlzdDogTGlzdDtcclxuICBwcml2YXRlIHN0YXJ0OiBDb2RlTWlycm9yLlBvc2l0aW9uO1xyXG4gIHByaXZhdGUgZW5kOiBDb2RlTWlycm9yLlBvc2l0aW9uO1xyXG4gIHByaXZhdGUgY3Vyc29yOiBDb2RlTWlycm9yLlBvc2l0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGluZGVudFNpZ246IHN0cmluZyxcclxuICAgIHN0YXJ0OiBDb2RlTWlycm9yLlBvc2l0aW9uLFxyXG4gICAgZW5kOiBDb2RlTWlycm9yLlBvc2l0aW9uLFxyXG4gICAgY3Vyc29yOiBDb2RlTWlycm9yLlBvc2l0aW9uXHJcbiAgKSB7XHJcbiAgICB0aGlzLmluZGVudFNpZ24gPSBpbmRlbnRTaWduO1xyXG4gICAgdGhpcy5zdGFydCA9IHN0YXJ0O1xyXG4gICAgdGhpcy5lbmQgPSBlbmQ7XHJcbiAgICB0aGlzLmN1cnNvciA9IGN1cnNvcjtcclxuICAgIHRoaXMucm9vdExpc3QgPSBuZXcgTGlzdChcIlwiLCBcIlwiLCBcIlwiKTtcclxuICB9XHJcblxyXG4gIHJlcGxhY2VDdXJzb3IoY3Vyc29yOiBDb2RlTWlycm9yLlBvc2l0aW9uKSB7XHJcbiAgICB0aGlzLmN1cnNvciA9IGN1cnNvcjtcclxuICB9XHJcblxyXG4gIGdldFRvdGFsTGluZXMoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbmQubGluZSAtIHRoaXMuc3RhcnQubGluZSArIDE7XHJcbiAgfVxyXG5cclxuICBnZXRDaGlsZHJlbigpIHtcclxuICAgIHJldHVybiB0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCk7XHJcbiAgfVxyXG5cclxuICBnZXRJbmRlbnRTaWduKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuaW5kZW50U2lnbjtcclxuICB9XHJcblxyXG4gIGdldExldmVsKCkge1xyXG4gICAgcmV0dXJuIDA7XHJcbiAgfVxyXG5cclxuICBnZXRQYXJlbnQoKTogTGlzdCB8IG51bGwge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBhZGQobGlzdDogTGlzdCkge1xyXG4gICAgdGhpcy5yb290TGlzdC5hZGQobGlzdCk7XHJcbiAgfVxyXG5cclxuICBnZXRTdGFydCgpIHtcclxuICAgIHJldHVybiB0aGlzLnN0YXJ0O1xyXG4gIH1cclxuXHJcbiAgZ2V0RW5kKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZW5kO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q3Vyc29yKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuY3Vyc29yO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q3Vyc29yT25MaXN0KCk6IExpc3Qge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0TGlzdFVuZGVyTGluZSh0aGlzLmN1cnNvci5saW5lKTtcclxuICB9XHJcblxyXG4gIHByaW50KCkge1xyXG4gICAgbGV0IHJlcyA9IFwiXCI7XHJcblxyXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCkpIHtcclxuICAgICAgcmVzICs9IGNoaWxkLnByaW50KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlcy5yZXBsYWNlKC9cXG4kLywgXCJcIik7XHJcbiAgfVxyXG5cclxuICBnZXRMaW5lTnVtYmVyKGxpc3Q6IExpc3QpIHtcclxuICAgIGxldCByZXN1bHQ6IG51bWJlciA9IG51bGw7XHJcbiAgICBsZXQgbGluZTogbnVtYmVyID0gMDtcclxuICAgIGNvbnN0IHZpc2l0QXJyID0gKGxsOiBMaXN0W10pID0+IHtcclxuICAgICAgZm9yIChjb25zdCBsIG9mIGxsKSB7XHJcbiAgICAgICAgaWYgKGwgPT09IGxpc3QpIHtcclxuICAgICAgICAgIHJlc3VsdCA9IGxpbmU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGxpbmUrKztcclxuICAgICAgICAgIHZpc2l0QXJyKGwuZ2V0Q2hpbGRyZW4oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdmlzaXRBcnIodGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0ICsgdGhpcy5zdGFydC5saW5lO1xyXG4gIH1cclxuXHJcbiAgZ2V0TGlzdFVuZGVyTGluZShsaW5lOiBudW1iZXIpIHtcclxuICAgIGlmIChsaW5lIDwgdGhpcy5zdGFydC5saW5lKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcmVzdWx0OiBMaXN0ID0gbnVsbDtcclxuICAgIGxldCBpbmRleDogbnVtYmVyID0gMDtcclxuICAgIGNvbnN0IHZpc2l0QXJyID0gKGxsOiBMaXN0W10pID0+IHtcclxuICAgICAgZm9yIChjb25zdCBsIG9mIGxsKSB7XHJcbiAgICAgICAgaWYgKGluZGV4ICsgdGhpcy5zdGFydC5saW5lID09PSBsaW5lKSB7XHJcbiAgICAgICAgICByZXN1bHQgPSBsO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBpbmRleCsrO1xyXG4gICAgICAgICAgdmlzaXRBcnIobC5nZXRDaGlsZHJlbigpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2aXNpdEFycih0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCkpO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBtb3ZlVXAoKSB7XHJcbiAgICBjb25zdCBsaXN0ID0gdGhpcy5nZXRDdXJzb3JPbkxpc3QoKTtcclxuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XHJcbiAgICBjb25zdCBncmFuZFBhcmVudCA9IHBhcmVudC5nZXRQYXJlbnQoKTtcclxuICAgIGNvbnN0IHByZXYgPSBwYXJlbnQuZ2V0UHJldlNpYmxpbmcobGlzdCk7XHJcblxyXG4gICAgaWYgKCFwcmV2ICYmIGdyYW5kUGFyZW50KSB7XHJcbiAgICAgIGNvbnN0IG5ld1BhcmVudCA9IGdyYW5kUGFyZW50LmdldFByZXZTaWJsaW5nKHBhcmVudCk7XHJcblxyXG4gICAgICBpZiAobmV3UGFyZW50KSB7XHJcbiAgICAgICAgcGFyZW50LnJlbW92ZShsaXN0KTtcclxuICAgICAgICBuZXdQYXJlbnQuYWRkKGxpc3QpO1xyXG4gICAgICAgIHRoaXMuY3Vyc29yLmxpbmUgPSB0aGlzLmdldExpbmVOdW1iZXIobGlzdCk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAocHJldikge1xyXG4gICAgICBwYXJlbnQucmVtb3ZlKGxpc3QpO1xyXG4gICAgICBwYXJlbnQuYWRkQmVmb3JlKHByZXYsIGxpc3QpO1xyXG4gICAgICB0aGlzLmN1cnNvci5saW5lID0gdGhpcy5nZXRMaW5lTnVtYmVyKGxpc3QpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgbW92ZURvd24oKSB7XHJcbiAgICBjb25zdCBsaXN0ID0gdGhpcy5nZXRDdXJzb3JPbkxpc3QoKTtcclxuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XHJcbiAgICBjb25zdCBncmFuZFBhcmVudCA9IHBhcmVudC5nZXRQYXJlbnQoKTtcclxuICAgIGNvbnN0IG5leHQgPSBwYXJlbnQuZ2V0TmV4dFNpYmxpbmcobGlzdCk7XHJcblxyXG4gICAgaWYgKCFuZXh0ICYmIGdyYW5kUGFyZW50KSB7XHJcbiAgICAgIGNvbnN0IG5ld1BhcmVudCA9IGdyYW5kUGFyZW50LmdldE5leHRTaWJsaW5nKHBhcmVudCk7XHJcblxyXG4gICAgICBpZiAobmV3UGFyZW50KSB7XHJcbiAgICAgICAgcGFyZW50LnJlbW92ZShsaXN0KTtcclxuICAgICAgICBuZXdQYXJlbnQuYWRkQXRCZWdpbm5pbmcobGlzdCk7XHJcbiAgICAgICAgdGhpcy5jdXJzb3IubGluZSA9IHRoaXMuZ2V0TGluZU51bWJlcihsaXN0KTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChuZXh0KSB7XHJcbiAgICAgIHBhcmVudC5yZW1vdmUobGlzdCk7XHJcbiAgICAgIHBhcmVudC5hZGRBZnRlcihuZXh0LCBsaXN0KTtcclxuICAgICAgdGhpcy5jdXJzb3IubGluZSA9IHRoaXMuZ2V0TGluZU51bWJlcihsaXN0KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG1vdmVMZWZ0KCkge1xyXG4gICAgY29uc3QgbGlzdCA9IHRoaXMuZ2V0Q3Vyc29yT25MaXN0KCk7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xyXG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXJlbnQuZ2V0UGFyZW50KCk7XHJcblxyXG4gICAgaWYgKCFncmFuZFBhcmVudCkge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBwYXJlbnQucmVtb3ZlKGxpc3QpO1xyXG4gICAgZ3JhbmRQYXJlbnQuYWRkQWZ0ZXIocGFyZW50LCBsaXN0KTtcclxuICAgIHRoaXMuY3Vyc29yLmxpbmUgPSB0aGlzLmdldExpbmVOdW1iZXIobGlzdCk7XHJcbiAgICB0aGlzLmN1cnNvci5jaC0tO1xyXG5cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgbW92ZVJpZ2h0KCkge1xyXG4gICAgY29uc3QgbGlzdCA9IHRoaXMuZ2V0Q3Vyc29yT25MaXN0KCk7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xyXG4gICAgY29uc3QgcHJldiA9IHBhcmVudC5nZXRQcmV2U2libGluZyhsaXN0KTtcclxuXHJcbiAgICBpZiAoIXByZXYpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgcGFyZW50LnJlbW92ZShsaXN0KTtcclxuICAgIHByZXYuYWRkKGxpc3QpO1xyXG4gICAgdGhpcy5jdXJzb3IubGluZSA9IHRoaXMuZ2V0TGluZU51bWJlcihsaXN0KTtcclxuICAgIHRoaXMuY3Vyc29yLmNoKys7XHJcblxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICBkZWxldGUoKSB7XHJcbiAgICBjb25zdCBsaXN0ID0gdGhpcy5nZXRDdXJzb3JPbkxpc3QoKTtcclxuXHJcbiAgICBpZiAodGhpcy5jdXJzb3IuY2ggIT09IGxpc3QuZ2V0Q29udGVudFN0YXJ0Q2goKSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHJldiA9IHRoaXMuZ2V0TGlzdFVuZGVyTGluZSh0aGlzLmN1cnNvci5saW5lIC0gMSk7XHJcblxyXG4gICAgaWYgKCFwcmV2KSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJvdGhBcmVFbXB0eSA9IHByZXYuaXNFbXB0eSgpICYmIGxpc3QuaXNFbXB0eSgpO1xyXG4gICAgY29uc3QgcHJldklzRW1wdHlBbmRTYW1lTGV2ZWwgPVxyXG4gICAgICBwcmV2LmlzRW1wdHkoKSAmJiAhbGlzdC5pc0VtcHR5KCkgJiYgcHJldi5nZXRMZXZlbCgpID09IGxpc3QuZ2V0TGV2ZWwoKTtcclxuICAgIGNvbnN0IGxpc3RJc0VtcHR5QW5kUHJldklzUGFyZW50ID1cclxuICAgICAgbGlzdC5pc0VtcHR5KCkgJiYgcHJldi5nZXRMZXZlbCgpID09IGxpc3QuZ2V0TGV2ZWwoKSAtIDE7XHJcblxyXG4gICAgaWYgKGJvdGhBcmVFbXB0eSB8fCBwcmV2SXNFbXB0eUFuZFNhbWVMZXZlbCB8fCBsaXN0SXNFbXB0eUFuZFByZXZJc1BhcmVudCkge1xyXG4gICAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xyXG4gICAgICBjb25zdCBwcmV2RW5kQ2ggPSBwcmV2LmdldENvbnRlbnRFbmRDaCgpO1xyXG5cclxuICAgICAgcHJldi5hcHBlbmRDb250ZW50KGxpc3QuZ2V0Q29udGVudCgpKTtcclxuICAgICAgcGFyZW50LnJlbW92ZShsaXN0KTtcclxuICAgICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xyXG4gICAgICAgIGxpc3QucmVtb3ZlKGMpO1xyXG4gICAgICAgIHByZXYuYWRkKGMpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLmN1cnNvci5saW5lID0gdGhpcy5nZXRMaW5lTnVtYmVyKHByZXYpO1xyXG4gICAgICB0aGlzLmN1cnNvci5jaCA9IHByZXZFbmRDaDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUZ1bGxMZWZ0KCkge1xyXG4gICAgY29uc3QgbGlzdCA9IHRoaXMuZ2V0Q3Vyc29yT25MaXN0KCk7XHJcbiAgICBjb25zdCBkaWZmID0gdGhpcy5jdXJzb3IuY2ggLSBsaXN0LmdldENvbnRlbnRTdGFydENoKCk7XHJcblxyXG4gICAgaWYgKGRpZmYgPiAwKSB7XHJcbiAgICAgIGxpc3Quc2V0Q29udGVudChsaXN0LmdldENvbnRlbnQoKS5zbGljZShkaWZmKSk7XHJcbiAgICAgIHRoaXMuY3Vyc29yLmNoIC09IGRpZmY7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBab29tU3RhdGUge1xyXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBsaW5lOiBDb2RlTWlycm9yLkxpbmVIYW5kbGUsIHB1YmxpYyBoZWFkZXI6IEhUTUxFbGVtZW50KSB7fVxyXG59XHJcblxyXG5jb25zdCB2b2lkRm4gPSAoKSA9PiB7fTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9ic2lkaWFuT3V0bGluZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHNldHRpbmdzOiBPYnNpZGlhbk91dGxpbmVyUGx1Z2luU2V0dGluZ3M7XHJcbiAgcHJpdmF0ZSB6b29tU3RhdGVzOiBXZWFrTWFwPENvZGVNaXJyb3IuRWRpdG9yLCBab29tU3RhdGU+ID0gbmV3IFdlYWtNYXAoKTtcclxuXHJcbiAgZGVidWcobWV0aG9kOiBzdHJpbmcpIHtcclxuICAgIGlmICghdGhpcy5zZXR0aW5ncy5kZWJ1Zykge1xyXG4gICAgICByZXR1cm4gdm9pZEZuO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAoLi4uYXJnczogYW55W10pID0+IGNvbnNvbGUuaW5mbyhtZXRob2QsIC4uLmFyZ3MpO1xyXG4gIH1cclxuXHJcbiAgZ2V0T2JzaWRpYW5UYWJzU2V0dGlnbnMoKToge1xyXG4gICAgdXNlVGFiOiBib29sZWFuO1xyXG4gICAgdGFiU2l6ZTogbnVtYmVyO1xyXG4gIH0ge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdXNlVGFiOiB0cnVlLFxyXG4gICAgICB0YWJTaXplOiA0LFxyXG4gICAgICAuLi4odGhpcy5hcHAudmF1bHQgYXMgYW55KS5jb25maWcsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgZGV0ZWN0TGlzdEluZGVudFNpZ24oZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvciwgY3Vyc29yOiBDb2RlTWlycm9yLlBvc2l0aW9uKSB7XHJcbiAgICBjb25zdCBkID0gdGhpcy5kZWJ1ZyhcIk9ic2lkaWFuT3V0bGluZXJQbHVnaW46OmRldGVjdExpc3RJbmRlbnRTaWduXCIpO1xyXG5cclxuICAgIGNvbnN0IHsgdXNlVGFiLCB0YWJTaXplIH0gPSB0aGlzLmdldE9ic2lkaWFuVGFic1NldHRpZ25zKCk7XHJcbiAgICBjb25zdCBkZWZhdWx0SW5kZW50U2lnbiA9IHVzZVRhYlxyXG4gICAgICA/IFwiXFx0XCJcclxuICAgICAgOiBuZXcgQXJyYXkodGFiU2l6ZSkuZmlsbChcIiBcIikuam9pbihcIlwiKTtcclxuXHJcbiAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUoY3Vyc29yLmxpbmUpO1xyXG5cclxuICAgIGNvbnN0IHdpdGhUYWJzUmUgPSAvXlxcdCtbLSpdIC87XHJcbiAgICBjb25zdCB3aXRoU3BhY2VzUmUgPSAvXlsgXStbLSpdIC87XHJcbiAgICBjb25zdCBtYXlCZVdpdGhTcGFjZXNSZSA9IC9eWyBdKlstKl0gLztcclxuXHJcbiAgICBpZiAod2l0aFRhYnNSZS50ZXN0KGxpbmUpKSB7XHJcbiAgICAgIGQoXCJkZXRlY3RlZCB0YWIgb24gY3VycmVudCBsaW5lXCIpO1xyXG4gICAgICByZXR1cm4gXCJcXHRcIjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAod2l0aFNwYWNlc1JlLnRlc3QobGluZSkpIHtcclxuICAgICAgZChcImRldGVjdGVkIHdoaXRlc3BhY2VzIG9uIGN1cnJlbnQgbGluZSwgdHJ5aW5nIHRvIGNvdW50XCIpO1xyXG4gICAgICBjb25zdCBzcGFjZXNBID0gbGluZS5sZW5ndGggLSBsaW5lLnRyaW1MZWZ0KCkubGVuZ3RoO1xyXG5cclxuICAgICAgbGV0IGxpbmVObyA9IGN1cnNvci5saW5lIC0gMTtcclxuICAgICAgd2hpbGUgKGxpbmVObyA+PSBlZGl0b3IuZmlyc3RMaW5lKCkpIHtcclxuICAgICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGluZU5vKTtcclxuICAgICAgICBpZiAoIW1heUJlV2l0aFNwYWNlc1JlLnRlc3QobGluZSkpIHtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBzcGFjZXNCID0gbGluZS5sZW5ndGggLSBsaW5lLnRyaW1MZWZ0KCkubGVuZ3RoO1xyXG4gICAgICAgIGlmIChzcGFjZXNCIDwgc3BhY2VzQSkge1xyXG4gICAgICAgICAgY29uc3QgbCA9IHNwYWNlc0EgLSBzcGFjZXNCO1xyXG4gICAgICAgICAgZChgZGV0ZWN0ZWQgJHtsfSB3aGl0ZXNwYWNlc2ApO1xyXG4gICAgICAgICAgcmV0dXJuIG5ldyBBcnJheShsKS5maWxsKFwiIFwiKS5qb2luKFwiXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGluZU5vLS07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGQoXCJ1bmFibGUgdG8gZGV0ZWN0XCIpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWF5QmVXaXRoU3BhY2VzUmUudGVzdChsaW5lKSkge1xyXG4gICAgICBkKFwiZGV0ZWN0ZWQgbm90aGluZyBvbiBjdXJyZW50IGxpbmUsIGxvb2tpbmcgZm9yd2FyZFwiKTtcclxuICAgICAgY29uc3Qgc3BhY2VzQSA9IGxpbmUubGVuZ3RoIC0gbGluZS50cmltTGVmdCgpLmxlbmd0aDtcclxuXHJcbiAgICAgIGxldCBsaW5lTm8gPSBjdXJzb3IubGluZSArIDE7XHJcbiAgICAgIHdoaWxlIChsaW5lTm8gPD0gZWRpdG9yLmxhc3RMaW5lKCkpIHtcclxuICAgICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGluZU5vKTtcclxuICAgICAgICBpZiAod2l0aFRhYnNSZS50ZXN0KGxpbmUpKSB7XHJcbiAgICAgICAgICBkKFwiZGV0ZWN0ZWQgdGFiXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIFwiXFx0XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghbWF5QmVXaXRoU3BhY2VzUmUudGVzdChsaW5lKSkge1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHNwYWNlc0IgPSBsaW5lLmxlbmd0aCAtIGxpbmUudHJpbUxlZnQoKS5sZW5ndGg7XHJcbiAgICAgICAgaWYgKHNwYWNlc0IgPiBzcGFjZXNBKSB7XHJcbiAgICAgICAgICBjb25zdCBsID0gc3BhY2VzQiAtIHNwYWNlc0E7XHJcbiAgICAgICAgICBkKGBkZXRlY3RlZCAke2x9IHdoaXRlc3BhY2VzYCk7XHJcbiAgICAgICAgICByZXR1cm4gbmV3IEFycmF5KGwpLmZpbGwoXCIgXCIpLmpvaW4oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsaW5lTm8rKztcclxuICAgICAgfVxyXG5cclxuICAgICAgZChgZGV0ZWN0ZWQgbm90aGluZywgdXNpbmcgZGVmYXVsdCB1c2VUYWI9JHt1c2VUYWJ9IHRhYlNpemU9JHt0YWJTaXplfWApO1xyXG4gICAgICByZXR1cm4gZGVmYXVsdEluZGVudFNpZ247XHJcbiAgICB9XHJcblxyXG4gICAgZChcInVuYWJsZSB0byBkZXRlY3RcIik7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHBhcnNlTGlzdChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yLCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCkpOiBSb290IHtcclxuICAgIGNvbnN0IGN1cnNvckxpbmUgPSBjdXJzb3IubGluZTtcclxuICAgIGNvbnN0IGN1cnNvckNoID0gY3Vyc29yLmNoO1xyXG4gICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGN1cnNvckxpbmUpO1xyXG5cclxuICAgIGNvbnN0IGluZGVudFNpZ24gPSB0aGlzLmRldGVjdExpc3RJbmRlbnRTaWduKGVkaXRvciwgY3Vyc29yKTtcclxuXHJcbiAgICBpZiAoaW5kZW50U2lnbiA9PT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgbGlzdFN0YXJ0TGluZSA9IGN1cnNvckxpbmU7XHJcbiAgICBjb25zdCBsaXN0U3RhcnRDaCA9IDA7XHJcbiAgICB3aGlsZSAobGlzdFN0YXJ0TGluZSA+PSAxKSB7XHJcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0U3RhcnRMaW5lIC0gMSk7XHJcbiAgICAgIGlmICghdGhpcy5nZXRMaXN0TGluZUluZm8obGluZSwgaW5kZW50U2lnbikpIHtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICBsaXN0U3RhcnRMaW5lLS07XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGxpc3RFbmRMaW5lID0gY3Vyc29yTGluZTtcclxuICAgIGxldCBsaXN0RW5kQ2ggPSBsaW5lLmxlbmd0aDtcclxuICAgIHdoaWxlIChsaXN0RW5kTGluZSA8IGVkaXRvci5saW5lQ291bnQoKSkge1xyXG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGlzdEVuZExpbmUgKyAxKTtcclxuICAgICAgaWYgKCF0aGlzLmdldExpc3RMaW5lSW5mbyhsaW5lLCBpbmRlbnRTaWduKSkge1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgIGxpc3RFbmRDaCA9IGxpbmUubGVuZ3RoO1xyXG4gICAgICBsaXN0RW5kTGluZSsrO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJvb3QgPSBuZXcgUm9vdChcclxuICAgICAgaW5kZW50U2lnbixcclxuICAgICAgeyBsaW5lOiBsaXN0U3RhcnRMaW5lLCBjaDogbGlzdFN0YXJ0Q2ggfSxcclxuICAgICAgeyBsaW5lOiBsaXN0RW5kTGluZSwgY2g6IGxpc3RFbmRDaCB9LFxyXG4gICAgICB7IGxpbmU6IGN1cnNvckxpbmUsIGNoOiBjdXJzb3JDaCB9XHJcbiAgICApO1xyXG5cclxuICAgIGxldCBjdXJyZW50TGV2ZWw6IElMaXN0ID0gcm9vdDtcclxuICAgIGxldCBsYXN0TGlzdDogSUxpc3QgPSByb290O1xyXG5cclxuICAgIGZvciAobGV0IGwgPSBsaXN0U3RhcnRMaW5lOyBsIDw9IGxpc3RFbmRMaW5lOyBsKyspIHtcclxuICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGwpO1xyXG4gICAgICBjb25zdCB7IGJ1bGxldCwgY29udGVudCwgaW5kZW50TGV2ZWwgfSA9IHRoaXMuZ2V0TGlzdExpbmVJbmZvKFxyXG4gICAgICAgIGxpbmUsXHJcbiAgICAgICAgaW5kZW50U2lnblxyXG4gICAgICApO1xyXG5cclxuICAgICAgaWYgKGluZGVudExldmVsID09PSBjdXJyZW50TGV2ZWwuZ2V0TGV2ZWwoKSArIDEpIHtcclxuICAgICAgICBjdXJyZW50TGV2ZWwgPSBsYXN0TGlzdDtcclxuICAgICAgfSBlbHNlIGlmIChpbmRlbnRMZXZlbCA8IGN1cnJlbnRMZXZlbC5nZXRMZXZlbCgpKSB7XHJcbiAgICAgICAgd2hpbGUgKGluZGVudExldmVsIDwgY3VycmVudExldmVsLmdldExldmVsKCkpIHtcclxuICAgICAgICAgIGN1cnJlbnRMZXZlbCA9IGN1cnJlbnRMZXZlbC5nZXRQYXJlbnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoaW5kZW50TGV2ZWwgIT0gY3VycmVudExldmVsLmdldExldmVsKCkpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBVbmFibGUgdG8gcGFyc2UgbGlzdGApO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBsaXN0ID0gbmV3IExpc3QoaW5kZW50U2lnbiwgYnVsbGV0LCBjb250ZW50KTtcclxuICAgICAgY3VycmVudExldmVsLmFkZChsaXN0KTtcclxuICAgICAgbGFzdExpc3QgPSBsaXN0O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByb290O1xyXG4gIH1cclxuXHJcbiAgaXRlcmF0ZVdoaWxlRm9sZGVkKFxyXG4gICAgZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcixcclxuICAgIHBvczogQ29kZU1pcnJvci5Qb3NpdGlvbixcclxuICAgIGluYzogKHBvczogQ29kZU1pcnJvci5Qb3NpdGlvbikgPT4gdm9pZFxyXG4gICkge1xyXG4gICAgbGV0IGZvbGRlZCA9IGZhbHNlO1xyXG4gICAgZG8ge1xyXG4gICAgICBpbmMocG9zKTtcclxuICAgICAgZm9sZGVkID0gKGVkaXRvciBhcyBhbnkpLmlzRm9sZGVkKHBvcyk7XHJcbiAgICB9IHdoaWxlIChmb2xkZWQpO1xyXG4gICAgcmV0dXJuIHBvcztcclxuICB9XHJcblxyXG4gIGdldExpc3RMaW5lSW5mbyhsaW5lOiBzdHJpbmcsIGluZGVudFNpZ246IHN0cmluZykge1xyXG4gICAgY29uc3QgcHJlZml4UmUgPSBuZXcgUmVnRXhwKGBeKD86JHtpbmRlbnRTaWdufSkqKFstKl0pIGApO1xyXG4gICAgY29uc3QgbWF0Y2hlcyA9IHByZWZpeFJlLmV4ZWMobGluZSk7XHJcblxyXG4gICAgaWYgKCFtYXRjaGVzKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHByZWZpeExlbmd0aCA9IG1hdGNoZXNbMF0ubGVuZ3RoO1xyXG4gICAgY29uc3QgYnVsbGV0ID0gbWF0Y2hlc1sxXTtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBsaW5lLnNsaWNlKHByZWZpeExlbmd0aCk7XHJcbiAgICBjb25zdCBpbmRlbnRMZXZlbCA9IChwcmVmaXhMZW5ndGggLSAyKSAvIGluZGVudFNpZ24ubGVuZ3RoO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIGJ1bGxldCxcclxuICAgICAgY29udGVudCxcclxuICAgICAgcHJlZml4TGVuZ3RoLFxyXG4gICAgICBpbmRlbnRMZXZlbCxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBpc0p1c3RDdXJzb3IoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgY29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5saXN0U2VsZWN0aW9ucygpO1xyXG5cclxuICAgIHJldHVybiBzZWxlY3Rpb25zLmxlbmd0aCA9PT0gMSAmJiByYW5nZUlzQ3Vyc29yKHNlbGVjdGlvbnNbMF0pO1xyXG4gIH1cclxuXHJcbiAgZXZhbEVuc3VyZUN1cnNvckluQ29udGVudChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBpbmRlbnRTaWduID0gdGhpcy5kZXRlY3RMaXN0SW5kZW50U2lnbihlZGl0b3IsIGN1cnNvcik7XHJcblxyXG4gICAgaWYgKGluZGVudFNpZ24gPT09IG51bGwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4ge1xyXG4gICAgICBjb25zdCBsaW5lU3RhcnRDdXJzb3IgPSBlZGl0b3IuY29vcmRzQ2hhcih7XHJcbiAgICAgICAgLi4uZWRpdG9yLmN1cnNvckNvb3JkcygpLFxyXG4gICAgICAgIGxlZnQ6IDAsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKGxpbmVTdGFydEN1cnNvci5saW5lICE9PSBjdXJzb3IubGluZSkge1xyXG4gICAgICAgIGVkaXRvci5zZXRDdXJzb3Ioe1xyXG4gICAgICAgICAgbGluZTogbGluZVN0YXJ0Q3Vyc29yLmxpbmUsXHJcbiAgICAgICAgICBjaDogZWRpdG9yLmdldExpbmUobGluZVN0YXJ0Q3Vyc29yLmxpbmUpLmxlbmd0aCxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGN1cnNvci5saW5lKTtcclxuICAgIGNvbnN0IGxpbmVQcmVmaXggPSB0aGlzLmdldExpc3RMaW5lSW5mbyhsaW5lLCBpbmRlbnRTaWduKS5wcmVmaXhMZW5ndGg7XHJcblxyXG4gICAgaWYgKGN1cnNvci5jaCA8IGxpbmVQcmVmaXgpIHtcclxuICAgICAgY3Vyc29yLmNoID0gbGluZVByZWZpeDtcclxuICAgICAgZWRpdG9yLnNldEN1cnNvcihjdXJzb3IpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXhlY3V0ZShcclxuICAgIGVkaXRvcjogQ29kZU1pcnJvci5FZGl0b3IsXHJcbiAgICBjYjogKHJvb3Q6IFJvb3QpID0+IGJvb2xlYW4sXHJcbiAgICBvcHRpb25zOiB7XHJcbiAgICAgIGZvcmNlPzogYm9vbGVhbjtcclxuICAgICAgY3Vyc29yPzogQ29kZU1pcnJvci5Qb3NpdGlvbjtcclxuICAgIH0gfCB2b2lkXHJcbiAgKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB7IGZvcmNlLCBjdXJzb3IgfSA9IHtcclxuICAgICAgZm9yY2U6IGZhbHNlLFxyXG4gICAgICBjdXJzb3I6IGVkaXRvci5nZXRDdXJzb3IoKSxcclxuICAgICAgLi4ub3B0aW9ucyxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgcm9vdCA9IHRoaXMucGFyc2VMaXN0KGVkaXRvciwgY3Vyc29yKTtcclxuXHJcbiAgICBpZiAoIXJvb3QpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IGNiKHJvb3QpO1xyXG5cclxuICAgIGlmIChmb3JjZSB8fCByZXN1bHQpIHtcclxuICAgICAgdGhpcy5hcHBseUNoYW5nZXMoZWRpdG9yLCByb290LCB7IGZvcmNlIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBhcHBseUNoYW5nZXMoXHJcbiAgICBlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yLFxyXG4gICAgcm9vdDogUm9vdCxcclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgZm9yY2U/OiBib29sZWFuO1xyXG4gICAgICBjdXJzb3I/OiBDb2RlTWlycm9yLlBvc2l0aW9uO1xyXG4gICAgfSB8IHZvaWRcclxuICApIHtcclxuICAgIGNvbnN0IHsgZm9yY2UgfSA9IHtcclxuICAgICAgZm9yY2U6IGZhbHNlLFxyXG4gICAgICAuLi5vcHRpb25zLFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBvbGRTdHJpbmcgPSBlZGl0b3IuZ2V0UmFuZ2Uocm9vdC5nZXRTdGFydCgpLCByb290LmdldEVuZCgpKTtcclxuICAgIGNvbnN0IG5ld1N0cmluZyA9IHJvb3QucHJpbnQoKTtcclxuXHJcbiAgICBjb25zdCBkaWZmID0gZGlmZkxpbmVzKG9sZFN0cmluZywgbmV3U3RyaW5nKTtcclxuICAgIGxldCBsID0gcm9vdC5nZXRTdGFydCgpLmxpbmU7XHJcbiAgICBmb3IgKGNvbnN0IGNoYW5nZSBvZiBkaWZmKSB7XHJcbiAgICAgIGlmIChjaGFuZ2UuYWRkZWQpIHtcclxuICAgICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGNoYW5nZS52YWx1ZSwgeyBsaW5lOiBsLCBjaDogMCB9KTtcclxuICAgICAgICBsICs9IGNoYW5nZS5jb3VudDtcclxuICAgICAgfSBlbHNlIGlmIChjaGFuZ2UucmVtb3ZlZCkge1xyXG4gICAgICAgIGNvbnN0IHdpdGhOZXdsaW5lID0gL1xcbiQvLnRlc3QoY2hhbmdlLnZhbHVlKTtcclxuICAgICAgICBjb25zdCB0aWxsTGluZSA9IHdpdGhOZXdsaW5lID8gbCArIGNoYW5nZS5jb3VudCA6IGwgKyBjaGFuZ2UuY291bnQgLSAxO1xyXG4gICAgICAgIGNvbnN0IHRpbGxDaCA9IHdpdGhOZXdsaW5lID8gMCA6IGVkaXRvci5nZXRMaW5lKHRpbGxMaW5lKS5sZW5ndGg7XHJcbiAgICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShcclxuICAgICAgICAgIFwiXCIsXHJcbiAgICAgICAgICB7IGxpbmU6IGwsIGNoOiAwIH0sXHJcbiAgICAgICAgICB7IGxpbmU6IHRpbGxMaW5lLCBjaDogdGlsbENoIH1cclxuICAgICAgICApO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGwgKz0gY2hhbmdlLmNvdW50O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgb2xkQ3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbmV3Q3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcclxuXHJcbiAgICBpZiAoXHJcbiAgICAgIGZvcmNlIHx8XHJcbiAgICAgIG9sZEN1cnNvci5saW5lICE9IG5ld0N1cnNvci5saW5lIHx8XHJcbiAgICAgIG9sZEN1cnNvci5jaCAhPSBuZXdDdXJzb3IuY2hcclxuICAgICkge1xyXG4gICAgICBlZGl0b3Iuc2V0Q3Vyc29yKG5ld0N1cnNvcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpc0N1cnNvckluTGlzdChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBpbmRlbnRTaWduID0gdGhpcy5kZXRlY3RMaXN0SW5kZW50U2lnbihlZGl0b3IsIGN1cnNvcik7XHJcbiAgICByZXR1cm4gaW5kZW50U2lnbiAhPT0gbnVsbDtcclxuICB9XHJcblxyXG4gIG1vdmVMaXN0RWxlbWVudERvd24oZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZShlZGl0b3IsIChyb290KSA9PiByb290Lm1vdmVEb3duKCkpO1xyXG4gIH1cclxuXHJcbiAgbW92ZUxpc3RFbGVtZW50VXAoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZShlZGl0b3IsIChyb290KSA9PiByb290Lm1vdmVVcCgpKTtcclxuICB9XHJcblxyXG4gIG1vdmVMaXN0RWxlbWVudFJpZ2h0KGVkaXRvcjogQ29kZU1pcnJvci5FZGl0b3IpIHtcclxuICAgIHJldHVybiB0aGlzLmV4ZWN1dGUoZWRpdG9yLCAocm9vdCkgPT4gcm9vdC5tb3ZlUmlnaHQoKSk7XHJcbiAgfVxyXG5cclxuICBtb3ZlTGlzdEVsZW1lbnRMZWZ0KGVkaXRvcjogQ29kZU1pcnJvci5FZGl0b3IpIHtcclxuICAgIHJldHVybiB0aGlzLmV4ZWN1dGUoZWRpdG9yLCAocm9vdCkgPT4gcm9vdC5tb3ZlTGVmdCgpKTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZShlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBpZiAoIXRoaXMuaXNKdXN0Q3Vyc29yKGVkaXRvcikpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlTGlzdChlZGl0b3IpO1xyXG5cclxuICAgIGlmICghcm9vdCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKFxyXG4gICAgICByb290LmdldFRvdGFsTGluZXMoKSA9PT0gMSAmJlxyXG4gICAgICByb290LmdldENoaWxkcmVuKClbMF0uZ2V0Q29udGVudCgpLmxlbmd0aCA9PT0gMFxyXG4gICAgKSB7XHJcbiAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoXCJcIiwgcm9vdC5nZXRTdGFydCgpLCByb290LmdldEVuZCgpKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVzID0gcm9vdC5kZWxldGUoKTtcclxuXHJcbiAgICBpZiAocmVzKSB7XHJcbiAgICAgIHRoaXMuYXBwbHlDaGFuZ2VzKGVkaXRvciwgcm9vdCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlcztcclxuICB9XHJcblxyXG4gIGRlbGV0ZU5leHQoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgaWYgKCF0aGlzLmlzSnVzdEN1cnNvcihlZGl0b3IpKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZUxpc3QoZWRpdG9yKTtcclxuXHJcbiAgICBpZiAoIXJvb3QpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldEN1cnNvck9uTGlzdCgpO1xyXG4gICAgY29uc3QgbmV4dExpbmVObyA9IHJvb3QuZ2V0Q3Vyc29yKCkubGluZSArIDE7XHJcbiAgICBjb25zdCBuZXh0TGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShuZXh0TGluZU5vKTtcclxuXHJcbiAgICBpZiAoIW5leHRMaXN0IHx8IHJvb3QuZ2V0Q3Vyc29yKCkuY2ggIT09IGxpc3QuZ2V0Q29udGVudEVuZENoKCkpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XHJcbiAgICAgIGxpbmU6IG5leHRMaW5lTm8sXHJcbiAgICAgIGNoOiBuZXh0TGlzdC5nZXRDb250ZW50U3RhcnRDaCgpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVzID0gcm9vdC5kZWxldGUoKTtcclxuICAgIGNvbnN0IHJlYWxseUNoYW5nZWQgPSByb290LmdldEN1cnNvcigpLmxpbmUgIT09IG5leHRMaW5lTm87XHJcblxyXG4gICAgaWYgKHJlYWxseUNoYW5nZWQpIHtcclxuICAgICAgdGhpcy5hcHBseUNoYW5nZXMoZWRpdG9yLCByb290KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzO1xyXG4gIH1cclxuXHJcbiAgZGVsZXRlRnVsbExlZnQoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmxpc3RTZWxlY3Rpb25zKClbMF07XHJcblxyXG4gICAgaWYgKCFyYW5nZUlzQ3Vyc29yKHNlbGVjdGlvbikpIHtcclxuICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShcIlwiLCBzZWxlY3Rpb24uZnJvbSgpLCBzZWxlY3Rpb24udG8oKSk7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzLmV4ZWN1dGUoZWRpdG9yLCAocm9vdCkgPT4gcm9vdC5kZWxldGVGdWxsTGVmdCgpKTtcclxuICB9XHJcblxyXG4gIHNldEZvbGQoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvciwgdHlwZTogXCJmb2xkXCIgfCBcInVuZm9sZFwiKSB7XHJcbiAgICBpZiAoIXRoaXMuaXNDdXJzb3JJbkxpc3QoZWRpdG9yKSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgKGVkaXRvciBhcyBhbnkpLmZvbGRDb2RlKGVkaXRvci5nZXRDdXJzb3IoKSwgbnVsbCwgdHlwZSk7XHJcblxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICBmb2xkKGVkaXRvcjogQ29kZU1pcnJvci5FZGl0b3IpIHtcclxuICAgIHJldHVybiB0aGlzLnNldEZvbGQoZWRpdG9yLCBcImZvbGRcIik7XHJcbiAgfVxyXG5cclxuICB1bmZvbGQoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgcmV0dXJuIHRoaXMuc2V0Rm9sZChlZGl0b3IsIFwidW5mb2xkXCIpO1xyXG4gIH1cclxuXHJcbiAgY3Vyc29yTGVmdChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBpbmRlbnRTaWduID0gdGhpcy5kZXRlY3RMaXN0SW5kZW50U2lnbihlZGl0b3IsIGN1cnNvcik7XHJcblxyXG4gICAgaWYgKGluZGVudFNpZ24gPT09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShjdXJzb3IubGluZSk7XHJcbiAgICBjb25zdCBsaW5lUHJlZml4ID0gdGhpcy5nZXRMaXN0TGluZUluZm8obGluZSwgaW5kZW50U2lnbikucHJlZml4TGVuZ3RoO1xyXG5cclxuICAgIGlmIChjdXJzb3IuY2ggPiBsaW5lUHJlZml4KSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBuZXdDdXJzb3IgPSB0aGlzLml0ZXJhdGVXaGlsZUZvbGRlZChcclxuICAgICAgZWRpdG9yLFxyXG4gICAgICB7XHJcbiAgICAgICAgbGluZTogY3Vyc29yLmxpbmUsXHJcbiAgICAgICAgY2g6IDAsXHJcbiAgICAgIH0sXHJcbiAgICAgIChwb3MpID0+IHtcclxuICAgICAgICBwb3MubGluZS0tO1xyXG4gICAgICAgIHBvcy5jaCA9IGVkaXRvci5nZXRMaW5lKHBvcy5saW5lKS5sZW5ndGggLSAxO1xyXG4gICAgICB9XHJcbiAgICApO1xyXG4gICAgbmV3Q3Vyc29yLmNoKys7XHJcbiAgICBlZGl0b3Iuc2V0Q3Vyc29yKG5ld0N1cnNvcik7XHJcblxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICBzZWxlY3RGdWxsTGVmdChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZUxpc3QoZWRpdG9yLCBjdXJzb3IpO1xyXG5cclxuICAgIGlmICghcm9vdCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0Q3Vyc29yT25MaXN0KCk7XHJcbiAgICBjb25zdCBzdGFydENoID0gbGlzdC5nZXRDb250ZW50U3RhcnRDaCgpO1xyXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmxpc3RTZWxlY3Rpb25zKClbMF07XHJcblxyXG4gICAgZWRpdG9yLnNldFNlbGVjdGlvbihzZWxlY3Rpb24uYW5jaG9yLCB7XHJcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lLFxyXG4gICAgICBjaDogc3RhcnRDaCxcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgem9vbU91dChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBjb25zdCB6b29tU3RhdGUgPSB0aGlzLnpvb21TdGF0ZXMuZ2V0KGVkaXRvcik7XHJcblxyXG4gICAgaWYgKCF6b29tU3RhdGUpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAobGV0IGkgPSBlZGl0b3IuZmlyc3RMaW5lKCksIGwgPSBlZGl0b3IubGFzdExpbmUoKTsgaSA8PSBsOyBpKyspIHtcclxuICAgICAgZWRpdG9yLnJlbW92ZUxpbmVDbGFzcyhpLCBcIndyYXBcIiwgXCJvdXRsaW5lci1wbHVnaW4taGlkZGVuLXJvd1wiKTtcclxuICAgIH1cclxuXHJcbiAgICB6b29tU3RhdGUuaGVhZGVyLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoem9vbVN0YXRlLmhlYWRlcik7XHJcblxyXG4gICAgdGhpcy56b29tU3RhdGVzLmRlbGV0ZShlZGl0b3IpO1xyXG5cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgem9vbUluKFxyXG4gICAgZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcixcclxuICAgIGN1cnNvcjogQ29kZU1pcnJvci5Qb3NpdGlvbiA9IGVkaXRvci5nZXRDdXJzb3IoKVxyXG4gICkge1xyXG4gICAgY29uc3QgbGluZU5vID0gY3Vyc29yLmxpbmU7XHJcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZUxpc3QoZWRpdG9yLCBjdXJzb3IpO1xyXG5cclxuICAgIGlmICghcm9vdCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy56b29tT3V0KGVkaXRvcik7XHJcblxyXG4gICAgY29uc3QgeyBpbmRlbnRMZXZlbCB9ID0gdGhpcy5nZXRMaXN0TGluZUluZm8oXHJcbiAgICAgIGVkaXRvci5nZXRMaW5lKGxpbmVObyksXHJcbiAgICAgIHJvb3QuZ2V0SW5kZW50U2lnbigpXHJcbiAgICApO1xyXG5cclxuICAgIGxldCBhZnRlciA9IGZhbHNlO1xyXG4gICAgZm9yIChsZXQgaSA9IGVkaXRvci5maXJzdExpbmUoKSwgbCA9IGVkaXRvci5sYXN0TGluZSgpOyBpIDw9IGw7IGkrKykge1xyXG4gICAgICBpZiAoaSA8IGxpbmVObykge1xyXG4gICAgICAgIGVkaXRvci5hZGRMaW5lQ2xhc3MoaSwgXCJ3cmFwXCIsIFwib3V0bGluZXItcGx1Z2luLWhpZGRlbi1yb3dcIik7XHJcbiAgICAgIH0gZWxzZSBpZiAoaSA+IGxpbmVObyAmJiAhYWZ0ZXIpIHtcclxuICAgICAgICBjb25zdCBhZnRlckxpbmVJbmZvID0gdGhpcy5nZXRMaXN0TGluZUluZm8oXHJcbiAgICAgICAgICBlZGl0b3IuZ2V0TGluZShpKSxcclxuICAgICAgICAgIHJvb3QuZ2V0SW5kZW50U2lnbigpXHJcbiAgICAgICAgKTtcclxuICAgICAgICBhZnRlciA9ICFhZnRlckxpbmVJbmZvIHx8IGFmdGVyTGluZUluZm8uaW5kZW50TGV2ZWwgPD0gaW5kZW50TGV2ZWw7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChhZnRlcikge1xyXG4gICAgICAgIGVkaXRvci5hZGRMaW5lQ2xhc3MoaSwgXCJ3cmFwXCIsIFwib3V0bGluZXItcGx1Z2luLWhpZGRlbi1yb3dcIik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjcmVhdGVTZXBhcmF0b3IgPSAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcclxuICAgICAgc3Bhbi50ZXh0Q29udGVudCA9IFwiID4gXCI7XHJcbiAgICAgIHJldHVybiBzcGFuO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBjcmVhdGVUaXRsZSA9IChjb250ZW50OiBzdHJpbmcsIGNiOiAoKSA9PiB2b2lkKSA9PiB7XHJcbiAgICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICAgICAgYS5jbGFzc05hbWUgPSBcIm91dGxpbmVyLXBsdWdpbi16b29tLXRpdGxlXCI7XHJcbiAgICAgIGlmIChjb250ZW50KSB7XHJcbiAgICAgICAgYS50ZXh0Q29udGVudCA9IGNvbnRlbnQ7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYS5pbm5lckhUTUwgPSBcIiZuYnNwOyZuYnNwOyZuYnNwOyZuYnNwOyZuYnNwO1wiO1xyXG4gICAgICB9XHJcbiAgICAgIGEub25jbGljayA9IChlKSA9PiB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNiKCk7XHJcbiAgICAgIH07XHJcbiAgICAgIHJldHVybiBhO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBjcmVhdGVIZWFkZXIgPSAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgIGRpdi5jbGFzc05hbWUgPSBcIm91dGxpbmVyLXBsdWdpbi16b29tLWhlYWRlclwiO1xyXG5cclxuICAgICAgbGV0IGxpc3QgPSByb290LmdldExpc3RVbmRlckxpbmUobGluZU5vKS5nZXRQYXJlbnQoKTtcclxuICAgICAgd2hpbGUgKGxpc3QgJiYgbGlzdC5nZXRQYXJlbnQoKSkge1xyXG4gICAgICAgIGNvbnN0IGxpbmVObyA9IHJvb3QuZ2V0TGluZU51bWJlcihsaXN0KTtcclxuICAgICAgICBkaXYucHJlcGVuZChcclxuICAgICAgICAgIGNyZWF0ZVRpdGxlKGxpc3QuZ2V0Q29udGVudCgpLCAoKSA9PlxyXG4gICAgICAgICAgICB0aGlzLnpvb21JbihlZGl0b3IsIHsgbGluZTogbGluZU5vLCBjaDogMCB9KVxyXG4gICAgICAgICAgKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgZGl2LnByZXBlbmQoY3JlYXRlU2VwYXJhdG9yKCkpO1xyXG4gICAgICAgIGxpc3QgPSBsaXN0LmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBkaXYucHJlcGVuZChcclxuICAgICAgICBjcmVhdGVUaXRsZSh0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZi5nZXREaXNwbGF5VGV4dCgpLCAoKSA9PlxyXG4gICAgICAgICAgdGhpcy56b29tT3V0KGVkaXRvcilcclxuICAgICAgICApXHJcbiAgICAgICk7XHJcblxyXG4gICAgICByZXR1cm4gZGl2O1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCB6b29tSGVhZGVyID0gY3JlYXRlSGVhZGVyKCk7XHJcbiAgICBlZGl0b3IuZ2V0V3JhcHBlckVsZW1lbnQoKS5wcmVwZW5kKHpvb21IZWFkZXIpO1xyXG5cclxuICAgIHRoaXMuem9vbVN0YXRlcy5zZXQoXHJcbiAgICAgIGVkaXRvcixcclxuICAgICAgbmV3IFpvb21TdGF0ZShlZGl0b3IuZ2V0TGluZUhhbmRsZShsaW5lTm8pLCB6b29tSGVhZGVyKVxyXG4gICAgKTtcclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHNlbGVjdEFsbChlZGl0b3I6IENvZGVNaXJyb3IuRWRpdG9yKSB7XHJcbiAgICBjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmxpc3RTZWxlY3Rpb25zKCk7XHJcblxyXG4gICAgaWYgKHNlbGVjdGlvbnMubGVuZ3RoICE9PSAxKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzZWxlY3Rpb24gPSBzZWxlY3Rpb25zWzBdO1xyXG5cclxuICAgIGlmIChzZWxlY3Rpb24uYW5jaG9yLmxpbmUgIT09IHNlbGVjdGlvbi5oZWFkLmxpbmUpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlTGlzdChlZGl0b3IsIHNlbGVjdGlvbi5hbmNob3IpO1xyXG5cclxuICAgIGlmICghcm9vdCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0Q3Vyc29yT25MaXN0KCk7XHJcbiAgICBjb25zdCBzdGFydENoID0gbGlzdC5nZXRDb250ZW50U3RhcnRDaCgpO1xyXG4gICAgY29uc3QgZW5kQ2ggPSBsaXN0LmdldENvbnRlbnRFbmRDaCgpO1xyXG5cclxuICAgIGlmIChzZWxlY3Rpb24uZnJvbSgpLmNoID09PSBzdGFydENoICYmIHNlbGVjdGlvbi50bygpLmNoID09PSBlbmRDaCkge1xyXG4gICAgICAvLyBzZWxlY3QgYWxsIGxpc3RcclxuICAgICAgZWRpdG9yLnNldFNlbGVjdGlvbihyb290LmdldFN0YXJ0KCksIHJvb3QuZ2V0RW5kKCkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gc2VsZWN0IGFsbCBsaW5lXHJcbiAgICAgIGVkaXRvci5zZXRTZWxlY3Rpb24oXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgbGluZTogc2VsZWN0aW9uLmFuY2hvci5saW5lLFxyXG4gICAgICAgICAgY2g6IHN0YXJ0Q2gsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBsaW5lOiBzZWxlY3Rpb24uYW5jaG9yLmxpbmUsXHJcbiAgICAgICAgICBjaDogZW5kQ2gsXHJcbiAgICAgICAgfVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgb3V0ZGVudElmTGluZUlzRW1wdHkoZWRpdG9yOiBDb2RlTWlycm9yLkVkaXRvcikge1xyXG4gICAgaWYgKCF0aGlzLmlzSnVzdEN1cnNvcihlZGl0b3IpKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZUxpc3QoZWRpdG9yKTtcclxuXHJcbiAgICBpZiAoIXJvb3QpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldEN1cnNvck9uTGlzdCgpO1xyXG5cclxuICAgIGlmIChsaXN0LmdldENvbnRlbnQoKS5sZW5ndGggPiAwIHx8IGxpc3QuZ2V0TGV2ZWwoKSA9PT0gMSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcm9vdC5tb3ZlTGVmdCgpO1xyXG5cclxuICAgIHRoaXMuYXBwbHlDaGFuZ2VzKGVkaXRvciwgcm9vdCk7XHJcblxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICBoYW5kbGVLZXlkb3duID0gKGNtOiBDb2RlTWlycm9yLkVkaXRvciwgZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xyXG4gICAgbGV0IHdvcmtlZCA9IGZhbHNlO1xyXG4gICAgY29uc3QgbWV0YUtleSA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIgPyBcImNtZFwiIDogXCJjdHJsXCI7XHJcblxyXG4gICAgaWYgKHRlc3RLZXlkb3duKGUsIFwiVGFiXCIsIFtcInNoaWZ0XCJdKSkge1xyXG4gICAgICB3b3JrZWQgPSB0aGlzLm1vdmVMaXN0RWxlbWVudExlZnQoY20pO1xyXG4gICAgfSBlbHNlIGlmICh0ZXN0S2V5ZG93bihlLCBcIlRhYlwiKSkge1xyXG4gICAgICB3b3JrZWQgPSB0aGlzLm1vdmVMaXN0RWxlbWVudFJpZ2h0KGNtKTtcclxuICAgIH0gZWxzZSBpZiAodGVzdEtleWRvd24oZSwgXCJBcnJvd1VwXCIsIFtcInNoaWZ0XCIsIG1ldGFLZXldKSkge1xyXG4gICAgICB3b3JrZWQgPSB0aGlzLm1vdmVMaXN0RWxlbWVudFVwKGNtKTtcclxuICAgIH0gZWxzZSBpZiAodGVzdEtleWRvd24oZSwgXCJBcnJvd0Rvd25cIiwgW1wic2hpZnRcIiwgbWV0YUtleV0pKSB7XHJcbiAgICAgIHdvcmtlZCA9IHRoaXMubW92ZUxpc3RFbGVtZW50RG93bihjbSk7XHJcbiAgICB9IGVsc2UgaWYgKHRlc3RLZXlkb3duKGUsIFwiQXJyb3dVcFwiLCBbbWV0YUtleV0pKSB7XHJcbiAgICAgIHdvcmtlZCA9IHRoaXMuZm9sZChjbSk7XHJcbiAgICB9IGVsc2UgaWYgKHRlc3RLZXlkb3duKGUsIFwiQXJyb3dEb3duXCIsIFttZXRhS2V5XSkpIHtcclxuICAgICAgd29ya2VkID0gdGhpcy51bmZvbGQoY20pO1xyXG4gICAgfSBlbHNlIGlmICh0ZXN0S2V5ZG93bihlLCBcIkFycm93TGVmdFwiKSkge1xyXG4gICAgICB3b3JrZWQgPSB0aGlzLmN1cnNvckxlZnQoY20pO1xyXG4gICAgfSBlbHNlIGlmICh0ZXN0S2V5ZG93bihlLCBcIkJhY2tzcGFjZVwiLCBbbWV0YUtleV0pKSB7XHJcbiAgICAgIHdvcmtlZCA9IHRoaXMuZGVsZXRlRnVsbExlZnQoY20pO1xyXG4gICAgfSBlbHNlIGlmICh0ZXN0S2V5ZG93bihlLCBcIkJhY2tzcGFjZVwiKSkge1xyXG4gICAgICB3b3JrZWQgPSB0aGlzLmRlbGV0ZShjbSk7XHJcbiAgICB9IGVsc2UgaWYgKHRlc3RLZXlkb3duKGUsIFwiRGVsZXRlXCIpKSB7XHJcbiAgICAgIHdvcmtlZCA9IHRoaXMuZGVsZXRlTmV4dChjbSk7XHJcbiAgICB9IGVsc2UgaWYgKHRlc3RLZXlkb3duKGUsIFwiQXJyb3dMZWZ0XCIsIFttZXRhS2V5LCBcInNoaWZ0XCJdKSkge1xyXG4gICAgICB3b3JrZWQgPSB0aGlzLnNlbGVjdEZ1bGxMZWZ0KGNtKTtcclxuICAgIH0gZWxzZSBpZiAodGVzdEtleWRvd24oZSwgXCJLZXlBXCIsIFttZXRhS2V5XSkpIHtcclxuICAgICAgd29ya2VkID0gdGhpcy5zZWxlY3RBbGwoY20pO1xyXG4gICAgfSBlbHNlIGlmICh0ZXN0S2V5ZG93bihlLCBcIkVudGVyXCIpKSB7XHJcbiAgICAgIHdvcmtlZCA9IHRoaXMub3V0ZGVudElmTGluZUlzRW1wdHkoY20pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh3b3JrZWQpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICB9XHJcblxyXG4gIGFkZExpc3RzU3R5bGVzKCkge1xyXG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWJsc1wiKTtcclxuXHJcbiAgICBjb25zdCB0ZXh0ID0gKHNpemU6IG51bWJlcikgPT5cclxuICAgICAgYE91dGxpbmVyIHN0eWxlcyBkb2Vzbid0IHdvcmsgd2l0aCAke3NpemV9LXNwYWNlcy10YWJzLiBQbGVhc2UgY2hlY2sgeW91ciBPYnNpZGlhbiBzZXR0aW5ncy5gO1xyXG5cclxuICAgIGNvbnN0IGl0ZW0gPSB0aGlzLmFkZFN0YXR1c0Jhckl0ZW0oKTtcclxuICAgIGl0ZW0uc3R5bGUuY29sb3IgPSBcInJlZFwiO1xyXG4gICAgaXRlbS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcblxyXG4gICAgbGV0IHZpc2libGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbChcclxuICAgICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICBjb25zdCB7IHVzZVRhYiwgdGFiU2l6ZSB9ID0gdGhpcy5nZXRPYnNpZGlhblRhYnNTZXR0aWducygpO1xyXG5cclxuICAgICAgICBjb25zdCBzaG91bGRCZVZpc2libGUgPSB1c2VUYWIgJiYgdGFiU2l6ZSAhPT0gNDtcclxuXHJcbiAgICAgICAgaWYgKHNob3VsZEJlVmlzaWJsZSAmJiB2aXNpYmxlICE9PSB0YWJTaXplKSB7XHJcbiAgICAgICAgICBpdGVtLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XHJcbiAgICAgICAgICBpdGVtLnNldFRleHQodGV4dCh0YWJTaXplKSk7XHJcbiAgICAgICAgICB2aXNpYmxlID0gdGFiU2l6ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKCFzaG91bGRCZVZpc2libGUgJiYgdmlzaWJsZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgaXRlbS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICAgICAgICB2aXNpYmxlID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgIH0sIDEwMDApXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlTGlzdHNTdHlsZXMoKSB7XHJcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoXCJvdXRsaW5lci1wbHVnaW4tYmxzXCIpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgY29uc29sZS5sb2coYExvYWRpbmcgb2JzaWRpYW4tb3V0bGluZXJgKTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5zdHlsZUxpc3RzKSB7XHJcbiAgICAgIHRoaXMuYWRkTGlzdHNTdHlsZXMoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJ6b29tLWluXCIsXHJcbiAgICAgIG5hbWU6IFwiWm9vbSBJblwiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG5cclxuICAgICAgICBpZiAoIXZpZXcpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuem9vbUluKHZpZXcuc291cmNlTW9kZS5jbUVkaXRvcik7XHJcbiAgICAgIH0sXHJcbiAgICAgIGhvdGtleXM6IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiXSxcclxuICAgICAgICAgIGtleTogXCIuXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcInpvb20tb3V0XCIsXHJcbiAgICAgIG5hbWU6IFwiWm9vbSBPdXRcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICAgICAgaWYgKCF2aWV3KSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnpvb21PdXQodmlldy5zb3VyY2VNb2RlLmNtRWRpdG9yKTtcclxuICAgICAgfSxcclxuICAgICAgaG90a2V5czogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIG1vZGlmaWVyczogW1wiTW9kXCIsIFwiU2hpZnRcIl0sXHJcbiAgICAgICAgICBrZXk6IFwiLlwiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyQ29kZU1pcnJvcigoY20pID0+IHtcclxuICAgICAgY20ub24oXCJiZWZvcmVDaGFuZ2VcIiwgKGNtLCBjaGFuZ2VPYmopID0+IHtcclxuICAgICAgICBjb25zdCB6b29tU3RhdGUgPSB0aGlzLnpvb21TdGF0ZXMuZ2V0KGNtKTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgIXpvb21TdGF0ZSB8fFxyXG4gICAgICAgICAgY2hhbmdlT2JqLm9yaWdpbiAhPT0gXCJzZXRWYWx1ZVwiIHx8XHJcbiAgICAgICAgICBjaGFuZ2VPYmouZnJvbS5saW5lICE9PSAwIHx8XHJcbiAgICAgICAgICBjaGFuZ2VPYmouZnJvbS5jaCAhPT0gMFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdGlsbExpbmUgPSBjbS5sYXN0TGluZSgpO1xyXG4gICAgICAgIGNvbnN0IHRpbGxDaCA9IGNtLmdldExpbmUodGlsbExpbmUpLmxlbmd0aDtcclxuXHJcbiAgICAgICAgaWYgKGNoYW5nZU9iai50by5saW5lICE9PSB0aWxsTGluZSB8fCBjaGFuZ2VPYmoudG8uY2ggIT09IHRpbGxDaCkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy56b29tT3V0KGNtKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjbS5vbihcImNoYW5nZVwiLCAoY20sIGNoYW5nZU9iaikgPT4ge1xyXG4gICAgICAgIGNvbnN0IHpvb21TdGF0ZSA9IHRoaXMuem9vbVN0YXRlcy5nZXQoY20pO1xyXG5cclxuICAgICAgICBpZiAoIXpvb21TdGF0ZSB8fCBjaGFuZ2VPYmoub3JpZ2luICE9PSBcInNldFZhbHVlXCIpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuem9vbUluKGNtLCB7XHJcbiAgICAgICAgICBsaW5lOiBjbS5nZXRMaW5lTnVtYmVyKHpvb21TdGF0ZS5saW5lKSxcclxuICAgICAgICAgIGNoOiAwLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNtLm9uKFwiYmVmb3JlQ2hhbmdlXCIsIChjbSwgY2hhbmdlT2JqKSA9PiB7XHJcbiAgICAgICAgY29uc3QgY3VycmVudExpbmUgPSBjbS5nZXRMaW5lKGNoYW5nZU9iai5mcm9tLmxpbmUpO1xyXG4gICAgICAgIGNvbnN0IG5leHRMaW5lID0gY20uZ2V0TGluZShjaGFuZ2VPYmouZnJvbS5saW5lICsgMSk7XHJcblxyXG4gICAgICAgIGlmICghY3VycmVudExpbmUgfHwgIW5leHRMaW5lKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBpbmRlbnRTaWduID0gdGhpcy5kZXRlY3RMaXN0SW5kZW50U2lnbihjbSwgY2hhbmdlT2JqLmZyb20pO1xyXG5cclxuICAgICAgICBpZiAoaW5kZW50U2lnbiA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgY3VycmVudExpbmVJbmZvID0gdGhpcy5nZXRMaXN0TGluZUluZm8oY3VycmVudExpbmUsIGluZGVudFNpZ24pO1xyXG4gICAgICAgIGNvbnN0IG5leHRMaW5lSW5mbyA9IHRoaXMuZ2V0TGlzdExpbmVJbmZvKG5leHRMaW5lLCBpbmRlbnRTaWduKTtcclxuXHJcbiAgICAgICAgaWYgKCFjdXJyZW50TGluZUluZm8gfHwgIW5leHRMaW5lSW5mbykge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgY2hhbmdlSXNOZXdsaW5lID1cclxuICAgICAgICAgIGNoYW5nZU9iai50ZXh0Lmxlbmd0aCA9PT0gMiAmJlxyXG4gICAgICAgICAgY2hhbmdlT2JqLnRleHRbMF0gPT09IFwiXCIgJiZcclxuICAgICAgICAgICEhdGhpcy5nZXRMaXN0TGluZUluZm8oY2hhbmdlT2JqLnRleHRbMV0sIGluZGVudFNpZ24pO1xyXG4gICAgICAgIGNvbnN0IG5leGxpbmVMZXZlbElzQmlnZ2VyID1cclxuICAgICAgICAgIGN1cnJlbnRMaW5lSW5mby5pbmRlbnRMZXZlbCArIDEgPT0gbmV4dExpbmVJbmZvLmluZGVudExldmVsO1xyXG4gICAgICAgIGNvbnN0IG5leHRMaW5lSXNFbXB0eSA9XHJcbiAgICAgICAgICBjbS5nZXRSYW5nZShjaGFuZ2VPYmouZnJvbSwge1xyXG4gICAgICAgICAgICBsaW5lOiBjaGFuZ2VPYmouZnJvbS5saW5lLFxyXG4gICAgICAgICAgICBjaDogY2hhbmdlT2JqLmZyb20uY2ggKyAxLFxyXG4gICAgICAgICAgfSkubGVuZ3RoID09PSAwO1xyXG5cclxuICAgICAgICBpZiAoY2hhbmdlSXNOZXdsaW5lICYmIG5leGxpbmVMZXZlbElzQmlnZ2VyICYmIG5leHRMaW5lSXNFbXB0eSkge1xyXG4gICAgICAgICAgY2hhbmdlT2JqLnRleHRbMV0gPSBpbmRlbnRTaWduICsgY2hhbmdlT2JqLnRleHRbMV07XHJcbiAgICAgICAgICBjaGFuZ2VPYmoudXBkYXRlKGNoYW5nZU9iai5mcm9tLCBjaGFuZ2VPYmoudG8sIGNoYW5nZU9iai50ZXh0KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY20ub24oXCJiZWZvcmVTZWxlY3Rpb25DaGFuZ2VcIiwgKGNtLCBjaGFuZ2VPYmopID0+IHtcclxuICAgICAgICBpZiAoIXRoaXMuem9vbVN0YXRlcy5oYXMoY20pKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdmlzaWJsZUZyb206IENvZGVNaXJyb3IuUG9zaXRpb24gfCBudWxsID0gbnVsbDtcclxuICAgICAgICBsZXQgdmlzaWJsZVRpbGw6IENvZGVNaXJyb3IuUG9zaXRpb24gfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IGNtLmZpcnN0TGluZSgpOyBpIDw9IGNtLmxhc3RMaW5lKCk7IGkrKykge1xyXG4gICAgICAgICAgY29uc3Qgd3JhcENsYXNzID0gY20ubGluZUluZm8oaSkud3JhcENsYXNzIHx8IFwiXCI7XHJcbiAgICAgICAgICBjb25zdCBpc0hpZGRlbiA9IHdyYXBDbGFzcy5pbmNsdWRlcyhcIm91dGxpbmVyLXBsdWdpbi1oaWRkZW4tcm93XCIpO1xyXG4gICAgICAgICAgaWYgKHZpc2libGVGcm9tID09PSBudWxsICYmICFpc0hpZGRlbikge1xyXG4gICAgICAgICAgICB2aXNpYmxlRnJvbSA9IHsgbGluZTogaSwgY2g6IDAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICh2aXNpYmxlRnJvbSAhPT0gbnVsbCAmJiB2aXNpYmxlVGlsbCAhPT0gbnVsbCAmJiBpc0hpZGRlbikge1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICh2aXNpYmxlRnJvbSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB2aXNpYmxlVGlsbCA9IHsgbGluZTogaSwgY2g6IGNtLmdldExpbmUoaSkubGVuZ3RoIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHJhbmdlIG9mIGNoYW5nZU9iai5yYW5nZXMpIHtcclxuICAgICAgICAgIGlmIChyYW5nZS5hbmNob3IubGluZSA8IHZpc2libGVGcm9tLmxpbmUpIHtcclxuICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIHJhbmdlLmFuY2hvci5saW5lID0gdmlzaWJsZUZyb20ubGluZTtcclxuICAgICAgICAgICAgcmFuZ2UuYW5jaG9yLmNoID0gdmlzaWJsZUZyb20uY2g7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAocmFuZ2UuYW5jaG9yLmxpbmUgPiB2aXNpYmxlVGlsbC5saW5lKSB7XHJcbiAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICByYW5nZS5hbmNob3IubGluZSA9IHZpc2libGVUaWxsLmxpbmU7XHJcbiAgICAgICAgICAgIHJhbmdlLmFuY2hvci5jaCA9IHZpc2libGVUaWxsLmNoO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKHJhbmdlLmhlYWQubGluZSA8IHZpc2libGVGcm9tLmxpbmUpIHtcclxuICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIHJhbmdlLmhlYWQubGluZSA9IHZpc2libGVGcm9tLmxpbmU7XHJcbiAgICAgICAgICAgIHJhbmdlLmhlYWQuY2ggPSB2aXNpYmxlRnJvbS5jaDtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmIChyYW5nZS5oZWFkLmxpbmUgPiB2aXNpYmxlVGlsbC5saW5lKSB7XHJcbiAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICByYW5nZS5oZWFkLmxpbmUgPSB2aXNpYmxlVGlsbC5saW5lO1xyXG4gICAgICAgICAgICByYW5nZS5oZWFkLmNoID0gdmlzaWJsZVRpbGwuY2g7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgICAgY2hhbmdlT2JqLnVwZGF0ZShjaGFuZ2VPYmoucmFuZ2VzKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY20ub24oXCJjdXJzb3JBY3Rpdml0eVwiLCAoY20pID0+IHtcclxuICAgICAgICBpZiAodGhpcy5pc0p1c3RDdXJzb3IoY20pICYmIHRoaXMuaXNDdXJzb3JJbkxpc3QoY20pKSB7XHJcbiAgICAgICAgICB0aGlzLmV2YWxFbnN1cmVDdXJzb3JJbkNvbnRlbnQoY20pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjbS5vbihcImtleWRvd25cIiwgdGhpcy5oYW5kbGVLZXlkb3duKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb251bmxvYWQoKSB7XHJcbiAgICBjb25zb2xlLmxvZyhgVW5sb2FkaW5nIG9ic2lkaWFuLW91dGxpbmVyYCk7XHJcblxyXG4gICAgdGhpcy5yZW1vdmVMaXN0c1N0eWxlcygpO1xyXG5cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5pdGVyYXRlQ29kZU1pcnJvcnMoKGNtKSA9PiB7XHJcbiAgICAgIGNtLm9mZihcImtleWRvd25cIiwgdGhpcy5oYW5kbGVLZXlkb3duKTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuY2xhc3MgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICBwbHVnaW46IE9ic2lkaWFuT3V0bGluZXJQbHVnaW47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE9ic2lkaWFuT3V0bGluZXJQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gIH1cclxuXHJcbiAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgIGxldCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG5cclxuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiU3R5bGUgbGlzdHNcIilcclxuICAgICAgLnNldERlc2MoXHJcbiAgICAgICAgXCJFbmFibGUgYmV0dGVyIGxpc3RzIHN0eWxlcyAod29ya3Mgd2VsbCBvbmx5IHdpdGggc3BhY2VzIG9yIDQtc3BhY2VzLXRhYnMpXCJcclxuICAgICAgKVxyXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcclxuICAgICAgICB0b2dnbGVcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zdHlsZUxpc3RzKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zdHlsZUxpc3RzID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5hZGRMaXN0c1N0eWxlcygpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlbW92ZUxpc3RzU3R5bGVzKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkRlYnVnIG1vZGVcIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcclxuICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlYnVnKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWJ1ZyA9IHZhbHVlO1xyXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXSwibmFtZXMiOlsiUGx1Z2luIiwiTWFya2Rvd25WaWV3IiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMs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
