import type { PhraseItem } from '../types';

// UTF-8 BOM付きでCSV文字列をBlob化してダウンロードさせる
export function downloadCSV(filename: string, csvContent: string): void {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// フレーズリストをCSV形式に変換
export function exportPhrasesToCSV(phrases: PhraseItem[]): string {
  const headers = ['id', 'english', 'japanese', 'notes', 'tags', 'isBookmarked', 'reviewCount', 'createdAt'];
  const rows = phrases.map((p) => {
    return [
      escapeCsvField(p.id),
      escapeCsvField(p.english),
      escapeCsvField(p.japanese),
      escapeCsvField(p.notes || ''),
      escapeCsvField(p.tags.join(';')),
      p.isBookmarked ? 'true' : 'false',
      p.reviewCount.toString(),
      escapeCsvField(p.createdAt || new Date().toISOString()),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

// CSVフィールドのエスケープ処理
function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// CSV文字列をフレーズリストにパース
export function parsePhrasesFromCSV(csvText: string): { phrases: PhraseItem[]; errorCount: number } {
  const lines = parseCSVRows(csvText);
  if (lines.length < 2) {
    return { phrases: [], errorCount: 0 };
  }

  const header = lines[0].map((h) => h.trim().toLowerCase());
  const engIdx = header.indexOf('english');
  const jpnIdx = header.indexOf('japanese');
  const notesIdx = header.indexOf('notes');
  const tagsIdx = header.indexOf('tags');
  const bookmarkIdx = header.indexOf('isbookmarked');

  if (engIdx === -1 || jpnIdx === -1) {
    throw new Error('CSVヘッダーに "english" と "japanese" 列が必要です。');
  }

  const phrases: PhraseItem[] = [];
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 1 && !row[0].trim()) continue; // 空行スキップ

    const english = row[engIdx]?.trim();
    const japanese = row[jpnIdx]?.trim();

    if (!english || !japanese) {
      errorCount++;
      continue;
    }

    const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx].trim() : '';
    const rawTags = tagsIdx !== -1 && row[tagsIdx] ? row[tagsIdx].trim() : '';
    const tags = rawTags
      ? rawTags.split(/[;,]/).map((t) => t.trim()).filter(Boolean)
      : ['インポート'];
    const isBookmarked = bookmarkIdx !== -1 ? row[bookmarkIdx]?.toLowerCase() === 'true' : false;

    phrases.push({
      id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      english,
      japanese,
      notes,
      tags,
      isBookmarked,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return { phrases, errorCount };
}

// 簡易CSV行パーサー（クォート内のカンマや改行に対応）
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // スキップ
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
