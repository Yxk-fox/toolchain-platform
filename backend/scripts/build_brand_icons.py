#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_brand_icons.py — 生成自包含的品牌图标模块 frontend/js/brand-icons.js

数据源（构建期拉取，运行期零依赖）：
  1. uil 图标库（Unicons, Iconify 前缀 uil）——优先使用
  2. simple-icons（官方品牌图形，uil 缺失时回退），品牌色取自 simple-icons 官方元数据

用法：
  python3 build_brand_icons.py            # 使用缓存/自动下载
  python3 build_brand_icons.py --refresh  # 强制重新下载图标数据

扩展：在下方 CURATED 中新增 (key, 来源, 别名) 后重跑本脚本即可。
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".icon-cache")
OUT = os.path.join(HERE, "..", "..", "frontend", "js", "brand-icons.js")

UIL_URL = "https://cdn.jsdelivr.net/npm/@iconify-json/uil@1/icons.json"
SI_URL = "https://cdn.jsdelivr.net/npm/@iconify-json/simple-icons@1/icons.json"
SI_META_URL = "https://cdn.jsdelivr.net/npm/simple-icons@13/_data/simple-icons.json"


def fetch(url, cache_name, refresh=False):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, cache_name)
    if refresh or not os.path.exists(path):
        print("downloading", url)
        with urllib.request.urlopen(url, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ============ 程序清单：key -> (来源, 图标名/slug, 品牌色None=自动, 别名列表) ============
# 来源 "uil" 优先；"si" 为 simple-icons 回退；"gen" 为 uil 通用图形（非品牌）
CURATED = {
    # --- 版本控制 / CI / DevOps ---
    "git":         ("si", "git", None, ["git版本控制"]),
    "github":      ("uil", "github", "#181717", []),
    "gitlab":      ("uil", "gitlab", "#FC6D26", []),
    "jenkins":     ("si", "jenkins", None, []),
    "docker":      ("uil", "docker", "#2496ED", []),
    "kubernetes":  ("si", "kubernetes", None, ["k8s"]),
    "rancher":     ("si", "rancher", None, []),
    "portainer":   ("si", "portainer", None, []),
    "grafana":     ("si", "grafana", None, []),
    "prometheus":  ("si", "prometheus", None, []),
    # --- 数据库 / 中间件 ---
    "nginx":       ("si", "nginx", None, []),
    "redis":       ("si", "redis", None, []),
    "mysql":       ("si", "mysql", None, []),
    "postgresql":  ("si", "postgresql", None, ["postgres"]),
    "mongodb":     ("si", "mongodb", None, ["mongo"]),
    "elasticsearch": ("si", "elasticsearch", None, []),
    "kafka":       ("si", "apachekafka", None, []),
    "rabbitmq":    ("si", "rabbitmq", None, []),
    "minio":       ("si", "minio", None, []),
    "etcd":        ("si", "etcd", None, []),
    # --- 云平台 / 托管服务 ---
    "supabase":    ("si", "supabase", None, []),
    "vercel":      ("si", "vercel", None, []),
    "netlify":     ("si", "netlify", None, []),
    "aws":         ("si", "amazonwebservices", None, ["amazon", "amazonweb", "ec2"]),
    "azure":       ("si", "microsoftazure", "#0078D7", []),
    "googlecloud": ("si", "googlecloud", None, ["gcp"]),
    "alibabacloud": ("si", "alibabacloud", None, ["阿里云", "aliyun", "alibaba"]),
    "cloudflare":  ("si", "cloudflare", None, []),
    "heroku":      ("si", "heroku", None, []),
    "firebase":    ("si", "firebase", None, []),
    "digitalocean": ("si", "digitalocean", None, []),
    "openai":      ("si", "openai", None, ["chatgpt"]),
    "ollama":      ("si", "ollama", None, []),
    "huggingface": ("si", "huggingface", None, []),
    # --- 语言 / 框架 ---
    "python":      ("si", "python", None, []),
    "nodejs":      ("si", "nodedotjs", None, ["node"]),
    "javascript":  ("si", "javascript", None, []),
    "typescript":  ("si", "typescript", None, ["ts"]),
    "vue":         ("si", "vuedotjs", None, ["vuejs"]),
    "react":       ("uil", "react", "#61DAFB", []),
    "go":          ("si", "go", None, ["golang"]),
    "rust":        ("si", "rust", None, []),
    "spring":      ("si", "spring", None, ["springboot"]),
    "php":         ("si", "php", None, []),
    "laravel":     ("si", "laravel", None, []),
    "django":      ("si", "django", None, []),
    "flask":       ("uil", "flask", "#000000", []),
    "html5":       ("uil", "html5", "#E34F26", []),
    "css3":        ("si", "css3", "#1572B6", ["css"]),
    "swift":       ("si", "swift", None, []),
    "kotlin":      ("si", "kotlin", None, []),
    "electron":    ("si", "electron", None, []),
    # --- 开发工具 ---
    "vscode":      ("si", "visualstudiocode", "#007ACC", ["code", "visualstudiocode"]),
    "postman":     ("si", "postman", None, []),
    "swagger":     ("si", "swagger", None, []),
    "openapi":     ("si", "openapiinitiative", None, []),
    "jetbrains":   ("si", "jetbrains", None, ["idea", "intellij", "webstorm", "pycharm"]),
    "notepad++":   ("si", "notepadplusplus", "#90E59A", ["notepad"]),
    "figma":       ("si", "figma", None, []),
    "jira":        ("si", "jira", None, []),
    "confluence":  ("si", "confluence", None, []),
    "bitbucket":   ("si", "bitbucket", None, []),
    "nvidia":      ("si", "nvidia", None, ["gpu"]),
    # --- 协作 / 常用应用 ---
    "slack":       ("uil", "slack", "#4A154B", []),
    "wechat":      ("si", "wechat", None, ["微信", "weixin"]),
    "qq":          ("si", "qq", "#EB1923", []),
    "baidu":       ("si", "baidu", None, ["百度"]),
    "wordpress":   ("uil", "wordpress", "#21759B", []),
    "dropbox":     ("uil", "dropbox", "#0061FF", []),
    "googledrive": ("uil", "google-drive", "#4285F4", ["网盘"]),
    "google":      ("uil", "google", "#4285F4", ["谷歌"]),
    "windows":     ("uil", "windows", "#0078D6", ["win"]),
    "apple":       ("uil", "apple", "#A2AAAD", ["macos", "mac"]),
    "linux":       ("uil", "linux", "#FCC624", ["ubuntu", "centos", "debian"]),
    "android":     ("uil", "android", "#3DDC84", []),
    # --- 支付 / 商业化 ---
    "stripe":      ("si", "stripe", None, []),
    "lemonsqueezy": ("si", "lemonsqueezy", None, ["lemon"]),
    "shopify":     ("si", "shopify", None, []),
    "paypal":      ("uil", "paypal", "#003087", []),
    # --- 本站定制 / 通用图形（uil 通用图标，非品牌）---
    "ugreen":      ("gen", "cloud", "#0068FF", ["绿联云", "绿联", "nas", "ug.link"]),
    "simone":      ("gen", "car", "#3B82F6", ["仿真", "模拟器"]),
    "mocktruck":   ("gen", "truck", "#7C3AED", []),
    "feishu":      ("gen", "cloud", "#3370FF", ["飞书", "lark", "feishu"]),
    "server":      ("gen", "server", "#7C3AED", ["服务器", "host"]),
    "cloud":       ("gen", "cloud", "#0EA5E9", ["云端"]),
    "database":    ("gen", "database", "#0EA5E9", ["数据库", "db"]),
    "map":         ("gen", "map", "#10B981", ["地图"]),
    "robot":       ("gen", "robot", "#7C3AED", ["机器人", "bot", "ai"]),
    "car":         ("gen", "car", "#3B82F6", ["车辆", "卡车", "truck"]),
}


def main():
    refresh = "--refresh" in sys.argv
    uil = fetch(UIL_URL, "uil.json", refresh)
    si = fetch(SI_URL, "simple-icons.json", refresh)
    si_meta = fetch(SI_META_URL, "simple-icons-meta.json", refresh)

    uil_icons = uil.get("icons", {})
    uil_aliases = uil.get("aliases", {})
    si_icons = si.get("icons", {})
    si_alias = {k: (v["parent"] if isinstance(v, dict) else v) for k, v in (si.get("aliases") or {}).items()}
    # 品牌色表（simple-icons 官方 hex）
    si_hex = {}
    for m in si_meta["icons"]:
        title = m["title"].lower()
        slug = m.get("slug", m["title"].lower().replace(" ", ""))
        si_hex[title] = "#" + m["hex"]
        si_hex[slug] = "#" + m["hex"]

    def si_icon(name):
        return si_icons.get(name) or si_icons.get(si_alias.get(name, ""))

    def si_color(slug, manual):
        if manual:
            return manual
        c = si_hex.get(slug) or si_hex.get(slug.replace("dot", "."))
        return c or "#7C3AED"

    icons, report, missing = {}, [], []
    for key, (src, name, color, aliases) in CURATED.items():
        body = None
        if src in ("uil", "gen"):
            body = uil_icons.get(name)
            if body is None and name in uil_aliases:
                body = uil_icons.get(uil_aliases[name])
        elif src == "si":
            body = si_icon(name)
        else:
            body = None
        if body is None:
            missing.append(key)
            continue
        if src == "si":
            c = si_color(name, color)
        else:
            c = color or "#7C3AED"
        icons[key] = {"c": c, "b": body["body"], "v": "0 0 24 24"}
        report.append("%-16s %-8s %-24s %s" % (key, src, name, c))

    if missing:
        print("WARNING missing icons:", missing)

    alias_map = {}
    for key, (src, name, color, aliases) in CURATED.items():
        if key not in icons:
            continue
        for a in aliases:
            alias_map[a.lower()] = key

    js_icons = json.dumps(icons, ensure_ascii=False, separators=(",", ":"))
    js_alias = json.dumps(alias_map, ensure_ascii=False, separators=(",", ":"))

    js = """/* eslint-disable */
/*
 * brand-icons.js — 知名程序品牌图标模块（AUTO-GENERATED，请勿手工编辑）
 * 由 backend/scripts/build_brand_icons.py 生成；扩展请编辑该脚本后重新运行。
 *
 * 图标来源：uil 图标库（Unicons）优先，uil 缺失时回退 simple-icons 官方品牌图形，
 * 品牌色取自 simple-icons 官方元数据。全部 SVG 内嵌，运行期零网络依赖。
 */
(function (global) {
  'use strict';

  // 图标数据：key -> { c: 品牌色, b: SVG body, v: viewBox }
  var ICONS = %s;
  // 别名 -> key（含中文别名与常见缩写）
  var ALIASES = %s;

  // 归一化：小写 + 去除空白
  function norm(s) {
    return (s || '').toLowerCase().replace(/\\s+/g, '');
  }

  // 全部可匹配键（含别名），按长度降序保证最长匹配优先
  var MATCH_KEYS = (function () {
    var keys = Object.keys(ICONS).concat(Object.keys(ALIASES));
    keys.sort(function (a, b) { return b.length - a.length; });
    return keys;
  })();

  function resolveKey(k) {
    return ICONS[k] ? k : (ALIASES[k] ? ALIASES[k] : null);
  }

  /**
   * 按程序名称/域名检索品牌图标 key。
   * 支持：精确名（"gitlab"）、别名（"golang"、"微信"）、子串（"地图云端自动化jenkins"）。
   * 短键（<=3 字符，如 go/js/qq）要求词边界匹配，避免误命中（如 "nagios" 不命中 go）。
   * @param {string} text 程序名称、域名或任意描述文本
   * @returns {string|null} 图标 key
   */
  function match(text) {
    var n = norm(text);
    if (!n) return null;
    var direct = resolveKey(n);
    if (direct) return direct;
    for (var i = 0; i < MATCH_KEYS.length; i++) {
      var k = MATCH_KEYS[i];
      var pos = n.indexOf(k);
      if (pos < 0) continue;
      if (k.length <= 3 && /^[a-z0-9]+$/.test(k)) {
        // 仅对短英文键（go/js/qq 等）做词边界匹配，避免 "nagios" 误命中 go；
        // 中文键（阿里云/绿联云 等）不做该限制
        var before = pos === 0 || /[^a-z0-9]/.test(n.charAt(pos - 1));
        var after = pos + k.length >= n.length || /[^a-z0-9]/.test(n.charAt(pos + k.length));
        if (before && after) return resolveKey(k);
      } else {
        return resolveKey(k);
      }
    }
    return null;
  }

  /**
   * 渲染品牌图标为内联 SVG 字符串。
   * @param {string} key 图标 key（经 match/resolveKey 得到，也可直接传程序名自动检索）
   * @param {object} [opts]
   *   - size    {number|string} 尺寸，默认 1.25em（可为 24、"2em" 等）
   *   - color   {string}        颜色覆盖，默认使用品牌色
   *   - className {string}      附加 class
   *   - style   {string}        附加内联样式（会拼接在 color 之后）
   * @returns {string} SVG HTML
   */
  function render(key, opts) {
    opts = opts || {};
    var resolved = resolveKey(norm(key)) || match(key);
    if (!resolved || !ICONS[resolved]) return '';
    var e = ICONS[resolved];
    var size = opts.size == null ? '1.25em' : opts.size;
    var color = opts.color || e.c;
    var cls = 'bi-icon' + (opts.className ? ' ' + opts.className : '');
    var style = 'vertical-align:-0.18em;color:' + color + ';' + (opts.style || '');
    return '<svg class="' + cls + '" style="' + style + '" width="' + size + '" height="' + size +
      '" viewBox="' + e.v + '" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      e.b + '</svg>';
  }

  /** 是否存在某程序图标 */
  function exists(text) { return !!match(text); }

  var BrandIcons = { ICONS: ICONS, ALIASES: ALIASES, match: match, render: render, exists: exists, version: '1.0' };
  global.BrandIcons = BrandIcons;
  if (typeof module !== 'undefined' && module.exports) module.exports = BrandIcons;
})(typeof window !== 'undefined' ? window : globalThis);
""" % (js_icons, js_alias)

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print("written:", os.path.abspath(OUT), "entries:", len(icons), "aliases:", len(alias_map))
    print("\n".join(report))


if __name__ == "__main__":
    main()
