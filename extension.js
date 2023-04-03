// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

const { runWordPressServer } = require('./server');
const vscode = require('vscode');

function activate(context) {
	let siteUrl;

	let disposable = vscode.commands.registerCommand('wordpress-playground.serve', async () => {
		if (!siteUrl) {
			try {
				siteUrl = await runWordPressServer(
					vscode.workspace.workspaceFolders[0].uri.fsPath
				);
			} catch(e) {
				console.trace(e);
			}
		}
		// Open siteUrl in the browser
		vscode.env.openExternal(vscode.Uri.parse(siteUrl));
	} );

	context.subscriptions.push( disposable );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
