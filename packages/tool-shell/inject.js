var fs = require("fs");
var path = require("path");

var TOOLS_JSON = path.resolve(process.cwd(), "data/tools.json");
var SEO_SITE_URL = process.env.SEO_SITE_URL || "https://toolsbox.ai";
var SEO_DEFAULT_REGION = process.env.SEO_DEFAULT_REGION || "CN-31";
var SEO_DEFAULT_PLACENAME = process.env.SEO_DEFAULT_PLACENAME || "Shanghai";

var SHELL_CSS = `
<style id="toolbox-shell-styles">
:root{
  --tb-bg:#070d18;--tb-surface:#0f1b31;--tb-surface-soft:#162744;--tb-text:#ebf2ff;
  --tb-text-muted:#99abd1;--tb-accent:#ff7a45;--tb-accent-2:#ffb066;--tb-border:#253a63;
  --tb-radius:14px;--tb-shadow:0 12px 30px rgba(7,13,24,.45);
}
html,body{background:radial-gradient(1200px 500px at 50% -20%,#1a2f57 0%,#070d18 58%) fixed !important;color:var(--tb-text) !important;}
#toolbox-shell{
  position:fixed;top:0;left:0;right:0;height:56px;
  background:linear-gradient(120deg,var(--tb-surface) 0%,var(--tb-surface-soft) 100%);
  color:var(--tb-text);display:flex;align-items:center;padding:0 16px;z-index:99999;
  font-family:'IBM Plex Sans','Segoe UI',sans-serif;font-size:14px;gap:12px;
  box-shadow:var(--tb-shadow);border-bottom:1px solid var(--tb-border);backdrop-filter:blur(10px);
}
#toolbox-shell button{
  background:transparent;border:1px solid transparent;color:var(--tb-text);cursor:pointer;font-size:16px;
  padding:7px 10px;border-radius:10px;transition:all .2s ease;
}
#toolbox-shell button:hover{background:rgba(255,255,255,.08);border-color:var(--tb-border);}
#toolbox-tool-name{font-weight:700;font-size:14px;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw;}
#toolbox-shell-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
#toolbox-points{
  background:linear-gradient(120deg,var(--tb-accent) 0%,var(--tb-accent-2) 100%);
  padding:5px 12px;border-radius:999px;font-size:12px;font-weight:800;color:#2a180b;
}
#toolbox-free-remaining{font-size:11px;color:var(--tb-text-muted);}

/* Unified tool canvas primitives */
body{padding-top:56px !important;font-family:'IBM Plex Sans','Segoe UI',sans-serif !important;}
.container,.c{max-width:1120px !important;margin:0 auto !important;padding:20px !important;}
.actions{bottom:18px !important;}
button:not(#toolbox-shell button){
  border:none !important;border-radius:12px !important;padding:10px 16px !important;
  background:linear-gradient(120deg,var(--tb-accent),var(--tb-accent-2)) !important;color:#1b120a !important;
  font-weight:700 !important;box-shadow:0 4px 14px rgba(255,122,69,.25) !important;
}
button.secondary{
  background:linear-gradient(120deg,#1a2846,#21355a) !important;color:var(--tb-text) !important;
  border:1px solid var(--tb-border) !important;box-shadow:none !important;
}
input,textarea,select{
  background:#0f1b31 !important;border:1px solid var(--tb-border) !important;color:var(--tb-text) !important;
  border-radius:12px !important;
}
h1,h2,h3,h4,label{font-family:'IBM Plex Sans','Segoe UI',sans-serif !important;}
h3,label{color:#ff9a6b !important;}
</style>`;

var SHELL_HTML = `
<!-- toolbox:shell:start -->
<div id="toolbox-shell">
  <button onclick="history.back()" title="Back">&#8592;</button>
  <button onclick="window.location.href='/'" title="Home">&#8962;</button>
  <span id="toolbox-tool-name">ToolBox Tool</span>
  <div id="toolbox-shell-right">
    <span id="toolbox-free-remaining"></span>
    <span id="toolbox-points">0 pts</span>
  </div>
</div>
<!-- toolbox:shell:end -->`;

var BRIDGE_SCRIPT_TAG = '<script src="/bridge.js" data-tool-id="TOOL_ID_PLACEHOLDER"><\\/script>';

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugToWords(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1); })
    .join(" ");
}

function loadToolsMap() {
  var map = {};
  try {
    var raw = fs.readFileSync(TOOLS_JSON, "utf-8");
    var arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach(function (t) {
        if (t && t.id) map[String(t.id)] = t;
      });
    }
  } catch (e) {
    console.log("Warning: cannot load tools metadata from", TOOLS_JSON);
  }
  return map;
}

