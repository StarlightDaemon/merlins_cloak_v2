/**
 * Prior-name record for the nav taxonomy rename, transcribed from
 * docs/NAV_TAXONOMY_PROPOSAL.md §3. Drives the hover-only "Formerly …"
 * tooltip on renamed nav entries. The recorded name is what the nav actually
 * rendered before the rename (navLabel where it differed from the title).
 * `category` is set only for the four old names that existed under more than
 * one category — General, IPv6, Port Forwarding, Settings — where the bare
 * name would be ambiguous. Pages absent from this map kept their name.
 */

export interface PriorName {
  name: string;
  /** Old category, only where the old name existed in two places. */
  category?: string;
}

export const PRIOR_PAGE_NAMES: Record<string, PriorName> = {
  // Overview
  dashboard: { name: 'Network Map' },
  clients: { name: 'Clients' },
  sysinfo: { name: 'System Information' },
  // Wireless
  'wireless-general': { name: 'General', category: 'Wireless' },
  'wireless-professional': { name: 'Professional' },
  wds: { name: 'Bridge / WDS' },
  'site-survey': { name: 'Site Survey' },
  'wireless-macfilter': { name: 'MAC Filter' },
  wps: { name: 'WPS' },
  radius: { name: 'RADIUS' },
  // Local Network
  'lan-ip': { name: 'LAN IP' },
  dhcp: { name: 'DHCP Server' },
  'static-route': { name: 'Route' },
  sdn: { name: 'Guest Network Pro' },
  iptv: { name: 'IPTV' },
  'switch-ctrl': { name: 'Switch Control' },
  // Internet Connection
  wan: { name: 'Internet Connection' },
  'dual-wan': { name: 'Dual WAN' },
  ipv6: { name: 'IPv6', category: 'IPv6' },
  ddns: { name: 'DDNS' },
  // Security & Access Control
  'firewall-general': { name: 'General', category: 'Firewall' },
  'network-service-filter': { name: 'Network Services Filter' },
  'port-trigger': { name: 'Port Trigger' },
  dmz: { name: 'DMZ' },
  'nat-passthrough': { name: 'NAT Passthrough' },
  aiprotection: { name: 'AiProtection' },
  parental: { name: 'Time Scheduling' },
  'dns-director': { name: 'DNS Director' },
  'url-filter': { name: 'URL Filter' },
  'keyword-filter': { name: 'Keyword Filter' },
  // VPN
  'vpn-status': { name: 'Status' },
  'vpn-fusion': { name: 'VPN Fusion' },
  'vpn-director': { name: 'VPN Director' },
  'pptp-server': { name: 'PPTP VPN Server' },
  'ipsec-server': { name: 'IPSec VPN Server' },
  // Traffic & Bandwidth
  'traffic-realtime': { name: 'Real-time' },
  'traffic-daily': { name: 'Daily' },
  'traffic-monthly': { name: 'Monthly' },
  'traffic-settings': { name: 'Settings', category: 'Traffic Analyzer' },
  qos: { name: 'QoS' },
  'qos-rules': { name: 'Rules (Traditional)' },
  'bandwidth-limiter': { name: 'Bandwidth Limiter' },
  'qos-stats': { name: 'Classification' },
  // USB Storage & Sharing
  samba: { name: 'Samba' },
  ftp: { name: 'FTP' },
  nfs: { name: 'NFS Exports' },
  mediaserver: { name: 'Media Server' },
  // Live Status & Logs
  'log-general': { name: 'General Log' },
  'log-wireless': { name: 'Wireless Log' },
  'log-dhcp': { name: 'DHCP Leases' },
  'log-ipv6': { name: 'IPv6', category: 'System Log' },
  'log-portforward': { name: 'Port Forwarding', category: 'System Log' },
  'log-connections': { name: 'Connections' },
  // Network Diagnostics
  analysis: { name: 'Network Analysis' },
  netstat: { name: 'Netstat' },
  wol: { name: 'Wake on LAN' },
  // Administration
  system: { name: 'System' },
  ssh: { name: 'SSH' },
  'system-time': { name: 'Time / NTP' },
  tweaks: { name: 'Tweaks' },
  firmware: { name: 'Firmware' },
  backup: { name: 'Backup / Restore' },
  'security-notification': { name: 'Security Notifications' },
  // Merlin's Cloak
  diagnostics: { name: 'Diagnostics' },
  'ext-settings': { name: 'Settings', category: "Merlin's Cloak" },
};

/**
 * Categories renamed outright, keyed by nav group id. Dissolved single-page
 * categories are covered by their page's entry above; Traffic & Bandwidth is
 * the union of two former categories and records both.
 */
export const PRIOR_CATEGORY_NAMES: Record<string, string> = {
  status: 'Network Map',
  lan: 'LAN',
  wan: 'WAN',
  security: 'Firewall',
  traffic: 'Traffic Analyzer + QoS',
  usb: 'USB Applications',
  log: 'System Log',
  nettools: 'Network Tools',
};

/** Hover text for a renamed page's nav entry, or undefined if not renamed. */
export function priorPageText(pageId: string): string | undefined {
  const prior = PRIOR_PAGE_NAMES[pageId];
  if (!prior) return undefined;
  return prior.category ? `Formerly “${prior.name}” under ${prior.category}` : `Formerly “${prior.name}”`;
}

/** Hover text for a renamed category's nav title, or undefined. */
export function priorCategoryText(groupId: string): string | undefined {
  const prior = PRIOR_CATEGORY_NAMES[groupId];
  return prior ? `Formerly “${prior}”` : undefined;
}
