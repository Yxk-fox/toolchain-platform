================================================================================
                        工具链平台 (Toolchain Platform)
                              项目说明文档 v1.3
================================================================================

一、项目概述
--------------------------------------------------------------------------------
  工具链平台是一个集环境管理、开发工具管理、自研程序管理、脚本合集、
  工具箱、REST API 管理、告警中心、资源回收审批、服务目录、巡检历史
  于一体的轻量级内部开发者平台（L-IDP）Web 应用。
  支持用户登录认证、角色权限管理、时间限制授权、企业邮箱注册等功能。

  核心特性：
    - 环境/工具/程序的状态实时监测（TCP 端口检测 + WebSocket 推送）
    - 文件上传/下载/批量下载（脚本与自研程序模块）
    - 限时授权机制（1h~7天，到期自动失效）
    - 离线告警 + 告警中心（环境离线超5分钟自动告警，铃铛实时通知）
    - 资源回收审批流（申请→审批→执行全流程）
    - 服务目录 + 依赖图谱 + 生产就绪评分卡
    - 巡检历史归档 + 可用率趋势（支持7/30/90天维度切换 + 环境筛选）
    - 内置 Swagger UI / ReDoc API 文档（本地资源，加载快）
    - 主题切换（浅色/深色）、主色调自定义
    - 菜单顺序可配置、分组可拖拽排序
    - 页面权限精细化管理（所有页面均可配置可见性）
    - 数据持久化加固（原子写入 + .tmp清理 + .bak轮转 + 写前校验）

二、项目结构
--------------------------------------------------------------------------------
  toolchain-platform/
  ├── backend/                         # 后端 (FastAPI + Python)
  │   ├── main.py                      # 主程序（所有 API 接口，约2500行，110+端点）
  │   ├── data.json                    # 数据存储 (JSON 格式)
  │   ├── requirements.txt             # Python 依赖
  │   ├── download_deps.sh             # 依赖安装脚本
  │   ├── redoc.standalone.js          # ReDoc 本地资源（API 文档）
  │   ├── swagger-ui-bundle.js         # Swagger UI 本地资源
  │   ├── swagger-ui-standalone-preset.js
  │   ├── swagger-ui.css
  │   ├── icons/                       # 工具/环境图标存储
  │   ├── scripts/                     # 脚本文件存储目录
  │   ├── programs/                    # 自研程序文件存储目录
  │   └── tool_packages/               # 工具安装包存储目录
  ├── frontend/                        # 前端 (原生 HTML/CSS/JS)
  │   ├── login.html                   # 独立登录页（支持注册）
  │   ├── index.html                   # 主页面
  │   ├── js/
  │   │   ├── app.js                   # 前端应用入口（路由/公共逻辑，≤800行）
  │   │   └── modules/                 # 模块化拆分目录
  │   │       ├── core.js              # 核心工具函数、全局命名空间 ToolchainApp
  │   │       ├── alerts.js            # 告警中心模块
  │   │       ├── recycle.js           # 资源回收审批模块
  │   │       ├── services.js          # 服务目录模块
  │   │       └── history.js           # 巡检历史/可用率趋势模块
  │   ├── css/
  │   │   └── style.css                # 样式文件
  │   └── docs/                        # 项目文档（HTML 格式）
  │       ├── index.html
  │       ├── doc1-benefits.html
  │       ├── doc2-features.html
  │       ├── doc3-tech-design.html
  │       └── doc4-deployment.html
  ├── ui/
  │   └── car.ico                      # 自定义图标
  ├── tool_web.service                 # systemd 服务配置
  ├── README.txt                       # 本文件
  └── 迭代.txt                         # 迭代开发设计文档

三、技术栈
--------------------------------------------------------------------------------
  后端:    FastAPI 0.104.1 + Uvicorn 0.24.0 + Pydantic 2.5.2
  前端:    原生 JavaScript (无框架) + Font Awesome 图标
  存储:    JSON 文件 (data.json) + 本地文件系统 (scripts/ programs/)
  认证:    Token 令牌认证 (SHA-256 密码哈希 + Bearer/X-API-Token/Query)
  通信:    RESTful API + WebSocket (环境状态实时推送)
  加密:    PyCryptodome (AES 加解密) + hashlib (MD5/SHA 哈希)
  中间件:  GZipMiddleware (压缩 ≥1000B 响应) + CORSMiddleware

