import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import { anonymousClient } from 'better-auth/client/plugins'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { AppConfig } from '@/constants/app-config'

/**
 * expo-secure-store has no web implementation — its `getItemAsync` calls straight into the
 * native module and throws in a browser, which took down the whole session on the web build
 * this repo already exports and deploys. So web needs *a* store; it does not need a durable
 * one.
 *
 * This used to be localStorage, on the assumption that the session token was kept there. It
 * is not: on web the session is the httpOnly cookie, sent by `credentials: 'include'`. The
 * bearer header `apiRequest` builds from `getCookie()` is a `cookie` header, which browsers
 * forbid and drop. Clearing localStorage mid-session changes nothing — verified — because
 * nothing auth-related was ever written there.
 *
 * Keeping it in memory means a token cannot be left behind for a cross-site script to read
 * even if that behaviour changes upstream. Native still uses the keychain.
 */
const memoryStore = new Map<string, string>()
const webStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => void memoryStore.set(key, value),
  getItemAsync: async (key: string) => memoryStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void memoryStore.set(key, value),
  deleteItemAsync: async (key: string) => void memoryStore.delete(key),
}

export const authClient = createAuthClient({
  baseURL: AppConfig.apiUrl,
  plugins: [
    anonymousClient(),
    expoClient({
      scheme: 'keptseeker',
      storagePrefix: 'kept-seeker',
      cookiePrefix: 'better-auth',
      storage: Platform.OS === 'web' ? webStorage : SecureStore,
    }),
  ],
})
