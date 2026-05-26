/**
 * MessageBubble — renders a single chat message with markdown support.
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
            ? 'bg-pitch-600 text-white rounded-br-md'
            : 'glass-card text-stadium-100 rounded-bl-md'
        }`}
      >
        {/* Avatar + Role */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
            {isUser ? '👤 You' : '⚽ FootballGPT'}
          </span>
        </div>

        {/* Content */}
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none 
                          prose-p:my-1.5 prose-li:my-0.5
                          prose-headings:text-pitch-300
                          prose-strong:text-pitch-300
                          prose-code:text-pitch-300 prose-code:bg-stadium-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-a:text-pitch-400 prose-a:no-underline hover:prose-a:underline
                          prose-table:border-stadium-700
                          prose-th:border-stadium-700 prose-th:text-stadium-300
                          prose-td:border-stadium-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (isStreaming ? '' : '...')}
            </ReactMarkdown>
            {isStreaming && !message.content && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 rounded-full bg-pitch-400 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-pitch-400 animate-pulse [animation-delay:150ms]" />
                <div className="w-2 h-2 rounded-full bg-pitch-400 animate-pulse [animation-delay:300ms]" />
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-2 text-[10px] opacity-40">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
