/**
 * Leaderboard API - backend integration.
 */

import { apiGet, apiPost } from './client'

export interface LeaderboardEntry {
  id?: number
  playerName: string
  timeMs: number
  createdAt: number
}

const TOP_N = 10

export async function getLeaderboard(
  levelId: number
): Promise<LeaderboardEntry[]> {
  try {
    const entries = await apiGet<LeaderboardEntry[]>(`/leaderboard/${levelId}`)
    return Array.isArray(entries) ? entries.slice(0, TOP_N) : []
  } catch {
    return []
  }
}

export async function submitScore(
  levelId: number,
  playerName: string,
  timeMs: number
): Promise<LeaderboardEntry> {
  const entry = await apiPost<LeaderboardEntry>('/leaderboard', {
    levelId,
    playerName: playerName.trim(),
    timeMs,
  })
  return entry
}

export function computePreliminaryPlace(
  entries: LeaderboardEntry[],
  timeMs: number
): number {
  let place = 1
  for (const e of entries) {
    if (timeMs < e.timeMs) return place
    place++
  }
  return place
}
