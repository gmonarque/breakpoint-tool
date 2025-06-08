import * as vscode from "vscode";
import { BreakpointManager } from "./breakpointManager";
import { SidebarProvider } from "./sidebarProvider";

let breakpointManager: BreakpointManager;
let sidebarProvider: SidebarProvider;

export function activate(context: vscode.ExtensionContext) {
  // Initialize managers
  breakpointManager = new BreakpointManager();
  sidebarProvider = new SidebarProvider(
    context.extensionUri,
    breakpointManager
  );

  // Register the sidebar view provider
  const provider = vscode.window.registerWebviewViewProvider(
    SidebarProvider.viewType,
    sidebarProvider
  );

  context.subscriptions.push(provider);

  // Register command: Add breakpoint to current line
  const addBreakpointToCurrentLine = vscode.commands.registerCommand(
    "breakpoint-tool.addBreakpointToCurrentLine",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const currentLine = editor.selection.active.line;
      const success = await breakpointManager.addBreakpointToLine(
        editor.document.uri,
        currentLine
      );

      if (success) {
        vscode.window.showInformationMessage(
          `Breakpoint added to line ${currentLine + 1}`
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to add breakpoint to line ${currentLine + 1}`
        );
      }
    }
  );

  // Register command: Clear all breakpoints in current file
  const clearAllBreakpoints = vscode.commands.registerCommand(
    "breakpoint-tool.clearAllBreakpoints",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const success = await breakpointManager.clearAllBreakpointsInFile(
        editor.document.uri
      );
      if (success) {
        vscode.window.showInformationMessage(
          "All breakpoints cleared from current file"
        );
      } else {
        vscode.window.showErrorMessage("Failed to clear breakpoints");
      }
    }
  );

  // Add all commands to context subscriptions
  context.subscriptions.push(addBreakpointToCurrentLine, clearAllBreakpoints);
}

export function deactivate() {}
