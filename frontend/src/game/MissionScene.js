import Phaser from 'phaser'

// Color tokens mirrored from theme.css (--void-deep, --panel, --line, --accent, --breach, --safe, --amber, --ink)
const COLORS = {
  void: 0x0b0806,
  panel: 0x241c15,
  line: 0x5a4a38,
  ink: 0xf3e9d8,
  accent: 0xff6a1f,
  breach: 0xff5c4d,
  safe: 0x8fd94a,
  amber: 0xe8a33d,
}

const GROUND_Y = 560
const PLATFORM_OFFSET = 110
const SURFACE_SPACING = 520
const GRAVITY_Y = 700
const MOVE_SPEED = 190
const JUMP_VELOCITY = -420

function buildTextures(scene) {
  const g = scene.add.graphics()

  g.clear().fillStyle(COLORS.accent, 1).fillRect(0, 0, 22, 34).fillStyle(COLORS.ink, 1).fillRect(4, 6, 14, 6)
  g.generateTexture('operator', 22, 34)

  g.clear().fillStyle(COLORS.breach, 1).fillCircle(11, 11, 11).fillStyle(COLORS.void, 1).fillCircle(15, 8, 2.5)
  g.generateTexture('drone', 22, 22)

  g.clear().fillStyle(COLORS.panel, 1).fillRect(0, 0, 64, 64).lineStyle(2, COLORS.line, 1).strokeRect(1, 1, 62, 62)
  g.generateTexture('ground', 64, 64)

  g.clear().fillStyle(COLORS.panel, 1).fillRect(0, 0, 220, 20).lineStyle(2, COLORS.accent, 0.6).strokeRect(1, 1, 218, 18)
  g.generateTexture('platform', 220, 20)

  g.clear().fillStyle(COLORS.safe, 1).fillCircle(8, 8, 8)
  g.generateTexture('data-node', 16, 16)

  g.clear().fillStyle(COLORS.amber, 1)
  g.fillTriangle(8, 0, 16, 8, 8, 16).fillTriangle(8, 0, 0, 8, 8, 16)
  g.generateTexture('canary-fragment', 16, 16)

  g.clear().fillStyle(COLORS.ink, 1).fillRect(0, 0, 4, 60).fillStyle(COLORS.accent, 1).fillTriangle(4, 4, 4, 20, 26, 12)
  g.generateTexture('checkpoint', 30, 60)

  g.destroy()
}

const SURFACE_LABEL = { chat: 'CHAT', tool: 'TOOL', file: 'FILE' }

export default class MissionScene extends Phaser.Scene {
  constructor() {
    super('MissionScene')
  }

  init(data) {
    this.surfaceKinds = data.surfaceKinds || ['chat', 'tool']
    this.weakSurface = data.weakSurface || null
    this.onWeakLinkFound = data.onWeakLinkFound || (() => {})
    this.onHudUpdate = data.onHudUpdate || (() => {})
    this.dataCount = 0
    this.canaryCount = 0
    this.lives = 3
    this.discovered = new Set()
    this.nearSurfaceId = null
  }

  create() {
    buildTextures(this)

    const worldWidth = 260 + this.surfaceKinds.length * SURFACE_SPACING + 260
    this.physics.world.setBounds(0, 0, worldWidth, 600)
    this.cameras.main.setBounds(0, 0, worldWidth, 600)
    this.cameras.main.setBackgroundColor(0x120d09)

    // ground
    const ground = this.physics.add.staticGroup()
    for (let x = 0; x < worldWidth; x += 64) ground.create(x + 32, GROUND_Y + 32, 'ground')

    // per-surface floating platform + control node + checkpoint
    const platforms = this.physics.add.staticGroup()
    this.surfaceZones = []
    this.checkpoints = this.physics.add.staticGroup()

    this.surfaceKinds.forEach((kind, i) => {
      const cx = 380 + i * SURFACE_SPACING
      const py = GROUND_Y - PLATFORM_OFFSET - (i % 2 === 0 ? 0 : 40)
      platforms.create(cx, py, 'platform')

      const isWeak = kind === this.weakSurface
      const label = this.add.text(cx, py - 34, SURFACE_LABEL[kind] || kind.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: isWeak ? '#ff5c4d' : '#a89984',
      }).setOrigin(0.5)
      if (isWeak) {
        this.tweens.add({ targets: label, alpha: 0.4, duration: 650, yoyo: true, repeat: -1 })
      }

      const zone = this.add.zone(cx, py - 20, 100, 40)
      this.physics.add.existing(zone, true)
      zone.surfaceId = kind
      this.surfaceZones.push(zone)

      this.checkpoints.create(cx + 90, py - 30, 'checkpoint')

      // 1-2 data-fragment collectibles per surface
      for (let j = 0; j < 2; j++) {
        const node = this.physics.add.sprite(cx - 60 + j * 60, py - 60, 'data-node')
        node.body.setAllowGravity(false)
        node.surfaceId = kind
        this.dataGroup = this.dataGroup || this.physics.add.group()
        this.dataGroup.add(node)
      }
    })

