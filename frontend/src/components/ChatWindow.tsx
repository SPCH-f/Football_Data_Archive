/**
 * ChatWindow — main chat interface with message list and input.
 * Translated to Thai with premium welcomes and suggestion chips.
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
      // Handled via window method
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
    "อาร์เซนอล ปะทะ แมนฯ ซิตี้ ใครมีโอกาสชนะมากกว่ากัน?",
    "ขอดูอันดับตารางคะแนนพรีเมียร์ลีกอังกฤษล่าสุดหน่อย",
    "เปรียบเทียบฟอร์มล่าสุดของ ลิเวอร์พูล กับ เชลซี",
    "โปรแกรมการแข่งขันยูฟ่า แชมเปียนส์ลีก มีคู่ไหนน่าสนใจบ้าง?",
  ]

  return (
    <div className="flex flex-col h-full bg-[#0a111a]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center animate-fade-in">
            <div className="text-5xl mb-5 animate-bounce">⚽</div>
            <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              คุยเรื่องบอลกับ AI อัจฉริยะ
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mb-8 leading-relaxed">
              ถามสถิติต่างๆ ตารางคะแนน เปรียบเทียบฟอร์มทีมการแข่งขัน หรือวิเคราะห์เชิงลึกด้วยฐานข้อมูล RAG ประมวลผลแบบเรียลไทม์
            </p>
            <div className="grid grid-cols-1 gap-2.5 w-full">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-3.5 rounded-xl text-left text-xs text-slate-300 hover:text-emerald-400 transition-all duration-200 shadow-md active:scale-98 flex items-center"
                >
                  <span className="text-emerald-500 mr-2.5 font-bold">➜</span>
                  <span className="truncate">{s}</span>
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
        <div className="mx-4 mb-2 px-4 py-2.5 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 text-xs">
          ⚠️ เกิดข้อผิดพลาด: {error}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/20">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ถามข้อมูลฟุตบอลที่นี่... (กด Enter เพื่อส่งข้อความ)"
              rows={1}
              className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/50 resize-none min-h-[48px] max-h-[120px] pr-4 text-xs sm:text-sm transition-all shadow-inner"
              disabled={isStreaming}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="h-[48px] px-6 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center gap-1.5"
          >
            {isStreaming ? (
              <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
            ) : (
              <span>ส่งคำถาม</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
