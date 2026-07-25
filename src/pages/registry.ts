/**
 * Central page registry + nav model. Category files under ./defs register
 * their PageDefs here via the arrays below; the App resolves visibility at
 * runtime from live capabilities — never from static assumptions.
 */
import type { Capabilities } from '../lib/capabilities';
import type { NavAliasDef, NavGroupDef, PageDef } from './types';

/**
 * The twelve-category tree from docs/NAV_TAXONOMY_PROPOSAL.md §2. Category
 * visibility is derived from the member pages' own gates (a category renders
 * only when at least one of its pages is visible); the only group-level gate
 * kept is USB's, unchanged from the pre-taxonomy nav, whose member pages
 * carry no equivalent page gate.
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
  { id: 'wan', label: 'Internet Connection' },
  {
    id: 'security',
    label: 'Security & Access Control',
    subs: [
      { id: 'firewall', label: 'Firewall' },
      { id: 'inbound', label: 'Inbound Access & NAT' },
      { id: 'content', label: 'Content & Device Restrictions' },
    ],
  },
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

/**
 * The three live-status tables that also appear beside the setting they
 * observe (proposal §4.7–4.8 tension, resolved by aliasing). Every page in
 * Live Status & Logs keeps its primary home there; no other page is aliased.
 */
export const NAV_ALIASES: NavAliasDef[] = [
  { pageId: 'log-dhcp', navGroup: 'lan', navSub: 'addressing', navOrder: 12.5 },
  { pageId: 'log-routes', navGroup: 'lan', navSub: 'addressing', navOrder: 13.5 },
  { pageId: 'log-portforward', navGroup: 'security', navSub: 'inbound', navOrder: 24.5 },
];

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
