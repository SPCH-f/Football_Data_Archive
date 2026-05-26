/**
 * ChatWindow — main chat interface with message list and input.
 */
import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import { useChat } from '@/hooks/useChat'

interface ChatWindowProps {
  sessionId: string | null
  onSessionCreated: (id: string) => void
  onPredictMatch?: (prompt: string) => void
}

export default function ChatWindow({ sessionId, onSessionCreated, onPredictMatch }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, isStreaming, error, sendMessage } = useChat({
    sessionId,
    onSessionCreated,
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle external predict match requests
  useEffect(() => {
    if (onPredictMatch) {
      // This is set from parent — we don't need to do anything here
    }
  }, [onPredictMatch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const msg = input.trim()
    setInput('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Allow parent to inject a message
  const triggerPrediction = (prompt: string) => {
    setInput('')
    sendMessage(prompt)
  }

  // Expose via ref if needed
  useEffect(() => {
    (window as any).__triggerPrediction = triggerPrediction
    return () => { delete (window as any).__triggerPrediction }
  }, [sessionId])

  const suggestions = [
    "Who will win Arsenal vs Man City this weekend?",
    "Show me Premier League standings",
    "Compare Liverpool and Chelsea's recent form",
    "What are the upcoming Champions League fixtures?",
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            <div className="text-6xl mb-6">⚽</div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-pitch-400 to-pitch-600 bg-clip-text text-transparent mb-2">
              Football RAG Chatbot
            </h2>
            <p className="text-stadium-400 text-sm mb-8 text-center max-w-md">
              Ask me anything about football — teams, players, standings, or get match predictions powered by real data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="glass-card-hover p-3 text-left text-sm text-stadium-300 
                             hover:text-pitch-300 transition-colors"
                >
                  <span className="text-pitch-500 mr-2">→</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-stadium-800/50">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about football... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="input-field resize-none min-h-[48px] max-h-[120px] pr-4"
              disabled={isStreaming}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="btn-primary h-[48px] px-6 flex items-center gap-2 
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Send</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
