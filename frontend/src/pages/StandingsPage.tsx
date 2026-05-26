/**
 * StandingsPage — Browse league tables for tracked football competitions.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchesAPI } from '@/api/client'
import StandingsTable from '@/components/StandingsTable'

interface LeagueOption {
  code: string
  name: string
  country: string
  icon: string
  color: string
}

const LEAGUES: LeagueOption[] = [
  { code: 'PL', name: 'Premier League', country: 'England', icon: '🦁', color: 'from-purple-600 to-indigo-600' },
  { code: 'PD', name: 'La Liga', country: 'Spain', icon: '🇪🇸', color: 'from-amber-500 to-red-600' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany', icon: '🇩🇪', color: 'from-red-600 to-black' },
  { code: 'SA', name: 'Serie A', country: 'Italy', icon: '🇮🇹', color: 'from-blue-600 to-cyan-500' },
  { code: 'FL1', name: 'Ligue 1', country: 'France', icon: '🇫🇷', color: 'from-emerald-500 to-teal-700' },
  { code: 'CL', name: 'Champions League', country: 'Europe', icon: '⭐', color: 'from-blue-900 to-indigo-950' },
]

export default function StandingsPage() {
  const [selectedLeague, setSelectedLeague] = useState<string>('PL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: standingsData, isLoading, error } = useQuery({
    queryKey: ['standings', selectedLeague],
    queryFn: async () => {
      const res = await matchesAPI.getStandings(selectedLeague)
      return res.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Filter standings based on search query
  const filteredStandings = standingsData
    ? {
        ...standingsData,
        standings: standingsData.standings.filter((entry) =>
          entry.team.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }
    : null

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-stadium-900/80 to-stadium-850/80 p-6 sm:p-8 border border-stadium-700/30">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-56 h-56 rounded-full bg-pitch-600/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-pitch-400 bg-pitch-950/50 px-3 py-1 rounded-full border border-pitch-800/30">
            Live Statistics
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            League Standings
          </h1>
          <p className="text-sm text-stadium-400 max-w-xl">
            Browse real-time standings, team form, goal statistics, and ranking updates for the top European leagues.
          </p>
        </div>
      </div>

      {/* League Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {LEAGUES.map((league) => {
          const isActive = selectedLeague === league.code
          return (
            <button
              key={league.code}
              onClick={() => {
                setSelectedLeague(league.code)
                setSearchQuery('')
              }}
              className={`group relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 active:scale-98
                ${
                  isActive
                    ? 'bg-gradient-to-br from-stadium-800/80 to-stadium-900/80 border-pitch-500 shadow-lg shadow-pitch-600/5'
                    : 'glass-card-hover border-stadium-800'
                }`}
            >
              {/* Top border colored glow line on active */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-pitch-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" />
              )}
              
              <span className="text-2xl mb-1.5 transform group-hover:scale-110 transition-transform duration-200">
                {league.icon}
              </span>
              <span className={`text-sm font-bold text-center ${isActive ? 'text-white' : 'text-stadium-200'}`}>
                {league.name}
              </span>
              <span className="text-[10px] text-stadium-500 mt-0.5">
                {league.country}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search & Stats Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stadium-500">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-stadium-900/50 border border-stadium-800 rounded-xl
                     text-sm text-stadium-100 placeholder:text-stadium-500
                     focus:outline-none focus:ring-2 focus:ring-pitch-500/30 focus:border-pitch-500/50
                     transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-stadium-500 hover:text-stadium-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-stadium-950/20 backdrop-blur-xs rounded-2xl">
            <div className="w-10 h-10 border-4 border-pitch-600/30 border-t-pitch-500 rounded-full animate-spin" />
            <span className="text-sm text-stadium-400 font-medium animate-pulse">Loading standings...</span>
          </div>
        )}

        {error && (
          <div className="glass-card p-8 text-center max-w-md mx-auto space-y-4">
            <span className="text-4xl">⚠️</span>
            <h3 className="text-lg font-bold text-white">Failed to Load Standings</h3>
            <p className="text-sm text-stadium-400">
              Could not retrieve standings data. Make sure the backend scheduler or a manual sync has run.
            </p>
            <button
              onClick={() => {}}
              className="btn-secondary text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && filteredStandings && (
          <div className="animate-fade-in">
            {filteredStandings.standings.length > 0 ? (
              <StandingsTable
                competition={filteredStandings.competition}
                season={filteredStandings.season}
                standings={filteredStandings.standings}
              />
            ) : (
              <div className="glass-card p-12 text-center text-stadium-400">
                No teams matched "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
