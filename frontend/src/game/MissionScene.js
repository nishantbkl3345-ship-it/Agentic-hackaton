import Phaser from 'phaser'

const COLORS = {
  ink: 0xf3e9d8,
  inkDim: 0xa89984,
  inkFaint: 0x6f6252,
  accent: 0xff6a1f,
  safe: 0x8fd94a,
  breach: 0xff5c4d,
  voidDeep: 0x0b0806,
}

const GROUND_Y = 440
const WORLD_HEIGHT = 480
const PLATFORM_THICKNESS = 28
const MARGIN_START = 150
const MARGIN_END = 260

export default class MissionScene extends Phaser.Scene {
  constructor() {
    super('MissionScene')
  }

  init(data) {
    this.levelId = data.levelId
    this.kinds = data.kinds
    this.weakKind = data.weakKind
    this.labels = data.labels || {}
    this.visuals = data.visuals || { enemyCount: 2, worldWidthPerCheckpoint: 900 }
    this.hud = { data: 0, canary: 0, hearts: 3 }
    this.activeCheckpoint = null
    this.lastCheckpointX = MARGIN_START
    this.lastHitAt = 0
  }

  preload() {}

  create() {
    this.buildTextures()

    const spacing = this.visuals.worldWidthPerCheckpoint
    this.worldWidth = MARGIN_START + spacing * Math.max(1, this.kinds.length - 1) + MARGIN_END

    this.physics.world.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT)

    this.groundGroup = this.physics.add.staticGroup()
    const ground = this.add.sprite(this.worldWidth / 2, GROUND_Y + 20, 'solid')
      .setDisplaySize(this.worldWidth, 40)
      .setTint(COLORS.voidDeep)
    this.groundGroup.add(ground)

    this.checkpointGroup = this.physics.add.staticGroup()
    this.dataGroup = this.physics.add.staticGroup()
    this.canaryGroup = this.physics.add.staticGroup()
    this.checkpoints = []

    this.kinds.forEach((kind, i) => {
      const x = MARGIN_START + spacing * i
      const raised = i % 2 === 1
      let cpY = GROUND_Y - 20

      if (raised) {
        const platform = this.add.sprite(x, GROUND_Y - 110, 'solid')
          .setDisplaySize(220, PLATFORM_THICKNESS)
          .setTint(COLORS.inkFaint)
        this.groundGroup.add(platform)
        cpY = GROUND_Y - 110 - 26
      }

      const isWeak = kind === this.weakKind
      const cp = this.add.sprite(x, cpY, 'solid')
        .setDisplaySize(30, 30)
        .setTint(isWeak ? COLORS.breach : COLORS.accent)
      cp.kindId = kind
      cp.isWeak = isWeak
      this.checkpointGroup.add(cp)
      this.checkpoints.push(cp)

      if (isWeak) {
        this.tweens.add({ targets: cp, alpha: 0.35, duration: 550, yoyo: true, repeat: -1 })
      }

      const canary = this.add.sprite(x + 60, cpY - 40, 'dot').setTint(COLORS.safe).setScale(1.4)
      this.canaryGroup.add(canary)
    })

    const nodeCount = Math.max(4, this.kinds.length * 3)
    for (let i = 0; i < nodeCount; i += 1) {
      const x = MARGIN_START - 60 + ((this.worldWidth - MARGIN_START - MARGIN_END + 120) / nodeCount) * i
      const y = GROUND_Y - 40 - (i % 3) * 22
      const node = this.add.sprite(x, y, 'dot').setTint(COLORS.accent)
      this.dataGroup.add(node)
    }

