# -*- coding: utf-8 -*-
"""D01 ADT：正确 CSRF 舞蹈后的 LOCK / 激活 真实响应"""
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
COOKIE_STORE = {}  # 对齐插件 storeCookies：sap-contextid 原样存，sap-usercontext 固定 client


def set_cookies_from_headers(hd):
    for raw in hd.get("set-cookie", "").split("\n"):
        pair = raw.split(";")[0].strip()
        if not pair or "=" not in pair:
            continue
        k, v = pair.split("=", 1)
        if k == "sap-usercontext":
            COOKIE_STORE[k] = f"sap-client={CLIENT}"
        else:
            COOKIE_STORE[k] = v


def cookie_header():
    return "; ".join(f"{k}={v}" for k, v in COOKIE_STORE.items())


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


def get_csrf():
    # 首次请求即带 sap-client（对齐插件 baseQuery：会话建在目标客户端上）
    st, hd, body = raw_req("GET", f"/sap/bc/adt/core/discovery?sap-client={CLIENT}&sap-language={LANG}",
                           {"Authorization": AUTH, "Accept": "application/atomsvc+xml",
                            "X-CSRF-Token": "Fetch"})
    token = hd.get("x-csrf-token") or ""
    set_cookies_from_headers(hd)
    print("discovery:", st, "csrf=", token, "| cookies:", cookie_header())
    return token


LOCK_ACCEPT = "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"


def post(path, body, ctype, accept, csrf):
    headers = {"Authorization": AUTH, "Accept": accept,
               "X-CSRF-Token": csrf, "Cookie": cookie_header(),
               "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"}
    if body is not None:
        headers["Content-Type"] = ctype
    return raw_req("POST", path, headers, body=body)


csrf = get_csrf()

st, hd, body = post(f"{OBJ}?_action=LOCK&accessMode=MODIFY&sap-client={CLIENT}&sap-language={LANG}",
                    None, None, LOCK_ACCEPT, csrf)
print("\n=== LOCK === status:", st)
print("headers:", {k: v for k, v in hd.items() if k.lower() in
                   ("x-adt-lock-handle", "location", "content-type", "x-csrf-token")})
print("body:", (body or "")[:1200])

handle = None
if body:
    for pat in (r"<([A-Za-z0-9_:]+)>([^<]{10,})</", r'handle="([^"]+)"', r'([A-Za-z0-9+/=]{20,})'):
        m = re.search(pat, body)
        if m:
            handle = m.group(1)
            print("candidate handle:", handle)
            break
if not handle:
    handle = hd.get("x-adt-lock-handle")

act_body = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<adt:activation xmlns:adt="http://www.sap.com/adt/activation">'
            '<adt:object uri="%s" type="PROG/P" name="ZAI_TMP_WRITE_TEST"/>'
            '</adt:activation>' % OBJ)
st, hd, body = post(f"/sap/bc/adt/repository/activation?method=activate&preauditRequested=true&sap-client={CLIENT}&sap-language={LANG}",
                    act_body, "application/vnd.sap.adt.activation+xml", "application/xml", csrf)
print("\n=== ACTIVATION === status:", st)
print("body:", (body or "")[:600])

# 尝试释放锁（若拿到 handle）
if handle:
    st, hd, body = post(f"{OBJ}?_action=UNLOCK&lockHandle={handle}&sap-client={CLIENT}&sap-language={LANG}",
                        None, None, LOCK_ACCEPT, csrf)
    print("\n=== UNLOCK === status:", st, "| body:", (body or "")[:200])
else:
    # 尝试无 handle 解锁（同会话对象锁可能在超时后自动释放）
    print("\n(no handle captured; 对象锁可能残留，需注意)")
