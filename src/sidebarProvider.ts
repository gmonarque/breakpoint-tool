import * as vscode from "vscode";
import { BreakpointManager } from "./breakpointManager";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "breakpointSearchView";
  private _view?: vscode.WebviewView;
  private breakpointManager: BreakpointManager;
  private currentSearchResults: SearchResult[] = [];
  private searchHighlightDecoration?: vscode.TextEditorDecorationType;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    breakpointManager: BreakpointManager
  ) {
    this.breakpointManager = breakpointManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "search":
          this._handleSearch(message.query, message.options);
          return;
        case "addBreakpoints":
          this._handleAddBreakpoints(message.results);
          return;
        case "clearBreakpoints":
          this._handleClearBreakpoints();
          return;
        case "goToLine":
          this._handleGoToLine(message.file, message.line);
          return;
      }
    });
  }

  private async _handleSearch(query: string, options: SearchOptions) {
    // Clear previous highlights
    this._clearEditorHighlights();

    if (!query.trim()) {
      this._view?.webview.postMessage({
        command: "searchResults",
        results: [],
        error: null,
      });
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view?.webview.postMessage({
        command: "searchResults",
        results: [],
        error: "No active editor found. Please open a file in VSCode first.",
      });
      return;
    }

    const results = await this._performSearch(editor, query, options);
    if (results === null) {
      // Error already handled in _performSearch
      return;
    }

    this.currentSearchResults = results;

    // Highlight results in editor
    this._highlightResultsInEditor(editor, results);

    // Calculate statistics
    const totalMatches = results.reduce(
      (sum, result) => sum + result.matches.length,
      0
    );
    const totalLines = results.length;

    this._view?.webview.postMessage({
      command: "searchResults",
      results: results,
      fileName: editor.document.fileName,
      error: null,
      totalMatches: totalMatches,
      totalLines: totalLines,
    });
  }

  private async _performSearch(
    editor: vscode.TextEditor,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[] | null> {
    const document = editor.document;
    const text = document.getText();
    const results: SearchResult[] = [];

    let pattern: RegExp;

    try {
      if (options.useRegex) {
        // Validate regex pattern
        const flags = options.caseSensitive ? "g" : "gi";
        pattern = new RegExp(query, flags);

        // Test if regex is valid by doing a simple test
        pattern.test("");
      } else {
        let escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (options.wholeWord) {
          escapedQuery = `\\b${escapedQuery}\\b`;
        }
        const flags = options.caseSensitive ? "g" : "gi";
        pattern = new RegExp(escapedQuery, flags);
      }
    } catch (error) {
      let errorMessage = "Invalid regex pattern";
      if (error instanceof Error) {
        errorMessage = `Invalid regex: ${error.message}`;
      }
      this._view?.webview.postMessage({
        command: "showError",
        message: errorMessage,
      });
      return null;
    }

    const lines = text.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      pattern.lastIndex = 0; // Reset regex

      let match;
      const matches: { start: number; end: number }[] = [];

      while ((match = pattern.exec(line)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        });

        // Prevent infinite loop for zero-length matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }

      if (matches.length > 0) {
        results.push({
          lineNumber: lineIndex,
          lineContent: line,
          matches: matches,
          file: editor.document.uri.fsPath,
        });
      }
    }

    return results;
  }

  private _highlightResultsInEditor(
    editor: vscode.TextEditor,
    results: SearchResult[]
  ) {
    // Create decoration type for highlighting
    this.searchHighlightDecoration =
      vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(
          "editor.findMatchHighlightBackground"
        ),
        border: "1px solid",
        borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
      });

    // Create ranges for all matches
    const ranges: vscode.Range[] = [];
    results.forEach((result) => {
      result.matches.forEach((match) => {
        const startPos = new vscode.Position(result.lineNumber, match.start);
        const endPos = new vscode.Position(result.lineNumber, match.end);
        ranges.push(new vscode.Range(startPos, endPos));
      });
    });

    // Apply decorations
    editor.setDecorations(this.searchHighlightDecoration, ranges);
  }

  private _clearEditorHighlights() {
    if (this.searchHighlightDecoration) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor.setDecorations(this.searchHighlightDecoration, []);
      }
      this.searchHighlightDecoration.dispose();
      this.searchHighlightDecoration = undefined;
    }
  }

  private async _handleAddBreakpoints(results: SearchResult[]) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view?.webview.postMessage({
        command: "showError",
        message: "No active editor found. Please open a file in VSCode first.",
      });
      return;
    }

    const lineNumbers = results.map((r) => r.lineNumber);
    const successCount = await this.breakpointManager.addBreakpointsToLines(
      editor.document.uri,
      lineNumbers
    );

    if (successCount > 0) {
      this._view?.webview.postMessage({
        command: "showSuccess",
        message: `Added ${successCount} breakpoint(s)`,
      });
    } else {
      this._view?.webview.postMessage({
        command: "showError",
        message: "Failed to add breakpoints",
      });
    }
  }

  private async _handleClearBreakpoints() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view?.webview.postMessage({
        command: "showError",
        message: "No active editor found. Please open a file in VSCode first.",
      });
      return;
    }

    const success = await this.breakpointManager.clearAllBreakpointsInFile(
      editor.document.uri
    );
    if (success) {
      this._view?.webview.postMessage({
        command: "showSuccess",
        message: "All breakpoints cleared from current file",
      });
    } else {
      this._view?.webview.postMessage({
        command: "showError",
        message: "Failed to clear breakpoints",
      });
    }
  }

  private async _handleGoToLine(file: string, line: number) {
    try {
      const uri = vscode.Uri.file(file);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    } catch (error) {
      this._view?.webview.postMessage({
        command: "showError",
        message: "Failed to open file",
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Breakpoint Search</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            margin: 0;
            padding: 10px;
        }

        .search-container {
            margin-bottom: 15px;
        }

        .search-input {
            width: 100%;
            padding: 6px;
            margin-bottom: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            box-sizing: border-box;
        }

        .search-options {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-bottom: 8px;
        }

        .option {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
        }

        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-bottom: 15px;
        }

        .button {
            padding: 6px 8px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 11px;
            text-align: center;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }

        .results-container {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            max-height: 400px;
            overflow-y: auto;
        }

        .result-item {
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            font-size: 11px;
        }

        .result-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .result-item:last-child {
            border-bottom: none;
        }

        .line-number {
            color: var(--vscode-editorLineNumber-foreground);
            font-family: var(--vscode-editor-font-family);
            margin-right: 8px;
            min-width: 30px;
            display: inline-block;
            font-size: 10px;
        }

        .line-content {
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            word-break: break-all;
            font-size: 10px;
        }

        .highlight {
            background-color: var(--vscode-editor-findMatchHighlightBackground);
            color: var(--vscode-editor-findMatchHighlightForeground);
            padding: 1px 2px;
            border-radius: 2px;
        }

        .no-results {
            text-align: center;
            padding: 20px 10px;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }

        .status, .error, .success {
            margin-top: 8px;
            padding: 6px;
            border-radius: 2px;
            font-size: 11px;
            display: none;
        }

        .status {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
        }

        .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
        }

        .success {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
        }

        .no-results ol {
            text-align: left;
            margin: 8px 0;
            padding-left: 16px;
        }

        .no-results p {
            margin: 8px 0;
        }

        .section-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-sideBarTitle-foreground);
            font-size: 12px;
        }

        .match-counter {
            padding: 4px 8px;
            margin-bottom: 8px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 2px;
            font-size: 10px;
            text-align: center;
        }

        .option.disabled {
            opacity: 0.5;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="section-title">🔍 Search</div>
    <div class="search-container">
        <input type="text" id="searchInput" class="search-input" placeholder="Enter search term..." />

        <div class="search-options">
            <div class="option">
                <input type="checkbox" id="caseSensitive" />
                <label for="caseSensitive">Case sensitive</label>
            </div>
            <div class="option">
                <input type="checkbox" id="wholeWord" />
                <label for="wholeWord">Whole word</label>
            </div>
            <div class="option">
                <input type="checkbox" id="useRegex" />
                <label for="useRegex">Use regex</label>
            </div>
        </div>
    </div>

    <div class="section-title">⚡ Actions</div>
    <div class="action-buttons">
        <button id="addBreakpointsBtn" class="button" disabled>Add Breakpoints to Results</button>
        <button id="clearBreakpointsBtn" class="button">Clear All Breakpoints</button>
    </div>

    <div class="section-title">📋 Results</div>
    <div id="matchCounter" class="match-counter" style="display: none;"></div>
    <div class="results-container" id="resultsContainer">
        <div class="no-results">
            <p><strong>How to use:</strong></p>
            <ol>
                <li>Open a file in the editor</li>
                <li>Enter search term above</li>
                <li>View highlighted matches</li>
                <li>Add breakpoints to results</li>
            </ol>
        </div>
    </div>

    <div id="status" class="status"></div>
    <div id="errorDiv" class="error"></div>
    <div id="successDiv" class="success"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentResults = [];

        const searchInput = document.getElementById('searchInput');
        const caseSensitiveCheck = document.getElementById('caseSensitive');
        const wholeWordCheck = document.getElementById('wholeWord');
        const useRegexCheck = document.getElementById('useRegex');
        const addBreakpointsBtn = document.getElementById('addBreakpointsBtn');
        const clearBreakpointsBtn = document.getElementById('clearBreakpointsBtn');
        const resultsContainer = document.getElementById('resultsContainer');
        const statusDiv = document.getElementById('status');
        const errorDiv = document.getElementById('errorDiv');
        const successDiv = document.getElementById('successDiv');

        let searchTimeout;

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch();
            }, 300);
        });

        [caseSensitiveCheck, wholeWordCheck, useRegexCheck].forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                handleOptionChange();
                performSearch();
            });
        });

        function handleOptionChange() {
            // Prevent incompatible combinations: regex + whole word
            if (useRegexCheck.checked && wholeWordCheck.checked) {
                wholeWordCheck.checked = false;
            }
        }

        addBreakpointsBtn.addEventListener('click', () => {
            vscode.postMessage({
                command: 'addBreakpoints',
                results: currentResults
            });
        });

        clearBreakpointsBtn.addEventListener('click', () => {
            vscode.postMessage({
                command: 'clearBreakpoints'
            });
        });

        function performSearch() {
            const query = searchInput.value.trim();
            if (!query) {
                displayResults([]);
                return;
            }

            const options = {
                caseSensitive: caseSensitiveCheck.checked,
                wholeWord: wholeWordCheck.checked,
                useRegex: useRegexCheck.checked
            };

            vscode.postMessage({
                command: 'search',
                query: query,
                options: options
            });
        }

        function displayResults(results, fileName, error, totalMatches = 0, totalLines = 0) {
            currentResults = results;
            addBreakpointsBtn.disabled = results.length === 0;

            const matchCounter = document.getElementById('matchCounter');

            if (error) {
                resultsContainer.innerHTML = \`<div class="no-results"><strong>⚠️ \${error}</strong></div>\`;
                matchCounter.style.display = 'none';
                showError(error);
                return;
            }

            if (results.length === 0) {
                matchCounter.style.display = 'none';
                if (!searchInput.value.trim()) {
                    resultsContainer.innerHTML = \`
                        <div class="no-results">
                            <p><strong>How to use:</strong></p>
                            <ol>
                                <li>Open a file in the editor</li>
                                <li>Enter search term above</li>
                                <li>View highlighted matches</li>
                                <li>Add breakpoints to results</li>
                            </ol>
                        </div>
                    \`;
                } else {
                    resultsContainer.innerHTML = '<div class="no-results">No matches found</div>';
                }
                return;
            }

            // Show match counter
            matchCounter.textContent = \`Found \${totalMatches} match\${totalMatches === 1 ? '' : 'es'} across \${totalLines} line\${totalLines === 1 ? '' : 's'}\`;
            matchCounter.style.display = 'block';

            const html = results.map(result => {
                const highlightedContent = highlightMatches(result.lineContent, result.matches);
                return \`
                    <div class="result-item" onclick="goToLine('\${result.file}', \${result.lineNumber})">
                        <span class="line-number">\${result.lineNumber + 1}:</span>
                        <div class="line-content">\${highlightedContent}</div>
                    </div>
                \`;
            }).join('');

            resultsContainer.innerHTML = html;
        }

        function highlightMatches(content, matches) {
            if (!matches || matches.length === 0) {
                return escapeHtml(content);
            }

            let result = '';
            let lastIndex = 0;

            matches.forEach(match => {
                result += escapeHtml(content.substring(lastIndex, match.start));
                result += \`<span class="highlight">\${escapeHtml(content.substring(match.start, match.end))}</span>\`;
                lastIndex = match.end;
            });

            result += escapeHtml(content.substring(lastIndex));
            return result;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function goToLine(file, line) {
            vscode.postMessage({
                command: 'goToLine',
                file: file,
                line: line
            });
        }

        function showStatus(message) {
            hideAllMessages();
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }

        function showError(message) {
            hideAllMessages();
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }

        function showSuccess(message) {
            hideAllMessages();
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 3000);
        }

        function hideAllMessages() {
            statusDiv.style.display = 'none';
            errorDiv.style.display = 'none';
            successDiv.style.display = 'none';
        }

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'searchResults':
                    displayResults(message.results, message.fileName, message.error, message.totalMatches, message.totalLines);
                    break;
                case 'showError':
                    showError(message.message);
                    break;
                case 'showSuccess':
                    showSuccess(message.message);
                    break;
            }
        });

        // Focus on search input when view loads
        searchInput.focus();
    </script>
</body>
</html>`;
  }
}

interface SearchResult {
  lineNumber: number;
  lineContent: string;
  matches: { start: number; end: number }[];
  file: string;
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}
