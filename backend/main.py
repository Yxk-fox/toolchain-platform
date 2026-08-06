#!/usr/bin/env python3
''' 
@File    :  main.py
@Time    :  2026/08/05 17:15:16 
@Author  :  fox 
@Version :  4.0 
@Desc    :  伯镭工具链平台后端主服务，基于FastAPI实现，提供环境管理、工具管理、用户权限、
           状态检测、离线告警、资源回收、服务目录、工具箱等核心功能API
'''
import asyncio, hashlib, json, os, secrets, shutil, socket, subprocess, threading, time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File, Form
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
FRONTEND_DIR = BASE_DIR.parent / "frontend"
UI_DIR = BASE_DIR.parent / "ui"
ICON_DIR = BASE_DIR / "icons"
ICON_DIR.mkdir(exist_ok=True)
SCRIPTS_DIR = BASE_DIR / "scripts"
SCRIPTS_DIR.mkdir(exist_ok=True)
PROGRAMS_DIR = BASE_DIR / "programs"
PROGRAMS_DIR.mkdir(exist_ok=True)
TOOL_PACKAGES_DIR = BASE_DIR / "tool_packages"
TOOL_PACKAGES_DIR.mkdir(exist_ok=True)
LOCK = threading.Lock()

connected_clients = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    _cleanup_tmp_residue()
    # 启动时预热数据缓存，避免第一个API请求读磁盘
    load_data()
    start_status_refresh_thread()
    threading.Thread(target=refresh_status_cache_sync, daemon=True).start()
    asyncio.create_task(broadcast_status())
    yield

app = FastAPI(title="Toolchain Platform API", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)

