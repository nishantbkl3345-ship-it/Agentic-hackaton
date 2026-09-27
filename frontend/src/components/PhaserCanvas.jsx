import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Phaser from 'phaser'
import MissionScene from '../game/MissionScene'

const PhaserCanvas = forwardRef(function PhaserCanvas({ surfaceKinds, weakSurface, onWeakLinkFound, onHudUpdate }, ref) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 860,
      height: 480,
      parent: containerRef.current,
      backgroundColor: '#0b0806',
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      scene: [MissionScene],
    })
    game.scene.start('MissionScene', { surfaceKinds, weakSurface, onWeakLinkFound, onHudUpdate })
    gameRef.current = game

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    pause: () => gameRef.current?.scene.pause('MissionScene'),
    resume: () => gameRef.current?.scene.resume('MissionScene'),
    restart: () => gameRef.current?.scene.start('MissionScene', { surfaceKinds, weakSurface, onWeakLinkFound, onHudUpdate }),
  }))

  return <div ref={containerRef} className="platformer-canvas" />
})

export default PhaserCanvas
