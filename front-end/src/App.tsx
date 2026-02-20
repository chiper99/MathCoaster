import { useState } from 'react'
import { MenuPage } from './pages/MenuPage'
import { GamePage } from './pages/GamePage'
import type { Level } from './data/levels'

export default function App() {
  const [view, setView] = useState<'menu' | 'game'>('menu')
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null)

  const handlePlayLevel = (level: Level | null) => {
    setCurrentLevel(level)
    setView('game')
  }

  const handleBackToMenu = () => {
    setView('menu')
    setCurrentLevel(null)
  }

  if (view === 'menu') {
    return <MenuPage onPlayLevel={handlePlayLevel} />
  }

  return (
    <GamePage level={currentLevel} onBackToMenu={handleBackToMenu} />
  )
}
