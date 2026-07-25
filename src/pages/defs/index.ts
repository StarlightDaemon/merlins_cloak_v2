/**
 * Page registration. Category modules export PageDef arrays; this file is the
 * single place they are pulled into the registry, imported once by the
 * content script before mount.
 */
import { registerPages } from '../registry';
import { tweaksPage } from './tools-tweaks';
import { DashboardPage } from './dashboard';
import { DiagnosticsPage, ExtensionSettingsPage } from './extension';

export function registerAllPages(): void {
  registerPages([
    {
      kind: 'custom',
      id: 'dashboard',
      aspPage: 'index.asp',
      title: 'Network Map',
      navGroup: 'status',
      confidence: { read: 'live-verified' },
      component: DashboardPage,
    },
    tweaksPage,
    {
      kind: 'custom',
      id: 'diagnostics',
      aspPage: '(extension)',
      title: 'Diagnostics',
      navGroup: 'extension',
      confidence: { read: 'live-verified' },
      component: DiagnosticsPage,
    },
    {
      kind: 'custom',
      id: 'ext-settings',
      aspPage: '(extension)',
      title: 'Settings',
      navGroup: 'extension',
      confidence: { read: 'live-verified' },
      component: ExtensionSettingsPage,
    },
  ]);
}
