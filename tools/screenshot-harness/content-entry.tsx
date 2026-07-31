/**
 * Standalone re-implementation of src/entrypoints/content.tsx's *mounting*
 * logic (shadow root + theme injection + <App/>), for a plain browser tab.
 *
 * content.tsx itself cannot be imported here: it's built around
 * `defineContentScript`, a WXT build-time macro that only exists inside
 * WXT's own compiler pipeline, plus router-page detection/exclusion logic
 * that has no meaning outside an actual router page. Everything it does
 * AFTER those guards — build the theme CSS, register pages, mount <App/>
 * inside a shadow root — is reproduced verbatim below, importing the same
 * modules from src/ untouched.
 *
 * Route: the app is hash-routed (src/ui/App.tsx useHashRoute), so
 * content.html#/dashboard, content.html#/clients, content.html#/dhcp, etc.
 * all load this one entry and land on different views.
 */
import './mocks/router-fetch'; // install the fetch shim BEFORE any router-io call can fire
import ReactDOM from 'react-dom/client';
import { App } from '../../src/ui/App';
import { buildThemeCss } from '../../src/theme/css';
import { registerAllPages } from '../../src/pages/defs';

registerAllPages();

document.title = "Merlin's Cloak — Screenshot Harness";

// Mirrors content.tsx: hide-native-page styling has nothing to hide here, but
// the dark background match keeps the harness visually identical while the
// shadow root's own layout settles.
document.body.style.margin = '0';
document.body.style.background = '#21333e';

const host = document.createElement('div');
host.id = 'mc2-host';
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });

const style = document.createElement('style');
style.textContent = buildThemeCss();
shadow.appendChild(style);

const container = document.createElement('div');
shadow.appendChild(container);

// React 17+ delegates events to the root container, which is what makes
// event handling work inside the shadow tree (same comment as content.tsx).
ReactDOM.createRoot(container).render(<App />);
