/**
 * Fujin design tokens, carried forward from the v1 userscript
 * (StarlightDaemon/merlins_cloak, asus-merlin-ui.user.js, "FUJIN TOKEN MAP").
 * Color values were originally sourced from the stock Merlin RAW CSS files;
 * typography values match StarlightDaemon/Fujin's tokens.json.
 *
 * This is a reference snapshot only - no theme CSS, components, or styling
 * logic consumes it yet.
 */

export interface FujinTokens {
  // Page-level backgrounds (dark -> light)
  bgPage: string;
  bgDark: string;
  bgStatus: string;
  bgOverlay: string;
  bgTitle: string;
  // Surfaces
  navBg: string;
  blockBg: string;
  contentBg: string;
  cellBg: string;
  inputBg: string;
  // Borders
  borderDark: string;
  borderMenu: string;
  borderInput: string;
  borderCard: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textLink: string;
  textHint: string;
  // Accents
  accentHover: string;
  accentBtn: string;
  accentBright: string;
  // Connection type badges
  wired: string;
  ghz24: string;
  ghz5: string;
  ghz6: string;
  // Effects
  shadowColor: string;
  // Typography
  fontBase: string;
  fontMono: string;
}

export const fujinTokens: FujinTokens = {
  // Page-level backgrounds (dark -> light)
  bgPage: '#21333e', // body (index_style.css)
  bgDark: '#1f2d35', // FormTable th, top-input (form_style.css)
  bgStatus: '#2a3539', // statusbody, NM containers (NM_style.css)
  bgOverlay: '#2b373b', // pop_div_bg, floating panels (form_style.css)
  bgTitle: '#2f3a3e', // .tab default, .tm_title_bg (form_style.css)
  // Surfaces
  navBg: '#3a4042', // .menu, .control_bg (index_style.css / form_style.css)
  blockBg: '#444f53', // .block_bg, port status panels (form_style.css)
  contentBg: '#4d595d', // .tabClicked, .content_bg, FormTitle thead
  cellBg: '#475a5f', // .FormTable td, .textarea_bg
  inputBg: '#596e74', // .input_*_table, clientIcon bg (form_style.css / device-map.css)
  // Borders
  borderDark: '#222222', // FormTable td inner borders
  borderMenu: '#6b7071', // .menu border, .menu_Split border (index_style.css)
  borderInput: '#929ea1', // .input_*_table border (form_style.css)
  borderCard: '#3a4042', // card separation (= navBg; reserved, unused today)
  // Text
  textPrimary: '#ffffff',
  textSecondary: '#93a9b1', // .tab_font_color (form_style.css)
  textMuted: '#667881', // lightest muted, vendor labels
  textLink: '#569ac7', // .clients span, .style1, .NMitem a (NM_style.css)
  textHint: '#ffcc00', // .hint-color, FormTable td span (form_style.css)
  // Accents
  accentHover: '#77a5c6', // .menu:hover (index_style.css)
  accentBtn: '#09639c', // .button_gen:hover gradient start (form_style.css)
  accentBright: '#248dff', // scrollbar thumb (form_style.css)
  // Connection type badges (reserved for the future client grid;
  // only ghz24 is referenced today, as the settings [ON] color)
  wired: '#4a9eff',
  ghz24: '#44cc88',
  ghz5: '#ffaa33',
  ghz6: '#cc44ff',
  // Effects
  shadowColor: 'rgba(0,0,0,0.5)',
  // Typography - matches Fujin tokens.json typography.fontFamily
  fontBase:
    '"Verdana", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, monospace',
};
