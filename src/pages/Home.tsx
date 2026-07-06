import { useState, useCallback } from 'react';
import { Search, Sparkles, Link as LinkIcon, Loader2 } from 'lucide-react';
import NoteCard from '@/components/NoteCard';
import StatsBar from '@/components/StatsBar';
import type { NoteItem, XhsVideoResult } from '@/types/xhs';
import { batchParseXhsLinks, parseSingleXhsLink } from '@/services/xhsApi';

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const extractUrls = (text: string): string[] => {
    const urlPattern = /https?:\/\/[^\s,，;；]+/gi;
    const urls: string[] = [];
    const seen = new Set<string>();
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const matches = trimmed.match(urlPattern);
      if (matches) {
        for (const match of matches) {
          const clean = match.replace(/[.,，。；;)]+$/, '');
          if (!seen.has(clean)) {
            seen.add(clean);
            urls.push(clean);
          }
        }
      }
    }
    return urls;
  };

  const handleBatchCheck = useCallback(async () => {
    const urls = extractUrls(inputText);
    if (urls.length === 0) {
      setErrorMsg('请输入至少一个小红书链接');
      return;
    }

    setErrorMsg('');
    setIsChecking(true);

    const initialNotes: NoteItem[] = urls.map((url, index) => ({
      input_url: url,
      resolved_url: url,
      is_valid_url: false,
      is_video: false,
      note_id: null,
      title: null,
      publish_time: null,
      publish_timestamp: null,
      tags: [],
      error: null,
      status: 'checking',
      index,
    }));
    setNotes(initialNotes);

    try {
      const result = await batchParseXhsLinks(inputText);

      const updatedNotes: NoteItem[] = result.results.map((item, index) => {
        let status: NoteItem['status'] = 'error';
        if (item.is_valid_url && !item.error && item.title) {
          status = 'success';
        } else if (item.is_valid_url && !item.error && (item.title || item.tags?.length)) {
          status = 'warning';
        } else if (!item.is_valid_url) {
          status = 'error';
        } else if (item.error) {
          status = 'error';
        }

        return {
          ...item,
          status,
          index,
        } as NoteItem;
      });

      setNotes(updatedNotes);
    } catch (err: any) {
      setErrorMsg(err.message || '批量检测失败，请稍后重试');
      setNotes((prev) =>
        prev.map((n) => ({
          ...n,
          status: 'error',
          error: err.message || '检测失败',
        }))
      );
    } finally {
      setIsChecking(false);
    }
  }, [inputText]);

  const handleRetry = useCallback(
    async (url: string) => {
      const noteIndex = notes.findIndex((n) => n.input_url === url);
      if (noteIndex === -1) return;

      setNotes((prev) =>
        prev.map((n, i) => (i === noteIndex ? { ...n, status: 'checking' } : n))
      );

      try {
        const result: XhsVideoResult = await parseSingleXhsLink(url);

        let status: NoteItem['status'] = 'error';
        if (result.is_valid_url && !result.error && result.title) {
          status = 'success';
        } else if (result.is_valid_url && !result.error && (result.title || result.tags?.length)) {
          status = 'warning';
        }

        setNotes((prev) =>
          prev.map((n, i) =>
            i === noteIndex
              ? ({ ...result, status, index: noteIndex } as NoteItem)
              : n
          )
        );
      } catch (err: any) {
        setNotes((prev) =>
          prev.map((n, i) =>
            i === noteIndex
              ? { ...n, status: 'error', error: err.message || '检测失败' }
              : n
          )
        );
      }
    },
    [notes]
  );

  const handleClear = () => {
    setNotes([]);
    setErrorMsg('');
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (errorMsg) setErrorMsg('');
  };

  const urlCount = extractUrls(inputText).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-100 text-rose-600 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            批量审核工具
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            小红书笔记批量审核
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            粘贴多条小红书链接，一键批量检测有效性并提取标题、发布时间和标签
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg shadow-rose-100/50 p-5 md:p-7 mb-6 border border-rose-50">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="w-4 h-4 text-rose-500" />
            <label className="text-sm font-medium text-gray-700">
              输入小红书链接（支持多条，每行一个）
            </label>
            {urlCount > 0 && (
              <span className="ml-auto text-xs text-rose-500 font-medium">
                已识别 {urlCount} 条链接
              </span>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={handleTextareaChange}
            placeholder={`例如：\nhttps://www.xiaohongshu.com/explore/xxxxxxxxxxxxxxxxxxxxxxxx\nhttps://www.xiaohongshu.com/discovery/item/xxxxxxxxxxxxxxxxxxxxxxxx`}
            className="w-full h-40 md:h-48 p-4 border border-gray-200 rounded-2xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all resize-none bg-gray-50/50"
          />
          {errorMsg && (
            <div className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl p-3 border border-red-100">
              {errorMsg}
            </div>
          )}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleBatchCheck}
              disabled={isChecking || urlCount === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-medium rounded-2xl shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  检测中...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  批量检测
                </>
              )}
            </button>
            {notes.length > 0 && (
              <button
                onClick={handleClear}
                className="px-5 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-2xl font-medium transition-colors"
              >
                清空结果
              </button>
            )}
          </div>
        </div>

        <StatsBar notes={notes} onClear={handleClear} />

        {notes.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {notes.map((note) => (
              <NoteCard key={note.index + note.input_url} note={note} onRetry={handleRetry} />
            ))}
          </div>
        )}

        {notes.length === 0 && !isChecking && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-rose-50 rounded-full flex items-center justify-center">
              <LinkIcon className="w-10 h-10 text-rose-300" />
            </div>
            <p className="text-gray-400 text-sm">粘贴小红书链接开始检测</p>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-gray-400">
          <p>数据来源于小红书公开页面，仅供内容审核参考</p>
        </div>
      </div>
    </div>
  );
}