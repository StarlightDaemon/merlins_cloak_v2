/**
 * USB category: Network Place (Samba), FTP Share, Media Server, NFS Exports.
 * Field sets, validation bounds, and action_script values extracted from the
 * corresponding pages in the Merlin 3006.102.7_2 www/ source (RAW/merlin). No
 * RT-BE92U sysdep overlay exists for any of them.
 *
 * These pages only matter when USB storage is actually attached — that is
 * runtime device state, not a capability flag, so none of the fields below
 * are gated on disk presence (matching the native pages, which render their
 * settings form regardless and only show a "no USB found" banner for the
 * folder-tree/browse widgets we don't model).
 *
 * Toggle-endpoint normalization: on the native samba/ftp/NFS pages, the
 * enable_samba / enable_ftp / nfsd_enable service switches are NOT posted
 * through the page's own settings <form> — they're driven by a dedicated
 * iphoneSwitch handler that submits a throwaway request to a small aidisk.cgi
 * endpoint (/aidisk/switch_AiDisk_app.asp for samba/ftp; a same-shaped
 * /start_apply.htm post for NFS) outside the normal action_mode/action_script
 * flow. All three keys are nonetheless present in router_defaults (confirmed
 * in shared/defaults.c), so validate_apply() honors them exactly like any
 * other posted field; they are modeled here as ordinary radio fields written
 * through this project's uniform applyapp + rcService path, which has the
 * same net effect (nvram set + service restart) as the native toggle.
 *
 * Per-user/per-group share permissions (Network Place + FTP) are a whole
 * parallel subsystem keyed by account/pool/folder and posted through other
 * dedicated aidisk.cgi endpoints (set_account_permission.asp,
 * set_group_permission.asp, popCreateAccount.asp, ...); modeling that is out
 * of scope for a declarative nvram-field page, so it — along with the
 * account-vs-share management-mode selector (st_samba_mode / st_ftp_mode,
 * toggled via switch_share_mode.asp) that gates it — is skipped entirely.
 *
 * Advanced_AiDisk_NFS.asp is Merlin-only and is in the operator's
 * live-verified page list; the other three are structural (source-derived,
 * not exercised live this session).
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const HOST_NAME_PATTERN = '^[a-zA-Z0-9][a-zA-Z0-9-]*$';
const HOST_NAME_HINT = 'Letters, digits, hyphens; must start with a letter or digit';
const WORKGROUP_NAME_PATTERN = '^[a-zA-Z0-9][a-zA-Z0-9_-]*$';
const WORKGROUP_NAME_HINT = 'Letters, digits, hyphens, underscores; must start with a letter or digit';
/** validator.friendly_name: any printable ASCII (0x20-0x7E). */
const PRINTABLE_ASCII_PATTERN = '^[ -~]*$';
const PRINTABLE_ASCII_HINT = 'Printable ASCII characters only';

// ---------------------------------------------------------------------------
// Network Place (Samba) — Advanced_AiDisk_samba.asp
// ---------------------------------------------------------------------------

