import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import type { Body } from 'planck'
import {
  createPhysicsWorld,
  createBall,
  stopEngine,
  type PhysicsWorld,
} from '../engine/physicsEngine'
import { createRailBody } from '../engine/railGenerator'
import { drawBodies } from '../engine/renderPhysics'
import { compileExpression } from '../utils/mathParser'
import { formatTime } from '../utils/formatTime'
import { createCoordinateTransform } from '../engine/coordinateTransform'
import type { Level } from '../data/levels'

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 750

function getDevicePixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 3)
}

const TRANSFORM_CONFIG = {
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
  mathXMin: -25,
  mathXMax: 25,
  mathYMin: -25,
  mathYMax: 25,
}
const GRID_STEP = 2.5
/** Extend curve range beyond grid so rail extends slightly past edges */
const PLOT_EXTEND = 3
const SPAWN_X = -20
const SPAWN_Y = 20
const BALL_RADIUS = 12
const RAIL_STEP = 0.15

interface GameCanvasProps {
  expression: string
  randomBallColor: () => string
  level: Level | null
  spawnX?: number
  spawnY?: number
  onSpawnChange?: (x: number, y: number) => void
  onLevelComplete?: (timeMs: number) => void
  onSimulationStateChange?: (running: boolean) => void
  onOutOfBounds?: () => void
  restartRef?: React.MutableRefObject<(() => void) | null>
  rebuildRef?: React.MutableRefObject<(() => void) | null>
}

