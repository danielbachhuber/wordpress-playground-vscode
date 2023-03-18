// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('wordpress-playground.iframePlayground', () => {
		// Create a new webview panel
		const panel = vscode.window.createWebviewPanel(
		  'playgroundviewer',
		  'Playground',
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
			  <title>Playground</title>
			  <style type="text/css">
		  		html, body, iframe {
					height: 100%;
					width: 100%;
					margin: 0;
					padding: 0;
				}
				iframe {
					border: none;
				}
			  </style>
			</head>
			<body>
			  <iframe src="http://localhost:5400"></iframe>
			</body>
		  </html>
		`;
	  });

	  context.subscriptions.push( disposable );
}

// This method is called when your extension is deactivated
export function deactivate() {}
