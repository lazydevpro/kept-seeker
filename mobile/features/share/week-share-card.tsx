/**
 * The card someone actually posts.
 *
 * Sharing used to send a line of text — "0 weeks kept in a row. Amount stays private." —
 * which is both the weakest possible version of the product and, at a zero streak, an
 * advert for not using it. This renders a real card instead: the rings, the number, and
 * one line of copy, sized for a feed rather than for whatever phone took it.
 *
 * Two constraints shape it:
 *
 *  - It is laid out off-screen at a FIXED size, not captured from the live hero card, so
 *    the output is identical on every device and cannot pick up scroll position, the dev
 *    client's floating button, or a narrow screen.
 *  - It never renders an amount. The circle sees that you showed up, never how much, and a
 *    card that leaves the app is the one place that promise is easiest to break.
 *
 * Android's share sheet takes a file or text, not both, so the copy lives on the card
 * rather than in an accompanying message.
 */

import * as Sharing from 'expo-sharing'
import { useCallback, useRef, useState } from 'react'
import { Platform, Share, StyleSheet, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import { T } from '@/components/ui'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { radii, space, type } from '@/constants/theme'
import { Rings } from '@/features/progress/rings'
import type { RingValues } from '@/features/progress/rings'

/** 4:5. The aspect ratio feeds crop to least often. */
const CARD_WIDTH = 360
const CARD_HEIGHT = 450
const EXPORT_SCALE = 3

export type WeekShareData = {
  rings: RingValues
  streak: number
  goalWeeks: number
}

function headline({ streak, goalWeeks }: WeekShareData) {
  // Numbers are the headline, words are the caption — but a giant "0" sells nothing, so a
  // fresh start leads with the length of the promise instead of the streak.
  if (streak >= 1) {
    return { figure: String(streak), caption: streak === 1 ? 'week kept' : 'weeks kept in a row' }
  }
  return { figure: String(goalWeeks), caption: 'week promise. Week one starts now.' }
}

/** The message that goes out when the image cannot — an old Android share target, usually. */
export function shareMessage({ streak, goalWeeks }: WeekShareData) {
  if (streak >= 1) {
    return `${streak} ${streak === 1 ? 'week' : 'weeks'} kept in a row on KEPT. My circle sees that I showed up — never how much.`
  }
  return `I just made a ${goalWeeks}-week promise on KEPT. Small, weekly, and private — my circle sees that I showed up, never how much.`
}

export function WeekShareCard({ data, cardRef }: { data: WeekShareData; cardRef: React.Ref<View> }) {
  const styles = useStyles()
  const { colors } = useAppTheme()
  const { figure, caption } = headline(data)

  return (
    // Off to the side rather than hidden: a view with zero opacity captures as a
    // transparent bitmap, and one that is not laid out captures as nothing at all.
    <View style={styles.stage} pointerEvents="none">
      {/* `collapsable` is Android's: without it the capture target can be flattened away.
          The web renderer passes it to the DOM as an invalid attribute, so it stays off there. */}
      <View ref={cardRef} collapsable={Platform.OS === 'web' ? undefined : false} style={styles.card}>
        <T role="eyebrow" color={colors.inkFaint}>
          KEPT
        </T>

        <View style={styles.ringStage}>
          <Rings size={196} {...data.rings}>
            <T role="display" center>
              {figure}
            </T>
          </Rings>
        </View>

        <View style={styles.copy}>
          <T role="heading" center>
            {caption}
          </T>
          <T role="body" center color={colors.inkFaint}>
            Progress shared. Amounts never.
          </T>
        </View>

        <T role="eyebrow" color={colors.kiwiDeep} center style={styles.footer}>
          Promises compound.
        </T>
      </View>
    </View>
  )
}

export function useWeekShare(data: WeekShareData) {
  const cardRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  const share = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: CARD_WIDTH * EXPORT_SCALE,
        height: CARD_HEIGHT * EXPORT_SCALE,
      })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share this week' })
        return
      }
      await Share.share({ message: shareMessage(data) })
    } catch {
      // A share the person cancelled and a capture that failed look the same from here, so
      // the fallback is the message rather than an error they did not ask for.
      await Share.share({ message: shareMessage(data) }).catch(() => undefined)
    } finally {
      setSharing(false)
    }
  }, [data, sharing])

  return { cardRef, share, sharing }
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    stage: { position: 'absolute', left: -CARD_WIDTH * 4, top: 0 },
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: colors.background,
      borderRadius: radii.xl,
      paddingHorizontal: space[6],
      paddingVertical: space[6],
      justifyContent: 'space-between',
    },
    ringStage: { alignItems: 'center', justifyContent: 'center' },
    copy: { gap: space[2] },
    footer: { textTransform: 'uppercase' as const },
  }),
)

export { CARD_WIDTH, CARD_HEIGHT }
