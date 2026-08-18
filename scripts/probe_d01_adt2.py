# -*- coding: utf-8 -*-
"""D01 ADT 真实响应：带 CSRF 的 LOCK / UNLOCK / 激活（对齐 dsh-plugin 行为）"""
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


def raw_req(method, path, headers, body=None):
    r = urllib.request.Request(BASE + path, method=method, headers=headers,
                               data=body.encode() if isinstance(body, str) else body)
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=60)
        return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


# 1) discovery 取 CSRF + cookie
st, hd, body = raw_req("GET", "/sap/bc/adt/core/discovery",
                       {"Authorization": AUTH, "Accept": "application/atomsvc+xml", "X-CSRF-Token": "Fetch"})
csrf = hd.get("X-CSRF-Token", "")
cookie = hd.get("Set-Cookie", "").split(";")[0]
# 固定 client 110（对齐插件 storeCookies 的 sap-usercontext 覆盖）
cookie = "sap-usercontext=sap-client=110"
print("csrf:", csrf, "| cookie:", cookie)

LOCK_ACCEPT = "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"

# 2) LOCK
st, hd, body = raw_req("POST", f"{OBJ}?_action=LOCK&accessMode=MODIFY&sap-client={CLIENT}&sap-language={LANG}",
                       {"Authorization": AUTH, "Accept": LOCK_ACCEPT, "X-CSRF-Token": csrf,
                        "Cookie": cookie, "x-sap-adt-sessiontype": "stateful",
                        "sap-adt-connection-id": "probe"})
print("\n=== LOCK === status:", st)
print("headers:", {k: v for k, v in hd.items() if k.lower() in
                   ("x-adt-lock-handle", "location", "content-type", "x-csrf-token", "set-cookie")})
print("body:", body[:1000] if body else "(empty)")

handle = None
m = re.search(r"[Ll][Oo][Cc][Kk]_?[Hh][Aa][Nn][Dd][Ll][Ee][^>]*>([^<]+)<", body or "")
if not m:
    m = re.search(r'<([A-Za-z0-9_:]+)\s+[^>]*handle="([^"]+)"', body or "")
if not m:
    m = re.search(r'"([A-Fa-f0-9]{20,})"', body or "")
if m:
    handle = m.group(1) if m.lastindex == 1 else m.group(2)
    print("parsed handle:", handle)
if not handle and "x-adt-lock-handle" in hd:
    handle = hd["x-adt-lock-handle"]
    print("handle from header:", handle)

# 3) 激活（对齐插件 body + headers）
act_body = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<adt:activation xmlns:adt="http://www.sap.com/adt/activation">'
            '<adt:object uri="%s" type="PROG/P" name="ZAI_TMP_WRITE_TEST"/>'
            '</adt:activation>' % OBJ)
st, hd, body = raw_req("POST",
                       f"/sap/bc/adt/repository/activation?method=activate&preauditRequested=true&sap-client={CLIENT}&sap-language={LANG}",
                       {"Authorization": AUTH, "Accept": "application/xml",
                        "Content-Type": "application/vnd.sap.adt.activation+xml",
                        "X-CSRF-Token": csrf, "Cookie": cookie, "x-sap-adt-sessiontype": "stateful",
                        "sap-adt-connection-id": "probe"},
                       body=act_body)
print("\n=== ACTIVATION === status:", st)
print("body:", body[:600] if body else "(empty)")

# 4) checkruns（adt_check 走这里，验证哪些服务存在）
check_body = ('<?xml version="1.0" encoding="UTF-8"?>'
              '<adt:checkObjects xmlns:adt="http://www.sap.com/adt/checkobjects">'
              '<adt:object uri="%s" type="PROG/P" name="ZAI_TMP_WRITE_TEST"/>'
              '</adt:checkObjects>' % OBJ)
st, hd, body = raw_req("POST", f"/sap/bc/adt/checkruns?reporters=abapCheckRun&sap-client={CLIENT}&sap-language={LANG}",
                       {"Authorization": AUTH, "Accept": "application/vnd.sap.adt.checkmessages+xml",
                        "Content-Type": "application/vnd.sap.adt.checkobjects+xml",
                        "X-CSRF-Token": csrf, "Cookie": cookie, "sap-adt-connection-id": "probe"},
                       body=check_body)
print("\n=== CHECKRUNS === status:", st)
print("body head:", (body or "")[:200])

# 5) 若拿到 handle → UNLOCK 释放（避免遗留锁）
if handle:
    st, hd, body = raw_req("POST", f"{OBJ}?_action=UNLOCK&lockHandle={handle}&sap-client={CLIENT}&sap-language={LANG}",
                           {"Authorization": AUTH, "Accept": LOCK_ACCEPT, "X-CSRF-Token": csrf,
                            "Cookie": cookie, "x-sap-adt-sessiontype": "stateful",
                            "sap-adt-connection-id": "probe"})
    print("\n=== UNLOCK === status:", st, "| body:", (body or "")[:200])
