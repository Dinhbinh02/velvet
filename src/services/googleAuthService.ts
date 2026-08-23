export const GOOGLE_OAUTH_CONFIG = {
  chromeClientId: '824888142961-qo2d2j9an9eeu07mmvg15qbb51cdi3n2.apps.googleusercontent.com',
  webAppClientId: '824888142961-kvaf5n0orp806qn9jedboi9frsmjlu6f.apps.googleusercontent.com',
};

const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export interface IGoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleAuthService {
  private static cachedToken: string | null = null;
  private static cachedUser: IGoogleUserInfo | null = null;

  /**
   * Detects whether running on pure Chrome vs other Chromium (Edge, Brave, Arc, Opera)
   */
  public static isStandardChrome(): boolean {
    if (typeof navigator === 'undefined') return true;
    const userAgent = navigator.userAgent.toLowerCase();
    // Edge (edg/), Opera (opr/), Vivaldi (vivaldi)
    const isOtherBrowser = userAgent.includes('edg/') || userAgent.includes('opr/') || userAgent.includes('vivaldi') || userAgent.includes('firefox');
    return !isOtherBrowser;
  }

  /**
   * Acquire Google OAuth access token with automatic fallback
   */
  public static async getAccessToken(interactive: boolean = true): Promise<string> {
    // 1. Try Native Chrome Identity first (Chrome natively manages token expiry & refresh)
    if (this.isStandardChrome() && chrome.identity && chrome.identity.getAuthToken) {
      try {
        const token = await new Promise<string>((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive }, (resToken: any) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (typeof resToken === 'string' && resToken) {
              resolve(resToken);
            } else if (resToken?.token) {
              resolve(resToken.token);
            } else {
              reject(new Error('No token returned from getAuthToken'));
            }
          });
        });

        if (token) {
          this.cachedToken = token;
          await chrome.storage.local.set({ velvet_google_token: token });
          return token;
        }
      } catch (chromeErr: any) {
        // If non-interactive failed, don't crash unless interactive was requested
        if (!interactive) {
          throw new Error('401_UNAUTHORIZED');
        }
        console.warn('Native getAuthToken failed, falling back to launchWebAuthFlow:', chromeErr);
      }
    }

    if (this.cachedToken) {
      return this.cachedToken;
    }

    // Check local storage for persistent token / session
    const stored = await chrome.storage.local.get(['velvet_google_token', 'velvet_google_user']);
    if (stored.velvet_google_token) {
      this.cachedToken = stored.velvet_google_token;
      if (stored.velvet_google_user) {
        this.cachedUser = stored.velvet_google_user;
      }
      return this.cachedToken!;
    }

    if (!interactive) {
      throw new Error('401_UNAUTHORIZED');
    }

    // 2. Fallback to Web App launchWebAuthFlow (for Edge and other browsers)
    try {
      const redirectUri = chrome.identity.getRedirectURL();
      const scopeString = encodeURIComponent(SCOPES.join(' '));
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_OAUTH_CONFIG.webAppClientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopeString}&prompt=select_account`;

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive,
      });

      if (!responseUrl) {
        throw new Error('Authentication flow cancelled or failed');
      }

      // Extract access_token from redirect url hash: #access_token=...&token_type=Bearer...
      const url = new URL(responseUrl);
      const params = new URLSearchParams(url.hash.substring(1));
      const token = params.get('access_token');

      if (!token) {
        throw new Error('Could not extract access_token from response URL');
      }

      this.cachedToken = token;
      await chrome.storage.local.set({ velvet_google_token: token });
      await this.fetchUserInfo(token);
      return token;
    } catch (err: any) {
      console.error('Google OAuth launchWebAuthFlow failed:', err);
      throw err;
    }
  }

  /**
   * Get user profile info from Google API
   */
  public static async fetchUserInfo(token?: string): Promise<IGoogleUserInfo | null> {
    try {
      const authToken = token || (await this.getAccessToken(false));
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired, clear cache
          await this.signOut();
        }
        return null;
      }

      const info: IGoogleUserInfo = await res.json();
      this.cachedUser = info;
      await chrome.storage.local.set({ velvet_google_user: info });
      return info;
    } catch (e) {
      console.warn('Failed to fetch user info:', e);
      return null;
    }
  }

  /**
   * Get cached user profile
   */
  public static async getCurrentUser(): Promise<IGoogleUserInfo | null> {
    if (this.cachedUser) return this.cachedUser;
    const stored = await chrome.storage.local.get('velvet_google_user');
    if (stored.velvet_google_user) {
      this.cachedUser = stored.velvet_google_user;
      return this.cachedUser;
    }
    return null;
  }

  /**
   * Invalidate cached token when Google returns 401 Unauthorized
   */
  public static async invalidateCachedToken(): Promise<void> {
    if (this.cachedToken) {
      try {
        if (chrome.identity && chrome.identity.removeCachedAuthToken) {
          await new Promise<void>((resolve) => {
            chrome.identity.removeCachedAuthToken({ token: this.cachedToken! }, () => resolve());
          });
        }
      } catch {}
    }
    this.cachedToken = null;
    await chrome.storage.local.remove(['velvet_google_token']);
  }

  /**
   * Sign out and clear stored token & user info
   */
  public static async signOut(): Promise<void> {
    if (this.cachedToken) {
      try {
        if (chrome.identity && chrome.identity.removeCachedAuthToken) {
          await new Promise<void>((resolve) => {
            chrome.identity.removeCachedAuthToken({ token: this.cachedToken! }, () => resolve());
          });
        }
        // Revoke token with Google endpoint
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${this.cachedToken}`, {
          method: 'POST',
        }).catch(() => {});
      } catch {}
    }

    this.cachedToken = null;
    this.cachedUser = null;
    await chrome.storage.local.remove(['velvet_google_token', 'velvet_google_user']);
  }
}
