export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const frac = ms % 1000
  return `${m.toString().padStart(2, '0')}:${sec
    .toString()
    .padStart(2, '0')}.${frac.toString().padStart(3, '0')}`
}
