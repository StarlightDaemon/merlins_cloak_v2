/**
 * Central page registry + nav model. Category files under ./defs register
 * their PageDefs here via the arrays below; the App resolves visibility at
 * runtime from live capabilities — never from static assumptions.
 */
import type { Capabilities } from '../lib/capabilities';
import type { NavGroupDef, PageDef } from './types';

/**
 * The twelve-category tree from docs/NAV_TAXONOMY_PROPOSAL.md §2. The five
 * single-page orphan categories (sdn, aiprotection, parental, dnsdirector,
 * ipv6) are still standalone here; they dissolve into their new homes in the
 * orphan-consolidation step (Task 4).
 */
export const NAV_GROUPS: NavGroupDef[] = [
  { id: 'status', label: 'Overview' },
  {
    id: 'wireless',
    label: 'Wireless',
    subs: [
      { id: 'radio', label: 'Radio & Network' },
      { id: 'access', label: 'Client Access' },
    ],
  },
  {
    id: 'lan',
    label: 'Local Network',
    subs: [
      { id: 'addressing', label: 'Addressing & Routing' },
      { id: 'segments', label: 'Segments & Ports' },
    ],
  },
  { id: 'sdn', label: 'Guest Network Pro', gate: (c) => hasSdn(c) },
  { id: 'wan', label: 'Internet Connection' },
  { id: 'ipv6', label: 'IPv6', gate: (c) => c.rcSupport.has('ipv6') },
  {
    id: 'security',
    label: 'Security & Access Control',
    subs: [
      { id: 'firewall', label: 'Firewall' },
      { id: 'inbound', label: 'Inbound Access & NAT' },
      { id: 'content', label: 'Content & Device Restrictions' },
    ],
  },
  { id: 'aiprotection', label: 'AiProtection', gate: (c) => truthy(c, 'bwdpi_support') },
  { id: 'parental', label: 'Parental Controls' },
  { id: 'dnsdirector', label: 'DNS Director', gate: (c) => truthy(c, 'dnsfilter_support') },
  {
    id: 'vpn',
    label: 'VPN',
    subs: [
      { id: 'overview', label: 'Overview' },
      { id: 'outgoing', label: 'Outgoing Connections (router as client)' },
      { id: 'incoming', label: 'Incoming Connections (router as server)' },
    ],
  },
  {
    id: 'traffic',
    label: 'Traffic & Bandwidth',
    subs: [
      { id: 'monitoring', label: 'Usage Monitoring' },
      { id: 'prioritization', label: 'Prioritization & Limits' },
    ],
  },
  { id: 'usb', label: 'USB Storage & Sharing', gate: (c) => c.rcSupport.has('usbX1') || c.rcSupport.has('usb') },
  { id: 'log', label: 'Live Status & Logs' },
  { id: 'nettools', label: 'Network Diagnostics' },
  {
    id: 'admin',
    label: 'Administration',
    subs: [
      { id: 'access', label: 'Router Access' },
      { id: 'system', label: 'System Settings' },
      { id: 'maintenance', label: 'Maintenance' },
    ],
  },
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