export const sambaPage: SettingsPageDef = {
  kind: 'settings',
  id: 'samba',
  aspPage: 'Advanced_AiDisk_samba.asp',
  title: 'Windows File Sharing (SMB)',
  navGroup: 'usb',
  navOrder: 51,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Per-account and per-group share permissions, and the account-vs-share management mode that gates them, are managed through a separate set of aidisk.cgi endpoints and are not modeled here.',
  read: {
    nvram: [
      'enable_samba',
      'computer_name',
      'st_samba_workgroup',
      'smbd_protocol',
      'smbd_simpler_naming',
      'smbd_master',
      'smbd_wins',
      'st_max_user',
      'usb_fs_ntfs_sparse',
    ],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        {
          key: 'enable_samba',
          label: 'Enable Network Place (Samba)',
          hint: 'Native page toggles this via a dedicated aidisk.cgi switch, not this form — see file header',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'computer_name',
          label: "Device name (NetBIOS name)",
          hint: 'Blank falls back to the LAN host name, uppercased',
          control: 'text',
          validate: { maxLength: 15, pattern: HOST_NAME_PATTERN, patternHint: HOST_NAME_HINT },
          showIf: (v) => v.enable_samba === '1',
        },
        {
          key: 'st_samba_workgroup',
          label: 'Workgroup',
          hint: 'Blank falls back to the LAN domain name, uppercased',
          control: 'text',
          validate: { maxLength: 15, pattern: WORKGROUP_NAME_PATTERN, patternHint: WORKGROUP_NAME_HINT },
          showIf: (v) => v.enable_samba === '1',
        },
      ],
    },
    {
      title: 'Protocol and behavior',
      showIf: (v) => v.enable_samba === '1',
      fields: [
        {
          key: 'smbd_protocol',
          label: 'Samba protocol version',
          hint: 'Hard-excluded from live testing: changing the negotiated SMB protocol can immediately break any in-progress Samba mount, including the one this session might be relying on.',
          control: 'select',
          options: [
            { value: '0', label: 'SMBv1' },
            { value: '1', label: 'SMBv2' },
            { value: '2', label: 'SMBv1 + SMBv2' },
          ],
        },
        {
          key: 'smbd_simpler_naming',
          label: 'Simpler share naming',
          hint: 'Omits the disk name from the share path',
          control: 'radio',
          options: yesNo,
        },
        { key: 'smbd_master', label: 'Force as Master Browser', control: 'radio', options: yesNo },
        { key: 'smbd_wins', label: 'Set as WINS server', control: 'radio', options: yesNo },
      ],
    },
    {
      title: 'Limits',
      fields: [
        {
          key: 'st_max_user',
          label: 'Maximum number of login users',
          control: 'number',
          validate: { min: 1, max: 99, required: true },
        },
        {
          key: 'usb_fs_ntfs_sparse',
          label: 'NTFS sparse files',
          hint: 'Only shown on builds with sparse-file support (ntfs_sparse_support); changing it reboots the router on the native page',
          control: 'select',
          options: [
            { value: '0', label: 'Disable' },
            { value: '1', label: 'Enable' },
          ],
          showIf: (_v, caps) => hasFlag(caps, 'ntfs_sparse_support'),
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_ftpsamba;restart_dnsmasq',
    actionWait: 5,
  },
};

// ---------------------------------------------------------------------------
// FTP Share — Advanced_AiDisk_ftp.asp
// ---------------------------------------------------------------------------

export const ftpPage: SettingsPageDef = {
  kind: 'settings',
  id: 'ftp',
  aspPage: 'Advanced_AiDisk_ftp.asp',
  title: 'FTP File Sharing',
  navGroup: 'usb',
  navOrder: 52,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Per-account share permissions and the account-vs-share management mode are managed through a separate set of aidisk.cgi endpoints and are not modeled here. This firmware branch has no FTP port/passive-mode fields — only WAN access, TLS, login-user limit, and codepage are configurable.',
  read: {
    nvram: ['enable_ftp', 'ftp_wanac', 'ftp_tls', 'st_max_user', 'ftp_lang'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        {
          key: 'enable_ftp',
          label: 'Enable FTP share',
          hint: 'Native page toggles this via a dedicated aidisk.cgi switch, not this form — see file header',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'ftp_wanac',
          label: 'Enable WAN access',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.enable_ftp === '1',
        },
        {
          key: 'ftp_tls',
          label: 'Enable TLS/SSL (FTP over TLS)',
          hint: 'Only shown on builds with ftp_ssl_support',
          control: 'radio',
          options: yesNo,
          showIf: (v, caps) => v.enable_ftp === '1' && hasFlag(caps, 'ftp_ssl_support'),
        },
      ],
    },
    {
      title: 'Limits',
      showIf: (v) => v.enable_ftp === '1',
      fields: [
        {
          key: 'st_max_user',
          label: 'Maximum number of login users',
          control: 'number',
          validate: { min: 1, max: 99, required: true },
        },
        {
          key: 'ftp_lang',
          label: 'FTP server codepage',
          control: 'select',
          options: [
            { value: 'CN', label: 'GBK (Simplified Chinese)' },
            { value: 'TW', label: 'Big5 (Traditional Chinese)' },
            { value: 'EN', label: 'UTF-8' },
            { value: 'RU', label: 'Russian' },
            { value: 'CZ', label: 'Czech' },
          ],
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_ftpsamba',
    actionWait: 5,
  },
};

// ---------------------------------------------------------------------------
// Media Server — mediaserver.asp
// ---------------------------------------------------------------------------

/**
 * dms_dir_x and dms_dir_type_x are two SEPARATE '<'-delimited nvram lists
 * kept in sync by record index (not a single joined "path>type" list) — the
 * page's own apply() builds them as parallel arrays. Decomposed here into one
 * virtual two-column list field ('dms_dirs_view'), re-split into the two
 * stored keys on write (tools-tweaks / firewall.ts derive pattern).
 */
function dmsDirsFromStored(dirsRaw: string, typesRaw: string): string {
  const dirs = (dirsRaw ?? '').split('<').filter((r) => r !== '');
  const types = (typesRaw ?? '').split('<').filter((r) => r !== '');
  const rows: string[] = [];
  for (let i = 0; i < dirs.length; i++) {
    rows.push(`<${dirs[i]}>${types[i] ?? ''}`);
  }
  return rows.join('');
}

function dmsDirsToStored(view: string): { dirs: string; types: string } {
  if (!view) return { dirs: '', types: '' };
  const recs = view.split('<').filter((r) => r !== '');
  const dirs = recs.map((r) => `<${r.split('>')[0] ?? ''}`).join('');
  const types = recs.map((r) => `<${r.split('>')[1] ?? ''}`).join('');
  return { dirs, types };
}

export const mediaserverPage: SettingsPageDef = {
  kind: 'settings',
  id: 'mediaserver',
  aspPage: 'mediaserver.asp',
  title: 'Media Streaming (DLNA & iTunes)',
  navGroup: 'usb',
  navOrder: 54,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  read: {
    nvram: ['daapd_enable', 'daapd_friendly_name', 'dms_enable', 'dms_friendly_name', 'dms_dir_manual', 'dms_rebuild', 'dms_web'],
    nvramAscii: ['dms_dir_x', 'dms_dir_type_x'],
    derive: (raw) => ({ dms_dirs_view: dmsDirsFromStored(raw.dms_dir_x ?? '', raw.dms_dir_type_x ?? '') }),
  },
  sections: [
    {
      title: 'iTunes Server (DAAP)',
      showIf: (_v, caps) => !hasFlag(caps, 'noiTunes_support'),
      fields: [
        { key: 'daapd_enable', label: 'Enable iTunes server', control: 'radio', options: yesNo },
        {
          key: 'daapd_friendly_name',
          label: 'Server name',
          hint: 'Blank falls back to the LAN host name',
          control: 'text',
          validate: { maxLength: 32, pattern: PRINTABLE_ASCII_PATTERN, patternHint: PRINTABLE_ASCII_HINT },
          showIf: (v) => v.daapd_enable === '1',
        },
      ],
    },
    {
      title: 'DLNA Media Server',
      fields: [
        { key: 'dms_enable', label: 'Enable DLNA media server', control: 'radio', options: yesNo },
        {
          key: 'dms_friendly_name',
          label: 'Server name',
          hint: 'Blank falls back to the LAN host name',
          control: 'text',
          validate: { maxLength: 32, pattern: PRINTABLE_ASCII_PATTERN, patternHint: PRINTABLE_ASCII_HINT },
          showIf: (v) => v.dms_enable === '1',
        },
        {
          key: 'dms_rebuild',
          label: 'Rebuild entire database at start',
          hint: 'A persisted nvram setting (not a one-shot action button): every ushare/DLNA daemon restart rescans from scratch when enabled',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.dms_enable === '1',
        },
        {
          key: 'dms_web',
          label: 'Enable status webpage',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.dms_enable === '1',
        },
        {
          key: 'dms_dir_manual',
          label: 'Shared directories',
          control: 'select',
          options: [
            { value: '0', label: 'All default shared folders' },
            { value: '1', label: 'Manually specify' },
          ],
          showIf: (v) => v.dms_enable === '1',
        },
      ],
    },
    {
      title: 'Manually shared directories',
      note: 'Stored across nvram dms_dir_x / dms_dir_type_x (kept in sync by record index, re-split transparently). Max 10 entries.',
      showIf: (v) => v.dms_enable === '1' && v.dms_dir_manual === '1',
      fields: [
        {
          key: 'dms_dirs_view',
          label: 'Shared directories',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 10,
            columns: [
              { id: 'path', label: 'Directory', mono: true, placeholder: '/mnt/...', validate: { required: true, maxLength: 128 } },
              {
                id: 'types',
                label: 'Content types',
                width: 120,
                placeholder: 'APV',
                validate: { required: true, pattern: '^[APV]{1,3}$', patternHint: 'Combination of A (Audio), P (Image), V (Video), e.g. APV' },
              },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_media',
    actionWait: 5,
    buildFields: (changed) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'dms_dirs_view') {
          const { dirs, types } = dmsDirsToStored(v);
          fields.dms_dir_x = dirs;
          fields.dms_dir_type_x = types;
        } else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'dms_dirs_view') {
          const { dirs, types } = dmsDirsToStored(v);
          expect.dms_dir_x = dirs;
          expect.dms_dir_type_x = types;
        } else expect[k] = v;
      }
      return expect;
    },
  },
};

// ---------------------------------------------------------------------------
// NFS Exports — Advanced_AiDisk_NFS.asp (Merlin-only)
// ---------------------------------------------------------------------------

export const nfsPage: SettingsPageDef = {
  kind: 'settings',
  id: 'nfs',
  aspPage: 'Advanced_AiDisk_NFS.asp',
  title: 'NFS File Sharing',
  navGroup: 'usb',
  navOrder: 53,
  merlinOnly: true,
  // Mirrors require/menuTrees/menuTree.js tabs(): `if (!nfsd_support)
  // retArray.push("Advanced_AiDisk_NFS.asp")` hides the tab from nav. The
  // page itself still serves over direct navigation regardless of the flag
  // (confirmed live: nfsd_support read 0 on the operator's RT-BE92U and the
  // page rendered normally) — gating here only affects nav visibility, same
  // as the native menu.
  gate: (c) => hasFlag(c, 'nfsd_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  read: {
    nvram: ['nfsd_enable', 'nfsd_enable_v2'],
    nvramAscii: ['nfsd_exportlist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'nfsd_enable', label: 'Enable NFSD', control: 'radio', options: yesNo },
        {
          key: 'nfsd_enable_v2',
          label: 'Enable legacy (NFS v2) support',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.nfsd_enable === '1',
        },
      ],
    },
    {
      title: 'Exported filesystems',
      note: 'Access list: space-separated hosts, or a subnet like 192.168.1.0/24, or * for any host. Options: comma-separated NFS export options. Max 32 entries.',
      showIf: (v) => v.nfsd_enable === '1',
      fields: [
        {
          key: 'nfsd_exportlist',
          label: 'Exported filesystems',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 32,
            columns: [
              { id: 'path', label: 'Path', mono: true, placeholder: '/mnt/...', validate: { required: true, maxLength: 128 } },
              { id: 'accesslist', label: 'Access list', mono: true, placeholder: '*', validate: { maxLength: 128 } },
              { id: 'options', label: 'Options', mono: true, validate: { maxLength: 64 } },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_nasapps',
    actionWait: 5,
  },
};

export const usbPages: SettingsPageDef[] = [sambaPage, ftpPage, mediaserverPage, nfsPage];
