# browse4️⃣me

browse4️⃣me is an AI-powered browser extension designed to enhance your browsing experience. It uses AI technology to assist you with various web tasks and interactions.

## Features

- AI-powered browsing assistance
- Keyboard shortcuts for quick access
- Cross-page functionality

## Installation

1. Clone this repository or download the source code.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the directory containing the extension files.

## Usage

1. Click on the browse4️⃣me icon in your Chrome toolbar or use the keyboard shortcut `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open the interface.
2. Enter your request in the prompt box.
3. The AI will process your request and perform actions on the current webpage.
4. View the history of actions in the interface.

## Configuration

1. Open the extension options page.
2. Enter your Anthropic API key in the provided field.
3. Save your changes.

## Development

This extension is built using:

- React for the user interface
- Tailwind CSS for styling
- Anthropic's Claude AI model for intelligent browsing assistance

To modify the extension:

1. Make changes to the source files in the `src` directory.
2. Rebuild the extension using your preferred build tools.
3. Reload the extension in Chrome to see your changes.

## Security

- The extension uses a closed Shadow DOM for improved security.
- API keys are stored securely in Chrome's storage system.
- Content scripts are isolated from the page's JavaScript context.
