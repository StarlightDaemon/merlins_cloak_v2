/**
 * USB category: Network Place (Samba), FTP Share, Media Server, NFS Exports,
 * Time Machine, and a read-only USB-apps (Download Master) status surface.
 * Field sets, validation bounds, and action_script values extracted from the
 * corresponding pages in the Merlin 3006.102.7_2 www/ source (RAW/merlin). No
 * RT-BE92U sysdep overlay exists for any of them. Time Machine / accounts /
 * Download Master scoping decisions below are from
 * scratchpad/research/04-usb-trio.md (the "USB-domain trio" brief).
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
 * Per-user/per-group share permissions (Network Place + FTP) — the WRITE side
 * remains DESCOPED, fully out of scope, no write path added for it here. The
 * trio brief (§A) traced this down to six dedicated /aidisk/*.asp cgi
 * endpoints (create_account.asp, delete_account.asp, modify_account.asp,
 * initial_account.asp, set_account_permission.asp,
 * set_account_all_folder_permission.asp; + set_group_* under
 * RTCONFIG_PERMISSION_MANAGEMENT), none of which is `action_mode=apply` /
 * `applyapp.cgi` at all — this project's WriteSpec (lib/router-io.ts
 * WriteEndpoint) only knows how to submit 'applyapp' and 'start_apply', so
 * these writes cannot be expressed without editing that shared file, which
 * is out of bounds for this change; extending it to cover these six
 * endpoints is deliberately left for a separate, reviewed pass. The READ
 * side, however, is now modeled: see ./usb-accounts.tsx (usbAccountPages),
 * a read-only custom page rendering the account list (get_all_accounts) and
 * a best-effort, defensively-parsed per-account/pool/folder/protocol
 * permission table (get_permissions_of_account, which emits embedded JS
 * source rather than JSON, per the brief) — full detail, including the
 * exact permission-integer semantics table and why no write path exists, is
 * in that file's header comment. The account/pool/folder-keyed CRUD shape
 * still doesn't fit this project's flat nvram-field SettingsPageDef model,
 * which is why the read surface is a CustomPageDef rather than an addition
 * to this file. `acc_list`/`acc_num` ARE literal defaults.c entries
 * (shared/defaults.c:3402-3406) but must NEVER be posted directly through
 * applyapp — the brief confirms their true backing store is partly opaque
 * on-disk `.__*` files on the USB filesystem itself (written by
 * closed-source `add_account`/`mod_account`/`del_account`, no definitions
 * anywhere in this GPL tree), so a raw nvram write would very likely desync
 * nvram from that on-disk state with no way to detect or roll it back. The
 * account-vs-share management-mode selector (st_samba_mode / st_ftp_mode,
 * toggled via switch_share_mode.asp) that gates this subsystem is skipped
 * for the same reasons.
 *
 * Time Machine (Advanced_TimeMachine.asp) — see timemachinePage below. Clean
 * fit: all four posted fields are literal defaults.c entries reached through
 * the ordinary applyapp path (trio brief §B).
 *
 * Download Master / USB Apps status (APP_Installation.asp) — see
 * downloadMasterPage below. READ-ONLY: the install/remove/enable/upgrade/
 * switch action path (`apps_action`, trio brief §C) is a self-posting cgi
 * hook embedded in APP_Installation.asp itself — POST /APP_Installation.asp
 * with apps_action/apps_name/apps_flag, again not 'applyapp' or
 * 'start_apply' — so like §A it cannot be expressed through the existing
 * WriteSpec without editing lib/router-io.ts, which this change does not do.
 * It would also shell out via `notify_rc("start_apps_<action> <name> <flag>")`
 * with both `apps_name` and `apps_flag` gated only by the closed-source,
 * per-board `check_cmd_whitelist()` (compiled into per-board
 * httpd/prebuild/<MODEL>/web_hook.o, no source in this GPL tree) — materially
 * higher blast radius than a
 * settings toggle. Download Master's actual torrent/queue UI is a wholly
 * separate web app on its own port (dm_http_port, default 8081, not even an
 * nvram-configurable key from this page) that httpd never proxies into or
 * reads from — entirely out of reach from here regardless.
 *
 * Advanced_AiDisk_NFS.asp is Merlin-only and is in the operator's
 * live-verified page list; the other three (samba/ftp/mediaserver) are
 * structural (source-derived, not exercised live this session), as is
 * Time Machine and the Download Master status page.
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

// ---------------------------------------------------------------------------
// Time Machine — Advanced_TimeMachine.asp
// ---------------------------------------------------------------------------

/**
 * All four fields are literal defaults.c entries, shared/defaults.c:4507-4511,
 * gated behind #ifdef RTCONFIG_TIMEMACHINE (:4506):
 *   { "timemachine_enable", "0", ... }
 *   { "tm_device_name", "", CKN_STR64, ... }
 *   { "tm_vol_size", "0", CKN_STR8, ... }
 *   { "tm_ui_setting", "0", ... }
 * (tm_partition_num also exists at defaults.c:4510 but is read-only/internal —
 * not a field on the native form, not modeled here.)
 *
 * tm_device_name is the raw partition DEVICE LEAF NAME (e.g. "sda1"), not a
 * mount path (Advanced_TimeMachine.asp:163-172 setPart(); cross-checked
 * against ej_get_usb_info's isTM/hasTM match on nvram_match("tm_device_name",
 * follow_partition->device), web.c:11364-11371). The native page populates
 * this from a live folderTree_panel partition picker fed by ej_get_usb_info
 * (web.c:11270); this project's declarative renderer has no live
 * disk/partition enumeration widget, so the field is modeled as plain text —
 * the operator must type the device leaf name exactly as shown by the
 * router's own USB/disk page. Documented limitation, not a bug.
 *
 * tm_vol_size is transmitted in KB (native page multiplies its displayed GB
 * value by 1024 before submit, Advanced_TimeMachine.asp:183); 0 = unlimited.
 * Its true bound ([0, free space on the selected partition in GB]) is
 * dynamic and disk-dependent, enforced only client-side on the native page
 * (validator.rangeAllowZero, :180) — grepped validate_apply/validate_instance
 * for tm_vol_size/tm_device_name/timemachine_enable and found no server-side
 * range logic, only the generic CKN_STR8 length cap. This field is modeled
 * as the raw KB value with no unit conversion; the operator enters KB
 * directly, and no fixed max is enforced here (matches several other
 * usb.ts fields whose true bound is native-JS-only, not httpd-enforced).
 *
 * tm_ui_setting is hardcoded to "1" on every native submit
 * (Advanced_TimeMachine.asp:185) regardless of which field actually changed —
 * it reads as a "has the operator touched Time Machine settings via the UI"
 * marker, not a meaningful option (no form control sets it to anything
 * else). Modeled here as a read-only display field; buildFields/buildVerify
 * below force it to '1' on every write this page issues, matching native
 * behavior exactly rather than leaving it unset.
 */
