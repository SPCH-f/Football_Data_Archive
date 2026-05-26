/**
 * Axios HTTP client + typed API calls for the Football RAG Chatbot.
 */
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Types ───────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  retrieved_docs?: Record<string, unknown>
  created_at: string
}

export interface ChatSession {
  id: string
  title?: string
  created_at: string
  messages: ChatMessage[]
  message_count?: number
}

export interface Team {
  id: number
  name: string
  short_name?: string
  country?: string
  logo_url?: string
}

export interface MatchData {
  id: number
  competition_name?: string
  home_team?: Team
  away_team?: Team
  match_date: string
  status: string
  home_score?: number
  away_score?: number
  venue?: string
  matchday?: number
  h2h?: Array<{
    date: string
    home_team: string
    away_team: string
    home_score: number
    away_score: number
  }>
  home_form?: string[]
  away_form?: string[]
}

export interface StandingEntry {
  position: number
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  form?: string
}

export interface StandingsTable {
  competition: string
  season: string
  standings: StandingEntry[]
}

// ── Chat API ────────────────────────────────────────────────
export const chatAPI = {
  createSession: (title?: string) =>
    api.post<ChatSession>('/chat/sessions', { title }),

  getSession: (sessionId: string) =>
    api.get<ChatSession>(`/chat/sessions/${sessionId}`),

  listSessions: (limit = 20) =>
    api.get<{ sessions: ChatSession[] }>('/chat/sessions', { params: { limit } }),

  deleteSession: (sessionId: string) =>
    api.delete(`/chat/sessions/${sessionId}`),
}

// ── Matches API ─────────────────────────────────────────────
export const matchesAPI = {
  getUpcoming: (limit = 10, competition?: string) =>
    api.get<MatchData[]>('/matches/upcoming', {
      params: { limit, competition },
    }),

  getMatch: (matchId: number) =>
    api.get<MatchData>(`/matches/${matchId}`),

  getStandings: (competitionCode: string) =>
    api.get<StandingsTable>(`/matches/standings/${competitionCode}`),

  getTeamForm: (teamId: number) =>
    api.get<{ team: Team; form: string[] }>(`/matches/teams/${teamId}/form`),
}

export default api
