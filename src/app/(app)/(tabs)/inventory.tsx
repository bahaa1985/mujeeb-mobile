import { isAxiosError } from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { errorMessage, inventoryApi } from '@/api';
import { parseInventorySpreadsheet } from '@/inventory-import';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import type { InventoryItem, InventoryUpdate } from '@/types';
import { ActionButton, AppText, Card, EmptyState, ErrorBanner, Field, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

type InventoryRow = Record<string, unknown>;
type StockFilter = 'all' | 'in' | 'out';
type InventoryDraft = {
  en_name: string;
  ar_name: string;
  active_material: string;
  dosage_form: string;
  drug_type: string;
  price: string;
  units_count: string;
  quantity: 0 | 1;
};

const createInventoryDraft = (item: InventoryItem): InventoryDraft => ({
  en_name: item.en_name ?? '',
  ar_name: item.ar_name ?? '',
  active_material: item.active_material ?? '',
  dosage_form: item.dosage_form ?? '',
  drug_type: item.drug_type ?? '',
  price: item.price === null ? '' : String(item.price),
  units_count: item.units_count === null ? '' : String(item.units_count),
  quantity: item.quantity !== null && item.quantity > 0 ? 1 : 0,
});

export default function InventoryScreen() {
  const { user } = useAuth();
  const { t } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editDraft, setEditDraft] = useState<InventoryDraft | null>(null);

  const count = useQuery({
    queryKey: ['inventory-count', user?.pharmacy_id],
    enabled: Boolean(user?.pharmacy_id),
    queryFn: inventoryApi.count,
  });
  const inventory = useQuery({
    queryKey: ['inventory', user?.pharmacy_id, page, search.trim(), stock],
    enabled: Boolean(user?.pharmacy_id),
    queryFn: () => inventoryApi.list({ page, limit: 20, search: search.trim(), stock }),
  });

  const upload = useMutation({
    mutationFn: () => inventoryApi.upload(rows, user!.pharmacy_id),
    onSuccess: async () => {
      setSuccess(t('uploadSuccess'));
      setError('');
      setRows([]);
      setFileName('');
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-count'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      ]);
    },
    onError: (reason) => {
      setSuccess('');
      setError(
        isAxiosError(reason) && reason.response?.status === 429
          ? t('uploadLimit')
          : errorMessage(reason, t('requestFailed')),
      );
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InventoryUpdate }) => inventoryApi.update(id, data),
    onSuccess: async () => {
      setSuccess(t('inventoryItemUpdated'));
      setError('');
      setEditError('');
      setEditingItem(null);
      setEditDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-count'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      ]);
    },
    onError: (reason) => {
      setSuccess('');
      setEditError(errorMessage(reason, t('requestFailed')));
    },
  });

  const chooseFile = async () => {
    setError('');
    setSuccess('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const extension = asset.name.toLowerCase().split('.').pop();
      if (!['xlsx', 'xls', 'csv'].includes(extension ?? '')) {
        setError(t('fileTypeError'));
        return;
      }
      const buffer = await new File(asset.uri).arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true });
      const parsedRows = await parseInventorySpreadsheet(sheetRows);
      if (!parsedRows.length) throw new Error('No inventory rows were found in the selected file.');
      setFileName(asset.name);
      setRows(parsedRows);
    } catch (reason) {
      setError(errorMessage(reason, t('requestFailed')));
      setRows([]);
      setFileName('');
    }
  };

  const filterOptions: { value: StockFilter; label: string }[] = [
    { value: 'all', label: t('allStock') },
    { value: 'in', label: t('inStock') },
    { value: 'out', label: t('outOfStock') },
  ];
  const inventoryPage = inventory.data;

  const beginEditing = (item: InventoryItem) => {
    setError('');
    setEditError('');
    setSuccess('');
    setEditingItem(item);
    setEditDraft(createInventoryDraft(item));
  };

  const changeDraft = <K extends keyof InventoryDraft>(field: K, value: InventoryDraft[K]) => {
    setEditDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const saveInventoryItem = () => {
    if (!editingItem || !editDraft) return;

    const price = editDraft.price.trim() === '' ? null : Number(editDraft.price);
    const unitsCount = editDraft.units_count.trim() === '' ? null : Number(editDraft.units_count);
    if ((price !== null && !Number.isFinite(price)) || (unitsCount !== null && !Number.isFinite(unitsCount))) {
      setEditError(t('invalidInventoryNumber'));
      return;
    }

    const data: InventoryUpdate = {
      en_name: editDraft.en_name.trim() || null,
      ar_name: editDraft.ar_name.trim() || null,
      active_material: editDraft.active_material.trim() || null,
      dosage_form: editDraft.dosage_form.trim() || null,
      drug_type: editDraft.drug_type.trim() || null,
      price,
      units_count: unitsCount,
      quantity: editDraft.quantity,
    };
    updateItem.mutate({ id: editingItem.id, data });
  };

  return (
    <Screen>
      <PageHeader title={t('inventory')} subtitle={t('uploadSubtitle')} />
      <Card>
        <AppText muted>{t('currentInventory')}</AppText>
        {count.isLoading ? <LoadingInline /> : count.isError ? (
          <ErrorBanner message={t('requestFailed')} />
        ) : (
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800' }}>{count.data ?? 0}</Text>
        )}
      </Card>
      <Card>
        <AppText style={{ fontWeight: '700', fontSize: 17 }}>{t('chooseFile')}</AppText>
        <AppText muted>Supported formats: .xlsx, .xls, .csv</AppText>
        <ActionButton title={t('chooseFile')} variant="secondary" onPress={() => void chooseFile()} />
        {fileName ? <AppText style={{ fontWeight: '600' }}>{fileName} · {rows.length} rows</AppText> : null}
        {rows.length > 0 ? (
          <>
            <AppText style={{ fontWeight: '700' }}>Preview</AppText>
            {rows.slice(0, 5).map((row, index) => (
              <View key={index} style={{ borderTopWidth: index ? 1 : 0, borderColor: colors.border, paddingTop: index ? 9 : 0, gap: 2 }}>
                <AppText>{String(row.ar_name || row.en_name || '—')}</AppText>
                <AppText muted>Price {String(row.price ?? '—')} · Quantity {String(row.quantity ?? '—')}</AppText>
              </View>
            ))}
            {rows.length > 5 ? <AppText muted>+ {rows.length - 5} more rows</AppText> : null}
            <ActionButton title={t('upload')} onPress={() => upload.mutate()} loading={upload.isPending} />
          </>
        ) : null}
      </Card>
      <ErrorBanner message={error} />
      {success ? <Text style={{ color: colors.success, fontWeight: '600' }}>{success}</Text> : null}
      <AppText style={{ fontWeight: '700', fontSize: 17 }}>{t('currentInventory')}</AppText>
      <Field
        label={t('searchInventory')}
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setPage(1);
        }}
        autoCapitalize="none"
      />
      <View className="flex-row gap-2">
        {filterOptions.map((option) => {
          const selected = stock === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setStock(option.value);
                setPage(1);
              }}
              className="flex-1 items-center rounded-lg border px-2 py-3"
              style={{
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
              }}
            >
              <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '600', textAlign: 'center' }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {inventory.isLoading ? <LoadingInline /> : inventory.isError ? (
        <Card><ErrorBanner message={errorMessage(inventory.error, t('requestFailed'))} /><ActionButton title={t('retry')} onPress={() => void inventory.refetch()} /></Card>
      ) : inventoryPage?.data.length ? (
        <View className="gap-2">
          {inventoryPage.data.map((item) => (
            <Card key={item.id}>
              <AppText style={{ fontWeight: '700' }}>{item.ar_name || item.en_name || '—'}</AppText>
              {item.en_name && item.ar_name ? <AppText muted>{item.en_name}</AppText> : null}
              {item.active_material ? <AppText muted>{item.active_material}</AppText> : null}
              <View className="flex-row justify-between gap-3">
                <AppText muted>{item.quantity !== null && item.quantity > 0 ? t('inStock') : t('outOfStock')}</AppText>
                <AppText muted>{item.price === null ? '—' : `${item.price}`}</AppText>
              </View>
              {item.dosage_form || item.drug_type ? <AppText muted>{[item.dosage_form, item.drug_type].filter(Boolean).join(' · ')}</AppText> : null}
              <ActionButton title={t('editInventoryItem')} variant="secondary" onPress={() => beginEditing(item)} />
            </Card>
          ))}
          {inventoryPage.meta.lastPage > 1 ? (
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <ActionButton title={t('previous')} variant="secondary" disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} />
              </View>
              <AppText muted>{page} / {inventoryPage.meta.lastPage}</AppText>
              <View className="flex-1">
                <ActionButton title={t('next')} variant="secondary" disabled={page >= inventoryPage.meta.lastPage} onPress={() => setPage((current) => Math.min(inventoryPage.meta.lastPage, current + 1))} />
              </View>
            </View>
          ) : null}
        </View>
      ) : <EmptyState title={t('emptyInventory')} />}
      {editingItem && editDraft ? (
        <Card>
          <PageHeader title={`${t('editingInventoryItem')}: ${editingItem.ar_name || editingItem.en_name || editingItem.id}`} />
          <Field label={t('englishName')} value={editDraft.en_name} onChangeText={(value) => changeDraft('en_name', value)} />
          <Field label={t('arabicName')} value={editDraft.ar_name} onChangeText={(value) => changeDraft('ar_name', value)} />
          <Field label={t('activeMaterial')} value={editDraft.active_material} onChangeText={(value) => changeDraft('active_material', value)} />
          <Field label={t('dosageForm')} value={editDraft.dosage_form} onChangeText={(value) => changeDraft('dosage_form', value)} />
          <Field label={t('drugType')} value={editDraft.drug_type} onChangeText={(value) => changeDraft('drug_type', value)} />
          <Field label={t('price')} value={editDraft.price} keyboardType="decimal-pad" onChangeText={(value) => changeDraft('price', value)} />
          <Field label={t('unitsCount')} value={editDraft.units_count} keyboardType="decimal-pad" onChangeText={(value) => changeDraft('units_count', value)} />
          <AppText style={{ fontWeight: '700' }}>{t('availability')}</AppText>
          <ErrorBanner message={editError} />
          <View className="flex-row gap-2">
            {([{ value: 1, label: t('inStock') }, { value: 0, label: t('outOfStock') }] as const).map((option) => {
              const selected = editDraft.quantity === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => changeDraft('quantity', option.value)}
                  className="flex-1 items-center rounded-lg border px-2 py-3"
                  style={{
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft : colors.surface,
                  }}
                >
                  <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '600', textAlign: 'center' }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ActionButton title={t('saveInventoryItem')} onPress={saveInventoryItem} loading={updateItem.isPending} />
          <ActionButton
            title={t('cancel')}
            variant="secondary"
            disabled={updateItem.isPending}
            onPress={() => {
              setEditingItem(null);
              setEditDraft(null);
              setError('');
              setEditError('');
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
