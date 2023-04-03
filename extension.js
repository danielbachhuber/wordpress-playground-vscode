// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// const path = require('path');
// const fs = require('fs');
const http = require('http');
// var url = require('url');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activateOriginal(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "wordpress-playground" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('wordpress-playground.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from wordpress-playground!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
	let disposable = vscode.commands.registerCommand('wordpress-playground.helloWorld', async () => {

		// let phpBrowser = await loadPhpBrowser( context, openPort, pluginPath );

		const server = http.createServer(async (req, res) => {
			res.statusCode = 200;
			res.end('Hello, world!');
		});

		const openPort = await new Promise(resolve => {
			server.listen(() => {
				const port = server.address().port;
				resolve(port);
				console.log( `Server running at http://127.0.0.1:${port}/` );
			});
		})

		// Create a new webview panel
		const panel = vscode.window.createWebviewPanel(
			'playgroundviewer',
			'WordPress Playground',
			vscode.ViewColumn.One,
			{
			  enableScripts: true,
			}
		  );

		// Set the content of the webview panel to an iframe that loads a website URL
		panel.webview.html = `
		  <!DOCTYPE html>
		  <html>
			<head>
			  <meta charset="UTF-8">
			  <meta name="viewport" content="width=device-width, initial-scale=1.0">
			  <title>WordPress Playground</title>
			</head>
			<body class="with-background">
				<fieldset>
					<legend>Iframe below:</legend>
					<iframe src="http://127.0.0.1:${openPort}/"></iframe>
				</fieldset>
			</body>
		  </html>
		`;

		panel.onDidDispose( () => {
			server.close();
		} );
	} );

	context.subscriptions.push( disposable );
}



// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
