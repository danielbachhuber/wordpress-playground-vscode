import { createRoot } from 'react-dom/client';
import BrowserChrome from './playground-website-components/browser-chrome';
import VersionSelector from './playground-website-components/version-select';

import {useState} from 'react'

const Website = ({ iframeSrc } : { iframeSrc: string }) => {
	const phpVersions = ['8.2', '8.0', '7.4', '7.3', '7.2'];
	const wpVersions = ['5.9', '6.0', '6.1'];
	const [currentSrc, setCurrentSrc] = useState(iframeSrc);
	const onVersionChange = (version: string) => {
		//console.log(window.location.toString());
		const url = new URL(iframeSrc);
		url.searchParams.set("php", version);
		//console.log("FINAL URL: ",url);
		setCurrentSrc(url.toString());
		//window.location.assign(url);
	};

	return (
		<>
		<VersionSelector name="php" versions={phpVersions} onChange={onVersionChange} />
		<BrowserChrome>
			<iframe src={currentSrc}></iframe>
		</BrowserChrome>
		</>
		
	);
};

const el = document.getElementById('root');
if ( el ) {
	const iframeSrc = el.dataset.iframeSrc;
	const root = createRoot(el);
	root.render(
		<Website iframeSrc={ iframeSrc } />
	);
}
