/**
 * ChatPage — Primary App Shell with Top Navigation and View Switcher
 * Matches the user-provided "Football AI Analytics" dashboard header style.
 */
import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ChatWindow from '@/components/ChatWindow'
import StandingsPage from '@/pages/StandingsPage'
import MatchPreviewPage from '@/pages/MatchPreviewPage'
import ComparisonPage from '@/pages/ComparisonPage'

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [view, setView] = useState<'preview' | 'comparison' | 'standings' | 'chat'>('preview')
  const queryClient = useQueryClient()

  const handleSessionCreated = useCallback((id: string) => {
    setSessionId(id)
    // Refetch sessions list
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
  }, [queryClient])

  const handlePredictMatch = useCallback((prompt: string) => {
    // Switch to chat view to see prediction
    setView('chat')
    // Trigger the prediction message via global ref
    const trigger = (window as any).__triggerPrediction
    if (trigger) {
      trigger(prompt)
    }
  }, [])

  return (
    <div className="h-screen flex overflow-hidden bg-[#0a111a]">
      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Full-width Top Navbar (Football AI Analytics Theme) */}
        <header className="h-16 bg-[#0B131F] border-b border-slate-900 flex items-center justify-between px-4 sm:px-6 z-30">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-400 to-emerald-500 p-1.5 rounded-lg shadow-md flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-950 font-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <span className="hidden md:flex flex-col leading-none">
              <span className="text-white font-black text-sm tracking-tight">FOOTBALL</span>
              <span className="text-emerald-400 text-[9px] font-black tracking-widest">AI ANALYTICS</span>
            </span>
          </div>

          {/* Center Navigation Links divided by | */}
          <nav className="flex items-center gap-1.5 sm:gap-2.5 text-xs sm:text-sm font-bold text-slate-400 select-none">
            <button
              onClick={() => setView('preview')}
              className={`hover:text-white transition-colors py-1 ${view === 'preview' ? 'text-emerald-400 font-extrabold' : ''}`}
            >
              Previews
            </button>
            <span className="text-slate-700">|</span>
            
            <button
              onClick={() => setView('comparison')}
              className={`hover:text-white transition-colors py-1 ${view === 'comparison' ? 'text-emerald-400 font-extrabold' : ''}`}
            >
              Comparison
            </button>
            <span className="text-slate-700">|</span>

            <button
              onClick={() => setView('standings')}
              className={`hover:text-white transition-colors py-1 ${view === 'standings' ? 'text-emerald-400 font-extrabold' : ''}`}
            >
              Standings
            </button>
            <span className="text-slate-700">|</span>

            <button
              onClick={() => setView('chat')}
              className={`hover:text-white transition-colors py-1 ${view === 'chat' ? 'text-emerald-400 font-extrabold' : ''}`}
            >
              Chat
            </button>
          </nav>

          {/* Placeholder for layout balance */}
          <div className="w-10 sm:w-20" />
        </header>

        {/* Content Area Rendering the Selected View */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'preview' && (
            <MatchPreviewPage onPredictMatch={handlePredictMatch} />
          )}
          {view === 'comparison' && (
            <ComparisonPage onPredictMatch={handlePredictMatch} />
          )}
          {view === 'standings' && (
            <StandingsPage />
          )}
          {view === 'chat' && (
            <ChatWindow
              sessionId={sessionId}
              onSessionCreated={handleSessionCreated}
            />
          )}
        </div>
      </main>
    </div>
  )
}
