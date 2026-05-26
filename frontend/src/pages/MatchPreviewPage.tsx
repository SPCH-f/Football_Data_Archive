/**
 * MatchPreviewPage — AI Match Previews & Predictions Dashboard
 * Matches the user-provided "Football AI Analytics" dashboard design.
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchesAPI } from '@/api/client'

interface MatchPreviewPageProps {
  onPredictMatch: (prompt: string) => void
}

function SafeCrest({ src, alt, fallbackText }: { src?: string; alt: string; fallbackText: string }) {
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
  }, [src])

  if (!src || error) {
    return (
      <span className="text-xl sm:text-2xl font-black text-slate-500 select-none uppercase">
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

export default function MatchPreviewPage({ onPredictMatch }: MatchPreviewPageProps) {
  // Fetch upcoming matches to make it dynamic
  const { data: upcomingMatches } = useQuery({
    queryKey: ['upcoming-previews'],
    queryFn: async () => {
      const res = await matchesAPI.getUpcoming(10)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Selected match state. Default to first match or a mock one.
  const [selectedMatchId, setSelectedMatchId] = useState<string>('default')
  const [customQuestion, setCustomQuestion] = useState('')

  // Static/Mock details for the Real Madrid vs Manchester City showcase match
  const showcaseMatch = {
    id: 'default',
    competition_name: 'UEFA Champions League',
    stage: 'Final',
    match_date: '2026-05-20T02:00:00Z',
    venue: 'Santiago Bernabéu',
    referee: 'Michael Oliver',
    home_team: {
      name: 'Real Madrid',
      logo_url: 'https://crests.football-data.org/86.png', // Stable football-data crest URL
    },
    away_team: {
      name: 'Manchester City',
      logo_url: 'https://crests.football-data.org/65.png',
    },
    ai_predictions: {
      predicted_score: '2 - 1',
      win_prob_home: 45,
      win_prob_draw: 20,
      win_prob_away: 35,
      version: 'v4.2',
    },
    h2h: [
      { date: '18 Apr 25', home: 'Man City', away: 'Real Madrid', score: '1 - 1', comp: 'UCL', home_form: 'W', away_form: 'W' },
      { date: '18 Apr 25', home: 'Man City', away: 'Real Madrid', score: '1 - 2', comp: 'UCL', home_form: 'W', away_form: 'W' },
      { date: '28 Mar 25', home: 'Man City', away: 'Real Madrid', score: '1 - 2', comp: 'UCL', home_form: 'D', away_form: 'D' },
      { date: '18 Apr 25', home: 'Man City', away: 'Real Madrid', score: '2 - 0', comp: 'UCL', home_form: 'W', away_form: 'W' },
      { date: '05 Apr 25', home: 'Man City', away: 'Real Madrid', score: '1 - 0', comp: 'UCL', home_form: 'L', away_form: 'W' },
    ],
    lineups: {
      home_formation: '4-3-1-2',
      away_formation: '4-3-3',
      home_players: [
        'Courtois', 'Carvajal', 'Militao', 'Rüdiger',
        'Mendy', 'Valverde', 'Camavinga', 'Bellingham',
        'Vinicius Jr.', 'Rodrygo'
      ],
      away_players: [
        'Ederson', 'Walker', 'Dias', 'Akanji',
        'Gvardiol', 'Rodri', 'De Bruyne', 'Bernardo Silva',
        'Foden', 'Haaland', 'Grealish'
      ]
    },
    suggestion_chips: [
      { type: 'Analytic', text: "Real Madrid's transition vs Man City's high line?" },
      { type: 'Stat', text: "Haaland's performance vs Spanish teams?" },
      { type: 'Player', text: "Bellingham's impact in UCL finals?" }
    ]
  }

  // Get selected match details (either showcase or dynamic)
  const getActiveMatch = () => {
    if (selectedMatchId === 'default' || !upcomingMatches) {
      return showcaseMatch
    }
    const match = upcomingMatches.find(m => String(m.id) === selectedMatchId)
    if (!match) return showcaseMatch

    // Dynamic fallback generation based on real data
    const homeName = match.home_team?.name || 'Home Team'
    const awayName = match.away_team?.name || 'Away Team'
    
    // Deterministic mock generation based on match id hash
    const sumChars = String(match.id).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
    const probHome = 30 + (sumChars % 25)
    const probAway = 25 + ((sumChars * 7) % 25)
    const probDraw = 100 - probHome - probAway

    return {
      id: match.id,
      competition_name: match.competition_name || 'League Match',
      stage: `Matchday ${match.matchday}`,
      match_date: match.match_date,
      venue: match.venue || 'Stadium',
      referee: 'Michael Oliver',
      home_team: {
        name: homeName,
        logo_url: match.home_team?.logo_url || '',
      },
      away_team: {
        name: awayName,
        logo_url: match.away_team?.logo_url || '',
      },
      ai_predictions: {
        predicted_score: `${sumChars % 3} - ${ (sumChars * 3) % 3}`,
        win_prob_home: probHome,
        win_prob_draw: probDraw,
        win_prob_away: probAway,
        version: 'v4.2',
      },
      h2h: [
        { date: 'Last Month', home: homeName, away: awayName, score: '2 - 1', comp: 'League', home_form: 'W', away_form: 'L' },
        { date: 'Last Season', home: awayName, away: homeName, score: '1 - 1', comp: 'League', home_form: 'D', away_form: 'D' },
        { date: 'Last Season', home: homeName, away: awayName, score: '3 - 2', comp: 'League', home_form: 'W', away_form: 'L' },
      ],
      lineups: {
        home_formation: '4-3-3',
        away_formation: '4-4-2',
        home_players: ['Goalkeeper', 'Defender 1', 'Defender 2', 'Defender 3', 'Defender 4', 'Midfielder 1', 'Midfielder 2', 'Midfielder 3', 'Forward 1', 'Forward 2', 'Forward 3'],
        away_players: ['Goalkeeper', 'Defender 1', 'Defender 2', 'Defender 3', 'Defender 4', 'Midfielder 1', 'Midfielder 2', 'Midfielder 3', 'Midfielder 4', 'Forward 1', 'Forward 2']
      },
      suggestion_chips: [
        { type: 'Analytic', text: `Tactical comparison of ${homeName} vs ${awayName}?` },
        { type: 'Stat', text: `Key stats for ${homeName} this season?` },
        { type: 'Player', text: `Form of ${awayName}'s key attackers?` }
      ]
    }
  }

  const activeMatch = getActiveMatch()

  const handleSendPrompt = (text: string) => {
    if (!text.trim()) return
    onPredictMatch(text)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#0a111a] text-slate-100 min-h-screen">
      {/* Top Match Switcher Row */}
      {upcomingMatches && upcomingMatches.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 border-b border-slate-800 no-scrollbar">
          <button
            onClick={() => setSelectedMatchId('default')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap
              ${selectedMatchId === 'default' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' 
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            🏆 Showcase: Real Madrid vs Man City
          </button>
          
          {upcomingMatches.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMatchId(String(m.id))}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap
                ${selectedMatchId === String(m.id) 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' 
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'}`}
            >
              ⚽ {m.home_team?.name} vs {m.away_team?.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Preview Container */}
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Match Preview Card */}
        <div className="bg-[#0b131f] border border-cyan-950 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
          
          {/* Card Title */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-amber-500 text-base">🏆</span>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-300">
              MATCH PREVIEW ({activeMatch.competition_name} - {activeMatch.stage}, {new Date(activeMatch.match_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })})
            </h2>
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-3 items-center justify-items-center mb-6 max-w-3xl mx-auto">
            {/* Home Team */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-950/60 rounded-full flex items-center justify-center border border-slate-800 p-2.5 shadow-md">
                <SafeCrest
                  src={activeMatch.home_team.logo_url}
                  alt={activeMatch.home_team.name}
                  fallbackText={activeMatch.home_team.name}
                />
              </div>
              <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase">{activeMatch.home_team.name}</span>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black tracking-widest text-cyan-500/40 uppercase">VS</span>
              <div className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                <div>Kick-off: {new Date(activeMatch.match_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</div>
                <div className="truncate max-w-[150px]">{activeMatch.venue}</div>
                <div>Ref: {activeMatch.referee}</div>
              </div>
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-950/60 rounded-full flex items-center justify-center border border-slate-800 p-2.5 shadow-md">
                <SafeCrest
                  src={activeMatch.away_team.logo_url}
                  alt={activeMatch.away_team.name}
                  fallbackText={activeMatch.away_team.name}
                />
              </div>
              <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase">{activeMatch.away_team.name}</span>
            </div>
          </div>

          {/* AI Win Probability */}
          <div className="border-t border-slate-800/60 pt-5 max-w-4xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  AI WIN PROBABILITY ({activeMatch.ai_predictions.version})
                </span>
              </div>
              <div className="text-xs font-extrabold tracking-wider text-cyan-400">
                Predicted Score: <span className="text-sm text-green-400 font-black">{activeMatch.ai_predictions.predicted_score}</span>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div className="h-6 rounded-full overflow-hidden flex text-[9px] font-black text-black select-none shadow-inner">
              <div 
                className="bg-green-500 flex items-center justify-center transition-all duration-500" 
                style={{ width: `${activeMatch.ai_predictions.win_prob_home}%` }}
              >
                [{activeMatch.home_team.name.toUpperCase()}: {activeMatch.ai_predictions.win_prob_home}%]
              </div>
              <div 
                className="bg-cyan-400 flex items-center justify-center transition-all duration-500" 
                style={{ width: `${activeMatch.ai_predictions.win_prob_draw}%` }}
              >
                [DRAW: {activeMatch.ai_predictions.win_prob_draw}%]
              </div>
              <div 
                className="bg-sky-500 flex items-center justify-center transition-all duration-500" 
                style={{ width: `${activeMatch.ai_predictions.win_prob_away}%` }}
              >
                [{activeMatch.away_team.name.toUpperCase()}: {activeMatch.ai_predictions.win_prob_away}%]
              </div>
            </div>

            {/* Tactical button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => handleSendPrompt(`ช่วยวิเคราะห์ยุทธศาสตร์และแผนการเล่น (Tactical Analysis) ของคู่ ${activeMatch.home_team.name} vs ${activeMatch.away_team.name} ให้หน่อย`)}
                className="px-6 py-2 bg-[#0c1929] border border-cyan-500/30 rounded-xl text-xs font-extrabold tracking-wider text-cyan-400 hover:bg-cyan-500/10 hover:text-white transition-all shadow-md active:scale-95 uppercase"
              >
                Ask AI for Tactical Analysis
              </button>
            </div>
          </div>
        </div>

        {/* Sub Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* H2H & Form Card */}
          <div className="bg-[#0b131f] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3">
              📊 H2H & FORM <span className="text-[10px] text-slate-500 font-medium">(Last meetings)</span>
            </h3>

            {/* Form row */}
            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-900/50">
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{activeMatch.home_team.name}</div>
                <div className="flex gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                  <span className="w-5 h-5 rounded-md bg-yellow-600 text-[10px] font-black flex items-center justify-center text-white">D</span>
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                  <span className="w-5 h-5 rounded-md bg-red-600 text-[10px] font-black flex items-center justify-center text-white">L</span>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-600">VS</span>
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{activeMatch.away_team.name}</div>
                <div className="flex gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                  <span className="w-5 h-5 rounded-md bg-yellow-600 text-[10px] font-black flex items-center justify-center text-white">D</span>
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                  <span className="w-5 h-5 rounded-md bg-green-600 text-[10px] font-black flex items-center justify-center text-white">W</span>
                </div>
              </div>
            </div>

            {/* List H2H */}
            <div className="space-y-2">
              {activeMatch.h2h.map((h, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-950/20 p-2.5 rounded-lg border border-slate-900/30">
                  <span className="text-[10px] text-slate-500 font-bold">{h.date}</span>
                  <div className="flex items-center gap-1.5 min-w-[200px] justify-center">
                    <span className="truncate max-w-[80px] font-medium text-slate-300">{h.home}</span>
                    <span className="bg-slate-950 border border-slate-800 text-[10px] font-black px-2 py-0.5 rounded text-cyan-400">{h.score}</span>
                    <span className="truncate max-w-[80px] font-medium text-slate-300">{h.away}</span>
                  </div>
                  <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-extrabold px-1.5 py-0.5 rounded uppercase">{h.comp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Predicted Starting Lineups Card */}
          <div className="bg-[#0b131f] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3">
              📋 PREDICTED STARTING LINEUPS
            </h3>

            {/* Formations Info */}
            <div className="grid grid-cols-2 text-center text-xs font-bold text-cyan-400 border-b border-slate-850 pb-2">
              <div>{activeMatch.home_team.name.toUpperCase()} ({activeMatch.lineups.home_formation})</div>
              <div>{activeMatch.away_team.name.toUpperCase()} ({activeMatch.lineups.away_formation})</div>
            </div>

            {/* Player Columns */}
            <div className="grid grid-cols-2 text-xs divide-x divide-slate-800/50">
              {/* Home Lineup */}
              <div className="pr-4 space-y-1.5 text-slate-300">
                {activeMatch.lineups.home_players.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-0.5 border-b border-slate-900/10">
                    <span>{p}</span>
                    <span className="text-[9px] text-slate-500 font-bold"># {i + 1}</span>
                  </div>
                ))}
                <div className="text-[9px] text-amber-500/80 font-bold mt-2 italic">Missing players: Include</div>
              </div>

              {/* Away Lineup */}
              <div className="pl-4 space-y-1.5 text-slate-300">
                {activeMatch.lineups.away_players.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-0.5 border-b border-slate-900/10">
                    <span>{p}</span>
                    <span className="text-[9px] text-slate-500 font-bold"># {i + 1}</span>
                  </div>
                ))}
                <div className="text-[9px] text-amber-500/80 font-bold mt-2 italic">Missing players: Include</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Chat Assistant Card */}
        <div className="bg-[#0b131f] border border-cyan-950 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="text-red-500 font-extrabold text-sm">?</span>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-300">
              CURIOUS ABOUT MATCH DETAILS? <span className="text-green-400">ASK AI!</span>
            </h3>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex flex-wrap gap-2.5">
            {activeMatch.suggestion_chips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSendPrompt(`[${chip.type}] ${chip.text}`)}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl px-4 py-2 text-[10px] sm:text-xs text-cyan-400 font-medium transition-all duration-200 active:scale-95 text-left"
              >
                <span className="font-bold text-slate-500 mr-1">[{chip.type}]</span> {chip.text}
              </button>
            ))}
          </div>

          {/* Prompt Send Box */}
          <div className="relative pt-2">
            <input
              type="text"
              placeholder="Ask anything, e.g., 'Analytic: Analyze Pep Guardiola's past UCL finals strategy'..."
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleSendPrompt(customQuestion); setCustomQuestion('') } }}
              className="w-full bg-slate-950 border border-cyan-950 focus:border-cyan-400 rounded-xl py-3.5 pl-4 pr-24 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-cyan-500/25 transition-all shadow-inner"
            />
            <button
              onClick={() => { handleSendPrompt(customQuestion); setCustomQuestion('') }}
              className="absolute right-2.5 top-[18px] bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-cyan-400 hover:text-white transition-all duration-150 active:scale-95 flex items-center gap-1.5"
            >
              Send <span className="text-xs">➜</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
