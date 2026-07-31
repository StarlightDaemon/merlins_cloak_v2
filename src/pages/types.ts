/**
 * The page-definition contract. Every view in the rebuilt UI is either a
 * declarative SettingsPageDef rendered by the generic renderer, or a custom
 * component page. Both carry the same metadata: capability gating, source
 * page identity, and a per-page confidence record surfaced in diagnostics.
 */
import type { ComponentType } from 'react';
import type { Capabilities } from '../lib/capabilities';
import type { WriteEndpoint } from '../lib/router-io';
import type { WriteExclusionCategory } from '../lib/write-policy';

/**
 * Diagnostics confidence tiers, per the project's verification history:
 *  - 'live-verified': confirmed against the operator's RT-BE92U
 *    (docs/LIVE_PROBE_RT-BE92U.md / docs/WRITE_PATH_CHARACTERIZATION.md, or
 *    verified live during this build session).
 *  - 'structural': sourced from firmware source analysis (the static diffs),
 *    not yet exercised against live hardware.
 *  - 'unverified-write': write path is implemented but has never been
 *    live-submitted (all hard-excluded categories are permanently this tier
 *    until a dedicated human-supervised session clears them).
 */
export type Confidence = 'live-verified' | 'structural' | 'unverified-write';

/**
 * Hard-excluded live-write categories. The vocabulary and the enforcement
 * predicate live together in lib/write-policy.ts — this tag is not merely
 * diagnostic: the five hard-excluded categories are refused at the write
 * chokepoint (lib/write-guard.ts) regardless of read-only mode.
 */
export type { WriteExclusionCategory };

export interface FieldOption {
  value: string;
  label: string;
  /** Omit this option unless the predicate holds — mirrors InstanceSelector's gate. */
  gate?: (caps: Capabilities) => boolean;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  patternHint?: string;
  required?: boolean;
}

export type FieldControl =
  | 'text'
  | 'password'
  | 'number'
  | 'select'
  | 'radio' // enumerated options as a segmented control
  | 'toggle' // '1'/'0' nvram boolean
  | 'textarea'
  | 'readonly'
  | 'list'; // '<'-delimited nvram rule list, edited as a table (spec in FieldDef.list)

/** One column of a rule-list field (see lib/rulelist.ts for the encoding). */
export interface ListColumn {
  id: string;
  label: string;
  control?: 'text' | 'select';
  options?: FieldOption[];
  validate?: FieldValidation;
  placeholder?: string;
  /** Fixed column width in px; unset = flexible. */
  width?: number;
  mono?: boolean;
}

export interface ListSpec {
  columns: ListColumn[];
  /** Record separator; default '<'. */
  recordSep?: string;
  /** Field separator; default '>'. */
  fieldSep?: string;
  /** Non-empty serialization starts with a leading recordSep; default true. */
  leadingSep?: boolean;
  /** Native UI's row cap where one is enforced (e.g. 64 for many lists). */
  maxRows?: number;
  addLabel?: string;
}

export interface FieldDef {
  /** nvram key (or composite form-field name for decomposed fields). */
  key: string;
  label: string;
  control: FieldControl;
  options?: FieldOption[];
  validate?: FieldValidation;
  /** Secondary line under the label. */
  hint?: string;
  /** Toggle/radio inverted sense: nvram '1' renders as OFF. */
  invert?: boolean;
  /** Only render when this returns true (values are CURRENT edited values). */
  showIf?: (values: Record<string, string>, caps: Capabilities) => boolean;
  /** Read via nvram_char_to_ascii instead of nvram_get (free-text fields). */
  ascii?: boolean;
  /** Rule-list table spec; required when control === 'list'. */
  list?: ListSpec;
}

export interface SectionDef {
  title?: string;
  note?: string;
  fields: FieldDef[];
  showIf?: (values: Record<string, string>, caps: Capabilities) => boolean;
}

export interface WriteDef {
  /**
   * Preferred endpoint. 'applyapp' for plain router_defaults nvram fields
   * (delta-capable, live-validated); 'start_apply' where whole-page form
   * semantics are required.
   */
  endpoint: WriteEndpoint;
  /**
   * Service restart directive (rc_service / action_script value). Either a
   * fixed string, or a resolver `(changed, all) => string | undefined` — same
   * shape as buildFields/buildVerify — for the services where native firmware
   * branches this by enable/disable direction instead of issuing one static
   * action regardless of direction (OpenVPN server, PPTP, and IPSec; see
   * their page defs in vpn-server.ts / ipsec.ts for exact firmware
   * citations). WireGuard server is confirmed static-restart natively
   * (Advanced_WireguardServer_Content.asp ~111) and stays a plain string.
   * The resolver receives `all`, the full current edited value set (i.e. the
   * resulting/new state after this Apply), not just `changed` — matching how
   * native re-derives its action_script from current DOM/form state on every
   * submit rather than from only the field that was just edited.
   */
  rcService?: string | ((changed: Record<string, string>, all: Record<string, string>) => string | undefined);
  /**
   * The native page's own client-side wait for this operation, in seconds.
   * Sent as `action_wait` on start_apply, and on BOTH endpoints it governs how
   * long the verifier settles before its first forced-fresh confirmation read
   * (lib/write-policy.ts confirmWindow). Omit where the operation is effectively
   * immediate — the verifier then reads straight away.
   */
  actionWait?: number;
  /**
   * Per-path override for the confirmation ceiling, in ms. Normally omit: the
   * ceiling is derived from `actionWait` and the page's `writeExclusion` tag.
   * Confirmation timing only — it changes nothing about the submitted request.
   */
  confirmTimeoutMs?: number;
  /**
   * Override payload construction. Receives changed fields and all current
   * values; returns the exact field map to submit. Used for joined+decomposed
   * dual representation (ct_tcp_timeout pattern) and similar.
   */
  buildFields?: (changed: Record<string, string>, all: Record<string, string>) => Record<string, string>;
  /**
   * Override verify expectations. Defaults to the changed nvram fields
   * verbatim. Return null to skip nvram verification (non-nvram actions).
   */
  buildVerify?: (changed: Record<string, string>, all: Record<string, string>) => Record<string, string> | null;
  /**
   * Posted keys (template form, '{p}' allowed) whose VALUES are secrets that
   * a `control: 'password'` marker cannot express — composite/serialized
   * carriers such as a username>password rule list or a joined string with a
   * passphrase inside. Keys of password-control fields are collected
   * automatically and need not be repeated here. Redaction only: values for
   * these keys are replaced with a placeholder in the console log, the
   * diagnostics write inspector, and stored verify detail — the submitted
   * request itself is untouched. See WriteSpec.sensitiveKeys.
   */
  sensitiveKeys?: string[];
}

