/**
 * StandingsTable — sortable league table component.
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
      className="px-2 py-3 text-xs font-semibold text-stadium-400 uppercase tracking-wider 
                 cursor-pointer hover:text-pitch-400 transition-colors select-none"
    >
      {label}
      {sortKey === sortKeyName && (
        <span className="ml-1 text-pitch-400">{sortAsc ? '↑' : '↓'}</span>
      )}
    </th>
  )

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-stadium-700/50">
        <h3 className="text-lg font-bold text-stadium-100">{competition}</h3>
        <p className="text-xs text-stadium-500">{season}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stadium-800/50">
              <SortHeader label="#" sortKeyName="position" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-stadium-400 uppercase tracking-wider">
                Team
              </th>
              <th className="px-2 py-3 text-xs font-semibold text-stadium-400 uppercase">P</th>
              <SortHeader label="W" sortKeyName="won" />
              <th className="px-2 py-3 text-xs font-semibold text-stadium-400 uppercase">D</th>
              <th className="px-2 py-3 text-xs font-semibold text-stadium-400 uppercase">L</th>
              <SortHeader label="GF" sortKeyName="goals_for" />
              <th className="px-2 py-3 text-xs font-semibold text-stadium-400 uppercase">GA</th>
              <SortHeader label="GD" sortKeyName="goal_difference" />
              <SortHeader label="Pts" sortKeyName="points" />
              <th className="px-2 py-3 text-xs font-semibold text-stadium-400 uppercase">Form</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              // Row styling based on position zones
              let rowBorder = ''
              if (entry.position <= 4) rowBorder = 'border-l-2 border-l-pitch-500'
              else if (entry.position >= standings.length - 2)
                rowBorder = 'border-l-2 border-l-red-500'

              return (
                <tr
                  key={entry.team.id}
                  className={`border-b border-stadium-800/30 hover:bg-stadium-800/30 
                             transition-colors ${rowBorder}`}
                >
                  <td className="px-3 py-2.5 text-center font-bold text-stadium-300">
                    {entry.position}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {entry.team.logo_url && (
                        <img
                          src={entry.team.logo_url}
                          alt={entry.team.name}
                          className="w-5 h-5 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <span className="font-medium text-stadium-100 whitespace-nowrap">
                        {entry.team.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-stadium-400">{entry.played}</td>
                  <td className="px-2 py-2.5 text-center text-stadium-300">{entry.won}</td>
                  <td className="px-2 py-2.5 text-center text-stadium-400">{entry.drawn}</td>
                  <td className="px-2 py-2.5 text-center text-stadium-400">{entry.lost}</td>
                  <td className="px-2 py-2.5 text-center text-stadium-300">{entry.goals_for}</td>
                  <td className="px-2 py-2.5 text-center text-stadium-400">{entry.goals_against}</td>
                  <td className={`px-2 py-2.5 text-center font-medium ${
                    entry.goal_difference > 0
                      ? 'text-pitch-400'
                      : entry.goal_difference < 0
                        ? 'text-red-400'
                        : 'text-stadium-400'
                  }`}>
                    {entry.goal_difference > 0 ? '+' : ''}{entry.goal_difference}
                  </td>
                  <td className="px-2 py-2.5 text-center font-bold text-stadium-100">
                    {entry.points}
                  </td>
                  <td className="px-2 py-2.5">
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
      <div className="px-5 py-3 border-t border-stadium-800/50 flex items-center gap-4 text-[10px] text-stadium-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-pitch-500" /> Champions League
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Relegation
        </span>
      </div>
    </div>
  )
}
