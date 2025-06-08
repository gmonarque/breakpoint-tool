import * as vscode from "vscode";

export class BreakpointManager {
  constructor() {}

  /**
   * Add a breakpoint to a specific line in a file
   */
  async addBreakpointToLine(
    uri: vscode.Uri,
    lineNumber: number
  ): Promise<boolean> {
    try {
      // Check if the file supports breakpoints (code files)
      if (!this.isDebuggableFile(uri)) {
        vscode.window.showWarningMessage(
          `File type not supported for breakpoints: ${uri.fsPath}`
        );
        return false;
      }

      // Create a new breakpoint
      const breakpoint = new vscode.SourceBreakpoint(
        new vscode.Location(uri, new vscode.Position(lineNumber, 0)),
        true // enabled
      );

      // Add the breakpoint using VSCode's debug API
      vscode.debug.addBreakpoints([breakpoint]);

      return true;
    } catch (error) {
      console.error("Error adding breakpoint:", error);
      return false;
    }
  }

  /**
   * Add breakpoints to multiple lines in a file
   */
  async addBreakpointsToLines(
    uri: vscode.Uri,
    lineNumbers: number[]
  ): Promise<number> {
    let successCount = 0;

    if (!this.isDebuggableFile(uri)) {
      vscode.window.showWarningMessage(
        `File type not supported for breakpoints: ${uri.fsPath}`
      );
      return 0;
    }

    try {
      // Create breakpoints for all lines
      const breakpoints = lineNumbers.map(
        (lineNumber) =>
          new vscode.SourceBreakpoint(
            new vscode.Location(uri, new vscode.Position(lineNumber, 0)),
            true // enabled
          )
      );

      // Add all breakpoints at once
      vscode.debug.addBreakpoints(breakpoints);
      successCount = breakpoints.length;
    } catch (error) {
      console.error("Error adding breakpoints:", error);
    }

    return successCount;
  }

  /**
   * Clear all breakpoints in a specific file
   */
  async clearAllBreakpointsInFile(uri: vscode.Uri): Promise<boolean> {
    try {
      // Get all current breakpoints
      const allBreakpoints = vscode.debug.breakpoints;

      // Filter breakpoints for the specific file
      const fileBreakpoints = allBreakpoints.filter(
        (bp) =>
          bp instanceof vscode.SourceBreakpoint &&
          bp.location.uri.toString() === uri.toString()
      );

      if (fileBreakpoints.length === 0) {
        vscode.window.showInformationMessage(
          "No breakpoints found in current file"
        );
        return true;
      }

      // Remove the breakpoints
      vscode.debug.removeBreakpoints(fileBreakpoints);

      return true;
    } catch (error) {
      console.error("Error clearing breakpoints:", error);
      return false;
    }
  }

  /**
   * Check if a file type supports breakpoints
   */
  private isDebuggableFile(uri: vscode.Uri): boolean {
    const extension = uri.fsPath.split(".").pop()?.toLowerCase();

    // Common debuggable file extensions
    const debuggableExtensions = [
      "js",
      "ts",
      "jsx",
      "tsx", // JavaScript/TypeScript
      "py", // Python
      "java", // Java
      "cs", // C#
      "cpp",
      "c",
      "cc",
      "cxx", // C/C++
      "go", // Go
      "rs", // Rust
      "php", // PHP
      "rb", // Ruby
      "swift", // Swift
      "kt", // Kotlin
      "scala", // Scala
      "dart", // Dart
      "m", // Objective-C
      "mm", // Objective-C++
      "vb", // Visual Basic
      "fs", // F#
      "pl", // Perl
      "sh", // Shell
      "ps1", // PowerShell
      "r", // R
      "jl", // Julia
      "lua", // Lua
      "groovy", // Groovy
      "elm", // Elm
      "hs", // Haskell
      "clj", // Clojure
      "ex",
      "exs", // Elixir
      "erl", // Erlang
    ];

    return extension ? debuggableExtensions.includes(extension) : false;
  }

  /**
   * Get count of breakpoints in a file
   */
  getBreakpointCountInFile(uri: vscode.Uri): number {
    const allBreakpoints = vscode.debug.breakpoints;
    return allBreakpoints.filter(
      (bp) =>
        bp instanceof vscode.SourceBreakpoint &&
        bp.location.uri.toString() === uri.toString()
    ).length;
  }
}
