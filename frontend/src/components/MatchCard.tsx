/**
 * MatchCard — upcoming fixture card with quick "Predict" button.
 */
import type { MatchData } from '@/api/client'
import FormBadge from './FormBadge'

interface MatchCardProps {
  match: MatchData
  onPredict?: (prompt: string) => void
}

export default function MatchCard({ match, onPredict }: MatchCardProps) {
  const matchDate = new Date(match.match_date)
  const isToday = new Date().toDateString() === matchDate.toDateString()

  const handlePredict = () => {
    if (onPredict) {
      const prompt = `Predict the result of ${match.home_team?.name || 'Home'} vs ${match.away_team?.name || 'Away'} on ${matchDate.toLocaleDateString()}`
      onPredict(prompt)
    }
  }

  return (
    <div className="glass-card-hover p-4 space-y-3">
      {/* Competition + Date */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-pitch-400 uppercase tracking-wider">
          {match.competition_name || 'Match'}
        </span>
        <span className={`text-xs ${isToday ? 'text-yellow-400 font-semibold' : 'text-stadium-500'}`}>
          {isToday ? '🔴 TODAY' : matchDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            {match.home_team?.logo_url && (
              <img
                src={match.home_team.logo_url}
                alt={match.home_team.name}
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span className="font-semibold text-stadium-100 text-sm">
              {match.home_team?.short_name || match.home_team?.name || 'TBD'}
            </span>
          </div>
        </div>

        {/* Score / Time */}
        <div className="flex-shrink-0 text-center min-w-[60px]">
          {match.status === 'FINISHED' ? (
            <span className="text-lg font-bold text-stadium-100">
              {match.home_score} - {match.away_score}
            </span>
          ) : (
            <span className="text-xs text-stadium-400 font-mono">
              {matchDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stadium-100 text-sm">
              {match.away_team?.short_name || match.away_team?.name || 'TBD'}
            </span>
            {match.away_team?.logo_url && (
              <img
                src={match.away_team.logo_url}
                alt={match.away_team.name}
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Form badges */}
      {(match.home_form || match.away_form) && (
        <div className="flex items-center justify-between px-2">
          <FormBadge form={match.home_form || []} />
          <span className="text-[10px] text-stadium-600 uppercase">Form</span>
          <FormBadge form={match.away_form || []} />
        </div>
      )}

      {/* Venue + Predict button */}
      <div className="flex items-center justify-between pt-1 border-t border-stadium-800/50">
        <span className="text-[11px] text-stadium-500 truncate max-w-[60%]">
          {match.venue || `Matchday ${match.matchday || ''}`}
        </span>
        {match.status !== 'FINISHED' && (
          <button
            onClick={handlePredict}
            className="text-xs font-medium text-pitch-400 hover:text-pitch-300 
                       transition-colors flex items-center gap-1"
          >
            🔮 Predict
          </button>
        )}
      </div>
    </div>
  )
}
