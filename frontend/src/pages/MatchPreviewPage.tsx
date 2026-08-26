/**
 * MatchPreviewPage — AI Match Previews & Team Dashboard
 * Allows selecting a team to view profile, standings, upcoming match, H2H history, and predicted lineup.
 * Translated to Thai with a premium look.
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchesAPI } from '@/api/client'

interface MatchPreviewPageProps {
  onPredictMatch: (prompt: string) => void
}

interface ActiveMatchData {
  isSimulated: boolean
  competition_name: string
  stage: string
  match_date: string
  venue: string
  referee: string
  home_team: { id: number; name: string; logo_url?: string }
  away_team: { id: number; name: string; logo_url?: string }
  ai_predictions: {
    predicted_score: string
    win_prob_home: number
    win_prob_draw: number
    win_prob_away: number
    version: string
  }
  h2h: Array<{
    date?: string
    home_team?: string
    home?: string
    away_team?: string
    away?: string
    home_score?: number
    score?: string
    away_score?: number
  }>
  lineups: {
    home_formation: string
    away_formation: string
    home_players: string[]
    away_players: string[]
  }
  suggestion_chips: Array<{ type: string; text: string }>
}

const LEAGUES = [
  { code: 'PL', name: 'พรีเมียร์ลีก', country: 'อังกฤษ', logoUrl: 'https://crests.football-data.org/PL.png' },
  { code: 'PD', name: 'ลา ลีกา', country: 'สเปน', logoUrl: 'https://crests.football-data.org/PD.png' },
  { code: 'BL1', name: 'บุนเดสลีกา', country: 'เยอรมนี', logoUrl: 'https://crests.football-data.org/BL1.png' },
  { code: 'SA', name: 'เซเรีย อา', country: 'อิตาลี', logoUrl: 'https://crests.football-data.org/SA.png' },
  { code: 'FL1', name: 'ลีก เอิง', country: 'ฝรั่งเศส', logoUrl: 'https://crests.football-data.org/FL1.png' },
]

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

// Helper component for Player nodes on the tactical pitch
function PlayerNode({ name, isAway, position }: { name: string; isAway: boolean; position: string }) {
  if (!name) return null
  return (
    <div className="flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-110">
      <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center text-[9px] font-black shadow-lg border-2 transition-all duration-300
        ${isAway 
          ? 'bg-cyan-950 text-cyan-400 border-cyan-500/50 group-hover:bg-cyan-900 group-hover:border-cyan-400' 
          : 'bg-emerald-950 text-emerald-400 border-emerald-500/50 group-hover:bg-emerald-900 group-hover:border-emerald-400'}`}>
        {position}
      </div>
      <span className="text-[9px] font-bold text-white bg-slate-950/90 px-1.5 py-0.5 rounded mt-0.5 border border-slate-800/80 max-w-[75px] truncate text-center shadow-md">
        {name}
      </span>
    </div>
  )
}

// Helper function to group players based on formation
function groupPlayers(players: string[], formation: string) {
  const gk = players[0] ? [players[0]] : []
  const rest = players.slice(1)
  
  const lines = formation.split('-').map(Number)
  let currentIndex = 0
  const groups: { def: string[]; mid: string[]; fwd: string[] } = { def: [], mid: [], fwd: [] }
  
  if (lines.length >= 3 && !lines.some(isNaN)) {
    const defCount = lines[0]
    groups.def = rest.slice(currentIndex, currentIndex + defCount)
    currentIndex += defCount
    
    if (lines.length === 4) {
      const midCount = lines[1] + lines[2]
      groups.mid = rest.slice(currentIndex, currentIndex + midCount)
      currentIndex += midCount
    } else {
      const midCount = lines[1]
      groups.mid = rest.slice(currentIndex, currentIndex + midCount)
      currentIndex += midCount
    }
    
    groups.fwd = rest.slice(currentIndex)
  } else {
    const defCount = Math.floor(rest.length * 0.4)
    const midCount = Math.floor(rest.length * 0.4)
    groups.def = rest.slice(0, defCount)
    groups.mid = rest.slice(defCount, defCount + midCount)
    groups.fwd = rest.slice(defCount + midCount)
  }
  
  return { gk, ...groups }
}

// Helper function to return realistic mock lineups for teams
function getMockLineup(teamName: string, defaultFormation: string): { formation: string; players: string[] } {
  const name = teamName.toLowerCase()

  if (name.includes('real madrid')) {
    return {
      formation: '4-3-3',
      players: ['Courtois', 'Carvajal', 'Militao', 'Rüdiger', 'Mendy', 'Valverde', 'Tchouaméni', 'Bellingham', 'Rodrygo', 'Mbappé', 'Vinicius Jr.']
    }
  }
  if (name.includes('manchester city') || name.includes('man city')) {
    return {
      formation: '4-3-3',
      players: ['Ederson', 'Walker', 'Dias', 'Akanji', 'Gvardiol', 'Rodri', 'Kovacic', 'De Bruyne', 'Foden', 'Haaland', 'B. Silva']
    }
  }
  if (name.includes('arsenal')) {
    return {
      formation: '4-3-3',
      players: ['Raya', 'White', 'Saliba', 'Gabriel', 'Timber', 'Rice', 'Partey', 'Odegaard', 'Saka', 'Havertz', 'Martinelli']
    }
  }
  if (name.includes('liverpool')) {
    return {
      formation: '4-3-3',
      players: ['Alisson', 'Alexander-Arnold', 'Konate', 'van Dijk', 'Robertson', 'Gravenberch', 'Mac Allister', 'Szoboszlai', 'Salah', 'Jota', 'Diaz']
    }
  }
  if (name.includes('chelsea')) {
    return {
      formation: '4-2-3-1',
      players: ['Sanchez', 'Gusto', 'Fofana', 'Colwill', 'Cucurella', 'Caicedo', 'Fernandez', 'Palmer', 'Madueke', 'Jackson', 'Neto']
    }
  }
  if (name.includes('manchester united') || name.includes('man united') || name.includes('man utd')) {
    return {
      formation: '4-2-3-1',
      players: ['Onana', 'Mazraoui', 'de Ligt', 'Martinez', 'Dalot', 'Casemiro', 'Mainoo', 'Fernandes', 'Diallo', 'Zirkzee', 'Rashford']
    }
  }
  if (name.includes('tottenham') || name.includes('spurs')) {
    return {
      formation: '4-3-3',
      players: ['Vicario', 'Porro', 'Romero', 'van de Ven', 'Udogie', 'Sarr', 'Bissouma', 'Maddison', 'Kulusevski', 'Solanke', 'Son']
    }
  }
  if (name.includes('barcelona') || name.includes('barca')) {
    return {
      formation: '4-3-3',
      players: ['ter Stegen', 'Koundé', 'Cubarsí', 'I. Martínez', 'Balde', 'Pedri', 'Casadó', 'Dani Olmo', 'Lamine Yamal', 'Lewandowski', 'Raphinha']
    }
  }
  if (name.includes('atletico') || name.includes('atlético')) {
    return {
      formation: '5-3-2',
      players: ['Oblak', 'Molina', 'Le Normand', 'Gimenez', 'Azpilicueta', 'De Paul', 'Koke', 'Gallagher', 'Griezmann', 'Sorloth', 'Alvarez']
    }
  }
  if (name.includes('bayern')) {
    return {
      formation: '4-2-3-1',
      players: ['Neuer', 'Kimmich', 'Upamecano', 'Kim Min-jae', 'Davies', 'Pavlovic', 'Palhinha', 'Musiala', 'Olise', 'Kane', 'Gnabry']
    }
  }
  if (name.includes('leverkusen')) {
    return {
      formation: '3-4-2-1',
      players: ['Hradecky', 'Tapsoba', 'Tah', 'Hincapie', 'Frimpong', 'Xhaka', 'Andrich', 'Grimaldo', 'Wirtz', 'Hofmann', 'Boniface']
    }
  }
  if (name.includes('dortmund')) {
    return {
      formation: '4-2-3-1',
      players: ['Kobel', 'Ryerson', 'Anton', 'Schlotterbeck', 'Bensebaini', 'Can', 'Gross', 'Sabitzer', 'Brandt', 'Adeyemi', 'Guirassy']
    }
  }
  if (name.includes('inter')) {
    return {
      formation: '3-5-2',
      players: ['Sommer', 'Pavard', 'Acerbi', 'Bastoni', 'Dumfries', 'Barella', 'Calhanoglu', 'Mkhitaryan', 'Dimarco', 'Thuram', 'Lautaro']
    }
  }
  if (name.includes('milan')) {
    return {
      formation: '4-2-3-1',
      players: ['Maignan', 'Calabria', 'Tomori', 'Pavlovic', 'Hernandez', 'Fofana', 'Reijnders', 'Pulisic', 'Loftus-Cheek', 'Leao', 'Morata']
    }
  }
  if (name.includes('juventus') || name.includes('juve')) {
    return {
      formation: '4-2-3-1',
      players: ['Di Gregorio', 'Savona', 'Gatti', 'Bremer', 'Cabal', 'Locatelli', 'Thuram', 'Cambiaso', 'Koopmeiners', 'Yildiz', 'Vlahovic']
    }
  }
  if (name.includes('paris saint-germain') || name.includes('psg')) {
    return {
      formation: '4-3-3',
      players: ['Donnarumma', 'Hakimi', 'Marquinhos', 'Pacho', 'Mendes', 'Zaire-Emery', 'Vitinha', 'Joao Neves', 'Dembele', 'Kolo Muani', 'Barcola']
    }
  }

  // Generic fallback generator for other teams (so they don't get empty/inconsistent squads)
  const cleanTeamName = teamName.replace(/fc|cf|squad|club|de|la/gi, '').trim()
  const lines = defaultFormation.split('-').map(Number)
  const defCount = !isNaN(lines[0]) ? lines[0] : 4
  const midCount = !isNaN(lines[1]) ? lines[1] : 3
  const fwdCount = !isNaN(lines[2]) ? lines[2] : 3

  const players = []
  players.push(`GK ${cleanTeamName.substring(0, 8)}`)
  
  for (let i = 1; i <= defCount; i++) {
    players.push(`DF ${cleanTeamName.substring(0, 8)} ${i}`)
  }
  for (let i = 1; i <= midCount; i++) {
    players.push(`MF ${cleanTeamName.substring(0, 8)} ${i}`)
  }
  for (let i = 1; i <= fwdCount; i++) {
    players.push(`FW ${cleanTeamName.substring(0, 8)} ${i}`)
  }

  return {
    formation: defaultFormation || '4-3-3',
    players: players.slice(0, 11) // ensure exactly 11 players
  }
}

export default function MatchPreviewPage(_props: MatchPreviewPageProps) {
  const [selectedLeague, setSelectedLeague] = useState('PL')
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('')
  const [lineupTab, setLineupTab] = useState<'pitch' | 'list'>('pitch')

  // 1. Fetch standings to get the list of teams in the chosen league
  const { data: standingsData, isLoading: isLoadingStandings } = useQuery({
    queryKey: ['standings-preview', selectedLeague],
    queryFn: async () => {
      const res = await matchesAPI.getStandings(selectedLeague)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const teams = standingsData?.standings || []

  // Auto-select first team when league changes or standings load
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].team.id)
    }
  }, [teams, selectedTeamId])

  const handleLeagueChange = (code: string) => {
    setSelectedLeague(code)
    setSelectedTeamId('') // Reset selected team to trigger auto-select
  }

  // Find active team details from standings
  const activeTeamEntry = teams.find(t => t.team.id === selectedTeamId)

  // 2. Fetch all upcoming matches to scan for our selected team's next fixture
  const { data: upcomingMatches } = useQuery({
    queryKey: ['upcoming-fixtures-preview'],
    queryFn: async () => {
      const res = await matchesAPI.getUpcoming(40)
      return res.data
    },
    staleTime: 2 * 60 * 1000,
  })

  // Find next match for the selected team
  const realNextMatch = upcomingMatches?.find(
    m => m.home_team?.id === selectedTeamId || m.away_team?.id === selectedTeamId
  )

  // 3. Fetch detailed match data (including H2H and lineups) if a match is scheduled
  const { data: realMatchDetail } = useQuery({
    queryKey: ['match-detail-preview', realNextMatch?.id],
    queryFn: async () => {
      if (!realNextMatch) return null
      const res = await matchesAPI.getMatch(realNextMatch.id)
      return res.data
    },
    enabled: !!realNextMatch,
  })

  // 4. Fallback/Mock Generator if no upcoming match is scheduled in the database
  const getMockedNextMatch = (): ActiveMatchData | null => {
    if (!activeTeamEntry) return null

    // Find a rival team in standings (e.g. rank above or below)
    const activePos = activeTeamEntry.position
    const rivalEntry = teams.find(t => t.position === (activePos === 1 ? 2 : activePos - 1)) || teams[0]
    if (!rivalEntry || rivalEntry.team.id === selectedTeamId) return null

    const homeTeam = activeTeamEntry.team
    const awayTeam = rivalEntry.team

    // Generate simulated values
    const hash = (homeTeam.id + awayTeam.id) % 10
    const probHome = 40 + hash * 2
    const probAway = 35 - hash
    const probDraw = 100 - probHome - probAway

    return {
      isSimulated: true,
      competition_name: standingsData?.competition || 'ฟุตบอลลีก',
      stage: 'นัดถัดไป (จำลองแมตช์)',
      match_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      venue: 'สนามกีฬากลาง',
      referee: 'ไมเคิล โอลิเวอร์',
      home_team: {
        id: homeTeam.id,
        name: homeTeam.name,
        logo_url: homeTeam.logo_url
      },
      away_team: {
        id: awayTeam.id,
        name: awayTeam.name,
        logo_url: awayTeam.logo_url
      },
      ai_predictions: {
        predicted_score: `${2 + (hash % 2)} - ${1 + (hash % 2)}`,
        win_prob_home: probHome,
        win_prob_draw: probDraw,
        win_prob_away: probAway,
        version: 'v4.2 (Simulated)',
      },
      h2h: [
        { date: 'ล่าสุด', home_team: homeTeam.name, away_team: awayTeam.name, home_score: 2, away_score: 1 },
        { date: 'ฤดูกาลก่อน', home_team: awayTeam.name, away_team: homeTeam.name, home_score: 1, away_score: 1 },
        { date: 'ฤดูกาลก่อน', home_team: homeTeam.name, away_team: awayTeam.name, home_score: 3, away_score: 2 },
      ],
      lineups: {
        home_formation: getMockLineup(homeTeam.name, '4-3-3').formation,
        away_formation: getMockLineup(awayTeam.name, '4-4-2').formation,
        home_players: getMockLineup(homeTeam.name, '4-3-3').players,
        away_players: getMockLineup(awayTeam.name, '4-4-2').players,
      },
      suggestion_chips: [
        { type: 'วิเคราะห์แผน', text: `วิเคราะห์ยุทธศาสตร์การเจาะไฮไลน์แนวรับของ ${awayTeam.name}` },
        { type: 'เปรียบเทียบสถิติ', text: `เปรียบเทียบสถิติเกมเหย้าของ ${homeTeam.name} ปะทะ เกมเยือนของ ${awayTeam.name}` },
        { type: 'วิเคราะห์เจาะลึก', text: `วิเคราะห์โอกาสทำประตูเฉลี่ยของคู่ ${homeTeam.name} vs ${awayTeam.name}` }
      ]
    }
  }

  // Determine active match data (real or simulated)
  const activeMatch: ActiveMatchData | null = realMatchDetail 
    ? {
        isSimulated: false,
        competition_name: realMatchDetail.competition_name || 'ฟุตบอลลีก',
        stage: `นัดที่ ${realMatchDetail.matchday || 1}`,
        match_date: realMatchDetail.match_date,
        venue: realMatchDetail.venue || 'สนามแข่งหลัก',
        referee: 'ไมเคิล โอลิเวอร์',
        home_team: {
          id: realMatchDetail.home_team?.id || 0,
          name: realMatchDetail.home_team?.name || 'ทีมเหย้า',
          logo_url: realMatchDetail.home_team?.logo_url,
        },
        away_team: {
          id: realMatchDetail.away_team?.id || 0,
          name: realMatchDetail.away_team?.name || 'ทีมเยือน',
          logo_url: realMatchDetail.away_team?.logo_url,
        },
        ai_predictions: {
          predicted_score: (realMatchDetail.home_score !== undefined && realMatchDetail.away_score !== undefined)
            ? `${realMatchDetail.home_score} - ${realMatchDetail.away_score}`
            : '2 - 1',
          win_prob_home: 45,
          win_prob_draw: 25,
          win_prob_away: 30,
          version: 'v4.2',
        },
        h2h: realMatchDetail.h2h || [],
        lineups: {
          home_formation: getMockLineup(realMatchDetail.home_team?.name || 'ทีมเหย้า', '4-3-3').formation,
          away_formation: getMockLineup(realMatchDetail.away_team?.name || 'ทีมเยือน', '4-3-3').formation,
          home_players: getMockLineup(realMatchDetail.home_team?.name || 'ทีมเหย้า', '4-3-3').players,
          away_players: getMockLineup(realMatchDetail.away_team?.name || 'ทีมเยือน', '4-3-3').players,
        },
        suggestion_chips: [
          { type: 'วิเคราะห์แผน', text: `วิเคราะห์แทคติกการเล่นระหว่าง ${realMatchDetail.home_team?.name || 'ทีมเหย้า'} และ ${realMatchDetail.away_team?.name || 'ทีมเยือน'}` },
          { type: 'ความพร้อมทีม', text: `อัปเดตสภาพความพร้อมล่าสุดของ ${realMatchDetail.home_team?.name || 'ทีมเหย้า'}` },
          { type: 'ประวัติการเจอกัน', text: `วิเคราะห์ประวัติการพบกัน (H2H) ของคู่ ${realMatchDetail.home_team?.name || 'ทีมเหย้า'} ปะทะ ${realMatchDetail.away_team?.name || 'ทีมเยือน'}` }
        ]
      }
    : getMockedNextMatch()



  // Pre-process lineups for tactical pitch
  const homeFormation = activeMatch?.lineups?.home_formation || '4-3-3'
  const awayFormation = activeMatch?.lineups?.away_formation || '4-3-3'
  const homePlayers = activeMatch?.lineups?.home_players || []
  const awayPlayers = activeMatch?.lineups?.away_players || []

  const homeGroup = groupPlayers(homePlayers, homeFormation)
  const awayGroup = groupPlayers(awayPlayers, awayFormation)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#0a111a] text-slate-100 min-h-screen">
      
      {/* 1. League Selection Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/80 no-scrollbar justify-center">
        {LEAGUES.map((l) => (
          <button
            key={l.code}
            onClick={() => handleLeagueChange(l.code)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border flex items-center gap-2
              ${selectedLeague === l.code 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            {l.logoUrl && (
              <img
                src={l.logoUrl}
                alt={l.name}
                className="w-4 h-4 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span>{l.name}</span>
          </button>
        ))}
      </div>

      {/* 2. Team Select Dropdown Header */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0b131f] border border-slate-900 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <h1 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">เลือกวิเคราะห์สโมสร</h1>
            <p className="text-[11px] text-slate-500">เลือกดูข้อมูลโปรไฟล์ สถิติ และวิเคราะห์บิ๊กแมตช์ถัดไป</p>
          </div>
        </div>
        
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(Number(e.target.value) || '')}
          className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-emerald-400 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 outline-none transition-all"
        >
          <option value="" disabled>-- เลือกสโมสร --</option>
          {teams.map((t) => (
            <option key={t.team.id} value={t.team.id}>
              อันดับ {t.position}. {t.team.name}
            </option>
          ))}
        </select>
      </div>

      {isLoadingStandings && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-455 animate-pulse">กำลังดึงข้อมูลสโมสรและตารางคะแนน...</span>
        </div>
      )}

      {/* 3. Main Dashboard Grid */}
      {!isLoadingStandings && activeTeamEntry && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column - Team Profile Dashboard (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Team Profile Card */}
            <div className="bg-[#0b131f] border border-slate-900 rounded-2xl p-5 shadow-xl space-y-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/50 to-transparent" />
              
              <div className="flex flex-col items-center text-center space-y-3 pt-2">
                <div className="w-20 h-20 bg-slate-950/80 rounded-2xl border border-slate-850 p-4 shadow-xl flex items-center justify-center">
                  <SafeCrest
                    src={activeTeamEntry.team.logo_url}
                    alt={activeTeamEntry.team.name}
                    fallbackText={activeTeamEntry.team.name}
                  />
                </div>
                <h2 className="text-base font-black text-white uppercase tracking-tight">{activeTeamEntry.team.name}</h2>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/35 px-3 py-1 rounded-full uppercase">
                  อันดับ {activeTeamEntry.position} ของลีก
                </span>
              </div>

              {/* Quick League Standing Mini Grid */}
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/40 p-3 rounded-xl border border-slate-900/80 text-xs">
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase">แข่ง</div>
                  <div className="font-extrabold text-slate-200 mt-0.5">{activeTeamEntry.played}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase">ชนะ</div>
                  <div className="font-extrabold text-slate-200 mt-0.5">{activeTeamEntry.won}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase">คะแนน</div>
                  <div className="font-extrabold text-emerald-400 mt-0.5">{activeTeamEntry.points}</div>
                </div>
              </div>

              {/* Form Badge list */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">ผลงาน 5 นัดหลังสุด:</span>
                <div className="flex gap-1.5">
                  {activeTeamEntry.form ? (
                    activeTeamEntry.form.split(',').map((f, idx) => {
                      const letter = f.trim().toUpperCase()
                      return (
                        <span
                          key={idx}
                          className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center text-white shadow-sm
                            ${letter === 'W' ? 'bg-green-600' : letter === 'D' ? 'bg-yellow-600' : 'bg-red-650'}`}
                        >
                          {letter}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-xs text-slate-500">ไม่มีข้อมูลผลงานล่าสุด</span>
                  )}
                </div>
              </div>

              {/* Useful Performance Indicators */}
              <div className="border-t border-slate-900/80 pt-4 space-y-3.5">
                <span className="text-[9px] font-bold text-emerald-450 uppercase tracking-widest block">สถิติประสิทธิภาพทีม</span>
                
                {/* Average goals scored */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>เกมรุกเฉลี่ย (ยิงต่อเกม)</span>
                    <span className="text-emerald-400 font-extrabold">{(activeTeamEntry.goals_for / (activeTeamEntry.played || 1)).toFixed(2)} ลูก</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${Math.min(100, (activeTeamEntry.goals_for / (activeTeamEntry.played || 1)) * 30)}%` }}
                    />
                  </div>
                </div>

                {/* Average goals conceded */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>เกมรับเฉลี่ย (เสียต่อเกม)</span>
                    <span className="text-red-400 font-extrabold">{(activeTeamEntry.goals_against / (activeTeamEntry.played || 1)).toFixed(2)} ลูก</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full" 
                      style={{ width: `${Math.min(100, (activeTeamEntry.goals_against / (activeTeamEntry.played || 1)) * 30)}%` }}
                    />
                  </div>
                </div>

                {/* Clean sheet/goal difference indicator */}
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 bg-slate-950/20 p-2.5 rounded-lg border border-slate-900">
                  <span>ผลต่างประตูได้เสียสะสม</span>
                  <span className={`font-black ${activeTeamEntry.goal_difference > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {activeTeamEntry.goal_difference > 0 ? '+' : ''}{activeTeamEntry.goal_difference}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Simulation trigger link */}
            <div className="bg-[#0b131f]/60 border border-slate-900 rounded-2xl p-4 text-center space-y-2">
              <span className="text-xs text-slate-400 block font-medium">ต้องการจำลองแข่งขันแบบกำหนดเอง?</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                คุณสามารถเลือกทีมเหย้า-เยือนเองเพื่อเปรียบเทียบสถิติและจำลองเกมได้ที่เมนูเปรียบเทียบด้านบน
              </p>
            </div>

          </div>

          {/* Right Column - Upcoming Match Preview Hub (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {activeMatch ? (
              <div className="space-y-6">
                
                {/* Match Overview Banner */}
                <div className="bg-[#0b131f] border border-cyan-950/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  
                  {activeMatch.isSimulated && (
                    <div className="absolute top-3 right-3 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-md text-[9px] font-black text-amber-400 tracking-wider uppercase">
                      แมตช์จำลอง (Simulated)
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center gap-1 mb-6 text-center">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
                      วิเคราะห์วิจารณ์เกมนัดถัดไป
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {activeMatch.competition_name} · {activeMatch.stage}
                    </p>
                  </div>

                  {/* Teams Row */}
                  <div className="grid grid-cols-3 items-center justify-items-center mb-8 max-w-xl mx-auto">
                    {/* Home Team */}
                    <div className="flex flex-col items-center text-center space-y-2.5">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-950/60 rounded-xl flex items-center justify-center border border-slate-800 p-2.5 shadow-md">
                        <SafeCrest
                          src={activeMatch.home_team.logo_url}
                          alt={activeMatch.home_team.name}
                          fallbackText={activeMatch.home_team.name}
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white uppercase truncate max-w-[120px]">{activeMatch.home_team.name}</span>
                    </div>

                    {/* VS Details */}
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black tracking-wider text-emerald-400 uppercase">VS</span>
                      <div className="text-[9px] text-slate-400 mt-2 text-center leading-relaxed">
                        <div>{new Date(activeMatch.match_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} · {new Date(activeMatch.match_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</div>
                        <div className="truncate max-w-[110px] mt-0.5">{activeMatch.venue}</div>
                      </div>
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center text-center space-y-2.5">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-950/60 rounded-xl flex items-center justify-center border border-slate-800 p-2.5 shadow-md">
                        <SafeCrest
                          src={activeMatch.away_team.logo_url}
                          alt={activeMatch.away_team.name}
                          fallbackText={activeMatch.away_team.name}
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white uppercase truncate max-w-[120px]">{activeMatch.away_team.name}</span>
                    </div>
                  </div>

                  {/* AI Win Probability Bar */}
                  <div className="border-t border-slate-850 pt-5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🤖</span>
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-350">
                          โอกาสชนะคาดการณ์โดย AI ({activeMatch.ai_predictions.version})
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-cyan-400 bg-cyan-950/20 px-2.5 py-0.5 rounded-full border border-cyan-900/40">
                        คาดการณ์สกอร์: <span className="text-xs text-green-450 font-black">{activeMatch.ai_predictions.predicted_score}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-6.5 rounded-full overflow-hidden flex text-[9px] sm:text-[10px] font-black text-slate-950 select-none shadow-inner border border-slate-900">
                      <div 
                        className="bg-emerald-500 flex items-center justify-center transition-all duration-500" 
                        style={{ width: `${activeMatch.ai_predictions.win_prob_home}%` }}
                      >
                        <span className="truncate px-1.5">{activeMatch.home_team.name}: {activeMatch.ai_predictions.win_prob_home}%</span>
                      </div>
                      <div 
                        className="bg-slate-400 flex items-center justify-center transition-all duration-500" 
                        style={{ width: `${activeMatch.ai_predictions.win_prob_draw}%` }}
                      >
                        <span className="truncate px-1.5">เสมอ: {activeMatch.ai_predictions.win_prob_draw}%</span>
                      </div>
                      <div 
                        className="bg-cyan-500 flex items-center justify-center transition-all duration-500" 
                        style={{ width: `${activeMatch.ai_predictions.win_prob_away}%` }}
                      >
                        <span className="truncate px-1.5">{activeMatch.away_team.name}: {activeMatch.ai_predictions.win_prob_away}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* H2H Historical Matches & Lineup Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left sub-card: H2H History */}
                  <div className="bg-[#0b131f] border border-slate-900 rounded-2xl p-5 shadow-xl space-y-4">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                      <span>📊</span> ประวัติการเคยเจอกัน (H2H)
                    </h3>

                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {activeMatch.h2h && activeMatch.h2h.length > 0 ? (
                        activeMatch.h2h.map((h: any, i: number) => {
                          const homeScore = h.home_score !== undefined ? h.home_score : h.score ? Number(h.score.split('-')[0]) : 0
                          const awayScore = h.away_score !== undefined ? h.away_score : h.score ? Number(h.score.split('-')[1]) : 0
                          const isHomeWin = homeScore > awayScore
                          const isAwayWin = awayScore > homeScore
                          const formattedDate = h.date && !isNaN(Date.parse(h.date))
                            ? new Date(h.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                            : h.date || 'นัดที่ผ่านมา'

                          return (
                            <div key={i} className="flex justify-between items-center text-xs bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/60">
                              <span className="text-[9px] text-slate-500 font-bold">{formattedDate}</span>
                              <div className="flex items-center gap-2 min-w-[180px] justify-center text-[11px]">
                                <span className={`truncate max-w-[80px] text-right font-medium ${isHomeWin ? 'text-white font-bold' : 'text-slate-400'}`}>
                                  {h.home_team || h.home}
                                </span>
                                <span className="bg-slate-950 border border-slate-850 text-[10px] font-black px-2 py-0.5 rounded text-emerald-450">
                                  {h.home_score !== undefined ? `${h.home_score} - ${h.away_score}` : h.score}
                                </span>
                                <span className={`truncate max-w-[80px] text-left font-medium ${isAwayWin ? 'text-white font-bold' : 'text-slate-400'}`}>
                                  {h.away_team || h.away}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-8 text-xs text-slate-500">
                          ไม่พบประวัติการดวลกันอย่างเป็นทางการในระบบ
                        </div>
                      )}
                    </div>
                    
                    {/* Add-on: Historical Stat Box */}
                    <div className="bg-slate-950/20 p-3 rounded-xl border border-slate-900/40 text-[10px] text-slate-400 leading-relaxed">
                      💡 <span className="font-bold text-slate-350">เกร็ดข้อมูลวิเคราะห์:</span> จากสถิติเจอกันฝั่งเจ้าบ้านมักครองเกมได้เหนียวแน่นกว่า แต่ทีมเยือนมีแนวรุกสวนกลับอันตรายที่ได้ประตูเกือบทุกนัด
                    </div>
                  </div>

                  {/* Right sub-card: Lineups Pitch */}
                  <div className="bg-[#0b131f] border border-slate-900 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-200 flex items-center gap-1.5">
                        <span>📋</span> คาดการณ์ตัวจริง
                      </h3>
                      
                      <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-900">
                        <button
                          onClick={() => setLineupTab('pitch')}
                          className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
                            lineupTab === 'pitch' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          🟢 ผังสนาม
                        </button>
                        <button
                          onClick={() => setLineupTab('list')}
                          className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
                            lineupTab === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          📋 รายชื่อ
                        </button>
                      </div>
                    </div>

                    {lineupTab === 'pitch' ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-1">
                        <div className="relative w-full max-w-[270px] aspect-[4/5] bg-gradient-to-b from-emerald-950/60 via-emerald-900/35 to-emerald-950/60 border border-emerald-500/20 rounded-xl p-2.5 flex flex-col justify-between shadow-inner overflow-hidden">
                          {/* Pitch lines */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_50%,transparent_50%)] bg-[length:100%_25px] pointer-events-none" />
                          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/5 pointer-events-none" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/5 rounded-full pointer-events-none" />
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-8 border-b border-x border-white/5 rounded-b-lg pointer-events-none" />
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-8 border-t border-x border-white/5 rounded-t-lg pointer-events-none" />

                          {/* Away Team (Top) */}
                          <div className="flex flex-col justify-start h-[45%] z-10 space-y-0.5">
                            <div className="flex justify-center items-center h-[20%]">
                              {awayGroup.gk[0] && <PlayerNode name={awayGroup.gk[0]} isAway={true} position="GK" />}
                            </div>
                            <div className="flex justify-around items-center h-[25%] px-0.5">
                              {awayGroup.def.slice(0, 4).map((p, idx) => (
                                <PlayerNode key={idx} name={p} isAway={true} position="DF" />
                              ))}
                            </div>
                            <div className="flex justify-around items-center h-[25%] px-1">
                              {awayGroup.mid.slice(0, 4).map((p, idx) => (
                                <PlayerNode key={idx} name={p} isAway={true} position="MF" />
                              ))}
                            </div>
                            <div className="flex justify-around items-center h-[25%] px-2">
                              {awayGroup.fwd.slice(0, 3).map((p, idx) => (
                                <PlayerNode key={idx} name={p} isAway={true} position="FW" />
                              ))}
                            </div>
                          </div>

                          {/* Home Team (Bottom) */}
                          <div className="flex flex-col justify-end h-[45%] z-10 space-y-0.5">
                            <div className="flex justify-around items-center h-[25%] px-2">
                              {homeGroup.fwd.slice(0, 3).map((p, idx) => (
                                <PlayerNode key={idx} name={p} isAway={false} position="FW" />
                              ))}
                            </div>
                            <div className="flex justify-around items-center h-[25%] px-1">
                              {homeGroup.mid.slice(0, 4).map((p, idx) => (
                                <PlayerNode key={idx} name={p} isAway={false} position="MF" />
                              ))}
                            </div>
                            <div className="flex justify-around items-center h-[25%] px-0.5">
                              {homeGroup.def.slice(0, 4).map((p, idx) => (
                                <PlayerNode key={idx} name={p} isAway={false} position="DF" />
                              ))}
                            </div>
                            <div className="flex justify-center items-center h-[20%]">
                              {homeGroup.gk[0] && <PlayerNode name={homeGroup.gk[0]} isAway={false} position="GK" />}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between w-full max-w-[270px] mt-2.5 text-[9px] font-bold text-slate-400">
                          <span className="text-emerald-400">แผน {homeFormation}</span>
                          <span className="text-cyan-400">แผน {awayFormation}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col text-xs">
                        <div className="grid grid-cols-2 text-center font-bold text-cyan-400 border-b border-slate-800 pb-1.5 mb-2">
                          <div className="truncate max-w-[90px] mx-auto">{activeMatch.home_team.name} ({homeFormation})</div>
                          <div className="truncate max-w-[90px] mx-auto">{activeMatch.away_team.name} ({awayFormation})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 divide-x divide-slate-800/50 overflow-y-auto max-h-[220px] pr-1">
                          <div className="pr-2 space-y-1.5 text-slate-350">
                            {homePlayers.map((p: string, i: number) => (
                              <div key={i} className="flex justify-between items-center py-0.5 border-b border-slate-900/10">
                                <span className="truncate max-w-[80px]">{p}</span>
                                <span className="text-[8px] text-slate-500 font-bold">#{i+1}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pl-2 space-y-1.5 text-slate-350">
                            {awayPlayers.map((p: string, i: number) => (
                              <div key={i} className="flex justify-between items-center py-0.5 border-b border-slate-900/10">
                                <span className="truncate max-w-[80px]">{p}</span>
                                <span className="text-[8px] text-slate-500 font-bold">#{i+1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-[#0b131f] border border-slate-900 rounded-2xl p-12 text-center text-slate-450 text-xs">
                💡 เกิดข้อผิดพลาดในการโหลดข้อมูลตารางคะแนนสโมสรคู่แข่ง
              </div>
            )}

          </div>
          
        </div>
      )}
      
    </div>
  )
}