四、部署方式 (推荐: systemd 开机自启动)
--------------------------------------------------------------------------------
  1. 安装依赖:
     cd /home/fox/toolchain-platform/backend
     bash download_deps.sh
     # 或手动: pip install -r requirements.txt

  2. 安装 systemd 服务:
     sudo cp /home/fox/toolchain-platform/tool_web.service /etc/systemd/system/tool_web.service
     sudo systemctl daemon-reload
     sudo systemctl enable tool_web        # 开机自启动
     sudo systemctl start tool_web         # 立即启动

  3. 常用管理命令:
     sudo systemctl start tool_web         # 启动
     sudo systemctl stop tool_web          # 停止
     sudo systemctl restart tool_web       # 重启
     sudo systemctl status tool_web        # 查看状态
     sudo journalctl -u tool_web -f        # 实时查看日志

  4. 手动启动 (开发调试):
     cd /home/fox/toolchain-platform/backend
     python main.py
     # 或: python3 -m uvicorn main:app --host 0.0.0.0 --port 3143

  5. 访问:
     浏览器打开 http://localhost:3143
     API 文档: http://localhost:3143/docs (Swagger) 或 /redoc (ReDoc)

五、更改端口号 (当前: 3143)
--------------------------------------------------------------------------------
  如需更改端口，需修改以下 3 个文件中的端口号:

  ┌─────────────────────────────────────────────────────────────────┐
  │ 文件                          │ 位置              │ 当前值       │
  ├─────────────────────────────────────────────────────────────────┤
  │ tool_web.service              │ --port 3143       │ 3143         │
  │ backend/main.py (第1898行)    │ port=3143         │ 3143         │
  │ README.txt (本文档)           │ 两处 3143         │ 3143         │
  └─────────────────────────────────────────────────────────────────┘

  修改后重新部署:
     sudo cp /home/fox/toolchain-platform/tool_web.service /etc/systemd/system/tool_web.service
     sudo systemctl daemon-reload
     sudo systemctl restart tool_web

六、账号与注册
--------------------------------------------------------------------------------
  ┌──────────────┬──────────────────────┬──────────────┐
  │ 用户名       │ 密码                 │ 角色         │
  ├──────────────┼──────────────────────┼──────────────┤
  │ admin        │ admin                │ 超级管理员   │
  │ user         │ user                 │ 普通用户     │
  └──────────────┴──────────────────────┴──────────────┘

  注册说明:
    - 登录页支持企业邮箱注册（必须 @boonray.com 后缀）
    - 需填写真实姓名（≥2字符）和密码（≥6位）
    - 注册用户默认角色为 user，仅有 view 权限
    - 默认可见页面: home, urls, programs, favorites

七、角色权限说明
--------------------------------------------------------------------------------
  超级管理员 (superadmin):
    - 拥有全部权限: add(添加), delete(删除), view(查看), modify(修改)
    - 可见全部页面（含 settings 系统设置、users 用户管理）
    - 可管理用户 (添加/编辑/删除用户、配置可见页面)
    - 可给普通用户授权 (时间限制: 1h/2h/4h/8h/12h/24h/48h/7天)
    - 可收回已授权的权限
    - 可管理所有资源（环境/工具/程序/脚本/分组/菜单）
    - 可管理 API 配置（端口/Token/启停）
    - 可管理程序分类标签

  普通用户 (user):
    - 默认只有 view(查看) 权限
    - 默认可见页面: home(首页), urls(网址大全), tools(软件管家), toolbox(工具箱), favorites(我的收藏), programs(自研程序)
    - 其他页面(services/alerts/recycle/api/settings/users)需管理员授权
    - 不可见 settings(系统设置)、users(用户管理) 页面
    - 超级管理员可临时授权 add/delete/modify 权限 (带时间限制)
    - 授权到期后自动失效
    - 在自研程序模块：可上传(需add)、编辑/删除自己的程序(需modify/delete)
    - 在脚本合集模块：可上传(需add)、编辑/删除自己的脚本(需modify/delete)

  权限校验机制:
    - 前端: hasPageAccess(page) 控制页面可见性
            hasPermission(action) 控制操作按钮显示
    - 后端: require_auth(request) 校验登录态
            require_permission(user, action) 校验操作权限
            资源所有权校验 (uploader_id == user.id 或 superadmin)

