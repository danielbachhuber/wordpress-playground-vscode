# wordpress-playground README

This Visual Studio Code extension allows you to quickly create a WordPress playground for testing your code. It was initially created as part of Cloudfest Hackathon 2023.

**IMPORTANT**: This project moved to [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground)

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

### 0.0.2

Hopefully fix the bug.
### 0.0.1

Initial release of WordPress Playground for VS Code.
