# wordpress-playground README

This Visual Studio Code extension allows you to quickly create a WordPress playground for testing your code. It was initially created as part of Cloudfest Hackathon 2023.

## Features

This extension allows you to create a WordPress playground with a single command. Simply run the command `Launch WordPress Playground` while within a file in the root directory of your plugin and the extension will open up a panel that includes a locally running WordPress instance with your plugin running.

## Known Issues

- The extension has only been tested on macOS. It may not work on Windows.
- The extension currently only takes into account plugins, not themes.
- The extension currently expects that the command is run while within a file in the root directory of the plugin. A WordPress playground will still be created and mounted, but the plugin will not be functional if the command is run from an unintended directory.
- Some requests may not succeed. This is likely due to the fact that we have a minimally implemented server translation layer.

## Build PHP-wasm
Inside the wordpress-playground repo:
```
npx nx build:bundle php-wasm-node
npx nx recompile-php:all php-wasm-node --WITH_WS_NETWORKING_PROXY='no'
```
Place the `index.js` inside `wordpress-playground/dist/packages/php-wasm/node` and copy the wasm files into the VS code extension directory.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