八、功能模块
--------------------------------------------------------------------------------
  1. 首页 (home)
     - 环境状态概览 (在线/离线，实时刷新)
     - 可用率趋势图表（支持7/30/90天维度切换 + 环境筛选）
     - 最近访问历史
     - 收藏统计
     - 功能模块导览

  2. 服务目录 (services) [v1.2新增]
     - 服务元数据管理（名称/代号/类型/负责人/团队/技术栈等）
     - 服务卡片网格展示，按类型分组，显示生产就绪评分
     - 服务详情页（基本信息 + 部署环境链接 + 依赖关系 + 评分卡）
     - 服务CRUD操作（需权限）
     - 服务依赖关系管理
     - 生产就绪评分卡自动计算（CI/监控/日志/备份/文档5项检查）

  3. 网址大全 (urls)
     - 查看所有环境列表，按矿区分组显示 (一矿/天池矿/...)
     - 普通用户: 极简卡片模式 (仅图标/名称/状态/IP，点击打开)
     - 管理员: 完整卡片 (含描述/复制IP/打开/编辑/删除按钮)
     - 支持 IP 访问和域名访问两种模式
     - 支持环境子链接 (如 106 环境后台管理系统)
     - 收藏环境

  4. 软件管家 (tools)
     - 按系统 (Windows/Ubuntu) 和分类筛选
     - 查看工具详情、复制安装命令、打开官网
     - 添加/编辑/删除工具 (需权限)
     - 收藏工具

  5. 告警中心 (alerts) [v1.3新增]
     - 告警列表时间线视图，按严重度着色（info/warning/critical）
     - 告警规则配置（离线阈值、恢复通知等）
     - 告警确认/删除操作
     - 顶部铃铛实时角标（未处理告警数）
     - WebSocket 实时推送新告警
     - 支持按严重度/环境筛选

  6. 资源回收 (recycle) [v1.3新增]
     - 回收申请提交（环境/工具/程序三种资源类型）
     - 待审批列表（管理员）
     - 审批通过/驳回操作
     - 审批通过后执行资源删除
     - 回收历史记录查看
     - 在环境/工具/程序详情页可直接发起回收申请

  7. 自研程序 (programs)
     - 集中管理团队自研脚本/工具/服务包/配置文件
     - 元数据: 版本号、分类、适用环境、依赖说明、使用命令
     - 文件上传 (100MB 限制)、下载、批量下载 (zip 打包)
     - 普通用户可上传(需add)、编辑/删除自己的程序(需modify/delete)
     - 管理员可管理所有程序
     - 支持分类筛选和名称搜索
     - 下载次数统计

  8. 工具箱 (toolbox)
     ┌──────────────────────────────────────────────────────────────────┐
     │ 📝 文本与字符串处理                                              │
     │   字数统计、大小写转换、字符串替换、反转、文本差异对比、去重       │
     ├──────────────────────────────────────────────────────────────────┤
     │ 🧹 代码格式化与美化                                               │
     │   JSON格式化校验、SQL格式化、XML格式化                            │
     ├──────────────────────────────────────────────────────────────────┤
     │ 🔐 编码、加密与哈希                                               │
     │   URL编解码、Base64编解码、Unicode编解码、MD5/SHA1/SHA256哈希    │
     │   AES加密解密、十六进制转换                                       │
     ├──────────────────────────────────────────────────────────────────┤
     │ 🔄 数据格式转换                                                  │
     │   JSON/YAML/XML/CSV互转、JSON转Go结构体、JSON转TypeScript        │
     ├──────────────────────────────────────────────────────────────────┤
     │ 🧩 生成器类                                                      │
     │   随机密码生成、UUID生成、随机数生成、时间戳转换                   │
     ├──────────────────────────────────────────────────────────────────┤
     │ 🌐 网络与运维                                                    │
     │   IP信息查询、SSL证书检测、DNS查询、HTTP状态码、端口扫描、正则测试│
     ├──────────────────────────────────────────────────────────────────┤
     │ 🎨 图像与设计辅助                                                │
     │   颜色选择器、颜色格式转换                                       │
     ├──────────────────────────────────────────────────────────────────┤
     │ 📐 单位与数学计算                                                │
     │   单位换算、JSON转Go结构体、JSON转TypeScript                      │
     ├──────────────────────────────────────────────────────────────────┤
     │ 🧪 其他实用小工具                                                 │
     │   Markdown预览、字符映射表                                       │
     └──────────────────────────────────────────────────────────────────┘

  9. 脚本合集 (scripts)
     - 脚本文件上传 (50MB 限制)、下载、批量下载
     - 支持脚本描述、分类
     - 普通用户可上传(需add)、编辑/删除自己的脚本(需modify/delete)

  10. 我的收藏 (favorites)
      - 收藏的环境和工具 (支持拖拽排序)
      - 自定义快捷入口 (添加/删除)
      - 点击直接跳转

  11. REST API 管理 (api)
      - API 服务状态检测 (运行中/已停止)
      - API 基础地址显示
      - 内置 Swagger UI / ReDoc 文档查看 (本地资源，加载快)
      - 管理员可配置: API 端口、认证 Token、启停服务
      - 支持测试连接

  12. 用户管理 (users) [仅超级管理员可见]
      - 用户列表查看
      - 添加/编辑/删除用户
      - 配置用户可见页面（所有页面包括alerts/recycle/services均可配置）
      - 给用户授权 (选择权限和时长: 1h/2h/4h/8h/12h/24h/48h/7天)
      - 查看当前有效授权、收回授权

  13. 系统设置 (settings) [仅超级管理员可见]
      - 主题切换 (浅色/深色)
      - 主色调选择
      - 工具视图切换 (网格/列表)
      - 网址大全分组配置 (增删改、拖拽排序、显示/隐藏)
      - 工具箱分组配置 (增删改、拖拽排序、显示/隐藏)
      - 矿区分组配置
      - 菜单顺序配置