if (FRONTEND_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
if (FRONTEND_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
if (FRONTEND_DIR / "docs").exists():
    app.mount("/docs", StaticFiles(directory=str(FRONTEND_DIR / "docs")), name="docs")
if UI_DIR.exists():
    app.mount("/ui", StaticFiles(directory=str(UI_DIR)), name="ui")
app.mount("/icons", StaticFiles(directory=str(ICON_DIR)), name="icons")
app.mount("/scripts-files", StaticFiles(directory=str(SCRIPTS_DIR)), name="scripts-files")
app.mount("/programs-files", StaticFiles(directory=str(PROGRAMS_DIR)), name="programs-files")
app.mount("/tool-packages", StaticFiles(directory=str(TOOL_PACKAGES_DIR)), name="tool-packages")
app.mount("/static", StaticFiles(directory=str(BASE_DIR)), name="static")

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=404, content={"error": "Not Found", "message": "The requested resource was not found", "path": request.url.path})

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": "Internal Server Error", "message": "An unexpected error occurred"})

_data_cache = None
_data_cache_mtime = 0

DEFAULT_COMPANY_GROUPS = [
    {"id": "general", "name": "通用软件", "icon": "fa-solid fa-globe", "color": "#6b7280"},
    {"id": "system", "name": "系统组", "icon": "fa-solid fa-server", "color": "#3b82f6"},
    {"id": "cloud_platform", "name": "云端平台组", "icon": "fa-solid fa-cloud", "color": "#ef4444"},
    {"id": "perception", "name": "感知组", "icon": "fa-solid fa-eye", "color": "#f59e0b"},
    {"id": "control", "name": "规控组", "icon": "fa-solid fa-sliders", "color": "#eab308"},
    {"id": "calibration", "name": "标定组", "icon": "fa-solid fa-crosshairs", "color": "#84cc16"},
    {"id": "map", "name": "地图组", "icon": "fa-solid fa-map-location-dot", "color": "#3b82f6"},
    {"id": "vehicle_platform", "name": "车端平台组", "icon": "fa-solid fa-car", "color": "#a855f7"},
    {"id": "hardware", "name": "智能硬件集成组", "icon": "fa-solid fa-microchip", "color": "#b45309"},
    {"id": "simulation", "name": "仿真组", "icon": "fa-solid fa-atom", "color": "#8b5cf6"},
    {"id": "quality", "name": "质量组", "icon": "fa-solid fa-bolt", "color": "#14b8a6"},
    {"id": "tech_support", "name": "技术支持组", "icon": "fa-solid fa-headset", "color": "#fb923c"},
    {"id": "pm", "name": "研发项目管理组", "icon": "fa-solid fa-clipboard-list", "color": "#fbbf24"}
]

def _cleanup_tmp_residue():
    """启动时清理上一次崩溃可能残留的 .tmp 文件（不抛异常，仅记日志）。"""
    try:
        tmp_file = DATA_FILE.with_suffix(".tmp")
        if tmp_file.exists():
            tmp_file.unlink()
            print(f"[load_data] 清理残留临时文件: {tmp_file}", flush=True)
    except Exception as e:
        print(f"[load_data] 清理 .tmp 残留失败（忽略）: {e}", flush=True)


def _load_data_from_disk():
    """从磁盘加载数据，执行迁移检查（仅内部使用，外部请用load_data获取缓存）"""
    if not DATA_FILE.exists():
        default_api_token = secrets.token_hex(32)
        return {
            "envs": [], "tools": [], "categories": [], "settings": {},
            "favorites": [], "history": [], "users": [], "tokens": {},
            "permission_grants": [], "quick_entries": [], "env_groups": [],
            "toolbox_groups": [], "user_favorites": {},
            "mine_groups": [], "scripts": [],
            "programs": [], "program_categories": ["脚本", "服务", "配置", "工具"],
            "services": [], "service_dependencies": [], "inspection_history": [], "alerts": [], "recycle_requests": [],
            "menu_order": ["home", "urls", "services", "tools", "programs", "toolbox", "favorites", "alerts", "recycle", "api", "settings", "users"],
            "tool_company_groups": DEFAULT_COMPANY_GROUPS,
            "api_config": {
                "enabled": True,
                "port": 3143,
                "token_auth_enabled": True,
                "api_token": default_api_token
            }
        }
    for attempt in range(3):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "api_config" not in data:
                    data["api_config"] = {
                        "enabled": True,
                        "port": 3143,
                        "token_auth_enabled": True,
                        "api_token": secrets.token_hex(32)
                    }
                if "programs" not in data:
                    data["programs"] = []
                if "program_categories" not in data:
                    data["program_categories"] = ["脚本", "服务", "配置", "工具"]
                _migrated = False
                new_pages_for_users = ["services", "tools", "toolbox", "alerts", "recycle", "programs"]
                for u in data.get("users", []):
                    if u.get("role") != "superadmin":
                        pages = u.get("pages", [])
                        updated = False
                        for p in new_pages_for_users:
                            if p not in pages:
                                pages.append(p)
                                updated = True
                        if updated:
                            u["pages"] = pages
                            _migrated = True
                    if "company_group" not in u:
                        u["company_group"] = "general"
                        _migrated = True
                    if "company_groups" not in u:
                        cg = u.get("company_group", "general")
                        u["company_groups"] = [] if cg == "general" else [cg]
                        _migrated = True
                mo = data.get("menu_order", [])
                new_mo = ["home", "urls", "services", "tools", "programs", "toolbox", "favorites", "alerts", "recycle", "api", "settings", "users"]
                need_update_mo = False
                for p in ["services", "alerts", "recycle"]:
                    if p not in mo:
                        need_update_mo = True
                        break
                if need_update_mo:
                    data["menu_order"] = new_mo
                    _migrated = True
                for t in data.get("tools", []):
                    if "package_name" not in t:
                        t["package_name"] = None
                        t["package_size"] = 0
                        _migrated = True
                    if "company_group" not in t:
                        t["company_group"] = "general"
                        _migrated = True
                    if "tags" not in t:
                        t["tags"] = []
                        _migrated = True
                if "tool_company_groups" not in data:
                    data["tool_company_groups"] = DEFAULT_COMPANY_GROUPS
                    _migrated = True
                if "services" not in data:
                    data["services"] = []
                    _migrated = True
                if "service_dependencies" not in data:
                    data["service_dependencies"] = []
                    _migrated = True
                if _migrated:
                    with open(DATA_FILE, "w", encoding="utf-8") as fw:
                        json.dump(data, fw, ensure_ascii=False, indent=2)
                return data
        except (json.JSONDecodeError, OSError) as e:
            if attempt == 2:
                raise
            time.sleep(0.05 * (attempt + 1))

def load_data():
    """高性能数据加载：优先使用内存缓存，避免重复磁盘IO和锁竞争"""
    global _data_cache, _data_cache_mtime
    try:
        current_mtime = DATA_FILE.stat().st_mtime if DATA_FILE.exists() else 0
    except OSError:
        current_mtime = 0
    
    if _data_cache is not None and _data_cache_mtime == current_mtime:
        return _data_cache
    
    with LOCK:
        # 双重检查，锁内再确认一次缓存
        try:
            current_mtime = DATA_FILE.stat().st_mtime if DATA_FILE.exists() else 0
        except OSError:
            current_mtime = 0
        if _data_cache is not None and _data_cache_mtime == current_mtime:
            return _data_cache
        
        _data_cache = _load_data_from_disk()
        _data_cache_mtime = current_mtime
        return _data_cache

def save_data(data):
    global _data_cache, _data_cache_mtime
    with LOCK:
        json.dumps(data, ensure_ascii=False)
        bak_file = DATA_FILE.with_suffix(".bak")
        if DATA_FILE.exists():
            try:
                shutil.copy2(DATA_FILE, bak_file)
            except Exception as e:
                print(f"[save_data] 备份 .bak 失败（忽略，继续写入）: {e}", flush=True)
        tmp_file = DATA_FILE.with_suffix(f".tmp.{os.getpid()}")
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(str(tmp_file), str(DATA_FILE))
        except Exception as e:
            print(f"[save_data] 临时文件替换失败，尝试直接写入: {e}", flush=True)
            if tmp_file.exists():
                try:
                    tmp_file.unlink()
                except:
                    pass
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
        _data_cache = data
        try:
            _data_cache_mtime = DATA_FILE.stat().st_mtime
        except OSError:
            _data_cache_mtime = time.time()

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def generate_token():
    return secrets.token_hex(32)

def get_effective_permissions(user):
    if user["role"] == "superadmin":
        return ["view", "add", "modify", "delete"]
    effective_perms = list(user.get("permissions", ["view"]))
    data = load_data()
    now = datetime.now()
    for g in data.get("permission_grants", []):
        if g["user_id"] == user["id"]:
            expires = datetime.fromisoformat(g["expires"])
            if now <= expires:
                for p in g.get("permissions", []):
                    if p not in effective_perms:
                        effective_perms.append(p)
    return effective_perms

def get_user_from_token(token: str):
    if not token:
        return None
    data = load_data()
    api_config = data.get("api_config", {})
    if api_config.get("token_auth_enabled", True) and api_config.get("api_token") and token == api_config["api_token"]:
        return {"id": 0, "username": "api_token", "display_name": "API Token", "role": "superadmin", "permissions": ["view", "add", "modify", "delete"]}
    token_data = data.get("tokens", {}).get(token)
    if not token_data:
        return None
    expires = datetime.fromisoformat(token_data["expires"])
    if datetime.now() > expires:
        del data["tokens"][token]
        save_data(data)
        return None
    for u in data.get("users", []):
        if u["id"] == token_data["user_id"]:
            return u
    return None

def check_permission(user, action):
    if not user:
        return False
    if user["role"] == "superadmin":
        return True
    perms = user.get("permissions", [])
    if action in perms:
        return True
    data = load_data()
    now = datetime.now()
    for g in data.get("permission_grants", []):
        if g["user_id"] == user["id"] and action in g.get("permissions", []):
            expires = datetime.fromisoformat(g["expires"])
            if now <= expires:
                return True
    return False

def require_auth(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        token = request.headers.get("X-API-Token", "")
    if not token:
        token = request.query_params.get("token", "")
    data = load_data()
    api_config = data.get("api_config", {})
    if not api_config.get("token_auth_enabled", True):
        return {"id": 0, "username": "anonymous", "display_name": "Anonymous", "role": "user", "permissions": ["view"]}
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

def require_permission(user, action):
    if not check_permission(user, action):
        raise HTTPException(status_code=403, detail=f"Permission '{action}' denied")

def optional_auth(request: Request):
    """可选鉴权：无 token 或 token 无效时返回访客身份（仅 view 权限，仅 urls 页），
    有 token 时返回真实用户。用于未登录也可访问的只读接口。"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        token = request.headers.get("X-API-Token", "")
    if not token:
        token = request.query_params.get("token", "")
    if not token:
        return {"id": 0, "username": "anonymous", "display_name": "访客", "role": "guest", "permissions": ["view"], "pages": ["urls"]}
    user = get_user_from_token(token)
    if not user:
        return {"id": 0, "username": "anonymous", "display_name": "访客", "role": "guest", "permissions": ["view"], "pages": ["urls"]}
    return user

_status_cache = {"env_statuses": [], "last_update": 0}
_status_lock = threading.Lock()
_status_updating = False
# T2.1 离线告警：保存上次巡检状态快照，用于检测 online→offline 转变
_prev_env_statuses = {}

def check_tcp_port(host, port, timeout=0.8):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def check_env_reachable(env):
    access_type = env.get("accessType", "ip")
    host = env.get("domain", "") if access_type == "domain" else env.get("ip", "")
    port = env.get("port")
    proto = env.get("protocol", "http")
    if not host:
        return False
    if not port:
        port = 443 if proto == "https" else 80
    if check_tcp_port(host, port, timeout=0.8):
        return True
    return False

def _archive_inspect_history(data, envs, results):
    """T2.3 巡检历史归档：每次巡检记录一条快照，保留最近 90 天，超期清理。"""
    history = data.setdefault("inspection_history", [])
    env_map = {e["id"]: e for e in envs}
    offline_envs = []
    online_count = 0
    env_details = {}
    for r in results:
        env = env_map.get(r["id"], {})
        env_name = env.get("name") or env.get("ip") or ("env#" + str(r["id"]))
        is_online = r["status"] == "online"
        if is_online:
            online_count += 1
        else:
            offline_envs.append({"env_id": r["id"], "env_name": env_name})
        env_details[str(r["id"])] = {
            "env_id": r["id"],
            "env_name": env_name,
            "status": r["status"]
        }
    max_id = max([h.get("id", 0) for h in history], default=0)
    history.append({
        "id": max_id + 1,
        "timestamp": datetime.now().isoformat(),
        "total": len(results),
        "online": online_count,
        "offline": len(results) - online_count,
        "offline_envs": offline_envs,
        "env_details": env_details
    })
    cutoff = (datetime.now() - timedelta(days=90)).isoformat()
    new_history = [h for h in history if h.get("timestamp", "") >= cutoff]
    if len(new_history) != len(history):
        data["inspection_history"] = new_history

def _check_alerts(data, envs, results):
    """T2.1 离线告警检测：对比上次状态，online→offline 创建告警，offline→online 解决告警。"""
    global _prev_env_statuses
    if not _prev_env_statuses:
        # 首次运行：仅记录基线，不告警（避免启动时把所有离线环境都告一遍）
        _prev_env_statuses = {r["id"]: r["status"] for r in results}
        return
    env_map = {e["id"]: e for e in envs}
    new_statuses = {r["id"]: r["status"] for r in results}
    alerts = data.setdefault("alerts", [])
    existing_active = {a.get("env_id") for a in alerts if a.get("status") == "active"}
    for env_id, new_status in new_statuses.items():
        old_status = _prev_env_statuses.get(env_id)
        if old_status == new_status:
            continue
        env = env_map.get(env_id, {})
        env_name = env.get("name") or env.get("ip") or ("env#" + str(env_id))
        if old_status == "online" and new_status == "offline":
            # 离线告警（去重：已有该 env 的 active 告警则跳过）
            if env_id not in existing_active:
                max_id = max([a.get("id", 0) for a in alerts], default=0)
                alerts.append({
                    "id": max_id + 1,
                    "env_id": env_id,
                    "env_name": env_name,
                    "type": "offline",
                    "message": "环境「" + env_name + "」已离线",
                    "status": "active",
                    "created_at": datetime.now().isoformat(),
                    "acknowledged_at": None,
                    "acknowledged_by": None,
                    "resolved_at": None
                })
                existing_active.add(env_id)
        elif old_status == "offline" and new_status == "online":
            # 恢复在线：把对应 active 告警标记为 resolved
            for a in alerts:
                if a.get("env_id") == env_id and a.get("status") == "active":
                    a["status"] = "resolved"
                    a["resolved_at"] = datetime.now().isoformat()
    _prev_env_statuses = new_statuses

def refresh_status_cache_sync():
    global _status_updating
    if _status_updating:
        return
    _status_updating = True
    try:
        data = load_data()
        envs = data.get("envs", [])
        if not envs:
            with _status_lock:
                _status_cache["env_statuses"] = []
                _status_cache["last_update"] = time.time()
            _prev_env_statuses = {}
            return
        workers = min(len(envs), 50)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            results = list(executor.map(lambda e: {"id": e["id"], "status": "online" if check_env_reachable(e) else "offline"}, envs))
        with _status_lock:
            _status_cache["env_statuses"] = results
            _status_cache["last_update"] = time.time()
        # T2.1：巡检后检测离线告警
        _check_alerts(data, envs, results)
        # T2.3：归档本次巡检快照（每次巡检都记，便于首页折线图）
        _archive_inspect_history(data, envs, results)
        # 归档每次都会新增一条历史，统一落盘
        save_data(data)
    finally:
        _status_updating = False

def get_env_statuses():
    with _status_lock:
        return list(_status_cache["env_statuses"])

def start_status_refresh_thread():
    def loop():
        while True:
            try:
                refresh_status_cache_sync()
            except Exception:
                pass
            time.sleep(20)
    t = threading.Thread(target=loop, daemon=True)
    t.start()

async def broadcast_status():
    while True:
        if connected_clients:
            statuses = get_env_statuses()
            message = json.dumps(statuses, ensure_ascii=False)
            disconnected = set()
            for client in connected_clients.copy():
                try:
                    await client.send_text(message)
                except Exception:
                    disconnected.add(client)
            connected_clients.difference_update(disconnected)
        await asyncio.sleep(15)

@app.get("/")
async def root():
    # 门户首页：返回 index.html，由前端按登录态决定展示网址大全或登录后内容
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    login_path = FRONTEND_DIR / "login.html"
    if login_path.exists():
        return FileResponse(login_path)
    return JSONResponse({"message": "Toolchain Platform API v1.0", "status": "running"})

@app.get("/login.html")
async def login_page():
    login_path = FRONTEND_DIR / "login.html"
    if login_path.exists():
        return FileResponse(login_path)
    return JSONResponse(status_code=404, content={"error": "Not Found"})

@app.get("/index.html")
async def index_page():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"message": "Toolchain Platform API v1.0", "status": "running"})

@app.get("/api")
async def api_root():
    return {"name": "Toolchain Platform API", "version": "1.0.0", "status": "running"}

# ============ AUTH ============

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    data = load_data()
    pw_hash = hash_password(req.password)
    for u in data.get("users", []):
        if u["username"] == req.username and u["password"] == pw_hash:
            token = generate_token()
            expires = (datetime.now() + timedelta(hours=24)).isoformat()
            if "tokens" not in data:
                data["tokens"] = {}
            data["tokens"][token] = {"user_id": u["id"], "expires": expires}
            data["tokens"] = {k: v for k, v in data["tokens"].items() if datetime.fromisoformat(v["expires"]) > datetime.now()}
            save_data(data)
            cg = u.get("company_group", "general")
            cgs = u.get("company_groups", [])
            if cg != "general" and cg not in cgs:
                cgs = [cg] + cgs
            return {"token": token, "user": {"id": u["id"], "username": u["username"], "display_name": u.get("display_name", ""), "role": u["role"], "permissions": get_effective_permissions(u), "pages": u.get("pages", DEFAULT_USER_PAGES), "company_group": cg, "company_groups": cgs}}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.get("/api/auth/me")
async def get_me(request: Request):
    user = require_auth(request)
    cg = user.get("company_group", "general")
    cgs = user.get("company_groups", [])
    if cg != "general" and cg not in cgs:
        cgs = [cg] + cgs
    return {"id": user["id"], "username": user["username"], "display_name": user.get("display_name", ""), "role": user["role"], "permissions": get_effective_permissions(user), "pages": user.get("pages", DEFAULT_USER_PAGES), "company_group": cg, "company_groups": cgs}

@app.post("/api/auth/logout")
async def logout(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    data = load_data()
    if token in data.get("tokens", {}):
        del data["tokens"][token]
        save_data(data)
    return {"message": "Logged out"}

# ============ STATUS ============

@app.get("/api/status")
async def get_status(request: Request):
    optional_auth(request)
    try:
        data = load_data()
        env_statuses = get_env_statuses()
        if not env_statuses or time.time() - _status_cache.get("last_update", 0) > 15:
            threading.Thread(target=refresh_status_cache_sync, daemon=True).start()
        online_count = sum(1 for s in env_statuses if s["status"] == "online")
        for s in env_statuses:
            env = next((e for e in data["envs"] if e["id"] == s["id"]), None)
            if env:
                s["name"] = env.get("name", "")
                s["ip"] = env.get("ip", "")
        active_alerts = sum(1 for a in data.get("alerts", []) if a.get("status") == "active")
        return {"total_envs": len(data["envs"]), "online_envs": online_count, "total_tools": len(data["tools"]), "total_favorites": 0, "env_statuses": env_statuses, "active_alerts": active_alerts}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to get status", "message": str(e)})

# ============ ENVS ============

@app.get("/api/envs")
async def get_envs(request: Request):
    optional_auth(request)
    return load_data()["envs"]

@app.get("/api/envs/{env_id}")
async def get_env(env_id: int, request: Request):
    optional_auth(request)
    data = load_data()
    for env in data["envs"]:
        if env["id"] == env_id:
            env["status"] = "online" if check_env_reachable(env) else "offline"
            return env
    raise HTTPException(status_code=404, detail="Environment not found")

class EnvCreate(BaseModel):
    name: str; ip: str = ""; port: int = 80; path: str = "/"; description: str = ""; protocol: str = "http"; group: str = "环境"; subLinks: list = None; mine: str = ""; accessType: str = "ip"; domain: str = ""

@app.post("/api/envs")
async def create_env(env: EnvCreate, request: Request):
    user = require_auth(request); require_permission(user, "add")
    data = load_data()
    max_id = max((e["id"] for e in data["envs"]), default=0)
    new_env = {"id": max_id + 1, "name": env.name, "ip": env.ip, "port": env.port, "path": env.path, "description": env.description, "protocol": env.protocol, "group": env.group, "mine": env.mine, "accessType": env.accessType, "domain": env.domain}
    if env.subLinks is not None:
        new_env["subLinks"] = env.subLinks
    data["envs"].append(new_env); save_data(data)
    return new_env

class EnvUpdate(BaseModel):
    name: str = None; ip: str = None; port: int = None; path: str = None; description: str = None; protocol: str = None; group: str = None; subLinks: list = None; mine: str = None; accessType: str = None; domain: str = None

@app.put("/api/envs/{env_id}")
async def update_env(env_id: int, env_update: EnvUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for env in data["envs"]:
        if env["id"] == env_id:
            for k in ["name", "ip", "port", "path", "description", "protocol", "group", "subLinks", "mine", "accessType", "domain"]:
                if getattr(env_update, k, None) is not None:
                    env[k] = getattr(env_update, k)
            save_data(data); return env
    raise HTTPException(status_code=404, detail="Environment not found")

@app.delete("/api/envs/{env_id}")
async def delete_env(env_id: int, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    for i, env in enumerate(data["envs"]):
        if env["id"] == env_id:
            data["envs"].pop(i)
            if env_id in data["favorites"]["envs"]: data["favorites"]["envs"].remove(env_id)
            save_data(data); return {"message": "Environment deleted"}
    raise HTTPException(status_code=404, detail="Environment not found")

# ============ TOOLS ============

@app.get("/api/tools")
async def get_tools(request: Request, os_filter: str = None, category: str = None, company_group: str = None, tag: str = None):
    user = require_auth(request)
    data = load_data()
    tools = data["tools"]
    is_admin = user.get("role") == "superadmin"
    user_groups = set(user.get("company_groups", []))
    primary_group = user.get("company_group", "general")
    if primary_group != "general":
        user_groups.add(primary_group)
    allowed_groups = user_groups | {"general"}
    if not is_admin:
        if company_group:
            if company_group != "general" and company_group not in user_groups:
                tools = []
            else:
                tools = [t for t in tools if t.get("company_group", "general") in allowed_groups]
        else:
            tools = [t for t in tools if t.get("company_group", "general") in allowed_groups]
    if os_filter: tools = [t for t in tools if t["os"] == os_filter]
    if category: tools = [t for t in tools if t["category"] == category]
    if company_group and is_admin:
        tools = [t for t in tools if t.get("company_group", "general") == company_group]
    elif company_group and not is_admin and (company_group == "general" or company_group in user_groups):
        tools = [t for t in tools if t.get("company_group", "general") == company_group]
    if tag: tools = [t for t in tools if tag in t.get("tags", [])]
    return tools

@app.get("/api/tool-groups")
async def get_tool_groups(request: Request):
    user = require_auth(request)
    data = load_data()
    all_groups = data.get("tool_company_groups", DEFAULT_COMPANY_GROUPS)
    is_admin = user.get("role") == "superadmin"
    if is_admin:
        return all_groups
    user_groups = set(user.get("company_groups", []))
    primary_group = user.get("company_group", "general")
    if primary_group != "general":
        user_groups.add(primary_group)
    visible_group_ids = user_groups | {"general"}
    return [g for g in all_groups if g["id"] in visible_group_ids]

@app.get("/api/tool-tags")
async def get_tool_tags(request: Request):
    require_auth(request)
    data = load_data()
    all_tags = set()
    for t in data["tools"]:
        for tag in t.get("tags", []):
            all_tags.add(tag)
    return sorted(list(all_tags))

@app.get("/api/tools/{tool_id}")
async def get_tool(tool_id: int, request: Request):
    require_auth(request)
    data = load_data()
    for tool in data["tools"]:
        if tool["id"] == tool_id: return tool
    raise HTTPException(status_code=404, detail="Tool not found")

class ToolCreate(BaseModel):
    name: str; os: str; category: str; icon: str = "fa-solid fa-gear"; description: str = ""; command: str = ""; link: str = ""; package_name: str = None; package_size: int = 0; company_group: str = "general"; tags: list = []

@app.post("/api/tools")
async def create_tool(tool: ToolCreate, request: Request):
    user = require_auth(request); require_permission(user, "add")
    data = load_data()
    max_id = max((t["id"] for t in data["tools"]), default=100)
    icon = tool.icon if tool.icon and tool.icon != "fa-solid fa-gear" else get_default_icon_by_name(tool.name)
    new_tool = {"id": max_id + 1, "name": tool.name, "os": tool.os, "category": tool.category, "icon": icon, "description": tool.description, "command": tool.command, "link": tool.link, "package_name": tool.package_name, "package_size": tool.package_size, "company_group": tool.company_group or "general", "tags": tool.tags or []}
    data["tools"].append(new_tool)
    if tool.category not in data["categories"].get(tool.os, []):
        if tool.os not in data["categories"]: data["categories"][tool.os] = []
        data["categories"][tool.os].append(tool.category)
    save_data(data); return new_tool

class ToolUpdate(BaseModel):
    name: str = None; os: str = None; category: str = None; icon: str = None; description: str = None; command: str = None; link: str = None; package_name: str = None; package_size: int = None; company_group: str = None; tags: list = None

@app.put("/api/tools/{tool_id}")
async def update_tool(tool_id: int, tool_update: ToolUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for tool in data["tools"]:
        if tool["id"] == tool_id:
            for k in ["name", "os", "category", "icon", "description", "command", "link", "package_name", "package_size", "company_group", "tags"]:
                if getattr(tool_update, k, None) is not None:
                    tool[k] = getattr(tool_update, k)
            save_data(data); return tool
    raise HTTPException(status_code=404, detail="Tool not found")

@app.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: int, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    for i, tool in enumerate(data["tools"]):
        if tool["id"] == tool_id:
            if tool.get("package_name"):
                old_pkg = TOOL_PACKAGES_DIR / tool["package_name"]
                if old_pkg.exists():
                    old_pkg.unlink()
            data["tools"].pop(i)
            if tool_id in data["favorites"]["tools"]: data["favorites"]["tools"].remove(tool_id)
            save_data(data); return {"message": "Tool deleted"}
    raise HTTPException(status_code=404, detail="Tool not found")

@app.post("/api/tools/{tool_id}/upload-package")
async def upload_tool_package(tool_id: int, file: UploadFile = File(...), request: Request = None):
    user = require_auth(request)
    require_permission(user, "modify")
    data = load_data()
    tool = None
    for t in data["tools"]:
        if t["id"] == tool_id:
            tool = t
            break
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    content = await file.read()
    max_size = 500 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="文件大小超过500MB限制")
    if tool.get("package_name"):
        old_pkg = TOOL_PACKAGES_DIR / tool["package_name"]
        if old_pkg.exists():
            old_pkg.unlink()
    safe_name = os.path.basename(file.filename)
    stored_name = f"tool_{tool_id}_{secrets.token_hex(4)}_{safe_name}"
    file_path = TOOL_PACKAGES_DIR / stored_name
    with open(file_path, "wb") as f:
        f.write(content)
    tool["package_name"] = stored_name
    tool["package_size"] = len(content)
    save_data(data)
    return {"package_name": stored_name, "package_size": len(content)}

@app.delete("/api/tools/{tool_id}/package")
async def delete_tool_package(tool_id: int, request: Request):
    user = require_auth(request)
    require_permission(user, "modify")
    data = load_data()
    tool = None
    for t in data["tools"]:
        if t["id"] == tool_id:
            tool = t
            break
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if tool.get("package_name"):
        pkg_path = TOOL_PACKAGES_DIR / tool["package_name"]
        if pkg_path.exists():
            pkg_path.unlink()
    tool["package_name"] = ""
    tool["package_size"] = 0
    save_data(data)
    return {"message": "Package deleted"}

@app.get("/api/tools/{tool_id}/download")
async def download_tool_package(tool_id: int, request: Request):
    user = require_auth(request)
    data = load_data()
    tool = None
    for t in data["tools"]:
        if t["id"] == tool_id:
            tool = t
            break
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not tool.get("package_name"):
        raise HTTPException(status_code=404, detail="No package available")
    pkg_path = TOOL_PACKAGES_DIR / tool["package_name"]
    if not pkg_path.exists():
        raise HTTPException(status_code=404, detail="Package file not found")
    import re
    from urllib.parse import quote
    match = re.match(r'^tool_\d+_[a-f0-9]+_(.+)$', tool["package_name"])
    original_name = match.group(1) if match else tool["package_name"]
    from fastapi.responses import FileResponse
    ascii_name = re.sub(r'[^\x00-\x7F]+', '', original_name) or f"tool_{tool_id}.exe"
    encoded_name = quote(original_name)
    headers = {
        "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"
    }
    return FileResponse(
        path=str(pkg_path),
        headers=headers,
        media_type="application/octet-stream"
    )

# ============ CATEGORIES ============

@app.get("/api/categories")
async def get_categories(request: Request):
    optional_auth(request)
    return load_data()["categories"]

# ============ FAVORITES ============

@app.get("/api/favorites")
async def get_favorites(request: Request):
    user = require_auth(request)
    data = load_data()
    username = user["username"]
    default_favs = {"envs": [], "tools": [], "toolbox": []}
    user_favs = data.get("user_favorites", {}).get(username, default_favs)
    for k in default_favs:
        if k not in user_favs:
            user_favs[k] = []
    return user_favs

class FavoriteToggle(BaseModel):
    type: str; id: str

@app.post("/api/favorites/toggle")
async def toggle_favorite(fav: FavoriteToggle, request: Request):
    user = require_auth(request)
    data = load_data()
    username = user["username"]
    if "user_favorites" not in data:
        data["user_favorites"] = {}
    default_favs = {"envs": [], "tools": [], "toolbox": []}
    if username not in data["user_favorites"]:
        data["user_favorites"][username] = default_favs.copy()
    user_favs = data["user_favorites"][username]
    for k in default_favs:
        if k not in user_favs:
            user_favs[k] = []
    if fav.type == "env":
        key = "envs"
        fav_id = int(fav.id)
    elif fav.type == "tool":
        key = "tools"
        fav_id = int(fav.id)
    elif fav.type == "toolbox":
        key = "toolbox"
        fav_id = fav.id
    else:
        raise HTTPException(status_code=400, detail="Invalid type")
    if fav_id in user_favs[key]:
        user_favs[key].remove(fav_id); action = "removed"
    else:
        user_favs[key].append(fav_id); action = "added"
    save_data(data)
    return {"action": action, "favorites": user_favs}

# ============ HISTORY ============

@app.get("/api/history")
async def get_history(request: Request):
    require_auth(request)
    data = load_data()
    return sorted(data["history"], key=lambda x: x["time"], reverse=True)

class HistoryAdd(BaseModel):
    type: str; id: int

@app.post("/api/history")
async def add_history(entry: HistoryAdd, request: Request):
    require_auth(request)
    data = load_data()
    new_entry = {"type": entry.type, "id": entry.id, "time": datetime.now().isoformat()}
    data["history"].append(new_entry)
    existing, seen, deduped = data["history"], set(), []
    for h in reversed(existing):
        key = (h["type"], h["id"])
        if key not in seen: seen.add(key); deduped.append(h)
    data["history"] = list(reversed(deduped))[-50:]
    save_data(data); return new_entry

# ============ SETTINGS ============

@app.get("/api/settings")
async def get_settings(request: Request):
    optional_auth(request)
    return load_data()["settings"]

@app.get("/api/menu-order")
async def get_menu_order(request: Request):
    optional_auth(request)
    data = load_data()
    return data.get("menu_order", ["home", "urls", "tools", "programs", "toolbox", "scripts", "favorites", "api", "settings", "users"])

class SettingsUpdate(BaseModel):
    theme: str = None; primaryColor: str = None; toolView: str = None; language: str = None; envGroups: list = None; toolboxGroups: list = None; mineGroups: list = None; menuOrder: list = None

@app.put("/api/settings")
async def update_settings(settings: SettingsUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    s = data["settings"]
    for k in ["theme", "primaryColor", "toolView", "language"]:
        if getattr(settings, k, None) is not None: s[k] = getattr(settings, k)
    if settings.envGroups is not None:
        data["env_groups"] = settings.envGroups
    if settings.toolboxGroups is not None:
        data["toolbox_groups"] = settings.toolboxGroups
    if settings.mineGroups is not None:
        data["mine_groups"] = settings.mineGroups
    if settings.menuOrder is not None:
        data["menu_order"] = settings.menuOrder
    save_data(data); return s

# ============ API CONFIG ============

class ApiConfigUpdate(BaseModel):
    enabled: bool = None
    port: int = None
    token_auth_enabled: bool = None
    api_token: str = None

@app.get("/api/api-config")
async def get_api_config(request: Request):
    user = require_auth(request)
    is_admin = user.get("role") == "superadmin"
    data = load_data()
    config = data.get("api_config", {})
    hostname = socket.gethostname()
    try:
        host_ip = socket.gethostbyname(hostname)
    except:
        host_ip = "127.0.0.1"
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        host_ip = s.getsockname()[0]
    except:
        pass
    finally:
        s.close()
    port = config.get("port", 3143)
    running = check_tcp_port("127.0.0.1", port)
    result = {
        "enabled": config.get("enabled", True),
        "port": port,
        "token_auth_enabled": config.get("token_auth_enabled", True),
        "running": running,
        "base_url": f"http://{host_ip}:{port}",
        "is_admin": is_admin
    }
    if is_admin:
        result["api_token"] = config.get("api_token", "")
    return result

@app.put("/api/api-config")
async def update_api_config(config_update: ApiConfigUpdate, request: Request):
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    if "api_config" not in data:
        data["api_config"] = {"enabled": True, "port": 3143, "token_auth_enabled": True, "api_token": secrets.token_hex(32)}
    config = data["api_config"]
    if config_update.enabled is not None:
        config["enabled"] = config_update.enabled
    if config_update.port is not None:
        config["port"] = config_update.port
    if config_update.token_auth_enabled is not None:
        config["token_auth_enabled"] = config_update.token_auth_enabled
    if config_update.api_token is not None:
        config["api_token"] = config_update.api_token.strip()
    save_data(data)
    return config

@app.post("/api/api-config/generate-token")
async def generate_api_token(request: Request):
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    if "api_config" not in data:
        data["api_config"] = {"enabled": True, "port": 3143, "token_auth_enabled": True, "api_token": ""}
    new_token = secrets.token_hex(32)
    data["api_config"]["api_token"] = new_token
    save_data(data)
    return {"api_token": new_token}

@app.post("/api/api-config/test-connection")
async def test_api_connection(request: Request):
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    config = data.get("api_config", {})
    port = config.get("port", 3143)
    running = check_tcp_port("127.0.0.1", port)
    def _do_request():
        import urllib.request
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api", method="GET")
        if config.get("token_auth_enabled", True) and config.get("api_token"):
            req.add_header("X-API-Token", config["api_token"])
        resp = urllib.request.urlopen(req, timeout=5)
        return resp.status
    try:
        status = await asyncio.to_thread(_do_request)
        return {"running": True, "connected": True, "status": status}
    except Exception as e:
        return {"running": running, "connected": False, "error": str(e)}

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    html = """<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Swagger UI - Toolchain Platform API</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" type="text/css" href="/static/swagger-ui.css">
<style>
html{box-sizing:border-box;overflow-y:scroll}
*,:after,:before{box-sizing:inherit}
body{margin:0;background:#fafafa}
#loader{display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font-size:18px;position:fixed;top:0;left:0;right:0;bottom:0;background:#fafafa;z-index:10}
#loader .spinner{width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#4990e2;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:12px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head><body>
<div id="loader"><div class="spinner"></div>正在加载 API 文档...</div>
<div id="swagger-ui"></div>
<script src="/static/swagger-ui-bundle.js"></script>
<script src="/static/swagger-ui-standalone-preset.js"></script>
<script>
window.onload = function() {
  const ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: "StandaloneLayout"
  });
  window.ui = ui;
  var loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
};
</script>
</body></html>"""
    return HTMLResponse(html)

@app.get("/redoc", include_in_schema=False)
async def custom_redoc():
    html = """<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>ReDoc - Toolchain Platform API</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
#loader{display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font-size:18px;position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:10}
#loader .spinner{width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#667eea;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:12px}
@keyframes spin{to{transform:rotate(360deg)}}
#redoc-container{display:none}
</style>
</head><body>
<div id="loader"><div class="spinner"></div>正在加载 API 文档...</div>
<div id="redoc-container"></div>
<script src="/static/redoc.standalone.js"></script>
<script>
Redoc.init('/openapi.json', {
  hideDownloadButton: true,
  expandResponses: "200"
}, document.getElementById('redoc-container'), function() {
  var loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
  document.getElementById('redoc-container').style.display = 'block';
});
</script>
</body></html>"""
    return HTMLResponse(html)

# ============ ENV GROUPS ============

@app.get("/api/env-groups")
async def get_env_groups(request: Request):
    optional_auth(request)
    data = load_data()
    groups = data.get("env_groups", [])
    groups.sort(key=lambda x: x.get("order", 0))
    return groups

class EnvGroupCreate(BaseModel):
    id: str; name: str; order: int = 0; visible: bool = True

@app.post("/api/env-groups")
async def create_env_group(group: EnvGroupCreate, request: Request):
    user = require_auth(request); require_permission(user, "add")
    data = load_data()
    if "env_groups" not in data: data["env_groups"] = []
    if any(g["id"] == group.id for g in data["env_groups"]):
        raise HTTPException(status_code=400, detail="Group ID already exists")
    data["env_groups"].append({"id": group.id, "name": group.name, "order": group.order, "visible": group.visible})
    save_data(data); return data["env_groups"]

class EnvGroupUpdate(BaseModel):
    name: str = None; order: int = None; visible: bool = None

@app.put("/api/env-groups/{group_id}")
async def update_env_group(group_id: str, group_update: EnvGroupUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for g in data.get("env_groups", []):
        if g["id"] == group_id:
            if group_update.name is not None: g["name"] = group_update.name
            if group_update.order is not None: g["order"] = group_update.order
            if group_update.visible is not None: g["visible"] = group_update.visible
            save_data(data); return g
    raise HTTPException(status_code=404, detail="Group not found")

@app.delete("/api/env-groups/{group_id}")
async def delete_env_group(group_id: str, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    groups = data.get("env_groups", [])
    for i, g in enumerate(groups):
        if g["id"] == group_id:
            if any(e.get("group") == g.get("name") for e in data.get("envs", [])):
                raise HTTPException(status_code=400, detail="Cannot delete group with environments")
            groups.pop(i)
            save_data(data); return {"message": "Group deleted"}
    raise HTTPException(status_code=404, detail="Group not found")

# ============ MINE GROUPS ============

@app.get("/api/mine-groups")
async def get_mine_groups(request: Request):
    optional_auth(request)
    data = load_data()
    groups = data.get("mine_groups", [])
    groups.sort(key=lambda x: x.get("order", 0))
    return groups

class MineGroupCreate(BaseModel):
    id: str; name: str; order: int = 0; visible: bool = True

@app.post("/api/mine-groups")
async def create_mine_group(group: MineGroupCreate, request: Request):
    user = require_auth(request); require_permission(user, "add")
    data = load_data()
    if "mine_groups" not in data: data["mine_groups"] = []
    if any(g["id"] == group.id for g in data["mine_groups"]):
        raise HTTPException(status_code=400, detail="Mine group ID already exists")
    data["mine_groups"].append({"id": group.id, "name": group.name, "order": group.order, "visible": group.visible})
    save_data(data); return data["mine_groups"]

class MineGroupUpdate(BaseModel):
    name: str = None; order: int = None; visible: bool = None

@app.put("/api/mine-groups/{group_id}")
async def update_mine_group(group_id: str, group_update: MineGroupUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for g in data.get("mine_groups", []):
        if g["id"] == group_id:
            if group_update.name is not None: g["name"] = group_update.name
            if group_update.order is not None: g["order"] = group_update.order
            if group_update.visible is not None: g["visible"] = group_update.visible
            save_data(data); return g
    raise HTTPException(status_code=404, detail="Mine group not found")

@app.delete("/api/mine-groups/{group_id}")
async def delete_mine_group(group_id: str, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    groups = data.get("mine_groups", [])
    for i, g in enumerate(groups):
        if g["id"] == group_id:
            groups.pop(i)
            for env in data.get("envs", []):
                if env.get("mine") == g.get("name"):
                    env["mine"] = ""
            save_data(data); return {"message": "Mine group deleted"}
    raise HTTPException(status_code=404, detail="Mine group not found")

# ============ TOOLBOX GROUPS ============

@app.get("/api/toolbox-groups")
async def get_toolbox_groups(request: Request):
    require_auth(request)
    data = load_data()
    groups = data.get("toolbox_groups", [])
    groups.sort(key=lambda x: x.get("order", 0))
    return groups

class ToolboxGroupCreate(BaseModel):
    id: str; name: str; order: int = 0; visible: bool = True

@app.post("/api/toolbox-groups")
async def create_toolbox_group(group: ToolboxGroupCreate, request: Request):
    user = require_auth(request); require_permission(user, "add")
    data = load_data()
    if "toolbox_groups" not in data: data["toolbox_groups"] = []
    if any(g["id"] == group.id for g in data["toolbox_groups"]):
        raise HTTPException(status_code=400, detail="Group ID already exists")
    data["toolbox_groups"].append({"id": group.id, "name": group.name, "order": group.order, "visible": group.visible})
    save_data(data); return data["toolbox_groups"]

class ToolboxGroupUpdate(BaseModel):
    name: str = None; order: int = None; visible: bool = None

@app.put("/api/toolbox-groups/{group_id}")
async def update_toolbox_group(group_id: str, group_update: ToolboxGroupUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for g in data.get("toolbox_groups", []):
        if g["id"] == group_id:
            if group_update.name is not None: g["name"] = group_update.name
            if group_update.order is not None: g["order"] = group_update.order
            if group_update.visible is not None: g["visible"] = group_update.visible
            save_data(data); return g
    raise HTTPException(status_code=404, detail="Group not found")

@app.delete("/api/toolbox-groups/{group_id}")
async def delete_toolbox_group(group_id: str, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    groups = data.get("toolbox_groups", [])
    for i, g in enumerate(groups):
        if g["id"] == group_id:
            groups.pop(i)
            save_data(data); return {"message": "Group deleted"}
    raise HTTPException(status_code=404, detail="Group not found")

# ============ TOOLBOX TOOLS ============

@app.post("/api/toolbox/hash")
async def toolbox_hash(request: Request):
    import hashlib
    body = await request.json()
    text = body.get("text", "")
    algo = body.get("algo", "md5")
    try:
        h = hashlib.new(algo, text.encode("utf-8"))
        return {"algo": algo, "hash": h.hexdigest()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/toolbox/aes-encrypt")
async def toolbox_aes_encrypt(request: Request):
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import pad
    import base64
    body = await request.json()
    text = body.get("text", "")
    key = body.get("key", "")
    try:
        key_bytes = key.encode("utf-8")
        if len(key_bytes) not in [16, 24, 32]:
            key_bytes = key_bytes[:32].ljust(16, b'\0')
        cipher = AES.new(key_bytes, AES.MODE_ECB)
        ct = cipher.encrypt(pad(text.encode("utf-8"), AES.block_size))
        return {"encrypted": base64.b64encode(ct).decode("utf-8")}
    except ImportError:
        # Fallback: simple XOR-based "encryption" (not real AES, just for demo)
        import hashlib
        key_hash = hashlib.sha256(key.encode()).digest()
        result = bytearray()
        for i, b in enumerate(text.encode("utf-8")):
            result.append(b ^ key_hash[i % len(key_hash)])
        return {"encrypted": base64.b64encode(bytes(result)).decode("utf-8"), "note": "PyCryptodome not installed, using XOR fallback"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/toolbox/aes-decrypt")
async def toolbox_aes_decrypt(request: Request):
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import unpad
    import base64
    body = await request.json()
    text = body.get("text", "")
    key = body.get("key", "")
    try:
        key_bytes = key.encode("utf-8")
        if len(key_bytes) not in [16, 24, 32]:
            key_bytes = key_bytes[:32].ljust(16, b'\0')
        cipher = AES.new(key_bytes, AES.MODE_ECB)
        ct = base64.b64decode(text)
        pt = unpad(cipher.decrypt(ct), AES.block_size)
        return {"decrypted": pt.decode("utf-8")}
    except ImportError:
        import hashlib
        key_hash = hashlib.sha256(key.encode()).digest()
        data = base64.b64decode(text)
        result = bytearray()
        for i, b in enumerate(data):
            result.append(b ^ key_hash[i % len(key_hash)])
        try:
            return {"decrypted": bytes(result).decode("utf-8"), "note": "PyCryptodome not installed, using XOR fallback"}
        except:
            raise HTTPException(status_code=400, detail="Decryption failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/toolbox/yaml-to-json")
async def toolbox_yaml_to_json(request: Request):
    try:
        import yaml
        body = await request.json()
        y = body.get("yaml", "")
        result = yaml.safe_load(y)
        return {"json": result}
    except ImportError:
        raise HTTPException(status_code=400, detail="PyYAML not installed on server")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/toolbox/json-to-yaml")
async def toolbox_json_to_yaml(request: Request):
    try:
        import yaml
        body = await request.json()
        j = body.get("json", "")
        if isinstance(j, str):
            import json
            j = json.loads(j)
        return {"yaml": yaml.dump(j, allow_unicode=True, default_flow_style=False)}
    except ImportError:
        raise HTTPException(status_code=400, detail="PyYAML not installed on server")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/toolbox/xml-to-json")
async def toolbox_xml_to_json(request: Request):
    import xml.etree.ElementTree as ET
    body = await request.json()
    xml_str = body.get("xml", "")
    try:
        def elem_to_dict(elem):
            d = {}
            if elem.attrib:
                d["@attributes"] = elem.attrib
            if elem.text and elem.text.strip():
                if len(elem) == 0:
                    return elem.text.strip() if not elem.attrib else {**d, "#text": elem.text.strip()}
                d["#text"] = elem.text.strip()
            for child in elem:
                child_data = elem_to_dict(child)
                tag = child.tag
                if tag in d:
                    if not isinstance(d[tag], list):
                        d[tag] = [d[tag]]
                    d[tag].append(child_data)
                else:
                    d[tag] = child_data
            return d
        root = ET.fromstring(xml_str)
        return {"json": {root.tag: elem_to_dict(root)}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/toolbox/json-to-xml")
async def toolbox_json_to_xml(request: Request):
    import json
    body = await request.json()
    j = body.get("json", "")
    try:
        if isinstance(j, str):
            j = json.loads(j)
        def dict_to_xml(tag, d):
            xml = '<' + tag
            if isinstance(d, dict):
                attrs = d.pop("@attributes", {}) if isinstance(d, dict) else {}
                for k, v in attrs.items():
                    xml += ' ' + k + '="' + str(v) + '"'
                xml += '>'
                text = d.pop("#text", "") if isinstance(d, dict) else ""
                for k, v in d.items():
                    if isinstance(v, list):
                        for item in v:
                            xml += dict_to_xml(k, item)
                    else:
                        xml += dict_to_xml(k, v)
                xml += text
            elif isinstance(d, list):
                xml = ''
                for item in d:
                    xml += '<' + tag + '>' + str(item) + '</' + tag + '>'
                return xml
            else:
                xml += '>' + str(d)
            xml += '</' + tag + '>'
            return xml
        if isinstance(j, dict) and len(j) == 1:
            root_tag = list(j.keys())[0]
            result = dict_to_xml(root_tag, j[root_tag])
        else:
            result = dict_to_xml("root", j)
        return {"xml": '<?xml version="1.0" encoding="UTF-8"?>\n' + result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============ NETWORK TOOLS ============

@app.post("/api/network/ip-info")
async def ip_info(request: Request):
    import socket
    body = await request.json()
    ip = body.get("ip", "").strip()
    try:
        if not ip:
            hostname = socket.gethostname()
            ip = socket.gethostbyname(hostname)
        result = {"ip": ip, "hostname": socket.gethostbyaddr(ip)[0]}
        try:
            import subprocess
            proc = subprocess.run(["whois", ip], capture_output=True, text=True, timeout=10)
            if proc.returncode == 0:
                info = {}
                for line in proc.stdout.split("\n"):
                    if ":" in line and not line.startswith("%"):
                        parts = line.split(":", 1)
                        info[parts[0].strip()] = parts[1].strip()
                result["whois"] = info
        except:
            pass
        return result
    except Exception as e:
        return {"ip": ip, "error": str(e)}

@app.post("/api/toolbox/text-diff")
async def toolbox_text_diff(request: Request):
    body = await request.json()
    old_text = body.get("old", "")
    new_text = body.get("new", "")
    old_lines = old_text.split("\n")
    new_lines = new_text.split("\n")
    diff = []
    i = j = 0
    while i < len(old_lines) or j < len(new_lines):
        if i < len(old_lines) and j < len(new_lines) and old_lines[i] == new_lines[j]:
            diff.append({"type": "equal", "line": old_lines[i]})
            i += 1
            j += 1
        elif j < len(new_lines) and (i >= len(old_lines) or old_lines[i] != new_lines[j]):
            diff.append({"type": "add", "line": new_lines[j]})
            j += 1
        elif i < len(old_lines):
            diff.append({"type": "remove", "line": old_lines[i]})
            i += 1
    return {"diff": diff}

@app.post("/api/network/ssl-check")
async def ssl_check(request: Request):
    import ssl, socket
    body = await request.json()
    domain = body.get("domain", "").strip()
    if not domain: raise HTTPException(status_code=400, detail="Domain required")
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
            s.settimeout(10)
            s.connect((domain, 443))
            cert = s.getpeercert()
        result = {"domain": domain, "valid": True}
        if cert:
            result["subject"] = dict(x[0] for x in cert.get("subject", ()))
            result["issuer"] = dict(x[0] for x in cert.get("issuer", ()))
            result["notBefore"] = cert.get("notBefore", "")
            result["notAfter"] = cert.get("notAfter", "")
            result["subjectAltName"] = cert.get("subjectAltName", "")
        return result
    except Exception as e:
        return {"domain": domain, "valid": False, "error": str(e)}

@app.post("/api/network/dns-lookup")
async def dns_lookup(request: Request):
    import socket
    body = await request.json()
    domain = body.get("domain", "").strip()
    record_type = body.get("type", "A")
    if not domain: raise HTTPException(status_code=400, detail="Domain required")
    results = []
    try:
        if record_type in ("A", "AAAA"):
            family = socket.AF_INET6 if record_type == "AAAA" else socket.AF_INET
            addrs = socket.getaddrinfo(domain, None, family)
            results = list(set(addr[4][0] for addr in addrs))
        elif record_type == "CNAME":
            canonical = socket.getfqdn(domain)
            results = [canonical] if canonical != domain else []
        elif record_type == "MX":
            import subprocess
            proc = subprocess.run(["nslookup", "-type=MX", domain], capture_output=True, text=True, timeout=10)
            for line in proc.stdout.split("\n"):
                if "mail exchanger" in line.lower():
                    results.append(line.strip())
        else:
            import subprocess
            proc = subprocess.run(["nslookup", "-type=" + record_type, domain], capture_output=True, text=True, timeout=10)
            results = [l.strip() for l in proc.stdout.split("\n") if l.strip() and "Server" not in l and "Address" not in l]
    except Exception as e:
        return {"domain": domain, "type": record_type, "error": str(e), "records": []}
    return {"domain": domain, "type": record_type, "records": results}

@app.post("/api/network/http-status")
async def http_status_check(request: Request):
    import urllib.request, urllib.error
    body = await request.json()
    url = body.get("url", "").strip()
    if not url: raise HTTPException(status_code=400, detail="URL required")
    if not url.startswith("http"): url = "https://" + url
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        headers = {k: v for k, v in resp.headers.items()}
        return {"url": url, "status": resp.status, "headers": headers}
    except urllib.error.HTTPError as e:
        headers = {k: v for k, v in e.headers.items()} if e.headers else {}
        return {"url": url, "status": e.code, "headers": headers}
    except Exception as e:
        return {"url": url, "error": str(e)}

@app.post("/api/network/port-scan")
async def port_scan(request: Request):
    import socket
    body = await request.json()
    host = body.get("host", "").strip()
    ports = body.get("ports", [])
    if not host or not ports: raise HTTPException(status_code=400, detail="Host and ports required")
    results = []
    for port in ports[:50]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2)
            result = s.connect_ex((host, port))
            results.append({"port": port, "open": result == 0})
            s.close()
        except:
            results.append({"port": port, "open": False})
    return {"host": host, "results": results}

# ============ SEARCH ============

@app.get("/api/search")
async def search(request: Request, q: str = ""):
    require_auth(request)
    if not q: return {"envs": [], "tools": []}
    data = load_data(); ql = q.lower()
    return {"envs": [e for e in data["envs"] if ql in e["name"].lower() or ql in e["ip"].lower()], "tools": [t for t in data["tools"] if ql in t["name"].lower() or ql in t["description"].lower()]}

# ============ SCRIPTS ============

import zipfile, io as _io
from fastapi.responses import StreamingResponse

@app.get("/api/scripts")
async def get_scripts(request: Request):
    require_auth(request)
    data = load_data()
    return data.get("scripts", [])

class ScriptUpdate(BaseModel):
    name: str = None; description: str = None; category: str = None

@app.post("/api/scripts/upload")
async def upload_script(file: UploadFile = File(...), request: Request = None):
    user = require_auth(request)
    require_permission(user, "add")
    content = await file.read()
    max_size = 50 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="文件大小超过50MB限制")
    safe_name = os.path.basename(file.filename)
    stored_name = f"{secrets.token_hex(8)}_{safe_name}"
    file_path = SCRIPTS_DIR / stored_name
    with open(file_path, "wb") as f:
        f.write(content)
    data = load_data()
    if "scripts" not in data: data["scripts"] = []
    max_id = max((s["id"] for s in data["scripts"]), default=0)
    script = {
        "id": max_id + 1,
        "name": safe_name,
        "stored_name": stored_name,
        "size": len(content),
        "category": "未分类",
        "description": "",
        "uploaded_by": user.get("display_name", user.get("username", "")),
        "uploaded_at": datetime.now().isoformat()
    }
    data["scripts"].append(script)
    save_data(data)
    return script

@app.put("/api/scripts/{script_id}")
async def update_script(script_id: int, req: ScriptUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for s in data.get("scripts", []):
        if s["id"] == script_id:
            if req.name is not None: s["name"] = req.name
            if req.description is not None: s["description"] = req.description
            if req.category is not None: s["category"] = req.category
            save_data(data); return s
    raise HTTPException(status_code=404, detail="Script not found")

@app.delete("/api/scripts/{script_id}")
async def delete_script(script_id: int, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    for i, s in enumerate(data.get("scripts", [])):
        if s["id"] == script_id:
            file_path = SCRIPTS_DIR / s.get("stored_name", "")
            if file_path.exists():
                file_path.unlink()
            data["scripts"].pop(i)
            save_data(data); return {"message": "Script deleted"}
    raise HTTPException(status_code=404, detail="Script not found")

@app.get("/api/scripts/{script_id}/download")
async def download_script(script_id: int, request: Request):
    require_auth(request)
    data = load_data()
    for s in data.get("scripts", []):
        if s["id"] == script_id:
            file_path = SCRIPTS_DIR / s.get("stored_name", "")
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found on disk")
            return FileResponse(str(file_path), filename=s["name"])
    raise HTTPException(status_code=404, detail="Script not found")

@app.post("/api/scripts/batch-download")
async def batch_download_scripts(request: Request):
    user = require_auth(request)
    try:
        body = await request.json()
        ids = body if isinstance(body, list) else (body.get("ids") if isinstance(body, dict) else None)
    except Exception:
        ids = None
    data = load_data()
    scripts = data.get("scripts", [])
    selected = [s for s in scripts if s["id"] in (ids or [])]
    if not selected:
        raise HTTPException(status_code=400, detail="No scripts selected")
    mem_zip = _io.BytesIO()
    with zipfile.ZipFile(mem_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for s in selected:
            file_path = SCRIPTS_DIR / s.get("stored_name", "")
            if file_path.exists():
                zf.write(str(file_path), s["name"])
    mem_zip.seek(0)
    return StreamingResponse(mem_zip, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=scripts.zip"})

# ============ PROGRAMS ============

@app.get("/api/programs")
async def get_programs(request: Request, category: str = None, env: str = None, keyword: str = None):
    require_auth(request)
    data = load_data()
    programs = data.get("programs", [])
    if category:
        programs = [p for p in programs if p.get("category") == category]
    if env:
        programs = [p for p in programs if env in (p.get("envs") or [])]
    if keyword:
        kw = keyword.lower()
        programs = [p for p in programs if kw in (p.get("name") or "").lower()]
    return programs

@app.get("/api/programs/{program_id}")
async def get_program(program_id: int, request: Request):
    require_auth(request)
    data = load_data()
    for p in data.get("programs", []):
        if p["id"] == program_id:
            return p
    raise HTTPException(status_code=404, detail="Program not found")

@app.post("/api/programs/upload")
async def upload_program(
    file: UploadFile = File(...),
    name: str = Form(""),
    version: str = Form(""),
    category: str = Form("未分类"),
    envs: str = Form(""),
    description: str = Form(""),
    dependencies: str = Form(""),
    usage_cmd: str = Form(""),
    request: Request = None
):
    user = require_auth(request)
    require_permission(user, "add")
    content = await file.read()
    max_size = 100 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="文件大小超过100MB限制")
    safe_name = os.path.basename(file.filename or "unknown")
    stored_name = f"{secrets.token_hex(8)}_{safe_name}"
    file_path = PROGRAMS_DIR / stored_name
    with open(file_path, "wb") as f:
        f.write(content)
    import json as _json
    try:
        envs_list = _json.loads(envs) if envs else []
        if not isinstance(envs_list, list): envs_list = []
    except Exception:
        envs_norm = envs.replace("，", ",").replace("、", ",")
        envs_list = [e.strip() for e in envs_norm.split(",") if e.strip()]
    data = load_data()
    if "programs" not in data: data["programs"] = []
    max_id = max((p["id"] for p in data["programs"]), default=0)
    now = datetime.now().isoformat()
    prog_name = name.strip() if name and name.strip() else safe_name
    prog_version = version.strip() if version and version.strip() else ""
    prog_category = category.strip() if category and category.strip() else "未分类"
    program = {
        "id": max_id + 1,
        "name": prog_name,
        "version": prog_version,
        "category": prog_category,
        "envs": envs_list,
        "description": description.strip() if description else "",
        "dependencies": dependencies.strip() if dependencies else "",
        "usage_cmd": usage_cmd.strip() if usage_cmd else "",
        "stored_name": stored_name,
        "original_name": safe_name,
        "file_size": len(content),
        "uploader_id": user.get("id", 0),
        "uploader_name": user.get("display_name", user.get("username", "")),
        "download_count": 0,
        "created_at": now,
        "updated_at": now
    }
    data["programs"].append(program)
    save_data(data)
    return program

class ProgramUpdate(BaseModel):
    name: str = None; version: str = None; category: str = None; envs: list = None
    description: str = None; dependencies: str = None; usage_cmd: str = None

@app.put("/api/programs/{program_id}")
async def update_program(program_id: int, req: ProgramUpdate, request: Request):
    user = require_auth(request); require_permission(user, "modify")
    data = load_data()
    for p in data.get("programs", []):
        if p["id"] == program_id:
            if p.get("uploader_id") != user.get("id") and user.get("role") != "superadmin":
                raise HTTPException(status_code=403, detail="只能编辑自己上传的程序")
            for k in ["name", "version", "category", "envs", "description", "dependencies", "usage_cmd"]:
                val = getattr(req, k, None)
                if val is not None: p[k] = val
            p["updated_at"] = datetime.now().isoformat()
            save_data(data); return p
    raise HTTPException(status_code=404, detail="Program not found")

@app.delete("/api/programs/{program_id}")
async def delete_program(program_id: int, request: Request):
    user = require_auth(request); require_permission(user, "delete")
    data = load_data()
    for i, p in enumerate(data.get("programs", [])):
        if p["id"] == program_id:
            if p.get("uploader_id") != user.get("id") and user.get("role") != "superadmin":
                raise HTTPException(status_code=403, detail="只能删除自己上传的程序")
            file_path = PROGRAMS_DIR / p.get("stored_name", "")
            if file_path.exists():
                file_path.unlink()
            data["programs"].pop(i)
            save_data(data); return {"message": "Program deleted"}
    raise HTTPException(status_code=404, detail="Program not found")

@app.get("/api/programs/{program_id}/download")
async def download_program(program_id: int, request: Request):
    require_auth(request)
    data = load_data()
    for p in data.get("programs", []):
        if p["id"] == program_id:
            file_path = PROGRAMS_DIR / p.get("stored_name", "")
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found on disk")
            p["download_count"] = p.get("download_count", 0) + 1
            save_data(data)
            return FileResponse(str(file_path), filename=p.get("original_name", p.get("name", "download")))
    raise HTTPException(status_code=404, detail="Program not found")

@app.post("/api/programs/batch-download")
async def batch_download_programs(request: Request):
    require_auth(request)
    try:
        body = await request.json()
        ids = body if isinstance(body, list) else (body.get("ids") if isinstance(body, dict) else None)
    except Exception:
        ids = None
    data = load_data()
    programs = data.get("programs", [])
    selected = [p for p in programs if p["id"] in (ids or [])]
    if not selected:
        raise HTTPException(status_code=400, detail="No programs selected")
    mem_zip = _io.BytesIO()
    with zipfile.ZipFile(mem_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for p in selected:
            file_path = PROGRAMS_DIR / p.get("stored_name", "")
            if file_path.exists():
                zf.write(str(file_path), p.get("original_name", p.get("name", "file")))
    mem_zip.seek(0)
    return StreamingResponse(mem_zip, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=programs.zip"})

@app.get("/api/program-categories")
async def get_program_categories(request: Request):
    require_auth(request)
    data = load_data()
    return data.get("program_categories", ["脚本", "服务", "配置", "工具"])

class ProgramCategoryCreate(BaseModel):
    name: str

@app.post("/api/program-categories")
async def create_program_category(req: ProgramCategoryCreate, request: Request):
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    if "program_categories" not in data:
        data["program_categories"] = ["脚本", "服务", "配置", "工具"]
    if req.name not in data["program_categories"]:
        data["program_categories"].append(req.name)
        save_data(data)
    return {"message": "Category created", "categories": data["program_categories"]}

# ============ USER MANAGEMENT (superadmin only) ============

DEFAULT_USER_PAGES = ["home", "urls", "tools", "toolbox", "favorites", "programs"]

@app.get("/api/users")
async def get_users(request: Request):
    user = require_auth(request)
    if user["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    result = []
    for u in data.get("users", []):
        cg = u.get("company_group", "general")
        cgs = u.get("company_groups", [])
        if cg != "general" and cg not in cgs:
            cgs = [cg] + cgs
        result.append({"id": u["id"], "username": u["username"], "display_name": u.get("display_name", ""), "role": u["role"], "permissions": u["permissions"], "pages": u.get("pages", DEFAULT_USER_PAGES), "company_group": cg, "company_groups": cgs})
    return result

class UserCreate(BaseModel):
    username: str; password: str; display_name: str = ""; role: str = "user"; permissions: list = ["view"]; pages: list = None; company_group: str = "general"; company_groups: list = None

class RegisterRequest(BaseModel):
    username: str; password: str; display_name: str; company_group: str = "general"

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    username = req.username.strip().lower()
    parts = username.split('@')
    if len(parts) != 2 or parts[1] != 'boonray.com' or len(parts[0]) < 1:
        raise HTTPException(status_code=400, detail="请使用正确的 @boonray.com 企业邮箱注册")
    if not req.display_name or len(req.display_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="请填写您的真实姓名")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少6位")
    valid_groups = {g["id"] for g in DEFAULT_COMPANY_GROUPS if g["id"] != "general"}
    company_group = req.company_group
    if company_group not in valid_groups:
        raise HTTPException(status_code=400, detail="请选择有效的所属组")
    data = load_data()
    if any(u["username"].lower() == username for u in data.get("users", [])):
        raise HTTPException(status_code=400, detail="该邮箱已注册")
    max_id = max((u["id"] for u in data.get("users", [])), default=0)
    new_user = {"id": max_id + 1, "username": username, "password": hash_password(req.password), "display_name": req.display_name.strip(), "role": "user", "permissions": ["view"], "pages": list(DEFAULT_USER_PAGES), "company_group": company_group, "company_groups": [company_group]}
    if "users" not in data: data["users"] = []
    data["users"].append(new_user)
    token = generate_token()
    expires = (datetime.now() + timedelta(hours=24)).isoformat()
    if "tokens" not in data: data["tokens"] = {}
    data["tokens"][token] = {"user_id": new_user["id"], "expires": expires}
    data["tokens"] = {k: v for k, v in data["tokens"].items() if datetime.fromisoformat(v["expires"]) > datetime.now()}
    save_data(data)
    return {"token": token, "user": {"id": new_user["id"], "username": new_user["username"], "display_name": new_user["display_name"], "role": new_user["role"], "permissions": new_user["permissions"], "pages": new_user["pages"], "company_group": new_user["company_group"], "company_groups": new_user["company_groups"]}}

@app.post("/api/users")
async def create_user(req: UserCreate, request: Request):
    admin = require_auth(request)
    if admin["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    if any(u["username"] == req.username for u in data.get("users", [])):
        raise HTTPException(status_code=400, detail="Username already exists")
    max_id = max((u["id"] for u in data.get("users", [])), default=0)
    pages = req.pages if req.pages is not None else list(DEFAULT_USER_PAGES)
    cg = req.company_group or "general"
    cgs = req.company_groups if req.company_groups is not None else ([cg] if cg != "general" else [])
    if cg != "general" and cg not in cgs:
        cgs = [cg] + cgs
    new_user = {"id": max_id + 1, "username": req.username, "password": hash_password(req.password), "display_name": req.display_name, "role": req.role, "permissions": req.permissions, "pages": pages, "company_group": cg, "company_groups": cgs}
    if "users" not in data: data["users"] = []
    data["users"].append(new_user); save_data(data)
    return {"id": new_user["id"], "username": new_user["username"], "display_name": new_user["display_name"], "role": new_user["role"], "permissions": new_user["permissions"], "pages": new_user["pages"], "company_group": new_user["company_group"], "company_groups": new_user["company_groups"]}

class UserUpdate(BaseModel):
    username: str = None; password: str = None; display_name: str = None; role: str = None; permissions: list = None; pages: list = None; company_group: str = None; company_groups: list = None

@app.put("/api/users/{user_id}")
async def update_user(user_id: int, req: UserUpdate, request: Request):
    admin = require_auth(request)
    if admin["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    for u in data.get("users", []):
        if u["id"] == user_id:
            if req.username is not None: u["username"] = req.username
            if req.password: u["password"] = hash_password(req.password)
            if req.display_name is not None: u["display_name"] = req.display_name
            if req.role is not None: u["role"] = req.role
            if req.permissions is not None: u["permissions"] = req.permissions
            if req.pages is not None: u["pages"] = req.pages
            if req.company_groups is not None: u["company_groups"] = req.company_groups
            if req.company_group is not None:
                u["company_group"] = req.company_group
                if req.company_group != "general" and req.company_group not in u.get("company_groups", []):
                    if "company_groups" not in u: u["company_groups"] = []
                    u["company_groups"].insert(0, req.company_group)
            save_data(data)
            cg = u.get("company_group", "general")
            cgs = u.get("company_groups", [])
            if cg != "general" and cg not in cgs:
                cgs = [cg] + cgs
            return {"id": u["id"], "username": u["username"], "display_name": u.get("display_name", ""), "role": u["role"], "permissions": u["permissions"], "pages": u.get("pages", DEFAULT_USER_PAGES), "company_group": cg, "company_groups": cgs}
    raise HTTPException(status_code=404, detail="User not found")

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, request: Request):
    admin = require_auth(request)
    if admin["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    if user_id == 1: raise HTTPException(status_code=400, detail="Cannot delete superadmin")
    data = load_data()
    for i, u in enumerate(data.get("users", [])):
        if u["id"] == user_id:
            data["users"].pop(i)
            data["tokens"] = {k: v for k, v in data.get("tokens", {}).items() if v["user_id"] != user_id}
            save_data(data); return {"message": "User deleted"}
    raise HTTPException(status_code=404, detail="User not found")

class PermissionGrant(BaseModel):
    user_id: int; permissions: list; duration_hours: float

@app.post("/api/users/grant")
async def grant_permission(grant: PermissionGrant, request: Request):
    admin = require_auth(request)
    if admin["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    expires = (datetime.now() + timedelta(hours=grant.duration_hours)).isoformat()
    if "permission_grants" not in data: data["permission_grants"] = []
    data["permission_grants"].append({"user_id": grant.user_id, "permissions": grant.permissions, "expires": expires, "granted_at": datetime.now().isoformat()})
    save_data(data)
    return {"message": "Permission granted", "expires": expires}

@app.get("/api/users/grants")
async def get_grants(request: Request):
    admin = require_auth(request)
    if admin["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    now = datetime.now()
    return [g for g in data.get("permission_grants", []) if datetime.fromisoformat(g["expires"]) > now]

@app.delete("/api/users/grants/{grant_index}")
async def revoke_grant(grant_index: int, request: Request):
    admin = require_auth(request)
    if admin["role"] != "superadmin": raise HTTPException(status_code=403, detail="Superadmin only")
    data = load_data()
    now = datetime.now()
    active = [g for g in data.get("permission_grants", []) if datetime.fromisoformat(g["expires"]) > now]
    if grant_index < 0 or grant_index >= len(active):
        raise HTTPException(status_code=404, detail="Grant not found")
    data["permission_grants"].remove(active[grant_index])
    save_data(data); return {"message": "Permission revoked"}

# ============ QUICK ENTRIES ============

@app.get("/api/quick-entries")
async def get_quick_entries(request: Request):
    user = require_auth(request)
    data = load_data()
    username = user["username"]
    global_entries = data.get("quick_entries", [])
    user_entries = data.get("user_quick_entries", {}).get(username, [])
    return global_entries + user_entries

class QuickEntryCreate(BaseModel):
    name: str; url: str; icon: str = "fa-solid fa-link"; description: str = ""

@app.post("/api/quick-entries")
async def create_quick_entry(entry: QuickEntryCreate, request: Request):
    user = require_auth(request)
    data = load_data()
    username = user["username"]
    is_admin = check_permission(user, "add")
    if is_admin:
        bucket = data.setdefault("quick_entries", [])
    else:
        bucket = data.setdefault("user_quick_entries", {}).setdefault(username, [])
    all_ids = [e["id"] for e in data.get("quick_entries", [])]
    for ue in data.get("user_quick_entries", {}).values():
        all_ids.extend(e["id"] for e in ue)
    max_id = max(all_ids, default=0)
    new_entry = {"id": max_id + 1, "name": entry.name, "url": entry.url, "icon": entry.icon, "description": entry.description, "created_by": username}
    bucket.append(new_entry)
    save_data(data)
    return new_entry

class QuickEntryUpdate(BaseModel):
    name: str = None; url: str = None; icon: str = None; description: str = None

@app.put("/api/quick-entries/{entry_id}")
async def update_quick_entry(entry_id: int, entry_update: QuickEntryUpdate, request: Request):
    user = require_auth(request)
    data = load_data()
    username = user["username"]
    is_admin = check_permission(user, "modify")
    buckets = [data.get("quick_entries", [])]
    if not is_admin:
        buckets = [data.get("user_quick_entries", {}).get(username, [])]
    else:
        buckets.extend(data.get("user_quick_entries", {}).values())
    for bucket in buckets:
        for entry in bucket:
            if entry["id"] == entry_id:
                if not is_admin and entry.get("created_by") != username:
                    raise HTTPException(status_code=403, detail="Permission denied")
                for k in ["name", "url", "icon", "description"]:
                    if getattr(entry_update, k, None) is not None:
                        entry[k] = getattr(entry_update, k)
                save_data(data)
                return entry
    raise HTTPException(status_code=404, detail="Quick entry not found")

@app.delete("/api/quick-entries/{entry_id}")
async def delete_quick_entry(entry_id: int, request: Request):
    user = require_auth(request)
    data = load_data()
    username = user["username"]
    is_admin = check_permission(user, "delete")
    buckets = [data.get("quick_entries", [])]
    if not is_admin:
        buckets = [data.get("user_quick_entries", {}).get(username, [])]
    else:
        buckets.extend(data.get("user_quick_entries", {}).values())
    for bucket in buckets:
        for i, entry in enumerate(bucket):
            if entry["id"] == entry_id:
                if not is_admin and entry.get("created_by") != username:
                    raise HTTPException(status_code=403, detail="Permission denied")
                bucket.pop(i)
                save_data(data)
                return {"message": "Quick entry deleted"}
    raise HTTPException(status_code=404, detail="Quick entry not found")

# ============ ALERTS (T2.1 离线告警 + 告警中心) ============

@app.get("/api/alerts")
async def list_alerts(request: Request, status: str = None):
    user = require_auth(request)
    data = load_data()
    alerts = data.get("alerts", [])
    if status:
        alerts = [a for a in alerts if a.get("status") == status]
    alerts = sorted(alerts, key=lambda a: a.get("created_at", ""), reverse=True)
    return {"alerts": alerts, "total": len(alerts)}

@app.post("/api/alerts/{alert_id}/ack")
async def ack_alert(alert_id: int, request: Request):
    user = require_auth(request)
    data = load_data()
    for a in data.get("alerts", []):
        if a.get("id") == alert_id:
            a["status"] = "acknowledged"
            a["acknowledged_at"] = datetime.now().isoformat()
            a["acknowledged_by"] = user.get("username", "")
            save_data(data)
            return a
    raise HTTPException(status_code=404, detail="Alert not found")

@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: int, request: Request):
    user = require_auth(request)
    if not check_permission(user, "delete"):
        raise HTTPException(status_code=403, detail="Permission denied")
    data = load_data()
    alerts = data.get("alerts", [])
    for i, a in enumerate(alerts):
        if a.get("id") == alert_id:
            alerts.pop(i)
            save_data(data)
            return {"message": "Alert deleted"}
    raise HTTPException(status_code=404, detail="Alert not found")

# ============ RECYCLE REQUESTS (T2.2 资源回收审批流) ============

class RecycleRequestCreate(BaseModel):
    resource_type: str   # env | tool | program
    resource_id: int
    reason: str = ""

@app.post("/api/recycle-requests")
async def create_recycle_request(req: RecycleRequestCreate, request: Request):
    user = require_auth(request)
    if req.resource_type not in ("env", "tool", "program"):
        raise HTTPException(status_code=400, detail="resource_type 必须为 env/tool/program")
    data = load_data()
    # 校验资源存在并取名称
    resource_name = ""
    if req.resource_type == "env":
        res = next((e for e in data.get("envs", []) if e.get("id") == req.resource_id), None)
        if not res: raise HTTPException(status_code=404, detail="环境不存在")
        resource_name = res.get("name") or res.get("ip") or ("env#" + str(req.resource_id))
    elif req.resource_type == "tool":
        res = next((t for t in data.get("tools", []) if t.get("id") == req.resource_id), None)
        if not res: raise HTTPException(status_code=404, detail="工具不存在")
        resource_name = res.get("name", "tool#" + str(req.resource_id))
    else:  # program
        res = next((p for p in data.get("programs", []) if p.get("id") == req.resource_id), None)
        if not res: raise HTTPException(status_code=404, detail="程序不存在")
        resource_name = res.get("name", "program#" + str(req.resource_id))
    # 去重：同一资源已有 pending 申请则拒绝
    existing = [r for r in data.get("recycle_requests", []) if r.get("resource_type") == req.resource_type and r.get("resource_id") == req.resource_id and r.get("status") == "pending"]
    if existing:
        raise HTTPException(status_code=409, detail="该资源已有待审批的回收申请")
    requests = data.setdefault("recycle_requests", [])
    max_id = max([r.get("id", 0) for r in requests], default=0)
    new_req = {
        "id": max_id + 1,
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
        "resource_name": resource_name,
        "requester_id": user.get("id"),
        "requester_name": user.get("username", ""),
        "reason": req.reason.strip(),
        "status": "pending",
        "approver_id": None,
        "approver_name": None,
        "approved_at": None,
        "rejected_at": None,
        "executed_at": None,
        "created_at": datetime.now().isoformat()
    }
    requests.append(new_req)
    save_data(data)
    return new_req

@app.get("/api/recycle-requests")
async def list_recycle_requests(request: Request, status: str = None):
    user = require_auth(request)
    data = load_data()
    reqs = data.get("recycle_requests", [])
    if status:
        reqs = [r for r in reqs if r.get("status") == status]
    reqs = sorted(reqs, key=lambda r: r.get("created_at", ""), reverse=True)
    return {"requests": reqs, "total": len(reqs)}

@app.post("/api/recycle-requests/{req_id}/approve")
async def approve_recycle_request(req_id: int, request: Request):
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="仅超级管理员可审批")
    data = load_data()
    for r in data.get("recycle_requests", []):
        if r.get("id") == req_id:
            if r.get("status") != "pending":
                raise HTTPException(status_code=400, detail="该申请当前状态不可审批")
            r["status"] = "approved"
            r["approver_id"] = user.get("id")
            r["approver_name"] = user.get("username", "")
            r["approved_at"] = datetime.now().isoformat()
            save_data(data)
            return r
    raise HTTPException(status_code=404, detail="回收申请不存在")

@app.post("/api/recycle-requests/{req_id}/reject")
async def reject_recycle_request(req_id: int, request: Request):
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="仅超级管理员可审批")
    data = load_data()
    for r in data.get("recycle_requests", []):
        if r.get("id") == req_id:
            if r.get("status") != "pending":
                raise HTTPException(status_code=400, detail="该申请当前状态不可驳回")
            r["status"] = "rejected"
            r["approver_id"] = user.get("id")
            r["approver_name"] = user.get("username", "")
            r["rejected_at"] = datetime.now().isoformat()
            save_data(data)
            return r
    raise HTTPException(status_code=404, detail="回收申请不存在")

@app.post("/api/recycle-requests/{req_id}/execute")
async def execute_recycle_request(req_id: int, request: Request):
    """执行回收：删除资源 + 标记 done。仅 superadmin，且申请须为 approved。"""
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="仅超级管理员可执行回收")
    data = load_data()
    for r in data.get("recycle_requests", []):
        if r.get("id") == req_id:
            if r.get("status") != "approved":
                raise HTTPException(status_code=400, detail="仅已通过的申请可执行回收")
            # 执行删除
            rtype = r.get("resource_type")
            rid = r.get("resource_id")
            deleted = False
            if rtype == "env":
                for i, e in enumerate(data.get("envs", [])):
                    if e.get("id") == rid:
                        data["envs"].pop(i); deleted = True
                        if rid in data.get("favorites", {}).get("envs", []):
                            data["favorites"]["envs"].remove(rid)
                        break
            elif rtype == "tool":
                for i, t in enumerate(data.get("tools", [])):
                    if t.get("id") == rid:
                        data["tools"].pop(i); deleted = True
                        if rid in data.get("favorites", {}).get("tools", []):
                            data["favorites"]["tools"].remove(rid)
                        break
            elif rtype == "program":
                for i, p in enumerate(data.get("programs", [])):
                    if p.get("id") == rid:
                        data["programs"].pop(i); deleted = True; break
            if not deleted:
                raise HTTPException(status_code=404, detail="资源已不存在，可能已被删除")
            r["status"] = "done"
            r["executed_at"] = datetime.now().isoformat()
            save_data(data)
            return {"message": "回收已执行", "request": r}
    raise HTTPException(status_code=404, detail="回收申请不存在")

# ============ T2.3 巡检历史 ============

@app.get("/api/inspect-history")
async def list_inspect_history(request: Request, days: int = 7, env_id: int = None):
    """巡检历史列表，默认近 7 天，支持按环境筛选。"""
    require_auth(request)
    if days < 1 or days > 90:
        days = 7
    data = load_data()
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    history = []
    for h in data.get("inspection_history", []):
        if h.get("timestamp", "") < cutoff:
            continue
        if env_id is not None:
            env_details = h.get("env_details", {})
            ed = env_details.get(str(env_id))
            if not ed:
                continue
            history.append({
                "id": h["id"],
                "timestamp": h["timestamp"],
                "total": 1,
                "online": 1 if ed["status"] == "online" else 0,
                "offline": 0 if ed["status"] == "online" else 1,
                "env_id": env_id
            })
        else:
            history.append(h)
    return {"history": history, "total": len(history)}

@app.get("/api/inspect-history/summary")
async def inspect_history_summary(request: Request, days: int = 7, env_id: int = None):
    """可用率统计：支持指定天数和环境筛选。"""
    require_auth(request)
    if days < 1 or days > 90:
        days = 7
    data = load_data()
    history = data.get("inspection_history", [])
    envs = data.get("envs", [])
    now = datetime.now()

    def stat(d):
        cutoff = (now - timedelta(days=d)).isoformat()
        subset = []
        for h in history:
            if h.get("timestamp", "") < cutoff:
                continue
            if env_id is not None:
                env_details = h.get("env_details", {})
                ed = env_details.get(str(env_id))
                if not ed:
                    continue
                subset.append({
                    "total": 1,
                    "online": 1 if ed["status"] == "online" else 0,
                    "offline": 0 if ed["status"] == "online" else 1,
                    "offline_envs": [] if ed["status"] == "online" else [{"env_id": env_id, "env_name": ed["env_name"]}]
                })
            else:
                subset.append(h)
        if not subset:
            return {"samples": 0, "uptime_rate": None, "avg_online": 0, "avg_offline": 0, "offline_top": []}
        total_checks = sum(h.get("total", 0) for h in subset)
        online_checks = sum(h.get("online", 0) for h in subset)
        uptime = (online_checks / total_checks * 100) if total_checks else 0
        freq = {}
        for h in subset:
            for oe in h.get("offline_envs", []):
                key = (oe.get("env_id"), oe.get("env_name"))
                freq[key] = freq.get(key, 0) + 1
        top = sorted(freq.items(), key=lambda x: -x[1])[:5]
        return {
            "samples": len(subset),
            "uptime_rate": round(uptime, 2),
            "avg_online": round(total_checks / len(subset), 1) if subset else 0,
            "avg_offline": round(sum(h.get("offline", 0) for h in subset) / len(subset), 1) if subset else 0,
            "offline_top": [{"env_id": k[0], "env_name": k[1], "count": v} for k, v in top]
        }

    return {
        "current_days": days,
        "env_id": env_id,
        "stats": stat(days),
        "envs": [{"id": e["id"], "name": e.get("name", e.get("ip", ""))} for e in envs]
    }

# ============ SERVICES (T3 服务目录 + 依赖图谱) ============

SERVICE_TYPES = ("backend", "frontend", "middleware", "database", "job")
SERVICE_STATUSES = ("active", "deprecated", "planning")
DEP_TYPES = ("runtime", "build", "data")
SCORECARD_KEYS = ("has_ci", "has_monitoring", "has_log_aggregation", "has_backup", "has_doc")


def _calc_scorecard(scorecard: dict) -> int:
    """5 项检查各 20 分，满分 100。"""
    if not isinstance(scorecard, dict):
        return 0
    return sum(20 for k in SCORECARD_KEYS if scorecard.get(k))


def _serialize_service(s: dict) -> dict:
    out = dict(s)
    sc = out.get("scorecard")
    if isinstance(sc, dict):
        sc["score"] = _calc_scorecard(sc)
    else:
        out["scorecard"] = {k: False for k in SCORECARD_KEYS}
        out["scorecard"]["score"] = 0
    return out


class ServiceCreate(BaseModel):
    name: str
    code: str = ""
    type: str = "backend"
    owner_id: int = None
    team: str = ""
    description: str = ""
    repo_url: str = ""
    doc_url: str = ""
    api_doc_url: str = ""
    deploy_envs: list = []
    tech_stack: list = []
    port: int = None
    health_check_path: str = ""
    scorecard: dict = {}
    status: str = "active"


class ServiceUpdate(BaseModel):
    name: str = None
    code: str = None
    type: str = None
    owner_id: int = None
    team: str = None
    description: str = None
    repo_url: str = None
    doc_url: str = None
    api_doc_url: str = None
    deploy_envs: list = None
    tech_stack: list = None
    port: int = None
    health_check_path: str = None
    scorecard: dict = None
    status: str = None


class DependencyCreate(BaseModel):
    to_service_id: int
    type: str = "runtime"   # runtime | build | data
    description: str = ""


@app.get("/api/services")
async def list_services(request: Request, type: str = None, team: str = None, owner_id: int = None, status: str = None):
    user = require_auth(request)
    data = load_data()
    services = data.get("services", [])
    if type:
        services = [s for s in services if s.get("type") == type]
    if team:
        services = [s for s in services if s.get("team") == team]
    if owner_id is not None:
        services = [s for s in services if s.get("owner_id") == owner_id]
    if status:
        services = [s for s in services if s.get("status") == status]
    services = sorted(services, key=lambda s: s.get("updated_at") or s.get("created_at", ""), reverse=True)
    return {"services": [_serialize_service(s) for s in services], "total": len(services)}


@app.get("/api/services/graph")
async def services_graph(request: Request):
    """全量依赖图：节点 = 服务，边 = 依赖关系。"""
    require_auth(request)
    data = load_data()
    services = data.get("services", [])
    deps = data.get("service_dependencies", [])
    nodes = [{"id": s.get("id"), "name": s.get("name"), "code": s.get("code", ""),
              "type": s.get("type"), "status": s.get("status"),
              "score": _calc_scorecard(s.get("scorecard", {}))} for s in services]
    edges = [{"id": d.get("id"), "from": d.get("from_service_id"), "to": d.get("to_service_id"),
              "type": d.get("type"), "description": d.get("description", "")} for d in deps]
    return {"nodes": nodes, "edges": edges}


@app.get("/api/services/export")
async def export_services(request: Request):
    user = require_auth(request)
    if not check_permission(user, "delete"):
        raise HTTPException(status_code=403, detail="仅管理员可导出")
    data = load_data()
    services = data.get("services", [])
    import csv, io
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "name", "code", "type", "team", "owner_name", "status", "score", "repo_url", "doc_url", "deploy_envs", "tech_stack"])
    for s in services:
        writer.writerow([s.get("id"), s.get("name"), s.get("code", ""), s.get("type"), s.get("team", ""),
                         s.get("owner_name", ""), s.get("status"), _calc_scorecard(s.get("scorecard", {})),
                         s.get("repo_url", ""), s.get("doc_url", ""),
                         ";".join(str(x) for x in s.get("deploy_envs", [])),
                         ";".join(s.get("tech_stack", []))])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=services.csv"})


@app.get("/api/services/{service_id}")
async def get_service(service_id: int, request: Request):
    require_auth(request)
    data = load_data()
    s = next((x for x in data.get("services", []) if x.get("id") == service_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="服务不存在")
    return _serialize_service(s)


@app.post("/api/services")
async def create_service(req: ServiceCreate, request: Request):
    user = require_auth(request)
    if not check_permission(user, "add"):
        raise HTTPException(status_code=403, detail="Permission denied")
    if req.type not in SERVICE_TYPES:
        raise HTTPException(status_code=400, detail="type 必须为 " + "/".join(SERVICE_TYPES))
    if req.status not in SERVICE_STATUSES:
        raise HTTPException(status_code=400, detail="status 必须为 " + "/".join(SERVICE_STATUSES))
    data = load_data()
    services = data.setdefault("services", [])
    # code 唯一性校验（若提供）
    if req.code:
        if any(s.get("code") == req.code for s in services):
            raise HTTPException(status_code=409, detail="服务代号已存在: " + req.code)
    owner_name = ""
    if req.owner_id:
        owner_name = next((u.get("username", "") for u in data.get("users", []) if u.get("id") == req.owner_id), "")
    max_id = max([s.get("id", 0) for s in services], default=0)
    now = datetime.now().isoformat()
    sc = {k: bool(req.scorecard.get(k, False)) for k in SCORECARD_KEYS}
    sc["score"] = _calc_scorecard(sc)
    new_svc = {
        "id": max_id + 1, "name": req.name.strip(), "code": req.code.strip(), "type": req.type,
        "owner_id": req.owner_id, "owner_name": owner_name, "team": req.team.strip(),
        "description": req.description, "repo_url": req.repo_url, "doc_url": req.doc_url,
        "api_doc_url": req.api_doc_url, "deploy_envs": req.deploy_envs or [], "tech_stack": req.tech_stack or [],
        "port": req.port, "health_check_path": req.health_check_path, "scorecard": sc,
        "status": req.status, "created_at": now, "updated_at": now
    }
    services.append(new_svc)
    save_data(data)
    return _serialize_service(new_svc)


@app.put("/api/services/{service_id}")
async def update_service(service_id: int, req: ServiceUpdate, request: Request):
    user = require_auth(request)
    if not check_permission(user, "modify"):
        raise HTTPException(status_code=403, detail="Permission denied")
    if req.type is not None and req.type not in SERVICE_TYPES:
        raise HTTPException(status_code=400, detail="type 必须为 " + "/".join(SERVICE_TYPES))
    if req.status is not None and req.status not in SERVICE_STATUSES:
        raise HTTPException(status_code=400, detail="status 必须为 " + "/".join(SERVICE_STATUSES))
    data = load_data()
    services = data.get("services", [])
    s = next((x for x in services if x.get("id") == service_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="服务不存在")
    # code 唯一性校验
    if req.code is not None and req.code:
        if any(x.get("code") == req.code and x.get("id") != service_id for x in services):
            raise HTTPException(status_code=409, detail="服务代号已存在: " + req.code)
    updates = req.dict(exclude_none=True)
    # scorecard 需重算
    if "scorecard" in updates:
        sc = {k: bool(updates["scorecard"].get(k, False)) for k in SCORECARD_KEYS}
        sc["score"] = _calc_scorecard(sc)
        updates["scorecard"] = sc
    if "owner_id" in updates and updates["owner_id"] is not None:
        updates["owner_name"] = next((u.get("username", "") for u in data.get("users", []) if u.get("id") == updates["owner_id"]), "")
    s.update(updates)
    s["updated_at"] = datetime.now().isoformat()
    save_data(data)
    return _serialize_service(s)


@app.delete("/api/services/{service_id}")
async def delete_service(service_id: int, request: Request):
    user = require_auth(request)
    if not check_permission(user, "delete"):
        raise HTTPException(status_code=403, detail="Permission denied")
    data = load_data()
    services = data.get("services", [])
    for i, s in enumerate(services):
        if s.get("id") == service_id:
            services.pop(i)
            # 级联删除相关依赖
            data["service_dependencies"] = [d for d in data.get("service_dependencies", [])
                                            if d.get("from_service_id") != service_id and d.get("to_service_id") != service_id]
            save_data(data)
            return {"message": "服务已删除"}
    raise HTTPException(status_code=404, detail="服务不存在")


@app.get("/api/services/{service_id}/scorecard")
async def recalc_scorecard(service_id: int, request: Request):
    """重新计算评分卡分数。"""
    require_auth(request)
    data = load_data()
    s = next((x for x in data.get("services", []) if x.get("id") == service_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="服务不存在")
    sc = s.get("scorecard")
    if not isinstance(sc, dict):
        sc = {}
    for k in SCORECARD_KEYS:
        sc.setdefault(k, False)
    sc["score"] = _calc_scorecard(sc)
    s["scorecard"] = sc
    s["updated_at"] = datetime.now().isoformat()
    save_data(data)
    return {"scorecard": sc, "score": sc["score"]}


@app.get("/api/services/{service_id}/dependencies")
async def list_dependencies(service_id: int, request: Request):
    """获取服务依赖关系：分依赖方（我依赖谁）与被依赖方（谁依赖我）。"""
    require_auth(request)
    data = load_data()
    s = next((x for x in data.get("services", []) if x.get("id") == service_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="服务不存在")
    deps = data.get("service_dependencies", [])
    svc_map = {x.get("id"): x for x in data.get("services", [])}
    outgoing = []
    incoming = []
    for d in deps:
        if d.get("from_service_id") == service_id:
            t = svc_map.get(d.get("to_service_id"), {})
            outgoing.append({"id": d.get("id"), "service_id": d.get("to_service_id"),
                             "service_name": t.get("name", "已删除"), "service_type": t.get("type"),
                             "type": d.get("type"), "description": d.get("description", ""),
                             "created_at": d.get("created_at", "")})
        if d.get("to_service_id") == service_id:
            f = svc_map.get(d.get("from_service_id"), {})
            incoming.append({"id": d.get("id"), "service_id": d.get("from_service_id"),
                             "service_name": f.get("name", "已删除"), "service_type": f.get("type"),
                             "type": d.get("type"), "description": d.get("description", ""),
                             "created_at": d.get("created_at", "")})
    return {"outgoing": outgoing, "incoming": incoming}


@app.post("/api/services/{service_id}/dependencies")
async def add_dependency(service_id: int, req: DependencyCreate, request: Request):
    user = require_auth(request)
    if not check_permission(user, "modify"):
        raise HTTPException(status_code=403, detail="Permission denied")
    if req.type not in DEP_TYPES:
        raise HTTPException(status_code=400, detail="type 必须为 " + "/".join(DEP_TYPES))
    data = load_data()
    services = data.get("services", [])
    s = next((x for x in services if x.get("id") == service_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="服务不存在")
    if req.to_service_id == service_id:
        raise HTTPException(status_code=400, detail="不能依赖自身")
    if not next((x for x in services if x.get("id") == req.to_service_id), None):
        raise HTTPException(status_code=404, detail="被依赖服务不存在")
    deps = data.setdefault("service_dependencies", [])
    # 去重：同方向同目标已存在则拒绝
    if any(d.get("from_service_id") == service_id and d.get("to_service_id") == req.to_service_id for d in deps):
        raise HTTPException(status_code=409, detail="该依赖关系已存在")
    # 防环：简单 DFS 检测从 to_service_id 是否能回到 service_id
    if _would_create_cycle(deps, req.to_service_id, service_id):
        raise HTTPException(status_code=400, detail="添加该依赖会形成循环依赖")
    max_id = max([d.get("id", 0) for d in deps], default=0)
    new_dep = {"id": max_id + 1, "from_service_id": service_id, "to_service_id": req.to_service_id,
               "type": req.type, "description": req.description.strip(), "created_at": datetime.now().isoformat()}
    deps.append(new_dep)
    save_data(data)
    return new_dep


@app.delete("/api/services/{service_id}/dependencies/{dep_id}")
async def remove_dependency(service_id: int, dep_id: int, request: Request):
    user = require_auth(request)
    if not check_permission(user, "modify"):
        raise HTTPException(status_code=403, detail="Permission denied")
    data = load_data()
    deps = data.get("service_dependencies", [])
    for i, d in enumerate(deps):
        if d.get("id") == dep_id and d.get("from_service_id") == service_id:
            deps.pop(i)
            save_data(data)
            return {"message": "依赖已移除"}
    raise HTTPException(status_code=404, detail="依赖关系不存在")


def _would_create_cycle(deps, start, target):
    """DFS：从 start 出发能否到达 target（形成环）。"""
    adj = {}
    for d in deps:
        adj.setdefault(d.get("from_service_id"), []).append(d.get("to_service_id"))
    stack = [start]
    visited = set()
    while stack:
        node = stack.pop()
        if node == target:
            return True
        if node in visited:
            continue
        visited.add(node)
        stack.extend(adj.get(node, []))
    return False


@app.post("/api/services/import-from-envs")
async def import_services_from_envs(request: Request):
    """T3.8 从 envs[] 批量导入服务（admin 手动触发）。
    将没有对应 service 记录的环境批量创建为 active 服务。"""
    user = require_auth(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="仅超级管理员可批量导入")
    data = load_data()
    services = data.setdefault("services", [])
    envs = data.get("envs", [])
    existing_codes = {s.get("code") for s in services if s.get("code")}
    now = datetime.now().isoformat()
    imported, skipped = 0, 0
    max_id = max([s.get("id", 0) for s in services], default=0)
    for e in envs:
        code = "env-" + str(e.get("id"))
        if code in existing_codes:
            skipped += 1
            continue
        max_id += 1
        services.append({
            "id": max_id, "name": e.get("name") or e.get("ip") or ("env#" + str(e.get("id"))),
            "code": code, "type": "backend", "owner_id": None, "owner_name": "", "team": "",
            "description": "从网址大全导入", "repo_url": "", "doc_url": "", "api_doc_url": "",
            "deploy_envs": [e.get("id")], "tech_stack": [], "port": e.get("port"),
            "health_check_path": e.get("path", "/"),
            "scorecard": {k: False for k in SCORECARD_KEYS} | {"score": 0},
            "status": "active", "created_at": now, "updated_at": now
        })
        imported += 1
    if imported:
        save_data(data)
    return {"imported": imported, "skipped": skipped, "total_envs": len(envs)}


# ============ WEBSOCKET ============

@app.websocket("/ws/status")
async def websocket_status(websocket: WebSocket):
    await websocket.accept(); connected_clients.add(websocket)
    try:
        statuses = await asyncio.to_thread(get_env_statuses)
        await websocket.send_text(json.dumps(statuses, ensure_ascii=False))
        while True: await websocket.receive_text()
    except WebSocketDisconnect: connected_clients.discard(websocket)
    except Exception: connected_clients.discard(websocket)

# ============ ICONS ============

TOOL_NAME_TO_ICON = {
    "Visual Studio": "fa-brands fa-visual-studio",
    "Visual Studio Code": "fa-brands fa-microsoft",
    "VSCode": "fa-brands fa-microsoft",
    "VS Code": "fa-brands fa-microsoft",
    "IntelliJ IDEA": "fa-brands fa-java",
    "PyCharm": "fa-brands fa-python",
    "Eclipse": "fa-solid fa-moon",
    "Sublime Text": "fa-solid fa-file-code",
    "Atom": "fa-brands fa-atom",
    "Notepad++": "fa-solid fa-file-lines",
    "Code::Blocks": "fa-solid fa-code",
    "CLion": "fa-brands fa-java",
    "WebStorm": "fa-brands fa-js",
    "DBeaver": "fa-solid fa-database",
    "HeidiSQL": "fa-solid fa-database",
    "Navicat": "fa-solid fa-database",
    "MySQL Workbench": "fa-solid fa-database",
    "SQL Server": "fa-solid fa-database",
    "Oracle": "fa-solid fa-database",
    "DataGrip": "fa-solid fa-database",
    "TablePlus": "fa-solid fa-table",
    "Adminer": "fa-solid fa-database",
    "DbVisualizer": "fa-solid fa-database",
    "pgAdmin": "fa-solid fa-elephant",
    "MongoDB": "fa-solid fa-leaf",
    "Beekeeper": "fa-solid fa-database",
    "Fiddler": "fa-solid fa-magnifying-glass",
    "Postman": "fa-solid fa-paper-plane",
    "Wireshark": "fa-solid fa-network-wired",
    "Charles": "fa-solid fa-network-wired",
    "Burp Suite": "fa-solid fa-shield",
    "Insomnia": "fa-solid fa-moon",
    "nmap": "fa-solid fa-radar",
    "tcpdump": "fa-solid fa-terminal",
    "iperf": "fa-solid fa-chart-line",
    "飞书": "fa-solid fa-gear",
    "微信": "fa-brands fa-weixin",
    "QQ": "fa-brands fa-qq",
    "Slack": "fa-brands fa-slack",
    "Microsoft Teams": "fa-brands fa-microsoft",
    "Discord": "fa-brands fa-discord",
    "Telegram": "fa-brands fa-telegram",
    "Zoom": "fa-solid fa-video",
    "钉钉": "fa-solid fa-bell",
    "Mattermost": "fa-solid fa-comments",
    "Element": "fa-solid fa-message",
    "Rocket.Chat": "fa-solid fa-comments",
    "Signal": "fa-solid fa-lock",
    "Adobe Photoshop": "fa-solid fa-image",
    "Figma": "fa-brands fa-figma",
    "Sketch": "fa-solid fa-pen-ruler",
    "Adobe XD": "fa-solid fa-pen-ruler",
    "Affinity": "fa-solid fa-palette",
    "CorelDRAW": "fa-solid fa-pen",
    "Inkscape": "fa-solid fa-droplet",
    "GIMP": "fa-solid fa-image",
    "Lunacy": "fa-solid fa-moon",
    "Axure": "fa-solid fa-pen-ruler",
    "Krita": "fa-solid fa-palette",
    "Blender": "fa-solid fa-cube",
    "AnyDesk": "fa-solid fa-desktop",
    "TeamViewer": "fa-solid fa-desktop",
    "ToDesk": "fa-solid fa-desktop",
    "Remote Desktop": "fa-solid fa-desktop",
    "Splashtop": "fa-solid fa-desktop",
    "Chrome Remote": "fa-brands fa-chrome",
    "VNC": "fa-solid fa-eye",
    "LogMeIn": "fa-solid fa-desktop",
    "RustDesk": "fa-solid fa-desktop",
    "NoMachine": "fa-solid fa-desktop",
    "Remmina": "fa-solid fa-desktop",
    "X2Go": "fa-solid fa-desktop",
    "ThinLinc": "fa-solid fa-desktop",
    "Git": "fa-brands fa-git-alt",
    "Sourcetree": "fa-brands fa-sourcetree",
    "TortoiseGit": "fa-solid fa-code-branch",
    "GitHub": "fa-brands fa-github",
    "GitKraken": "fa-solid fa-octopus",
    "GitLab": "fa-brands fa-gitlab",
    "Fork": "fa-solid fa-code-branch",
    "SmartGit": "fa-solid fa-code-branch",
    "GitExtensions": "fa-solid fa-code-branch",
    "Mercurial": "fa-solid fa-code-branch",
    "gitg": "fa-solid fa-code-branch",
    "RabbitVCS": "fa-solid fa-code-branch",
    "Sublime Merge": "fa-solid fa-code-branch",
    "GitCola": "fa-solid fa-code-branch",
    "VirtualBox": "fa-solid fa-box",
    "VMware": "fa-solid fa-box",
    "Docker": "fa-brands fa-docker",
    "Vagrant": "fa-solid fa-box",
    "QEMU": "fa-solid fa-server",
    "Hyper-V": "fa-solid fa-server",
    "Parallels": "fa-solid fa-box",
    "Podman": "fa-brands fa-docker",
    "LXD": "fa-solid fa-server",
    "Rancher": "fa-solid fa-server",
    "Kubernetes": "fa-solid fa-dharmachakra",
    "Helm": "fa-solid fa-helm",
    "Microsoft Office": "fa-solid fa-file-word",
    "WPS": "fa-solid fa-file-pdf",
    "Typora": "fa-solid fa-file-lines",
    "LibreOffice": "fa-solid fa-file",
    "Adobe Acrobat": "fa-solid fa-file-pdf",
    "Foxit": "fa-solid fa-file-pdf",
    "OnlyOffice": "fa-solid fa-file",
    "Notion": "fa-solid fa-file",
    "Obsidian": "fa-solid fa-ghost",
    "Zoho": "fa-solid fa-file",
    "Mark Text": "fa-solid fa-file-lines",
    "Calibre": "fa-solid fa-book",
    "Evince": "fa-solid fa-file-pdf",
    "Ditto": "fa-solid fa-clipboard",
    "Everything": "fa-solid fa-magnifying-glass",
    "Snipaste": "fa-solid fa-clipboard",
    "Process Explorer": "fa-solid fa-window-maximize",
    "HWMonitor": "fa-solid fa-chart-line",
    "CrystalDiskInfo": "fa-solid fa-hard-drive",
    "Speccy": "fa-solid fa-microchip",
    "CCleaner": "fa-solid fa-broom",
    "Glary": "fa-solid fa-wrench",
    "HWiNFO": "fa-solid fa-chart-bar",
    "htop": "fa-solid fa-chart-line",
    "glances": "fa-solid fa-eye",
    "netdata": "fa-solid fa-chart-pie",
    "nmon": "fa-solid fa-chart-bar",
    "systemd": "fa-solid fa-gears",
    "logwatch": "fa-solid fa-file-lines",
    "crontab": "fa-solid fa-clock",
    "iotop": "fa-solid fa-hard-drive",
    "ncdu": "fa-solid fa-folder-open",
    "btop": "fa-solid fa-chart-line",
    "vim": "fa-solid fa-keyboard",
    "nano": "fa-solid fa-pencil",
    "Emacs": "fa-solid fa-keyboard",
    "GCC": "fa-solid fa-code",
    "Python": "fa-brands fa-python",
    "Node.js": "fa-brands fa-node-js",
    "OpenJDK": "fa-brands fa-java",
    "Go": "fa-brands fa-golang",
    "curl": "fa-solid fa-terminal",
    "wget": "fa-solid fa-download",
    "netstat": "fa-solid fa-network-wired",
    "traceroute": "fa-solid fa-route",
    "Geany": "fa-solid fa-file-code",
    "Bluefish": "fa-solid fa-fish",
    "Redis": "fa-solid fa-server",
    "MySQL": "fa-solid fa-database",
}

def get_default_icon_by_name(name):
    name_lower = name.lower()
    for keyword, icon in TOOL_NAME_TO_ICON.items():
        if keyword.lower() in name_lower:
            return icon
    return "fa-solid fa-gear"

@app.post("/api/icons/upload")
async def upload_icon(file: UploadFile = File(...), request: Request = None):
    user = require_auth(request) if request else None
    if user and not check_permission(user, "add"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only PNG, JPG, SVG, WebP, GIF are allowed.")
    
    max_size = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 2MB limit")
    
    file_ext = file.filename.split(".")[-1].lower()
    filename = f"{secrets.token_hex(16)}.{file_ext}"
    file_path = ICON_DIR / filename
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/icons/{filename}", "filename": filename}

@app.get("/api/icons/list")
async def list_icons():
    icons = []
    for file in ICON_DIR.iterdir():
        if file.is_file():
            icons.append({"url": f"/icons/{file.name}", "filename": file.name})
    return icons

@app.delete("/api/icons/{filename}")
async def delete_icon(filename: str, request: Request):
    user = require_auth(request)
    require_permission(user, "delete")
    
    file_path = ICON_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Icon not found")
    
    file_path.unlink()
    return {"message": "Icon deleted"}

@app.get("/api/icons/suggest")
async def suggest_icon(name: str):
    icon = get_default_icon_by_name(name)
    return {"icon": icon}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3143, reload=False)