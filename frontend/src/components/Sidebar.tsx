/**
 * Sidebar — upcoming matches + quick navigation + session list.
 */
import { useQuery } from '@tanstack/react-query'
import { matchesAPI, chatAPI } from '@/api/client'
import type { MatchData, ChatSession } from '@/api/client'
import MatchCard from './MatchCard'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onPredictMatch: (prompt: string) => void
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
}

export default function Sidebar({
  isOpen,
  onClose,
  onPredictMatch,
  currentSessionId,
  onSelectSession,
  onNewChat,
}: SidebarProps) {
  // Fetch upcoming matches
  const { data: upcomingMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ['upcoming-matches'],
    queryFn: async () => {
      const res = await matchesAPI.getUpcoming(6)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch recent sessions
  const { data: sessionsData } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const res = await chatAPI.listSessions(10)
      return res.data.sessions
    },
    staleTime: 30 * 1000,
  })

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed lg:relative top-0 left-0 h-full w-80 bg-stadium-950/95 backdrop-blur-xl
                    border-r border-stadium-800/50 z-50 transition-transform duration-300
                    flex flex-col overflow-hidden
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-stadium-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <h1 className="text-lg font-bold bg-gradient-to-r from-pitch-400 to-pitch-600 bg-clip-text text-transparent">
              FootballGPT
            </h1>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-stadium-800 transition-colors text-stadium-400"
          >
            ✕
          </button>
        </div>

        {/* New Chat button */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
          >
            <span>+</span> New Chat
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Recent Chats */}
          {sessionsData && sessionsData.length > 0 && (
            <div className="px-3 pb-3">
              <h3 className="px-2 py-2 text-xs font-semibold text-stadium-500 uppercase tracking-wider">
                Recent Chats
              </h3>
              <div className="space-y-1">
                {sessionsData.map((session: ChatSession) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors truncate
                      ${currentSessionId === session.id
                        ? 'bg-pitch-600/20 text-pitch-300 border border-pitch-600/30'
                        : 'text-stadium-300 hover:bg-stadium-800/50 hover:text-stadium-100'
                      }`}
                  >
                    <div className="truncate">
                      {session.title || 'Untitled Chat'}
                    </div>
                    <div className="text-[10px] text-stadium-500 mt-0.5">
                      {new Date(session.created_at).toLocaleDateString()} · {session.message_count || 0} msgs
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Matches */}
          <div className="px-3 pb-4">
            <h3 className="px-2 py-2 text-xs font-semibold text-stadium-500 uppercase tracking-wider">
              Upcoming Matches
            </h3>

            {matchesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-card p-4 animate-pulse">
                    <div className="h-3 bg-stadium-700 rounded w-20 mb-3" />
                    <div className="h-4 bg-stadium-700 rounded w-full mb-2" />
                    <div className="h-3 bg-stadium-700 rounded w-24" />
                  </div>
                ))}
              </div>
            ) : upcomingMatches && upcomingMatches.length > 0 ? (
              <div className="space-y-3">
                {upcomingMatches.map((match: MatchData) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onPredict={onPredictMatch}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-stadium-500 px-2">
                No upcoming matches found. Sync data to see fixtures.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stadium-800/50">
          <div className="text-[10px] text-stadium-600 text-center">
            Powered by RAG · football-data.org · api-football
          </div>
        </div>
      </aside>
    </>
  )
}
