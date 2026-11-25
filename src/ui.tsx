import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable as RNPressable,
  ScrollView, StyleSheet, Text as RNText, TextInput, useWindowDimensions, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, ReduceMotion, SlideInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { c, font, radius, shadow, questPalette } from './theme';
import { iconForQuest, type IconComponent } from './icons';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

type PressProps = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  hitSlop?: number;
};

export function PressableScale({
  children, onPress, onLongPress, disabled, style, accessibilityLabel,
  accessibilityRole = 'button', hitSlop
}: PressProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pressIn = () => {
    if (disabled) return;
    scale.set(withTiming(reduced ? 1 : 0.97, { duration: 120, easing: EASE_OUT }));
  };
  const pressOut = () => {
    scale.set(withTiming(1, { duration: 160, easing: EASE_OUT }));
  };
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[style, animated, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}

const tones = {
  ink: c.ink,
  muted: c.muted,
  faint: c.faint,
  primary: c.primary,
  success: c.successInk,
  warning: c.warningInk,
  danger: c.dangerInk,
  white: c.white
} as const;

const variants = StyleSheet.create({
  display: { fontFamily: font.extrabold, fontSize: 36, lineHeight: 45, letterSpacing: -1.4, includeFontPadding: false },
  title: { fontFamily: font.extrabold, fontSize: 29, lineHeight: 37, letterSpacing: -0.9, includeFontPadding: false },
  heading: { fontFamily: font.bold, fontSize: 21, lineHeight: 28, letterSpacing: -0.5, includeFontPadding: false },
  subheading: { fontFamily: font.bold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 22 },
  meta: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  number: { fontFamily: font.extrabold, fontSize: 46, lineHeight: 50, letterSpacing: -2.4, fontVariant: ['tabular-nums'] },
  numberMd: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  numberSm: { fontFamily: font.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }
});

export function T({
  children, variant = 'body', tone = 'ink', align, numberOfLines, style, onPress
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  tone?: keyof typeof tones;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
}) {
  return (
    <RNText
      numberOfLines={numberOfLines}
      onPress={onPress}
      style={[variants[variant], { color: tones[tone] }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </RNText>
  );
}

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon, disabled, loading, full, style
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const heights = { sm: 38, md: 50, lg: 56 } as const;
  const padding = { sm: 14, md: 20, lg: 24 } as const;
  const textSize = { sm: 13, md: 15, lg: 16 } as const;
  const bg = {
    primary: c.primary,
    soft: c.soft,
    ghost: 'transparent',
    danger: c.dangerSoft,
    outline: c.surface
  }[variant];
  const ink = {
    primary: c.white,
    soft: c.ink,
    ghost: c.ink,
    danger: c.dangerInk,
    outline: c.ink
  }[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={[
        {
          height: heights[size],
          paddingHorizontal: padding[size],
          borderRadius: radius.pill,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          alignSelf: full ? 'stretch' : 'flex-start'
        },
        variant === 'outline' ? { borderWidth: 1, borderColor: c.line } : null,
        style
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={ink} /> : icon}
      <T style={{ fontFamily: font.semibold, fontSize: textSize[size], color: ink }}>
        {label}
      </T>
    </PressableScale>
  );
}

export function Card({
  children, onPress, onLongPress, style, tone = 'surface', padded = true
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'soft';
  padded?: boolean;
}) {
  const backgrounds = {
    surface: c.surface,
    primary: c.primarySoft,
    success: c.successSoft,
    warning: c.warningSoft,
    danger: c.dangerSoft,
    purple: c.purpleSoft,
    soft: c.soft
  } as const;
  const body = (
    <View
      style={[
        {
          backgroundColor: backgrounds[tone],
          borderRadius: radius.lg,
          padding: padded ? 18 : 0,
          borderWidth: tone === 'surface' ? 1 : 0,
          borderColor: c.line
        },
        style
      ]}
    >
      {children}
    </View>
  );
  if (!onPress && !onLongPress) return body;
  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} style={{ borderRadius: radius.lg }}>
      {body}
    </PressableScale>
  );
}

export function IconTile({
  name, component, size = 46, bg, color, iconSize, round
}: {
  name?: string;
  component?: IconComponent;
  size?: number;
  bg?: string;
  color?: string;
  iconSize?: number;
  round?: boolean;
}) {
  const palette = questPalette[name ?? ''] ?? questPalette.default!;
  const Icon = component ?? iconForQuest(name ?? '');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : Math.max(12, size * 0.32),
        backgroundColor: bg ?? palette.soft,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.48)} color={color ?? palette.color} strokeWidth={2.1} />
    </View>
  );
}

const pillTones = {
  soft: { bg: c.soft, ink: c.ink },
  primary: { bg: c.primarySoft, ink: c.primary },
  success: { bg: c.successSoft, ink: c.successInk },
  warning: { bg: c.warningSoft, ink: c.warningInk },
  danger: { bg: c.dangerSoft, ink: c.dangerInk },
  purple: { bg: c.purpleSoft, ink: c.purple },
  white: { bg: c.white, ink: c.ink }
} as const;

