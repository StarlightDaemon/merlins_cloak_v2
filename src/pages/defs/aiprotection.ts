/**
 * AiProtection (AiProtection_HomeProtection.asp) — Trend Micro-powered
 * malicious-site blocking, infected-device (C&C) blocking, and two-way
 * vulnerability protection (IPS). No RT-BE92U sysdep overlay exists for this
 * page.
 *
 * Deliberately NOT modeled: the page's "Router Security Assessment" panel
 * (check_weakness() / showWeaknessTable() / enable_whole_security()) is an
 * action flow, not settings — it inspects ~12 unrelated nvram values (login
 * password strength, WPS, UPnP, DMZ, port forwarding/trigger, FTP/Samba
 * anonymous access, wireless encryption, …) purely client-side and offers a
 * single "Secure All" button that flips all of them at once via a
 * dynamically-assembled action_script. None of that belongs on a settings
 * page def; the individual settings it touches already have their own pages
 * elsewhere in this catalog. Also skipped: the mail-alert preference fields
 * (PM_SMTP_*, PM_MY_EMAIL, wrs_mail_bit) — present only as hidden pass-through
 * inputs on this page with no visible edit UI here (the "Notification
 * Preference" button just links to the mobile app download), and the
 * wrs_{mals,vp,cc}_t "first detected" timestamps, which are display-only
 * (JS-formatted into "Since …" text, not user input).
 *
 * action_script="restart_wrs;restart_firewall" (action_wait 4). Per the
 * shared exclusion policy, ANY page whose action_script touches
 * restart_firewall falls under the 'firewall' hard exclusion regardless of
 * what else is in the (possibly multi-service) action_script string — so
 * this page is 'firewall', not null, despite the milder "wrs" service also
 * being in play.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const yesNo = [
  { value: '1', label: 'Enabled' },
  { value: '0', label: 'Disabled' },
];

export const aiProtectionPage: SettingsPageDef = {
  kind: 'settings',
  id: 'aiprotection',
  aspPage: 'AiProtection_HomeProtection.asp',
  title: 'AiProtection',
  navGroup: 'aiprotection',
  navLabel: 'AiProtection',
  gate: (c) => hasFlag(c, 'bwdpi_support'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  eulaGate: { nvramKeys: ['TM_EULA'], label: 'AiProtection' },
  intro:
    'Trend Micro-powered network protection: malicious site blocking, infected-device (C&C) detection, and two-way intrusion prevention.',
  read: {
    nvram: ['wrs_protect_enable', 'wrs_mals_enable', 'wrs_cc_enable', 'wrs_vp_enable'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [{ key: 'wrs_protect_enable', label: 'Enable AiProtection', control: 'radio', options: yesNo }],
    },
    {
      title: 'Protection modules',
      note:
        'Each module is only effective while "Enable AiProtection" above is on — the native page dims these controls ' +
        '(shadeHandle()) rather than disabling them when the master switch is off.',
      fields: [
        {
          key: 'wrs_mals_enable',
          label: 'Malicious sites blocking',
          hint: 'Blocks known-malicious URLs (dpi_mals)',
          control: 'radio',
          options: yesNo,
          showIf: (_v, caps) => hasFlag(caps, 'bwdpi_mals_support'),
        },
        {
          key: 'wrs_vp_enable',
          label: 'Two-way intrusion prevention system (IPS)',
          hint: 'Vulnerability protection against both inbound and outbound exploit attempts (dpi_vp)',
          control: 'radio',
          options: yesNo,
          showIf: (_v, caps) => hasFlag(caps, 'bwdpi_vp_support'),
        },
        {
          key: 'wrs_cc_enable',
          label: 'Infected-device (C&C) detection and blocking',
          hint: 'Blocks command-and-control traffic from already-compromised LAN clients (dpi_cc)',
          control: 'radio',
          options: yesNo,
          showIf: (_v, caps) => hasFlag(caps, 'bwdpi_cc_support'),
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wrs;restart_firewall',
    actionWait: 4,
  },
};

export const aiprotectionPages: SettingsPageDef[] = [aiProtectionPage];
