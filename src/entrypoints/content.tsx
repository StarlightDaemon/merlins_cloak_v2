/**
 * Content script: the ONLY context that talks to the router.
 *
 * Activation: runs on the configured router address (plus the standard Asus
 * LAN hostnames), verifies the page actually looks like an AsusWRT admin UI,
 * refuses to take over login/wizard/upgrade flows, then hides the native page
 * and mounts the React app inside a Shadow DOM (isolating both directions
 * from the router's un-namespaced legacy CSS and inline handlers).
 *
 * The native page's own scripts keep running underneath — deliberately:
 * state.js populates the *_support globals our capability layer reads, and
 * the page's background polling is read-only and harmless.
 */
import ReactDOM from 'react-dom/client';
import { App } from '../ui/App';
import { buildThemeCss } from '../theme/css';
import { getSettings } from '../lib/settings';
import { log } from '../lib/log';
import { registerAllPages } from '../pages/defs';

export default defineContentScript({
  matches: [
    'http://192.168.1.1/*',
    'https://192.168.1.1/*',
    'http://router.asus.com/*',
    'https://router.asus.com/*',
    'http://www.asusrouter.com/*',
    'https://www.asusrouter.com/*',
  ],
  runAt: 'document_idle',
  async main() {
    const settings = await getSettings();
    const configuredHost = settings.routerAddress.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const KNOWN_HOSTS = new Set(['router.asus.com', 'www.asusrouter.com', configuredHost]);
    if (!KNOWN_HOSTS.has(window.location.host)) {
      // Dynamically-registered custom addresses land here too; anything else bails.
      if (window.location.host !== configuredHost) return;
    }

    const path = window.location.pathname.replace(/^\//, '') || 'index.asp';

    // Never take over auth, setup, or recovery flows — the user must interact
    // with the native page there (we never touch credentials).
    const EXCLUDED_PAGES = [
      /^Main_Login\.asp$/i,
      /^Main_Password\.asp$/i,
      /^QIS_/i,
      /^qis\//i,
      /^Updating\.asp$/i,
      /^UpdateError/i,
      /^Uploading\.asp$/i,
      /^UploadingJFFS\.asp$/i,
      /^error_page\.htm$/i,
      /^message\.htm$/i,
      /^start_apply2?\.htm$/i,
      /^cloud_/i, // AiCloud 404s live on this hardware; never assume it
      /^page_default\.cgi$/i,
      /^blocking\.asp$/i,
    ];
    if (EXCLUDED_PAGES.some((re) => re.test(path))) {
      log.debug(`not mounting on excluded page: ${path}`);
      return;
    }

    // Confirm this is actually an AsusWRT admin page before touching the DOM.
    const looksLikeAsuswrt =
      document.querySelector('script[src*="state.js"], script[src*="/require/require.min.js"], form[name="form"][action*="apply"]') !== null ||
      /ASUS Wireless Router|RT-|GT-|TUF-|ZenWiFi/i.test(document.title);
    if (!looksLikeAsuswrt) {
      log.debug('page does not look like an AsusWRT admin UI; not mounting');
      return;
    }

    // If the router bounced us to the login form via a JS redirect the page
    // may still be the login document at idle time.
    if (document.querySelector('input[name="login_authorization"], form[name="form"][action*="login.cgi"]')) {
      log.info('login page detected; leaving native UI untouched');
      return;
    }

    log.info(`mounting on ${path}`);
    registerAllPages();

    // --- hide the native page (kept alive underneath) ---
    const hideStyle = document.createElement('style');
    hideStyle.id = 'mc2-hide-native';
    hideStyle.textContent = `
      html, body { overflow: hidden !important; }
      body > *:not(#mc2-host) { display: none !important; }
      body { background: #21333e !important; }
    `;
    document.documentElement.appendChild(hideStyle);

    // --- mount inside a shadow root ---
    const host = document.createElement('div');
    host.id = 'mc2-host';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = buildThemeCss();
    shadow.appendChild(style);

    const container = document.createElement('div');
    shadow.appendChild(container);

    // React 17+ delegates events to the root container (not document), which
    // is what makes event handling work inside the shadow tree.
    ReactDOM.createRoot(container).render(<App />);
  },
});
