/**
 * useOAuthDeepLink — Atlassian OAuth deep-link listener
 *
 * Mirrors Flutter RapideTicketOAuthReturnListener:
 *   - Listens to incoming deep-links (react-native-linking)
 *   - Extracts `?oauth_exchange=<code>` or `?oauth_error=<msg>`
 *   - Calls RapideTicketAPIClient.signInWithOAuthCode()
 *   - Fires onSuccess / onError callbacks
 *
 * Usage — mount once at app root (inside RapideTicketProvider):
 *
 *   useOAuthDeepLink(client, {
 *     onSuccess: () => console.log('Signed in with Atlassian'),
 *     onError: (msg) => Alert.alert('OAuth error', msg),
 *   });
 *
 * iOS:  register your URL scheme in Info.plist + Xcode URL Types
 * Android: add <intent-filter> in AndroidManifest.xml for your scheme
 */

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { RapideTicketAPIClient } from '../services/RapideTicketAPIClient';

export interface OAuthDeepLinkOptions {
  /** Called when OAuth code was exchanged successfully */
  onSuccess?: (accessToken: string) => void;
  /** Called when oauth_error param is present or exchange fails */
  onError?: (message: string) => void;
  /** Optional invite token forwarded to the exchange endpoint */
  inviteToken?: string;
}

/** Extracts oauth_exchange / oauth_error params from a deep-link URL */
function parseOAuthUrl(url: string): { code?: string; error?: string } {
  try {
    const parsed = new URL(url);
    const code  = parsed.searchParams.get('oauth_exchange') ?? undefined;
    const error = parsed.searchParams.get('oauth_error')    ?? undefined;
    return { code, error };
  } catch {
    // Fallback: simple regex for URLs without a base (e.g. myapp://oauth?...)
    const codeMatch  = url.match(/[?&]oauth_exchange=([^&]+)/);
    const errorMatch = url.match(/[?&]oauth_error=([^&]+)/);
    return {
      code:  codeMatch  ? decodeURIComponent(codeMatch[1])  : undefined,
      error: errorMatch ? decodeURIComponent(errorMatch[1]) : undefined,
    };
  }
}

export function useOAuthDeepLink(
  client: RapideTicketAPIClient,
  opts: OAuthDeepLinkOptions = {},
): void {
  const { onSuccess, onError, inviteToken } = opts;
  const lastConsumedCode = useRef<string | null>(null);

  const handleUrl = async (url: string | null) => {
    if (!url) return;
    const { code, error } = parseOAuthUrl(url);

    if (code && code === lastConsumedCode.current) return; // dedup

    if (error) {
      onError?.(`OAuth: ${decodeURIComponent(error)}`);
      return;
    }

    if (code) {
      try {
        await client.signInWithOAuthCode(code, inviteToken);
        lastConsumedCode.current = code;
        const token = await import('../services/AuthService').then((m) => m.AuthService.getToken());
        onSuccess?.(token ?? '');
      } catch (e: any) {
        onError?.(e?.message ?? 'OAuth exchange failed');
      }
    }
  };

  useEffect(() => {
    // Handle deep link that launched the app (cold start)
    Linking.getInitialURL().then((url) => handleUrl(url));

    // Handle deep links while app is foregrounded
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [client, inviteToken]);
}