export function Pill({
  label, tone = 'soft', icon, style
}: {
  label: string;
  tone?: keyof typeof pillTones;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = pillTones[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          height: 28,
          borderRadius: radius.pill,
          backgroundColor: palette.bg
        },
        style
      ]}
    >
      {icon}
      <T variant="caption" style={{ color: palette.ink }}>{label}</T>
    </View>
  );
}

export function ProgressBar({
  value, color = c.primary, track = c.soft, height = 8, style
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(Math.min(1, Math.max(0, value)));
  useEffect(() => {
    progress.set(withTiming(Math.min(1, Math.max(0, value)), {
      duration: reduced ? 0 : 420,
      easing: EASE_OUT
    }));
  }, [progress, reduced, value]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }, style]}>
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: height, backgroundColor: color },
          fill
        ]}
      />
    </View>
  );
}

export function Screen({
  children, refreshControl, contentStyle
}: {
  children: ReactNode;
  refreshControl?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, contentStyle]}
        refreshControl={refreshControl as never}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeader({
  eyebrow, title, subtitle, right
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={{ gap: 7, paddingTop: 4 }}>
      {(eyebrow || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }}>
          {eyebrow ? <T variant="meta" tone="muted">{eyebrow}</T> : <View />}
          {right}
        </View>
      )}
      <T variant="display">{title}</T>
      {subtitle ? <T tone="muted" style={{ maxWidth: 330 }}>{subtitle}</T> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
      <T variant="heading">{title}</T>
      {action}
    </View>
  );
}

export function Field({
  label, suffix, multiline, containerStyle, ...props
}: TextInputProps & { label: string; suffix?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 7 }, containerStyle]}>
      <T variant="caption" tone="muted">{label}</T>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: c.soft,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: focused ? c.primary : 'transparent',
          paddingHorizontal: 15,
          minHeight: multiline ? 116 : 52
        }}
      >
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={c.faint}
          selectionColor={c.primary}
          onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
          style={{
            flex: 1,
            fontFamily: font.medium,
            fontSize: 16,
            color: c.ink,
            paddingVertical: multiline ? 14 : 0,
            textAlignVertical: multiline ? 'top' : 'center',
            minHeight: multiline ? 112 : 50,
            ...(props.style as object)
          }}
        />
        {suffix ? <T variant="meta" tone="muted">{suffix}</T> : null}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, variant = 'soft'
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  variant?: 'soft' | 'blue';
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.soft, borderRadius: radius.pill, padding: 4, gap: 2 }}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            onPress={() => onChange(option.key)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active
                ? variant === 'blue' ? c.primary : c.surface
                : 'transparent',
              ...(active && variant === 'soft' ? shadow.card : null)
            }}
          >
            <T
              variant="meta"
              style={{
                fontFamily: font.semibold,
                color: active ? (variant === 'blue' ? c.white : c.ink) : c.muted
              }}
            >
              {option.label}
            </T>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function OptionRow({
  icon, component, title, hint, selected, onPress, color, soft, right, disabled
}: {
  icon?: string;
  component?: IconComponent;
  title: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
  color?: string;
  soft?: string;
  right?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={{ borderRadius: radius.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          padding: 13,
          borderRadius: radius.md,
          backgroundColor: selected ? c.primarySoft : c.surface,
          borderWidth: 1.5,
          borderColor: selected ? c.primary : c.line
        }}
      >
        <IconTile name={icon} component={component} size={42} bg={soft} color={color} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">{title}</T>
          {hint ? <T variant="meta" tone="muted">{hint}</T> : null}
        </View>
        {right}
      </View>
    </PressableScale>
  );
}

export function Sheet({
  visible, onClose, title, subtitle, children, footer, scrollable = true
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!visible) return null;
  // A numeric cap avoids the percentage-height quirk that made the sheet
  // shrink below its content and clip the last controls.
  const maxHeight = Math.max(320, height - Math.max(insets.top, 24) - 36);
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <RNPressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet">
          <View style={{ flex: 1, backgroundColor: c.overlay }} />
        </RNPressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%' }}
        >
          <Animated.View
            entering={SlideInDown.duration(270).reduceMotion(ReduceMotion.System)}
            style={{
              width: '100%',
              maxHeight,
              backgroundColor: c.surface,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingBottom: Math.max(insets.bottom, 14),
              ...shadow.sheet
            }}
          >
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.soft, alignSelf: 'center', marginTop: 9 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <T variant="heading">{title}</T>
                {subtitle ? <T variant="meta" tone="muted">{subtitle}</T> : null}
              </View>
              <PressableScale onPress={onClose} accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={c.ink} strokeWidth={2.4} />
              </PressableScale>
            </View>
            {scrollable ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10, gap: 14 }}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={{ paddingHorizontal: 20, gap: 14 }}>{children}</View>
            )}
            {footer ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>{footer}</View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Check size={size * 0.5} color={c.white} strokeWidth={3.2} />
    </View>
  );
}

export function Metric({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="numberSm" style={color ? { color } : undefined}>{value}</T>
      <T variant="caption" tone="muted">{label}</T>
    </View>
  );
}

export const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
});
