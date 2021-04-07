'use strict';

var obsidian = require('obsidian');
var child_process = require('child_process');
var util = require('util');

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

const DEFAULT_SETTINGS = {
    command_timeout: 5,
    template_folder: "",
    templates_pairs: [["", ""]],
};
class TemplaterSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.app = app;
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        // TODO: Remove this
        let notice_fragment = document.createDocumentFragment();
        let notice_div = notice_fragment.createEl("div");
        notice_div.innerHTML = `What? Templater is <b>evolving</b>!<br/>
The template syntax changed in this release, check out the new documentation for it on <a href="https://github.com/SilentVoid13/Templater#templater-obsidian-plugin">Templater's Github</a> or in the community plugins page.<br/>
Enjoy new features for Templater: new internal templates, user templates arguments, conditional statements and more.<br/>
Every already existing feature still exists of course, you just need to update the syntax in your templates files.<br/>
Thanks for using Templater! SilentVoid.<br/>
This message will self-destruct in the next update.`;
        new obsidian.Setting(containerEl)
            .setName("Templater Update")
            .setDesc(notice_fragment);
        let fragment = document.createDocumentFragment();
        let link = document.createElement("a");
        link.href = "https://github.com/SilentVoid13/Templater#internal-templates";
        link.text = "here";
        fragment.append("Click ");
        fragment.append(link);
        fragment.append(" to get a list of all the available internal templates.");
        new obsidian.Setting(containerEl)
            .setName("Template folder location")
            .setDesc("Files in this folder will be available as templates.")
            .addText(text => {
            text.setPlaceholder("Example: folder 1/folder 2")
                .setValue(this.plugin.settings.template_folder)
                .onChange((new_folder) => {
                this.plugin.settings.template_folder = new_folder;
                this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName("Timeout")
            .setDesc("Maximum timeout in seconds for a command.")
            .addText(text => {
            text.setPlaceholder("Timeout")
                .setValue(this.plugin.settings.command_timeout.toString())
                .onChange((new_value) => {
                let new_timeout = Number(new_value);
                if (isNaN(new_timeout)) {
                    this.plugin.log_error("Timeout must be a number");
                    return;
                }
                this.plugin.settings.command_timeout = new_timeout;
                this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName("Internal templates")
            .setDesc(fragment);
        let i = 1;
        this.plugin.settings.templates_pairs.forEach((template_pair) => {
            let div = containerEl.createEl('div');
            div.addClass("templater_div");
            let title = containerEl.createEl('h4', {
                text: 'Template n°' + i,
            });
            title.addClass("templater_title");
            let setting = new obsidian.Setting(containerEl)
                .addExtraButton(extra => {
                extra.setIcon("cross")
                    .setTooltip("Delete")
                    .onClick(() => {
                    let index = this.plugin.settings.templates_pairs.indexOf(template_pair);
                    if (index > -1) {
                        this.plugin.settings.templates_pairs.splice(index, 1);
                        // Force refresh
                        this.display();
                    }
                });
            })
                .addText(text => {
                let t = text.setPlaceholder('Template Pattern')
                    .setValue(template_pair[0])
                    .onChange((new_value) => {
                    let index = this.plugin.settings.templates_pairs.indexOf(template_pair);
                    if (index > -1) {
                        this.plugin.settings.templates_pairs[index][0] = new_value;
                        this.plugin.saveSettings();
                    }
                });
                t.inputEl.addClass("templater_template");
                return t;
            })
                .addTextArea(text => {
                let t = text.setPlaceholder('System Command')
                    .setValue(template_pair[1])
                    .onChange((new_cmd) => {
                    let index = this.plugin.settings.templates_pairs.indexOf(template_pair);
                    if (index > -1) {
                        this.plugin.settings.templates_pairs[index][1] = new_cmd;
                        this.plugin.saveSettings();
                    }
                });
                t.inputEl.setAttr("rows", 4);
                t.inputEl.addClass("templater_cmd");
                return t;
            });
            setting.infoEl.remove();
            div.appendChild(title);
            div.appendChild(containerEl.lastChild);
            i += 1;
        });
        let div = containerEl.createEl('div');
        div.addClass("templater_div2");
        let setting = new obsidian.Setting(containerEl)
            .addButton(button => {
            let b = button.setButtonText("Add Template").onClick(() => {
                this.plugin.settings.templates_pairs.push(["", ""]);
                // Force refresh
                this.display();
            });
            b.buttonEl.addClass("templater_button");
            return b;
        });
        setting.infoEl.remove();
        div.appendChild(containerEl.lastChild);
    }
}

var OpenMode;
(function (OpenMode) {
    OpenMode[OpenMode["InsertTemplate"] = 0] = "InsertTemplate";
    OpenMode[OpenMode["CreateNoteTemplate"] = 1] = "CreateNoteTemplate";
})(OpenMode || (OpenMode = {}));
class TemplaterFuzzySuggestModal extends obsidian.FuzzySuggestModal {
    constructor(app, plugin) {
        super(app);
        this.app = app;
        this.plugin = plugin;
    }
    getItems() {
        let template_files = [];
        if (this.plugin.settings.template_folder === "") {
            let files = this.app.vault.getFiles();
            template_files = files;
        }
        else {
            let template_folder_str = obsidian.normalizePath(this.plugin.settings.template_folder);
            let template_folder = this.app.vault.getAbstractFileByPath(template_folder_str);
            if (!template_folder) {
                throw new Error(`${template_folder_str} folder doesn't exist`);
            }
            if (!(template_folder instanceof obsidian.TFolder)) {
                throw new Error(`${template_folder_str} is a file, not a folder`);
            }
            obsidian.Vault.recurseChildren(template_folder, (file) => {
                if (file instanceof obsidian.TFile) {
                    template_files.push(file);
                }
            });
        }
        return template_files;
    }
    getItemText(item) {
        return item.basename;
    }
    onChooseItem(item, _evt) {
        switch (this.open_mode) {
            case OpenMode.InsertTemplate:
                this.plugin.parser.replace_templates_and_append(item);
                break;
            case OpenMode.CreateNoteTemplate:
                this.plugin.parser.create_new_note_from_template(item);
                break;
        }
    }
    insert_template() {
        this.open_mode = OpenMode.InsertTemplate;
        // If there is only one file in the templates directory, we don't open the modal
        try {
            let files = this.getItems();
            if (files.length == 1) {
                this.plugin.parser.replace_templates_and_append(files[0]);
            }
            else {
                this.open();
            }
        }
        catch (error) {
            this.plugin.log_error(error);
        }
    }
    create_new_note_from_template() {
        this.open_mode = OpenMode.CreateNoteTemplate;
        try {
            this.open();
        }
        catch (error) {
            this.plugin.log_error(error);
        }
    }
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, basedir, module) {
	return module = {
		path: basedir,
		exports: {},
		require: function (path, base) {
			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
		}
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var eta_min = createCommonjsModule(function (module, exports) {
!function(e,t){t(exports);}(commonjsGlobal,(function(e){function t(e){var n,r,i=new Error(e);return n=i,r=t.prototype,Object.setPrototypeOf?Object.setPrototypeOf(n,r):n.__proto__=r,i}function n(e,n,r){var i=n.slice(0,r).split(/\n/),a=i.length,o=i[a-1].length+1;throw t(e+=" at line "+a+" col "+o+":\n\n  "+n.split(/\n/)[a-1]+"\n  "+Array(o).join(" ")+"^")}t.prototype=Object.create(Error.prototype,{name:{value:"Eta Error",enumerable:!1}});var r=new Function("return this")().Promise;function i(e,t){for(var n in t)r=t,i=n,Object.prototype.hasOwnProperty.call(r,i)&&(e[n]=t[n]);var r,i;return e}function a(e,t,n,r){var i,a;return Array.isArray(t.autoTrim)?(i=t.autoTrim[1],a=t.autoTrim[0]):i=a=t.autoTrim,(n||!1===n)&&(i=n),(r||!1===r)&&(a=r),a||i?"slurp"===i&&"slurp"===a?e.trim():("_"===i||"slurp"===i?e=function(e){return String.prototype.trimLeft?e.trimLeft():e.replace(/^\s+/,"")}(e):"-"!==i&&"nl"!==i||(e=e.replace(/^(?:\r\n|\n|\r)/,"")),"_"===a||"slurp"===a?e=function(e){return String.prototype.trimRight?e.trimRight():e.replace(/\s+$/,"")}(e):"-"!==a&&"nl"!==a||(e=e.replace(/(?:\r\n|\n|\r)$/,"")),e):e}var o={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function s(e){return o[e]}var l=/`(?:\\[\s\S]|\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})*}|(?!\${)[^\\`])*`/g,c=/'(?:\\[\s\w"'\\`]|[^\n\r'\\])*?'/g,u=/"(?:\\[\s\w"'\\`]|[^\n\r"\\])*?"/g;function p(e){return e.replace(/[.*+\-?^${}()|[\]\\]/g,"\\$&")}function f(e,t){var r=[],i=!1,o=0,s=t.parse;if(t.plugins)for(var f=0;f<t.plugins.length;f++){(T=t.plugins[f]).processTemplate&&(e=T.processTemplate(e,t));}function d(e,n){e&&(e=a(e,t,i,n))&&(e=e.replace(/\\|'/g,"\\$&").replace(/\r\n|\n|\r/g,"\\n"),r.push(e));}t.rmWhitespace&&(e=e.replace(/[\r\n]+/g,"\n").replace(/^\s+|\s+$/gm,"")),l.lastIndex=0,c.lastIndex=0,u.lastIndex=0;for(var g,h=[s.exec,s.interpolate,s.raw].reduce((function(e,t){return e&&t?e+"|"+p(t):t?p(t):e}),""),m=new RegExp("([^]*?)"+p(t.tags[0])+"(-|_)?\\s*("+h+")?\\s*","g"),v=new RegExp("'|\"|`|\\/\\*|(\\s*(-|_)?"+p(t.tags[1])+")","g");g=m.exec(e);){o=g[0].length+g.index;var y=g[1],x=g[2],_=g[3]||"";d(y,x),v.lastIndex=o;for(var w=void 0,b=!1;w=v.exec(e);){if(w[1]){var E=e.slice(o,w.index);m.lastIndex=o=v.lastIndex,i=w[2],b={t:_===s.exec?"e":_===s.raw?"r":_===s.interpolate?"i":"",val:E};break}var I=w[0];if("/*"===I){var R=e.indexOf("*/",v.lastIndex);-1===R&&n("unclosed comment",e,w.index),v.lastIndex=R;}else if("'"===I){c.lastIndex=w.index,c.exec(e)?v.lastIndex=c.lastIndex:n("unclosed string",e,w.index);}else if('"'===I){u.lastIndex=w.index,u.exec(e)?v.lastIndex=u.lastIndex:n("unclosed string",e,w.index);}else if("`"===I){l.lastIndex=w.index,l.exec(e)?v.lastIndex=l.lastIndex:n("unclosed string",e,w.index);}}b?r.push(b):n("unclosed tag",e,g.index+y.length);}if(d(e.slice(o,e.length),!1),t.plugins)for(f=0;f<t.plugins.length;f++){var T;(T=t.plugins[f]).processAST&&(r=T.processAST(r,t));}return r}function d(e,t){var n=f(e,t),r="var tR='',__l,__lP"+(t.include?",include=E.include.bind(E)":"")+(t.includeFile?",includeFile=E.includeFile.bind(E)":"")+"\nfunction layout(p,d){__l=p;__lP=d}\n"+(t.globalAwait?"let prs = [];\n":"")+(t.useWith?"with("+t.varName+"||{}){":"")+function(e,t){var n,r=e.length,i="";if(t.globalAwait){for(n=0;n<r;n++){if("string"!=typeof(o=e[n]))if("r"===(s=o.t)||"i"===s)i+="prs.push("+(l=o.val||"")+");\n";}i+="let rst = await Promise.all(prs);\n";}var a=0;for(n=0;n<r;n++){var o;if("string"==typeof(o=e[n])){i+="tR+='"+o+"'\n";}else {var s=o.t,l=o.val||"";"r"===s?(t.globalAwait&&(l="rst["+a+"]"),t.filter&&(l="E.filter("+l+")"),i+="tR+="+l+"\n",a++):"i"===s?(t.globalAwait&&(l="rst["+a+"]"),t.filter&&(l="E.filter("+l+")"),t.autoEscape&&(l="E.e("+l+")"),i+="tR+="+l+"\n",a++):"e"===s&&(i+=l+"\n");}}return i}(n,t)+(t.includeFile?"if(__l)tR="+(t.async?"await ":"")+"includeFile(__l,Object.assign("+t.varName+",{body:tR},__lP))\n":t.include?"if(__l)tR="+(t.async?"await ":"")+"include(__l,Object.assign("+t.varName+",{body:tR},__lP))\n":"")+"if(cb){cb(null,tR)} return tR"+(t.useWith?"}":"");if(t.plugins)for(var i=0;i<t.plugins.length;i++){var a=t.plugins[i];a.processFnString&&(r=a.processFnString(r,t));}return r}var g=new(function(){function e(e){this.cache=e;}return e.prototype.define=function(e,t){this.cache[e]=t;},e.prototype.get=function(e){return this.cache[e]},e.prototype.remove=function(e){delete this.cache[e];},e.prototype.reset=function(){this.cache={};},e.prototype.load=function(e){i(this.cache,e);},e}())({});var h={async:!1,autoEscape:!0,autoTrim:[!1,"nl"],cache:!1,e:function(e){var t=String(e);return /[&<>"']/.test(t)?t.replace(/[&<>"']/g,s):t},include:function(e,n){var r=this.templates.get(e);if(!r)throw t('Could not fetch template "'+e+'"');return r(n,this)},parse:{exec:"",interpolate:"=",raw:"~"},plugins:[],rmWhitespace:!1,tags:["<%","%>"],templates:g,useWith:!1,varName:"it"};function m(e,t){var n={};return i(n,h),t&&i(n,t),e&&i(n,e),n}function v(e,n){var r=m(n||{}),i=r.async?function(){try{return new Function("return (async function(){}).constructor")()}catch(e){throw e instanceof SyntaxError?t("This environment doesn't support async/await"):e}}():Function;try{return new i(r.varName,"E","cb",d(e,r))}catch(n){throw n instanceof SyntaxError?t("Bad template syntax\n\n"+n.message+"\n"+Array(n.message.length+1).join("=")+"\n"+d(e,r)+"\n"):n}}function y(e,t){if(t.cache&&t.name&&t.templates.get(t.name))return t.templates.get(t.name);var n="function"==typeof e?e:v(e,t);return t.cache&&t.name&&t.templates.define(t.name,n),n}function x(e,n,i,a){var o=m(i||{});if(!o.async)return y(e,o)(n,o);if(!a){if("function"==typeof r)return new r((function(t,r){try{t(y(e,o)(n,o));}catch(e){r(e);}}));throw t("Please provide a callback function, this env doesn't support Promises")}try{y(e,o)(n,o,a);}catch(e){return a(e)}}e.compile=v,e.compileToString=d,e.config=h,e.configure=function(e){return i(h,e)},e.defaultConfig=h,e.getConfig=m,e.parse=f,e.render=x,e.renderAsync=function(e,t,n,r){return x(e,t,Object.assign({},n,{async:!0}),r)},e.templates=g,Object.defineProperty(e,"__esModule",{value:!0});}));
//# sourceMappingURL=eta.min.js.map
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
class TParser {
    constructor(app) {
        this.app = app;
    }
}

class InternalModule extends TParser {
    constructor(app, plugin, file) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.templates = new Map();
    }
    generateContext() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.generateTemplates();
            return Object.fromEntries(this.templates);
        });
    }
}

function get_date_string(date_format, days, moment_str, moment_format) {
    return window.moment(moment_str, moment_format).add(days, 'days').format(date_format);
}
const UNSUPPORTED_MOBILE_TEMPLATE = "Error_MobileUnsupportedTemplate";

class InternalModuleDate extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "date";
    }
    generateTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.templates.set("now", this.generate_now());
            this.templates.set("tomorrow", this.generate_tomorrow());
            this.templates.set("yesterday", this.generate_yesterday());
        });
    }
    generate_now() {
        return (format = "YYYY-MM-DD", offset, reference, reference_format) => {
            if (reference && !window.moment(reference, reference_format).isValid()) {
                throw new Error("Invalid title date format, try specifying one with the argument 'reference'");
            }
            return get_date_string(format, offset, reference, reference_format);
        };
    }
    generate_tomorrow() {
        return (format = "YYYY-MM-DD") => {
            return get_date_string(format, 1);
        };
    }
    generate_yesterday() {
        return (format = "YYYY-MM-DD") => {
            return get_date_string(format, -1);
        };
    }
}

const TP_FILE_CURSOR = "<% tp.file.cursor %>";
const DEPTH_LIMIT = 10;
class InternalModuleFile extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "file";
    }
    generateTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.templates.set("content", yield this.generate_content());
            this.templates.set("creation_date", this.generate_creation_date());
            // Hack to prevent empty output
            this.templates.set("cursor", TP_FILE_CURSOR);
            this.templates.set("folder", this.generate_folder());
            this.templates.set("include", this.generate_include());
            this.templates.set("last_modified_date", this.generate_last_modified_date());
            this.templates.set("path", this.generate_path());
            this.templates.set("rename", this.generate_rename());
            this.templates.set("selection", this.generate_selection());
            this.templates.set("tags", this.generate_tags());
            this.templates.set("title", this.generate_title());
        });
    }
    generate_content() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.app.vault.read(this.file);
        });
    }
    generate_creation_date() {
        return (format = "YYYY-MM-DD HH:mm") => {
            return get_date_string(format, undefined, this.file.stat.ctime);
        };
    }
    generate_folder() {
        return (relative = false) => {
            let parent = this.file.parent;
            let folder;
            if (relative) {
                folder = parent.path;
            }
            else {
                folder = parent.name;
            }
            return folder;
        };
    }
    generate_include() {
        return (include_filename) => __awaiter(this, void 0, void 0, function* () {
            let inc_file = this.app.metadataCache.getFirstLinkpathDest(obsidian.normalizePath(include_filename), "");
            if (!inc_file) {
                throw new Error(`File ${this.file} include doesn't exist`);
            }
            if (!(inc_file instanceof obsidian.TFile)) {
                throw new Error(`${this.file} is a folder, not a file`);
            }
            // TODO: Add mutex for this, this may currently lead to a race condition. 
            // While not very impactful, that could still be annoying.
            InternalModuleFile.depth += 1;
            if (InternalModuleFile.depth > DEPTH_LIMIT) {
                throw new Error("Reached inclusion depth limit (max = 10)");
            }
            let inc_file_content = yield this.app.vault.read(inc_file);
            let parsed_content = yield this.plugin.parser.parseTemplates(inc_file_content, this.file, ContextMode.USER_INTERNAL);
            InternalModuleFile.depth -= 1;
            return parsed_content;
        });
    }
    generate_last_modified_date() {
        return (format = "YYYY-MM-DD HH:mm") => {
            return get_date_string(format, undefined, this.file.stat.mtime);
        };
    }
    generate_path() {
        return (relative = false) => {
            // TODO: fix that
            if (this.app.isMobile) {
                return UNSUPPORTED_MOBILE_TEMPLATE;
            }
            if (!(this.app.vault.adapter instanceof obsidian.FileSystemAdapter)) {
                throw new Error("app.vault is not a FileSystemAdapter instance");
            }
            let vault_path = this.app.vault.adapter.getBasePath();
            if (relative) {
                return this.file.path;
            }
            else {
                return `${vault_path}/${this.file.path}`;
            }
        };
    }
    generate_rename() {
        return (new_title) => __awaiter(this, void 0, void 0, function* () {
            let new_path = obsidian.normalizePath(`${this.file.parent.path}/${new_title}.${this.file.extension}`);
            yield this.app.fileManager.renameFile(this.file, new_path);
            return "";
        });
    }
    generate_selection() {
        return () => {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view == null) {
                throw new Error("Active view is null");
            }
            let editor = active_view.editor;
            return editor.getSelection();
        };
    }
    generate_tags() {
        let cache = this.app.metadataCache.getFileCache(this.file);
        return obsidian.getAllTags(cache);
    }
    generate_title() {
        return this.file.basename;
    }
}
InternalModuleFile.depth = 0;