    // canary fragments, one every other surface
    this.canaryGroup = this.physics.add.group()
    this.surfaceKinds.forEach((kind, i) => {
      if (i % 2 !== 0) return
      const cx = 380 + i * SURFACE_SPACING
      const frag = this.physics.add.sprite(cx, GROUND_Y - 40, 'canary-fragment')
      frag.body.setAllowGravity(false)
      this.canaryGroup.add(frag)
    })

    // security drones patrol the ground between surfaces
    this.droneGroup = this.physics.add.group()
    this.surfaceKinds.forEach((kind, i) => {
      const cx = 200 + i * SURFACE_SPACING
      const drone = this.physics.add.sprite(cx, GROUND_Y - 12, 'drone')
      drone.setVelocityX(70)
      drone.setBounce(1, 0)
      drone.setCollideWorldBounds(true)
      drone.patrolMin = cx - 140
      drone.patrolMax = cx + 140
      this.droneGroup.add(drone)
    })

    // player
    this.player = this.physics.add.sprite(60, GROUND_Y - 40, 'operator')
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(GRAVITY_Y)
    this.lastCheckpoint = { x: 60, y: GROUND_Y - 40 }

    this.physics.add.collider(this.player, ground)
    this.physics.add.collider(this.player, platforms)
    this.physics.add.collider(this.droneGroup, ground)
    this.physics.add.collider(this.droneGroup, platforms)

    this.physics.add.overlap(this.player, this.dataGroup, (_p, node) => {
      node.destroy()
      this.dataCount += 1
      this.pushHud()
    })
    this.physics.add.overlap(this.player, this.canaryGroup, (_p, frag) => {
      frag.destroy()
      this.canaryCount += 1
      this.pushHud()
    })
    this.physics.add.overlap(this.player, this.checkpoints, (_p, cp) => {
      this.lastCheckpoint = { x: cp.x - 90, y: cp.y - 30 }
    })
    this.physics.add.collider(this.player, this.droneGroup, () => this.hitDrone())

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.keyA = this.input.keyboard.addKey('A')
    this.keyD = this.input.keyboard.addKey('D')
    this.keyE = this.input.keyboard.addKey('E')

    this.promptText = this.add.text(0, 0, 'PRESS E TO INVESTIGATE', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f3e9d8',
      backgroundColor: '#1c1611',
      padding: { x: 6, y: 4 },
    }).setOrigin(0.5).setVisible(false).setScrollFactor(1)

    this.pushHud()
  }

  pushHud() {
    this.onHudUpdate({ data: this.dataCount, canary: this.canaryCount, lives: this.lives })
  }

  hitDrone() {
    if (this.invulnerableUntil && this.time.now < this.invulnerableUntil) return
    this.lives = Math.max(0, this.lives - 1)
    this.invulnerableUntil = this.time.now + 1000
    const dir = this.player.x < this.cameras.main.midPoint.x ? -1 : 1
    this.player.setVelocity(dir * 220, -260)
    this.pushHud()
    if (this.lives <= 0) {
      this.lives = 3
      this.player.setPosition(this.lastCheckpoint.x, this.lastCheckpoint.y)
      this.pushHud()
    }
  }

  update() {
    if (!this.player.active) return

    if (this.player.y > 640) {
      this.player.setPosition(this.lastCheckpoint.x, this.lastCheckpoint.y)
      this.player.setVelocity(0, 0)
    }

    const left = this.cursors.left.isDown || this.keyA.isDown
    const right = this.cursors.right.isDown || this.keyD.isDown
    if (left) {
      this.player.setVelocityX(-MOVE_SPEED)
      this.player.setFlipX(true)
    } else if (right) {
      this.player.setVelocityX(MOVE_SPEED)
      this.player.setFlipX(false)
    } else {
      this.player.setVelocityX(0)
    }

    const onGround = this.player.body.blocked.down || this.player.body.touching.down
    if ((this.cursors.up.isDown || this.cursors.space?.isDown) && onGround) {
      this.player.setVelocityY(JUMP_VELOCITY)
    }

    this.droneGroup.children.each((drone) => {
      if (drone.x <= drone.patrolMin) drone.setVelocityX(70)
      if (drone.x >= drone.patrolMax) drone.setVelocityX(-70)
      return true
    })

    const playerBounds = this.player.getBounds()
    let near = null
    for (const zone of this.surfaceZones) {
      if (this.discovered.has(zone.surfaceId)) continue
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, zone.getBounds())) {
        near = zone
        break
      }
    }
    this.nearSurfaceId = near ? near.surfaceId : null

    if (near) {
      this.promptText.setPosition(near.x, near.y - 40).setVisible(true)
    } else {
      this.promptText.setVisible(false)
    }

    if (near && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.discovered.add(near.surfaceId)
      this.promptText.setVisible(false)
      this.physics.pause()
      this.onWeakLinkFound(near.surfaceId)
    }
  }
}
