import { useState, useEffect } from 'react'
import { LEVELS, type Level } from '../data/levels'
import { getLeaderboard, type LeaderboardEntry } from '../api/leaderboard'
import { formatTime } from '../utils/formatTime'

interface MenuPageProps {
  onPlayLevel: (level: Level | null) => void
}

export function MenuPage({ onPlayLevel }: MenuPageProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (selectedLevelId !== null) {
      getLeaderboard(selectedLevelId).then(setLeaderboard)
    } else {
      setLeaderboard([])
    }
  }, [selectedLevelId])

  const handlePlay = () => {
    if (selectedLevelId !== null) {
      const level = LEVELS.find((l) => l.id === selectedLevelId) ?? null
      onPlayLevel(level)
    } else {
      onPlayLevel(null)
    }
  }

  return (
    <main className="app menu-page">
      <h1>MathCoaster</h1>
      <p className="menu-header">
        Dear colleagues! I suggest you stretch your brains a bit and recall
        your school math analysis course!
      </p>
      <p className="subtitle">Choose a level or free play.</p>

      <div className="menu-level-grid">
        <button
          type="button"
          className={`menu-level-card ${selectedLevelId === null ? 'selected' : ''}`}
          onClick={() => setSelectedLevelId(null)}
        >
          <span className="menu-level-card-title">Free Play</span>
          <span className="menu-level-card-desc">No zones, just experiment.</span>
        </button>
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            className={`menu-level-card ${selectedLevelId === level.id ? 'selected' : ''}`}
            onClick={() => setSelectedLevelId(level.id)}
          >
            <span className="menu-level-card-title">
              {level.id}. {level.name}
            </span>
            <span className="menu-level-card-desc">{level.baseFunction}</span>
          </button>
        ))}
      </div>

      <div className="menu-actions">
        <button type="button" className="menu-btn-primary" onClick={handlePlay}>
          Play
        </button>
      </div>

      <div className="menu-leaderboard">
        <h3>Leaderboard</h3>
        {selectedLevelId !== null ? (
          leaderboard.length > 0 ? (
            <table className="menu-leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((e, i) => (
                  <tr key={e.id ?? `${e.playerName}-${e.createdAt}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{e.playerName}</td>
                    <td>{formatTime(e.timeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="menu-leaderboard-empty">No records for this level yet.</p>
          )
        ) : (
          <p className="menu-leaderboard-hint">
            Select a level to view its leaderboard.
          </p>
        )}
      </div>
    </main>
  )
}
