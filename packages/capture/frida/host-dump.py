#!/usr/bin/env python3
"""Host side for dump-scripts.js: spawn the app under Frida, receive scripts, write files.

Writes to data/raw/decrypted/<session>/ (gitignored). Never prints or stores a key.
Usage: python3 host-dump.py [--attach] [--out DIR] [--pkg com.block.juggle]
"""
import argparse, hashlib, os, re, sys, time, zlib
import frida

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pkg', default='com.block.juggle')
    ap.add_argument('--out', default=None)
    ap.add_argument('--attach', action='store_true', help='attach to running app instead of spawning')
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, '..', '..', '..'))
    out = args.out or os.path.join(root, 'data', 'raw', 'decrypted', time.strftime('%Y%m%d-%H%M%S'))
    os.makedirs(out, exist_ok=True)
    seen = set()

    def safe_name(n):
        n = re.sub(r'[^A-Za-z0-9._/-]', '_', n or 'unnamed')
        return n.strip('/').replace('/', '__') or 'unnamed'

    def on_message(msg, data):
        if msg['type'] == 'error':
            print('[agent error]', msg.get('stack') or msg.get('description'), file=sys.stderr); return
        p = msg.get('payload', {})
        t = p.get('type')
        if t == 'log':
            print('[agent]', p['msg'])
        elif t == 'status':
            print('[status]', p)
        elif t == 'script' and p.get('text') is not None:
            data = p['text'].encode('utf-8')
            h = hashlib.sha256(data).hexdigest()[:12]
            if h in seen: return
            seen.add(h)
            name = f"{safe_name(p.get('name'))}.{h}.js"
            with open(os.path.join(out, name), 'wb') as f: f.write(data)
            print(f"[saved] {name} ({len(data)} bytes) via {p.get('how')}")
        elif t in ('script', 'blob') and data is not None:
            h = hashlib.sha256(data).hexdigest()[:12]
            if h in seen: return
            seen.add(h)
            if t == 'script':
                name = f"{safe_name(p.get('name'))}.{h}.js"
            else:
                # xxtea output may be gzip (1f 8b) or brotli; store raw and let the analyst inflate.
                ext = 'gz' if data[:2] == b'\x1f\x8b' else 'bin'
                name = f"blob.{h}.{ext}"
                if ext == 'gz':
                    try:
                        data_inf = zlib.decompress(data, 16 + zlib.MAX_WBITS)
                        with open(os.path.join(out, f"blob.{h}.js"), 'wb') as f: f.write(data_inf)
                    except Exception as e:
                        print('[inflate failed]', e)
            with open(os.path.join(out, name), 'wb') as f: f.write(data)
            print(f"[saved] {name} ({len(data)} bytes) via {p.get('how')}")

    dev = frida.get_usb_device(timeout=10)
    with open(os.path.join(here, 'dump-scripts.js'), 'r', encoding='utf-8') as f: src = f.read()
    if args.attach:
        session = dev.attach(args.pkg)
    else:
        pid = dev.spawn([args.pkg]); session = dev.attach(pid)
    script = session.create_script(src); script.on('message', on_message); script.load()
    if not args.attach: dev.resume(pid)
    print(f"[host] dumping to {out}; Ctrl-C to stop")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    main()
