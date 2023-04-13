// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const path = require('path');
const fs = require('fs');
const express = require('express');
const fileUpload = require('express-fileupload');

const { PHP } = require('@php-wasm/node');

// const l = m => (console.log(m), m);
// const l = m => (console.log(m), m);
  
async function runWordPressServer(workspacePath, requestedPort) {
    // Start a new express server that serves static files from CWD
    const app = express();
    app.use(fileUpload());
    // app.use(express.static(process.cwd));
    const { openPort } = await new Promise(resolve => {
        if (requestedPort === undefined) {
            const server = app.listen(() => {
                const port = server.address().port;
                resolve({ openPort: port, server });
                // console.log(`Server running at http://127.0.0.1:${port}/`);
            });
        } else {
            const server = app.listen(requestedPort, () => {
                const port = server.address().port;
                resolve({ openPort: port, server });
                // console.log(`Server running at http://127.0.0.1:${port}/`);
            });
        }
    })

    const php = await PHP.load('7.4', {
        requestHandler: {
            documentRoot: '/wordpress',
            absoluteUrl: `http://127.0.0.1:${openPort}/`,
            isStaticFilePath: (path) => {
                try {
                    const fullPath = '/wordpress' + path;
                    return php.fileExists(fullPath)
                        && !php.isDir(fullPath)
                        && !seemsLikeAPHPFile(fullPath);
                } catch (e) {
                    console.error(e);
                    return false;
                }
            }
        }
    });
    
    if (workspacePath) {
        php.mkdirTree(`/wordpress/wp-content/plugins/${path.basename(workspacePath)}`);
        php.mount({ root: workspacePath }, `/wordpress/wp-content/plugins/${path.basename(workspacePath)}`);
    }

    const wordpressZip = fs.readFileSync(__dirname + '/wordpress.zip');
    const sqliteZip = fs.readFileSync(__dirname + '/sqlite-database-integration.zip');
    // const wordpressZip = await fetchAsUint8Array('https://wordpress.org/latest.zip')
    // const sqliteZip = await fetchAsUint8Array("https://downloads.wordpress.org/plugin/sqlite-database-integration.zip")

    php.writeFile('/wordpress.zip', wordpressZip);
    php.writeFile('/sqlite-database-integration.zip', sqliteZip);
    const databaseFromZipFileReadRequest = php.run({
        code: `<?php
    function extractZip($zipPath, $destination) {
        $zip = new ZipArchive;
        $res = $zip->open($zipPath);
        if ($res === TRUE) {
            $zip->extractTo($destination);
            $zip->close();
        }
    }
    extractZip('/wordpress.zip', '/');
    extractZip('/sqlite-database-integration.zip', '/wordpress/wp-content/plugins/');
    rename('/wordpress/wp-content/plugins/sqlite-database-integration-main', '/wordpress/wp-content/plugins/sqlite-database-integration');
    `
    });
    php.writeFile(
        '/wordpress/wp-content/db.php',
        php.readFileAsText('/wordpress/wp-content/plugins/sqlite-database-integration/db.copy')
            .replace(/\{SQLITE_IMPLEMENTATION_FOLDER_PATH\}/g, '/wordpress/wp-content/plugins/sqlite-database-integration')
            .replace(/\{SQLITE_PLUGIN\}/g, 'sqlite-database-integration')
    )
    if (databaseFromZipFileReadRequest.exitCode !== 0) {
        // console.log(databaseFromZipFileReadRequest.errors);
    }
    const patchFile = (path, callback) => {
        php.writeFile(path, callback(php.readFileAsText(path)));
    }

    php.writeFile(
        '/wordpress/wp-config.php',
        php.readFileAsText('/wordpress/wp-config-sample.php')
    );
    php.mkdirTree('/wordpress/wp-content/mu-plugins');
    php.writeFile(
        '/wordpress/wp-content/mu-plugins/0-allow-wp-org.php',
        `<?php
        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
            return array( 
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        } );`
    );

    const siteUrl = `http://127.0.0.1:${openPort}`;
    patchFile(
        `/wordpress/wp-config.php`,
        (contents) =>
            `<?php 
            define('WP_HOME', "${siteUrl}");
            define('WP_SITEURL', "${siteUrl}");
            ?>${contents}`
    );
    

    // Upstream change proposed in https://github.com/WordPress/sqlite-database-integration/pull/28:
    patchFile(
        `/wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php`,
        (contents) => {
            return contents.replace(
                'if ( false === strtotime( $value ) )',
                'if ( $value === "0000-00-00 00:00:00" || false === strtotime( $value ) )'
            );
        }
    );

    await php.request({
        url: '/wp-admin/install.php?step=2',
        method: 'POST',
        formData: {
            language: 'en',
            prefix: 'wp_',
            weblog_title: 'My WordPress Website',
            user_name: 'admin',
            admin_password: 'password',
            admin_password2: 'password',
            Submit: 'Install WordPress',
            pw_weak: '1',
            admin_email: 'admin@localhost.com'
        }
    });

    const { login } = await import('@wp-playground/client');
    await login(php, 'admin', 'password');

    app.use('/', async (req, res) => {
        try {
            const requestHeaders = {};
            if (req.rawHeaders && req.rawHeaders.length) {
                for (let i = 0; i < req.rawHeaders.length; i += 2) {
                    requestHeaders[req.rawHeaders[i].toLowerCase()] = req.rawHeaders[i + 1];
                }
            }

            const body = requestHeaders['content-type']?.startsWith('multipart/form-data')
                ? generateMultipartFormDataString(
                    req.body,
                    requestHeaders['content-type'].split("; boundary=")[1]
                )
                : await requestBodyToString(req);
            
            const data = {
                url: req.url,
                headers: requestHeaders,
                method: req.method,
                files: Object.fromEntries(Object.entries(req.files || {}).map(([key, file]) => ([key, {
                    key,
                    name: file.name,
                    size: file.size,
                    type: file.mimetype,
                    arrayBuffer: () => file.data.buffer
                }]))),
                body,
            };
            const resp = await php.request(data);

            res.statusCode = resp.httpStatusCode;
            Object.keys(resp.headers).forEach((key) => {
                res.setHeader(key, resp.headers[key]);
            });
            res.end(resp.text);
        } catch (e) {
            console.trace(e);
        }
    });

    return siteUrl;
}

function generateMultipartFormDataString(json, boundary) {
    let multipartData = '';
    const eol = '\r\n';
  
    for (let key in json) {
      multipartData += `--${boundary}${eol}`;
      multipartData += `Content-Disposition: form-data; name="${key}"${eol}${eol}`;
      multipartData += `${json[key]}${eol}`;
    }
  
    multipartData += `--${boundary}--${eol}`;
    return multipartData;
}

  
const requestBodyToString = async (req) => await new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        resolve(body);
    });
});

function seemsLikeAPHPFile(path) {
	return path.endsWith('.php') || path.includes('.php/');
}

async function fetchAsUint8Array(url) {
	const fetchModule = await import('node-fetch');
	const fetch = fetchModule.default;
	const response = await fetch(url);
	return new Uint8Array(await response.arrayBuffer());
}

module.exports = {
    runWordPressServer
};

// runWordPressServer(process.cwd(), 51611);
