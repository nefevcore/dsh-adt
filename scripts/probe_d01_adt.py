# -*- coding: utf-8 -*-
"""HTTP 探测：D01(impc-dev) 的 ADT LOCK / UNLOCK / 激活 实际响应（复现 dsh-plugin-abap-adt 行为）"""
import ssl
import urllib.request
import urllib.error

BASE = "https://impcerpdev01.impc.com.cn:44300"
USER = "ABAP04"
PWD = "ngfcoiVY3vpzKkd+JeL@"
CLIENT = "110"
LANG = "ZH"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def req(method, path, headers=None, body=None, accept=None):
    h = {"Authorization": "Basic " + __import__("base64").b64encode(f"{USER}:{PWD}".encode()).decode()}
    if accept:
        h["Accept"] = accept
    if body is not None:
        h["Content-Type"] = "application/xml; charset=utf-8"
    if headers:
        h.update(headers)
    r = urllib.request.Request(BASE + path, method=method, headers=h, data=body.encode() if isinstance(body, str) else body)
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=60)
        return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


OBJ = "/sap/bc/adt/programs/programs/zai_tmp_write_test"
LOCK_ACCEPT = "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"

print("=== 1) discovery ===")
st, hd, body = req("GET", "/sap/bc/adt/core/discovery", accept="application/atomsvc+xml")
print(st)
print("headers:", {k: v for k, v in hd.items() if k.lower() in ("x-csrf-token", "set-cookie", "content-type")})
print("body head:", body[:500])
csrf = hd.get("X-CSRF-Token", "")
cookie = hd.get("Set-Cookie", "").split(";")[0]

print("\n=== 2) LOCK (as plugin does) ===")
st, hd, body = req("POST", f"{OBJ}?_action=LOCK&accessMode=MODIFY&client={CLIENT}&language={LANG}",
                   headers={"X-CSRF-Token": csrf, "Cookie": cookie}, accept=LOCK_ACCEPT)
print(st)
print("headers:", {k: v for k, v in hd.items() if k.lower() in ("x-adt-lock-handle", "location", "content-type", "x-csrf-token")})
print("body:", body[:800] if body else "(empty)")

print("\n=== 3) LOCK without CSRF (raw) ===")
st, hd, body = req("POST", f"{OBJ}?_action=LOCK&accessMode=MODIFY&client={CLIENT}&language={LANG}", accept=LOCK_ACCEPT)
print(st, "| body:", body[:400] if body else "(empty)")

print("\n=== 4) activation endpoint probe ===")
act_body = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<adt:activation xmlns:adt="http://www.sap.com/adt/activation">'
            '<adt:object uri="%s" type="PROG/P" name="ZAI_TMP_WRITE_TEST"/>'
            '</adt:activation>' % OBJ)
st, hd, body = req("POST", f"/sap/bc/adt/repository/activation?method=activate&preauditRequested=true&client={CLIENT}&language={LANG}",
                   headers={"X-CSRF-Token": csrf, "Cookie": cookie}, body=act_body, accept="application/xml")
print(st, "| body:", body[:400] if body else "(empty)")

print("\n=== 5) GET object metadata (lock state?) ===")
st, hd, body = req("GET", f"{OBJ}?client={CLIENT}&language={LANG}", accept="application/vnd.sap.adt.object.v1+xml")
print(st, "| body:", body[:300] if body else "(empty)")
