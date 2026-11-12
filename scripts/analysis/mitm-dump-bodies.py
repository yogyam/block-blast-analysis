# mitmproxy addon: save request/response bodies for the game's own backend hosts. Run: mitmdump -nr flows.mitm -s mitm-dump-bodies.py --set outdir=DIR -q
import os, re, json
from mitmproxy import http, ctx
HOSTS = ("afafb.com",)
n = 0
def load(l): l.add_option("outdir", str, "bodies", "output dir")
def response(f: http.HTTPFlow):
    global n
    host = f.request.pretty_host
    if not any(host.endswith(h) for h in HOSTS): return
    n += 1
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", f"{n:03d}_{host}{f.request.path.split('?')[0]}")[:120]
    d = ctx.options.outdir; os.makedirs(d, exist_ok=True)
    meta = {"host": host, "method": f.request.method, "url": f.request.pretty_url, "status": f.response.status_code if f.response else None,
            "req_headers": dict(f.request.headers), "resp_headers": dict(f.response.headers) if f.response else None}
    open(os.path.join(d, base + ".meta.json"), "w").write(json.dumps(meta, indent=1))
    try: open(os.path.join(d, base + ".req"), "wb").write(f.request.get_content(strict=False) or b"")
    except Exception: pass
    try: open(os.path.join(d, base + ".resp"), "wb").write(f.response.get_content(strict=False) or b"")
    except Exception: pass
