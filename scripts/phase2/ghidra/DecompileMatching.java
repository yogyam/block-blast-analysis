// Ghidra headless post-script: decompile every function whose qualified name matches a regex
// and write one .c file per function plus an index. Args: <outDir> <regex>
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import java.io.File;
import java.io.PrintWriter;
import java.util.regex.Pattern;

public class DecompileMatching extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        File outDir = new File(args[0]);
        outDir.mkdirs();
        Pattern pat = Pattern.compile(args[1]);
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);
        FunctionManager fm = currentProgram.getFunctionManager();
        int count = 0, failed = 0;
        try (PrintWriter idx = new PrintWriter(new File(outDir, "_index.tsv"))) {
            for (Function f : fm.getFunctions(true)) {
                String name = f.getName(true);
                if (!pat.matcher(name).find()) continue;
                DecompileResults res = ifc.decompileFunction(f, 90, monitor);
                if (res == null || !res.decompileCompleted()) { failed++; continue; }
                String code = res.getDecompiledFunction().getC();
                String safe = name.replaceAll("[^A-Za-z0-9_.]+", "_");
                if (safe.length() > 140) safe = safe.substring(0, 140);
                String fn = safe + "_" + f.getEntryPoint() + ".c";
                try (PrintWriter w = new PrintWriter(new File(outDir, fn))) { w.print(code); }
                idx.println(f.getEntryPoint() + "\t" + name + "\t" + fn + "\t" + f.getBody().getNumAddresses());
                count++;
            }
        }
        println("DecompileMatching: wrote " + count + " functions, " + failed + " failed");
    }
}
