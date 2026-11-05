#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_env_reorder.py — 环境拖拽排序功能测试

运行：python3 test_env_reorder.py
覆盖：
  T1 apply_env_reorder 纯函数单元测试（部分重排 / 全量重排 / 边界）
  T2 HTTP 接口端到端测试（登录 -> 重排 -> 校验 -> 还原）
     - 未登录调用必须 401；<2 个有效 id 必须 400
     - 分组内重排后：组内顺序符合预期，组外元素位置不动
     - 数据持久化：重新 GET 顺序保持；测试结束后还原原始顺序
"""
import json
import sys
import urllib.request

BASE = "http://localhost:3143"
HERE = __import__("os").path.dirname(__import__("os").path.abspath(__file__))
sys.path.insert(0, HERE + "/..")

passed = failed = 0


def check(cond, name):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print(f"  FAIL: {name}")


def http(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def t1_unit():
    print("T1: apply_env_reorder 单元测试")
    from main import apply_env_reorder

    # 场景：全量数组内部分量重排（模拟"服务"分组内拖动）
    envs = [{"id": i} for i in [1, 2, 5, 7, 8, 12, 15]]
    r = apply_env_reorder(envs, [15, 8, 7, 5])  # 5,7,8,15 的槽位重排
    check(r == [15, 8, 7, 5], "T1.1 返回过滤后的新顺序")
    check([e["id"] for e in envs] == [1, 2, 15, 8, 7, 12, 5], f"T1.2 槽位替换正确: {[e['id'] for e in envs]}")

    # 场景：新顺序含无效 id（自动过滤）
    envs = [{"id": i} for i in [1, 2, 3]]
    r = apply_env_reorder(envs, [3, 999, 2])
    check(r == [3, 2] and [e["id"] for e in envs] == [1, 3, 2], "T1.3 无效 id 被过滤")

    # 场景：少于 2 个有效 id
    check(apply_env_reorder([{"id": 1}], [1]) is None, "T1.4 少于2个返回 None")
    check(apply_env_reorder([{"id": 1}, {"id": 2}], []) is None, "T1.5 空列表返回 None")

    # 场景：重复 id（幂等安全：不抛错）
    envs = [{"id": i} for i in [1, 2, 3]]
    r = apply_env_reorder(envs, [2, 2, 3])
    check(r is not None, "T1.6 重复 id 不抛错")

    # 场景：id 顺序与出现槽位无关（乱序提交）
    envs = [{"id": i} for i in [10, 20, 30, 40]]
    r = apply_env_reorder(envs, [40, 20])
    check([e["id"] for e in envs] == [10, 40, 30, 20], f"T1.7 乱序槽位替换: {[e['id'] for e in envs]}")


def t2_api():
    print("T2: HTTP 接口端到端测试")
    # 未登录拒绝
    code, _ = http("PUT", "/api/envs/reorder", {"ids": [1, 2]})
    check(code == 401, f"T2.1 未登录 401，实际 {code}")

    # 登录
    code, login = http("POST", "/api/auth/login", {"username": "admin", "password": "123456"})
    check(code == 200 and login.get("token"), f"T2.2 admin 登录成功，实际 {code}")
    token = login["token"]

    # 读取当前顺序
    code, envs = http("GET", "/api/envs")
    orig = [e["id"] for e in envs]
    # 取"服务"分组作为测试分组
    service_ids = [e["id"] for e in envs if e.get("group", "环境") == "服务"]
    check(len(service_ids) >= 2, f"T2.3 服务分组至少2项，实际 {len(service_ids)}")

    # 参数校验：少于2个
    code, body = http("PUT", "/api/envs/reorder", {"ids": [service_ids[0]]}, token)
    check(code == 400, f"T2.4 少于2个有效 id 返回 400，实际 {code}")

    # 重排：反转服务分组顺序
    new_ids = list(reversed(service_ids))
    code, body = http("PUT", "/api/envs/reorder", {"ids": new_ids}, token)
    check(code == 200 and body.get("ids") == new_ids, f"T2.5 重排成功，实际 {code} {body}")

    # 校验：组内顺序已反转，组外元素位置不变
    code, envs2 = http("GET", "/api/envs")
    after = [e["id"] for e in envs2]
    after_service = [e["id"] for e in envs2 if e.get("group", "环境") == "服务"]
    check(after_service == new_ids, f"T2.6 分组内顺序已更新: {after_service}")
    pos = {e["id"]: i for i, e in enumerate(envs) if e.get("group", "环境") != "服务"}
    pos2 = {e["id"]: i for i, e in enumerate(envs2) if e.get("group", "环境") != "服务"}
    check(pos == pos2, "T2.7 组外元素槽位不变")
    check(sorted(after) == sorted(orig), "T2.8 全量集合无丢失/重复")

    # 还原原始顺序
    code, _ = http("PUT", "/api/envs/reorder", {"ids": service_ids}, token)
    check(code == 200, "T2.9 还原原始顺序成功")
    code, envs3 = http("GET", "/api/envs")
    check([e["id"] for e in envs3] == orig, "T2.10 还原校验通过")


if __name__ == "__main__":
    t1_unit()
    t2_api()
    print("\n========== 测试结果 ==========")
    print(f"通过: {passed}  失败: {failed}")
    sys.exit(1 if failed else 0)
