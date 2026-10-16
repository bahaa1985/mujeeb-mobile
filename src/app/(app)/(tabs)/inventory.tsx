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
import { ActionButton, AppText, Card, EmptyState, ErrorBanner, Field, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

type InventoryRow = Record<string, unknown>;
type StockFilter = 'all' | 'in' | 'out';

export default function InventoryScreen() {
  const { user } = useAuth();
  const { t } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);

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
      <PageHeader title={t('currentInventory')} />
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
                <AppText muted>{t('inStock')}: {item.quantity ?? 0}</AppText>
                <AppText muted>{item.price === null ? '—' : `${item.price}`}</AppText>
              </View>
              {item.dosage_form || item.drug_type ? <AppText muted>{[item.dosage_form, item.drug_type].filter(Boolean).join(' · ')}</AppText> : null}
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
    </Screen>
  );
}
