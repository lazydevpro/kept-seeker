/**
 * KEPT onboarding — six steps, one visible idea per step.
 *
 * The rings are the constant: they sit at the top of every step and fill as the person
 * makes choices, so the thing they will look at every week is also the thing that teaches
 * them the app. Copy is one line of title plus at most one line of support; anything
 * longer belongs in the product, not the door.
 */

import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { Button, Card, IconButton, Row, T, type Tone } from '@/components/ui'
import { motion, radii, space, type, type ThemeColors } from '@/constants/theme'
import { Icon, IconPlate, type IconName } from '@/design/icons'
import { Object3D } from '@/design/objects'
import { Rings } from '@/features/progress/rings'
import { useRingReveal } from '@/features/progress/use-ring-reveal'
import {
  completeOnboarding,
  defaultOnboardingDraft,
  type GoalChoice,
  loadOnboardingDraft,
  ONBOARDING_LAST_STEP,
  type OnboardingDraft,
  saveOnboardingDraft,
  syncOnboardingDraft,
} from '@/features/onboarding/onboarding-state'
import { enablePushNotifications } from '@/features/notifications/notification-bootstrap'
import { useWalletLink } from '@/features/trade/use-wallet-link'
import { shareCircleInvite } from '@/features/social/social-api'
import { apiRequest } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const AMOUNTS = [10, 25, 50, 100]

const REASONS: {
  id: GoalChoice
  icon: IconName
  tone: Tone
  title: string
  goalTitle: string
  weeks: 4 | 12
}[] = [
  { id: 'reserve', icon: 'shield', tone: 'sky', title: 'Feel secure', goalTitle: 'Build my first reserve', weeks: 12 },
  {
    id: 'habit',
    icon: 'calendar',
    tone: 'grape',
    title: 'Build a habit',
    goalTitle: '12 weeks of showing up',
    weeks: 12,
  },
  {
    id: 'future',
    icon: 'flag',
    tone: 'coral',
    title: 'Fund a goal',
    goalTitle: 'Invest toward something real',
    weeks: 12,
  },
  {
    id: 'exploring',
    icon: 'sprout',
    tone: 'kiwi',
    title: 'Just try it',
    goalTitle: 'My four-week starter rhythm',
    weeks: 4,
  },
]

const STEP_LABELS = ['Welcome', 'Your why', 'Your rhythm', 'Try it', 'Your name', 'Your circle', 'Ready']
const LAST_STEP = ONBOARDING_LAST_STEP

