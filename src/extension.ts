// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
const fs = require('fs');
const http = require('http');
import { PHP, PHPServer, loadPHPRuntime, getPHPLoaderModule, PHPBrowser } from './built-php-wasm-node';
import patchWordPress from './lib/patch-wordpress';
import { TextDecoder } from 'util';

const importPhp = `
<?php
function importZipFile($pathToZip) {
    $zip = new ZipArchive;
    $res = $zip->open($pathToZip);
	$zip->extractTo( '/' );
    $zip->close();
}`;

class PortFinder {
	private static port: number = 5201;

	public static incrementPort() {
		return this.port++;
	}

	public static isPortFree() {
		return new Promise( resolve => {
			const server = http.createServer();

			server.listen( this.port, () => {
				server.close();
				resolve( true );
			} )
			.on('error', () => {
				resolve( false );
			} );
		} );
	}

	public static async getOpenPort() {
		while ( ! await this.isPortFree() ) {
			this.incrementPort();
		}

		return this.port;
	}
}

async function login(
	playground: PHPBrowser,
	user = 'admin',
	password = 'password'
) {
	await playground.request({
		relativeUrl: '/wp-login.php',
	});

	await playground.request({
		relativeUrl: '/wp-login.php',
		method: 'POST',
		formData: {
			log: user,
			pwd: password,
			rememberme: 'forever',
		},
	});
}

function seemsLikeAPHPFile(path: string) {
	return path.endsWith('.php') || path.includes('.php/');
}
async function loadPhpBrowser( context: vscode.ExtensionContext, openPort: number, pluginPath: string ) {
	const phpLoaderModule = await getPHPLoaderModule('8.0');
	const loaderId = await loadPHPRuntime(phpLoaderModule);
	const php = new PHP(loaderId);

	const wordpressZip = fs.readFileSync( context.extensionPath + '/dist/wordpress.zip' );

	php.writeFile( '/wordpress.zip', wordpressZip );

	const file = php.readFileAsText( '/wordpress.zip' );

	const databaseFromZipFileReadRequest = php.run({
		code:
		importPhp +
			` importZipFile( '/wordpress.zip' );`,
	});

	if ( databaseFromZipFileReadRequest.exitCode !== 0 ) {
		console.log( databaseFromZipFileReadRequest.errors );
	}

	if ( pluginPath ) {
		php.mkdirTree( `/wordpress/wp-content/plugins/${path.basename( pluginPath )}` );
		php.mount({root: pluginPath} as any, `/wordpress/wp-content/plugins/${path.basename( pluginPath )}` );
	}

	patchWordPress(php);

	const phpServer = new PHPServer(php, {
		documentRoot: '/wordpress',
		absoluteUrl: `http://localhost:${openPort}/`,
		isStaticFilePath: (path: string) => {
			const fullPath = '/wordpress' + path;
			return php.fileExists(fullPath)
				&& ! php.isDir(fullPath)
				&& ! seemsLikeAPHPFile(fullPath);
		}
	});
	const browser = new PHPBrowser( phpServer );

	await login( browser );

	return browser;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const editor = vscode.window.activeTextEditor;
	const pluginPath = !! editor
		? path.dirname( editor.document.fileName )
		: '';

	let disposable = vscode.commands.registerCommand('wordpress-playground.iframePlayground', async () => {
		const openPort = await PortFinder.getOpenPort();

		let phpBrowser = await loadPhpBrowser( context, openPort, pluginPath );

		const server = http.createServer( async (req : any, res : any) => {
			let requestHeaders: { [ key: string ]: string } = {};
			if ( req.rawHeaders && req.rawHeaders.length ) {
				for ( let i = 0; i < req.rawHeaders.length; i += 2 ) {
					requestHeaders[ req.rawHeaders[ i ] ] = req.rawHeaders[ i + 1 ];
				}
			}

			const resp = await phpBrowser.request( {
				relativeUrl: req.url,
				headers: requestHeaders
			} );

			res.statusCode = resp.httpStatusCode;
			Object.keys(resp.headers).forEach((key) => {
				res.setHeader(key, resp.headers[key]);
			});
			res.end(resp.body);
		});

		server.listen( openPort, () => {
			console.log( `Server running at http://localhost:${openPort}/` );
		} );

		// Create a new webview panel
		const panel = vscode.window.createWebviewPanel(
			'playgroundviewer',
			'Playground',
			vscode.ViewColumn.One,
			{
			  enableScripts: true,
			}
		  );

		const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'playground-website.js');
		const playgroundWebsiteJsSrc = panel.webview.asWebviewUri(onDiskPath);

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
				<div id="root" data-iframe-src="http://localhost:${openPort}/"></div>
				<script src="${playgroundWebsiteJsSrc}"></script>
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
export function deactivate() {}