export function GameCanvas({
  expression,
  randomBallColor,
  level,
  spawnX: spawnXProp,
  spawnY: spawnYProp,
  onSpawnChange,
  onLevelComplete,
  onSimulationStateChange,
  onOutOfBounds,
  restartRef,
  rebuildRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasStackRef = useRef<HTMLDivElement>(null)

  const effectiveSpawnX = level?.spawnX ?? spawnXProp ?? SPAWN_X
  const effectiveSpawnY = level?.spawnY ?? spawnYProp ?? SPAWN_Y
  const physicsRef = useRef<PhysicsWorld | null>(null)
  const railBodyRef = useRef<Body | null>(null)
  const ballBodyRef = useRef<Body | null>(null)
  const startTimeRef = useRef<number>(0)
  const visitedZonesRef = useRef<Set<number>>(new Set())
  const [parseError, setParseError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [visitedZones, setVisitedZones] = useState<Set<number>>(new Set())
  const [railVersion, setRailVersion] = useState(0)

  const stopSimulation = useCallback(() => {
    const physics = physicsRef.current
    if (physics) {
      const world = physics.world
      physics.world.queueUpdate(() => {
        const ball = ballBodyRef.current
        if (ball && ball.getWorld() === world) {
          world.destroyBody(ball)
        }
        ballBodyRef.current = null
      })
      const ctx = physics.canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    }
    setIsRunning(false)
    setElapsedMs(0)
    visitedZonesRef.current = new Set()
    setVisitedZones(new Set())
  }, [])

  const fullCleanup = useCallback(() => {
    const physics = physicsRef.current
    if (physics) {
      const world = physics.world
      physics.world.queueUpdate(() => {
        const ball = ballBodyRef.current
        if (ball && ball.getWorld() === world) {
          world.destroyBody(ball)
        }
        ballBodyRef.current = null
        const rail = railBodyRef.current
        if (rail && rail.getWorld() === world) {
          world.destroyBody(rail)
        }
        railBodyRef.current = null
      })
      const ctx = physics.canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    }
    setIsRunning(false)
    setElapsedMs(0)
    visitedZonesRef.current = new Set()
    setVisitedZones(new Set())
    setRailVersion((v) => v + 1)
  }, [])

  const buildAndRun = useCallback(() => {
    if (!canvasRef.current) return

    const parseResult = compileExpression(expression)
    if (parseResult.error) {
      setParseError(parseResult.error)
      return
    }
    setParseError(null)

    if (!physicsRef.current) {
      physicsRef.current = createPhysicsWorld(canvasRef.current, TRANSFORM_CONFIG)
    }

    const physics = physicsRef.current
    stopSimulation()

    if (!railBodyRef.current) {
      console.warn('Please wait for the rail to be built')
      return
    }

    const ball = createBall(
      physics.world,
      effectiveSpawnX,
      effectiveSpawnY,
      physics.transform,
      BALL_RADIUS,
      randomBallColor()
    )
    ballBodyRef.current = ball

    startTimeRef.current = performance.now()
    visitedZonesRef.current = new Set()
    setVisitedZones(new Set())
    setElapsedMs(0)
    setIsRunning(true)
  }, [expression, randomBallColor, stopSimulation, level, effectiveSpawnX, effectiveSpawnY])

  // Resize main canvas for sharp physics rendering on high-DPI
  useLayoutEffect(() => {
    const dpr = getDevicePixelRatio()
    const w = Math.round(CANVAS_WIDTH * dpr)
    const h = Math.round(CANVAS_HEIGHT * dpr)
    const canvas = canvasRef.current
    if (canvas && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w
      canvas.height = h
    }
  }, [])

  // Draw grid and axes on background canvas
  useEffect(() => {
    const gridCanvas = gridCanvasRef.current
    if (!gridCanvas) return

    const ctx = gridCanvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#faf9f5'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const transform = createCoordinateTransform(TRANSFORM_CONFIG)
    const { mathXMin, mathXMax, mathYMin, mathYMax } = TRANSFORM_CONFIG

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let x = mathXMin; x <= mathXMax; x += GRID_STEP) {
      const start = transform.mathToCanvas(x, mathYMin)
      const end = transform.mathToCanvas(x, mathYMax)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle =
        x === 0 ? 'rgba(0,0,0,0.45)' : 'rgba(180,195,210,0.75)'
      ctx.lineWidth = x === 0 ? 2 : 1
      ctx.stroke()
    }
    for (let y = mathYMin; y <= mathYMax; y += GRID_STEP) {
      const start = transform.mathToCanvas(mathXMin, y)
      const end = transform.mathToCanvas(mathXMax, y)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle =
        y === 0 ? 'rgba(0,0,0,0.45)' : 'rgba(180,195,210,0.75)'
      ctx.lineWidth = y === 0 ? 2 : 1
      ctx.stroke()
    }

    const LABEL_STEP = 5
    ctx.font = '13px "Segoe UI", "Helvetica Neue", system-ui, sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let x = mathXMin; x <= mathXMax; x += LABEL_STEP) {
      const p = transform.mathToCanvas(x, 0)
      ctx.fillText(String(x), p.x, p.y + 4)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let y = mathYMin; y <= mathYMax; y += LABEL_STEP) {
      const p = transform.mathToCanvas(0, y)
      ctx.fillText(String(y), p.x + 4, p.y)
    }

    ctx.font = '15px "Segoe UI", "Helvetica Neue", system-ui, sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.9)'
    const xAxisEnd = transform.mathToCanvas(mathXMax, 0)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('x', xAxisEnd.x + 6, xAxisEnd.y)
    const yAxisTop = transform.mathToCanvas(0, mathYMax)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('y', yAxisTop.x, yAxisTop.y - 6)

    // Draw rail curve when idle and expression is valid
    if (!isRunning && !parseError && expression.trim()) {
      const parseResult = compileExpression(expression)
      if (!parseResult.error) {
        const points: { x: number; y: number }[] = []
        for (
          let x = mathXMin - PLOT_EXTEND;
          x <= mathXMax + PLOT_EXTEND;
          x += RAIL_STEP
        ) {
          const y = parseResult.evaluate(x)
          if (!Number.isFinite(y)) continue
          points.push({ x, y })
        }
        if (points.length >= 2) {
          const first = transform.mathToCanvas(points[0].x, points[0].y)
          ctx.beginPath()
          ctx.moveTo(first.x, first.y)
          for (let i = 1; i < points.length; i++) {
            const p = transform.mathToCanvas(points[i].x, points[i].y)
            ctx.lineTo(p.x, p.y)
          }
          ctx.strokeStyle = '#29b6f6'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }

    // Draw spawn indicator when idle
    if (!isRunning) {
      const spawnCanvas = transform.mathToCanvas(effectiveSpawnX, effectiveSpawnY)
      ctx.beginPath()
      ctx.arc(spawnCanvas.x, spawnCanvas.y, BALL_RADIUS, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(200, 140, 0, 0.9)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    if (level) {
      level.visitZones.forEach((zone, i) => {
        const topLeft = transform.mathToCanvas(zone.xMin, zone.yMax)
        const bottomRight = transform.mathToCanvas(zone.xMax, zone.yMin)
        const width = bottomRight.x - topLeft.x
        const height = bottomRight.y - topLeft.y
        const visited = visitedZones.has(i)
        ctx.fillStyle = visited
          ? 'rgba(76, 175, 80, 0.4)'
          : 'rgba(100, 150, 255, 0.25)'
        ctx.strokeStyle = visited
          ? 'rgba(76, 175, 80, 0.8)'
          : 'rgba(100, 150, 255, 0.6)'
        ctx.fillRect(topLeft.x, topLeft.y, width, height)
        ctx.strokeRect(topLeft.x, topLeft.y, width, height)
      })
      const fz = level.finishZone
      const fTopLeft = transform.mathToCanvas(fz.xMin, fz.yMax)
      const fBottomRight = transform.mathToCanvas(fz.xMax, fz.yMin)
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)'
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)'
      ctx.fillRect(
        fTopLeft.x,
        fTopLeft.y,
        fBottomRight.x - fTopLeft.x,
        fBottomRight.y - fTopLeft.y
      )
      ctx.strokeRect(
        fTopLeft.x,
        fTopLeft.y,
        fBottomRight.x - fTopLeft.x,
        fBottomRight.y - fTopLeft.y
      )
    }
  }, [level, visitedZones, expression, isRunning, parseError, effectiveSpawnX, effectiveSpawnY])

  useEffect(() => {
    onSimulationStateChange?.(isRunning)
  }, [isRunning, onSimulationStateChange])

  // Create physics world on mount
  useEffect(() => {
    if (!canvasRef.current) return
    physicsRef.current = createPhysicsWorld(canvasRef.current, {
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
    })
    return () => {
      if (physicsRef.current) {
        stopEngine(physicsRef.current)
        physicsRef.current = null
        railBodyRef.current = null
        ballBodyRef.current = null
      }
    }
  }, [])

  // Create or update rail when expression is valid (before Run, rail stays unchanged)
  useEffect(() => {
    const physics = physicsRef.current
    if (!physics) return

    const parseResult = compileExpression(expression)
    const isValid = !parseResult.error && expression.trim()
    const evaluate = parseResult.evaluate
    const world = physics.world

    const id = setTimeout(() => {
      world.queueUpdate(() => {
        const rail = railBodyRef.current
        if (rail && rail.getWorld() === world) {
          world.destroyBody(rail)
        }
        railBodyRef.current = null
        if (isValid) {
          const railBody = createRailBody(
            world,
            evaluate,
            TRANSFORM_CONFIG,
            {
              xMin: TRANSFORM_CONFIG.mathXMin - PLOT_EXTEND,
              xMax: TRANSFORM_CONFIG.mathXMax + PLOT_EXTEND,
              step: RAIL_STEP,
            }
          )
          if (railBody) {
            railBodyRef.current = railBody
          }
        }
      })
    }, 0)
    return () => clearTimeout(id)
  }, [expression, railVersion])

  // Physics render loop with win detection and bounds check
  useEffect(() => {
    if (!physicsRef.current || !isRunning) return

    const { world, canvas, transform } = physicsRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const {
      mathXMin,
      mathXMax,
      mathYMin,
      mathYMax,
    } = TRANSFORM_CONFIG

    const dpr = getDevicePixelRatio()
    ctx.save()
    ctx.scale(dpr, dpr)

    let frameId: number
    const loop = () => {
      world.step(1 / 60)
      drawBodies(ctx, world, transform, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Out-of-bounds check
      if (ballBodyRef.current && onOutOfBounds) {
        const pos = ballBodyRef.current.getPosition()
        const math = transform.physicsToMath(pos.x, pos.y)
        if (
          math.x < mathXMin ||
          math.x > mathXMax ||
          math.y < mathYMin ||
          math.y > mathYMax
        ) {
          fullCleanup()
          onOutOfBounds()
          return
        }
      }

      if (level && ballBodyRef.current && onLevelComplete) {
        const pos = ballBodyRef.current.getPosition()
        const math = transform.physicsToMath(pos.x, pos.y)

        level.visitZones.forEach((zone, i) => {
          if (
            math.x >= zone.xMin &&
            math.x <= zone.xMax &&
            math.y >= zone.yMin &&
            math.y <= zone.yMax
          ) {
            visitedZonesRef.current.add(i)
            setVisitedZones((prev) => new Set(prev).add(i))
          }
        })

        const allVisited =
          visitedZonesRef.current.size === level.visitZones.length
        const inFinish =
          math.x >= level.finishZone.xMin &&
          math.x <= level.finishZone.xMax &&
          math.y >= level.finishZone.yMin &&
          math.y <= level.finishZone.yMax

        if (allVisited && inFinish) {
          const elapsed = Math.round(performance.now() - startTimeRef.current)
          onLevelComplete(elapsed)
          fullCleanup()
          return
        }
      }

      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => {
      ctx.restore()
      cancelAnimationFrame(frameId)
    }
  }, [isRunning, level, onLevelComplete, onOutOfBounds, fullCleanup])

  // Timer: update elapsedMs every frame when running
  useEffect(() => {
    if (!isRunning) return
    let frameId: number
    const tick = () => {
      setElapsedMs(Math.round(performance.now() - startTimeRef.current))
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isRunning])

  const handleRestart = useCallback(() => {
    stopSimulation()
    buildAndRun()
  }, [stopSimulation, buildAndRun])

  const handleRebuild = useCallback(() => {
    fullCleanup()
  }, [fullCleanup])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (level || isRunning || !onSpawnChange || !canvasStackRef.current)
        return
      const rect = canvasStackRef.current.getBoundingClientRect()
      const canvasX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH
      const canvasY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
      const transform = createCoordinateTransform(TRANSFORM_CONFIG)
      const math = transform.canvasToMath(canvasX, canvasY)
      onSpawnChange(math.x, math.y)
    },
    [level, isRunning, onSpawnChange]
  )

  useEffect(() => {
    if (restartRef) {
      restartRef.current = handleRestart
      return () => {
        restartRef.current = null
      }
    }
  }, [restartRef, handleRestart])

  useEffect(() => {
    if (rebuildRef) {
      rebuildRef.current = handleRebuild
      return () => {
        rebuildRef.current = null
      }
    }
  }, [rebuildRef, handleRebuild])

  return (
    <div className="game-container">
      <div
        ref={canvasStackRef}
        className={`canvas-stack ${!level && !isRunning ? 'canvas-stack-clickable' : ''}`}
        onClick={handleCanvasClick}
      >
        {isRunning && (
          <div className="game-timer" aria-live="polite">
            {formatTime(elapsedMs)}
          </div>
        )}
        <canvas
          ref={gridCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="grid-canvas"
        />
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="main-canvas"
        />
      </div>
      {parseError && (
        <p className="parse-error" role="alert">
          {parseError}
        </p>
      )}
      <div className="controls">
        <button type="button" onClick={buildAndRun}>
          Run
        </button>
        <button type="button" onClick={handleRestart}>
          Restart
        </button>
        <button type="button" onClick={stopSimulation}>
          Stop
        </button>
      </div>
    </div>
  )
}
