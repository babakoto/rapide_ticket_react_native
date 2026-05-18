import * as Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'rapide_ticket';
const KEYCHAIN_USER = 'rapide_ticket_user';
const REFRESH_TOKEN_SERVICE = 'rapide_ticket_refresh';

const DEFAULT_API_BASE_URL = 'https://api.flutteradgents.com';

export interface AuthPayload {
  token: string;
  refreshToken?: string;
  jiraAccountId?: string;
}

/**
 * Manages JWT + refresh token for rapide_ticket authentication.
 * Mirrors Flutter SDK's RapideTicketSession behavior.
 */
export class AuthService {
  // --- Token storage ---

  static async setToken(token: string): Promise<void> {
    await Keychain.setGenericPassword(KEYCHAIN_USER, token, {
      service: KEYCHAIN_SERVICE,
    });
  }

  static async getToken(): Promise<string | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      return creds ? creds.password : null;
    } catch {
      return null;
    }
  }

  static async setRefreshToken(refreshToken: string): Promise<void> {
    await Keychain.setGenericPassword(KEYCHAIN_USER, refreshToken, {
      service: REFRESH_TOKEN_SERVICE,
    });
  }

  static async getRefreshToken(): Promise<string | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_SERVICE });
      return creds ? creds.password : null;
    } catch {
      return null;
    }
  }

  static async clearToken(): Promise<void> {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
  }

  // --- Auth API calls ---

  /**
   * POST /api/v1/auth/login
   * Stores token + refreshToken in Keychain.
   */
  static async signIn(
    email: string,
    password: string,
    apiBaseUrl = DEFAULT_API_BASE_URL,
  ): Promise<AuthPayload> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || `Login failed (HTTP ${res.status})`);
    }

    const data: AuthPayload = await res.json();
    await AuthService.setToken(data.token);
    if (data.refreshToken) {
      await AuthService.setRefreshToken(data.refreshToken);
    }
    return data;
  }

  /**
   * POST /api/v1/auth/refresh
   * Renews the JWT using the stored refresh token.
   */
  static async refreshAccessToken(apiBaseUrl = DEFAULT_API_BASE_URL): Promise<string> {
    const refreshToken = await AuthService.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Session expired — please sign in again.');
    }

    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/auth/refresh`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || `Token refresh failed (HTTP ${res.status})`);
    }

    const data: AuthPayload = await res.json();
    await AuthService.setToken(data.token);
    if (data.refreshToken) {
      await AuthService.setRefreshToken(data.refreshToken);
    }
    return data.token;
  }

  /**
   * GET /api/v1/auth/oauth/atlassian/authorization-url
   * Returns the Atlassian OAuth URL to open in a browser.
   */
  static async getAtlassianAuthorizationUrl(
    params: {
      projectId?: string;
      returnUri?: string;
      inviteToken?: string;
    },
    apiBaseUrl = DEFAULT_API_BASE_URL,
  ): Promise<{ authorizationUrl: string | null; configured: boolean }> {
    const base = apiBaseUrl.replace(/\/+$/, '');
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.returnUri) query.set('returnUri', params.returnUri);
    if (params.inviteToken) query.set('inviteToken', params.inviteToken);

    const url = `${base}/api/v1/auth/oauth/atlassian/authorization-url?${query}`;
    const res = await fetch(url);

    if (!res.ok) return { authorizationUrl: null, configured: false };

    const data = await res.json();
    return {
      authorizationUrl: typeof data?.authorizationUrl === 'string'
        ? data.authorizationUrl
        : null,
      configured: data?.configured === true,
    };
  }

  /**
   * POST /api/v1/auth/oauth/atlassian/exchange
   * Exchange OAuth code for JWT after redirect.
   */
  static async signInWithOAuthCode(
    code: string,
    apiBaseUrl = DEFAULT_API_BASE_URL,
  ): Promise<AuthPayload> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/auth/oauth/atlassian/exchange`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || `OAuth exchange failed (HTTP ${res.status})`);
    }

    const data: AuthPayload = await res.json();
    await AuthService.setToken(data.token);
    if (data.refreshToken) {
      await AuthService.setRefreshToken(data.refreshToken);
    }
    return data;
  }

  static async signOut(): Promise<void> {
    await AuthService.clearToken();
  }
}
