/**
 * VPN Director (Advanced_VPNDirector.asp, Merlin) — policy routing for VPN
 * clients. Single rule list, format confirmed from the page's own
 * parseNvramToArray/parseArrayToNvram pair:
 *   vpndirector_rulelist: <enable>description>localIP>remoteIP>iface
 * iface ∈ WAN | OVPN1..5 | WGC1..5 (WGC options gated on wireguard_support).
 * Applies with restart_vpnrouting0 (action_wait 5).
 */
import { hasFlag } from '../../lib/capabilities';
import type { SettingsPageDef } from '../types';

const CIDR_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})(/\\d{1,2})?$';
const CIDR_HINT = 'IPv4 address or CIDR, e.g. 192.168.1.10 or 10.0.0.0/24';

export const vpnDirectorPage: SettingsPageDef = {
  kind: 'settings',
  id: 'vpn-director',
  aspPage: 'Advanced_VPNDirector.asp',
  title: 'VPN Director',
  navGroup: 'vpn',
  navSub: 'outgoing',
  navOrder: 37,
  navLabel: 'VPN Director',
  merlinOnly: true,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'vpn',
  gate: (c) => hasFlag(c, 'openvpnd_support') || hasFlag(c, 'wireguard_support'),
  intro:
    'Rules route matching LAN traffic through a VPN client interface. Rules are evaluated top-down; WGC rules take priority over OVPN rules in the firmware.',
  read: {
    nvramAscii: ['vpndirector_rulelist'],
  },
  sections: [
    {
      title: 'Policy rules',
      fields: [
        {
          key: 'vpndirector_rulelist',
          label: 'Rules',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 199,
            columns: [
              {
                id: 'enable',
                label: 'On',
                width: 70,
                control: 'select',
                options: [
                  { value: '1', label: 'On' },
                  { value: '0', label: 'Off' },
                ],
              },
              { id: 'description', label: 'Description', validate: { maxLength: 32 } },
              { id: 'localIP', label: 'Local IP / CIDR', mono: true, validate: { pattern: CIDR_PATTERN, patternHint: CIDR_HINT } },
              { id: 'remoteIP', label: 'Remote IP / CIDR', mono: true, validate: { pattern: CIDR_PATTERN, patternHint: CIDR_HINT } },
              {
                id: 'iface',
                label: 'Interface',
                width: 110,
                control: 'select',
                options: [
                  { value: 'WAN', label: 'WAN' },
                  { value: 'OVPN1', label: 'OpenVPN 1' },
                  { value: 'OVPN2', label: 'OpenVPN 2' },
                  { value: 'OVPN3', label: 'OpenVPN 3' },
                  { value: 'OVPN4', label: 'OpenVPN 4' },
                  { value: 'OVPN5', label: 'OpenVPN 5' },
                  { value: 'WGC1', label: 'WireGuard 1' },
                  { value: 'WGC2', label: 'WireGuard 2' },
                  { value: 'WGC3', label: 'WireGuard 3' },
                  { value: 'WGC4', label: 'WireGuard 4' },
                  { value: 'WGC5', label: 'WireGuard 5' },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_vpnrouting0',
    actionWait: 5,
  },
};

export const vpnDirectorPages: SettingsPageDef[] = [vpnDirectorPage];
