import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/CategoryIcon';
import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import type { Category } from '@/db/types';
import { notifyCategoryChange } from '@/lib/expenseChanges';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  listAll,
  create,
  update,
  archive,
  unarchive,
  reorder,
} from '@/repositories/categoriesRepo';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type FormState = {
  id: number | null;
  name: string;
  icon: (typeof CATEGORY_ICONS)[number];
  color: (typeof CATEGORY_COLORS)[number];
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  icon: CATEGORY_ICONS[0],
  color: CATEGORY_COLORS[0],
};

export function CategoryManagementScreen({ onBack }: { onBack: () => void }) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setCategories(await listAll(db));
    } catch {
      setError('Hindi ma-load ang categories, boss.');
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  };

  const openEdit = (category: Category) => {
    setForm({
      id: category.id,
      name: category.name,
      icon: (CATEGORY_ICONS as readonly string[]).includes(category.icon)
        ? category.icon as FormState['icon']
        : CATEGORY_ICONS[0],
      color: (CATEGORY_COLORS as readonly string[]).includes(category.color)
        ? category.color as FormState['color']
        : CATEGORY_COLORS[0],
    });
    setFormError(null);
  };

  const saveForm = async () => {
    if (!form || isSaving) return;
    setIsSaving(true);
    setFormError(null);
    try {
      if (form.id === null) {
        await create(db, { name: form.name, icon: form.icon, color: form.color });
      } else {
        await update(db, form.id, { name: form.name, icon: form.icon, color: form.color });
      }
      notifyCategoryChange();
      setForm(null);
      await refresh();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Hindi ma-save ang category, boss.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchive = (category: Category) => {
    if (category.isArchived) {
      void reactivateCategory(category);
      return;
    }
    Alert.alert(
      `Archive ${category.name}?`,
      'Historical expenses will stay linked to this category.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => void archiveCategory(category),
        },
      ]
    );
  };

  const archiveCategory = async (category: Category) => {
    try {
      await archive(db, category.id);
      notifyCategoryChange();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi ma-archive ang category.');
    }
  };

  const reactivateCategory = async (category: Category) => {
    try {
      await unarchive(db, category.id);
      notifyCategoryChange();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi ma-reactivate ang category.');
    }
  };

  const moveCategory = async (category: Category, direction: -1 | 1) => {
    const active = categories.filter((item) => !item.isArchived);
    const index = active.findIndex((item) => item.id === category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= active.length) return;
    const next = [...active];
    const current = next[index];
    const replacement = next[target];
    if (!current || !replacement) return;
    next[index] = replacement;
    next[target] = current;
    try {
      await reorder(db, next.map((item) => item.id));
      notifyCategoryChange();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi maayos ang category order.');
    }
  };

  const activeCategories = categories.filter((category) => !category.isArchived);
  const archivedCategories = categories.filter((category) => category.isArchived);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <StreetBackground />
      <DetailHeader title="MANAGE CATEGORIES" onBack={onBack} action={(
        <Pressable accessibilityRole="button" accessibilityLabel="Add category" onPress={openCreate} style={[styles.addButton, { backgroundColor: colors.primary }]}>
        <Ionicons name="add" size={25} color={colors.primaryText} />
        </Pressable>
      )} />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Loading categories" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={[styles.errorCard, { borderColor: colors.orange, backgroundColor: colors.surface }]}>
              <Text accessibilityLiveRegion="assertive" style={[styles.errorText, { color: colors.warning }]}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
                <Text style={[styles.retryText, { color: colors.primary }]}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : null}

          <CategorySection
            title="ACTIVE"
            categories={activeCategories}
            onEdit={openEdit}
            onToggle={toggleArchive}
            onMove={moveCategory}
            activeCount={activeCategories.length}
          />
          <CategorySection
            title="ARCHIVED"
            categories={archivedCategories}
            onEdit={openEdit}
            onToggle={toggleArchive}
            onMove={moveCategory}
            activeCount={activeCategories.length}
          />
        </ScrollView>
      )}

      <Modal transparent animationType="fade" visible={form !== null} onRequestClose={() => setForm(null)}>
        {form ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View accessibilityViewIsModal style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>{form.id === null ? 'NEW CATEGORY' : 'EDIT CATEGORY'}</Text>
              <ScrollView
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.form}>
                <Text style={[styles.fieldLabel, { color: colors.primary }]}>NAME</Text>
                <TextInput
                  accessibilityLabel="Category name"
                  editable={!isSaving}
                  maxLength={30}
                  onChangeText={(name) => setForm((current) => current ? { ...current, name } : current)}
                  placeholder="Category name"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
                  value={form.name}
                />

                <Text style={[styles.fieldLabel, { color: colors.primary }]}>ICON</Text>
                <View style={styles.iconGrid}>
                  {CATEGORY_ICONS.map((icon) => (
                    <Pressable
                      key={icon}
                      accessibilityRole="radio"
                      accessibilityLabel={icon.replaceAll('-outline', '')}
                      accessibilityState={{ checked: form.icon === icon, disabled: isSaving }}
                      disabled={isSaving}
                      onPress={() => setForm((current) => current ? { ...current, icon } : current)}
                      style={[
                        styles.iconChoice,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        form.icon === icon && { borderColor: colors.primary, backgroundColor: colors.primary },
                      ]}>
                      <Ionicons name={icon} size={21} color={form.icon === icon ? colors.primaryText : colors.text} />
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.primary }]}>COLOR</Text>
                <View style={styles.colorGrid}>
                  {CATEGORY_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      accessibilityRole="radio"
                      accessibilityLabel={`Color ${color}`}
                      accessibilityState={{ checked: form.color === color, disabled: isSaving }}
                      disabled={isSaving}
                      onPress={() => setForm((current) => current ? { ...current, color } : current)}
                      style={[styles.colorChoice, { backgroundColor: color, borderColor: colors.surface }, form.color === color && { borderColor: colors.text }]}
                    />
                  ))}
                </View>

                {formError ? <Text accessibilityLiveRegion="assertive" style={[styles.formError, { color: colors.warning }]}>{formError}</Text> : null}

                <View style={styles.formActions}>
                  <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => setForm(null)} style={[styles.cancelButton, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cancelText, { color: colors.textMuted }]}>CANCEL</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void saveForm()} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
                    {isSaving ? <ActivityIndicator color={colors.primaryText} /> : (
                      <Text style={[styles.saveText, { color: colors.primaryText }]}>SAVE</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

function CategorySection({
  title,
  categories,
  onEdit,
  onToggle,
  onMove,
  activeCount,
}: {
  title: string;
  categories: Category[];
  onEdit: (category: Category) => void;
  onToggle: (category: Category) => void;
  onMove: (category: Category, direction: -1 | 1) => void;
  activeCount: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={[styles.sectionAccent, { backgroundColor: colors.primary }]} />
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {categories.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{title === 'ACTIVE' ? 'No active categories.' : 'No archived categories.'}</Text>
        ) : categories.map((category, index) => (
          <View key={category.id} style={[styles.categoryRow, { borderBottomColor: colors.border }]}>
            <CategoryIcon icon={category.icon} color={category.color} size={44} iconSize={23} />
            <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
            <View style={styles.rowActions}>
              {!category.isArchived ? (
                <View style={styles.moveControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${category.name} up`}
                    disabled={index === 0}
                    onPress={() => onMove(category, -1)}
                    style={[styles.iconButton, { backgroundColor: colors.surfaceElevated }, index === 0 && styles.disabled]}>
                    <Ionicons name="chevron-up" size={18} color={colors.text} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${category.name} down`}
                    disabled={index === categories.length - 1}
                    onPress={() => onMove(category, 1)}
                    style={[styles.iconButton, { backgroundColor: colors.surfaceElevated }, index === categories.length - 1 && styles.disabled]}>
                    <Ionicons name="chevron-down" size={18} color={colors.text} />
                  </Pressable>
                </View>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${category.name}`} onPress={() => onEdit(category)} style={[styles.actionButton, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="create-outline" size={19} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={category.isArchived ? `Reactivate ${category.name}` : `Archive ${category.name}`}
                disabled={!category.isArchived && activeCount <= 1}
                onPress={() => onToggle(category)}
                style={[styles.actionButton, { backgroundColor: colors.surfaceElevated }, !category.isArchived && activeCount <= 1 && styles.disabled]}>
                <Ionicons name={category.isArchived ? 'refresh-outline' : 'archive-outline'} size={19} color={colors.orange} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  section: { gap: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionAccent: { width: 5, height: 20, borderRadius: 3 },
  sectionTitle: { ...typography.label, letterSpacing: 1.1 },
  card: { overflow: 'hidden', borderWidth: 1, borderRadius: radii.lg },
  emptyText: { ...typography.caption, textAlign: 'center', padding: spacing.lg },
  categoryRow: { minHeight: 68, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, padding: spacing.sm },
  categoryName: { ...typography.label, flexGrow: 1, flexShrink: 1, flexBasis: 88 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 'auto' },
  moveControls: { flexDirection: 'row', gap: 2 },
  iconButton: { width: layout.minimumTapTarget, height: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  actionButton: { width: layout.minimumTapTarget, height: layout.minimumTapTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  disabled: { opacity: 0.35 },
  errorCard: { gap: spacing.sm, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md },
  errorText: { ...typography.caption, textAlign: 'center' },
  retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retryText: typography.label,
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  modalSheet: { maxHeight: '88%', borderWidth: 1, borderRadius: radii.xl, overflow: 'hidden' },
  modalTitle: { ...typography.heading, textAlign: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  form: { gap: spacing.sm, padding: spacing.lg },
  fieldLabel: { ...typography.label, letterSpacing: 0.8 },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: radii.md, paddingHorizontal: spacing.md, ...typography.body },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconChoice: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderWidth: 1 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorChoice: { width: 44, height: 44, borderRadius: radii.pill, borderWidth: 3 },
  formError: { ...typography.caption, textAlign: 'center', fontWeight: '800' },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  cancelText: typography.label,
  saveButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  saveText: typography.label,
});