export const timemachinePage: SettingsPageDef = {
  kind: 'settings',
  id: 'timemachine',
  aspPage: 'Advanced_TimeMachine.asp',
  title: 'Time Machine',
  navGroup: 'usb',
  navOrder: 55,
  // timemachine_support reflects RTCONFIG_TIMEMACHINE (www/state.js:630);
  // APP_Installation.asp:162-165 hides the Time Machine tile entirely when
  // false. Mirrors nfsPage's gate on nfsd_support.
  gate: (c) => hasFlag(c, 'timemachine_support'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Disk/partition selection has no live picker here — enter the exact partition device leaf name (e.g. sda1) as shown on the router\'s own USB/disk page. Quota is entered in KB; the native page converts from GB before submit, this page does not.',
  read: {
    nvram: ['timemachine_enable', 'tm_device_name', 'tm_vol_size', 'tm_ui_setting'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'timemachine_enable', label: 'Enable Time Machine backup target', control: 'radio', options: yesNo },
        {
          key: 'tm_device_name',
          label: 'Partition device name',
          hint: 'Raw device leaf name (e.g. sda1), not a mount path — no live partition picker; see intro',
          control: 'text',
          // The alphanumeric-only pattern is a SECURITY boundary, not just a
          // format hint. rc-source research (RC_SOURCE_FINDINGS.md §5;
          // RAW/merlin-rc rc/timemachine.c find_mountpoint ~298-325) found the
          // firmware builds the AFP share path as "/tmp/mnt/<tm_device_name>"
          // with NO path-traversal guard of its own — the only gate is a
          // check_if_dir_exist() whose body ships closed-source. A value like
          // "../../jffs" that resolved to a real directory would be shared.
          // This charset (which fully covers real Linux block-device leaf
          // names like sda1) makes such a value impossible to construct here,
          // so the extension can never originate that payload regardless of
          // read-only mode. Do not loosen it to add '/' or '.'.
          validate: { maxLength: 64, pattern: '^[a-zA-Z0-9]*$', patternHint: 'Device leaf name, e.g. sda1' },
          showIf: (v) => v.timemachine_enable === '1',
        },
        {
          key: 'tm_vol_size',
          label: 'Quota (KB)',
          hint: '0 = unlimited. Native page enters this in GB and multiplies by 1024 before submit; this field is the raw KB value. True upper bound is the selected partition\'s free space, enforced only by the native page\'s own JS — not reproduced here.',
          control: 'number',
          validate: { min: 0, required: true },
          showIf: (v) => v.timemachine_enable === '1',
        },
        {
          key: 'tm_ui_setting',
          label: 'UI-touched marker (tm_ui_setting)',
          hint: 'Not operator-editable — the native page always resubmits this as 1 on every save regardless of which field changed, and so does this one',
          control: 'readonly',
          showIf: (v) => v.timemachine_enable === '1',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_timemachine',
    actionWait: 5,
    buildFields: (changed) => ({ ...changed, tm_ui_setting: '1' }),
    buildVerify: (changed) => ({ ...changed, tm_ui_setting: '1' }),
  },
};

// ---------------------------------------------------------------------------
// Download Master / USB Apps status — APP_Installation.asp (READ-ONLY)
// ---------------------------------------------------------------------------

/**
 * Status-only surface. The install/remove/enable/upgrade/switch action path
 * (apps_action) is NOT modeled — see the file header comment for why (it's a
 * dedicated self-posting cgi endpoint this project's WriteSpec cannot express
 * without editing lib/router-io.ts, gated only by a closed-source per-board
 * whitelist). Every field below is a literal defaults.c entry
 * (shared/defaults.c:7058-7074, ungated by any #ifdef in that region),
 * written only by the router's own (opaque, external) app-management scripts
 * as actions progress — never modeled as writable here, deliberately.
 *
 * The numeric apps_state_* codes' meaning (pending/running/done/error?) is
 * NOT confirmed from source — no enum found in this GPL tree, only bare
 * integer comparisons in APP_Installation.asp's own JS — so raw values are
 * shown as-is rather than translated to a label that might be wrong.
 */
export const downloadMasterPage: SettingsPageDef = {
  kind: 'settings',
  id: 'download-master',
  aspPage: 'APP_Installation.asp',
  title: 'Download Master / USB Apps (status)',
  navGroup: 'usb',
  navOrder: 56,
  confidence: { read: 'structural' },
  // No write path ships for this page (see file header + comment above);
  // null only documents "nothing hard-excluded", not "a write exists".
  writeExclusion: null,
  intro:
    'Read-only. Install/remove/enable actions for Download Master and other USB apps are not modeled here (dedicated self-posting cgi endpoint, closed-source command whitelist — see source comment). Download Master\'s own torrent/queue UI runs on a separate port (commonly 8081) that this router UI never reaches.',
  read: {
    nvram: [
      'apps_dev',
      'apps_mounted_path',
      'apps_state_install',
      'apps_state_upgrade',
      'apps_state_update',
      'apps_state_remove',
      'apps_state_enable',
      'apps_state_switch',
      'apps_state_autorun',
      'apps_state_error',
      'apps_download_file',
      'apps_download_percent',
      'apps_depend_do',
      'apps_depend_action',
      'apps_depend_action_target',
    ],
  },
  sections: [
    {
      title: 'App-storage target',
      fields: [
        { key: 'apps_dev', label: 'Active app-storage partition (apps_dev)', control: 'readonly' },
        { key: 'apps_mounted_path', label: 'App-storage mount path', control: 'readonly' },
      ],
    },
    {
      title: 'Action state (raw codes — meaning not confirmed from source)',
      fields: [
        { key: 'apps_state_install', label: 'Install state', control: 'readonly' },
        { key: 'apps_state_upgrade', label: 'Upgrade state', control: 'readonly' },
        { key: 'apps_state_update', label: 'Update-check state', control: 'readonly' },
        { key: 'apps_state_remove', label: 'Remove state', control: 'readonly' },
        { key: 'apps_state_enable', label: 'Enable/disable state', control: 'readonly' },
        { key: 'apps_state_switch', label: 'Storage-switch state', control: 'readonly' },
        { key: 'apps_state_autorun', label: 'Autorun state', control: 'readonly' },
        { key: 'apps_state_error', label: 'Last error code', control: 'readonly' },
      ],
    },
    {
      title: 'Download / dependency progress',
      fields: [
        { key: 'apps_download_file', label: 'Current download file', control: 'readonly' },
        { key: 'apps_download_percent', label: 'Download progress (%)', control: 'readonly' },
        { key: 'apps_depend_do', label: 'Dependency action in progress', control: 'readonly' },
        { key: 'apps_depend_action', label: 'Dependency action', control: 'readonly' },
        { key: 'apps_depend_action_target', label: 'Dependency action target', control: 'readonly' },
      ],
    },
  ],
};

export const usbPages: SettingsPageDef[] = [
  sambaPage,
  ftpPage,
  mediaserverPage,
  nfsPage,
  timemachinePage,
  downloadMasterPage,
];
