#!/usr/bin/env node
/**
 * test_brand_icons.js — 品牌图标模块全量测试
 *
 * 运行：node test_brand_icons.js
 * 覆盖：
 *   T1  图标数据完整性（每个条目有合法 body / viewBox / 品牌色）
 *   T2  别名完整性（所有别名均能解析到存在的图标）
 *   T3  match() 检索矩阵（精确名 / 别名 / 子串 / 中文 / 域名 / 反例）
 *   T4  真实环境数据集成（envdata.json 中每个环境都能命中预期图标或明确回退）
 *   T5  render() 渲染（SVG 结构 / 自定义尺寸 / 自定义颜色）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const BrandIcons = require(path.join(__dirname, '..', '..', 'frontend', 'js', 'brand-icons.js'));

let pass = 0, fail = 0;
const failures = [];

function assert(cond, name) {
  if (cond) { pass++; }
  else { fail++; failures.push(name); console.error('  FAIL:', name); }
}

const { ICONS, ALIASES, match, render, exists } = BrandIcons;

console.log('T1: 图标数据完整性');
assert(Object.keys(ICONS).length >= 80, 'T1.1 图标数量 >= 80，实际 ' + Object.keys(ICONS).length);
for (const [key, e] of Object.entries(ICONS)) {
  assert(e && typeof e.b === 'string' && e.b.length > 20, `T1.2 [${key}] body 非空`);
  assert(/<path[\s>]/.test(e.b) || /<(circle|rect|polygon|ellipse)[\s>]/.test(e.b), `T1.3 [${key}] body 含有效 SVG 图形元素`);
  assert(/^#[0-9A-Fa-f]{6}$/.test(e.c), `T1.4 [${key}] 品牌色合法 (#RRGGBB)，实际 ${e.c}`);
  assert(e.v === '0 0 24 24', `T1.5 [${key}] viewBox 合法`);
}

console.log('T2: 别名完整性');
for (const [alias, key] of Object.entries(ALIASES)) {
  assert(!!ICONS[key], `T2.1 别名 "${alias}" -> "${key}" 可解析`);
}

console.log('T3: match() 检索矩阵');
// 精确名 / 大小写 / 空格
assert(match('git') === 'git', 'T3.1 git');
assert(match('GitLab') === 'gitlab', 'T3.2 GitLab 大小写');
assert(match('  Supabase ') === 'supabase', 'T3.3 Supabase 空格');
assert(match('kubernetes') === 'kubernetes', 'T3.4 kubernetes');
// 别名
assert(match('k8s') === 'kubernetes', 'T3.5 k8s 别名');
assert(match('golang') === 'go', 'T3.6 golang 别名');
assert(match('node') === 'nodejs', 'T3.7 node 别名');
assert(match('postgres') === 'postgresql', 'T3.8 postgres 别名');
assert(match('macos') === 'apple', 'T3.9 macos 别名');
assert(match('idea') === 'jetbrains', 'T3.10 idea 别名');
// 子串（长名称程序）
assert(match('地图云端自动化jenkins') === 'jenkins', 'T3.11 中文前缀 + jenkins');
assert(match('公司内部 GitLab 服务器') === 'gitlab', 'T3.12 带中文空格子串');
assert(match('MyGrafanaPanel') === 'grafana', 'T3.13 无边界子串（>3字符键）');
// 中文别名
assert(match('微信小程序后台') === 'wechat', 'T3.14 微信');
assert(match('绿联云-公网') === 'ugreen', 'T3.15 绿联云');
assert(match('阿里云ECS') === 'alibabacloud', 'T3.16 阿里云');
assert(match('百度网盘') === 'baidu', 'T3.17 百度');
// 域名
assert(match('gitlab.boonray.com') === 'gitlab', 'T3.18 域名 gitlab.boonray.com');
assert(match('supabase.com') === 'supabase', 'T3.19 域名 supabase.com');
assert(match('app.lemonsqueezy.com') === 'lemonsqueezy', 'T3.20 域名 app.lemonsqueezy.com');
assert(match('ug.link') === 'ugreen', 'T3.21 域名 ug.link');
// 反例（短键词边界保护 + 无匹配）
assert(match('nagios') === null, 'T3.22 nagios 不误命中 go');
assert(match('106环境') === null, 'T3.23 106环境 无匹配（回退 fa 图标）');
assert(match('') === null, 'T3.24 空串');
assert(match(null) === null, 'T3.25 null');
assert(exists('vercel') && !exists('随便乱写'), 'T3.26 exists()');

console.log('T4: 真实环境数据集成');
const envdataPath = path.join(__dirname, '..', 'envdata.json');
const envdata = JSON.parse(fs.readFileSync(envdataPath, 'utf-8'));
const EXPECT = {
  '106环境': null, '139环境': null, '192环境': null, 'Mock Truck': 'mocktruck',
  'Jenkins': 'jenkins', '绿联云': 'ugreen', 'GitLab': 'gitlab', 'Grafana': 'grafana',
  '仿真组jenkins': 'jenkins', 'vercel': 'vercel', 'supabase': 'supabase',
  'Lemon Squeezy': 'lemonsqueezy', 'SimOne': 'simone', '绿联云-公网': 'ugreen'
};
let matched = 0, fallback = 0;
for (const env of envdata.envs) {
  const key = match(env.name) || match(env.domain || '');
  const expect = EXPECT[env.name];
  assert(key === expect, `T4.1 环境 "${env.name}" 命中 "${key}"，预期 "${expect}"`);
  if (key) matched++; else fallback++;
}
console.log(`  命中品牌图标: ${matched} 个，通用回退: ${fallback} 个（共 ${envdata.envs.length}）`);

console.log('T5: render() 渲染');
const svg = render('gitlab');
assert(svg.startsWith('<svg'), 'T5.1 输出以 <svg> 开头');
assert(svg.includes('viewBox="0 0 24 24"'), 'T5.2 viewBox 属性');
assert(svg.includes('fill="currentColor"'), 'T5.3 fill=currentColor（颜色可配置）');
assert(svg.includes('color:#FC6D26'), 'T5.4 默认品牌色 #FC6D26 (GitLab)');
assert(svg.includes('width="1.25em"'), 'T5.5 默认尺寸 1.25em');
const big = render('supabase', { size: 40 });
assert(big.includes('width="40"') && big.includes('height="40"'), 'T5.6 自定义尺寸 40px');
const colored = render('supabase', { color: '#123456' });
assert(colored.includes('color:#123456') && !colored.includes('#3FCF8E'), 'T5.7 自定义颜色覆盖品牌色');
const cls = render('vercel', { className: 'my-cls' });
assert(cls.includes('class="bi-icon my-cls"'), 'T5.8 自定义 className');
assert(render('不存在的程序') === '', 'T5.9 无匹配返回空串（调用方回退 fa 图标）');
const styled = render('git', { style: 'margin-right:4px;' });
assert(styled.includes('margin-right:4px;'), 'T5.10 附加内联样式');

console.log('\n========== 测试结果 ==========');
console.log(`通过: ${pass}  失败: ${fail}`);
if (fail > 0) {
  console.log('失败项:', failures);
  process.exit(1);
}
console.log('全部通过 ✓');
