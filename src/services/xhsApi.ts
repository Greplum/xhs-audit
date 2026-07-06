import { parseXhsVideoLink, parseXhsVideoLinks } from '@/utils/xhsParser';
import type { BatchParseResult, XhsVideoResult } from '@/utils/xhsParser';

export async function batchParseXhsLinks(text: string): Promise<BatchParseResult> {
  return parseXhsVideoLinks(text);
}

export async function parseSingleXhsLink(url: string): Promise<XhsVideoResult> {
  return parseXhsVideoLink(url);
}
