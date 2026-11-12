// Export every function's entry point, name and size as TSV. Args: <outFile>
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import java.io.File;
import java.io.PrintWriter;
public class ListFunctions extends GhidraScript {
    @Override public void run() throws Exception {
        String[] args = getScriptArgs();
        try (PrintWriter w = new PrintWriter(new File(args[0]))) {
            for (Function f : currentProgram.getFunctionManager().getFunctions(true))
                w.println(f.getEntryPoint() + "\t" + f.getName(true) + "\t" + f.getBody().getNumAddresses());
        }
        println("ListFunctions done");
    }
}
