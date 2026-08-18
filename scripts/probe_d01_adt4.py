# -*- coding: utf-8 -*-
"""验证：D01 激活路径 = /sap/bc/adt/activation（兼容模式），并捕获 LOCK 成功响应格式"""
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
OBJ = "/sap/bc/adt/programs/programs/zai_tmp_write_test"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
AUTH = "Basic " + base64.b64encode(f"{USER}:{PWD}".encode()).decode()
STORE = {}


def raw_req(method, path, headers, body=None):
    r = urllib.request.Request(BASE + path, method=method, headers=headers,
                               data=body.encode() if isinstance(body, str) else body)
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=60)
        hd = {k.lower(): v for k, v in resp.headers.items()}
        return resp.status, hd, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        hd = {k.lower(): v for k, v in e.headers.items()}
        return e.code, hd, e.read().decode("utf-8", "replace")


def store_cookies(hd):
    for raw in hd.get("set-cookie", "").split("\n"):
        pair = raw.split(";")[0].strip()
        if "=" in pair:
            k, v = pair.split("=", 1)
            STORE["sap-usercontext" if k == "sap-usercontext" else k] = f"sap-client={CLIENT}" if k == "sap-usercontext" else v


def csrf_dance():
    st, hd, body = raw_req("GET", f"/sap/bc/adt/core/discovery?sap-client={CLIENT}&sap-language={LANG}",
                           {"Authorization": AUTH, "Accept": "application/atomsvc+xml", "X-CSRF-Token": "Fetch"})
    store_cookies(hd)
    return hd.get("x-csrf-token", "")


csrf = csrf_dance()
ck = "; ".join(f"{k}={v}" for k, v in STORE.items())
print("csrf:", csrf, "| cookies:", ck)


def post(path, body, ctype, accept):
    h = {"Authorization": AUTH, "Accept": accept, "X-CSRF-Token": csrf, "Cookie": ck,
         "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"}
    if body is not None:
        h["Content-Type"] = ctype
    return raw_req("POST", path, h, body=body)


# 1) 标准路径（DSH 插件用）
act = ('<?xml version="1.0" encoding="UTF-8"?>'
       '<adt:activation xmlns:adt="http://www.sap.com/adt/activation">'
       '<adt:object uri="%s" type="PROG/P" name="ZAI_TMP_WRITE_TEST"/></adt:activation>' % OBJ)
st, hd, body = post(f"/sap/bc/adt/repository/activation?method=activate&preauditRequested=false&sap-client={CLIENT}&sap-language={LANG}",
                    act, "application/vnd.sap.adt.activation+xml", "application/xml")
print("\n[标准路径 repository/activation]", st, "|", (body or "")[:200])

# 2) 兼容路径（官方 adt-ls 用）
st, hd, body = post(f"/sap/bc/adt/activation?method=activate&preauditRequested=false&sap-client={CLIENT}&sap-language={LANG}",
                    act, "application/vnd.sap.adt.activation+xml", "application/xml")
print("\n[兼容路径 /activation]", st, "|", (body or "")[:300])

# 3) inactiveobjects 兼容路径
st, hd, body = post(f"/sap/bc/adt/activation/inactiveobjects?sap-client={CLIENT}&sap-language={LANG}",
                    None, None, "application/xml")
print("\n[inactiveobjects 兼容路径]", st, "|", (body or "")[:200])

# 4) LOCK 成功响应格式（对象可能仍锁 → 403 EU510；若 200 则打印 handle 位置）
LOCK_ACCEPT = "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"
st, hd, body = post(f"{OBJ}?_action=LOCK&accessMode=MODIFY&sap-client={CLIENT}&sap-language={LANG}",
                    None, None, LOCK_ACCEPT)
print("\n[LOCK]", st)
print("响应头:", {k: v for k, v in hd.items() if k.lower() in ("x-adt-lock-handle", "location", "content-type", "set-cookie", "x-csrf-token")})
print("响应体:", (body or "")[:1000])
handle = None
if body:
    for pat in (r"<([A-Za-z0-9_:]*[Hh]andle[^>]*)>([^<]+)</", r'<([A-Za-z0-9_:]+)[^>]*handle="([^"]+)"',
                r'"([A-Fa-f0-9]{24,})"', r'([A-F0-9]{32})'):
        m = re.search(pat, body)
        if m:
            handle = m.groups()[-1]
            print("抓到 handle:", handle)
            break
if not handle:
    handle = hd.get("x-adt-lock-handle")
if handle:
    st2, _, b2 = post(f"{OBJ}?_action=UNLOCK&lockHandle={handle}&sap-client={CLIENT}&sap-language={LANG}",
                      None, None, LOCK_ACCEPT)
    print("[UNLOCK]", st2, "|", (b2 or "")[:100])