九、API 接口列表
--------------------------------------------------------------------------------
  认证:
    POST   /api/auth/login              # 登录
    POST   /api/auth/register           # 注册 (@boonray.com 企业邮箱)
    GET    /api/auth/me                 # 获取当前用户信息
    POST   /api/auth/logout             # 登出

  告警中心 (v1.3新增):
    GET    /api/alerts                  # 获取告警列表（支持severity/env_id筛选）
    GET    /api/alerts/rules            # 获取告警规则配置
    PUT    /api/alerts/rules            # 更新告警规则（superadmin）
    POST   /api/alerts/{id}/ack        # 确认告警（标记已处理）
    DELETE /api/alerts/{id}            # 删除告警记录（superadmin）

  资源回收 (v1.3新增):
    POST   /api/recycle-requests                # 提交回收申请
    GET    /api/recycle-requests                # 列表（支持status筛选）
    POST   /api/recycle-requests/{id}/approve   # 审批通过（superadmin）
    POST   /api/recycle-requests/{id}/reject    # 审批驳回（superadmin）
    POST   /api/recycle-requests/{id}/execute   # 执行回收（删除资源）

  服务目录 (v1.2新增):
    GET    /api/services                    # 服务列表（支持type/team/owner筛选）
    GET    /api/services/{id}               # 服务详情
    POST   /api/services                    # 创建服务（需add）
    PUT    /api/services/{id}                # 更新服务（需modify）
    DELETE /api/services/{id}               # 删除服务（需delete）
    GET    /api/services/{id}/dependencies   # 获取服务依赖关系
    POST   /api/services/{id}/dependencies  # 添加依赖
    DELETE /api/services/{id}/dependencies/{dep_id}  # 移除依赖
    GET    /api/services/{id}/scorecard      # 重新计算评分卡
    GET    /api/services/graph               # 全量依赖图数据
    GET    /api/services/export              # 导出CSV（superadmin）

  巡检历史与可用率 (v1.3新增):
    GET    /api/inspect-history           # 巡检历史列表（支持日期范围）
    GET    /api/inspect-history/summary   # 可用率统计（支持days/env_id参数，7/30/90天）

  环境:
    GET    /api/envs                    # 获取环境列表
    GET    /api/envs/{id}               # 获取单个环境
    POST   /api/envs                    # 添加环境 (需add)
    PUT    /api/envs/{id}               # 修改环境 (需modify)
    DELETE /api/envs/{id}               # 删除环境 (需delete)

  环境分组:
    GET    /api/env-groups              # 获取分组列表
    POST   /api/env-groups              # 添加分组 (需add)
    PUT    /api/env-groups/{id}         # 修改分组 (需modify)
    DELETE /api/env-groups/{id}         # 删除分组 (需delete)

  矿区分组:
    GET    /api/mine-groups             # 获取矿区分组列表
    POST   /api/mine-groups             # 添加矿区分组 (需add)
    PUT    /api/mine-groups/{id}        # 修改矿区分组 (需modify)
    DELETE /api/mine-groups/{id}        # 删除矿区分组 (需delete)

  工具:
    GET    /api/tools                   # 获取工具列表
    GET    /api/tools/{id}              # 获取单个工具
    POST   /api/tools                   # 添加工具 (需add)
    PUT    /api/tools/{id}              # 修改工具 (需modify)
    DELETE /api/tools/{id}              # 删除工具 (需delete)

  工具分类:
    GET    /api/categories              # 获取工具分类

  自研程序:
    GET    /api/programs                # 获取程序列表 (支持category/env/keyword筛选)
    GET    /api/programs/{id}           # 获取单个程序
    POST   /api/programs/upload         # 上传程序 (需add, 100MB限制, multipart)
    PUT    /api/programs/{id}           # 更新程序元数据 (需modify, 限本人或管理员)
    DELETE /api/programs/{id}           # 删除程序 (需delete, 限本人或管理员)
    GET    /api/programs/{id}/download  # 下载程序文件
    POST   /api/programs/batch-download # 批量下载 (zip打包)

  程序分类:
    GET    /api/program-categories      # 获取分类列表
    POST   /api/program-categories      # 新增分类 (仅管理员)

  脚本合集:
    GET    /api/scripts                 # 获取脚本列表
    POST   /api/scripts/upload          # 上传脚本 (需add, 50MB限制, multipart)
    PUT    /api/scripts/{id}            # 更新脚本 (需modify, 限本人或管理员)
    DELETE /api/scripts/{id}            # 删除脚本 (需delete, 限本人或管理员)
    GET    /api/scripts/{id}/download   # 下载脚本文件
    POST   /api/scripts/batch-download  # 批量下载 (zip打包)

  快捷入口:
    GET    /api/quick-entries           # 获取快捷入口列表
    POST   /api/quick-entries           # 添加快捷入口 (需add)
    PUT    /api/quick-entries/{id}      # 修改快捷入口 (需modify)
    DELETE /api/quick-entries/{id}      # 删除快捷入口 (需delete)

  收藏与历史:
    GET    /api/favorites               # 获取收藏列表
    POST   /api/favorites/toggle        # 切换收藏
    GET    /api/history                 # 获取访问历史
    POST   /api/history                 # 添加历史记录

  用户管理 (仅超级管理员):
    GET    /api/users                   # 获取用户列表
    POST   /api/users                   # 创建用户
    PUT    /api/users/{id}              # 修改用户
    DELETE /api/users/{id}              # 删除用户
    POST   /api/users/grant             # 授权用户 (带时间限制)
    GET    /api/users/grants            # 获取有效授权列表
    DELETE /api/users/grants/{idx}      # 收回授权

  API 配置:
    GET    /api/api-config              # 获取API配置
    PUT    /api/api-config              # 更新API配置 (仅管理员)
    POST   /api/api-config/generate-token # 重新生成API Token (仅管理员)
    POST   /api/api-config/test-connection # 测试API连接

  系统配置:
    GET    /api/settings                # 获取系统设置
    PUT    /api/settings                # 更新设置 (仅管理员)
    GET    /api/menu-order              # 获取菜单顺序
    GET    /api/status                  # 系统状态
    GET    /api/search?q=               # 全局搜索

  工具箱分组:
    GET    /api/toolbox-groups          # 获取工具箱分组配置
    POST   /api/toolbox-groups          # 添加分组 (需add)
    PUT    /api/toolbox-groups/{id}     # 修改分组 (需modify)
    DELETE /api/toolbox-groups/{id}     # 删除分组 (需delete)

  工具箱工具:
    POST   /api/toolbox/hash            # 哈希计算 (MD5/SHA1/SHA256等)
    POST   /api/toolbox/aes-encrypt     # AES加密
    POST   /api/toolbox/aes-decrypt     # AES解密
    POST   /api/toolbox/yaml-to-json    # YAML转JSON
    POST   /api/toolbox/json-to-yaml    # JSON转YAML
    POST   /api/toolbox/xml-to-json     # XML转JSON
    POST   /api/toolbox/json-to-xml     # JSON转XML
    POST   /api/toolbox/text-diff       # 文本差异对比

  网络工具:
    POST   /api/network/ip-info         # IP信息查询
    POST   /api/network/ssl-check       # SSL证书检测
    POST   /api/network/dns-lookup      # DNS查询
    POST   /api/network/http-status     # HTTP状态码检测
    POST   /api/network/port-scan       # 端口扫描

  图标管理:
    POST   /api/icons/upload            # 上传图标
    GET    /api/icons/list              # 获取图标列表
    DELETE /api/icons/{filename}        # 删除图标
    GET    /api/icons/suggest           # 根据名称推荐图标

  WebSocket:
    WS     /ws/status                   # 环境状态实时推送

  API 文档 (本地资源):
    GET    /openapi.json                # OpenAPI 规范
    GET    /docs                        # Swagger UI
    GET    /redoc                       # ReDoc

