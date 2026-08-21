# 数据备份 - 2026-08-19 22:59:08

- **备份时间**：2026-08-19T22:59:08
- **备份目录**：`/home/fox/toolchain-platform/ck/data/bk/2026/08/19`
- **保留天数**：7 天
- **模块数量**：8

## 备份文件列表

| 文件 | 模块 | 大小 | SHA256（前16位） | 记录数 |
|---|---|---|---|---|
| `userdata.json` | user | 4.34 KB | `f969aa0d2043949b` | users=8, tokens=3, permission_grants=0 |
| `appdata.json` | app | 93.39 KB | `e8edae08138d6592` | tools=210, categories=2, tool_company_groups=13, favorites=3, user_favorites=3, history=49, quick_entries=0, user_quick_entries=0 |
| `errordata.json` | error | 6.36 MB | `c1891c2cf94ccc2b` | alerts=8577, inspection_history=1000, recycle_requests=0 |
| `servicedata.json` | service | 12.99 KB | `f8b0988be8e5c2b4` | services=18, service_dependencies=0 |
| `envdata.json` | env | 6.67 KB | `7a9cfe7ff6225188` | envs=23, env_groups=3 |
| `programdata.json` | program | 2.01 KB | `cc76173b49a4bac3` | programs=3, program_categories=4, scripts=0 |
| `toolboxdata.json` | toolbox | 2.06 KB | `e27696ca7cc1ffbb` | toolbox_groups=9, mine_groups=9 |
| `settingsdata.json` | settings | 491 B | `cb8611c53106a033` | settings=4, menu_order=12, api_config=4 |

## 恢复方式

1. 停止后端服务
2. 将所需 `.json` 文件复制回 `backend/` 目录（覆盖现有文件）
3. 重启服务

## 自动清理

超过 7 天的备份目录（按日期计算）会被自动删除。