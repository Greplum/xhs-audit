import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseXhsVideoLinks, parseXhsVideoLink } from './parser';

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