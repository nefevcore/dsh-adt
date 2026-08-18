# -*- coding: utf-8 -*-
"""探测 ZCL_FI_AI_APPROVAL 类源写入的 406 根因：对比 Accept/查询参数 变体"""
import base64
import re
import ssl
import urllib.request
import urllib.error

BASE = "https://impcerpdev01.impc.com.cn:44300"
USER = "ABAP04"
PWD = "ngfcoiVY3vpzKkd+JeL@"
CLIENT = "110"
LANG = "ZH"
OBJ = "/sap/bc/adt/oo/classes/zcl_fi_ai_approval"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
AUTH = "Basic " + base64.b64encode(f"{USER}:{PWD}".encode()).decode()
STORE = {}


def raw(method, path, headers, body=None):
    r = urllib.request.Request(BASE + path, method=method, headers=headers,
                               data=body.encode() if isinstance(body, str) else body)
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=120)
        return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode("utf-8", "replace")


def store_cookies(hd):
    for r in hd.get("set-cookie", "").split("\n"):
        p = r.split(";")[0].strip()
        if "=" in p:
            k, v = p.split("=", 1)
            STORE["sap-usercontext" if k == "sap-usercontext" else k] = f"sap-client={CLIENT}" if k == "sap-usercontext" else v


st, hd, body = raw("GET", f"/sap/bc/adt/core/discovery?sap-client={CLIENT}&sap-language={LANG}",
                   {"Authorization": AUTH, "Accept": "application/atomsvc+xml", "X-CSRF-Token": "Fetch"})
store_cookies(hd)
csrf = hd.get("x-csrf-token", "")
ck = "; ".join(f"{k}={v}" for k, v in STORE.items())
print("csrf:", csrf, "| cookies:", ck)

# 1) LOCK（获得 handle；若已被锁则 403）
LOCK_ACCEPT = "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"
st, hd, body = raw("POST", f"{OBJ}?_action=LOCK&accessMode=MODIFY&sap-client={CLIENT}&sap-language={LANG}",
                   {"Authorization": AUTH, "Accept": LOCK_ACCEPT, "X-CSRF-Token": csrf, "Cookie": ck,
                    "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"})
print("[LOCK]", st)
handle = None
if body:
    m = re.search(r"<LOCK_HANDLE>([^<]+)</LOCK_HANDLE>|<lockHandle>([^<]+)</lockHandle>", body, re.S)
    if m:
        handle = m.group(1) or m.group(2)
if not handle:
    m = re.search(r'lockHandle="([^"]+)"', body)
    if m:
        handle = m.group(1)
print("handle:", handle)

if handle:
    # 用一段小源码测试（不覆盖真实类，仅探测格式）
    small = "REPORT z.\nWRITE: / 'x'.\n"
    variants = [
        ("带sap-client + Accept xml", f"{OBJ}/source/main?sap-client={CLIENT}&sap-language={LANG}&lockHandle={handle}&corrNr=D01K961066", "application/xml"),
        ("不带client + Accept xml", f"{OBJ}/source/main?lockHandle={handle}&corrNr=D01K961066", "application/xml"),
        ("不带client + Accept */*", f"{OBJ}/source/main?lockHandle={handle}&corrNr=D01K961066", "*/*"),
        ("不带client + Accept abapsource", f"{OBJ}/source/main?lockHandle={handle}&corrNr=D01K961066", "application/vnd.sap.adt.abapsource.v1+xml"),
        ("不带client + 无Accept", f"{OBJ}/source/main?lockHandle={handle}&corrNr=D01K961066", None),
    ]
    for name, path, acc in variants:
        h = {"Authorization": AUTH, "Content-Type": "text/plain; charset=utf-8",
             "X-CSRF-Token": csrf, "Cookie": ck, "x-sap-adt-sessiontype": "stateful",
             "sap-adt-connection-id": "probe"}
        if acc:
            h["Accept"] = acc
        st, hd, body = raw("PUT", path, h, body=small)
        print(f"[{name}] {st} | {(body or '')[:120]}")
    # 释放锁
    st, hd, body = raw("POST", f"{OBJ}?_action=UNLOCK&lockHandle={handle}&sap-client={CLIENT}&sap-language={LANG}",
                       {"Authorization": AUTH, "Accept": LOCK_ACCEPT, "X-CSRF-Token": csrf, "Cookie": ck,
                        "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"})
    print("[UNLOCK]", st)
