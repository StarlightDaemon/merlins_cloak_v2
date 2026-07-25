/**
 * Central page registry + nav model. Category files under ./defs register
 * their PageDefs here via the arrays below; the App resolves visibility at
 * runtime from live capabilities — never from static assumptions.
 */
import type { Capabilities } from '../lib/capabilities';
import type { NavGroupDef, PageDef } from './types';

export const NAV_GROUPS: NavGroupDef[] = [
  { id: 'status', label: 'Network Map' },
  { id: 'sdn', label: 'Guest Network Pro', gate: (c) => hasSdn(c) },
  { id: 'aiprotection', label: 'AiProtection', gate: (c) => truthy(c, 'bwdpi_support') },
  { id: 'parental', label: 'Parental Controls' },
  { id: 'qos', label: 'QoS' },
  { id: 'traffic', label: 'Traffic Analyzer', gate: (c) => truthy(c, 'traffic_analyzer_support') || c.identity.branch === 'merlin' },
  { id: 'usb', label: 'USB Applications', gate: (c) => c.rcSupport.has('usbX1') || c.rcSupport.has('usb') },
  { id: 'wireless', label: 'Wireless' },
  { id: 'lan', label: 'LAN' },
  { id: 'wan', label: 'WAN' },
  { id: 'ipv6', label: 'IPv6', gate: (c) => c.rcSupport.has('ipv6') },
  { id: 'vpn', label: 'VPN' },
  { id: 'firewall', label: 'Firewall' },
  { id: 'dnsdirector', label: 'DNS Director', gate: (c) => truthy(c, 'dnsfilter_support') },
  { id: 'admin', label: 'Administration' },
  { id: 'log', label: 'System Log' },
  { id: 'nettools', label: 'Network Tools' },
  { id: 'extension', label: "Merlin's Cloak" },
];

function truthy(caps: Capabilities, flag: string): boolean {
  const v = caps.flags[flag];
  if (v === undefined) return false;
  if (typeof v === 'string') return v !== '' && v !== '0';
  return Boolean(v);
}

function hasSdn(caps: Capabilities): boolean {
  return truthy(caps, 'mtlancfg_support');
}

const pages: PageDef[] = [];

export function registerPages(defs: PageDef[]): void {
  for (const def of defs) {
    if (pages.some((p) => p.id === def.id)) continue;
    pages.push(def);
  }
}

export function getAllPages(): readonly PageDef[] {
  return pages;
}

export function getVisiblePages(caps: Capabilities): PageDef[] {
  return pages.filter((p) => !p.gate || p.gate(caps)).filter((p) => !p.merlinOnly || caps.identity.branch !== 'stock');
}

export function findPage(id: string): PageDef | undefined {
  return pages.find((p) => p.id === id);
}

/** Map a native .asp pathname to the replacement page id (deep-link parity). */
export function pageIdForAsp(pathname: string): string | undefined {
  const name = pathname.replace(/^\//, '') || 'index.asp';
  return pages.find((p) => p.aspPage === name)?.id;
}
