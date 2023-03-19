import { createRoot } from 'react-dom/client';
import BrowserChrome from './playground-website-components/browser-chrome';
import VersionSelector from './playground-website-components/version-select';


const Website = ({ iframeSrc }) => {
	const phpVersions = ['8.2', '8.0', '7.4', '7.3', '7.2'];
	const wpVersions = ['5.9', '6.0', '6.1'];

	return (
		<>
		{/*<VersionSelector name="php" versions={phpVersions} />*/}
		<BrowserChrome>
			<iframe src={iframeSrc}></iframe>
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
