import type { VercelRequest, VercelResponse } from '@vercel/node';

// 直接内联导入解析器，避免模块加载问题
const NOTE_ID_PATTERN = /[a-f0-9]{24}/i;

const XHS_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]{24})/i,
  /^https?:\/\/(?:www\.)?xiaohongshu\.com\/user\/profile\/[^/?#]+\/([a-f0-9]{24})/i,
  /^https?:\/\/xhslink\.com\/[A-Za-z0-9/_-]+/i,
];

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://www.xiaohongshu.com/',
};

function isValidXhsUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return XHS_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
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

async function parseXhsVideoLink(url: string) {
  const rawUrl = url.trim();
  const result = {
    input_url: rawUrl,
    resolved_url: rawUrl,
    is_valid_url: isValidXhsUrl(rawUrl),
    is_video: false,
    note_id: null as string | null,
    title: null as string | null,
    publish_time: null as string | null,
    publish_timestamp: null as number | null,
    tags: [] as string[],
    error: null as string | null,
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

    // 简化解析：只提取标题和基本信息
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1].trim().replace(' - 小红书', '').trim();
    }

    // 检查是否为视频
    if (html.includes('video') || html.includes('视频')) {
      result.is_video = true;
    }

    result.error = null;
    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      result.error = '请求超时，请稍后重试';
    } else {
      result.error = `请求失败：${error.message || '未知错误'}`;
    }
    return result;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置 CORS
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
    // 安全解析 body
    let body: { text?: string; url?: string } = {};
    
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch {
        return res.status(400).json({ error: '请求体格式错误' });
      }
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    }

    const { text, url } = body;

    if (!text && !url) {
      return res.status(400).json({ error: '请提供 text 或 url 参数' });
    }

    if (url) {
      const result = await parseXhsVideoLink(url);
      return res.json(result);
    }

    // 批量处理
    const lines = (text || '').split(/\r?\n/).filter((l: string) => l.trim());
    const results = await Promise.all(
      lines.map((line: string) => parseXhsVideoLink(line.trim()))
    );

    const successCount = results.filter(
      (item: any) => item.is_valid_url && !item.error
    ).length;

    return res.json({
      total: results.length,
      success_count: successCount,
      failed_count: results.length - successCount,
      results,
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: error.message || '服务器内部错误',
      stack: error.stack
    });
  }
}