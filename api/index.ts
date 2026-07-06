import express from 'express';
import cors from 'cors';
import { parseXhsVideoLinks, parseXhsVideoLink } from './xhs/parser';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/xhs/parse', async (req, res) => {
  try {
    const { text, url } = req.body;
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
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export default app;