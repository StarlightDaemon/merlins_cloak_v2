/**
 * Page registration. Category modules export PageDef arrays; this file is the
 * single place they are pulled into the registry, imported once by the
 * content script before mount.
 */
import { registerPages } from '../registry';
import { tweaksPage } from './tools-tweaks';
import { DashboardPage } from './dashboard';
import { DiagnosticsPage, ExtensionSettingsPage } from './extension';
import { lanPages } from './lan';
import { wanPages } from './wan';
import { wirelessPages } from './wireless';
import { siteSurveyPages } from './site-survey';
import { vpnClientPages } from './vpn-client';
import { vpnServerPages } from './vpn-server';
import { vpnDirectorPages } from './vpn-director';
import { ipsecPages } from './ipsec';
import { dnsDirectorPages } from './dnsdirector';
import { firewallPages } from './firewall';
import { ipv6Pages } from './ipv6';
import { wolPages } from './wol';
import { usbPages } from './usb';
import { adminPages } from './admin';
import { parentalPages } from './parental';
import { aiprotectionPages } from './aiprotection';
import { logPages } from './logs';
import { nettoolsPages } from './nettools';
import { trafficPages } from './traffic';
import { qosStatsPages } from './qos-stats';
import { qosPages } from './qos';
import { vpnStatusPages } from './vpn-status';
import { sdnPages } from './sdn';
import { clientsPages } from './clients';
import { notificationPages } from './notification';

export function registerAllPages(): void {
  registerPages([
    {
      kind: 'custom',
      id: 'dashboard',
      aspPage: 'index.asp',
      title: 'Router Status',
      navGroup: 'status',
      navOrder: 1,
      confidence: { read: 'live-verified' },
      component: DashboardPage,
    },
  ]);
  registerPages(clientsPages);
  registerPages(notificationPages);
  registerPages(sdnPages);
  registerPages(aiprotectionPages);
  registerPages(parentalPages);
  registerPages(qosPages);
  registerPages(qosStatsPages);
  registerPages(trafficPages);
  registerPages(wirelessPages);
  registerPages(siteSurveyPages);
  registerPages(lanPages);
  registerPages(wanPages);
  registerPages(ipv6Pages);
  registerPages(vpnStatusPages);
  registerPages(vpnClientPages);
  registerPages(vpnServerPages);
  registerPages(vpnDirectorPages);
  registerPages(ipsecPages);
  registerPages(firewallPages);
  registerPages(dnsDirectorPages);
  registerPages(logPages);
  registerPages(nettoolsPages);
  registerPages(wolPages);
  registerPages(usbPages);
  registerPages(adminPages);
  registerPages([
    tweaksPage,
    {
      kind: 'custom',
      id: 'diagnostics',
      aspPage: '(extension)',
      title: 'Detection & Write Log',
      navGroup: 'extension',
      navOrder: 72,
      confidence: { read: 'live-verified' },
      component: DiagnosticsPage,
    },
    {
      kind: 'custom',
      id: 'ext-settings',
      aspPage: '(extension)',
      title: 'Extension Settings',
      navGroup: 'extension',
      navOrder: 73,
      confidence: { read: 'live-verified' },
      component: ExtensionSettingsPage,
    },
  ]);
}
