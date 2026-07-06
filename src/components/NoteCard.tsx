import { Copy, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, ExternalLink, Clock, Tag, Video, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import type { NoteItem } from '@/types/xhs';
import { cn } from '@/lib/utils';

interface NoteCardProps {
  note: NoteItem;
  onRetry: (url: string) => void;
}

export default function NoteCard({ note, onRetry }: NoteCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const formatInfoText = () => {
    const lines: string[] = [];
    lines.push(`标题：${note.title || '未知'}`);
    lines.push(`类型：${note.is_video ? '视频' : '图文'}`);
    lines.push(`链接：${note.input_url}`);
    if (note.publish_time) {
      lines.push(`发布时间：${note.publish_time}`);
    }
    if (note.tags && note.tags.length > 0) {
      lines.push(`标签：${note.tags.join('、')}`);
    }
    if (note.error) {
      lines.push(`状态：${note.error}`);
    }
    return lines.join('\n');
  };

  const getStatusConfig = () => {
    switch (note.status) {
      case 'checking':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin text-rose-500" />,
          label: '检测中...',
          borderClass: 'border-rose-200 bg-rose-50/50',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
          label: '解析成功',
          borderClass: 'border-emerald-200 bg-white',
        };
      case 'error':
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          label: '解析失败',
          borderClass: 'border-red-200 bg-red-50/30',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          label: '部分信息缺失',
          borderClass: 'border-amber-200 bg-amber-50/30',
        };
      default:
        return {
          icon: <Clock className="w-5 h-5 text-gray-400" />,
          label: '等待检测',
          borderClass: 'border-gray-200 bg-gray-50/30',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      className={cn(
        'border rounded-2xl p-5 transition-all duration-300 hover:shadow-md',
        statusConfig.borderClass
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-100 text-rose-600 text-xs font-medium flex items-center justify-center">
            {note.index + 1}
          </span>
          <div className="flex items-center gap-1.5">
            {statusConfig.icon}
            <span className="text-xs font-medium text-gray-600">{statusConfig.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => copyToClipboard(note.input_url, 'url')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            title="复制链接"
            disabled={note.status === 'checking'}
          >
            {copied === 'url' ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onRetry(note.input_url)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            title="重新检测"
            disabled={note.status === 'checking'}
          >
            <RefreshCw className={cn('w-4 h-4', note.status === 'checking' && 'animate-spin')} />
          </button>
        </div>
      </div>

      <a
        href={note.input_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-rose-500 hover:text-rose-600 truncate block mb-3 flex items-center gap-1 group"
      >
        <span className="truncate">{note.input_url}</span>
        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>

      {note.status === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>正在解析笔记信息...</span>
        </div>
      )}

      {(note.status === 'success' || note.status === 'warning') && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">标题</span>
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                note.is_video
                  ? 'bg-purple-50 text-purple-600'
                  : 'bg-blue-50 text-blue-600'
              )}>
                {note.is_video ? (
                  <><Video className="w-3 h-3" />视频</>
                ) : (
                  <><ImageIcon className="w-3 h-3" />图文</>
                )}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-800 line-clamp-2">
              {note.title || '未知标题'}
            </div>
          </div>

          {note.publish_time && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600">{note.publish_time}</span>
            </div>
          )}

          {note.tags && note.tags.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                标签
              </div>
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full bg-rose-50 text-rose-600 border border-rose-100"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {note.error && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 border border-amber-100">
              {note.error}
            </div>
          )}

          <button
            onClick={() => copyToClipboard(formatInfoText(), 'info')}
            className="w-full mt-2 py-2 text-xs font-medium text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            {copied === 'info' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                复制完整信息
              </>
            )}
          </button>
        </div>
      )}

      {note.status === 'error' && note.error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">
          {note.error}
        </div>
      )}
    </div>
  );
}