    this.player = this.physics.add.sprite(MARGIN_START, GROUND_Y - 60, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(24, 36)

    this.enemies = this.physics.add.group()
    for (let i = 0; i < this.visuals.enemyCount; i += 1) {
      const baseX = MARGIN_START + 260 + i * 280
      const enemy = this.physics.add.sprite(baseX, GROUND_Y - 24, 'solid')
        .setDisplaySize(26, 26)
        .setTint(COLORS.breach)
      enemy.body.setAllowGravity(false)
      enemy.minX = baseX - 110
      enemy.maxX = baseX + 110
      enemy.setVelocityX(70)
      this.enemies.add(enemy)
    }

    this.physics.add.collider(this.player, this.groundGroup)

    this.physics.add.overlap(this.player, this.checkpointGroup, (_player, cp) => {
      this.activeCheckpoint = cp
      this.lastCheckpointX = Math.max(this.lastCheckpointX, cp.x)
    })
    this.physics.add.overlap(this.player, this.dataGroup, (_player, node) => {
      node.destroy()
      this.hud.data += 1
      this.emitHud()
    })
    this.physics.add.overlap(this.player, this.canaryGroup, (_player, frag) => {
      frag.destroy()
      this.hud.canary += 1
      this.emitHud()
    })
    this.physics.add.overlap(this.player, this.enemies, (player) => this.handleEnemyHit(player))

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.promptText = this.add.text(0, 0, 'PRESS E TO INVESTIGATE', {
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: '13px',
      color: '#f3e9d8',
      backgroundColor: '#120d09',
      padding: { x: 8, y: 4 },
    }).setDepth(20).setVisible(false)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({ left: 'A', right: 'D', up: 'W' })
    this.keyE = this.input.keyboard.addKey('E')

    this.emitHud()
  }

  buildTextures() {
    if (!this.textures.exists('solid')) {
      const solid = this.add.graphics()
      solid.fillStyle(0xffffff, 1)
      solid.fillRect(0, 0, 8, 8)
      solid.generateTexture('solid', 8, 8)
      solid.destroy()
    }
    if (!this.textures.exists('dot')) {
      const dot = this.add.graphics()
      dot.fillStyle(0xffffff, 1)
      dot.fillCircle(6, 6, 6)
      dot.generateTexture('dot', 12, 12)
      dot.destroy()
    }
    if (!this.textures.exists('player')) {
      const g = this.add.graphics()
      g.fillStyle(COLORS.ink, 1)
      g.fillRect(4, 14, 20, 26)
      g.fillCircle(14, 8, 9)
      g.generateTexture('player', 28, 40)
      g.destroy()
    }
  }

  handleEnemyHit(player) {
    const now = this.time.now
    if (now - this.lastHitAt < 800) return
    this.lastHitAt = now
    this.hud.hearts = Math.max(0, this.hud.hearts - 1)
    player.setVelocity(0, 0)
    player.setPosition(this.lastCheckpointX, GROUND_Y - 60)
    if (this.hud.hearts <= 0) this.hud.hearts = 3
    this.emitHud()
  }

  emitHud() {
    this.game.events.emit('hud-update', { ...this.hud })
  }

  update() {
    const speed = 220
    const left = this.cursors.left.isDown || this.wasd.left.isDown
    const right = this.cursors.right.isDown || this.wasd.right.isDown
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)

    if (left) this.player.setVelocityX(-speed)
    else if (right) this.player.setVelocityX(speed)
    else this.player.setVelocityX(0)

    if (jumpPressed && this.player.body.touching.down) {
      this.player.setVelocityY(-420)
    }

    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.x <= enemy.minX) enemy.setVelocityX(70)
      else if (enemy.x >= enemy.maxX) enemy.setVelocityX(-70)
    })

    if (this.activeCheckpoint) {
      this.promptText.setPosition(this.activeCheckpoint.x - 62, this.activeCheckpoint.y - 60).setVisible(true)
      if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
        const kind = this.activeCheckpoint.kindId
        this.game.events.emit('weak-link-found', { kind, label: this.labels[kind] || kind.toUpperCase() })
        this.scene.pause()
      }
    } else {
      this.promptText.setVisible(false)
    }
    this.activeCheckpoint = null
  }
}