class InternalModuleWeb extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "web";
    }
    generateTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            this.templates.set("daily_quote", this.generate_daily_quote());
            this.templates.set("random_picture", this.generate_random_picture());
            this.templates.set("get_request", this.generate_get_request());
        });
    }
    getRequest(url) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Mobile support
            let response = yield fetch(url);
            if (!response.ok) {
                throw new Error("Error performing GET request");
            }
            return response;
        });
    }
    generate_daily_quote() {
        return () => __awaiter(this, void 0, void 0, function* () {
            // TODO: Mobile support
            let response = yield this.getRequest("https://quotes.rest/qod");
            let json = yield response.json();
            let author = json.contents.quotes[0].author;
            let quote = json.contents.quotes[0].quote;
            let new_content = `> ${quote}\n> &mdash; <cite>${author}</cite>`;
            return new_content;
        });
    }
    generate_random_picture() {
        return (size = "1600x900", query) => __awaiter(this, void 0, void 0, function* () {
            // TODO: Mobile support
            let response = yield this.getRequest(`https://source.unsplash.com/random/${size}?${query}`);
            let url = response.url;
            return `![tp.web.random_picture](${url})`;
        });
    }
    generate_get_request() {
        return (url) => __awaiter(this, void 0, void 0, function* () {
            // TODO: Mobile support
            let response = yield this.getRequest(url);
            let json = yield response.json();
            return json;
        });
    }
}

class InternalModuleFrontmatter extends InternalModule {
    constructor() {
        super(...arguments);
        this.name = "frontmatter";
    }
    generateTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            let cache = this.app.metadataCache.getFileCache(this.file);
            if (cache.frontmatter) {
                this.templates = new Map(Object.entries(cache.frontmatter));
            }
        });
    }
}

class InternalTemplateParser extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    generateModules(f) {
        return __awaiter(this, void 0, void 0, function* () {
            let modules_map = new Map();
            let modules_array = new Array();
            modules_array.push(new InternalModuleDate(this.app, this.plugin, f));
            modules_array.push(new InternalModuleFile(this.app, this.plugin, f));
            modules_array.push(new InternalModuleWeb(this.app, this.plugin, f));
            modules_array.push(new InternalModuleFrontmatter(this.app, this.plugin, f));
            for (let mod of modules_array) {
                modules_map.set(mod.name, yield mod.generateContext());
            }
            return modules_map;
        });
    }
    generateContext(f) {
        return __awaiter(this, void 0, void 0, function* () {
            let modules = yield this.generateModules(f);
            return Object.assign({}, Object.fromEntries(modules));
        });
    }
}

class UserTemplateParser extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.resolveCwd();
    }
    resolveCwd() {
        // TODO: fix that
        if (this.app.isMobile || !(this.app.vault.adapter instanceof obsidian.FileSystemAdapter)) {
            this.cwd = "";
        }
        else {
            this.cwd = this.app.vault.adapter.getBasePath();
        }
    }
    generateUserTemplates(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let user_templates = new Map();
            const exec_promise = util.promisify(child_process.exec);
            for (let [template, cmd] of this.plugin.settings.templates_pairs) {
                if (template === "" || cmd === "") {
                    continue;
                }
                cmd = yield this.plugin.parser.parseTemplates(cmd, file, ContextMode.INTERNAL);
                user_templates.set(template, (user_args) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        let process_env = Object.assign(Object.assign({}, process.env), user_args);
                        let cmd_options = {
                            timeout: this.plugin.settings.command_timeout * 1000,
                            cwd: this.cwd,
                            env: process_env,
                        };
                        let { stdout } = yield exec_promise(cmd, cmd_options);
                        return stdout;
                    }
                    catch (error) {
                        this.plugin.log_error(`Error with User Template ${template}`, error);
                    }
                }));
            }
            return user_templates;
        });
    }
    generateContext(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let user_templates = yield this.generateUserTemplates(file);
            return Object.fromEntries(user_templates);
        });
    }
}

var ContextMode;
(function (ContextMode) {
    ContextMode[ContextMode["USER"] = 0] = "USER";
    ContextMode[ContextMode["INTERNAL"] = 1] = "INTERNAL";
    ContextMode[ContextMode["USER_INTERNAL"] = 2] = "USER_INTERNAL";
    ContextMode[ContextMode["DYNAMIC"] = 3] = "DYNAMIC";
})(ContextMode || (ContextMode = {}));
class TemplateParser extends TParser {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.userTemplateParser = null;
        this.internalTemplateParser = new InternalTemplateParser(this.app, this.plugin);
        // TODO: fix that
        if (!this.app.isMobile) {
            this.userTemplateParser = new UserTemplateParser(this.app, this.plugin);
        }
    }
    generateContext(file, context_mode = ContextMode.USER_INTERNAL) {
        return __awaiter(this, void 0, void 0, function* () {
            let context = {};
            let internal_context = yield this.internalTemplateParser.generateContext(file);
            let user_context = {};
            switch (context_mode) {
                case ContextMode.USER:
                    if (this.userTemplateParser) {
                        user_context = yield this.userTemplateParser.generateContext(file);
                    }
                    context = {
                        user: Object.assign({}, user_context)
                    };
                    break;
                case ContextMode.INTERNAL:
                    context = internal_context;
                    break;
                case ContextMode.DYNAMIC:
                    if (this.userTemplateParser) {
                        user_context = yield this.userTemplateParser.generateContext(file);
                    }
                    context = {
                        dynamic: Object.assign(Object.assign({}, internal_context), { user: Object.assign({}, user_context) })
                    };
                    break;
                case ContextMode.USER_INTERNAL:
                    if (this.userTemplateParser) {
                        user_context = yield this.userTemplateParser.generateContext(file);
                    }
                    context = Object.assign(Object.assign({}, internal_context), { user: Object.assign({}, user_context) });
                    break;
            }
            return Object.assign({}, context);
        });
    }
    parseTemplates(content, file, context_mode) {
        return __awaiter(this, void 0, void 0, function* () {
            let context = yield this.generateContext(file, context_mode);
            try {
                content = (yield eta_min.renderAsync(content, context, {
                    varName: "tp",
                    parse: {
                        exec: "*",
                        interpolate: "~",
                        raw: "",
                    },
                    autoTrim: false,
                    globalAwait: true,
                }));
            }
            catch (error) {
                this.plugin.log_error("Template parsing error, aborting.", error);
            }
            return content;
        });
    }
    replace_in_active_file() {
        try {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view === null) {
                throw new Error("Active view is null");
            }
            this.replace_templates_and_overwrite_in_file(active_view.file);
        }
        catch (error) {
            this.plugin.log_error(error);
        }
    }
    create_new_note_from_template(template_file) {
        return __awaiter(this, void 0, void 0, function* () {
            let template_content = yield this.app.vault.read(template_file);
            let created_note = yield this.app.vault.create("Untitled.md", "");
            let content = yield this.plugin.parser.parseTemplates(template_content, created_note, ContextMode.USER_INTERNAL);
            yield this.app.vault.modify(created_note, content);
            let active_leaf = this.app.workspace.activeLeaf;
            if (!active_leaf) {
                throw new Error("No active leaf");
            }
            yield active_leaf.openFile(created_note, { state: { mode: 'source' }, eState: { rename: 'all' } });
        });
    }
    replace_templates_and_append(template_file) {
        return __awaiter(this, void 0, void 0, function* () {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view === null) {
                throw new Error("No active view, can't append templates.");
            }
            let editor = active_view.editor;
            let doc = editor.getDoc();
            let content = yield this.app.vault.read(template_file);
            content = yield this.parseTemplates(content, active_view.file, ContextMode.USER_INTERNAL);
            doc.replaceSelection(content);
            yield this.jump_to_next_cursor_location();
            editor.focus();
        });
    }
    replace_templates_and_overwrite_in_file(file) {
        return __awaiter(this, void 0, void 0, function* () {
            let content = yield this.app.vault.read(file);
            let new_content = yield this.parseTemplates(content, file, ContextMode.USER_INTERNAL);
            if (new_content !== content) {
                yield this.app.vault.modify(file, new_content);
                if (this.app.workspace.getActiveFile() === file) {
                    yield this.jump_to_next_cursor_location();
                }
            }
        });
    }
    jump_to_next_cursor_location() {
        return __awaiter(this, void 0, void 0, function* () {
            let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (active_view === null) {
                throw new Error("No active view, can't append templates.");
            }
            let active_file = active_view.file;
            yield active_view.save();
            let content = yield this.app.vault.read(active_file);
            let pos = this.get_cursor_position(content);
            if (pos) {
                content = content.replace(new RegExp(TP_FILE_CURSOR), "");
                yield this.app.vault.modify(active_file, content);
                this.set_cursor_location(pos);
            }
        });
    }
    get_cursor_position(content) {
        let pos = null;
        let index = content.indexOf(TP_FILE_CURSOR);
        if (index !== -1) {
            let substr = content.substr(0, index);
            let l = 0;
            let offset = -1;
            let r = -1;
            for (; (r = substr.indexOf("\n", r + 1)) !== -1; l++, offset = r)
                ;
            offset += 1;
            let ch = content.substr(offset, index - offset).length;
            pos = { line: l, ch: ch };
        }
        return pos;
    }
    set_cursor_location(pos) {
        if (!pos) {
            return;
        }
        let active_view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (active_view === null) {
            return;
        }
        let editor = active_view.editor;
        editor.focus();
        // TODO: Replace with setCursor in next release
        editor.setCursor(pos);
    }
}

class TemplaterPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            // TODO: Remove this
            let notice = new obsidian.Notice("", 15000);
            notice.noticeEl.innerHTML = `What? Templater is <b>evolving</b>!<br/>
The template syntax changed in this release, check out the new documentation for it on <a href="https://github.com/SilentVoid13/Templater#templater-obsidian-plugin">Templater's Github</a> or in the community plugins page.<br/>
Enjoy new features for Templater: new internal templates, user templates arguments, conditional statements and more.<br/>
Every already existing feature still exists of course, you just need to update the syntax in your templates files.<br/>
Thanks for using Templater! SilentVoid.<br/>
You can also find this message in the settings of Templater. This message will self-destruct in the next update.`;
            this.fuzzySuggest = new TemplaterFuzzySuggestModal(this.app, this);
            this.parser = new TemplateParser(this.app, this);
            this.registerMarkdownPostProcessor((el, ctx) => this.dynamic_templates_processor(el, ctx));
            this.addRibbonIcon('three-horizontal-bars', 'Templater', () => __awaiter(this, void 0, void 0, function* () {
                this.fuzzySuggest.insert_template();
            }));
            this.addCommand({
                id: "insert-templater",
                name: "Insert Template",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: 'e',
                    },
                ],
                callback: () => {
                    this.fuzzySuggest.insert_template();
                },
            });
            this.addCommand({
                id: "replace-in-file-templater",
                name: "Replace templates in the active file",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: 'r',
                    },
                ],
                callback: () => {
                    this.parser.replace_in_active_file();
                },
            });
            this.addCommand({
                id: "jump-to-next-cursor-location",
                name: "Jump to next cursor location",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: "Tab",
                    },
                ],
                callback: () => {
                    try {
                        this.parser.jump_to_next_cursor_location();
                    }
                    catch (error) {
                        this.log_error(error);
                    }
                }
            });
            this.addCommand({
                id: "create-new-note-from-template",
                name: "Create new note from template",
                hotkeys: [
                    {
                        modifiers: ["Alt"],
                        key: "n",
                    },
                ],
                callback: () => {
                    this.fuzzySuggest.create_new_note_from_template();
                }
            });
            this.app.workspace.on("layout-ready", () => {
                // TODO: Find a way to not trigger this on files copy
                this.app.vault.on("create", (file) => __awaiter(this, void 0, void 0, function* () {
                    // TODO: find a better way to do this
                    // Currently, I have to wait for the daily note plugin to add the file content before replacing
                    // Not a problem with Calendar however since it creates the file with the existing content
                    yield delay(300);
                    // ! This could corrupt binary files
                    if (!(file instanceof obsidian.TFile) || file.extension !== "md") {
                        return;
                    }
                    this.parser.replace_templates_and_overwrite_in_file(file);
                }));
            });
            this.addSettingTab(new TemplaterSettingTab(this.app, this));
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    log_error(msg, error) {
        if (error) {
            console.error(msg, error);
            new obsidian.Notice(`Templater Error: ${msg}\nCheck console for more informations`);
        }
        else {
            new obsidian.Notice(`Templater Error: ${msg}`);
        }
    }
    dynamic_templates_processor(el, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (el.textContent.contains("tp.dynamic")) {
                // TODO: This will not always be the active file, 
                // I need to use getFirstLinkpathDest and ctx to find the actual file
                let file = this.app.workspace.getActiveFile();
                let new_html = yield this.parser.parseTemplates(el.innerHTML, file, ContextMode.DYNAMIC);
                el.innerHTML = new_html;
            }
        });
    }
}

