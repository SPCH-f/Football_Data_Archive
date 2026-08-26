/**
 * MessageBubble — renders a single chat message with markdown support.
 * Translated to Thai and upgraded with premium dark-theme styles.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/api/client'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex w-full animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 ${
          isUser
            ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-slate-950 rounded-br-md font-medium shadow-md shadow-emerald-500/5'
            : 'bg-[#0b131f] border border-slate-900 text-slate-100 rounded-bl-md shadow-lg'
        }`}
      >
        {/* Avatar + Role */}
        <div className="flex items-center gap-2 mb-1.5 border-b border-slate-900/10 pb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isUser ? 'text-slate-950/80' : 'text-emerald-400'}`}>
            {isUser ? '👤 คุณ' : '🤖 AI วิเคราะห์บอล'}
          </span>
        </div>

        {/* Content */}
        {isUser ? (
          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-xs sm:prose-sm max-w-none 
                          prose-p:my-1.5 prose-li:my-0.5
                          prose-headings:text-emerald-400
                          prose-strong:text-emerald-400
                          prose-code:text-emerald-450 prose-code:bg-slate-950 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-a:text-emerald-450 prose-a:no-underline hover:prose-a:underline
                          prose-table:border-slate-800
                          prose-th:border-slate-800 prose-th:text-slate-300
                          prose-td:border-slate-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim() || (isStreaming ? '' : '...')}
            </ReactMarkdown>
            {isStreaming && !message.content && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse [animation-delay:150ms]" />
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse [animation-delay:300ms]" />
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className={`mt-2 text-[9px] ${isUser ? 'text-slate-900/60' : 'text-slate-500'} font-semibold`}>
          {new Date(message.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
      </div>
    </div>
  )
}
