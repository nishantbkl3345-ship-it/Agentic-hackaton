import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import MissionScene from '../game/MissionScene'

export default function PhaserCanvas({ missionConfig, onWeakLinkFound, onHudUpdate, controlsRef }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 900,
      height: 480,
      backgroundColor: '#120d09',
      physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
      scene: [MissionScene],
    })

    game.scene.start('MissionScene', missionConfig)

    const handleWeakLink = (payload) => onWeakLinkFound?.(payload)
    const handleHud = (payload) => onHudUpdate?.(payload)
    game.events.on('weak-link-found', handleWeakLink)
    game.events.on('hud-update', handleHud)

    if (controlsRef) {
      controlsRef.current = {
        pause: () => game.scene.getScene('MissionScene')?.scene.pause(),
        resume: () => game.scene.getScene('MissionScene')?.scene.resume(),
        restart: () => game.scene.getScene('MissionScene')?.scene.restart(missionConfig),
      }
    }

    return () => {
      game.events.off('weak-link-found', handleWeakLink)
      game.events.off('hud-update', handleHud)
      game.destroy(true)
      if (controlsRef) controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="phaser-canvas-mount" />
}