function buildSeoBlock(toolId, toolMeta, category) {
  var name = (toolMeta && (toolMeta.name_zh || toolMeta.name)) || slugToWords(toolId);
  var nameEn = (toolMeta && (toolMeta.name || toolMeta.name_zh)) || slugToWords(toolId);
  var desc = (toolMeta && (toolMeta.description_zh || toolMeta.description)) || ("在线使用 " + name + "，快速完成处理。");
  var descEn = (toolMeta && (toolMeta.description || toolMeta.description_zh)) || ("Use " + nameEn + " online for fast processing.");
  var tags = (toolMeta && Array.isArray(toolMeta.tags) ? toolMeta.tags : []).slice(0, 8).join(", ");
  var canonical = SEO_SITE_URL.replace(/\/+$/, "") + "/tools/" + encodeURIComponent(toolId);
  var title = escapeHtml(name + " | ToolBox");
  var description = escapeHtml(desc + (tags ? " 关键词: " + tags : ""));
  var jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": nameEn,
    "applicationCategory": category || "UtilitiesApplication",
    "operatingSystem": "Web",
    "url": canonical,
    "description": descEn,
    "inLanguage": ["zh-CN", "en"],
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "CNY"
    },
    "publisher": {
      "@type": "Organization",
      "name": "ToolBox"
    }
  };

  return [
    '<!-- toolbox:seo-geo:start -->',
    '<title>' + title + '</title>',
    '<meta name="description" content="' + description + '">',
    '<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">',
    '<link rel="canonical" href="' + canonical + '">',
    '<link rel="alternate" hreflang="zh-CN" href="' + canonical + '?lang=zh-CN">',
    '<link rel="alternate" hreflang="en" href="' + canonical + '?lang=en">',
    '<link rel="alternate" hreflang="x-default" href="' + canonical + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="ToolBox">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:url" content="' + canonical + '">',
    '<meta property="og:locale" content="zh_CN">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + title + '">',
    '<meta name="twitter:description" content="' + description + '">',
    '<meta name="geo.region" content="' + escapeHtml(SEO_DEFAULT_REGION) + '">',
    '<meta name="geo.placename" content="' + escapeHtml(SEO_DEFAULT_PLACENAME) + '">',
    '<meta name="ICBM" content="31.2304,121.4737">',
    '<script type="application/ld+json" id="toolbox-jsonld">' + JSON.stringify(jsonLd) + '<\\/script>',
    '<!-- toolbox:seo-geo:end -->'
  ].join("\n");
}

function stripOldShell(html) {
  html = html.replace(/<!-- toolbox:shell:start -->[\s\S]*?<!-- toolbox:shell:end -->/gi, "");
  html = html.replace(/<style id="toolbox-shell-styles">[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<div id="toolbox-shell">[\s\S]*?<\/div>/gi, "");
  html = html.replace(/<script src="\/bridge\.js" data-tool-id="[^"]*"><\\\/script>/gi, "");
  html = html.replace(/<script src="\/bridge\.js" data-tool-id="[^"]*"><\/script>/gi, "");
  html = html.replace(/<!-- toolbox:seo-geo:start -->[\s\S]*?<!-- toolbox:seo-geo:end -->/gi, "");
  html = html.replace(/<script type="application\/ld\+json" id="toolbox-jsonld">[\s\S]*?<\/script>/gi, "");
  // Cleanup historic leftovers from old shell regex stripping (orphan closing divs right after <body>)
  html = html.replace(/(<body[^>]*>\s*)(<\/div>\s*){1,3}/i, "$1");
  return html;
}

function injectShell(htmlFilePath, toolId, toolMeta, category) {
  var html = fs.readFileSync(htmlFilePath, "utf-8");
  html = stripOldShell(html);

  if (!html.includes("</head>")) html = "<head></head>" + html;
  var seoBlock = buildSeoBlock(toolId, toolMeta, category);
  html = html.replace("</head>", seoBlock + "\n" + SHELL_CSS + "\n</head>");

  if (!html.match(/<body[^>]*>/i)) html = html.replace("</head>", "</head><body>");
  html = html.replace(/<body[^>]*>/i, function (match) {
    return match + "\n" + SHELL_HTML;
  });

  var bridgeTag = BRIDGE_SCRIPT_TAG.replace("TOOL_ID_PLACEHOLDER", toolId);
  if (html.includes("</body>")) {
    html = html.replace("</body>", bridgeTag + "\n</body>");
  } else {
    html += "\n" + bridgeTag;
  }

  fs.writeFileSync(htmlFilePath, html, "utf-8");
  console.log("  Unified:", htmlFilePath);
}

function processDirectory(dir, toolsMap) {
  var entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.log("  Skip directory:", dir);
    return;
  }

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath, toolsMap);
    } else if (entry.name === "index.html") {
      var toolId = path.basename(path.dirname(fullPath));
      var category = path.basename(path.dirname(path.dirname(fullPath)));
      injectShell(fullPath, toolId, toolsMap[toolId], category);
    }
  }
}

var toolsDir = process.argv[2] || "./tools";
var toolsMap = loadToolsMap();
console.log("Rebuilding unified tool shell for:", toolsDir);
processDirectory(toolsDir, toolsMap);
console.log("Done.");