十、数据存储
--------------------------------------------------------------------------------
  所有数据存储在 backend/data.json 文件中，主要字段:
  - envs:               环境配置列表 (含 group 分组、subLinks 子链接、accessType)
  - tools:              开发工具列表
  - categories:         工具分类
  - settings:           系统设置 (主题/主色调/视图模式等)
  - favorites:          收藏列表 (envs/tools/toolbox)
  - user_favorites:     按用户隔离的收藏
  - history:            访问历史
  - users:              用户列表 (密码为 SHA-256 哈希)
  - tokens:             登录令牌 (token -> {user_id, expires})
  - permission_grants:  权限授权记录 (带过期时间)
  - quick_entries:      自定义快捷入口
  - env_groups:         网址大全分组配置 (id, name, order, visible)
  - toolbox_groups:     工具箱分组配置
  - mine_groups:        矿区分组配置
  - menu_order:         侧边栏菜单顺序
  - scripts:            脚本列表 (含 stored_name/original_name/file_size/uploader_id)
  - programs:           自研程序列表 (含 version/category/envs/dependencies/usage_cmd)
  - program_categories: 程序分类标签 (默认: 脚本/服务/配置/工具)
  - api_config:         API 服务配置 (enabled/port/token_auth_enabled/api_token)
  - alerts:             告警记录列表 (v1.3新增，含env_id/type/severity/message等)
  - alert_rules:        告警规则配置 (v1.3新增，offline_threshold_seconds等)
  - recycle_requests:   资源回收申请列表 (v1.3新增，含resource_type/status等)
  - services:           服务目录列表 (v1.2新增，含name/code/type/owner/scorecard等)
  - service_dependencies: 服务依赖关系 (v1.2新增)
  - inspection_history: 巡检历史归档 (v1.3新增，保留90天，含env_details)

  文件存储:
  - backend/scripts/    脚本文件 (stored_name = token_hex(8)_原始名)
  - backend/programs/   自研程序文件 (stored_name = token_hex(8)_原始名)
  - backend/icons/      自定义图标文件
  - backend/tool_packages/ 工具安装包文件

  并发安全与数据持久化加固 (v1.3):
  - 所有数据读写通过 threading.LOCK 保证线程安全
  - save_data() 使用临时文件 + 原子替换 (tmp_file.replace) 防止数据损坏
  - 写入前 json.dumps 校验 + fsync 确保数据完整落盘
  - 启动时自动清理 .tmp 残留文件
  - 自动维护 data.json.bak 备份文件（最近1份）
  - load_data() 失败自动重试 3 次
  - 数据自动迁移：新增字段自动补全，确保旧版本数据兼容

