/**
 * Supabase Client & Authentication Service for Velvet Web App
 */
import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

const STORAGE_KEY_SUPABASE_URL = 'velvet_supabase_url';
const STORAGE_KEY_SUPABASE_ANON_KEY = 'velvet_supabase_anon_key';
const STORAGE_KEY_R2_CONFIG = 'velvet_r2_config';

export interface IR2Config {
  accountId: string;
  bucketName: string;
  publicDomain?: string; // Optional custom/public domain for R2 bucket
  workerUrl?: string; // Cloudflare Worker endpoint for pre-signed upload URLs
}

export interface ISupabaseConfig {
  url: string;
  anonKey: string;
}

export class SupabaseService {
  private static client: SupabaseClient | null = null;
  private static cachedConfig: ISupabaseConfig | null = null;
  private static initPromise: Promise<SupabaseClient | null> | null = null;

  /**
   * Get configured Supabase URL & Anon Key
   */
  public static async getConfig(): Promise<ISupabaseConfig | null> {
    if (this.cachedConfig) return this.cachedConfig;

    const env = (import.meta as any).env || {};
    const url = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || (env.VITE_SUPABASE_URL as string) || '';
    const anonKey = localStorage.getItem(STORAGE_KEY_SUPABASE_ANON_KEY) || (env.VITE_SUPABASE_ANON_KEY as string) || '';

    if (url && anonKey) {
      this.cachedConfig = { url, anonKey };
      return this.cachedConfig;
    }
    return null;
  }

  /**
   * Save Supabase URL & Anon Key
   */
  public static async saveConfig(url: string, anonKey: string): Promise<void> {
    this.cachedConfig = { url: url.trim(), anonKey: anonKey.trim() };
    this.client = null; // reset client
    this.initPromise = null;

    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, this.cachedConfig.url);
    localStorage.setItem(STORAGE_KEY_SUPABASE_ANON_KEY, this.cachedConfig.anonKey);
  }

  /**
   * Get or initialize Supabase Client singleton
   */
  public static async getClient(): Promise<SupabaseClient | null> {
    if (this.client) return this.client;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const config = await this.getConfig();
      if (!config) return null;

      if (!this.client) {
        this.client = createClient(config.url, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      }

      return this.client;
    })();

    return this.initPromise;
  }

  /**
   * Get current authenticated user
   */
  public static async getCurrentUser(): Promise<User | null> {
    const client = await this.getClient();
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    return session?.user || null;
  }

  /**
   * Get current session
   */
  public static async getSession(): Promise<Session | null> {
    const client = await this.getClient();
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    return session;
  }

  /**
   * Sign in with Google OAuth (Web redirect supported)
   */
  public static async signInWithGoogle(): Promise<{ error: any }> {
    const client = await this.getClient();
    if (!client) throw new Error('Supabase is not configured. Please enter your Supabase URL & Key.');

    const redirectTo = window.location.origin;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    return { error };
  }

  /**
   * Sign in with Email & Password
   */
  public static async signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: any }> {
    const client = await this.getClient();
    if (!client) throw new Error('Supabase is not configured.');

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    return { user: data.user, error };
  }

  /**
   * Sign up with Email & Password
   */
  public static async signUpWithEmail(email: string, password: string): Promise<{ user: User | null; error: any }> {
    const client = await this.getClient();
    if (!client) throw new Error('Supabase is not configured.');

    const { data, error } = await client.auth.signUp({
      email,
      password,
    });

    return { user: data.user, error };
  }

  /**
   * Sign out
   */
  public static async signOut(): Promise<void> {
    const client = await this.getClient();
    if (client) {
      await client.auth.signOut();
    }
  }

  /**
   * Get Cloudflare R2 configuration
   */
  public static async getR2Config(): Promise<IR2Config | null> {
    const local = localStorage.getItem(STORAGE_KEY_R2_CONFIG);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {}
    }

    return null;
  }

  /**
   * Save Cloudflare R2 configuration
   */
  public static async saveR2Config(config: IR2Config): Promise<void> {
    localStorage.setItem(STORAGE_KEY_R2_CONFIG, JSON.stringify(config));
  }
}
