import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium'
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold'
import { Sora_500Medium } from '@expo-google-fonts/sora/500Medium'
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold'
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold'
import { Sora_800ExtraBold } from '@expo-google-fonts/sora/800ExtraBold'
import { useFonts } from 'expo-font'
import { type ErrorBoundaryProps, Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { useAppTheme } from '@/components/theme-provider'
import { darkColors, lightColors } from '@/constants/theme'
import { AnimatedSplash } from '@/features/splash/animated-splash'
import '@/features/demo/demo'

// Hold the native splash until the fonts are in. Without this it hides on the first frame,
// which is the frame this layout renders nothing on — so the opening was a cream field, a
// blank white gap, then the app.
SplashScreen.preventAutoHideAsync().catch(() => undefined)

/**
 * What a render crash shows instead of a closed app.
 *
 * Without this, an exception anywhere under the root took the whole app down in a
 * release build. It renders OUTSIDE the providers — the providers may be what threw —
 * so it reads the palette directly and uses system fonts, and "Try again" remounts
 * everything from scratch.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colors = useColorScheme() === 'dark' ? darkColors : lightColors
  // A crash before the first paint would otherwise leave the native splash up for good.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined)
  }, [])
  return (
    <View style={[fallback.screen, { backgroundColor: colors.background }]}>
      <Text style={[fallback.title, { color: colors.ink }]}>Something went wrong</Text>
      <Text style={[fallback.body, { color: colors.inkMuted }]}>
        KEPT hit an error it did not expect. Nothing you have done was lost — your progress lives on the server and your
        money in your wallet.
      </Text>
      {__DEV__ ? <Text style={[fallback.detail, { color: colors.inkMuted }]}>{error.message}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={[fallback.button, { backgroundColor: colors.kiwi }]}
      >
        <Text style={[fallback.buttonLabel, { color: colors.ink }]}>Try again</Text>
      </Pressable>
    </View>
  )
}

const fallback = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  detail: { fontSize: 12, textAlign: 'center', fontFamily: 'monospace' },
  button: { marginTop: 8, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
})

export default function RootLayout() {
  const [introPlayed, setIntroPlayed] = useState(false)
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  })

  // Handing the native splash over only once this tree has painted is what keeps the seam
  // invisible: the overlay is already on screen, in the same cream, before the splash goes.
  const handOver = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined)
  }, [])

  if (!fontsLoaded) return null

  return (
    <AppProviders>
      <RootNavigation />
      {introPlayed ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={handOver}>
          <AnimatedSplash onFinish={() => setIntroPlayed(true)} />
        </View>
      )}
    </AppProviders>
  )
}

function RootNavigation() {
  const { colors, mode } = useAppTheme()
  return (
    <>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="awards" options={{ headerShown: false }} />
        <Stack.Screen name="portfolio" options={{ headerShown: false }} />
        <Stack.Screen name="markets" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="asset/[mint]" options={{ headerShown: false }} />
        <Stack.Screen name="join/[token]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  )
}
