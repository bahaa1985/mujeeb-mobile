import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { colorsForRole } from '@/theme';

export function useColors() {
  const { theme } = useSettings();
  const { user } = useAuth();
  return colorsForRole(theme, user?.role_id);
}

export function Screen({ children, scroll = true }: React.PropsWithChildren<{ scroll?: boolean }>) {
  const colors = useColors();
  const content = scroll
    ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
    : <View style={[styles.content, { flex: 1 }]}>{children}</View>;
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>{content}</SafeAreaView>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useColors();
  const { direction, theme } = useSettings();
  return (
    <View style={styles.pageHeader}>
      <Image
        source={theme === 'dark' ? require('@/assets/brand/navbar-dark.png') : require('@/assets/brand/navbar-light.png')}
        resizeMode="contain"
        accessibilityLabel="Mujeeb"
        style={[styles.brandLogo, { alignSelf: direction === 'rtl' ? 'flex-end' : 'flex-start' }]}
      />
      <Text style={[styles.pageTitle, { color: colors.text, textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted, textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function AppText({ children, muted = false, style }: React.PropsWithChildren<{ muted?: boolean; style?: object }>) {
  const colors = useColors();
  const { direction } = useSettings();
  return (
    <Text style={[styles.body, { color: muted ? colors.muted : colors.text, textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction }, style]}>
      {children}
    </Text>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colors = useColors();
  const { direction } = useSettings();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.text, textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            textAlign: direction === 'rtl' ? 'right' : 'left',
            writingDirection: direction,
          },
          props.multiline && styles.multiline,
          props.style,
        ]}
      />
      {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const colors = useColors();
  const background = variant === 'primary' ? '#1d4ed8' : variant === 'danger' ? colors.danger : colors.surfaceMuted;
  const foreground = variant === 'secondary' ? colors.text : '#ddd';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled || loading ? 0.6 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={styles.link}><Text style={{ color: colors.primary, fontWeight: '700' }}>{title}</Text></Pressable>;
}

export function ErrorBanner({ message }: { message: string }) {
  const colors = useColors();
  if (!message) return null;
  return <Text accessibilityRole="alert" style={[styles.errorBanner, { color: colors.danger, backgroundColor: colors.primarySoft }]}>{message}</Text>;
}

export function LoadingScreen() {
  const colors = useColors();
  return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function LoadingInline() {
  const colors = useColors();
  return <View style={styles.inlineLoading}><ActivityIndicator color={colors.primary} /></View>;
}

export function EmptyState({ title }: { title: string }) {
  const colors = useColors();
  return <View style={styles.empty}><Text style={{ color: colors.muted, textAlign: 'center' }}>{title}</Text></View>;
}

export function Divider() {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 12 }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 18 },
  pageHeader: { gap: 5, marginBottom: 2 },
  brandLogo: { width: 145, height: 44, marginBottom: 5 },
  pageTitle: { fontSize: 27, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 14, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  body: { fontSize: 15, lineHeight: 22 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 9, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  errorText: { fontSize: 12 },
  errorBanner: { borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 46, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  link: { minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inlineLoading: { padding: 20, alignItems: 'center' },
  empty: { paddingVertical: 30, paddingHorizontal: 12 },
});
