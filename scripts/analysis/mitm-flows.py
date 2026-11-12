# mitmproxy addon: one line per flow with SNI/host, method, path, status, sizes. Run: mitmdump -nr flows.mitm -s mitm-flows.py -q
from mitmproxy import http, tcp
def _line(f):
    sni = getattr(f.server_conn, "sni", None) or ""
    host = f.request.pretty_host if hasattr(f, "request") and f.request else (f.server_conn.address[0] if f.server_conn.address else "")
    if isinstance(f, http.HTTPFlow):
        st = f.response.status_code if f.response else "-"
        rl = len(f.request.raw_content or b"") if f.request else 0
        sl = len(f.response.raw_content or b"") if f.response and f.response.raw_content else 0
        err = f.error.msg if f.error else ""
        print(f"{sni or host}\t{f.request.method}\t{f.request.path[:80]}\t{st}\treq={rl}\tresp={sl}\t{err[:60]}")
    else:
        print(f"{sni or host}\tTCP\t-\t-\t-\t-\t{f.error.msg[:60] if f.error else ''}")
def response(f: http.HTTPFlow): _line(f)
def error(f: http.HTTPFlow): _line(f)
def tcp_end(f: tcp.TCPFlow): _line(f)
