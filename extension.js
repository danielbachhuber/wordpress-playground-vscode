// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { runWordPressServer } = require('./server');

function activate(context) {
	let siteUrl;

	let disposable = vscode.commands.registerCommand('wordpress-playground.serve', async () => {
		if (!siteUrl) {
			siteUrl = await runWordPressServer(
				vscode.workspace.workspaceFolders[0].uri.fsPath
			)
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
