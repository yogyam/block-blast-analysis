# Ghidra headless post-script (Jython): decompile every function whose qualified name matches a regex
# and write one .c file per function. Args: <outDir> <regex>
import re, os
from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
args = getScriptArgs()
outDir = args[0]; pattern = re.compile(args[1])
if not os.path.exists(outDir): os.makedirs(outDir)
ifc = DecompInterface(); ifc.openProgram(currentProgram)
monitor = ConsoleTaskMonitor()
fm = currentProgram.getFunctionManager()
count = 0; failed = 0
index = open(os.path.join(outDir, "_index.tsv"), "w")
for f in fm.getFunctions(True):
    name = f.getName(True)
    if not pattern.search(name): continue
    try:
        res = ifc.decompileFunction(f, 90, monitor)
        if res is None or not res.decompileCompleted():
            failed += 1; continue
        code = res.getDecompiledFunction().getC()
    except Exception as e:
        failed += 1; continue
    safe = re.sub(r'[^A-Za-z0-9_.]+', '_', name)[:140]
    fn = "%s_%s.c" % (safe, f.getEntryPoint())
    fh = open(os.path.join(outDir, fn), "w"); fh.write(code); fh.close()
    index.write("%s\t%s\t%s\t%d\n" % (f.getEntryPoint(), name, fn, f.getBody().getNumAddresses()))
    count += 1
index.close()
print("DecompileMatching: wrote %d functions, %d failed" % (count, failed))
