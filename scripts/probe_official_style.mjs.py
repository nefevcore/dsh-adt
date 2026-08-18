# -*- coding: utf-8 -*-
"""复刻官方客户端会话：discovery 带固定 cookie 建 110 会话 → PUT 不带 sap-client 参数"""
import base64
import re
import ssl
import urllib.request
import urllib.error

BASE = "https://impcerpdev01.impc.com.cn:44300"
USER = "ABAP04"
PWD = "ngfcoiVY3vpzKkd+JeL@"
CLIENT = "110"
OBJ = "/sap/bc/adt/oo/classes/zcl_fi_ai_approval"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
AUTH = "Basic " + base64.b64encode(f"{USER}:{PWD}".encode()).decode()
STORE = {"sap-usercontext": f"sap-client={CLIENT}"}


def raw(method, path, headers, body=None):
    r = urllib.request.Request(BASE + path, method=method, headers=headers,
                               data=body.encode() if isinstance(body, str) else body)
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=120)
        return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode("utf-8", "replace")


def ck():
    return "; ".join(f"{k}={v}" for k, v in STORE.items())


# discovery：带固定 client cookie + Fetch
st, hd, body = raw("GET", "/sap/bc/adt/core/discovery",
                   {"Authorization": AUTH, "Accept": "application/atomsvc+xml",
                    "X-CSRF-Token": "Fetch", "Cookie": ck()})
csrf = hd.get("x-csrf-token", "")
for r in hd.get("set-cookie", "").split("\n"):
    p = r.split(";")[0].strip()
    if "=" in p:
        k, v = p.split("=", 1)
        if k != "sap-usercontext":
            STORE[k] = v
print("discovery:", st, "csrf=", csrf, "| cookies:", ck())

LOCK_ACCEPT = "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"

# LOCK（不带 sap-client 参数）
st, hd, body = raw("POST", f"{OBJ}?_action=LOCK&accessMode=MODIFY",
                   {"Authorization": AUTH, "Accept": LOCK_ACCEPT, "X-CSRF-Token": csrf, "Cookie": ck(),
                    "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"})
print("[LOCK 无client参数]", st)
m = re.search(r"<LOCK_HANDLE>([^<]+)</LOCK_HANDLE>|<lockHandle>([^<]+)</lockHandle>", body or "", re.S)
handle = (m.group(1) or m.group(2)) if m else None
print("handle:", handle)
if not handle:
    print((body or "")[:300])
    raise SystemExit

small = "REPORT z.\nWRITE: / 'x'.\n"
h = {"Authorization": AUTH, "Content-Type": "text/plain; charset=utf-8", "Accept": "application/xml",
     "X-CSRF-Token": csrf, "Cookie": ck(), "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"}
st, hd, body = raw("PUT", f"{OBJ}/source/main?lockHandle={handle}&corrNr=D01K961066", h, body=small)
print("[PUT 无client参数]", st, "|", (body or "")[:200])
if st == 200:
    print("✅✅ 官方风格 PUT 成功！")
st, hd, body = raw("POST", f"{OBJ}?_action=UNLOCK&lockHandle={handle}",
                   {"Authorization": AUTH, "Accept": LOCK_ACCEPT, "X-CSRF-Token": csrf, "Cookie": ck(),
                    "x-sap-adt-sessiontype": "stateful", "sap-adt-connection-id": "probe"})
print("[UNLOCK]", st)