module.exports = TemplaterPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9TZXR0aW5ncy50cyIsInNyYy9UZW1wbGF0ZXJGdXp6eVN1Z2dlc3QudHMiLCJub2RlX21vZHVsZXMvZXRhL2Rpc3QvYnJvd3Nlci9ldGEubWluLmpzIiwic3JjL1RQYXJzZXIudHMiLCJzcmMvSW50ZXJuYWxUZW1wbGF0ZXMvSW50ZXJuYWxNb2R1bGUudHMiLCJzcmMvSW50ZXJuYWxUZW1wbGF0ZXMvSW50ZXJuYWxVdGlscy50cyIsInNyYy9JbnRlcm5hbFRlbXBsYXRlcy9kYXRlL0ludGVybmFsTW9kdWxlRGF0ZS50cyIsInNyYy9JbnRlcm5hbFRlbXBsYXRlcy9maWxlL0ludGVybmFsTW9kdWxlRmlsZS50cyIsInNyYy9JbnRlcm5hbFRlbXBsYXRlcy93ZWIvSW50ZXJuYWxNb2R1bGVXZWIudHMiLCJzcmMvSW50ZXJuYWxUZW1wbGF0ZXMvZnJvbnRtYXR0ZXIvSW50ZXJuYWxNb2R1bGVGcm9udG1hdHRlci50cyIsInNyYy9JbnRlcm5hbFRlbXBsYXRlcy9JbnRlcm5hbFRlbXBsYXRlUGFyc2VyLnRzIiwic3JjL1VzZXJUZW1wbGF0ZXMvVXNlclRlbXBsYXRlUGFyc2VyLnRzIiwic3JjL1RlbXBsYXRlUGFyc2VyLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZztcclxuICAgIHJldHVybiBnID0geyBuZXh0OiB2ZXJiKDApLCBcInRocm93XCI6IHZlcmIoMSksIFwicmV0dXJuXCI6IHZlcmIoMikgfSwgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIChnW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0pLCBnO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gc3RlcChbbiwgdl0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKG9wKSB7XHJcbiAgICAgICAgaWYgKGYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBleGVjdXRpbmcuXCIpO1xyXG4gICAgICAgIHdoaWxlIChfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9KTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20pIHtcclxuICAgIGZvciAodmFyIGkgPSAwLCBpbCA9IGZyb20ubGVuZ3RoLCBqID0gdG8ubGVuZ3RoOyBpIDwgaWw7IGkrKywgaisrKVxyXG4gICAgICAgIHRvW2pdID0gZnJvbVtpXTtcclxuICAgIHJldHVybiB0bztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaWYgKGdbbl0pIGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBuID09PSBcInJldHVyblwiIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrIGluIG1vZCkgaWYgKGsgIT09IFwiZGVmYXVsdFwiICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2QsIGspKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGspO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgcHJpdmF0ZU1hcCkge1xyXG4gICAgaWYgKCFwcml2YXRlTWFwLmhhcyhyZWNlaXZlcikpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXR0ZW1wdGVkIHRvIGdldCBwcml2YXRlIGZpZWxkIG9uIG5vbi1pbnN0YW5jZVwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiBwcml2YXRlTWFwLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBwcml2YXRlTWFwLCB2YWx1ZSkge1xyXG4gICAgaWYgKCFwcml2YXRlTWFwLmhhcyhyZWNlaXZlcikpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXR0ZW1wdGVkIHRvIHNldCBwcml2YXRlIGZpZWxkIG9uIG5vbi1pbnN0YW5jZVwiKTtcclxuICAgIH1cclxuICAgIHByaXZhdGVNYXAuc2V0KHJlY2VpdmVyLCB2YWx1ZSk7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbn1cclxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCBUZW1wbGF0ZXJQbHVnaW4gZnJvbSAnLi9tYWluJztcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFRlbXBsYXRlclNldHRpbmdzID0ge1xuXHRjb21tYW5kX3RpbWVvdXQ6IDUsXG5cdHRlbXBsYXRlX2ZvbGRlcjogXCJcIixcblx0dGVtcGxhdGVzX3BhaXJzOiBbW1wiXCIsIFwiXCJdXSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVtcGxhdGVyU2V0dGluZ3Mge1xuXHRjb21tYW5kX3RpbWVvdXQ6IG51bWJlcjtcblx0dGVtcGxhdGVfZm9sZGVyOiBzdHJpbmc7XG5cdHRlbXBsYXRlc19wYWlyczogQXJyYXk8W3N0cmluZywgc3RyaW5nXT47XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0bGV0IHtjb250YWluZXJFbH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHQvLyBUT0RPOiBSZW1vdmUgdGhpc1xuXHRcdGxldCBub3RpY2VfZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0bGV0IG5vdGljZV9kaXYgPSBub3RpY2VfZnJhZ21lbnQuY3JlYXRlRWwoXCJkaXZcIik7XG5cdFx0bm90aWNlX2Rpdi5pbm5lckhUTUwgPSBgV2hhdD8gVGVtcGxhdGVyIGlzIDxiPmV2b2x2aW5nPC9iPiE8YnIvPlxuVGhlIHRlbXBsYXRlIHN5bnRheCBjaGFuZ2VkIGluIHRoaXMgcmVsZWFzZSwgY2hlY2sgb3V0IHRoZSBuZXcgZG9jdW1lbnRhdGlvbiBmb3IgaXQgb24gPGEgaHJlZj1cImh0dHBzOi8vZ2l0aHViLmNvbS9TaWxlbnRWb2lkMTMvVGVtcGxhdGVyI3RlbXBsYXRlci1vYnNpZGlhbi1wbHVnaW5cIj5UZW1wbGF0ZXIncyBHaXRodWI8L2E+IG9yIGluIHRoZSBjb21tdW5pdHkgcGx1Z2lucyBwYWdlLjxici8+XG5FbmpveSBuZXcgZmVhdHVyZXMgZm9yIFRlbXBsYXRlcjogbmV3IGludGVybmFsIHRlbXBsYXRlcywgdXNlciB0ZW1wbGF0ZXMgYXJndW1lbnRzLCBjb25kaXRpb25hbCBzdGF0ZW1lbnRzIGFuZCBtb3JlLjxici8+XG5FdmVyeSBhbHJlYWR5IGV4aXN0aW5nIGZlYXR1cmUgc3RpbGwgZXhpc3RzIG9mIGNvdXJzZSwgeW91IGp1c3QgbmVlZCB0byB1cGRhdGUgdGhlIHN5bnRheCBpbiB5b3VyIHRlbXBsYXRlcyBmaWxlcy48YnIvPlxuVGhhbmtzIGZvciB1c2luZyBUZW1wbGF0ZXIhIFNpbGVudFZvaWQuPGJyLz5cblRoaXMgbWVzc2FnZSB3aWxsIHNlbGYtZGVzdHJ1Y3QgaW4gdGhlIG5leHQgdXBkYXRlLmA7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlRlbXBsYXRlciBVcGRhdGVcIilcblx0XHRcdC5zZXREZXNjKG5vdGljZV9mcmFnbWVudCk7XG5cblx0XHRsZXQgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0bGV0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcblx0XHRsaW5rLmhyZWYgPSBcImh0dHBzOi8vZ2l0aHViLmNvbS9TaWxlbnRWb2lkMTMvVGVtcGxhdGVyI2ludGVybmFsLXRlbXBsYXRlc1wiO1xuXHRcdGxpbmsudGV4dCA9IFwiaGVyZVwiO1xuXHRcdGZyYWdtZW50LmFwcGVuZChcIkNsaWNrIFwiKTtcblx0XHRmcmFnbWVudC5hcHBlbmQobGluayk7XG5cdFx0ZnJhZ21lbnQuYXBwZW5kKFwiIHRvIGdldCBhIGxpc3Qgb2YgYWxsIHRoZSBhdmFpbGFibGUgaW50ZXJuYWwgdGVtcGxhdGVzLlwiKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJUZW1wbGF0ZSBmb2xkZXIgbG9jYXRpb25cIilcblx0XHRcdC5zZXREZXNjKFwiRmlsZXMgaW4gdGhpcyBmb2xkZXIgd2lsbCBiZSBhdmFpbGFibGUgYXMgdGVtcGxhdGVzLlwiKVxuXHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoXCJFeGFtcGxlOiBmb2xkZXIgMS9mb2xkZXIgMlwiKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKChuZXdfZm9sZGVyKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIgPSBuZXdfZm9sZGVyO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlRpbWVvdXRcIilcblx0XHRcdC5zZXREZXNjKFwiTWF4aW11bSB0aW1lb3V0IGluIHNlY29uZHMgZm9yIGEgY29tbWFuZC5cIilcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHR0ZXh0LnNldFBsYWNlaG9sZGVyKFwiVGltZW91dFwiKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb21tYW5kX3RpbWVvdXQudG9TdHJpbmcoKSlcblx0XHRcdFx0XHQub25DaGFuZ2UoKG5ld192YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0bGV0IG5ld190aW1lb3V0ID0gTnVtYmVyKG5ld192YWx1ZSk7XG5cdFx0XHRcdFx0XHRpZiAoaXNOYU4obmV3X3RpbWVvdXQpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLmxvZ19lcnJvcihcIlRpbWVvdXQgbXVzdCBiZSBhIG51bWJlclwiKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY29tbWFuZF90aW1lb3V0ID0gbmV3X3RpbWVvdXQ7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0fSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiSW50ZXJuYWwgdGVtcGxhdGVzXCIpXG5cdFx0XHQuc2V0RGVzYyhmcmFnbWVudCk7XG5cblx0XHRsZXQgaSA9IDE7XG5cdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudGVtcGxhdGVzX3BhaXJzLmZvckVhY2goKHRlbXBsYXRlX3BhaXIpID0+IHtcblx0XHRcdGxldCBkaXYgPSBjb250YWluZXJFbC5jcmVhdGVFbCgnZGl2Jyk7XG5cdFx0XHRkaXYuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfZGl2XCIpO1xuXG5cdFx0XHRsZXQgdGl0bGUgPSBjb250YWluZXJFbC5jcmVhdGVFbCgnaDQnLCB7XG5cdFx0XHRcdHRleHQ6ICdUZW1wbGF0ZSBuwrAnICsgaSxcblx0XHRcdH0pO1xuXHRcdFx0dGl0bGUuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfdGl0bGVcIik7XG5cblx0XHRcdGxldCBzZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5hZGRFeHRyYUJ1dHRvbihleHRyYSA9PiB7XG5cdFx0XHRcdFx0ZXh0cmEuc2V0SWNvbihcImNyb3NzXCIpXG5cdFx0XHRcdFx0XHQuc2V0VG9vbHRpcChcIkRlbGV0ZVwiKVxuXHRcdFx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRsZXQgaW5kZXggPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMuaW5kZXhPZih0ZW1wbGF0ZV9wYWlyKTtcblx0XHRcdFx0XHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0XHRcdFx0XHQvLyBGb3JjZSByZWZyZXNoXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHRcdFx0bGV0IHQgPSB0ZXh0LnNldFBsYWNlaG9sZGVyKCdUZW1wbGF0ZSBQYXR0ZXJuJylcblx0XHRcdFx0XHRcdC5zZXRWYWx1ZSh0ZW1wbGF0ZV9wYWlyWzBdKVxuXHRcdFx0XHRcdFx0Lm9uQ2hhbmdlKChuZXdfdmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0bGV0IGluZGV4ID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MudGVtcGxhdGVzX3BhaXJzLmluZGV4T2YodGVtcGxhdGVfcGFpcik7XG5cdFx0XHRcdFx0XHRcdGlmIChpbmRleCA+IC0xKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudGVtcGxhdGVzX3BhaXJzW2luZGV4XVswXSA9IG5ld192YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR0LmlucHV0RWwuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfdGVtcGxhdGVcIik7XG5cblx0XHRcdFx0XHRcdHJldHVybiB0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0KVxuXHRcdFx0XHQuYWRkVGV4dEFyZWEodGV4dCA9PiB7XG5cdFx0XHRcdFx0bGV0IHQgPSB0ZXh0LnNldFBsYWNlaG9sZGVyKCdTeXN0ZW0gQ29tbWFuZCcpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRlbXBsYXRlX3BhaXJbMV0pXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKChuZXdfY21kKSA9PiB7XG5cdFx0XHRcdFx0XHRsZXQgaW5kZXggPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMuaW5kZXhPZih0ZW1wbGF0ZV9wYWlyKTtcblx0XHRcdFx0XHRcdGlmIChpbmRleCA+IC0xKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnRlbXBsYXRlc19wYWlyc1tpbmRleF1bMV0gPSBuZXdfY21kO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdHQuaW5wdXRFbC5zZXRBdHRyKFwicm93c1wiLCA0KTtcblx0XHRcdFx0XHR0LmlucHV0RWwuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfY21kXCIpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHQ7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRzZXR0aW5nLmluZm9FbC5yZW1vdmUoKTtcblxuXHRcdFx0ZGl2LmFwcGVuZENoaWxkKHRpdGxlKTtcblx0XHRcdGRpdi5hcHBlbmRDaGlsZChjb250YWluZXJFbC5sYXN0Q2hpbGQpO1xuXG5cdFx0XHRpKz0xO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGRpdiA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdkaXYnKTtcblx0XHRkaXYuYWRkQ2xhc3MoXCJ0ZW1wbGF0ZXJfZGl2MlwiKTtcblxuXHRcdGxldCBzZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuYWRkQnV0dG9uKGJ1dHRvbiA9PiB7XG5cdFx0XHRcdGxldCBiID0gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJBZGQgVGVtcGxhdGVcIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudGVtcGxhdGVzX3BhaXJzLnB1c2goW1wiXCIsIFwiXCJdKTtcblx0XHRcdFx0XHQvLyBGb3JjZSByZWZyZXNoXG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRiLmJ1dHRvbkVsLmFkZENsYXNzKFwidGVtcGxhdGVyX2J1dHRvblwiKTtcblxuXHRcdFx0XHRyZXR1cm4gYjtcblx0XHRcdH0pO1xuXHRcdHNldHRpbmcuaW5mb0VsLnJlbW92ZSgpO1xuXG5cdFx0ZGl2LmFwcGVuZENoaWxkKGNvbnRhaW5lckVsLmxhc3RDaGlsZCk7XG5cdH1cbn0iLCJpbXBvcnQgeyBBcHAsIEZ1enp5U3VnZ2VzdE1vZGFsLCBURmlsZSwgVEZvbGRlciwgbm9ybWFsaXplUGF0aCwgVmF1bHQsIFRBYnN0cmFjdEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCBUZW1wbGF0ZXJQbHVnaW4gZnJvbSAnLi9tYWluJztcblxuZXhwb3J0IGVudW0gT3Blbk1vZGUge1xuICAgIEluc2VydFRlbXBsYXRlLFxuICAgIENyZWF0ZU5vdGVUZW1wbGF0ZSxcbn07XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZXJGdXp6eVN1Z2dlc3RNb2RhbCBleHRlbmRzIEZ1enp5U3VnZ2VzdE1vZGFsPFRGaWxlPiB7XG4gICAgYXBwOiBBcHA7XG4gICAgcGx1Z2luOiBUZW1wbGF0ZXJQbHVnaW47XG4gICAgb3Blbl9tb2RlOiBPcGVuTW9kZTtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgfVxuXG4gICAgZ2V0SXRlbXMoKTogVEZpbGVbXSB7XG4gICAgICAgIGxldCB0ZW1wbGF0ZV9maWxlczogVEZpbGVbXSA9IFtdO1xuXG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZV9mb2xkZXIgPT09IFwiXCIpIHtcbiAgICAgICAgICAgIGxldCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKCk7XG4gICAgICAgICAgICB0ZW1wbGF0ZV9maWxlcyA9IGZpbGVzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHRlbXBsYXRlX2ZvbGRlcl9zdHIgPSBub3JtYWxpemVQYXRoKHRoaXMucGx1Z2luLnNldHRpbmdzLnRlbXBsYXRlX2ZvbGRlcik7XG5cbiAgICAgICAgICAgIGxldCB0ZW1wbGF0ZV9mb2xkZXIgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGVtcGxhdGVfZm9sZGVyX3N0cik7XG4gICAgICAgICAgICBpZiAoIXRlbXBsYXRlX2ZvbGRlcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHt0ZW1wbGF0ZV9mb2xkZXJfc3RyfSBmb2xkZXIgZG9lc24ndCBleGlzdGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEgKHRlbXBsYXRlX2ZvbGRlciBpbnN0YW5jZW9mIFRGb2xkZXIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3RlbXBsYXRlX2ZvbGRlcl9zdHJ9IGlzIGEgZmlsZSwgbm90IGEgZm9sZGVyYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIFZhdWx0LnJlY3Vyc2VDaGlsZHJlbih0ZW1wbGF0ZV9mb2xkZXIsIChmaWxlOiBUQWJzdHJhY3RGaWxlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZV9maWxlcy5wdXNoKGZpbGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlX2ZpbGVzO1xuICAgIH1cblxuICAgIGdldEl0ZW1UZXh0KGl0ZW06IFRGaWxlKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uYmFzZW5hbWU7XG4gICAgfVxuXG4gICAgb25DaG9vc2VJdGVtKGl0ZW06IFRGaWxlLCBfZXZ0OiBNb3VzZUV2ZW50IHwgS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBzd2l0Y2godGhpcy5vcGVuX21vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgT3Blbk1vZGUuSW5zZXJ0VGVtcGxhdGU6XG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ucGFyc2VyLnJlcGxhY2VfdGVtcGxhdGVzX2FuZF9hcHBlbmQoaXRlbSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIE9wZW5Nb2RlLkNyZWF0ZU5vdGVUZW1wbGF0ZTpcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5wYXJzZXIuY3JlYXRlX25ld19ub3RlX2Zyb21fdGVtcGxhdGUoaXRlbSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbnNlcnRfdGVtcGxhdGUoKTogdm9pZCB7XG4gICAgICAgIHRoaXMub3Blbl9tb2RlID0gT3Blbk1vZGUuSW5zZXJ0VGVtcGxhdGU7XG5cbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgb25seSBvbmUgZmlsZSBpbiB0aGUgdGVtcGxhdGVzIGRpcmVjdG9yeSwgd2UgZG9uJ3Qgb3BlbiB0aGUgbW9kYWxcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBmaWxlcyA9IHRoaXMuZ2V0SXRlbXMoKTtcbiAgICAgICAgICAgIGlmIChmaWxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnBhcnNlci5yZXBsYWNlX3RlbXBsYXRlc19hbmRfYXBwZW5kKGZpbGVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMub3BlbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sb2dfZXJyb3IoZXJyb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlX25ld19ub3RlX2Zyb21fdGVtcGxhdGUoKSB7XG4gICAgICAgIHRoaXMub3Blbl9tb2RlID0gT3Blbk1vZGUuQ3JlYXRlTm90ZVRlbXBsYXRlO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLm9wZW4oKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubG9nX2Vycm9yKGVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIiFmdW5jdGlvbihlLHQpe1wib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlP3QoZXhwb3J0cyk6XCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShbXCJleHBvcnRzXCJdLHQpOnQoKGU9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbFRoaXM/Z2xvYmFsVGhpczplfHxzZWxmKS5FdGE9e30pfSh0aGlzLChmdW5jdGlvbihlKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiB0KGUpe3ZhciBuLHIsaT1uZXcgRXJyb3IoZSk7cmV0dXJuIG49aSxyPXQucHJvdG90eXBlLE9iamVjdC5zZXRQcm90b3R5cGVPZj9PYmplY3Quc2V0UHJvdG90eXBlT2YobixyKTpuLl9fcHJvdG9fXz1yLGl9ZnVuY3Rpb24gbihlLG4scil7dmFyIGk9bi5zbGljZSgwLHIpLnNwbGl0KC9cXG4vKSxhPWkubGVuZ3RoLG89aVthLTFdLmxlbmd0aCsxO3Rocm93IHQoZSs9XCIgYXQgbGluZSBcIithK1wiIGNvbCBcIitvK1wiOlxcblxcbiAgXCIrbi5zcGxpdCgvXFxuLylbYS0xXStcIlxcbiAgXCIrQXJyYXkobykuam9pbihcIiBcIikrXCJeXCIpfXQucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlLHtuYW1lOnt2YWx1ZTpcIkV0YSBFcnJvclwiLGVudW1lcmFibGU6ITF9fSk7dmFyIHI9bmV3IEZ1bmN0aW9uKFwicmV0dXJuIHRoaXNcIikoKS5Qcm9taXNlO2Z1bmN0aW9uIGkoZSx0KXtmb3IodmFyIG4gaW4gdClyPXQsaT1uLE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChyLGkpJiYoZVtuXT10W25dKTt2YXIgcixpO3JldHVybiBlfWZ1bmN0aW9uIGEoZSx0LG4scil7dmFyIGksYTtyZXR1cm4gQXJyYXkuaXNBcnJheSh0LmF1dG9UcmltKT8oaT10LmF1dG9UcmltWzFdLGE9dC5hdXRvVHJpbVswXSk6aT1hPXQuYXV0b1RyaW0sKG58fCExPT09bikmJihpPW4pLChyfHwhMT09PXIpJiYoYT1yKSxhfHxpP1wic2x1cnBcIj09PWkmJlwic2x1cnBcIj09PWE/ZS50cmltKCk6KFwiX1wiPT09aXx8XCJzbHVycFwiPT09aT9lPWZ1bmN0aW9uKGUpe3JldHVybiBTdHJpbmcucHJvdG90eXBlLnRyaW1MZWZ0P2UudHJpbUxlZnQoKTplLnJlcGxhY2UoL15cXHMrLyxcIlwiKX0oZSk6XCItXCIhPT1pJiZcIm5sXCIhPT1pfHwoZT1lLnJlcGxhY2UoL14oPzpcXHJcXG58XFxufFxccikvLFwiXCIpKSxcIl9cIj09PWF8fFwic2x1cnBcIj09PWE/ZT1mdW5jdGlvbihlKXtyZXR1cm4gU3RyaW5nLnByb3RvdHlwZS50cmltUmlnaHQ/ZS50cmltUmlnaHQoKTplLnJlcGxhY2UoL1xccyskLyxcIlwiKX0oZSk6XCItXCIhPT1hJiZcIm5sXCIhPT1hfHwoZT1lLnJlcGxhY2UoLyg/OlxcclxcbnxcXG58XFxyKSQvLFwiXCIpKSxlKTplfXZhciBvPXtcIiZcIjpcIiZhbXA7XCIsXCI8XCI6XCImbHQ7XCIsXCI+XCI6XCImZ3Q7XCIsJ1wiJzpcIiZxdW90O1wiLFwiJ1wiOlwiJiMzOTtcIn07ZnVuY3Rpb24gcyhlKXtyZXR1cm4gb1tlXX12YXIgbD0vYCg/OlxcXFxbXFxzXFxTXXxcXCR7KD86W157fV18eyg/Oltee31dfHtbXn1dKn0pKn0pKn18KD8hXFwkeylbXlxcXFxgXSkqYC9nLGM9LycoPzpcXFxcW1xcc1xcd1wiJ1xcXFxgXXxbXlxcblxccidcXFxcXSkqPycvZyx1PS9cIig/OlxcXFxbXFxzXFx3XCInXFxcXGBdfFteXFxuXFxyXCJcXFxcXSkqP1wiL2c7ZnVuY3Rpb24gcChlKXtyZXR1cm4gZS5yZXBsYWNlKC9bLiorXFwtP14ke30oKXxbXFxdXFxcXF0vZyxcIlxcXFwkJlwiKX1mdW5jdGlvbiBmKGUsdCl7dmFyIHI9W10saT0hMSxvPTAscz10LnBhcnNlO2lmKHQucGx1Z2lucylmb3IodmFyIGY9MDtmPHQucGx1Z2lucy5sZW5ndGg7ZisrKXsoVD10LnBsdWdpbnNbZl0pLnByb2Nlc3NUZW1wbGF0ZSYmKGU9VC5wcm9jZXNzVGVtcGxhdGUoZSx0KSl9ZnVuY3Rpb24gZChlLG4pe2UmJihlPWEoZSx0LGksbikpJiYoZT1lLnJlcGxhY2UoL1xcXFx8Jy9nLFwiXFxcXCQmXCIpLnJlcGxhY2UoL1xcclxcbnxcXG58XFxyL2csXCJcXFxcblwiKSxyLnB1c2goZSkpfXQucm1XaGl0ZXNwYWNlJiYoZT1lLnJlcGxhY2UoL1tcXHJcXG5dKy9nLFwiXFxuXCIpLnJlcGxhY2UoL15cXHMrfFxccyskL2dtLFwiXCIpKSxsLmxhc3RJbmRleD0wLGMubGFzdEluZGV4PTAsdS5sYXN0SW5kZXg9MDtmb3IodmFyIGcsaD1bcy5leGVjLHMuaW50ZXJwb2xhdGUscy5yYXddLnJlZHVjZSgoZnVuY3Rpb24oZSx0KXtyZXR1cm4gZSYmdD9lK1wifFwiK3AodCk6dD9wKHQpOmV9KSxcIlwiKSxtPW5ldyBSZWdFeHAoXCIoW15dKj8pXCIrcCh0LnRhZ3NbMF0pK1wiKC18Xyk/XFxcXHMqKFwiK2grXCIpP1xcXFxzKlwiLFwiZ1wiKSx2PW5ldyBSZWdFeHAoXCInfFxcXCJ8YHxcXFxcL1xcXFwqfChcXFxccyooLXxfKT9cIitwKHQudGFnc1sxXSkrXCIpXCIsXCJnXCIpO2c9bS5leGVjKGUpOyl7bz1nWzBdLmxlbmd0aCtnLmluZGV4O3ZhciB5PWdbMV0seD1nWzJdLF89Z1szXXx8XCJcIjtkKHkseCksdi5sYXN0SW5kZXg9bztmb3IodmFyIHc9dm9pZCAwLGI9ITE7dz12LmV4ZWMoZSk7KXtpZih3WzFdKXt2YXIgRT1lLnNsaWNlKG8sdy5pbmRleCk7bS5sYXN0SW5kZXg9bz12Lmxhc3RJbmRleCxpPXdbMl0sYj17dDpfPT09cy5leGVjP1wiZVwiOl89PT1zLnJhdz9cInJcIjpfPT09cy5pbnRlcnBvbGF0ZT9cImlcIjpcIlwiLHZhbDpFfTticmVha312YXIgST13WzBdO2lmKFwiLypcIj09PUkpe3ZhciBSPWUuaW5kZXhPZihcIiovXCIsdi5sYXN0SW5kZXgpOy0xPT09UiYmbihcInVuY2xvc2VkIGNvbW1lbnRcIixlLHcuaW5kZXgpLHYubGFzdEluZGV4PVJ9ZWxzZSBpZihcIidcIj09PUkpe2MubGFzdEluZGV4PXcuaW5kZXgsYy5leGVjKGUpP3YubGFzdEluZGV4PWMubGFzdEluZGV4Om4oXCJ1bmNsb3NlZCBzdHJpbmdcIixlLHcuaW5kZXgpfWVsc2UgaWYoJ1wiJz09PUkpe3UubGFzdEluZGV4PXcuaW5kZXgsdS5leGVjKGUpP3YubGFzdEluZGV4PXUubGFzdEluZGV4Om4oXCJ1bmNsb3NlZCBzdHJpbmdcIixlLHcuaW5kZXgpfWVsc2UgaWYoXCJgXCI9PT1JKXtsLmxhc3RJbmRleD13LmluZGV4LGwuZXhlYyhlKT92Lmxhc3RJbmRleD1sLmxhc3RJbmRleDpuKFwidW5jbG9zZWQgc3RyaW5nXCIsZSx3LmluZGV4KX19Yj9yLnB1c2goYik6bihcInVuY2xvc2VkIHRhZ1wiLGUsZy5pbmRleCt5Lmxlbmd0aCl9aWYoZChlLnNsaWNlKG8sZS5sZW5ndGgpLCExKSx0LnBsdWdpbnMpZm9yKGY9MDtmPHQucGx1Z2lucy5sZW5ndGg7ZisrKXt2YXIgVDsoVD10LnBsdWdpbnNbZl0pLnByb2Nlc3NBU1QmJihyPVQucHJvY2Vzc0FTVChyLHQpKX1yZXR1cm4gcn1mdW5jdGlvbiBkKGUsdCl7dmFyIG49ZihlLHQpLHI9XCJ2YXIgdFI9JycsX19sLF9fbFBcIisodC5pbmNsdWRlP1wiLGluY2x1ZGU9RS5pbmNsdWRlLmJpbmQoRSlcIjpcIlwiKSsodC5pbmNsdWRlRmlsZT9cIixpbmNsdWRlRmlsZT1FLmluY2x1ZGVGaWxlLmJpbmQoRSlcIjpcIlwiKStcIlxcbmZ1bmN0aW9uIGxheW91dChwLGQpe19fbD1wO19fbFA9ZH1cXG5cIisodC5nbG9iYWxBd2FpdD9cImxldCBwcnMgPSBbXTtcXG5cIjpcIlwiKSsodC51c2VXaXRoP1wid2l0aChcIit0LnZhck5hbWUrXCJ8fHt9KXtcIjpcIlwiKStmdW5jdGlvbihlLHQpe3ZhciBuLHI9ZS5sZW5ndGgsaT1cIlwiO2lmKHQuZ2xvYmFsQXdhaXQpe2ZvcihuPTA7bjxyO24rKyl7aWYoXCJzdHJpbmdcIiE9dHlwZW9mKG89ZVtuXSkpaWYoXCJyXCI9PT0ocz1vLnQpfHxcImlcIj09PXMpaSs9XCJwcnMucHVzaChcIisobD1vLnZhbHx8XCJcIikrXCIpO1xcblwifWkrPVwibGV0IHJzdCA9IGF3YWl0IFByb21pc2UuYWxsKHBycyk7XFxuXCJ9dmFyIGE9MDtmb3Iobj0wO248cjtuKyspe3ZhciBvO2lmKFwic3RyaW5nXCI9PXR5cGVvZihvPWVbbl0pKXtpKz1cInRSKz0nXCIrbytcIidcXG5cIn1lbHNle3ZhciBzPW8udCxsPW8udmFsfHxcIlwiO1wiclwiPT09cz8odC5nbG9iYWxBd2FpdCYmKGw9XCJyc3RbXCIrYStcIl1cIiksdC5maWx0ZXImJihsPVwiRS5maWx0ZXIoXCIrbCtcIilcIiksaSs9XCJ0Uis9XCIrbCtcIlxcblwiLGErKyk6XCJpXCI9PT1zPyh0Lmdsb2JhbEF3YWl0JiYobD1cInJzdFtcIithK1wiXVwiKSx0LmZpbHRlciYmKGw9XCJFLmZpbHRlcihcIitsK1wiKVwiKSx0LmF1dG9Fc2NhcGUmJihsPVwiRS5lKFwiK2wrXCIpXCIpLGkrPVwidFIrPVwiK2wrXCJcXG5cIixhKyspOlwiZVwiPT09cyYmKGkrPWwrXCJcXG5cIil9fXJldHVybiBpfShuLHQpKyh0LmluY2x1ZGVGaWxlP1wiaWYoX19sKXRSPVwiKyh0LmFzeW5jP1wiYXdhaXQgXCI6XCJcIikrXCJpbmNsdWRlRmlsZShfX2wsT2JqZWN0LmFzc2lnbihcIit0LnZhck5hbWUrXCIse2JvZHk6dFJ9LF9fbFApKVxcblwiOnQuaW5jbHVkZT9cImlmKF9fbCl0Uj1cIisodC5hc3luYz9cImF3YWl0IFwiOlwiXCIpK1wiaW5jbHVkZShfX2wsT2JqZWN0LmFzc2lnbihcIit0LnZhck5hbWUrXCIse2JvZHk6dFJ9LF9fbFApKVxcblwiOlwiXCIpK1wiaWYoY2Ipe2NiKG51bGwsdFIpfSByZXR1cm4gdFJcIisodC51c2VXaXRoP1wifVwiOlwiXCIpO2lmKHQucGx1Z2lucylmb3IodmFyIGk9MDtpPHQucGx1Z2lucy5sZW5ndGg7aSsrKXt2YXIgYT10LnBsdWdpbnNbaV07YS5wcm9jZXNzRm5TdHJpbmcmJihyPWEucHJvY2Vzc0ZuU3RyaW5nKHIsdCkpfXJldHVybiByfXZhciBnPW5ldyhmdW5jdGlvbigpe2Z1bmN0aW9uIGUoZSl7dGhpcy5jYWNoZT1lfXJldHVybiBlLnByb3RvdHlwZS5kZWZpbmU9ZnVuY3Rpb24oZSx0KXt0aGlzLmNhY2hlW2VdPXR9LGUucHJvdG90eXBlLmdldD1mdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5jYWNoZVtlXX0sZS5wcm90b3R5cGUucmVtb3ZlPWZ1bmN0aW9uKGUpe2RlbGV0ZSB0aGlzLmNhY2hlW2VdfSxlLnByb3RvdHlwZS5yZXNldD1mdW5jdGlvbigpe3RoaXMuY2FjaGU9e319LGUucHJvdG90eXBlLmxvYWQ9ZnVuY3Rpb24oZSl7aSh0aGlzLmNhY2hlLGUpfSxlfSgpKSh7fSk7dmFyIGg9e2FzeW5jOiExLGF1dG9Fc2NhcGU6ITAsYXV0b1RyaW06WyExLFwibmxcIl0sY2FjaGU6ITEsZTpmdW5jdGlvbihlKXt2YXIgdD1TdHJpbmcoZSk7cmV0dXJuL1smPD5cIiddLy50ZXN0KHQpP3QucmVwbGFjZSgvWyY8PlwiJ10vZyxzKTp0fSxpbmNsdWRlOmZ1bmN0aW9uKGUsbil7dmFyIHI9dGhpcy50ZW1wbGF0ZXMuZ2V0KGUpO2lmKCFyKXRocm93IHQoJ0NvdWxkIG5vdCBmZXRjaCB0ZW1wbGF0ZSBcIicrZSsnXCInKTtyZXR1cm4gcihuLHRoaXMpfSxwYXJzZTp7ZXhlYzpcIlwiLGludGVycG9sYXRlOlwiPVwiLHJhdzpcIn5cIn0scGx1Z2luczpbXSxybVdoaXRlc3BhY2U6ITEsdGFnczpbXCI8JVwiLFwiJT5cIl0sdGVtcGxhdGVzOmcsdXNlV2l0aDohMSx2YXJOYW1lOlwiaXRcIn07ZnVuY3Rpb24gbShlLHQpe3ZhciBuPXt9O3JldHVybiBpKG4saCksdCYmaShuLHQpLGUmJmkobixlKSxufWZ1bmN0aW9uIHYoZSxuKXt2YXIgcj1tKG58fHt9KSxpPXIuYXN5bmM/ZnVuY3Rpb24oKXt0cnl7cmV0dXJuIG5ldyBGdW5jdGlvbihcInJldHVybiAoYXN5bmMgZnVuY3Rpb24oKXt9KS5jb25zdHJ1Y3RvclwiKSgpfWNhdGNoKGUpe3Rocm93IGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcj90KFwiVGhpcyBlbnZpcm9ubWVudCBkb2Vzbid0IHN1cHBvcnQgYXN5bmMvYXdhaXRcIik6ZX19KCk6RnVuY3Rpb247dHJ5e3JldHVybiBuZXcgaShyLnZhck5hbWUsXCJFXCIsXCJjYlwiLGQoZSxyKSl9Y2F0Y2gobil7dGhyb3cgbiBpbnN0YW5jZW9mIFN5bnRheEVycm9yP3QoXCJCYWQgdGVtcGxhdGUgc3ludGF4XFxuXFxuXCIrbi5tZXNzYWdlK1wiXFxuXCIrQXJyYXkobi5tZXNzYWdlLmxlbmd0aCsxKS5qb2luKFwiPVwiKStcIlxcblwiK2QoZSxyKStcIlxcblwiKTpufX1mdW5jdGlvbiB5KGUsdCl7aWYodC5jYWNoZSYmdC5uYW1lJiZ0LnRlbXBsYXRlcy5nZXQodC5uYW1lKSlyZXR1cm4gdC50ZW1wbGF0ZXMuZ2V0KHQubmFtZSk7dmFyIG49XCJmdW5jdGlvblwiPT10eXBlb2YgZT9lOnYoZSx0KTtyZXR1cm4gdC5jYWNoZSYmdC5uYW1lJiZ0LnRlbXBsYXRlcy5kZWZpbmUodC5uYW1lLG4pLG59ZnVuY3Rpb24geChlLG4saSxhKXt2YXIgbz1tKGl8fHt9KTtpZighby5hc3luYylyZXR1cm4geShlLG8pKG4sbyk7aWYoIWEpe2lmKFwiZnVuY3Rpb25cIj09dHlwZW9mIHIpcmV0dXJuIG5ldyByKChmdW5jdGlvbih0LHIpe3RyeXt0KHkoZSxvKShuLG8pKX1jYXRjaChlKXtyKGUpfX0pKTt0aHJvdyB0KFwiUGxlYXNlIHByb3ZpZGUgYSBjYWxsYmFjayBmdW5jdGlvbiwgdGhpcyBlbnYgZG9lc24ndCBzdXBwb3J0IFByb21pc2VzXCIpfXRyeXt5KGUsbykobixvLGEpfWNhdGNoKGUpe3JldHVybiBhKGUpfX1lLmNvbXBpbGU9dixlLmNvbXBpbGVUb1N0cmluZz1kLGUuY29uZmlnPWgsZS5jb25maWd1cmU9ZnVuY3Rpb24oZSl7cmV0dXJuIGkoaCxlKX0sZS5kZWZhdWx0Q29uZmlnPWgsZS5nZXRDb25maWc9bSxlLnBhcnNlPWYsZS5yZW5kZXI9eCxlLnJlbmRlckFzeW5jPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB4KGUsdCxPYmplY3QuYXNzaWduKHt9LG4se2FzeW5jOiEwfSkscil9LGUudGVtcGxhdGVzPWcsT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSl9KSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1ldGEubWluLmpzLm1hcFxuIiwiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZGVsYXkobXM6IG51bWJlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSggcmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSApO1xufTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFRQYXJzZXIge1xuICAgIGNvbnN0cnVjdG9yKHB1YmxpYyBhcHA6IEFwcCkge31cbiAgICBhYnN0cmFjdCBnZW5lcmF0ZUNvbnRleHQoZmlsZTogVEZpbGUpOiBQcm9taXNlPGFueT47XG59IiwiaW1wb3J0IFRlbXBsYXRlclBsdWdpbiBmcm9tIFwibWFpblwiO1xuaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgVFBhcnNlciB9IGZyb20gXCJUUGFyc2VyXCI7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBJbnRlcm5hbE1vZHVsZSBleHRlbmRzIFRQYXJzZXIge1xuICAgIHB1YmxpYyBhYnN0cmFjdCBuYW1lOiBzdHJpbmc7XG4gICAgdGVtcGxhdGVzOiBNYXA8c3RyaW5nLCBhbnk+O1xuXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByb3RlY3RlZCBwbHVnaW46IFRlbXBsYXRlclBsdWdpbiwgcHJvdGVjdGVkIGZpbGU6IFRGaWxlKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG4gICAgICAgIHRoaXMudGVtcGxhdGVzID0gbmV3IE1hcCgpO1xuICAgIH1cblxuICAgIGFic3RyYWN0IGdlbmVyYXRlVGVtcGxhdGVzKCk6IFByb21pc2U8dm9pZD47XG5cbiAgICBhc3luYyBnZW5lcmF0ZUNvbnRleHQoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVUZW1wbGF0ZXMoKTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyh0aGlzLnRlbXBsYXRlcyk7XG4gICAgfVxufSIsImV4cG9ydCBmdW5jdGlvbiBnZXRfZGF0ZV9zdHJpbmcoZGF0ZV9mb3JtYXQ6IHN0cmluZywgZGF5cz86IG51bWJlciwgbW9tZW50X3N0cj86IHN0cmluZyB8IG51bWJlciwgbW9tZW50X2Zvcm1hdD86IHN0cmluZykge1xuICAgIHJldHVybiB3aW5kb3cubW9tZW50KG1vbWVudF9zdHIsIG1vbWVudF9mb3JtYXQpLmFkZChkYXlzLCAnZGF5cycpLmZvcm1hdChkYXRlX2Zvcm1hdCk7XG59XG5cbmV4cG9ydCBjb25zdCBVTlNVUFBPUlRFRF9NT0JJTEVfVEVNUExBVEUgPSBcIkVycm9yX01vYmlsZVVuc3VwcG9ydGVkVGVtcGxhdGVcIjsiLCJpbXBvcnQgeyBJbnRlcm5hbE1vZHVsZSB9IGZyb20gXCIuLi9JbnRlcm5hbE1vZHVsZVwiO1xuaW1wb3J0IHsgZ2V0X2RhdGVfc3RyaW5nIH0gZnJvbSBcIi4uL0ludGVybmFsVXRpbHNcIjtcblxuZXhwb3J0IGNsYXNzIEludGVybmFsTW9kdWxlRGF0ZSBleHRlbmRzIEludGVybmFsTW9kdWxlIHtcbiAgICBuYW1lID0gXCJkYXRlXCI7XG5cbiAgICBhc3luYyBnZW5lcmF0ZVRlbXBsYXRlcygpIHtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZXMuc2V0KFwibm93XCIsIHRoaXMuZ2VuZXJhdGVfbm93KCkpO1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJ0b21vcnJvd1wiLCB0aGlzLmdlbmVyYXRlX3RvbW9ycm93KCkpO1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJ5ZXN0ZXJkYXlcIiwgdGhpcy5nZW5lcmF0ZV95ZXN0ZXJkYXkoKSk7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfbm93KCkge1xuICAgICAgICByZXR1cm4gKGZvcm1hdDogc3RyaW5nID0gXCJZWVlZLU1NLUREXCIsIG9mZnNldD86IG51bWJlciwgcmVmZXJlbmNlPzogc3RyaW5nLCByZWZlcmVuY2VfZm9ybWF0Pzogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlICYmICF3aW5kb3cubW9tZW50KHJlZmVyZW5jZSwgcmVmZXJlbmNlX2Zvcm1hdCkuaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB0aXRsZSBkYXRlIGZvcm1hdCwgdHJ5IHNwZWNpZnlpbmcgb25lIHdpdGggdGhlIGFyZ3VtZW50ICdyZWZlcmVuY2UnXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGdldF9kYXRlX3N0cmluZyhmb3JtYXQsIG9mZnNldCwgcmVmZXJlbmNlLCByZWZlcmVuY2VfZm9ybWF0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlX3RvbW9ycm93KCkge1xuICAgICAgICByZXR1cm4gKGZvcm1hdDogc3RyaW5nID0gXCJZWVlZLU1NLUREXCIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBnZXRfZGF0ZV9zdHJpbmcoZm9ybWF0LCAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlX3llc3RlcmRheSgpIHtcbiAgICAgICAgcmV0dXJuIChmb3JtYXQ6IHN0cmluZyA9IFwiWVlZWS1NTS1ERFwiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0X2RhdGVfc3RyaW5nKGZvcm1hdCwgLTEpO1xuICAgICAgICB9XG4gICAgfVxufSIsImltcG9ydCB7IEludGVybmFsTW9kdWxlIH0gZnJvbSBcIi4uL0ludGVybmFsTW9kdWxlXCI7XG5pbXBvcnQgeyBnZXRfZGF0ZV9zdHJpbmcsIFVOU1VQUE9SVEVEX01PQklMRV9URU1QTEFURSB9IGZyb20gXCIuLi9JbnRlcm5hbFV0aWxzXCI7XG5cbmltcG9ydCB7IEZpbGVTeXN0ZW1BZGFwdGVyLCBnZXRBbGxUYWdzLCBNYXJrZG93blZpZXcsIG5vcm1hbGl6ZVBhdGgsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBDb250ZXh0TW9kZSB9IGZyb20gXCJUZW1wbGF0ZVBhcnNlclwiO1xuXG5leHBvcnQgY29uc3QgVFBfRklMRV9DVVJTT1IgPSBcIjwlIHRwLmZpbGUuY3Vyc29yICU+XCI7XG5cbmV4cG9ydCBjb25zdCBERVBUSF9MSU1JVCA9IDEwO1xuXG5leHBvcnQgY2xhc3MgSW50ZXJuYWxNb2R1bGVGaWxlIGV4dGVuZHMgSW50ZXJuYWxNb2R1bGUge1xuICAgIG5hbWUgPSBcImZpbGVcIjtcbiAgICBwcml2YXRlIHN0YXRpYyBkZXB0aDogbnVtYmVyID0gMDtcblxuICAgIGFzeW5jIGdlbmVyYXRlVGVtcGxhdGVzKCkge1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJjb250ZW50XCIsIGF3YWl0IHRoaXMuZ2VuZXJhdGVfY29udGVudCgpKTtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZXMuc2V0KFwiY3JlYXRpb25fZGF0ZVwiLCB0aGlzLmdlbmVyYXRlX2NyZWF0aW9uX2RhdGUoKSk7XG4gICAgICAgIC8vIEhhY2sgdG8gcHJldmVudCBlbXB0eSBvdXRwdXRcbiAgICAgICAgdGhpcy50ZW1wbGF0ZXMuc2V0KFwiY3Vyc29yXCIsIFRQX0ZJTEVfQ1VSU09SKTtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZXMuc2V0KFwiZm9sZGVyXCIsIHRoaXMuZ2VuZXJhdGVfZm9sZGVyKCkpO1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJpbmNsdWRlXCIsIHRoaXMuZ2VuZXJhdGVfaW5jbHVkZSgpKTtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZXMuc2V0KFwibGFzdF9tb2RpZmllZF9kYXRlXCIsIHRoaXMuZ2VuZXJhdGVfbGFzdF9tb2RpZmllZF9kYXRlKCkpO1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJwYXRoXCIsIHRoaXMuZ2VuZXJhdGVfcGF0aCgpKTtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZXMuc2V0KFwicmVuYW1lXCIsIHRoaXMuZ2VuZXJhdGVfcmVuYW1lKCkpO1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJzZWxlY3Rpb25cIiwgdGhpcy5nZW5lcmF0ZV9zZWxlY3Rpb24oKSk7XG4gICAgICAgIHRoaXMudGVtcGxhdGVzLnNldChcInRhZ3NcIiwgdGhpcy5nZW5lcmF0ZV90YWdzKCkpO1xuICAgICAgICB0aGlzLnRlbXBsYXRlcy5zZXQoXCJ0aXRsZVwiLCB0aGlzLmdlbmVyYXRlX3RpdGxlKCkpO1xuICAgIH1cblxuICAgIGFzeW5jIGdlbmVyYXRlX2NvbnRlbnQoKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHRoaXMuZmlsZSk7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfY3JlYXRpb25fZGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIChmb3JtYXQ6IHN0cmluZyA9IFwiWVlZWS1NTS1ERCBISDptbVwiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0X2RhdGVfc3RyaW5nKGZvcm1hdCwgdW5kZWZpbmVkLCB0aGlzLmZpbGUuc3RhdC5jdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9mb2xkZXIoKSB7XG4gICAgICAgIHJldHVybiAocmVsYXRpdmU6IGJvb2xlYW4gPSBmYWxzZSkgPT4ge1xuICAgICAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuZmlsZS5wYXJlbnQ7XG4gICAgICAgICAgICBsZXQgZm9sZGVyO1xuXG4gICAgICAgICAgICBpZiAocmVsYXRpdmUpIHtcbiAgICAgICAgICAgICAgICBmb2xkZXIgPSBwYXJlbnQucGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvbGRlciA9IHBhcmVudC5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfaW5jbHVkZSgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jIChpbmNsdWRlX2ZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGxldCBpbmNfZmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3Qobm9ybWFsaXplUGF0aChpbmNsdWRlX2ZpbGVuYW1lKSwgXCJcIik7XG4gICAgICAgICAgICBpZiAoIWluY19maWxlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGaWxlICR7dGhpcy5maWxlfSBpbmNsdWRlIGRvZXNuJ3QgZXhpc3RgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGluY19maWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3RoaXMuZmlsZX0gaXMgYSBmb2xkZXIsIG5vdCBhIGZpbGVgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVE9ETzogQWRkIG11dGV4IGZvciB0aGlzLCB0aGlzIG1heSBjdXJyZW50bHkgbGVhZCB0byBhIHJhY2UgY29uZGl0aW9uLiBcbiAgICAgICAgICAgIC8vIFdoaWxlIG5vdCB2ZXJ5IGltcGFjdGZ1bCwgdGhhdCBjb3VsZCBzdGlsbCBiZSBhbm5veWluZy5cbiAgICAgICAgICAgIEludGVybmFsTW9kdWxlRmlsZS5kZXB0aCArPSAxO1xuICAgICAgICAgICAgaWYgKEludGVybmFsTW9kdWxlRmlsZS5kZXB0aCA+IERFUFRIX0xJTUlUKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVhY2hlZCBpbmNsdXNpb24gZGVwdGggbGltaXQgKG1heCA9IDEwKVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGluY19maWxlX2NvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGluY19maWxlKTtcbiAgICAgICAgICAgIGxldCBwYXJzZWRfY29udGVudCA9IGF3YWl0IHRoaXMucGx1Z2luLnBhcnNlci5wYXJzZVRlbXBsYXRlcyhpbmNfZmlsZV9jb250ZW50LCB0aGlzLmZpbGUsIENvbnRleHRNb2RlLlVTRVJfSU5URVJOQUwpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBJbnRlcm5hbE1vZHVsZUZpbGUuZGVwdGggLT0gMTtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VkX2NvbnRlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9sYXN0X21vZGlmaWVkX2RhdGUoKSB7XG4gICAgICAgIHJldHVybiAoZm9ybWF0OiBzdHJpbmcgPSBcIllZWVktTU0tREQgSEg6bW1cIik6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldF9kYXRlX3N0cmluZyhmb3JtYXQsIHVuZGVmaW5lZCwgdGhpcy5maWxlLnN0YXQubXRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfcGF0aCgpIHtcbiAgICAgICAgcmV0dXJuIChyZWxhdGl2ZTogYm9vbGVhbiA9IGZhbHNlKSA9PiB7XG4gICAgICAgICAgICAvLyBUT0RPOiBmaXggdGhhdFxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwLmlzTW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFVOU1VQUE9SVEVEX01PQklMRV9URU1QTEFURTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgaW5zdGFuY2VvZiBGaWxlU3lzdGVtQWRhcHRlcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcHAudmF1bHQgaXMgbm90IGEgRmlsZVN5c3RlbUFkYXB0ZXIgaW5zdGFuY2VcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdmF1bHRfcGF0aCA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZ2V0QmFzZVBhdGgoKTtcblxuICAgICAgICAgICAgaWYgKHJlbGF0aXZlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmlsZS5wYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke3ZhdWx0X3BhdGh9LyR7dGhpcy5maWxlLnBhdGh9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlX3JlbmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIGFzeW5jIChuZXdfdGl0bGU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbGV0IG5ld19wYXRoID0gbm9ybWFsaXplUGF0aChgJHt0aGlzLmZpbGUucGFyZW50LnBhdGh9LyR7bmV3X3RpdGxlfS4ke3RoaXMuZmlsZS5leHRlbnNpb259YCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC5maWxlTWFuYWdlci5yZW5hbWVGaWxlKHRoaXMuZmlsZSwgbmV3X3BhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZV9zZWxlY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgYWN0aXZlX3ZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgICAgICAgICAgaWYgKGFjdGl2ZV92aWV3ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBY3RpdmUgdmlldyBpcyBudWxsXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZWRpdG9yID0gYWN0aXZlX3ZpZXcuZWRpdG9yO1xuICAgICAgICAgICAgcmV0dXJuIGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlX3RhZ3MoKSB7XG4gICAgICAgIGxldCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKHRoaXMuZmlsZSk7XG4gICAgICAgIHJldHVybiBnZXRBbGxUYWdzKGNhY2hlKTtcbiAgICB9XG5cbiAgICBnZW5lcmF0ZV90aXRsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsZS5iYXNlbmFtZTtcbiAgICB9XG59IiwiaW1wb3J0IHsgSW50ZXJuYWxNb2R1bGUgfSBmcm9tIFwiLi4vSW50ZXJuYWxNb2R1bGVcIjtcblxuZXhwb3J0IGNsYXNzIEludGVybmFsTW9kdWxlV2ViIGV4dGVuZHMgSW50ZXJuYWxNb2R1bGUge1xuICAgIG5hbWUgPSBcIndlYlwiO1xuXG4gICAgYXN5bmMgZ2VuZXJhdGVUZW1wbGF0ZXMoKSB7XG4gICAgICAgIHRoaXMudGVtcGxhdGVzLnNldChcImRhaWx5X3F1b3RlXCIsIHRoaXMuZ2VuZXJhdGVfZGFpbHlfcXVvdGUoKSk7XG4gICAgICAgIHRoaXMudGVtcGxhdGVzLnNldChcInJhbmRvbV9waWN0dXJlXCIsIHRoaXMuZ2VuZXJhdGVfcmFuZG9tX3BpY3R1cmUoKSk7XG4gICAgICAgIHRoaXMudGVtcGxhdGVzLnNldChcImdldF9yZXF1ZXN0XCIsIHRoaXMuZ2VuZXJhdGVfZ2V0X3JlcXVlc3QoKSk7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UmVxdWVzdCh1cmw6IHN0cmluZyk6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgICAgICAgLy8gVE9ETzogTW9iaWxlIHN1cHBvcnRcbiAgICAgICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsKTtcbiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXJyb3IgcGVyZm9ybWluZyBHRVQgcmVxdWVzdFwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfZGFpbHlfcXVvdGUoKSB7XG4gICAgICAgIHJldHVybiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUT0RPOiBNb2JpbGUgc3VwcG9ydFxuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRSZXF1ZXN0KFwiaHR0cHM6Ly9xdW90ZXMucmVzdC9xb2RcIik7XG4gICAgICAgICAgICBsZXQganNvbiA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgICAgICAgICAgbGV0IGF1dGhvciA9IGpzb24uY29udGVudHMucXVvdGVzWzBdLmF1dGhvcjtcbiAgICAgICAgICAgIGxldCBxdW90ZSA9IGpzb24uY29udGVudHMucXVvdGVzWzBdLnF1b3RlO1xuICAgICAgICAgICAgbGV0IG5ld19jb250ZW50ID0gYD4gJHtxdW90ZX1cXG4+ICZtZGFzaDsgPGNpdGU+JHthdXRob3J9PC9jaXRlPmA7XG5cbiAgICAgICAgICAgIHJldHVybiBuZXdfY29udGVudDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlX3JhbmRvbV9waWN0dXJlKCkge1xuICAgICAgICByZXR1cm4gYXN5bmMgKHNpemU6IHN0cmluZyA9IFwiMTYwMHg5MDBcIiwgcXVlcnk/OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIC8vIFRPRE86IE1vYmlsZSBzdXBwb3J0XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldFJlcXVlc3QoYGh0dHBzOi8vc291cmNlLnVuc3BsYXNoLmNvbS9yYW5kb20vJHtzaXplfT8ke3F1ZXJ5fWApO1xuICAgICAgICAgICAgbGV0IHVybCA9IHJlc3BvbnNlLnVybDtcbiAgICAgICAgICAgIHJldHVybiBgIVt0cC53ZWIucmFuZG9tX3BpY3R1cmVdKCR7dXJsfSlgOyAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVfZ2V0X3JlcXVlc3QoKSB7XG4gICAgICAgIHJldHVybiBhc3luYyAodXJsOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIC8vIFRPRE86IE1vYmlsZSBzdXBwb3J0XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldFJlcXVlc3QodXJsKTtcbiAgICAgICAgICAgIGxldCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgcmV0dXJuIGpzb247XG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IHsgSW50ZXJuYWxNb2R1bGUgfSBmcm9tIFwiLi4vSW50ZXJuYWxNb2R1bGVcIjtcblxuZXhwb3J0IGNsYXNzIEludGVybmFsTW9kdWxlRnJvbnRtYXR0ZXIgZXh0ZW5kcyBJbnRlcm5hbE1vZHVsZSB7XG4gICAgbmFtZSA9IFwiZnJvbnRtYXR0ZXJcIjtcblxuICAgIGFzeW5jIGdlbmVyYXRlVGVtcGxhdGVzKCkge1xuICAgICAgICBsZXQgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZSh0aGlzLmZpbGUpXG4gICAgICAgIGlmIChjYWNoZS5mcm9udG1hdHRlcikge1xuICAgICAgICAgICAgdGhpcy50ZW1wbGF0ZXMgPSBuZXcgTWFwKE9iamVjdC5lbnRyaWVzKGNhY2hlLmZyb250bWF0dGVyKSk7XG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBJbnRlcm5hbE1vZHVsZURhdGUgfSBmcm9tIFwiLi9kYXRlL0ludGVybmFsTW9kdWxlRGF0ZVwiO1xuaW1wb3J0IHsgSW50ZXJuYWxNb2R1bGVGaWxlIH0gZnJvbSBcIi4vZmlsZS9JbnRlcm5hbE1vZHVsZUZpbGVcIjtcbmltcG9ydCB7IEludGVybmFsTW9kdWxlV2ViIH0gZnJvbSBcIi4vd2ViL0ludGVybmFsTW9kdWxlV2ViXCI7XG5pbXBvcnQgeyBJbnRlcm5hbE1vZHVsZUZyb250bWF0dGVyIH0gZnJvbSBcIi4vZnJvbnRtYXR0ZXIvSW50ZXJuYWxNb2R1bGVGcm9udG1hdHRlclwiO1xuaW1wb3J0IHsgSW50ZXJuYWxNb2R1bGUgfSBmcm9tIFwiLi9JbnRlcm5hbE1vZHVsZVwiO1xuaW1wb3J0IHsgVFBhcnNlciB9IGZyb20gXCJUUGFyc2VyXCI7XG5pbXBvcnQgVGVtcGxhdGVyUGx1Z2luIGZyb20gXCJtYWluXCI7XG5cbmV4cG9ydCBjbGFzcyBJbnRlcm5hbFRlbXBsYXRlUGFyc2VyIGV4dGVuZHMgVFBhcnNlciB7XG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBUZW1wbGF0ZXJQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcbiAgICB9XG5cbiAgICBhc3luYyBnZW5lcmF0ZU1vZHVsZXMoZjogVEZpbGUpIHtcbiAgICAgICAgbGV0IG1vZHVsZXNfbWFwOiBNYXA8c3RyaW5nLCBhbnk+ID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQgbW9kdWxlc19hcnJheTogQXJyYXk8SW50ZXJuYWxNb2R1bGU+ID0gbmV3IEFycmF5KCk7XG4gICAgICAgIG1vZHVsZXNfYXJyYXkucHVzaChuZXcgSW50ZXJuYWxNb2R1bGVEYXRlKHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgZikpO1xuICAgICAgICBtb2R1bGVzX2FycmF5LnB1c2gobmV3IEludGVybmFsTW9kdWxlRmlsZSh0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIGYpKTtcbiAgICAgICAgbW9kdWxlc19hcnJheS5wdXNoKG5ldyBJbnRlcm5hbE1vZHVsZVdlYih0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIGYpKTtcbiAgICAgICAgbW9kdWxlc19hcnJheS5wdXNoKG5ldyBJbnRlcm5hbE1vZHVsZUZyb250bWF0dGVyKHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgZikpO1xuXG4gICAgICAgIGZvciAobGV0IG1vZCBvZiBtb2R1bGVzX2FycmF5KSB7XG4gICAgICAgICAgICBtb2R1bGVzX21hcC5zZXQobW9kLm5hbWUsIGF3YWl0IG1vZC5nZW5lcmF0ZUNvbnRleHQoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbW9kdWxlc19tYXA7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2VuZXJhdGVDb250ZXh0KGY6IFRGaWxlKSB7XG4gICAgICAgbGV0IG1vZHVsZXMgPSBhd2FpdCB0aGlzLmdlbmVyYXRlTW9kdWxlcyhmKTtcblxuICAgICAgIHJldHVybiB7XG4gICAgICAgICAgIC4uLk9iamVjdC5mcm9tRW50cmllcyhtb2R1bGVzKSxcbiAgICAgICB9O1xuICAgIH1cbn0iLCJpbXBvcnQgeyBBcHAsIEZpbGVTeXN0ZW1BZGFwdGVyLCBOb3RpY2UsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCJ1dGlsXCI7XG5cbmltcG9ydCBUZW1wbGF0ZXJQbHVnaW4gZnJvbSBcIm1haW5cIjtcbmltcG9ydCB7IENvbnRleHRNb2RlIH0gZnJvbSBcIlRlbXBsYXRlUGFyc2VyXCI7XG5pbXBvcnQgeyBUUGFyc2VyIH0gZnJvbSBcIlRQYXJzZXJcIjtcblxuZXhwb3J0IGNsYXNzIFVzZXJUZW1wbGF0ZVBhcnNlciBleHRlbmRzIFRQYXJzZXIge1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIGNtZF9vcHRpb25zOiBhbnk7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFRlbXBsYXRlclBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLnJlc29sdmVDd2QoKTsgICAgICAgIFxuICAgIH1cblxuICAgIHJlc29sdmVDd2QoKSB7XG4gICAgICAgIC8vIFRPRE86IGZpeCB0aGF0XG4gICAgICAgIGlmICh0aGlzLmFwcC5pc01vYmlsZSB8fCAhKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgaW5zdGFuY2VvZiBGaWxlU3lzdGVtQWRhcHRlcikpIHtcbiAgICAgICAgICAgIHRoaXMuY3dkID0gXCJcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY3dkID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlci5nZXRCYXNlUGF0aCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2VuZXJhdGVVc2VyVGVtcGxhdGVzKGZpbGU6IFRGaWxlKSB7XG4gICAgICAgIGxldCB1c2VyX3RlbXBsYXRlcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgY29uc3QgZXhlY19wcm9taXNlID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4gICAgICAgIGZvciAobGV0IFt0ZW1wbGF0ZSwgY21kXSBvZiB0aGlzLnBsdWdpbi5zZXR0aW5ncy50ZW1wbGF0ZXNfcGFpcnMpIHtcbiAgICAgICAgICAgIGlmICh0ZW1wbGF0ZSA9PT0gXCJcIiB8fCBjbWQgPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY21kID0gYXdhaXQgdGhpcy5wbHVnaW4ucGFyc2VyLnBhcnNlVGVtcGxhdGVzKGNtZCwgZmlsZSwgQ29udGV4dE1vZGUuSU5URVJOQUwpO1xuXG4gICAgICAgICAgICB1c2VyX3RlbXBsYXRlcy5zZXQodGVtcGxhdGUsIGFzeW5jICh1c2VyX2FyZ3M/OiBhbnkpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwcm9jZXNzX2VudiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByb2Nlc3MuZW52LFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4udXNlcl9hcmdzLFxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBjbWRfb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbW1hbmRfdGltZW91dCAqIDEwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBjd2Q6IHRoaXMuY3dkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW52OiBwcm9jZXNzX2VudixcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQge3N0ZG91dH0gPSBhd2FpdCBleGVjX3Byb21pc2UoY21kLCBjbWRfb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdGRvdXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmxvZ19lcnJvcihgRXJyb3Igd2l0aCBVc2VyIFRlbXBsYXRlICR7dGVtcGxhdGV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVzZXJfdGVtcGxhdGVzO1xuICAgIH1cblxuICAgIGFzeW5jIGdlbmVyYXRlQ29udGV4dChmaWxlOiBURmlsZSkge1xuICAgICAgICBsZXQgdXNlcl90ZW1wbGF0ZXMgPSBhd2FpdCB0aGlzLmdlbmVyYXRlVXNlclRlbXBsYXRlcyhmaWxlKTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyh1c2VyX3RlbXBsYXRlcyk7XG4gICAgfVxufSIsImltcG9ydCB7IEFwcCwgRWRpdG9yUG9zaXRpb24sIE1hcmtkb3duVmlldywgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCAqIGFzIEV0YSBmcm9tIFwiZXRhXCI7XG5cbmltcG9ydCB7IEludGVybmFsVGVtcGxhdGVQYXJzZXIgfSBmcm9tIFwiLi9JbnRlcm5hbFRlbXBsYXRlcy9JbnRlcm5hbFRlbXBsYXRlUGFyc2VyXCI7XG5pbXBvcnQgVGVtcGxhdGVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IFVzZXJUZW1wbGF0ZVBhcnNlciB9IGZyb20gXCIuL1VzZXJUZW1wbGF0ZXMvVXNlclRlbXBsYXRlUGFyc2VyXCI7XG5pbXBvcnQgeyBUUGFyc2VyIH0gZnJvbSBcIlRQYXJzZXJcIjtcbmltcG9ydCB7IFRQX0ZJTEVfQ1VSU09SIH0gZnJvbSBcIkludGVybmFsVGVtcGxhdGVzL2ZpbGUvSW50ZXJuYWxNb2R1bGVGaWxlXCI7XG5cbmV4cG9ydCBlbnVtIENvbnRleHRNb2RlIHtcbiAgICBVU0VSLFxuICAgIElOVEVSTkFMLFxuICAgIFVTRVJfSU5URVJOQUwsXG4gICAgRFlOQU1JQyxcbn07XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcnNlciBleHRlbmRzIFRQYXJzZXIge1xuICAgIHB1YmxpYyBpbnRlcm5hbFRlbXBsYXRlUGFyc2VyOiBJbnRlcm5hbFRlbXBsYXRlUGFyc2VyO1xuXHRwdWJsaWMgdXNlclRlbXBsYXRlUGFyc2VyOiBVc2VyVGVtcGxhdGVQYXJzZXIgPSBudWxsO1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogVGVtcGxhdGVyUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxUZW1wbGF0ZVBhcnNlciA9IG5ldyBJbnRlcm5hbFRlbXBsYXRlUGFyc2VyKHRoaXMuYXBwLCB0aGlzLnBsdWdpbik7XG4gICAgICAgIC8vIFRPRE86IGZpeCB0aGF0XG4gICAgICAgIGlmICghdGhpcy5hcHAuaXNNb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMudXNlclRlbXBsYXRlUGFyc2VyID0gbmV3IFVzZXJUZW1wbGF0ZVBhcnNlcih0aGlzLmFwcCwgdGhpcy5wbHVnaW4pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2VuZXJhdGVDb250ZXh0KGZpbGU6IFRGaWxlLCBjb250ZXh0X21vZGU6IENvbnRleHRNb2RlID0gQ29udGV4dE1vZGUuVVNFUl9JTlRFUk5BTCkge1xuICAgICAgICBsZXQgY29udGV4dCA9IHt9O1xuICAgICAgICBsZXQgaW50ZXJuYWxfY29udGV4dCA9IGF3YWl0IHRoaXMuaW50ZXJuYWxUZW1wbGF0ZVBhcnNlci5nZW5lcmF0ZUNvbnRleHQoZmlsZSk7XG4gICAgICAgIGxldCB1c2VyX2NvbnRleHQgPSB7fVxuXG4gICAgICAgIHN3aXRjaCAoY29udGV4dF9tb2RlKSB7XG4gICAgICAgICAgICBjYXNlIENvbnRleHRNb2RlLlVTRVI6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlclRlbXBsYXRlUGFyc2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXJfY29udGV4dCA9IGF3YWl0IHRoaXMudXNlclRlbXBsYXRlUGFyc2VyLmdlbmVyYXRlQ29udGV4dChmaWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udGV4dCA9IHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4udXNlcl9jb250ZXh0XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBDb250ZXh0TW9kZS5JTlRFUk5BTDpcbiAgICAgICAgICAgICAgICBjb250ZXh0ID0gaW50ZXJuYWxfY29udGV4dDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQ29udGV4dE1vZGUuRFlOQU1JQzpcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VyVGVtcGxhdGVQYXJzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcl9jb250ZXh0ID0gYXdhaXQgdGhpcy51c2VyVGVtcGxhdGVQYXJzZXIuZ2VuZXJhdGVDb250ZXh0KGZpbGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250ZXh0ID0ge1xuICAgICAgICAgICAgICAgICAgICBkeW5hbWljOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5pbnRlcm5hbF9jb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnVzZXJfY29udGV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQ29udGV4dE1vZGUuVVNFUl9JTlRFUk5BTDpcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VyVGVtcGxhdGVQYXJzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcl9jb250ZXh0ID0gYXdhaXQgdGhpcy51c2VyVGVtcGxhdGVQYXJzZXIuZ2VuZXJhdGVDb250ZXh0KGZpbGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250ZXh0ID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi5pbnRlcm5hbF9jb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICB1c2VyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi51c2VyX2NvbnRleHRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29udGV4dFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIHBhcnNlVGVtcGxhdGVzKGNvbnRlbnQ6IHN0cmluZywgZmlsZTogVEZpbGUsIGNvbnRleHRfbW9kZTogQ29udGV4dE1vZGUpIHtcbiAgICAgICAgbGV0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdlbmVyYXRlQ29udGV4dChmaWxlLCBjb250ZXh0X21vZGUpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb250ZW50ID0gYXdhaXQgRXRhLnJlbmRlckFzeW5jKGNvbnRlbnQsIGNvbnRleHQsIHtcbiAgICAgICAgICAgICAgICB2YXJOYW1lOiBcInRwXCIsXG4gICAgICAgICAgICAgICAgcGFyc2U6IHtcbiAgICAgICAgICAgICAgICAgICAgZXhlYzogXCIqXCIsXG4gICAgICAgICAgICAgICAgICAgIGludGVycG9sYXRlOiBcIn5cIixcbiAgICAgICAgICAgICAgICAgICAgcmF3OiBcIlwiLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYXV0b1RyaW06IGZhbHNlLFxuICAgICAgICAgICAgICAgIGdsb2JhbEF3YWl0OiB0cnVlLFxuICAgICAgICAgICAgfSkgYXMgc3RyaW5nO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sb2dfZXJyb3IoXCJUZW1wbGF0ZSBwYXJzaW5nIGVycm9yLCBhYm9ydGluZy5cIiwgZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfVxuXG4gICAgcmVwbGFjZV9pbl9hY3RpdmVfZmlsZSgpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0bGV0IGFjdGl2ZV92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcblx0XHRcdGlmIChhY3RpdmVfdmlldyA9PT0gbnVsbCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBY3RpdmUgdmlldyBpcyBudWxsXCIpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZXBsYWNlX3RlbXBsYXRlc19hbmRfb3ZlcndyaXRlX2luX2ZpbGUoYWN0aXZlX3ZpZXcuZmlsZSk7XG5cdFx0fVxuXHRcdGNhdGNoKGVycm9yKSB7XG5cdFx0XHR0aGlzLnBsdWdpbi5sb2dfZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG4gICAgYXN5bmMgY3JlYXRlX25ld19ub3RlX2Zyb21fdGVtcGxhdGUodGVtcGxhdGVfZmlsZTogVEZpbGUpIHtcbiAgICAgICAgbGV0IHRlbXBsYXRlX2NvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHRlbXBsYXRlX2ZpbGUpO1xuICAgICAgICBsZXQgY3JlYXRlZF9ub3RlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKFwiVW50aXRsZWQubWRcIiwgXCJcIik7XG4gICAgICAgIGxldCBjb250ZW50ID0gYXdhaXQgdGhpcy5wbHVnaW4ucGFyc2VyLnBhcnNlVGVtcGxhdGVzKHRlbXBsYXRlX2NvbnRlbnQsIGNyZWF0ZWRfbm90ZSwgQ29udGV4dE1vZGUuVVNFUl9JTlRFUk5BTCk7XG4gICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShjcmVhdGVkX25vdGUsIGNvbnRlbnQpO1xuXG4gICAgICAgIGxldCBhY3RpdmVfbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmO1xuICAgICAgICBpZiAoIWFjdGl2ZV9sZWFmKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBhY3RpdmUgbGVhZlwiKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBhY3RpdmVfbGVhZi5vcGVuRmlsZShjcmVhdGVkX25vdGUsIHtzdGF0ZToge21vZGU6ICdzb3VyY2UnfSwgZVN0YXRlOiB7cmVuYW1lOiAnYWxsJ319KTtcbiAgICB9XG5cbiAgICBhc3luYyByZXBsYWNlX3RlbXBsYXRlc19hbmRfYXBwZW5kKHRlbXBsYXRlX2ZpbGU6IFRGaWxlKSB7XG4gICAgICAgIGxldCBhY3RpdmVfdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIGlmIChhY3RpdmVfdmlldyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gYWN0aXZlIHZpZXcsIGNhbid0IGFwcGVuZCB0ZW1wbGF0ZXMuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGVkaXRvciA9IGFjdGl2ZV92aWV3LmVkaXRvcjtcbiAgICAgICAgbGV0IGRvYyA9IGVkaXRvci5nZXREb2MoKTtcblxuICAgICAgICBsZXQgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGVtcGxhdGVfZmlsZSk7XG4gICAgICAgIGNvbnRlbnQgPSBhd2FpdCB0aGlzLnBhcnNlVGVtcGxhdGVzKGNvbnRlbnQsIGFjdGl2ZV92aWV3LmZpbGUsIENvbnRleHRNb2RlLlVTRVJfSU5URVJOQUwpO1xuICAgICAgICBcbiAgICAgICAgZG9jLnJlcGxhY2VTZWxlY3Rpb24oY29udGVudCk7XG5cbiAgICAgICAgYXdhaXQgdGhpcy5qdW1wX3RvX25leHRfY3Vyc29yX2xvY2F0aW9uKCk7XG4gICAgICAgIGVkaXRvci5mb2N1cygpO1xuICAgIH1cblxuICAgIGFzeW5jIHJlcGxhY2VfdGVtcGxhdGVzX2FuZF9vdmVyd3JpdGVfaW5fZmlsZShmaWxlOiBURmlsZSkge1xuICAgICAgICBsZXQgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGxldCBuZXdfY29udGVudCA9IGF3YWl0IHRoaXMucGFyc2VUZW1wbGF0ZXMoY29udGVudCwgZmlsZSwgQ29udGV4dE1vZGUuVVNFUl9JTlRFUk5BTCk7XG5cbiAgICAgICAgaWYgKG5ld19jb250ZW50ICE9PSBjb250ZW50KSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgbmV3X2NvbnRlbnQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSA9PT0gZmlsZSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuanVtcF90b19uZXh0X2N1cnNvcl9sb2NhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMganVtcF90b19uZXh0X2N1cnNvcl9sb2NhdGlvbigpIHtcbiAgICAgICAgbGV0IGFjdGl2ZV92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgaWYgKGFjdGl2ZV92aWV3ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBhY3RpdmUgdmlldywgY2FuJ3QgYXBwZW5kIHRlbXBsYXRlcy5cIik7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFjdGl2ZV9maWxlID0gYWN0aXZlX3ZpZXcuZmlsZTtcbiAgICAgICAgYXdhaXQgYWN0aXZlX3ZpZXcuc2F2ZSgpO1xuXG4gICAgICAgIGxldCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChhY3RpdmVfZmlsZSk7XG5cbiAgICAgICAgbGV0IHBvcyA9IHRoaXMuZ2V0X2N1cnNvcl9wb3NpdGlvbihjb250ZW50KTtcbiAgICAgICAgaWYgKHBvcykge1xuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShuZXcgUmVnRXhwKFRQX0ZJTEVfQ1VSU09SKSwgXCJcIik7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoYWN0aXZlX2ZpbGUsIGNvbnRlbnQpO1xuICAgICAgICAgICAgdGhpcy5zZXRfY3Vyc29yX2xvY2F0aW9uKHBvcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRfY3Vyc29yX3Bvc2l0aW9uKGNvbnRlbnQ6IHN0cmluZyk6IEVkaXRvclBvc2l0aW9uIHtcbiAgICAgICAgbGV0IHBvczogRWRpdG9yUG9zaXRpb24gPSBudWxsO1xuICAgICAgICBsZXQgaW5kZXggPSBjb250ZW50LmluZGV4T2YoVFBfRklMRV9DVVJTT1IpO1xuXG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxldCBzdWJzdHIgPSBjb250ZW50LnN1YnN0cigwLCBpbmRleCk7XG5cbiAgICAgICAgICAgIGxldCBsID0gMDtcbiAgICAgICAgICAgIGxldCBvZmZzZXQgPSAtMTtcbiAgICAgICAgICAgIGxldCByID0gLTE7XG4gICAgICAgICAgICBmb3IgKDsgKHIgPSBzdWJzdHIuaW5kZXhPZihcIlxcblwiLCByKzEpKSAhPT0gLTEgOyBsKyssIG9mZnNldD1yKTtcbiAgICAgICAgICAgIG9mZnNldCArPSAxO1xuXG4gICAgICAgICAgICBsZXQgY2ggPSBjb250ZW50LnN1YnN0cihvZmZzZXQsIGluZGV4LW9mZnNldCkubGVuZ3RoO1xuXG4gICAgICAgICAgICBwb3MgPSB7bGluZTogbCwgY2g6IGNofTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG9zO1xuICAgIH1cblxuICAgIHNldF9jdXJzb3JfbG9jYXRpb24ocG9zOiBFZGl0b3JQb3NpdGlvbikge1xuICAgICAgICBpZiAoIXBvcykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGFjdGl2ZV92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgaWYgKGFjdGl2ZV92aWV3ID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGVkaXRvciA9IGFjdGl2ZV92aWV3LmVkaXRvcjtcblxuICAgICAgICBlZGl0b3IuZm9jdXMoKTtcbiAgICAgICAgLy8gVE9ETzogUmVwbGFjZSB3aXRoIHNldEN1cnNvciBpbiBuZXh0IHJlbGVhc2VcbiAgICAgICAgZWRpdG9yLnNldEN1cnNvcihwb3MpO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBNYXJrZG93blZpZXcsIE5vdGljZSwgUGx1Z2luLCBUQWJzdHJhY3RGaWxlLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcclxuXHJcbmltcG9ydCB7IERFRkFVTFRfU0VUVElOR1MsIFRlbXBsYXRlclNldHRpbmdzLCBUZW1wbGF0ZXJTZXR0aW5nVGFiIH0gZnJvbSAnU2V0dGluZ3MnO1xyXG5pbXBvcnQgeyBUZW1wbGF0ZXJGdXp6eVN1Z2dlc3RNb2RhbCB9IGZyb20gJ1RlbXBsYXRlckZ1enp5U3VnZ2VzdCc7XHJcbmltcG9ydCB7IENvbnRleHRNb2RlLCBUZW1wbGF0ZVBhcnNlciB9IGZyb20gJ1RlbXBsYXRlUGFyc2VyJztcclxuaW1wb3J0IHsgZGVsYXkgfSBmcm9tICdUUGFyc2VyJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRlbXBsYXRlclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcblx0cHVibGljIGZ1enp5U3VnZ2VzdDogVGVtcGxhdGVyRnV6enlTdWdnZXN0TW9kYWw7XHJcblx0cHVibGljIHNldHRpbmdzOiBUZW1wbGF0ZXJTZXR0aW5nczsgXHJcblx0cHVibGljIHBhcnNlcjogVGVtcGxhdGVQYXJzZXJcclxuXHJcblx0YXN5bmMgb25sb2FkKCkge1xyXG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuXHJcblx0XHQvLyBUT0RPOiBSZW1vdmUgdGhpc1xyXG5cdFx0bGV0IG5vdGljZSA9IG5ldyBOb3RpY2UoXCJcIiwgMTUwMDApO1xyXG5cdFx0bm90aWNlLm5vdGljZUVsLmlubmVySFRNTCA9IGBXaGF0PyBUZW1wbGF0ZXIgaXMgPGI+ZXZvbHZpbmc8L2I+ITxici8+XHJcblRoZSB0ZW1wbGF0ZSBzeW50YXggY2hhbmdlZCBpbiB0aGlzIHJlbGVhc2UsIGNoZWNrIG91dCB0aGUgbmV3IGRvY3VtZW50YXRpb24gZm9yIGl0IG9uIDxhIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vU2lsZW50Vm9pZDEzL1RlbXBsYXRlciN0ZW1wbGF0ZXItb2JzaWRpYW4tcGx1Z2luXCI+VGVtcGxhdGVyJ3MgR2l0aHViPC9hPiBvciBpbiB0aGUgY29tbXVuaXR5IHBsdWdpbnMgcGFnZS48YnIvPlxyXG5FbmpveSBuZXcgZmVhdHVyZXMgZm9yIFRlbXBsYXRlcjogbmV3IGludGVybmFsIHRlbXBsYXRlcywgdXNlciB0ZW1wbGF0ZXMgYXJndW1lbnRzLCBjb25kaXRpb25hbCBzdGF0ZW1lbnRzIGFuZCBtb3JlLjxici8+XHJcbkV2ZXJ5IGFscmVhZHkgZXhpc3RpbmcgZmVhdHVyZSBzdGlsbCBleGlzdHMgb2YgY291cnNlLCB5b3UganVzdCBuZWVkIHRvIHVwZGF0ZSB0aGUgc3ludGF4IGluIHlvdXIgdGVtcGxhdGVzIGZpbGVzLjxici8+XHJcblRoYW5rcyBmb3IgdXNpbmcgVGVtcGxhdGVyISBTaWxlbnRWb2lkLjxici8+XHJcbllvdSBjYW4gYWxzbyBmaW5kIHRoaXMgbWVzc2FnZSBpbiB0aGUgc2V0dGluZ3Mgb2YgVGVtcGxhdGVyLiBUaGlzIG1lc3NhZ2Ugd2lsbCBzZWxmLWRlc3RydWN0IGluIHRoZSBuZXh0IHVwZGF0ZS5gO1xyXG5cclxuXHRcdHRoaXMuZnV6enlTdWdnZXN0ID0gbmV3IFRlbXBsYXRlckZ1enp5U3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcclxuXHRcdHRoaXMucGFyc2VyID0gbmV3IFRlbXBsYXRlUGFyc2VyKHRoaXMuYXBwLCB0aGlzKTtcclxuXHJcblx0XHR0aGlzLnJlZ2lzdGVyTWFya2Rvd25Qb3N0UHJvY2Vzc29yKChlbCwgY3R4KSA9PiB0aGlzLmR5bmFtaWNfdGVtcGxhdGVzX3Byb2Nlc3NvcihlbCwgY3R4KSk7XHJcblxyXG5cdFx0dGhpcy5hZGRSaWJib25JY29uKCd0aHJlZS1ob3Jpem9udGFsLWJhcnMnLCAnVGVtcGxhdGVyJywgYXN5bmMgKCkgPT4ge1xyXG5cdFx0XHR0aGlzLmZ1enp5U3VnZ2VzdC5pbnNlcnRfdGVtcGxhdGUoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcblx0XHRcdGlkOiBcImluc2VydC10ZW1wbGF0ZXJcIixcclxuXHRcdFx0bmFtZTogXCJJbnNlcnQgVGVtcGxhdGVcIixcclxuXHRcdFx0aG90a2V5czogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG1vZGlmaWVyczogW1wiQWx0XCJdLFxyXG5cdFx0XHRcdFx0a2V5OiAnZScsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XSxcclxuXHRcdFx0Y2FsbGJhY2s6ICgpID0+IHtcclxuXHRcdFx0XHR0aGlzLmZ1enp5U3VnZ2VzdC5pbnNlcnRfdGVtcGxhdGUoKTtcclxuXHRcdFx0fSxcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgICAgICAgIGlkOiBcInJlcGxhY2UtaW4tZmlsZS10ZW1wbGF0ZXJcIixcclxuICAgICAgICAgICAgbmFtZTogXCJSZXBsYWNlIHRlbXBsYXRlcyBpbiB0aGUgYWN0aXZlIGZpbGVcIixcclxuICAgICAgICAgICAgaG90a2V5czogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVyczogW1wiQWx0XCJdLFxyXG4gICAgICAgICAgICAgICAgICAgIGtleTogJ3InLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuXHRcdFx0XHR0aGlzLnBhcnNlci5yZXBsYWNlX2luX2FjdGl2ZV9maWxlKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcclxuXHRcdFx0aWQ6IFwianVtcC10by1uZXh0LWN1cnNvci1sb2NhdGlvblwiLFxyXG5cdFx0XHRuYW1lOiBcIkp1bXAgdG8gbmV4dCBjdXJzb3IgbG9jYXRpb25cIixcclxuXHRcdFx0aG90a2V5czogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG1vZGlmaWVyczogW1wiQWx0XCJdLFxyXG5cdFx0XHRcdFx0a2V5OiBcIlRhYlwiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHRcdGNhbGxiYWNrOiAoKSA9PiB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHRoaXMucGFyc2VyLmp1bXBfdG9fbmV4dF9jdXJzb3JfbG9jYXRpb24oKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2F0Y2goZXJyb3IpIHtcclxuXHRcdFx0XHRcdHRoaXMubG9nX2Vycm9yKGVycm9yKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcblx0XHRcdGlkOiBcImNyZWF0ZS1uZXctbm90ZS1mcm9tLXRlbXBsYXRlXCIsXHJcblx0XHRcdG5hbWU6IFwiQ3JlYXRlIG5ldyBub3RlIGZyb20gdGVtcGxhdGVcIixcclxuXHRcdFx0aG90a2V5czogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG1vZGlmaWVyczogW1wiQWx0XCJdLFxyXG5cdFx0XHRcdFx0a2V5OiBcIm5cIixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0XHRjYWxsYmFjazogKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMuZnV6enlTdWdnZXN0LmNyZWF0ZV9uZXdfbm90ZV9mcm9tX3RlbXBsYXRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImxheW91dC1yZWFkeVwiLCAoKSA9PiB7XHJcblx0XHRcdC8vIFRPRE86IEZpbmQgYSB3YXkgdG8gbm90IHRyaWdnZXIgdGhpcyBvbiBmaWxlcyBjb3B5XHJcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKFwiY3JlYXRlXCIsIGFzeW5jIChmaWxlOiBUQWJzdHJhY3RGaWxlKSA9PiB7XHJcblx0XHRcdFx0Ly8gVE9ETzogZmluZCBhIGJldHRlciB3YXkgdG8gZG8gdGhpc1xyXG5cdFx0XHRcdC8vIEN1cnJlbnRseSwgSSBoYXZlIHRvIHdhaXQgZm9yIHRoZSBkYWlseSBub3RlIHBsdWdpbiB0byBhZGQgdGhlIGZpbGUgY29udGVudCBiZWZvcmUgcmVwbGFjaW5nXHJcblx0XHRcdFx0Ly8gTm90IGEgcHJvYmxlbSB3aXRoIENhbGVuZGFyIGhvd2V2ZXIgc2luY2UgaXQgY3JlYXRlcyB0aGUgZmlsZSB3aXRoIHRoZSBleGlzdGluZyBjb250ZW50XHJcblx0XHRcdFx0YXdhaXQgZGVsYXkoMzAwKTtcclxuXHRcdFx0XHQvLyAhIFRoaXMgY291bGQgY29ycnVwdCBiaW5hcnkgZmlsZXNcclxuXHRcdFx0XHRpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5wYXJzZXIucmVwbGFjZV90ZW1wbGF0ZXNfYW5kX292ZXJ3cml0ZV9pbl9maWxlKGZpbGUpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgVGVtcGxhdGVyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cdH1cclxuXHJcblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuXHR9XHJcblxyXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG5cdH1cdFxyXG5cclxuXHRsb2dfZXJyb3IobXNnOiBzdHJpbmcsIGVycm9yPzogc3RyaW5nKSB7XHJcblx0XHRpZiAoZXJyb3IpIHtcclxuXHRcdFx0Y29uc29sZS5lcnJvcihtc2csIGVycm9yKTtcclxuXHRcdFx0bmV3IE5vdGljZShgVGVtcGxhdGVyIEVycm9yOiAke21zZ31cXG5DaGVjayBjb25zb2xlIGZvciBtb3JlIGluZm9ybWF0aW9uc2ApO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoYFRlbXBsYXRlciBFcnJvcjogJHttc2d9YCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRhc3luYyBkeW5hbWljX3RlbXBsYXRlc19wcm9jZXNzb3IoZWw6IEhUTUxFbGVtZW50LCBjdHg6IGFueSkge1xyXG5cdFx0aWYgKGVsLnRleHRDb250ZW50LmNvbnRhaW5zKFwidHAuZHluYW1pY1wiKSkge1xyXG5cdFx0XHQvLyBUT0RPOiBUaGlzIHdpbGwgbm90IGFsd2F5cyBiZSB0aGUgYWN0aXZlIGZpbGUsIFxyXG5cdFx0XHQvLyBJIG5lZWQgdG8gdXNlIGdldEZpcnN0TGlua3BhdGhEZXN0IGFuZCBjdHggdG8gZmluZCB0aGUgYWN0dWFsIGZpbGVcclxuXHRcdFx0bGV0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG5cclxuXHRcdFx0bGV0IG5ld19odG1sID0gYXdhaXQgdGhpcy5wYXJzZXIucGFyc2VUZW1wbGF0ZXMoXHJcblx0XHRcdFx0ZWwuaW5uZXJIVE1MLCBcclxuXHRcdFx0XHRmaWxlLCBcclxuXHRcdFx0XHRDb250ZXh0TW9kZS5EWU5BTUlDXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPSBuZXdfaHRtbDtcclxuXHRcdH1cclxuXHR9XHJcbn07Il0sIm5hbWVzIjpbIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiRnV6enlTdWdnZXN0TW9kYWwiLCJub3JtYWxpemVQYXRoIiwiVEZvbGRlciIsIlZhdWx0IiwiVEZpbGUiLCJ0aGlzIiwiRmlsZVN5c3RlbUFkYXB0ZXIiLCJNYXJrZG93blZpZXciLCJnZXRBbGxUYWdzIiwicHJvbWlzaWZ5IiwiZXhlYyIsIkV0YS5yZW5kZXJBc3luYyIsIlBsdWdpbiIsIk5vdGljZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxD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QyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2hDO0tBQ0o7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDekZMLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQXNELENBQUMsQ0FBQyxPQUFPLEVBQTZILENBQUMsQ0FBQ0MsY0FBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQWMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxFQUFFLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLG9FQUFvRSxDQUFDLENBQUMsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDLENBQUMsbUNBQW1DLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsZUFBZSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEVBQUMsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLDRCQUE0QixDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsb0NBQW9DLENBQUMsRUFBRSxDQUFDLENBQUMsd0NBQXdDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsRUFBRSxzQ0FBcUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxLQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGdDQUFnQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLFFBQVEsQ0FBQyx5Q0FBeUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxXQUFXLENBQUMsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksV0FBVyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsdUVBQXVFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMs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