export default function OnboardingScreen() {
  const { colors } = useAppTheme()
  const styles = useStyles()
  const { width, height } = useWindowDimensions()

  const [draft, setDraft] = useState(defaultOnboardingDraft)
  const [ready, setReady] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [enablingReminder, setEnablingReminder] = useState(false)
  const [interactive, setInteractive] = useState(false)

  const fade = useRef(new Animated.Value(0)).current
  const scrollRef = useRef<ScrollView>(null)

  const compact = height < 780
  const ringSize = Math.min(compact ? 176 : 208, Math.max(152, width - 150))

  /** The rings fill as choices are made — the reward is visible before the work starts. */
  const targets = useMemo(() => {
    switch (draft.step) {
      case 0:
        return { promise: 0.1, goal: 0.04, circle: 0.02 }
      case 1:
        return { promise: 0.32, goal: 0.12, circle: 0.02 }
      case 2:
        return { promise: 0.58, goal: 0.3, circle: 0.02 }
      case 3:
        return draft.previewCompleted
          ? { promise: 1, goal: 0.56, circle: 0.02 }
          : { promise: 0.74, goal: 0.42, circle: 0.02 }
      case 4:
        return { promise: 1, goal: 0.7, circle: 0.02 }
      case 5:
        return { promise: 1, goal: 0.82, circle: draft.inviteAfterSetup ? 0.6 : 0.1 }
      default:
        return { promise: 1, goal: 1, circle: draft.inviteAfterSetup ? 1 : 0.2 }
    }
  }, [draft.inviteAfterSetup, draft.previewCompleted, draft.step])

  const rings = useRingReveal(targets)

  const enter = useCallback(
    async (reduceMotion?: boolean) => {
      const reduce = reduceMotion ?? (await AccessibilityInfo.isReduceMotionEnabled())
      fade.stopAnimation()
      if (reduce) {
        fade.setValue(1)
        setInteractive(true)
        return
      }
      fade.setValue(0)
      Animated.spring(fade, { toValue: 1, ...motion.spring, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setInteractive(true)
      })
    },
    [fade],
  )

  useEffect(() => {
    loadOnboardingDraft()
      .then(setDraft)
      .catch(() => setDraft(defaultOnboardingDraft))
      .finally(() => {
        setReady(true)
        enter().catch(() => {
          fade.setValue(1)
          setInteractive(true)
        })
      })
  }, [enter, fade])

  useEffect(() => {
    if (ready) saveOnboardingDraft(draft).catch(() => undefined)
  }, [draft, ready])

  const update = (patch: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const walletLink = useWalletLink()
  /** "I already use KEPT": back into the wallet's account, or on with setup if it has none. */
  const restore = async () => {
    const outcome = await walletLink.restoreWithWallet()
    if (outcome === 'restored') {
      router.replace('/(tabs)')
    } else if (outcome === 'linked') {
      Alert.alert(
        'No account found for that wallet',
        'It is now linked to this new one, so it will bring you back next time. Let’s set it up.',
      )
      goTo(1)
    }
  }

  const select = (patch: Partial<OnboardingDraft>, feedback: 'selection' | 'success' = 'selection') => {
    update(patch)
    if (Platform.OS === 'web') return
    if (feedback === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    else Haptics.selectionAsync().catch(() => {})
  }

  const goTo = async (nextStep: number) => {
    if (!interactive || nextStep === draft.step) return
    const reduce = await AccessibilityInfo.isReduceMotionEnabled()
    const commit = () => {
      update({ step: nextStep })
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      enter(reduce).catch(() => undefined)
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }

    setInteractive(false)
    fade.stopAnimation()
    if (reduce) return commit()
    Animated.timing(fade, { toValue: 0, duration: 130, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => finished && commit(),
    )
  }

  /*
   * "Invite a friend" used to mean only that the circle tab opened afterwards, where a circle
   * still had to be named and an invite asked for — so finishing onboarding shared nothing.
   * Now it makes the circle, named after them, and opens the share sheet with the invite link.
   * If either step fails, setup still finishes: the circle tab offers both again.
   */
  const queryClient = useQueryClient()
  const inviteFirstFriend = async () => {
    try {
      const name = draft.displayName.trim()
      const created = await apiRequest<{ id: string }>('/v1/circles', {
        method: 'POST',
        body: JSON.stringify({ name: (name.length >= 2 ? `${name}’s circle` : 'Our circle').slice(0, 48) }),
      })
      await queryClient.invalidateQueries({ queryKey: ['circles'] })
      await shareCircleInvite(created.id)
    } catch {
      // Nothing to undo; the circle tab picks it up from here.
    }
  }

  const chooseReminder = async () => {
    if (enablingReminder) return
    setEnablingReminder(true)
    try {
      const outcome = await enablePushNotifications()
      select(
        { reminderChoice: outcome === 'enabled' ? 'enabled' : outcome === 'denied' ? 'skipped' : 'unavailable' },
        outcome === 'enabled' ? 'success' : 'selection',
      )
    } catch {
      select({ reminderChoice: 'unavailable' })
    } finally {
      setEnablingReminder(false)
    }
  }

  const finish = async () => {
    if (finishing) return
    setFinishError(null)
    setFinishing(true)
    try {
      await syncOnboardingDraft(draft)
      await completeOnboarding(draft)
      if (draft.inviteAfterSetup) await inviteFirstFriend()
      router.replace(draft.inviteAfterSetup ? '/(tabs)/circle' : '/(tabs)')
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Your choices are saved. Check your connection.')
      setFinishing(false)
    }
  }

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.kiwiDeep} />
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { minHeight: height - 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          {/* ── Chrome: back, wordmark, escape hatch. ── */}
          <Row style={styles.topBar}>
            {draft.step > 0 ? (
              <IconButton name="chevronLeft" label="Go back" onPress={() => goTo(draft.step - 1)} />
            ) : (
              <Row gap={space[2]}>
                <Object3D name="seedling" size={30} />
                <T role="subheading">KEPT</T>
              </Row>
            )}
            <View style={styles.progress}>
              {STEP_LABELS.map((label, index) => (
                <View
                  key={label}
                  style={[styles.tick, index <= draft.step && styles.tickOn, index === draft.step && styles.tickNow]}
                />
              ))}
            </View>
            {draft.step === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip and look around the app"
                onPress={() => router.replace('/(tabs)')}
                style={({ pressed }) => [styles.skip, pressed && motion.pressed]}
              >
                <T role="label" color={colors.inkFaint}>
                  Skip
                </T>
              </Pressable>
            ) : (
              <View style={styles.skip} />
            )}
          </Row>

          {/* ── The constant. ── */}
          <View style={[styles.ringStage, compact && styles.ringStageCompact]}>
            {/* The halo and the rings share one box the halo's size, centred the same way on every
                platform. The halo used to be absolute inside the padded stage, which Android
                centres on the padding box and the web on the content box: a few pixels off. */}
            <View
              style={[
                styles.ringBox,
                { width: ringSize * 1.12, height: ringSize * 1.12, borderRadius: ringSize * 0.56 },
                { backgroundColor: draft.previewCompleted ? colors.kiwiTint : colors.surfaceSunken },
              ]}
            >
              <Rings
                size={ringSize}
                {...rings}
                label={`Setup progress, step ${draft.step + 1} of ${STEP_LABELS.length}`}
              >
                <Object3D
                  name={draft.step === LAST_STEP ? 'party' : draft.previewCompleted ? 'check' : 'seedling'}
                  size={ringSize * 0.17}
                />
              </Rings>
            </View>
          </View>

          <Animated.View
            pointerEvents={interactive ? 'auto' : 'none'}
            style={[
              styles.page,
              {
                opacity: fade,
                transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              },
            ]}
          >
            {draft.step === 0 ? (
              <Welcome onNext={() => goTo(1)} onRestore={restore} restoring={walletLink.connecting} />
            ) : null}

            {draft.step === 1 ? (
              <Reason
                colors={colors}
                draft={draft}
                onSelect={(reason) => {
                  select({ goalChoice: reason.id, goalTitle: reason.goalTitle, goalWeeks: reason.weeks })
                  setTimeout(() => goTo(2), 280)
                }}
              />
            ) : null}

            {draft.step === 2 ? (
              <Rhythm colors={colors} draft={draft} onSelect={select} onCommit={() => goTo(3)} />
            ) : null}

            {draft.step === 3 ? (
              <TryIt
                draft={draft}
                onPreview={() => select({ previewCompleted: true }, 'success')}
                onNext={() => goTo(4)}
              />
            ) : null}

            {draft.step === 4 ? (
              <NameStep
                colors={colors}
                name={draft.displayName}
                onName={(displayName) => update({ displayName })}
                onNext={() => goTo(5)}
              />
            ) : null}

            {draft.step === 5 ? (
              <CircleStep
                colors={colors}
                draft={draft}
                onSelect={(invite) => {
                  select({ inviteAfterSetup: invite })
                  setTimeout(() => goTo(LAST_STEP), 280)
                }}
              />
            ) : null}

            {draft.step === LAST_STEP ? (
              <Ready
                colors={colors}
                draft={draft}
                finishing={finishing}
                finishError={finishError}
                enablingReminder={enablingReminder}
                onReminder={chooseReminder}
                onFinish={finish}
              />
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/* ── steps ────────────────────────────────────────────────── */

function Welcome({ onNext, onRestore, restoring }: { onNext: () => void; onRestore: () => void; restoring: boolean }) {
  const styles = useStyles()
  return (
    <View style={[styles.step, styles.stepFill]}>
      <T role="display" center>
        Promises{'\n'}compound.
      </T>
      <T role="body" center>
        Invest a little every week, with people who notice.
      </T>
      <View style={styles.grow} />
      <Button label="Get started" icon="arrowRight" onPress={onNext} style={styles.cta} />
      {/* The way back after a reinstall or a new phone. Without it, the only
          path from this screen was a brand-new, empty account. */}
      <Button
        label={restoring ? 'Opening wallet…' : 'I already use KEPT'}
        icon="wallet"
        variant="ghost"
        disabled={restoring}
        onPress={onRestore}
      />
    </View>
  )
}

function Reason({
  colors,
  draft,
  onSelect,
}: {
  colors: ThemeColors
  draft: OnboardingDraft
  onSelect: (reason: (typeof REASONS)[number]) => void
}) {
  const styles = useStyles()
  return (
    <View style={styles.step}>
      <T role="title" center>
        What are you growing toward?
      </T>
      <View style={styles.reasonGrid} accessibilityRole="radiogroup">
        {REASONS.map((reason) => {
          const selected = draft.goalChoice === reason.id
          return (
            <Pressable
              key={reason.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(reason)}
              style={({ pressed }) => [
                styles.reason,
                { backgroundColor: selected ? colors.kiwiTint : colors.surface },
                selected && { borderColor: colors.kiwi },
                pressed && motion.pressed,
              ]}
            >
              <IconPlate name={reason.icon} tone={reason.tone} size={46} />
              <T role="label" center>
                {reason.title}
              </T>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function Rhythm({
  colors,
  draft,
  onSelect,
  onCommit,
}: {
  colors: ThemeColors
  draft: OnboardingDraft
  onSelect: (patch: Partial<OnboardingDraft>) => void
  onCommit: () => void
}) {
  const styles = useStyles()
  return (
    <View style={styles.step}>
      <T role="title" center>
        Pick a promise you can keep.
      </T>

      <Card style={styles.amountCard}>
        <Row style={styles.amountRow}>
          <IconButton
            name="minus"
            label="Decrease weekly amount"
            on="card"
            onPress={() => onSelect({ weeklyAmount: Math.max(5, draft.weeklyAmount - 5) })}
          />
          <View style={styles.amountValue}>
            <T role="heading" color={colors.kiwiDeep}>
              $
            </T>
            <T role="display">{draft.weeklyAmount}</T>
          </View>
          <IconButton
            name="plus"
            label="Increase weekly amount"
            on="card"
            onPress={() => onSelect({ weeklyAmount: draft.weeklyAmount + 5 })}
          />
        </Row>
        <Row gap={space[2]} style={styles.presets}>
          {AMOUNTS.map((amount) => {
            const selected = draft.weeklyAmount === amount
            return (
              <Pressable
                key={amount}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`$${amount} a week`}
                onPress={() => onSelect({ weeklyAmount: amount })}
                style={({ pressed }) => [
                  styles.preset,
                  { backgroundColor: selected ? colors.kiwi : colors.surfaceSunken },
                  pressed && motion.pressed,
                ]}
              >
                <T role="label" color={colors.ink}>
                  ${amount}
                </T>
              </Pressable>
            )
          })}
        </Row>
      </Card>

      <View style={styles.dayBlock}>
        <T role="label" color={colors.inkFaint}>
          Every
        </T>
        <Row gap={space[1]} style={styles.dayRow} accessibilityRole="radiogroup">
          {DAY_LETTERS.map((letter, index) => {
            const selected = draft.reminderDay === index
            return (
              <Pressable
                key={`${letter}-${index}`}
                accessibilityRole="radio"
                accessibilityLabel={DAY_NAMES[index]}
                accessibilityState={{ checked: selected }}
                onPress={() => onSelect({ reminderDay: index })}
                style={({ pressed }) => [
                  styles.day,
                  { backgroundColor: selected ? colors.kiwi : colors.surface },
                  pressed && motion.pressed,
                ]}
              >
                <T role="label" color={selected ? colors.ink : colors.inkFaint}>
                  {letter}
                </T>
              </Pressable>
            )
          })}
        </Row>
      </View>

      <Button
        label={`$${draft.weeklyAmount} every ${DAY_SHORT[draft.reminderDay]}`}
        icon="arrowRight"
        onPress={onCommit}
        style={styles.cta}
      />
      <T role="caption" center color={colors.inkFaint}>
        ${draft.weeklyAmount * draft.goalWeeks} over {draft.goalWeeks} weeks · nothing moves yet
      </T>
    </View>
  )
}

function TryIt({ draft, onPreview, onNext }: { draft: OnboardingDraft; onPreview: () => void; onNext: () => void }) {
  const styles = useStyles()
  const { colors } = useAppTheme()
  return (
    <View style={styles.step}>
      <T role="title" center>
        {draft.previewCompleted ? 'That’s one week kept.' : 'See a week land.'}
      </T>
      <T role="body" center>
        {draft.previewCompleted ? 'Eleven more like that.' : 'A rehearsal — nothing is invested.'}
      </T>

      <Row gap={4} style={styles.weekRow}>
        {Array.from({ length: draft.goalWeeks }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.week,
              { backgroundColor: index === 0 && draft.previewCompleted ? colors.kiwi : colors.surfaceSunken },
            ]}
          />
        ))}
      </Row>

      {draft.previewCompleted ? (
        <Button label="Continue" icon="arrowRight" onPress={onNext} style={styles.cta} />
      ) : (
        <Button label="Keep week one" icon="play" onPress={onPreview} style={styles.cta} />
      )}
    </View>
  )
}

/**
 * Asked on its own, not tucked above the circle choice. As an optional field on that step
 * it was skipped without being seen — tapping a choice moves on — so people arrived in a
 * circle as "Member 4F2A". Still skippable: a name is how friends see you, not a gate.
 */
function NameStep({
  colors,
  name,
  onName,
  onNext,
}: {
  colors: ThemeColors
  name: string
  onName: (name: string) => void
  onNext: () => void
}) {
  const styles = useStyles()
  const named = name.trim().length >= 2
  return (
    <View style={styles.step}>
      <T role="title" center>
        What should your circle call you?
      </T>
      <T role="body" center>
        It’s the name on your nudges and cheers. You can change it any time in Account.
      </T>
      <TextInput
        value={name}
        onChangeText={(value) => onName(value.slice(0, 40))}
        placeholder="Your first name"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="words"
        autoComplete="given-name"
        autoFocus
        maxLength={40}
        returnKeyType="next"
        onSubmitEditing={() => (named ? onNext() : undefined)}
        accessibilityLabel="Your name, as your circle sees it"
        style={[type.body, styles.nameField, { color: colors.ink, backgroundColor: colors.surface }]}
      />
      <Button label="Continue" icon="arrowRight" onPress={onNext} disabled={!named} style={styles.cta} />
      <Pressable
        accessibilityRole="button"
        onPress={onNext}
        hitSlop={8}
        style={({ pressed }) => [styles.later, pressed && motion.pressed]}
      >
        <T role="label" center color={colors.inkFaint}>
          Skip for now
        </T>
      </Pressable>
    </View>
  )
}

function CircleStep({
  colors,
  draft,
  onSelect,
}: {
  colors: ThemeColors
  draft: OnboardingDraft
  onSelect: (invite: boolean) => void
}) {
  const styles = useStyles()
  const options: { invite: boolean; icon: IconName; title: string; detail: string }[] = [
    { invite: true, icon: 'personAdd', title: 'Invite a friend', detail: 'They see progress, never amounts' },
    { invite: false, icon: 'sprout', title: 'Start solo', detail: 'Add people whenever you like' },
  ]
  return (
    <View style={styles.step}>
      <T role="title" center>
        Better with someone.
      </T>
      <View style={styles.optionList} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = draft.inviteAfterSetup === option.invite
          return (
            <Pressable
              key={option.title}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(option.invite)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: selected ? colors.kiwiTint : colors.surface },
                selected && { borderColor: colors.kiwi },
                pressed && motion.pressed,
              ]}
            >
              <IconPlate name={option.icon} tone={selected ? 'kiwi' : 'neutral'} />
              <View style={styles.optionCopy}>
                <T role="label">{option.title}</T>
                <T role="caption" color={colors.inkFaint}>
                  {option.detail}
                </T>
              </View>
              <Icon
                name={selected ? 'checkCircle' : 'dot'}
                size={22}
                color={selected ? colors.kiwiDeep : colors.hairlineStrong}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function Ready({
  colors,
  draft,
  finishing,
  finishError,
  enablingReminder,
  onReminder,
  onFinish,
}: {
  colors: ThemeColors
  draft: OnboardingDraft
  finishing: boolean
  finishError: string | null
  enablingReminder: boolean
  onReminder: () => void
  onFinish: () => void
}) {
  const styles = useStyles()
  const reminderSet = draft.reminderChoice !== null

  return (
    <View style={styles.step}>
      <T role="title" center>
        Your rhythm is set.
      </T>
      <T role="stat" center color={colors.kiwiDeep}>
        ${draft.weeklyAmount} · {DAY_SHORT[draft.reminderDay]}
      </T>

      {reminderSet ? (
        <Row
          gap={space[2]}
          style={[
            styles.reminder,
            { backgroundColor: draft.reminderChoice === 'enabled' ? colors.kiwiTint : colors.surfaceSunken },
          ]}
        >
          <Icon
            name={draft.reminderChoice === 'enabled' ? 'checkCircle' : 'info'}
            size={20}
            color={draft.reminderChoice === 'enabled' ? colors.kiwiDeep : colors.inkMuted}
          />
          <T
            role="caption"
            color={draft.reminderChoice === 'enabled' ? colors.kiwiDeep : colors.inkMuted}
            style={styles.reminderCopy}
          >
            {draft.reminderChoice === 'enabled'
              ? `We’ll nudge you every ${DAY_NAMES[draft.reminderDay]}.`
              : draft.reminderChoice === 'unavailable'
                ? // Not the user's choice — this build can't do push at all.
                  'Reminders aren’t available in this build. Everything else works.'
                : 'No reminder for now — you can add one later.'}
          </T>
        </Row>
      ) : (
        <Button
          label={enablingReminder ? 'Asking…' : `Remind me on ${DAY_SHORT[draft.reminderDay]}`}
          icon="bell"
          variant="secondary"
          onPress={onReminder}
          disabled={enablingReminder}
          style={styles.cta}
        />
      )}

      {finishError ? (
        <Row gap={space[2]} style={[styles.reminder, { backgroundColor: colors.coralTint }]}>
          <Icon name="alert" size={20} color={colors.coralDeep} />
          <T role="caption" color={colors.coralDeep} style={styles.reminderCopy}>
            {finishError}
          </T>
        </Row>
      ) : null}

      <Button
        label={finishing ? 'Saving…' : draft.inviteAfterSetup ? 'Invite my friend' : 'See my week'}
        icon="arrowRight"
        onPress={onFinish}
        disabled={finishing || enablingReminder}
        style={styles.cta}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { flexGrow: 1, paddingHorizontal: space[5], paddingBottom: space[8] },
    shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },

    topBar: { minHeight: 56, justifyContent: 'space-between' },
    progress: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    tick: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairlineStrong },
    tickOn: { backgroundColor: colors.kiwi },
    tickNow: { width: 18 },
    skip: { minWidth: 56, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },

    ringStage: { alignItems: 'center', justifyContent: 'center', paddingTop: space[4], paddingBottom: space[6] },
    ringStageCompact: { paddingTop: space[1], paddingBottom: space[4] },
    ringBox: { alignItems: 'center', justifyContent: 'center' },

    page: { flex: 1 },
    step: { gap: space[4], alignItems: 'stretch' },
    nameField: {
      minHeight: 52,
      paddingHorizontal: space[4],
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    stepFill: { flex: 1 },
    grow: { flex: 1, minHeight: space[4] },
    cta: { alignSelf: 'stretch', marginTop: space[1] },
    later: { alignSelf: 'center', paddingVertical: space[2] },

    reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
    reason: {
      width: '47.4%',
      flexGrow: 1,
      alignItems: 'center',
      gap: space[3],
      paddingVertical: space[5],
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: 'transparent',
    },

    amountCard: { gap: space[4], alignItems: 'center' },
    amountRow: { justifyContent: 'space-between', alignSelf: 'stretch' },
    amountValue: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
    presets: { alignSelf: 'stretch', justifyContent: 'space-between' },
    preset: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
    },

    dayBlock: { gap: space[2] },
    dayRow: { justifyContent: 'space-between' },
    day: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },

    weekRow: { justifyContent: 'space-between' },
    week: { flex: 1, height: 36, borderRadius: 8 },

    optionList: { gap: space[3] },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      padding: space[4],
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optionCopy: { flex: 1, gap: 2 },

    reminder: { alignItems: 'center', padding: space[3], borderRadius: radii.md },
    reminderCopy: { flex: 1 },
  }),
)
