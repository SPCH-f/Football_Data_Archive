/**
 * ComparisonPage — Side-by-side Team Comparison & AI Match Simulator.
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchesAPI } from '@/api/client'

interface ComparisonPageProps {
  onPredictMatch: (prompt: string) => void
}

const LEAGUES = [
  { code: 'PL', name: 'Premier League (England)' },
  { code: 'PD', name: 'La Liga (Spain)' },
  { code: 'SA', name: 'Serie A (Italy)' },
  { code: 'BL1', name: 'Bundesliga (Germany)' },
  { code: 'FL1', name: 'Ligue 1 (France)' },
]

function SafeCrest({ src, alt, fallbackText }: { src?: string; alt: string; fallbackText: string }) {
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
  }, [src])

  if (!src || error) {
    return (
      <span className="text-lg font-bold text-slate-500 select-none uppercase">
        {fallbackText[0] || '?'}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain"
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  )
}

export default function ComparisonPage({ onPredictMatch }: ComparisonPageProps) {
  const [selectedLeague, setSelectedLeague] = useState('PL')
  const [teamAId, setTeamAId] = useState<number | ''>('')
  const [teamBId, setTeamBId] = useState<number | ''>('')

  // Fetch standings for the chosen league to populate teams and stats
  const { data: standingsData, isLoading, error } = useQuery({
    queryKey: ['standings', selectedLeague],
    queryFn: async () => {
      const res = await matchesAPI.getStandings(selectedLeague)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Extract entries
  const entries = standingsData?.standings || []

  // Get active teams details
  const teamAEntry = entries.find((e) => e.team.id === teamAId)
  const teamBEntry = entries.find((e) => e.team.id === teamBId)

  // Fetch Team A form
  const { data: teamAFormRes } = useQuery({
    queryKey: ['team-form', teamAId],
    queryFn: async () => {
      if (!teamAId) return null
      const res = await matchesAPI.getTeamForm(teamAId)
      return res.data
    },
    enabled: !!teamAId,
  })

  // Fetch Team B form
  const { data: teamBFormRes } = useQuery({
    queryKey: ['team-form', teamBId],
    queryFn: async () => {
      if (!teamBId) return null
      const res = await matchesAPI.getTeamForm(teamBId)
      return res.data
    },
    enabled: !!teamBId,
  })

  const handleSimulate = () => {
    if (!teamAEntry || !teamBEntry) return
    const homeName = teamAEntry.team.name
    const awayName = teamBEntry.team.name
    const prompt = `ช่วยทำนายและจำลองผลการแข่งขัน (AI Match Simulation) ระหว่าง ${homeName} (เจ้าบ้าน) vs ${awayName} (เยือน) โดยวิเคราะห์จากอันดับตารางคะแนน, ผลประตูได้เสีย และฟอร์มการเล่นล่าสุดให้หน่อย`
    onPredictMatch(prompt)
  }

  // Helper to render stat bar
  const renderStatBar = (label: string, valA: number, valB: number) => {
    const total = valA + valB || 1
    const pctA = (valA / total) * 100
    const pctB = (valB / total) * 100

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-bold text-slate-300 px-1">
          <span className="text-emerald-400">{valA}</span>
          <span className="uppercase text-[10px] text-slate-500 tracking-wider font-semibold">{label}</span>
          <span className="text-cyan-400">{valB}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex bg-slate-900 border border-slate-900">
          <div 
            className="bg-emerald-500 transition-all duration-300"
            style={{ width: `${pctA}%` }}
          />
          <div 
            className="bg-cyan-400 transition-all duration-300"
            style={{ width: `${pctB}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#0a111a] text-slate-100 min-h-screen">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center space-y-2 pb-2">
        <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-800/30">
          ⚔️ Head-to-Head Arena
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Team Comparison & Match Simulator
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          Compare team statistics side-by-side and run an AI-powered tactical simulation for the upcoming fixture.
        </p>
      </div>

      <div className="max-w-4xl mx-auto bg-[#0b131f] border border-slate-900 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6">
        
        {/* League & Team Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* League Select */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Competition</label>
            <select
              value={selectedLeague}
              onChange={(e) => {
                setSelectedLeague(e.target.value)
                setTeamAId('')
                setTeamBId('')
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-emerald-500/50 outline-none"
            >
              {LEAGUES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Team A Select */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Home Team (Team A)</label>
            <select
              value={teamAId}
              onChange={(e) => setTeamAId(Number(e.target.value) || '')}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-emerald-500/50 outline-none"
            >
              <option value="">-- Choose Team A --</option>
              {entries
                .filter((e) => e.team.id !== teamBId)
                .map((e) => (
                  <option key={e.team.id} value={e.team.id}>
                    {e.position}. {e.team.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Team B Select */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Away Team (Team B)</label>
            <select
              value={teamBId}
              onChange={(e) => setTeamBId(Number(e.target.value) || '')}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-emerald-500/50 outline-none"
            >
              <option value="">-- Choose Team B --</option>
              {entries
                .filter((e) => e.team.id !== teamAId)
                .map((e) => (
                  <option key={e.team.id} value={e.team.id}>
                    {e.position}. {e.team.name}
                  </option>
                ))}
            </select>
          </div>

        </div>

        {/* Loading / Empty States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading standings & statistics...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-xs text-slate-500">
            Failed to retrieve competition teams.
          </div>
        )}

        {!isLoading && !error && (!teamAEntry || !teamBEntry) && (
          <div className="bg-slate-950/30 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
            Select both Home and Away teams to view comparison stats and run simulation.
          </div>
        )}

        {/* Active Comparison Pane */}
        {!isLoading && !error && teamAEntry && teamBEntry && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Team Crests & Positions */}
            <div className="grid grid-cols-3 items-center justify-items-center bg-slate-950/40 p-4 rounded-xl border border-slate-900">
              {/* Team A Info */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center p-2">
                  <SafeCrest
                    src={teamAEntry.team.logo_url}
                    alt={teamAEntry.team.name}
                    fallbackText={teamAEntry.team.name}
                  />
                </div>
                <div className="text-xs sm:text-sm font-extrabold uppercase text-slate-200">{teamAEntry.team.name}</div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Position: #{teamAEntry.position}</span>
              </div>

              {/* VS */}
              <div className="text-center">
                <span className="text-xs font-black tracking-widest text-slate-600 uppercase">VS</span>
              </div>

              {/* Team B Info */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center p-2">
                  <SafeCrest
                    src={teamBEntry.team.logo_url}
                    alt={teamBEntry.team.name}
                    fallbackText={teamBEntry.team.name}
                  />
                </div>
                <div className="text-xs sm:text-sm font-extrabold uppercase text-slate-200">{teamBEntry.team.name}</div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Position: #{teamBEntry.position}</span>
              </div>
            </div>

            {/* Form row */}
            <div className="grid grid-cols-2 gap-4 text-center">
              {/* Form A */}
              <div className="bg-slate-950/20 p-3 rounded-xl border border-slate-900/40 flex flex-col items-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Recent Form</span>
                <div className="flex gap-1">
                  {teamAFormRes?.form && teamAFormRes.form.length > 0 ? (
                    teamAFormRes.form.slice(-5).map((f, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center text-white
                          ${f === 'W' ? 'bg-green-600' : f === 'D' ? 'bg-yellow-600' : 'bg-red-650'}`}
                      >
                        {f}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500">No recent stats</span>
                  )}
                </div>
              </div>

              {/* Form B */}
              <div className="bg-slate-950/20 p-3 rounded-xl border border-slate-900/40 flex flex-col items-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Recent Form</span>
                <div className="flex gap-1">
                  {teamBFormRes?.form && teamBFormRes.form.length > 0 ? (
                    teamBFormRes.form.slice(-5).map((f, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center text-white
                          ${f === 'W' ? 'bg-green-600' : f === 'D' ? 'bg-yellow-600' : 'bg-red-650'}`}
                      >
                        {f}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500">No recent stats</span>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison Stats List */}
            <div className="space-y-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-900 pb-2">
                📈 Season Statistics Comparison
              </h4>
              
              {renderStatBar('League Points', teamAEntry.points, teamBEntry.points)}
              {renderStatBar('Matches Played', teamAEntry.played, teamBEntry.played)}
              {renderStatBar('Matches Won', teamAEntry.won, teamBEntry.won)}
              {renderStatBar('Matches Drawn', teamAEntry.drawn, teamBEntry.drawn)}
              {renderStatBar('Matches Lost', teamAEntry.lost, teamBEntry.lost)}
              {renderStatBar('Goals Scored', teamAEntry.goals_for, teamBEntry.goals_for)}
              {renderStatBar('Goals Conceded', teamAEntry.goals_against, teamBEntry.goals_against)}
              {renderStatBar('Goal Difference', teamAEntry.goal_difference + 50, teamBEntry.goal_difference + 50)}
            </div>

            {/* Simulation Trigger Box */}
            <div className="flex flex-col items-center pt-2">
              <button
                onClick={handleSimulate}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 text-xs font-black tracking-widest uppercase rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-98 flex items-center gap-2"
              >
                🔮 Run AI Simulation
              </button>
              <span className="text-[10px] text-slate-500 mt-2">
                This will trigger RAG AI model to generate scores, tactics, and H2H predictions.
              </span>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
