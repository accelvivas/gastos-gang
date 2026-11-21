import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type SettingsRowProps = {
  label: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  status?: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function SettingsRow({
  label,
  subtitle,
  icon,
  status,
  disabled = false,
  onPress,
}: SettingsRowProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={[subtitle, status].filter(Boolean).join('. ') || undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border },
        pressed && !disabled && { backgroundColor: colors.surfaceElevated },
        disabled && styles.disabled,
      ]}>
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={21} color={disabled ? colors.textMuted : colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {status ? (
        <Text style={[styles.status, { color: colors.orange }]}>{status}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={disabled ? colors.border : colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.58 },
  iconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...typography.label, fontSize: 15 },
  subtitle: typography.caption,
  status: { ...typography.caption, flexShrink: 1, maxWidth: '32%', textAlign: 'right', fontWeight: '800', textTransform: 'uppercase' },
});
