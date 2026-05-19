/**
 * RapideTicketSettings — SDK configuration helpers
 *
 * Full port of Flutter rapide_ticket_settings.dart / rapide_ticket_defaults.dart
 *
 * Usage:
 *   const settings = RapideTicketSettings.simple({ projectId: 'fad_xxxx' });
 *   const settings = RapideTicketSettings.simple({
 *     projectId: 'fad_xxxx',
 *     oauthScheme: 'myapp',
 *     flavor: 'staging',
 *   });
 */

const HOSTED_API_BASE_URL    = 'https://api.flutteradgents.com';
const DEFAULT_OAUTH_SCHEME   = 'rapideticket';
const DEFAULT_OAUTH_PATH     = 'oauth';
const DEFAULT_FLAVOR         = 'production';

/** Client platform — mirrors Flutter RapideTicketClientPlatform enum */
export type ClientPlatform = 'WEB' | 'ANDROID' | 'IOS' | 'DESKTOP' | 'EMBEDDED';

/** Auto-detects platform from the RN runtime */
export function detectClientPlatform(): ClientPlatform {
  try {
    const { Platform } = require('react-native');
    if (Platform.OS === 'ios')     return 'IOS';
    if (Platform.OS === 'android') return 'ANDROID';
    if (Platform.OS === 'web')     return 'WEB';
    return 'DESKTOP';
  } catch {
    return 'EMBEDDED';
  }
}

export interface RapideTicketSettingsParams {
  /** Your project SDK key (fad_…) or UUID from the dashboard. Required. */
  projectId: string;
  /** Override the default hosted API URL (default: https://api.flutteradgents.com) */
  apiBaseUrl?: string;
  /** Force a client platform — auto-detected from Platform.OS if omitted */
  clientPlatform?: ClientPlatform;
  /** Flavor / build variant (e.g. 'staging'). Sent as `environment` on issues. */
  flavor?: string;
  /** Additional context appended to issue descriptions when different from flavor. */
  defaultEnvironment?: string;
  /**
   * OAuth deep-link return URI — sent as `returnUri` to the Atlassian OAuth flow.
   * On mobile: `{scheme}://{path}` (e.g. `myapp://oauth`)
   */
  oauthLoginReturnUri?: string;
  /**
   * Allow OAuth without an explicit returnUri (server uses its default URL).
   * Keep false in production.
   */
  allowOauthWithServerDefaultReturnUri?: boolean;
}

export class RapideTicketSettings {
  readonly projectId:     string;
  readonly apiBaseUrl:    string;
  readonly clientPlatform?: ClientPlatform;
  readonly flavor?:       string;
  readonly defaultEnvironment?: string;
  readonly oauthLoginReturnUri?: string;
  readonly allowOauthWithServerDefaultReturnUri: boolean;

  constructor(params: RapideTicketSettingsParams) {
    const projectId = RapideTicketSettings.normalizeProjectId(params.projectId);
    const err = RapideTicketSettings.projectIdValidationMessage(projectId);
    if (err) throw new Error(`[RapideTicket] Invalid projectId: ${err}`);

    this.projectId    = projectId;
    this.apiBaseUrl   = (params.apiBaseUrl ?? HOSTED_API_BASE_URL).replace(/\/+$/, '');
    this.clientPlatform = params.clientPlatform;
    this.flavor       = params.flavor?.trim() || DEFAULT_FLAVOR;
    this.defaultEnvironment = params.defaultEnvironment?.trim() || undefined;
    this.oauthLoginReturnUri = params.oauthLoginReturnUri?.trim() || undefined;
    this.allowOauthWithServerDefaultReturnUri =
      params.allowOauthWithServerDefaultReturnUri ?? false;
  }

  /**
   * Minimal factory — mirrors Flutter RapideTicketSettings.simple().
   * Auto-detects platform and builds the OAuth deep-link from the scheme.
   */
  static simple(params: {
    projectId: string;
    oauthScheme?: string;
    flavor?: string;
    apiBaseUrl?: string;
  }): RapideTicketSettings {
    const scheme = params.oauthScheme?.trim() || DEFAULT_OAUTH_SCHEME;
    const returnUri = RapideTicketSettings.buildOauthDeepLink({
      scheme,
      path: DEFAULT_OAUTH_PATH,
    });
    return new RapideTicketSettings({
      projectId: params.projectId,
      apiBaseUrl: params.apiBaseUrl,
      flavor: params.flavor,
      oauthLoginReturnUri: returnUri,
    });
  }

  /**
   * Builds the native OAuth return URL: `{scheme}://{path}`
   * Mirrors Flutter RapideTicketSettings.buildOauthDeepLink()
   */
  static buildOauthDeepLink(params: { scheme: string; path?: string }): string {
    const s = params.scheme.trim();
    const p = (params.path ?? DEFAULT_OAUTH_PATH).trim().replace(/^\/+/, '');
    if (!s) throw new Error('[RapideTicket] OAuth scheme cannot be empty.');
    if (!p) throw new Error('[RapideTicket] OAuth path cannot be empty.');
    return `${s}://${p}`;
  }

  /** Trims and collapses internal whitespace from projectId */
  static normalizeProjectId(projectId: string): string {
    return projectId.trim().replace(/\s+/g, '');
  }

  /**
   * Returns a validation message if the projectId is invalid, otherwise null.
   * Mirrors Flutter RapideTicketSettings.projectIdValidationMessage()
   */
  static projectIdValidationMessage(projectId?: string | null): string | null {
    if (!RapideTicketSettings.normalizeProjectId(projectId ?? '')) {
      return 'Enter a project ID: your SDK key (fad_…) or project UUID from the dashboard.';
    }
    return null;
  }

  /** True when projectId can be passed to simple() without throwing */
  static isValidProjectId(projectId?: string | null): boolean {
    return RapideTicketSettings.projectIdValidationMessage(projectId) === null;
  }

  /** Default hosted API base URL */
  static get defaultApiBaseUrl(): string {
    return HOSTED_API_BASE_URL;
  }

  /** Returns a copy with overridden fields */
  copyWith(params: Partial<RapideTicketSettingsParams>): RapideTicketSettings {
    return new RapideTicketSettings({
      projectId:     params.projectId     ?? this.projectId,
      apiBaseUrl:    params.apiBaseUrl    ?? this.apiBaseUrl,
      clientPlatform: params.clientPlatform ?? this.clientPlatform,
      flavor:        params.flavor        ?? this.flavor,
      defaultEnvironment: params.defaultEnvironment ?? this.defaultEnvironment,
      oauthLoginReturnUri: params.oauthLoginReturnUri ?? this.oauthLoginReturnUri,
      allowOauthWithServerDefaultReturnUri:
        params.allowOauthWithServerDefaultReturnUri
        ?? this.allowOauthWithServerDefaultReturnUri,
    });
  }
}
