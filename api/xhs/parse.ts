import type { VercelRequest, VercelResponse } from '@vercel/node';

const NOTE_ID_PATTERN = /[a-f0-9]{24}/i;

const XHS_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]{24})/i,
  /^https?:\/\/(?:www\.)?xiaohongshu\.com\/user\/profile\/[^/?#]+\/([a-f0-9]{24})/i,
  /^https?:\/\/xhslink\.com\/[A-Za-z0-9/_-]+/i,
];

const XHS_URL_IN_TEXT_PATTERN = /https?:\/\/(?:www\.)?xiaohongshu\.com\/[^\s,，;；]+|https?:\/\/xhslink\.com\/[^\s,，;；]+/gi;

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://www.xiaohongshu.com/',
};

interface XhsVideoResult {
  input_url: string;
  resolved_url: string;
  is_valid_url: boolean;
  is_video: boolean;
  note_id: string | null;
  title: string | null;
  publish_time: string | null;
  publish_timestamp: number | null;
  tags: string[];
  error: string | null;
}

interface BatchParseResult {
  total: number;
  success_count: number;
  failed_count: number;
  results: XhsVideoResult[];
}

function isValidXhsUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return XHS_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractNoteId(url: string): string | null {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (NOTE_ID_PATTERN.test(pathParts[i])) {
        return pathParts[i].toLowerCase();
      }
    }

    const queryKeys = ['note_id', 'noteId', 'id'];
    for (const key of queryKeys) {
      const value = parsed.searchParams.get(key);
      if (value && NOTE_ID_PATTERN.test(value)) {
        return value.toLowerCase();
      }
    }

    for (const [, value] of parsed.searchParams.entries()) {
      if (NOTE_ID_PATTERN.test(value)) {
        return value.toLowerCase();
      }
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

function extractUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let candidates: string[] = [];
    const matches = trimmedLine.match(XHS_URL_IN_TEXT_PATTERN);
    if (matches) {
      candidates = matches;
    } else {
      candidates = trimmedLine.split(/[\s,，;；]+/).filter(Boolean);
    }

    for (let candidate of candidates) {
      candidate = candidate.trim().replace(/[.,，。；;)]+$/, '');
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      urls.push(candidate);
    }
  }

  return urls;
}