export interface PageProps {
  caps: Capabilities;
}

export interface PageDefBase {
  /** Route id, e.g. 'wan' → #/wan */
  id: string;
  /** The native page this view replaces (diagnostics + deep-link mapping). */
  aspPage: string;
  title: string;
  /** Nav placement. */
  navGroup: string;
  /** Sub-header id within the nav group (see NavGroupDef.subs). Absent = flat group. */
  navSub?: string;
  /**
   * Position within the category/sub-header, following the proposal's global
   * numbering (docs/NAV_TAXONOMY_PROPOSAL.md §2) so order is checkable
   * against the document directly.
   */
  navOrder?: number;
  navLabel?: string;
  /** Gate: render only when capabilities allow. Absent = always. */
  gate?: (caps: Capabilities) => boolean;
  /** True when the page exists only on Merlin builds. */
  merlinOnly?: boolean;
  confidence: {
    read: Confidence;
    write?: Confidence;
  };
  writeExclusion?: WriteExclusionCategory;
  /**
   * Set when this page's feature requires Trend Micro / Asus EULA acceptance
   * before writes take effect (AiProtection, DPI, Adaptive QoS). The renderer
   * checks the named nvram keys and surfaces an explicit "requires EULA
   * acceptance" state instead of letting writes silently fail.
   */
  eulaGate?: { nvramKeys: string[]; label: string };
}

/**
 * Instance selector for pages that edit one of N parallel nvram families
 * (wireless bands wl0_/wl1_/wl2_, OpenVPN clients vpn_client1_…5_, WireGuard
 * wgc1_…wgc5_, …). Every occurrence of the literal token '{p}' in nvram keys,
 * field keys, and the write rcService is replaced with the selected option's
 * value. All def logic (showIf, derive, buildFields, buildVerify) operates on
 * the un-expanded template keys — expansion happens only at the I/O boundary.
 * Switching instances reloads the page's reads and discards unsaved edits
 * (matching the native UI's band/instance switch behavior).
 */
export interface InstanceSelector {
  label: string;
  options: { value: string; label: string; gate?: (caps: Capabilities) => boolean }[];
}

/** Declarative settings page rendered by SettingsPageRenderer. */
export interface SettingsPageDef extends PageDefBase {
  kind: 'settings';
  instance?: InstanceSelector;
  read: {
    nvram?: string[];
    /** Keys to read via nvram_char_to_ascii (merged over nvram reads). */
    nvramAscii?: string[];
    hooks?: string[];
    /**
     * Post-read transform: derive additional (virtual) field values from the
     * raw reads — e.g. decomposing a combined space-separated nvram string
     * into the individually-edited fields. Keys are template keys.
     */
    derive?: (raw: Record<string, string>, instance?: string) => Record<string, string>;
  };
  sections: SectionDef[];
  write?: WriteDef;
  intro?: string;
}

/** Fully custom page (dashboard, logs, traffic monitor, SDN, …). */
export interface CustomPageDef extends PageDefBase {
  kind: 'custom';
  component: ComponentType<PageProps>;
}

export type PageDef = SettingsPageDef | CustomPageDef;

/** One sub-header inside a nav group; pages reference it via navSub. */
export interface NavSubDef {
  id: string;
  label: string;
}

/**
 * A secondary nav placement for an existing page. The page keeps its single
 * navGroup as its only identity (diagnostics, deep-links, routing); an alias
 * just renders one extra nav entry elsewhere, merged into the
 * category-building step in the App.
 */
export interface NavAliasDef {
  pageId: string;
  navGroup: string;
  navSub?: string;
  /** Fractional slot placing the alias directly after its neighbor page. */
  navOrder: number;
}

/** Nav group ordering + labels. */
export interface NavGroupDef {
  id: string;
  label: string;
  /** Ordered two-level sub-headers; absent = flat category. */
  subs?: NavSubDef[];
  gate?: (caps: Capabilities) => boolean;
}
