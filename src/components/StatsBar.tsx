import { FileText, CheckCircle, XCircle, AlertTriangle, Copy, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { NoteItem } from '@/types/xhs';

interface StatsBarProps {
  notes: NoteItem[];
  onClear: () => void;
}

export default function StatsBar({ notes, onClear }: StatsBarProps) {
  const [copied, setCopied] = useState(false);

  const total = notes.length;
  const successCount = notes.filter((n) => n.status === 'success').length;
  const errorCount = notes.filter((n) => n.status === 'error').length;
  const warningCount = notes.filter((n) => n.status === 'warning').length;
  const checkingCount = notes.filter((n) => n.status === 'checking').length;

  const copyAllValid = async () => {
    const validNotes = notes.filter((n) => n.status === 'success' || n.status === 'warning');
    const lines = validNotes.map((note, idx) => {
      const parts: string[] = [`【${idx + 1}】`];
      if (note.title) parts.push(`标题：${note.title}`);
      parts.push(`链接：${note.input_url}`);
      if (note.publish_time) parts.push(`发布时间：${note.publish_time}`);
      if (note.tags && note.tags.length > 0) parts.push(`标签：${note.tags.join('、')}`);
      return parts.join('\n');
    });
    const text = lines.join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const exportCSV = () => {
    const validNotes = notes.filter((n) => n.status === 'success' || n.status === 'warning');
    const headers = ['序号', '标题', '链接', '发布时间', '标签', '状态'];
    const rows = validNotes.map((note, idx) => [
      idx + 1,
      note.title || '',
      note.input_url,
      note.publish_time || '',
      note.tags?.join('、') || '',
      note.status === 'success' ? '成功' : '部分信息缺失',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `小红书笔记审核_${new Date().toLocaleDateString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (total === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              共 <span className="font-semibold text-gray-800">{total}</span> 条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-gray-600">
              成功 <span className="font-semibold text-emerald-600">{successCount}</span>
            </span>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-gray-600">
                部分缺失 <span className="font-semibold text-amber-600">{warningCount}</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600">
              失败 <span className="font-semibold text-red-600">{errorCount}</span>
            </span>
          </div>
          {checkingCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">
                检测中 <span className="font-semibold text-rose-600">{checkingCount}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyAllValid}
            disabled={successCount + warningCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-500 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '复制全部'}
          </button>
          <button
            onClick={exportCSV}
            disabled={successCount + warningCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出CSV
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>
        </div>
      </div>
    </div>
  );
}