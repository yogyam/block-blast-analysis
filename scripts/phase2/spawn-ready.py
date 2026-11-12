#!/usr/bin/env python3
"""Spawn the game under a Frida script and resume it only after the script reports it is ready
(removes the race between hook installation and the app's first GL surface).
Usage: spawn-ready.py <script.js> <log-file> [pkg]
The script should console.log a line containing 'READY_TO_RESUME' once its early hooks are installed;
we also resume after a 15 s safety timeout."""
import sys, time, frida
script_path, log_path = sys.argv[1], sys.argv[2]; pkg = sys.argv[3] if len(sys.argv) > 3 else 'com.block.juggle'
log = open(log_path, 'a', buffering=1); ready = {'v': False}
def on_message(msg, data):
    if msg['type'] == 'send': log.write('SEND ' + str(msg.get('payload')) + '\n')
    elif msg['type'] == 'error': log.write('ERROR ' + str(msg.get('stack') or msg.get('description')) + '\n')
def on_log(level, text):
    log.write(text + '\n')
    if 'READY_TO_RESUME' in text: ready['v'] = True
dev = frida.get_usb_device(timeout=10)
pid = dev.spawn([pkg]); session = dev.attach(pid)
with open(script_path, 'r', encoding='utf-8') as f: src = f.read()
script = session.create_script(src); script.on('message', on_message); script.set_log_handler(on_log); script.load()
t0 = time.time()
while not ready['v'] and time.time() - t0 < 15: time.sleep(0.1)
dev.resume(pid); log.write(f'RESUMED pid={pid} after {time.time()-t0:.1f}s ready={ready["v"]}\n'); print(f'resumed pid {pid} (ready={ready["v"]})', flush=True)
try:
    while True: time.sleep(1)
except KeyboardInterrupt: pass
