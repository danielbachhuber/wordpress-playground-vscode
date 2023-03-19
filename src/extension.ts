// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
const fs = require('fs');
const http = require('http');
var url = require('url');

import { PHP, PHPServer, loadPHPRuntime, getPHPLoaderModule, PHPBrowser } from './built-php-wasm-node';
import patchWordPress from './lib/patch-wordpress';

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
async function loadPhpBrowser( context: vscode.ExtensionContext, openPort: number, pluginPath: string,phpVersion: string='8.0') {
	const phpLoaderModule = await getPHPLoaderModule(phpVersion);
	const loaderId = await loadPHPRuntime(phpLoaderModule);
	const php = new PHP(loaderId);

	const wordpressZip = fs.readFileSync( context.extensionPath + '/dist/wordpress.zip' );

	php.writeFile( '/wordpress.zip', wordpressZip );

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
			const params = url.parse(req.url, true).query;
			const phpVersion = params.php;
			console.log( "PHP",phpVersion, req.url, params );
			
			if (phpVersion) {
				phpBrowser = await loadPhpBrowser( context, openPort, pluginPath, phpVersion); 
			}

			const reqBody = await new Promise( (resolve, reject) => {
				let body = '';
				req.on('data', chunk => {
					body += chunk.toString(); // convert Buffer to string
				});
				req.on('end', () => {
					resolve(body);
				});
			});

			const resp = await phpBrowser.request( {
				relativeUrl: req.url,
				headers: requestHeaders,
				method: req.method,
				body: reqBody,
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
			'WordPress Playground',
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
			  <title>WordPress Playground</title>
			  <style type="text/css">
			  * {
					box-sizing: border-box;
				}
				
				html,
				body {
					margin: 0;
					padding: 0;
					height: 100%;
				}
				
				#root {
					height: 100%;
					width: 100%;
				}
				
				body.with-background {
					background-image: url(data:image/jpg;base64,/9j/4AAQSkZJRgABAQABLAEsAAD/4QCMRXhpZgAATU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAAEsAAAAAQAAASwAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAGmgAwAEAAAAAQAAAEAAAAAA/+EKYWh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOmJhNTU4YWFiLTcyYTMtNDdkYy04OTVmLWU0YTI5OTU2YWQzZSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJFRjk2NzgzNDlGN0JFQ0RBMEFGM0I5QzJCNkI2RjYzNyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpiYTU1OGFhYi03MmEzLTQ3ZGMtODk1Zi1lNGEyOTk1NmFkM2UiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjAtMDMtMzBUMTE6Mzg6MzktMDQ6MDAiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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);
					backdrop-filter: blur(7px);
					background-size: cover;
					background-attachment: fixed;
				}
				iframe {
					position: relative;
					width: 100%;
					height: 100%;
					border: 0;
					margin: 0;
					padding: 0;
				}
			  </style>
			</head>
			<body class="with-background">
				<div id="root" data-iframe-src="http://localhost:${openPort}/"></div>
				<script src="${playgroundWebsiteJsSrc}"></script>
			</body>
		  </html>
		`;
    //var select = panel.webview.
    ///getElementById('mySelect');
//var value = select.options[select.selectedIndex].value;

		panel.onDidDispose( () => {
			server.close();
		} );
	  } );

	  context.subscriptions.push( disposable );
}

// This method is called when your extension is deactivated
export function deactivate() {}
