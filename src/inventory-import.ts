import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import Fuse from 'fuse.js';
import * as XLSX from 'xlsx';

import drugCardWorkbook from '../assets/data/DrugCard.xlsx';

type DrugCardEntry = {
  a_name?: string;
  e_name?: string;
  active?: string;
  units?: number;
  dosage_form?: string;
  normalizedAName: string;
  normalizedEName: string;
  normalizedAFirstSector: string;
  normalizedEFirstSector: string;
};

type InventoryRow = Record<string, unknown>;

const moveQuantityToEnd = (text: string) => {
  const quantities: string[] = [];
  const cleaned = text.replace(/(\d+(?:[.,]\d+)?)(?:\s*)(مللي|مللى|جم|جرام)/g, (_, number: string, unit: string) => {
    quantities.push(`${number}${unit}`);
    return '';
  });
  const normalized = cleaned.replace(/\s+/g, ' ').trim();
  return quantities.length ? `${normalized} ${quantities.join(' ')}`.trim() : normalized;
};

const normalizeName = (text: string) => moveQuantityToEnd(text)
  .replace(/أ|إ|آ/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/مللي|مللى/g, 'مل')
  .replace(/جرام/g, 'جم')
  .replace(/مل جرام|ملجرام/g, 'مجم')
  .replace(/معلق/g, 'شراب')
  .replace(/(?:كبسولات|كبسولة|كبسوله)/g, 'كبسول')
  .replace(/(?:أقراص|اقراص)/g, 'قرص')
  .replace(/أكياس|اكياس/g, 'كيس')
  .replace(/(?:قطرة|قطره)/g, 'نقط')
  .replace(/امبولات|أمبولات/g, 'امبول')
  .replace(/[-/]/g, '')
  .trim()
  .toLowerCase();

const firstSector = (text: string) => text.split(/\s+|[-,/()]+/)[0]?.trim() || text;

let referencePromise: Promise<DrugCardEntry[]> | undefined;

async function loadDrugCard(): Promise<DrugCardEntry[]> {
  if (!referencePromise) {
    referencePromise = (async () => {
      const [asset] = await Asset.loadAsync(drugCardWorkbook);
      const uri = asset.localUri ?? asset.uri;
      const workbook = XLSX.read(await new File(uri).arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const referenceRows = XLSX.utils.sheet_to_json<Omit<DrugCardEntry,
        'normalizedAName' | 'normalizedEName' | 'normalizedAFirstSector' | 'normalizedEFirstSector'>>(sheet);
      return referenceRows.map((drug) => ({
        ...drug,
        normalizedAName: normalizeName(drug.a_name ?? ''),
        normalizedEName: normalizeName(drug.e_name ?? ''),
        normalizedAFirstSector: normalizeName(firstSector(drug.a_name ?? '')),
        normalizedEFirstSector: normalizeName(firstSector(drug.e_name ?? '')),
      }));
    })().catch((error: unknown) => {
      referencePromise = undefined;
      throw error;
    });
  }
  return referencePromise;
}

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error('Price, quantity, and units must be valid numbers.');
  return parsed;
};

export async function parseInventorySpreadsheet(sheetRows: unknown[][]): Promise<InventoryRow[]> {
  if (sheetRows.length < 2) throw new Error('The spreadsheet must contain a header and at least one data row.');
  const headers = sheetRows[0].map((header) => String(header ?? '').trim().toLowerCase());
  const hasNames = ['a_name', 'e_name', 'ar_name', 'en_name'].some((header) => headers.includes(header));
  if (!headers.includes('price') || !headers.includes('quantity') || !hasNames) {
    throw new Error('The file must include price, quantity, and a_name or e_name columns.');
  }

  const drugs = await loadDrugCard();
  const exactEnglish = new Map<string, DrugCardEntry>();
  const exactArabic = new Map<string, DrugCardEntry>();
  for (const drug of drugs) {
    if (drug.e_name) exactEnglish.set(normalizeName(drug.e_name), drug);
    if (drug.a_name) exactArabic.set(normalizeName(drug.a_name), drug);
  }
  const firstSectorFuse = new Fuse(drugs, {
    keys: ['normalizedAFirstSector', 'normalizedEFirstSector'],
    threshold: 0.2,
    includeScore: true,
  });

  return sheetRows.slice(1)
    .filter((row) => row.some((value) => value !== null && value !== undefined && value !== ''))
    .map((row) => {
      const source: Record<string, unknown> = {};
      headers.forEach((header, index) => { source[header] = row[index]; });
      let arName = String(source.ar_name ?? source.a_name ?? '').trim();
      let enName = String(source.en_name ?? source.e_name ?? '').trim();
      if (!arName && enName) arName = exactEnglish.get(normalizeName(enName))?.a_name ?? '';
      if (!enName && arName) enName = exactArabic.get(normalizeName(arName))?.e_name ?? '';

      const searchName = enName || arName;
      const normalizedSearchName = normalizeName(searchName);
      const sectorResults = searchName
        ? firstSectorFuse.search(normalizeName(firstSector(searchName)))
        : [];
      const candidates = sectorResults.length > 1
        ? new Fuse(sectorResults.map((result) => result.item), {
          keys: ['normalizedAName', 'normalizedEName'],
          threshold: 0.3,
        }).search(normalizedSearchName)
        : sectorResults;
      const match = candidates[0]?.item;

      return {
        ar_name: arName || null,
        en_name: enName || null,
        price: parseNumber(source.price),
        quantity: parseNumber(source.quantity),
        units_count: match?.units ?? parseNumber(source.units_count),
        dosage_form: match?.dosage_form ?? source.dosage_form ?? null,
        active: match?.active ?? source.active ?? source.active_material ?? null,
      };
    });
}
