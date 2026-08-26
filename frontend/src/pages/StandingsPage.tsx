/**
 * StandingsPage — Browse league tables for tracked football competitions.
 * Translated to Thai and styled with premium design elements.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchesAPI } from '@/api/client'
import StandingsTable from '@/components/StandingsTable'

interface LeagueOption {
  code: string
  name: string
  country: string
  logoUrl: string
  color: string
}

const LEAGUES: LeagueOption[] = [
  { code: 'PL', name: 'พรีเมียร์ลีก', country: 'อังกฤษ', logoUrl: 'https://crests.football-data.org/PL.png', color: 'from-purple-600 to-indigo-650' },
  { code: 'PD', name: 'ลา ลีกา', country: 'สเปน', logoUrl: 'https://crests.football-data.org/PD.png', color: 'from-amber-500 to-red-600' },
  { code: 'BL1', name: 'บุนเดสลีกา', country: 'เยอรมนี', logoUrl: 'https://crests.football-data.org/BL1.png', color: 'from-red-600 to-black' },
  { code: 'SA', name: 'เซเรีย อา', country: 'อิตาลี', logoUrl: 'https://crests.football-data.org/SA.png', color: 'from-blue-600 to-cyan-550' },
  { code: 'FL1', name: 'ลีก เอิง', country: 'ฝรั่งเศส', logoUrl: 'https://crests.football-data.org/FL1.png', color: 'from-emerald-500 to-teal-700' },
  { code: 'CL', name: 'แชมเปียนส์ลีก', country: 'ยุโรป', logoUrl: 'https://crests.football-data.org/CL.png', color: 'from-blue-900 to-indigo-950' },
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 to-slate-950/90 p-6 sm:p-8 border border-slate-800/40">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-56 h-56 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-900/30">
            📊 ข้อมูลสถิติอัปเดตสด
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ตารางคะแนนลีกชั้นนำ
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            เช็คตารางคะแนนล่าสุด ฟอร์มการเล่นของแต่ละสโมสร สถิติประตูได้เสีย และการขยับอันดับแบบเรียลไทม์จากลีกใหญ่อย่างเป็นทางการ
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
                    ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/5'
                    : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80'
                }`}
            >
              {/* Top border colored glow line on active */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" />
              )}
              
              <div className="w-10 h-10 bg-slate-950/60 rounded-xl flex items-center justify-center p-1.5 mb-2 transform group-hover:scale-110 transition-transform duration-200">
                <img
                  src={league.logoUrl}
                  alt={league.name}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <span className={`text-xs sm:text-sm font-bold text-center ${isActive ? 'text-white' : 'text-slate-350'}`}>
                {league.name}
              </span>
              <span className="text-[9px] text-slate-500 mt-0.5">
                ลีก{league.country}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search & Stats Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            🔍
          </span>
          <input
            type="text"
            placeholder="ค้นหาทีมฟุตบอล..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl
                     text-xs sm:text-sm text-slate-100 placeholder:text-slate-500
                     focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500/50
                     transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slate-950/20 backdrop-blur-xs rounded-2xl">
            <div className="w-9 h-9 border-3 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-medium animate-pulse">กำลังดึงข้อมูลตารางคะแนน...</span>
          </div>
        )}

        {error && (
          <div className="bg-slate-900 border border-slate-850 p-8 text-center max-w-md mx-auto rounded-2xl space-y-4 shadow-xl">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-base font-bold text-white">โหลดตารางคะแนนไม่สำเร็จ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ไม่สามารถดึงข้อมูลตารางคะแนนได้ในขณะนี้ กรุณาตรวจสอบว่ามีข้อมูลในฐานข้อมูล หรือได้รันสคริปต์ซิงค์ข้อมูลแล้วหรือไม่
            </p>
            <button
              onClick={() => {}}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 hover:text-white"
            >
              ลองใหม่อีกครั้ง
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
              <div className="bg-slate-900/40 border border-slate-900 p-12 text-center text-slate-450 text-xs rounded-2xl">
                ไม่พบทีมที่ค้นหาสำหรับคำว่า "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