async function fetchHtml(url: string): Promise<{ finalUrl: string; html: string }> {
  const headers = { ...DEFAULT_HEADERS };
  const cookie = process.env.XHS_COOKIE?.trim();
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const finalUrl = response.url;
    const html = await response.text();
    return { finalUrl, html };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function extractInitialState(html: string): Record<string, unknown> | null {
  if (!html.includes('window.__INITIAL_STATE__')) return null;

  const regex = /window\.__INITIAL_STATE__\s*=\s*(\{.*?)(?:<\/script>|;)/gs;
  const matches = html.matchAll(regex);

  for (const match of matches) {
    const jsObj = match[1];
    const stack: string[] = [];
    let endIndex = 0;

    for (let i = 0; i < jsObj.length; i++) {
      const char = jsObj[i];
      if (char === '{') {
        stack.push('{');
      } else if (char === '}') {
        stack.pop();
        if (stack.length === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (endIndex === 0) continue;

    let jsonText = jsObj.slice(0, endIndex);
    const replacements: [string, string][] = [
      ['undefined', 'null'],
      ['True', 'true'],
      ['False', 'false'],
      ['None', 'null'],
    ];
    for (const [old, newStr] of replacements) {
      jsonText = jsonText.replace(new RegExp(old, 'g'), newStr);
    }

    try {
      return JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function extractNoteFromState(
  state: Record<string, unknown>,
  noteId: string,
): Record<string, unknown> | null {
  const noteSection = (state as any).note as Record<string, unknown> | undefined;
  const noteDetailMap =
    (noteSection?.noteDetailMap as Record<string, unknown> | undefined) ||
    (noteSection?.note_detail_map as Record<string, unknown> | undefined) ||
    {};

  const keys = [noteId, noteId.toUpperCase(), noteId.toLowerCase()];
  for (const key of keys) {
    const entry = noteDetailMap[key] as Record<string, unknown> | undefined;
    if (entry && typeof entry === 'object') {
      const note = entry.note as Record<string, unknown> | undefined;
      if (note && typeof note === 'object') {
        return note;
      }
    }
  }

  for (const entry of Object.values(noteDetailMap)) {
    if (!entry || typeof entry !== 'object') continue;
    const note = (entry as Record<string, unknown>).note as Record<string, unknown> | undefined;
    if (!note || typeof note === 'object') continue;
    const noteKey = String(
      (note as any).noteId || (note as any).note_id || '',
    ).toLowerCase();
    if (noteKey === noteId.toLowerCase()) {
      return note;
    }
  }

  return null;
}

function extractTags(note: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const tagList =
    (note as any).tagList ||
    (note as any).tag_list ||
    (note as any).hashTag ||
    [];

  for (const item of tagList as unknown[]) {
    if (typeof item === 'string' && item.trim()) {
      tags.push(item.trim());
    } else if (item && typeof item === 'object') {
      const name =
        (item as Record<string, unknown>).name ||
        (item as Record<string, unknown>).tagName ||
        (item as Record<string, unknown>).tag_name;
      if (typeof name === 'string' && name.trim()) {
        tags.push(name.trim());
      }
    }
  }

  const seen = new Set<string>();
  const uniqueTags: string[] = [];
  for (const tag of tags) {
    if (!seen.has(tag)) {
      seen.add(tag);
      uniqueTags.push(tag);
    }
  }
  return uniqueTags;
}

function formatTimestamp(
  rawTime: unknown,
): { timestamp: number | null; publishTime: string | null } {
  if (rawTime === null || rawTime === undefined || rawTime === '' || rawTime === 0) {
    return { timestamp: null, publishTime: null };
  }

  let timestamp: number;
  try {
    timestamp = Number(rawTime);
    if (isNaN(timestamp)) return { timestamp: null, publishTime: null };
  } catch {
    return { timestamp: null, publishTime: null };
  }

  if (timestamp > 1_000_000_000_000) {
    timestamp = Math.floor(timestamp / 1000);
  }

  try {
    const dt = new Date(timestamp * 1000);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const seconds = String(dt.getSeconds()).padStart(2, '0');
    return {
      timestamp,
      publishTime: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
    };
  } catch {
    return { timestamp, publishTime: null };
  }
}

function extractMetaFallback(html: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const metaRegex = /<meta[^>]+(?:property|name)\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/gi;
  const metaMap = new Map<string, string>();

  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const key = metaMatch[1];
    const content = metaMatch[2];
    metaMap.set(key, content);
  }

  const title = metaMap.get('og:title');
  const desc = metaMap.get('og:description') || metaMap.get('description');

  if (title) {
    result['title'] = title.trim();
  }
  if (desc) {
    result['desc'] = desc.trim();
    const hashtagRegex = /#([^#\[\]]+)/g;
    const hashtagMatches = desc.match(hashtagRegex);
    if (hashtagMatches) {
      result['tags'] = hashtagMatches
        .map((t) => t.slice(1).trim())
        .filter((t) => t);
    }
  }

  return result;
}

async function parseXhsVideoLink(url: string): Promise<XhsVideoResult> {
  const rawUrl = url.trim();
  const result: XhsVideoResult = {
    input_url: rawUrl,
    resolved_url: rawUrl,
    is_valid_url: isValidXhsUrl(rawUrl),
    is_video: false,
    note_id: null,
    title: null,
    publish_time: null,
    publish_timestamp: null,
    tags: [],
    error: null,
  };

  if (!rawUrl) {
    result.error = '链接不能为空';
    return result;
  }

  if (!result.is_valid_url) {
    result.error = '不是有效的小红书链接，请检查格式';
    return result;
  }

  try {
    const { finalUrl, html } = await fetchHtml(rawUrl);
    result.resolved_url = finalUrl;

    const noteId = extractNoteId(rawUrl) || extractNoteId(finalUrl);
    result.note_id = noteId;

    if (!noteId) {
      result.error = '无法从链接中解析笔记 ID';
      return result;
    }

    const state = extractInitialState(html);
    let note: Record<string, unknown> | null = null;
    if (state) {
      note = extractNoteFromState(state, noteId);
    }

    if (note) {
      const noteType = String((note as any).type || '').toLowerCase();
      result.is_video = noteType === 'video';
      result.title = (note as any).title || (note as any).displayTitle || null;

      const { timestamp, publishTime } = formatTimestamp(
        (note as any).time || (note as any).createTime || (note as any).create_time,
      );
      result.publish_timestamp = timestamp;
      result.publish_time = publishTime;
      result.tags = extractTags(note);

      if (!result.is_video) {
        result.error = '该链接对应的是图文笔记，不是视频笔记';
      }
      return result;
    }

    const fallback = extractMetaFallback(html);
    if (Object.keys(fallback).length > 0) {
      result.title = (fallback.title as string) || null;
      result.tags = (fallback.tags as string[]) || [];
      result.error =
        '页面未返回完整笔记数据，可能触发风控或笔记不可见。已尝试读取页面元信息，但无法确认是否为视频及发布时间。';
      return result;
    }

    if (html.includes('验证') || html.toLowerCase().includes('captcha')) {
      result.error = '访问被小红书风控拦截，请设置环境变量 XHS_COOKIE 后重试';
    } else if (
      finalUrl.includes('error_code=300031') ||
      html.includes('暂时无法浏览')
    ) {
      result.error =
        '笔记暂时无法浏览（可能已删除、私密，或未登录被拦截）。可设置环境变量 XHS_COOKIE 后重试';
    } else if (new URL(finalUrl).pathname.includes('/404')) {
      result.error = '页面跳转到 404，链接可能无效或需要登录后访问';
    } else {
      result.error = '未找到笔记数据，链接可能无效或笔记已删除';
    }

    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      result.error = '请求超时，请稍后重试';
    } else if (error.message?.includes('HTTP')) {
      result.error = `请求失败：${error.message}`;
    } else {
      result.error = `请求失败：${error.message || '未知错误'}`;
    }
    return result;
  }
}

async function parseXhsVideoLinks(text: string): Promise<BatchParseResult> {
  const urls = extractUrlsFromText(text);
  const results = await Promise.all(urls.map((url) => parseXhsVideoLink(url)));

  const successCount = results.filter(
    (item) => item.is_valid_url && item.is_video && !item.error,
  ).length;

  return {
    total: results.length,
    success_count: successCount,
    failed_count: results.length - successCount,
    results,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { text, url } = req.body as { text?: string; url?: string };

    if (!text && !url) {
      return res.status(400).json({ error: '请提供 text 或 url 参数' });
    }

    if (url) {
      const result = await parseXhsVideoLink(url);
      return res.json(result);
    }

    const result = await parseXhsVideoLinks(text || '');
    res.json(result);
  } catch (error: any) {
    console.error('Parse error:', error);
    res.status(500).json({ error: error.message || '解析失败' });
  }
}
