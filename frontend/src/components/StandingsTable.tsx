/**
 * StandingsTable — sortable league table component.
 * Translated to Thai with standard Thai football table labels.
 */
import { useState } from 'react'
import type { StandingEntry } from '@/api/client'
import FormBadge from './FormBadge'

interface StandingsTableProps {
  competition: string
  season: string
  standings: StandingEntry[]
}

type SortKey = 'position' | 'points' | 'won' | 'goal_difference' | 'goals_for'

export default function StandingsTable({ competition, season, standings }: StandingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('position')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = [...standings].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (sortKey === 'position') return sortAsc ? aVal - bVal : bVal - aVal
    return sortAsc ? bVal - aVal : aVal - bVal // Higher is better for points/goals
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'position')
    }
  }

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th
      onClick={() => handleSort(sortKeyName)}
      className="px-2 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider 
                 cursor-pointer hover:text-emerald-400 transition-colors select-none"
    >
      {label}
      {sortKey === sortKeyName && (
        <span className="ml-1 text-emerald-450">{sortAsc ? '↑' : '↓'}</span>
      )}
    </th>
  )

  return (
    <div className="bg-[#0b131f] border border-slate-900 overflow-hidden rounded-2xl shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-900/60 bg-slate-950/20">
        <h3 className="text-base font-bold text-slate-100">{competition}</h3>
        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{season}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-400">
              <SortHeader label="#" sortKeyName="position" />
              <th className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider">
                สโมสร
              </th>
              <th className="px-2 py-3.5 font-bold uppercase" title="แข่ง">แข่ง</th>
              <SortHeader label="ชนะ" sortKeyName="won" />
              <th className="px-2 py-3.5 font-bold uppercase" title="เสมอ">เสมอ</th>
              <th className="px-2 py-3.5 font-bold uppercase" title="แพ้">แพ้</th>
              <SortHeader label="ได้" sortKeyName="goals_for" />
              <th className="px-2 py-3.5 font-bold uppercase" title="เสีย">เสีย</th>
              <SortHeader label="+/-" sortKeyName="goal_difference" />
              <SortHeader label="แต้ม" sortKeyName="points" />
              <th className="px-3 py-3.5 font-bold uppercase text-center">ฟอร์ม 5 นัดล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              // Row styling based on position zones
              let rowBorder = ''
              if (entry.position <= 4) rowBorder = 'border-l-3 border-l-emerald-500'
              else if (entry.position >= standings.length - 2)
                rowBorder = 'border-l-3 border-l-red-500'

              return (
                <tr
                  key={entry.team.id}
                  className={`border-b border-slate-900/40 hover:bg-slate-900/50 
                             transition-colors ${rowBorder}`}
                >
                  <td className="px-3 py-3 text-center font-extrabold text-slate-350">
                    {entry.position}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {entry.team.logo_url && (
                        <img
                          src={entry.team.logo_url}
                          alt={entry.team.name}
                          className="w-4 h-4 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <span className="font-bold text-slate-100 whitespace-nowrap">
                        {entry.team.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-slate-400 font-medium">{entry.played}</td>
                  <td className="px-2 py-3 text-center text-slate-300 font-bold">{entry.won}</td>
                  <td className="px-2 py-3 text-center text-slate-400 font-medium">{entry.drawn}</td>
                  <td className="px-2 py-3 text-center text-slate-400 font-medium">{entry.lost}</td>
                  <td className="px-2 py-3 text-center text-slate-350">{entry.goals_for}</td>
                  <td className="px-2 py-3 text-center text-slate-450">{entry.goals_against}</td>
                  <td className={`px-2 py-3 text-center font-bold ${
                    entry.goal_difference > 0
                      ? 'text-emerald-400'
                      : entry.goal_difference < 0
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }`}>
                    {entry.goal_difference > 0 ? '+' : ''}{entry.goal_difference}
                  </td>
                  <td className="px-2 py-3 text-center font-black text-white bg-slate-950/20">
                    {entry.points}
                  </td>
                  <td className="px-3 py-3 flex justify-center">
                    {entry.form && (
                      <FormBadge form={entry.form.split(',').map((f: string) => f.trim())} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-900 bg-slate-950/10 flex items-center gap-5 text-[10px] text-slate-500 font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" /> โควต้า ยูฟ่า แชมเปียนส์ลีก (UCL)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" /> โซนตกชั้น
        </span>
      </div>
    </div>
  )
}
