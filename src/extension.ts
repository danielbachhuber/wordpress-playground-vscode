import * as vscode from 'vscode';
const path = require('path');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('wordpress-playground.iframePlayground', () => {
		const getFileDir = function() {
			const activeEditor = vscode.window.activeTextEditor;
			if ( ! activeEditor ) {
			  return;
			}

			const document = activeEditor.document;
			const uri = document.uri;
			if ( uri.scheme !== 'file' ) {
			  return;
			}

			const filePath = uri.fsPath;
			return path.dirname( uri.fsPath );
		};

		// vscode.window.showInformationMessage( 'File path' + getFileDir() );

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