十一、环境状态检测机制
--------------------------------------------------------------------------------
  检测方式 (优先级从高到低):
    1. TCP 端口检测 (默认超时 1.5s)
       - 根据环境 protocol (http/https) 自动选择端口 (80/443)
       - 或使用环境配置的 port 字段
    2. Ping 检测 (仅对纯 IP 地址)
       - ping -c 1 -W 1

  性能优化:
    - 后台线程每 20 秒异步刷新状态缓存 (_status_cache)
    - 使用 ThreadPoolExecutor 并发检测 (最多 30 个 worker)
    - 检测中状态不阻塞 API 响应，直接返回缓存数据
    - WebSocket 每 5 秒向所有连接客户端推送最新状态

十二、鉴权机制
--------------------------------------------------------------------------------
  Token 传递方式 (三选一):
    1. Authorization: Bearer <token>
    2. X-API-Token: <token>
    3. URL Query: ?token=<token>

  Token 类型:
    - 用户登录 Token: 24 小时有效，过期自动清理
    - API Token: 管理员在 API 配置页面生成，长期有效，具备 superadmin 权限

  权限校验函数:
    - require_auth(request): 校验登录态，返回 user 对象
    - require_permission(user, action): 校验操作权限 (view/add/modify/delete)
    - 资源所有权: uploader_id == user.id 或 role == superadmin

  公开接口 (无需鉴权):
    - GET / (根路径跳转登录页)
    - GET /login.html
    - POST /api/auth/login
    - POST /api/auth/register

