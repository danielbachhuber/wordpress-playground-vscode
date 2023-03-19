import type { PHP } from '@php-wasm/node';

const DOCROOT = '/wordpress';

export default function patchWordPress(php: PHP) {
	new WordPressPatcher(php).patch();
}

class WordPressPatcher {
	#php: PHP;

	constructor(php: PHP) {
		this.#php = php;
	}

	patch() {
		this.#php.writeFile('/wordpress/phpinfo.php', '<?php phpinfo(); ');
		this.#disableSiteHealth();
		this.#replaceRequestsTransports();
	}
	#disableSiteHealth() {
		this.#patchFile(
			`${DOCROOT}/wp-includes/default-filters.php`,
			(contents) =>
				contents.replace(
					/add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
					''
				)
		);
	}
	#replaceRequestsTransports() {

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			`${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php`,
			`${DOCROOT}/wp-includes/Requests/Transport/cURL.php`,
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!this.#php.fileExists(transport)) {continue;}
			this.#patchFile(transport, ( contents ) => {
				// If contents contains function test2, make no change.
				if ( contents.includes( 'public static function test2' ) ) {
					return contents;
				}

				return contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				);
			} );
		}
	}
	#patchFile(path: string, callback: (contents: string) => string) {
		this.#php.writeFile(path, callback(this.#php.readFileAsText(path)));
	}
}
