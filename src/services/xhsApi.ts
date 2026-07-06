import type { BatchParseResult, XhsVideoResult } from '@/types/xhs';

export async function batchParseXhsLinks(text: string): Promise<BatchParseResult> {
  const response = await fetch('/api/xhs/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || '请求失败');
  }

  return response.json();
}

export async function parseSingleXhsLink(url: string): Promise<XhsVideoResult> {
  const response = await fetch('/api/xhs/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || '请求失败');
  }

  return response.json();
}