十三、注意事项
--------------------------------------------------------------------------------
  1. 环境状态通过 TCP 端口检测 + Ping，后台每 20 秒刷新缓存
  2. 登录令牌有效期 24 小时，过期自动清理
  3. 权限授权到期后自动失效
  4. 超级管理员 (admin, id=1) 不可被删除
  5. 密码使用 SHA-256 哈希存储，不可逆
  6. 前端使用 localStorage 持久化登录状态
  7. 访问根路径 / 自动跳转到登录页，登录成功后进入 /index.html
  8. 注册仅支持 @boonray.com 企业邮箱
  9. 文件上传有大小限制: 脚本 50MB，自研程序 100MB
  10. API 文档使用本地资源 (Swagger UI / ReDoc)，无需外网访问
  11. GZip 中间件自动压缩 ≥1000B 的响应
  12. 普通用户不可见 settings(系统设置)、users(用户管理) 页面
  13. load_data() 会自动迁移旧数据 (补充 programs 字段、menu_order 等)

================================================================================
                        版本更新日志
================================================================================

v1.3 (2026-07-30)
  - 【新增】离线告警 + 告警中心：环境离线超5分钟自动告警，铃铛实时通知，支持确认/删除
  - 【新增】资源回收审批流：支持环境/工具/程序回收申请→审批→执行全流程
  - 【新增】巡检历史归档 + 可用率趋势：保留90天历史，支持7/30/90天维度切换 + 环境筛选
  - 【新增】页面权限精细化管理：alerts/recycle/services/api等所有页面均可配置可见性
  - 【增强】数据持久化加固：原子写入 + .tmp清理 + .bak轮转 + 写前json校验 + fsync
  - 【增强】前端模块化拆分：app.js拆分为core.js/alerts.js/recycle.js/services.js/history.js
  - 【增强】首页可用率趋势图表优化：纯SVG渲染，支持维度切换和环境筛选
  - 【修复】services.js语法错误、PlainTextResponse未导入等bug
  - 【修复】未登录时隐藏主题切换和访客模式图标

v1.2 (2026-07-29)
  - 【新增】服务目录 + 依赖图谱：服务元数据管理、生产就绪评分卡自动计算
  - 【新增】首页功能模块导览
  - 【增强】统一术语对齐代码
  - 【文档】补全七大功能收益分析与新人入职/留存专项文档

v1.1 (2026-07-27)
  - 【文档】补充API接口详情、数据模型、部署命令、常见问题排查

v1.0 (2026-06-26)
  - 初始版本，基础框架搭建
  - 核心功能：网址大全、软件管家、自研程序、工具箱、我的收藏、REST API管理、用户权限

================================================================================
                        最后更新: 2026-07-30 (v1.3)
================================================================================
