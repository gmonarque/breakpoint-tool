# Breakpoint Tool - VSCode Extension

A powerful VSCode extension that allows users to quickly add breakpoints to all lines found in search results, streamlining the debugging process.

## Features

- **Add Breakpoint to Current Line**: Quickly add a breakpoint to the line where your cursor is positioned
- **Add Breakpoints to Search Results**: Automatically add breakpoints to all lines containing search results
- **Clear All Breakpoints**: Remove all breakpoints from the current file
- **Smart File Type Detection**: Only allows breakpoints in debuggable file types
- **Status Bar Integration**: Shows breakpoint options when search is active

## Commands

The extension provides the following commands accessible via Command Palette (`Ctrl+Shift+P`):

- `Breakpoint Tool: Add Breakpoint to Current Line`
- `Breakpoint Tool: Add Breakpoints to Search Results`
- `Breakpoint Tool: Clear All Breakpoints in File`

## Keyboard Shortcuts

- `Ctrl+Shift+B` (Mac: `Cmd+Shift+B`) - Add breakpoint to current line
- `Ctrl+Shift+Alt+B` (Mac: `Cmd+Shift+Alt+B`) - Add breakpoints to search results (when search widget is visible)
- `Ctrl+Shift+Alt+C` (Mac: `Cmd+Shift+Alt+C`) - Clear all breakpoints in current file

## Usage

### Adding Breakpoints to Search Results

1. Open a file in VSCode
2. Use `Ctrl+F` to open the search widget
3. Enter your search term
4. Use `Ctrl+Shift+Alt+B` or the Command Palette to add breakpoints to all search results
5. Start debugging to see breakpoints in action

### Adding Breakpoint to Current Line

1. Position your cursor on the desired line
2. Use `Ctrl+Shift+B` or the Command Palette to add a breakpoint

### Context Menu Integration

Right-click in any editor to access breakpoint commands through the context menu.

## Supported File Types

The extension supports breakpoints in common debuggable file types:

- JavaScript/TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`)
- Python (`.py`)
- Java (`.java`)
- C# (`.cs`)
- C/C++ (`.cpp`, `.c`, `.cc`, `.cxx`)
- Go (`.go`)
- Rust (`.rs`)
- PHP (`.php`)
- Ruby (`.rb`)
- Swift (`.swift`)
- Kotlin (`.kt`)
- And many more...

## Status Bar Integration

When the search widget is visible, a status bar item appears showing "Add Breakpoints" - click it to quickly add breakpoints to search results.

## Extension Development

### Prerequisites

- Node.js
- VSCode
- TypeScript

### Setup

1. Clone the repository
2. Run `npm install`
3. Open in VSCode
4. Press `F5` to launch Extension Development Host

### Building

```bash
npm run compile
```

### Packaging

```bash
vsce package
```

### Installing

Just install the .vsix

### Structure

```
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── breakpointManager.ts  # Breakpoint creation and management
│   └── searchDetector.ts     # Search result detection logic
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── .vscode/
    └── launch.json          # Debug configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

## Changelog

### 1.0.0

- Initial release
- Add breakpoints to current line
- Add breakpoints to search results
- Clear all breakpoints in file
- Context menu integration
- Keyboard shortcuts
- Status bar integration
