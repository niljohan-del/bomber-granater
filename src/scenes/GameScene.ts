import Phaser from 'phaser';
import { Terrain } from '../terrain';
import { Tank } from '../tank';
import { AudioEngine } from '../audio';
import { pickRandomTheme, type TerrainTheme } from '../terrainThemes';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../weapons';
import { Crate, describeCrateReward } from '../crate';
import { computeAIShot, AI_LEVEL_NAMES, type AILevel } from '../ai';

const WORLD_W = 1280;
const WORLD_H = 720;
const GRAVITY = 260;

const PLAYER_COLORS = [0xe24b4b, 0x4b9ee2, 0x9bd14b, 0xf2914b];
const MIDGAME_TRACKS = ['midgame-1', 'midgame-2', 'midgame-3', 'midgame-4'];
const SHIELD_COST = 5;
const SHIELD_DURATION = 2;

type GameState = 'device' | 'setup' | 'aiming' | 'firing' | 'resolving' | 'gameover';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  weapon: WeaponId;
}

export class GameScene extends Phaser.Scene {
  private terrain!: Terrain;
  private theme!: TerrainTheme;
  private tanks: Tank[] = [];
  private current = 0;
  private state: GameState = 'device';
  private deviceMode: 'desktop' | 'mobile' = 'desktop';
  private deviceChosen = false;
  private devicePrompt!: Phaser.GameObjects.Text;
  private desktopBtnBg!: Phaser.GameObjects.Rectangle;
  private desktopBtnText!: Phaser.GameObjects.Text;
  private mobileBtnBg!: Phaser.GameObjects.Rectangle;
  private mobileBtnText!: Phaser.GameObjects.Text;
  private wind = 0;
  private audio!: AudioEngine;

  private projectile: Projectile | null = null;
  private projGraphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;
  private skyGraphics!: Phaser.GameObjects.Graphics;
  private starGraphics!: Phaser.GameObjects.Graphics;

  private hud!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private setupText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private titleBg!: Phaser.GameObjects.Image;

  private difficulty = 35;
  private readonly sliderX0 = WORLD_W / 2 - 160;
  private readonly sliderX1 = WORLD_W / 2 + 160;
  private setupPanel!: Phaser.GameObjects.Rectangle;
  private diffLabel!: Phaser.GameObjects.Text;
  private sliderTrackBg!: Phaser.GameObjects.Rectangle;
  private sliderFill!: Phaser.GameObjects.Rectangle;
  private sliderHandle!: Phaser.GameObjects.Arc;
  private randomizeBg!: Phaser.GameObjects.Rectangle;
  private randomizeText!: Phaser.GameObjects.Text;
  private playerButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private aiButtons: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private aiLabel!: Phaser.GameObjects.Text;
  private aiThinkTimer = 0;
  private restartBg!: Phaser.GameObjects.Rectangle;
  private restartBtnText!: Phaser.GameObjects.Text;

  private hudShown = false;
  private hudX = 0;
  private hudY = 0;
  private readonly hudPanelW = 230;
  private readonly hudPanelH = 380;
  private readonly dialOffsetY = -78;
  private readonly dialRadius = 55;
  private readonly trackHalfW = 75;
  private chudBg!: Phaser.GameObjects.Rectangle;
  private chudGoldLabel!: Phaser.GameObjects.Text;
  private chudAngleLabel!: Phaser.GameObjects.Text;
  private chudDialGraphics!: Phaser.GameObjects.Graphics;
  private chudDialHandle!: Phaser.GameObjects.Arc;
  private chudPowerLabel!: Phaser.GameObjects.Text;
  private chudPowerTrackBg!: Phaser.GameObjects.Rectangle;
  private chudPowerFill!: Phaser.GameObjects.Rectangle;
  private chudPowerHandle!: Phaser.GameObjects.Arc;
  private chudWeaponLabel!: Phaser.GameObjects.Text;
  private chudWeaponPrev!: Phaser.GameObjects.Text;
  private chudWeaponNext!: Phaser.GameObjects.Text;
  private chudWeaponStatus!: Phaser.GameObjects.Text;
  private chudFireBg!: Phaser.GameObjects.Rectangle;
  private chudFireText!: Phaser.GameObjects.Text;
  private chudShieldBg!: Phaser.GameObjects.Rectangle;
  private chudShieldText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private rKey!: Phaser.Input.Keyboard.Key;
  private twoKey!: Phaser.Input.Keyboard.Key;
  private threeKey!: Phaser.Input.Keyboard.Key;
  private fourKey!: Phaser.Input.Keyboard.Key;

  private stars: { x: number; y: number; r: number; tw: number }[] = [];

  private debrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emberEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private muzzleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  private introMusic?: Phaser.Sound.BaseSound;
  private midgameTrack?: Phaser.Sound.BaseSound;
  private midgameQueue: string[] = [];
  private musicMuted = false;
  private readonly introVolume = 0.5;
  private readonly midgameVolume = 0.45;
  private muteText!: Phaser.GameObjects.Text;

  private turnCounter = 0;
  private crate: Crate | null = null;
  private plane: { x: number; y: number; vx: number; dropX: number; dropped: boolean } | null = null;
  private planeGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.image('title-bg', 'title-bg.png');
    this.load.audio('intro-music', 'audio/introscreen.mp3');
    for (const key of MIDGAME_TRACKS) {
      this.load.audio(key, `audio/${key.replace('midgame-', 'midgame')}.mp3`);
    }
  }

  create(): void {
    this.audio = new AudioEngine();
    this.input.once('pointerdown', () => this.audio.resume());
    this.input.keyboard!.once('keydown', () => this.audio.resume());

    this.theme = pickRandomTheme();
    this.drawSky();

    this.fxGraphics = this.add.graphics();
    this.projGraphics = this.add.graphics();
    this.planeGraphics = this.add.graphics().setDepth(5);
    this.createEffects();

    this.hud = this.add.text(16, 12, '', {
      fontFamily: 'ui-monospace, Consolas, monospace',
      fontSize: '16px',
      color: '#f0eef5',
    });
    this.windText = this.add.text(WORLD_W - 16, 12, '', {
      fontFamily: 'ui-monospace, Consolas, monospace',
      fontSize: '16px',
      color: '#f0eef5',
      align: 'right',
    }).setOrigin(1, 0);

    this.muteText = this.add
      .text(WORLD_W - 16, 44, '🔊', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '28px',
      })
      .setOrigin(1, 0)
      .setPadding(12)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.toggleMute());

    this.bannerText = this.add
      .text(WORLD_W / 2, WORLD_H / 2, '', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '42px',
        color: '#ffe066',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);

    this.restartBg = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2 + 90, 220, 56, 0x3a3a44, 0.9)
      .setStrokeStyle(2, 0xffe066, 0.9)
      .setDepth(100)
      .setVisible(false);
    this.restartBtnText = this.add
      .text(WORLD_W / 2, WORLD_H / 2 + 90, '🔄 Ny match', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '22px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(false);
    this.restartBg.on('pointerover', () => this.restartBg.setFillStyle(0x4a4a56, 0.9));
    this.restartBg.on('pointerout', () => this.restartBg.setFillStyle(0x3a3a44, 0.9));
    this.restartBg.on('pointerdown', () => {
      if (this.state !== 'gameover') return;
      this.restart();
    });

    this.titleBg = this.add
      .image(WORLD_W / 2, WORLD_H / 2, 'title-bg')
      .setDisplaySize(WORLD_W, WORLD_H)
      .setDepth(90);

    this.titleText = this.add
      .text(WORLD_W / 2, 64, 'Bomber&Granater', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.devicePrompt = this.add
      .text(WORLD_W / 2, WORLD_H / 2 - 60, 'Hur vill du spela?', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '28px',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100);

    const deviceBtn = (
      x: number,
      label: string,
      sub: string,
      mode: 'desktop' | 'mobile'
    ): { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } => {
      const by = WORLD_H / 2 + 40;
      const bg = this.add
        .rectangle(x, by, 220, 110, 0x3a3a44, 0.9)
        .setStrokeStyle(2, 0xffe066, 0.9)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, by, `${label}\n${sub}`, {
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: '20px',
          color: '#ffe066',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(101);
      bg.on('pointerover', () => bg.setFillStyle(0x4a4a56, 0.9));
      bg.on('pointerout', () => bg.setFillStyle(0x3a3a44, 0.9));
      bg.on('pointerdown', () => {
        if (this.state !== 'device') return;
        this.chooseDevice(mode);
      });
      return { bg, text };
    };

    const desktopBtn = deviceBtn(WORLD_W / 2 - 130, '🖥️ Dator', 'Tangentbord + mus', 'desktop');
    this.desktopBtnBg = desktopBtn.bg;
    this.desktopBtnText = desktopBtn.text;
    const mobileBtn = deviceBtn(WORLD_W / 2 + 130, '📱 Telefon', 'Pekskärm', 'mobile');
    this.mobileBtnBg = mobileBtn.bg;
    this.mobileBtnText = mobileBtn.text;

    this.setupText = this.add
      .text(WORLD_W / 2, WORLD_H - 220, `Tema: ${this.theme.name}`, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '26px',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);

    this.playerButtons = [];
    for (const count of [2, 3, 4]) {
      const bx = WORLD_W / 2 + (count - 3) * 140;
      const by = WORLD_H - 150;
      const bg = this.add
        .rectangle(bx, by, 120, 50, 0x3a3a44, 0.9)
        .setStrokeStyle(2, 0xffe066, 0.9)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(bx, by, `${count} spelare`, {
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: '16px',
          color: '#ffe066',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(101);
      bg.on('pointerover', () => bg.setFillStyle(0x4a4a56, 0.9));
      bg.on('pointerout', () => bg.setFillStyle(0x3a3a44, 0.9));
      bg.on('pointerdown', () => {
        if (this.state !== 'setup') return;
        this.startMatch(count);
      });
      bg.setVisible(false).disableInteractive();
      text.setVisible(false);
      this.playerButtons.push({ bg, text });
    }

    this.aiLabel = this.add
      .text(WORLD_W / 2, WORLD_H - 95, 'eller mot datorn:', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '16px',
        color: '#cfe8ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);

    this.aiButtons = [];
    const aiLevels: AILevel[] = ['easy', 'hard', 'extreme'];
    aiLevels.forEach((level, i) => {
      const bx = WORLD_W / 2 + (i - 1) * 160;
      const by = WORLD_H - 50;
      const bg = this.add
        .rectangle(bx, by, 150, 46, 0x3a3a44, 0.9)
        .setStrokeStyle(2, 0x6fc2ff, 0.9)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(bx, by, AI_LEVEL_NAMES[level], {
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: '15px',
          color: '#cfe8ff',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(101);
      bg.on('pointerover', () => bg.setFillStyle(0x4a4a56, 0.9));
      bg.on('pointerout', () => bg.setFillStyle(0x3a3a44, 0.9));
      bg.on('pointerdown', () => {
        if (this.state !== 'setup') return;
        this.startMatchVsAI(level);
      });
      bg.setVisible(false).disableInteractive();
      text.setVisible(false);
      this.aiButtons.push({ bg, text });
    });

    this.setupPanel = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2, 440, 190, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffe066, 0.5)
      .setDepth(95)
      .setVisible(false);

    this.diffLabel = this.add
      .text(WORLD_W / 2, WORLD_H / 2 - 60, '', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '20px',
        color: '#ffe066',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);

    const trackY = WORLD_H / 2 - 5;
    this.sliderTrackBg = this.add
      .rectangle(WORLD_W / 2, trackY, this.sliderX1 - this.sliderX0, 8, 0x1a1a22, 0.9)
      .setStrokeStyle(1, 0xffffff, 0.3)
      .setDepth(96)
      .setVisible(false);
    this.sliderFill = this.add
      .rectangle(this.sliderX0, trackY, 0, 8, 0xffe066, 1)
      .setOrigin(0, 0.5)
      .setDepth(97)
      .setVisible(false);
    this.sliderHandle = this.add
      .circle(this.sliderX0, trackY, 13, 0xffe066)
      .setStrokeStyle(2, 0x000000, 0.8)
      .setDepth(98)
      .setInteractive({ draggable: true, useHandCursor: true })
      .setVisible(false)
      .disableInteractive();

    this.randomizeBg = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2 + 55, 180, 42, 0x3a3a44, 0.9)
      .setStrokeStyle(2, 0xffe066, 0.9)
      .setDepth(99)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
      .disableInteractive();
    this.randomizeText = this.add
      .text(WORLD_W / 2, WORLD_H / 2 + 55, '🎲 Slumpa', {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '20px',
        color: '#ffe066',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);

    this.randomizeBg.on('pointerover', () => this.randomizeBg.setFillStyle(0x4a4a56, 0.9));
    this.randomizeBg.on('pointerout', () => this.randomizeBg.setFillStyle(0x3a3a44, 0.9));
    this.randomizeBg.on('pointerdown', () => {
      if (this.state !== 'setup') return;
      this.setDifficulty(Phaser.Math.Between(0, 100));
    });

    this.input.setDraggable(this.sliderHandle);
    this.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number) => {
        if (gameObject !== this.sliderHandle || this.state !== 'setup') return;
        const clamped = Phaser.Math.Clamp(dragX, this.sliderX0, this.sliderX1);
        const value = ((clamped - this.sliderX0) / (this.sliderX1 - this.sliderX0)) * 100;
        this.setDifficulty(value);
      }
    );

    this.setDifficulty(this.difficulty);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.twoKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.threeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.fourKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);

    this.createControlHud();

    if (this.deviceChosen) {
      this.state = 'setup';
      this.desktopBtnBg.setVisible(false).disableInteractive();
      this.desktopBtnText.setVisible(false);
      this.mobileBtnBg.setVisible(false).disableInteractive();
      this.mobileBtnText.setVisible(false);
      this.devicePrompt.setVisible(false);
      this.showSetupScreen(true);
    } else {
      this.state = 'device';
    }

    this.introMusic = this.sound.add('intro-music', {
      loop: true,
      volume: this.musicMuted ? 0 : this.introVolume,
    });
    this.introMusic.play();

    this.events.once('shutdown', () => {
      this.audio.close();
      this.sound.removeAll();
    });
  }

  private toggleMute(): void {
    this.musicMuted = !this.musicMuted;
    this.muteText.setText(this.musicMuted ? '🔇' : '🔊');
    if (this.introMusic) (this.introMusic as Phaser.Sound.WebAudioSound).volume = this.musicMuted ? 0 : this.introVolume;
    if (this.midgameTrack) (this.midgameTrack as Phaser.Sound.WebAudioSound).volume = this.musicMuted ? 0 : this.midgameVolume;
  }

  private chooseDevice(mode: 'desktop' | 'mobile'): void {
    this.deviceMode = mode;
    this.deviceChosen = true;

    this.devicePrompt.setVisible(false);
    this.desktopBtnBg.setVisible(false).disableInteractive();
    this.desktopBtnText.setVisible(false);
    this.mobileBtnBg.setVisible(false).disableInteractive();
    this.mobileBtnText.setVisible(false);

    this.showSetupScreen(true);
    this.state = 'setup';
  }

  private showSetupScreen(visible: boolean): void {
    this.setupText.setVisible(visible);
    this.setupPanel.setVisible(visible);
    this.diffLabel.setVisible(visible);
    this.sliderTrackBg.setVisible(visible);
    this.sliderFill.setVisible(visible);
    this.sliderHandle.setVisible(visible);
    this.randomizeBg.setVisible(visible);
    this.randomizeText.setVisible(visible);
    this.aiLabel.setVisible(visible);
    for (const b of this.playerButtons) {
      b.bg.setVisible(visible);
      b.text.setVisible(visible);
    }
    for (const b of this.aiButtons) {
      b.bg.setVisible(visible);
      b.text.setVisible(visible);
    }
    if (visible) {
      this.sliderHandle.setInteractive({ draggable: true, useHandCursor: true });
      this.randomizeBg.setInteractive({ useHandCursor: true });
      for (const b of this.playerButtons) b.bg.setInteractive({ useHandCursor: true });
      for (const b of this.aiButtons) b.bg.setInteractive({ useHandCursor: true });
    } else {
      this.sliderHandle.disableInteractive();
      this.randomizeBg.disableInteractive();
      for (const b of this.playerButtons) b.bg.disableInteractive();
      for (const b of this.aiButtons) b.bg.disableInteractive();
    }
  }

  private startMidgameMusic(): void {
    this.introMusic?.stop();
    this.midgameQueue = Phaser.Utils.Array.Shuffle([...MIDGAME_TRACKS]);
    this.playNextMidgameTrack();
  }

  private playNextMidgameTrack(): void {
    if (this.midgameQueue.length === 0) {
      this.midgameQueue = Phaser.Utils.Array.Shuffle([...MIDGAME_TRACKS]);
    }
    const key = this.midgameQueue.shift()!;
    this.midgameTrack = this.sound.add(key, { volume: this.musicMuted ? 0 : this.midgameVolume });
    this.midgameTrack.once('complete', () => this.playNextMidgameTrack());
    this.midgameTrack.play();
  }

  private drawSky(): void {
    const th = this.theme;
    this.stars = [];
    this.skyGraphics = this.add.graphics();
    this.skyGraphics.fillGradientStyle(th.skyTop, th.skyTop, th.skyMid, th.skyBottom, 1, 1, 1, 1);
    this.skyGraphics.fillRect(0, 0, WORLD_W, WORLD_H);

    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H * 0.6,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2,
      });
    }
    this.starGraphics = this.add.graphics();

    const orbX = WORLD_W * 0.82;
    const orbY = WORLD_H * 0.16;
    this.skyGraphics.fillStyle(th.orbGlow, 0.18);
    this.skyGraphics.fillCircle(orbX, orbY, th.orbRadius * 1.5);
    this.skyGraphics.fillStyle(th.orbColor, 0.95);
    this.skyGraphics.fillCircle(orbX, orbY, th.orbRadius);

    this.drawDistantRidge(th.distantRidge1, WORLD_H * 0.52, 26, 0.37);
    this.drawDistantRidge(th.distantRidge2, WORLD_H * 0.58, 34, 0.41);
  }

  private drawDistantRidge(color: number, baseY: number, amp: number, alpha: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    const seedA = Math.random() * 10;
    const seedB = Math.random() * 10;
    g.beginPath();
    g.moveTo(0, WORLD_H);
    const step = 16;
    for (let x = 0; x <= WORLD_W; x += step) {
      const y =
        baseY +
        Math.sin(x * 0.004 + seedA) * amp +
        Math.sin(x * 0.011 + seedB) * amp * 0.4;
      g.lineTo(x, y);
    }
    g.lineTo(WORLD_W, WORLD_H);
    g.closePath();
    g.fillPath();
  }

  private createEffects(): void {
    const tex = this.make.graphics({ x: 0, y: 0 });
    tex.fillStyle(0xffffff, 1);
    tex.fillRect(0, 0, 10, 10);
    tex.generateTexture('px-square', 10, 10);
    tex.clear();
    tex.fillStyle(0xffffff, 1);
    tex.fillCircle(9, 9, 9);
    tex.generateTexture('px-circle', 18, 18);
    tex.destroy();

    this.debrisEmitter = this.add.particles(0, 0, 'px-square', {
      speed: { min: 130, max: 360 },
      angle: { min: 205, max: 335 },
      gravityY: 520,
      lifespan: { min: 550, max: 1000 },
      scale: { start: 1.6, end: 0.4 },
      rotate: { start: 0, end: 360 },
      tint: [0x6b4a2f, 0x4a3320, 0x8a6a46, 0x3a2a1c],
      alpha: { start: 1, end: 0 },
      emitting: false,
    });

    this.smokeEmitter = this.add.particles(0, 0, 'px-circle', {
      speed: { min: 20, max: 80 },
      angle: { min: 230, max: 310 },
      lifespan: { min: 750, max: 1250 },
      scale: { start: 0.8, end: 3.4 },
      alpha: { start: 0.55, end: 0 },
      tint: [0x5a5a66, 0x3a3a44, 0x74747f],
      emitting: false,
    });

    this.emberEmitter = this.add.particles(0, 0, 'px-circle', {
      speed: { min: 180, max: 480 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 220, max: 480 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe066, 0xffa23c, 0xff5c3c],
      blendMode: 'ADD',
      emitting: false,
    });

    this.muzzleEmitter = this.add.particles(0, 0, 'px-circle', {
      speed: { min: 70, max: 220 },
      lifespan: { min: 110, max: 220 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff6d8, 0xffd27a],
      blendMode: 'ADD',
      emitting: false,
    });
  }

  private createControlHud(): void {
    const labelStyle = {
      fontFamily: 'ui-monospace, Consolas, monospace',
      fontSize: '15px',
      color: '#ffe066',
    };

    this.chudBg = this.add
      .rectangle(0, 0, this.hudPanelW, this.hudPanelH, 0x3c4a2e, 0.42)
      .setStrokeStyle(2, 0x9bd14b, 0.55)
      .setDepth(80)
      .setVisible(false);

    this.chudGoldLabel = this.add
      .text(0, 0, '', { ...labelStyle, color: '#ffd24a' })
      .setOrigin(0.5)
      .setDepth(82)
      .setVisible(false);

    this.chudDialGraphics = this.add.graphics().setDepth(81).setVisible(false);
    this.chudAngleLabel = this.add.text(0, 0, '', labelStyle).setOrigin(0.5).setDepth(82).setVisible(false);
    this.chudDialHandle = this.add
      .circle(0, 0, 14, 0xffe066)
      .setStrokeStyle(2, 0x000000, 0.8)
      .setDepth(83)
      .setVisible(false);

    this.chudPowerLabel = this.add.text(0, 0, '', labelStyle).setOrigin(0.5).setDepth(82).setVisible(false);
    this.chudPowerTrackBg = this.add
      .rectangle(0, 0, 170, 8, 0x000000, 0.5)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setDepth(81)
      .setVisible(false);
    this.chudPowerFill = this.add
      .rectangle(0, 0, 0, 8, 0x6fc2ff, 1)
      .setOrigin(0, 0.5)
      .setDepth(82)
      .setVisible(false);
    this.chudPowerHandle = this.add
      .circle(0, 0, 14, 0x6fc2ff)
      .setStrokeStyle(2, 0x000000, 0.8)
      .setDepth(83)
      .setVisible(false);

    this.chudWeaponLabel = this.add.text(0, 0, '', labelStyle).setOrigin(0.5).setDepth(82).setVisible(false);
    this.chudWeaponPrev = this.add
      .text(0, 0, '◀', { ...labelStyle, fontSize: '26px' })
      .setOrigin(0.5)
      .setPadding(10)
      .setDepth(82)
      .setVisible(false);
    this.chudWeaponNext = this.add
      .text(0, 0, '▶', { ...labelStyle, fontSize: '26px' })
      .setOrigin(0.5)
      .setPadding(10)
      .setDepth(82)
      .setVisible(false);
    this.chudWeaponStatus = this.add
      .text(0, 0, '', { ...labelStyle, fontSize: '14px', color: '#cfe8ff' })
      .setOrigin(0.5)
      .setDepth(82)
      .setVisible(false);

    this.chudWeaponPrev.on('pointerdown', () => {
      if (this.state !== 'aiming') return;
      const t = this.tanks[this.current];
      const idx = WEAPON_ORDER.indexOf(t.selectedWeapon);
      t.selectedWeapon = WEAPON_ORDER[(idx - 1 + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    });
    this.chudWeaponNext.on('pointerdown', () => {
      if (this.state !== 'aiming') return;
      const t = this.tanks[this.current];
      const idx = WEAPON_ORDER.indexOf(t.selectedWeapon);
      t.selectedWeapon = WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length];
    });
    this.chudWeaponStatus.on('pointerdown', () => {
      if (this.state !== 'aiming') return;
      const t = this.tanks[this.current];
      const weapon = WEAPONS[t.selectedWeapon];
      if (weapon.cost === 0) return;
      if (!t.buyWeapon(weapon)) {
        const original = this.chudWeaponStatus.style.color;
        this.chudWeaponStatus.setColor('#ff5c5c');
        this.time.delayedCall(250, () => this.chudWeaponStatus.setColor(original));
      }
    });

    this.chudFireBg = this.add
      .rectangle(0, 0, 160, 44, 0xb23b2e, 0.9)
      .setStrokeStyle(2, 0xffe066, 0.9)
      .setDepth(82)
      .setVisible(false);
    this.chudFireText = this.add
      .text(0, 0, '🔥 AVFYRA', { ...labelStyle, fontSize: '18px', color: '#fff3e0' })
      .setOrigin(0.5)
      .setDepth(83)
      .setVisible(false);
    this.chudFireBg.on('pointerover', () => this.chudFireBg.setFillStyle(0xd1452f, 0.95));
    this.chudFireBg.on('pointerout', () => this.chudFireBg.setFillStyle(0xb23b2e, 0.9));
    this.chudFireBg.on('pointerdown', () => {
      if (this.state !== 'aiming') return;
      this.fire(this.tanks[this.current]);
    });

    this.chudShieldBg = this.add
      .rectangle(0, 0, 190, 38, 0x204a52, 0.9)
      .setStrokeStyle(2, 0x4fe8ff, 0.9)
      .setDepth(82)
      .setVisible(false);
    this.chudShieldText = this.add
      .text(0, 0, '', { ...labelStyle, fontSize: '15px', color: '#cfe8ff' })
      .setOrigin(0.5)
      .setDepth(83)
      .setVisible(false);
    this.chudShieldBg.on('pointerover', () => this.chudShieldBg.setFillStyle(0x2c5c66, 0.95));
    this.chudShieldBg.on('pointerout', () => this.chudShieldBg.setFillStyle(0x204a52, 0.9));
    this.chudShieldBg.on('pointerdown', () => {
      if (this.state !== 'aiming') return;
      const t = this.tanks[this.current];
      if (t.gold < SHIELD_COST) {
        const original = this.chudShieldText.style.color;
        this.chudShieldText.setColor('#ff5c5c');
        this.time.delayedCall(250, () => this.chudShieldText.setColor(original));
        return;
      }
      t.gold -= SHIELD_COST;
      t.shieldTurns = SHIELD_DURATION;
    });

    this.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        if (this.state !== 'aiming') return;
        const x0 = this.hudX - this.trackHalfW;
        const x1 = this.hudX + this.trackHalfW;
        if (obj === this.chudBg) {
          const nx = Phaser.Math.Clamp(dragX, this.hudPanelW / 2 + 10, WORLD_W - this.hudPanelW / 2 - 10);
          const ny = Phaser.Math.Clamp(dragY, this.hudPanelH / 2 + 10, WORLD_H - this.hudPanelH / 2 - 10);
          if (!this.panelOverlapsTank(nx, ny, this.tanks[this.current])) {
            this.hudX = nx;
            this.hudY = ny;
          }
        } else if (obj === this.chudDialHandle) {
          const cx = this.hudX;
          const cy = this.hudY + this.dialOffsetY;
          const deg = Phaser.Math.Clamp(
            Phaser.Math.RadToDeg(Math.atan2(-(dragY - cy), dragX - cx)),
            0,
            180
          );
          this.tanks[this.current].angle = deg;
        } else if (obj === this.chudPowerHandle) {
          const t = (Phaser.Math.Clamp(dragX, x0, x1) - x0) / (x1 - x0);
          this.tanks[this.current].power = Phaser.Math.Clamp(5 + t * 95, 5, 100);
        }
      }
    );
  }

  private drawAngleDial(cx: number, cy: number, angleDeg: number): void {
    const g = this.chudDialGraphics;
    const r = this.dialRadius;
    g.clear();

    g.lineStyle(2, 0xcfead1, 0.55);
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.strokePath();

    g.lineStyle(3, 0xcfead1, 0.85);
    g.beginPath();
    g.arc(cx, cy, r, Math.PI, Math.PI * 2, false);
    g.strokePath();

    for (let d = 0; d <= 180; d += 30) {
      const rad = Phaser.Math.DegToRad(d);
      const inner = r - (d % 90 === 0 ? 13 : 7);
      g.lineStyle(2, 0xcfead1, 0.8);
      g.beginPath();
      g.moveTo(cx + Math.cos(rad) * r, cy - Math.sin(rad) * r);
      g.lineTo(cx + Math.cos(rad) * inner, cy - Math.sin(rad) * inner);
      g.strokePath();
    }

    const rad = Phaser.Math.DegToRad(angleDeg);
    g.lineStyle(2, 0xffe066, 0.9);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(rad) * r, cy - Math.sin(rad) * r);
    g.strokePath();
  }

  private setControlHudVisible(visible: boolean): void {
    const shapes = [
      this.chudBg,
      this.chudDialGraphics,
      this.chudDialHandle,
      this.chudPowerTrackBg,
      this.chudPowerFill,
      this.chudPowerHandle,
      this.chudFireBg,
      this.chudShieldBg,
    ];
    const texts = [
      this.chudGoldLabel,
      this.chudAngleLabel,
      this.chudPowerLabel,
      this.chudWeaponLabel,
      this.chudWeaponPrev,
      this.chudWeaponNext,
      this.chudWeaponStatus,
      this.chudFireText,
      this.chudShieldText,
    ];
    for (const s of shapes) s.setVisible(visible);
    for (const t of texts) t.setVisible(visible);

    if (visible) {
      this.chudBg.setInteractive({ draggable: true, useHandCursor: true });
      this.chudDialHandle.setInteractive({ draggable: true, useHandCursor: true });
      this.chudPowerHandle.setInteractive({ draggable: true, useHandCursor: true });
      this.chudWeaponPrev.setInteractive({ useHandCursor: true });
      this.chudWeaponNext.setInteractive({ useHandCursor: true });
      this.chudWeaponStatus.setInteractive({ useHandCursor: true });
      this.chudFireBg.setInteractive({ useHandCursor: true });
      this.chudShieldBg.setInteractive({ useHandCursor: true });
    } else {
      this.chudBg.disableInteractive();
      this.chudDialHandle.disableInteractive();
      this.chudPowerHandle.disableInteractive();
      this.chudWeaponPrev.disableInteractive();
      this.chudWeaponNext.disableInteractive();
      this.chudWeaponStatus.disableInteractive();
      this.chudFireBg.disableInteractive();
      this.chudShieldBg.disableInteractive();
    }
  }

  private tankKeepOut(t: Tank): { x0: number; y0: number; x1: number; y1: number } {
    return { x0: t.x - 65, y0: t.y - 55, x1: t.x + 65, y1: t.y + 40 };
  }

  private panelOverlapsTank(px: number, py: number, t: Tank): boolean {
    const r = this.tankKeepOut(t);
    const halfW = this.hudPanelW / 2;
    const halfH = this.hudPanelH / 2;
    return px - halfW < r.x1 && px + halfW > r.x0 && py - halfH < r.y1 && py + halfH > r.y0;
  }

  private resetHudAnchor(): void {
    const t = this.tanks[this.current];
    if (!t) return;
    const gap = 20;
    const r = this.tankKeepOut(t);
    const minX = this.hudPanelW / 2 + 10;
    const maxX = WORLD_W - this.hudPanelW / 2 - 10;
    const minY = this.hudPanelH / 2 + 10;
    const maxY = WORLD_H - this.hudPanelH / 2 - 10;

    const x = Phaser.Math.Clamp(t.x, minX, maxX);
    const yBelow = Phaser.Math.Clamp(r.y1 + gap + this.hudPanelH / 2, minY, maxY);
    const yAbove = Phaser.Math.Clamp(r.y0 - gap - this.hudPanelH / 2, minY, maxY);

    if (!this.panelOverlapsTank(x, yBelow, t)) {
      this.hudX = x;
      this.hudY = yBelow;
    } else if (!this.panelOverlapsTank(x, yAbove, t)) {
      this.hudX = x;
      this.hudY = yAbove;
    } else {
      // neither side fully clears on-screen — push sideways from the tank instead
      const side = t.x < WORLD_W / 2 ? 1 : -1;
      this.hudX = Phaser.Math.Clamp(t.x + side * (r.x1 - r.x0 + this.hudPanelW / 2 + gap), minX, maxX);
      this.hudY = Phaser.Math.Clamp(t.y, minY, maxY);
    }
  }

  private updateControlHud(): void {
    const t = this.tanks[this.current];
    if (!t) return;

    this.chudBg.setPosition(this.hudX, this.hudY);

    const x0 = this.hudX - this.trackHalfW;
    const x1 = this.hudX + this.trackHalfW;
    const goldY = this.hudY - 155;
    const dialCx = this.hudX;
    const dialCy = this.hudY + this.dialOffsetY;
    const angleLabelY = dialCy + 16;
    const powerLabelY = this.hudY - 26;
    const powerY = this.hudY;
    const weaponY = this.hudY + 34;
    const statusY = this.hudY + 68;
    const shieldY = this.hudY + 106;
    const fireY = this.hudY + 148;

    this.chudGoldLabel.setPosition(this.hudX, goldY).setText(`Güld: ${t.gold}`);

    this.drawAngleDial(dialCx, dialCy, t.angle);
    const dialRad = Phaser.Math.DegToRad(t.angle);
    this.chudDialHandle.setPosition(
      dialCx + Math.cos(dialRad) * this.dialRadius,
      dialCy - Math.sin(dialRad) * this.dialRadius
    );
    this.chudAngleLabel.setPosition(this.hudX, angleLabelY).setText(`Vinkel: ${t.angle.toFixed(0)}°`);

    this.chudPowerLabel.setPosition(this.hudX, powerLabelY).setText(`Kraft: ${t.power.toFixed(0)}`);
    this.chudPowerTrackBg.setPosition(this.hudX, powerY);
    const powerHandleX = x0 + ((t.power - 5) / 95) * (x1 - x0);
    this.chudPowerFill.setPosition(x0, powerY);
    this.chudPowerFill.width = powerHandleX - x0;
    this.chudPowerHandle.setPosition(powerHandleX, powerY);

    const weapon = WEAPONS[t.selectedWeapon];
    this.chudWeaponLabel.setPosition(this.hudX, weaponY).setText(weapon.name);
    this.chudWeaponPrev.setPosition(this.hudX - 80, weaponY);
    this.chudWeaponNext.setPosition(this.hudX + 80, weaponY);

    this.chudWeaponStatus.setPosition(this.hudX, statusY);
    if (weapon.cost === 0) {
      this.chudWeaponStatus.setText('Obegränsat');
    } else {
      const owned = t.ammo[weapon.id];
      const ownedText = owned > 0 ? `Äger: ${owned}` : 'Äger: 0';
      this.chudWeaponStatus.setText(`${ownedText}  —  köp (${weapon.cost}g)`);
    }

    this.chudShieldBg.setPosition(this.hudX, shieldY);
    this.chudShieldText.setPosition(this.hudX, shieldY);
    if (t.shieldTurns > 0) {
      this.chudShieldText.setText(`🛡️ Aktiv: ${t.shieldTurns} omgångar kvar`);
    } else {
      this.chudShieldText.setText(`🛡️ LazerShield (köp ${SHIELD_COST}g)`);
    }

    this.chudFireBg.setPosition(this.hudX, fireY);
    this.chudFireText.setPosition(this.hudX, fireY);
  }

  private setDifficulty(value: number): void {
    this.difficulty = Phaser.Math.Clamp(Math.round(value), 0, 100);
    const t = this.difficulty / 100;
    this.sliderHandle.x = this.sliderX0 + t * (this.sliderX1 - this.sliderX0);
    this.sliderFill.width = this.sliderHandle.x - this.sliderX0;

    const tier =
      this.difficulty < 25
        ? 'Lätt terräng'
        : this.difficulty < 60
          ? 'Kuperad terräng'
          : this.difficulty < 85
            ? 'Branta berg'
            : 'Berg kan blockera skottlinjen!';
    this.diffLabel.setText(`Svårighetsgrad: ${this.difficulty}\n${tier}`);
  }

  private startMatch(count: number): void {
    this.terrain = new Terrain(this, WORLD_W, WORLD_H, this.theme, this.difficulty);

    this.setupText.setVisible(false);
    this.titleText.setVisible(false);
    this.titleBg.setVisible(false);
    this.setupPanel.setVisible(false);
    this.diffLabel.setVisible(false);
    this.sliderTrackBg.setVisible(false);
    this.sliderFill.setVisible(false);
    this.sliderHandle.setVisible(false).disableInteractive();
    this.randomizeBg.setVisible(false).disableInteractive();
    this.randomizeText.setVisible(false);
    this.aiLabel.setVisible(false);
    for (const b of this.playerButtons) {
      b.bg.setVisible(false).disableInteractive();
      b.text.setVisible(false);
    }
    for (const b of this.aiButtons) {
      b.bg.setVisible(false).disableInteractive();
      b.text.setVisible(false);
    }

    this.startMidgameMusic();

    this.spawnTanks(count);
    this.newTurn(true);
  }

  private startMatchVsAI(level: AILevel): void {
    this.terrain = new Terrain(this, WORLD_W, WORLD_H, this.theme, this.difficulty);

    this.setupText.setVisible(false);
    this.titleText.setVisible(false);
    this.titleBg.setVisible(false);
    this.setupPanel.setVisible(false);
    this.diffLabel.setVisible(false);
    this.sliderTrackBg.setVisible(false);
    this.sliderFill.setVisible(false);
    this.sliderHandle.setVisible(false).disableInteractive();
    this.randomizeBg.setVisible(false).disableInteractive();
    this.randomizeText.setVisible(false);
    this.aiLabel.setVisible(false);
    for (const b of this.playerButtons) {
      b.bg.setVisible(false).disableInteractive();
      b.text.setVisible(false);
    }
    for (const b of this.aiButtons) {
      b.bg.setVisible(false).disableInteractive();
      b.text.setVisible(false);
    }

    this.startMidgameMusic();

    this.spawnTanks(2);
    this.tanks[1].isAI = true;
    this.tanks[1].aiLevel = level;
    this.tanks[1].name = `Dator (${AI_LEVEL_NAMES[level]})`;
    this.newTurn(true);
  }

  private spawnTanks(count: number): void {
    const margin = 90;
    const usable = WORLD_W - margin * 2;
    const slotW = usable / count;

    this.tanks = [];
    for (let i = 0; i < count; i++) {
      const slotX = margin + slotW * i;
      const x = Phaser.Math.Between(
        Math.round(slotX + slotW * 0.15),
        Math.round(slotX + slotW * 0.85)
      );
      const angle = x < WORLD_W / 2 ? 45 : 135;
      const tank = new Tank(this, {
        x,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        name: `Player ${i + 1}`,
        angle,
      });
      tank.snapToTerrain(this.terrain);
      this.tanks.push(tank);
    }
  }

  private newTurn(first = false): void {
    if (!first) {
      do {
        this.current = (this.current + 1) % this.tanks.length;
      } while (!this.tanks[this.current].alive);
    }
    this.wind = Phaser.Math.Between(-70, 70);
    this.state = 'aiming';
    this.updateHud();

    for (const t of this.tanks) {
      if (t.shieldTurns > 0) t.shieldTurns--;
    }

    if (this.tanks[this.current]?.isAI) {
      this.aiThinkTimer = Phaser.Math.FloatBetween(0.6, 1.3);
    }

    this.turnCounter++;
    if (this.turnCounter % 3 === 0 && !this.plane && !this.crate) {
      this.spawnPlane();
    }
  }

  private handleAITurn(dt: number): void {
    this.aiThinkTimer -= dt;
    if (this.aiThinkTimer > 0) return;

    const t = this.tanks[this.current];
    const target = this.tanks.find((other) => other !== t && other.alive);
    if (!target || !t.aiLevel) {
      this.newTurn();
      return;
    }

    if (t.aiLevel === 'extreme' && t.shieldTurns === 0 && t.hp < 60 && t.gold >= SHIELD_COST) {
      t.gold -= SHIELD_COST;
      t.shieldTurns = SHIELD_DURATION;
    }

    this.aiChooseWeapon(t);
    const { angle, power } = computeAIShot(t, target, this.wind, this.terrain, t.aiLevel);
    t.angle = angle;
    t.power = power;
    this.fire(t);
  }

  private aiChooseWeapon(t: Tank): void {
    const level = t.aiLevel;
    if (level === 'easy') {
      t.selectedWeapon = 'mini';
      return;
    }
    if (level === 'hard') {
      if (t.ammo.granat > 0) {
        t.selectedWeapon = 'granat';
        return;
      }
      if (t.gold >= WEAPONS.granat.cost && Math.random() < 0.6) {
        t.buyWeapon(WEAPONS.granat);
        t.selectedWeapon = 'granat';
        return;
      }
      t.selectedWeapon = 'mini';
      return;
    }
    // extreme
    if (t.ammo.bomb > 0) {
      t.selectedWeapon = 'bomb';
      return;
    }
    if (t.gold >= WEAPONS.bomb.cost) {
      t.buyWeapon(WEAPONS.bomb);
      t.selectedWeapon = 'bomb';
      return;
    }
    if (t.ammo.granat > 0) {
      t.selectedWeapon = 'granat';
      return;
    }
    if (t.gold >= WEAPONS.granat.cost) {
      t.buyWeapon(WEAPONS.granat);
      t.selectedWeapon = 'granat';
      return;
    }
    t.selectedWeapon = 'mini';
  }

  private spawnPlane(): void {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = WORLD_H * 0.12;
    const startX = dir > 0 ? -80 : WORLD_W + 80;
    const dropX = Phaser.Math.Between(Math.round(WORLD_W * 0.3), Math.round(WORLD_W * 0.7));
    this.plane = { x: startX, y, vx: dir * 240, dropX, dropped: false };
  }

  private updatePlane(dt: number): void {
    const p = this.plane;
    if (!p) return;
    p.x += p.vx * dt;

    if (!p.dropped) {
      const reached = p.vx > 0 ? p.x >= p.dropX : p.x <= p.dropX;
      if (reached) {
        p.dropped = true;
        this.crate = new Crate(this, p.dropX, p.y + 10);
      }
    }

    this.drawPlane(p);

    if (p.x < -100 || p.x > WORLD_W + 100) {
      this.planeGraphics.clear();
      this.plane = null;
    }
  }

  private drawPlane(p: { x: number; y: number; vx: number }): void {
    const g = this.planeGraphics;
    g.clear();
    const dir = Math.sign(p.vx);
    const bodyLen = 46;

    g.fillStyle(0x2c2c35, 1);
    g.fillEllipse(p.x, p.y, bodyLen, 14);
    g.fillTriangle(
      p.x - dir * bodyLen * 0.3,
      p.y - 4,
      p.x - dir * bodyLen * 0.55,
      p.y - 20,
      p.x - dir * bodyLen * 0.1,
      p.y - 4
    );
    g.fillTriangle(
      p.x,
      p.y,
      p.x + dir * 6,
      p.y + 22,
      p.x - dir * 10,
      p.y + 4
    );
    g.fillTriangle(
      p.x,
      p.y,
      p.x + dir * 6,
      p.y - 22,
      p.x - dir * 10,
      p.y - 4
    );
    g.fillStyle(0xe2574c, 0.9);
    g.fillCircle(p.x + dir * bodyLen * 0.48, p.y, 2.5);
  }

  private applyCrateReward(t: Tank): void {
    if (!this.crate) return;
    const reward = this.crate.reward;
    if (reward.type === 'bomb') t.ammo.bomb += reward.amount;
    else if (reward.type === 'granat') t.ammo.granat += reward.amount;
    else if (reward.type === 'gold') t.gold += reward.amount;

    this.showFloatingText(this.crate.x, this.crate.y - 20, describeCrateReward(reward));
    this.crate.destroy();
    this.crate = null;
  }

  private showFloatingText(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '18px',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(85);
    this.tweens.add({
      targets: t,
      y: y - 50,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    });
  }

  private updateHud(): void {
    if (this.tanks.length === 0) return;
    const t = this.tanks[this.current];
    const hpLine = this.tanks
      .map((tk, i) => `P${i + 1}:${tk.alive ? tk.hp.toFixed(0) : 'ute'}`)
      .join('  ');
    const hint = this.deviceMode === 'desktop' ? '\nPiltangnar: sikta/kraft · Mellanslag: skjut' : '';
    this.hud.setText(`${t.name} sin tur\n${hpLine}${hint}`);
    const arrow = this.wind > 0 ? '→' : this.wind < 0 ? '←' : '·';
    this.windText.setText(`Vind ${arrow} ${Math.abs(this.wind).toFixed(0)}`);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);

    // twinkle stars
    this.starGraphics.clear();
    for (const s of this.stars) {
      s.tw += dt * 2;
      const a = 0.5 + 0.5 * Math.sin(s.tw);
      this.starGraphics.fillStyle(0xffffff, (0.3 + a * 0.7) * this.theme.starAlpha);
      this.starGraphics.fillCircle(s.x, s.y, s.r);
    }

    if (this.plane) this.updatePlane(dt);
    if (this.crate) {
      this.crate.update(dt, this.terrain);
      this.crate.draw();
    }

    if (this.state === 'setup') {
      if (Phaser.Input.Keyboard.JustDown(this.twoKey)) this.startMatch(2);
      else if (Phaser.Input.Keyboard.JustDown(this.threeKey)) this.startMatch(3);
      else if (Phaser.Input.Keyboard.JustDown(this.fourKey)) this.startMatch(4);
    } else if (this.state === 'aiming') {
      if (this.tanks[this.current]?.isAI) this.handleAITurn(dt);
      else this.handleAiming(dt);
    } else if (this.state === 'firing') this.handleFiring(dt);
    else if (this.state === 'resolving') this.handleResolving(dt);
    else if (this.state === 'gameover') {
      if (Phaser.Input.Keyboard.JustDown(this.rKey)) this.restart();
    }

    const showHud = this.state === 'aiming' && !this.tanks[this.current]?.isAI;
    if (showHud !== this.hudShown) {
      this.hudShown = showHud;
      this.setControlHudVisible(showHud);
      if (showHud) this.resetHudAnchor();
    }
    if (showHud) this.updateControlHud();

    for (let i = 0; i < this.tanks.length; i++) {
      this.tanks[i].tick(dt);
      this.tanks[i].draw(this.state !== 'gameover' && i === this.current);
    }
  }

  private handleAiming(dt: number): void {
    const t = this.tanks[this.current];
    const turnSpeed = 60; // deg/sec
    if (this.cursors.left?.isDown) t.angle = Phaser.Math.Clamp(t.angle + turnSpeed * dt, 0, 180);
    if (this.cursors.right?.isDown) t.angle = Phaser.Math.Clamp(t.angle - turnSpeed * dt, 0, 180);
    if (this.cursors.up?.isDown) t.power = Phaser.Math.Clamp(t.power + 45 * dt, 5, 100);
    if (this.cursors.down?.isDown) t.power = Phaser.Math.Clamp(t.power - 45 * dt, 5, 100);

    this.updateHud();

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.fire(t);
    }
  }

  private fire(t: Tank): void {
    const weapon = WEAPONS[t.selectedWeapon];
    if (weapon.cost > 0 && t.ammo[weapon.id] <= 0) return;

    this.audio.shoot();
    t.fireRecoil();
    const rad = Phaser.Math.DegToRad(t.angle);
    const speed = 130 + t.power * 3.6;
    const muzzle = t.muzzlePosition();
    this.muzzleEmitter.explode(8, muzzle.x, muzzle.y);
    this.projectile = {
      x: muzzle.x,
      y: muzzle.y,
      vx: Math.cos(rad) * speed,
      vy: -Math.sin(rad) * speed,
      trail: [],
      weapon: weapon.id,
    };
    this.state = 'firing';

    if (weapon.cost > 0) t.ammo[weapon.id] -= 1;
  }

  private handleFiring(dt: number): void {
    const p = this.projectile;
    if (!p) return;

    p.vy += GRAVITY * dt;
    p.vx += this.wind * 0.12 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 18) p.trail.shift();

    this.projGraphics.clear();
    for (let i = 0; i < p.trail.length; i++) {
      const pt = p.trail[i];
      const alpha = (i / p.trail.length) * 0.8;
      this.projGraphics.fillStyle(0xffe066, alpha);
      this.projGraphics.fillCircle(pt.x, pt.y, 2.5);
    }
    this.projGraphics.fillStyle(0xfff6d8, 1);
    this.projGraphics.fillCircle(p.x, p.y, 4);

    let hitOther = false;
    for (let i = 0; i < this.tanks.length; i++) {
      if (i === this.current || !this.tanks[i].alive) continue;
      const t = this.tanks[i];
      if (Phaser.Math.Distance.Between(p.x, p.y, t.centerX, t.centerY) < 16) {
        hitOther = true;
        break;
      }
    }
    const offscreen = p.x < -60 || p.x > WORLD_W + 60 || p.y > WORLD_H + 120;
    const hitGround = p.y >= this.terrain.heightAt(p.x);
    const hitCrate = !!this.crate && Phaser.Math.Distance.Between(p.x, p.y, this.crate.x, this.crate.y) < this.crate.hitRadius;

    if (hitOther || hitGround || hitCrate || offscreen) {
      this.projGraphics.clear();
      if (offscreen && !hitGround && !hitOther && !hitCrate) {
        this.state = 'resolving';
        this.resolveTimer = 0;
      } else {
        this.explode(p.x, Math.min(p.y, WORLD_H), p.weapon);
        if (hitCrate) this.applyCrateReward(this.tanks[this.current]);
      }
      this.projectile = null;
    }
  }

  private resolveTimer = 0;

  private explode(x: number, y: number, weaponId: WeaponId): void {
    const weapon = WEAPONS[weaponId];
    const scale = weaponId === 'bomb' ? 1.7 : weaponId === 'mini' ? 0.55 : 1;

    this.terrain.crater(x, y, weapon.radius);
    this.audio.explosion(scale);
    this.cameras.main.shake(260 * scale, 0.014 * scale);

    this.fxGraphics.clear();
    this.fxFrame = 0;
    this.fxX = x;
    this.fxY = y;
    this.fxScale = scale;

    this.debrisEmitter.explode(Math.round(18 * scale), x, y);
    this.smokeEmitter.explode(Math.round(10 * scale), x, y - 6);
    this.emberEmitter.explode(Math.round(26 * scale), x, y);

    const shooter = this.tanks[this.current];
    let hitOpponent = false;
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, t.centerX, t.centerY);
      const reach = weapon.radius + 18;
      if (d < reach) {
        const dmg = Math.max(0, (1 - d / reach) * weapon.damage);
        if (dmg > 0) {
          t.applyDamage(dmg);
          this.checkElimination(t);
          if (t !== shooter) hitOpponent = true;
        }
      }
    }
    if (hitOpponent) shooter.gold += 2;

    this.state = 'resolving';
    this.resolveTimer = 0;
    this.updateHud();
  }

  private fxFrame = 0;
  private fxX = 0;
  private fxY = 0;
  private fxScale = 1;

  private checkElimination(t: Tank): void {
    if (t.alive || t.eliminationAnnounced) return;
    t.eliminationAnnounced = true;
    this.announceElimination(t);
  }

  private announceElimination(t: Tank): void {
    const text = this.add
      .text(WORLD_W / 2, WORLD_H * 0.32, `${t.name} är utslagen!`, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '34px',
        color: '#ff5c5c',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: text,
          alpha: 0,
          delay: 1400,
          duration: 500,
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  private handleResolving(dt: number): void {
    this.resolveTimer += dt;

    if (this.fxFrame < 20) {
      this.fxFrame++;
      const t = this.fxFrame / 20;
      const alpha = 1 - t;
      this.fxGraphics.clear();

      if (this.fxFrame <= 5) {
        this.fxGraphics.fillStyle(0xffffff, 1 - this.fxFrame / 5);
        this.fxGraphics.fillCircle(this.fxX, this.fxY, (30 - this.fxFrame * 4) * this.fxScale);
      }

      const r = t * 95 * this.fxScale;
      this.fxGraphics.fillStyle(0xffcf5c, alpha * 0.7);
      this.fxGraphics.fillCircle(this.fxX, this.fxY, r * 0.45);
      this.fxGraphics.lineStyle(5, 0xff9c3c, alpha);
      this.fxGraphics.strokeCircle(this.fxX, this.fxY, r);
      this.fxGraphics.lineStyle(2, 0xfff0c0, alpha * 0.85);
      this.fxGraphics.strokeCircle(this.fxX, this.fxY, r * 0.65);
    } else {
      this.fxGraphics.clear();
    }

    let allGrounded = true;
    for (const t of this.tanks) {
      const groundY = t.groundY(this.terrain);
      if (t.y < groundY - 1) {
        if (t.fallStartY === null) t.fallStartY = t.y;
        t.fallSpeed += GRAVITY * dt;
        t.y = Math.min(groundY, t.y + t.fallSpeed * dt);
        allGrounded = false;
      } else {
        if (t.fallStartY !== null) {
          const fallDist = t.y - t.fallStartY;
          const threshold = 20;
          if (fallDist > threshold && t.alive) {
            const dmg = Math.min(40, (fallDist - threshold) * 0.25);
            t.applyDamage(dmg);
            this.checkElimination(t);
          }
          t.fallStartY = null;
        }
        t.y = groundY;
        t.fallSpeed = 0;
      }
    }

    if (allGrounded && this.resolveTimer > 0.5) {
      const aliveTanks = this.tanks.filter((t) => t.alive);
      if (aliveTanks.length <= 1) {
        this.state = 'gameover';
        const winner = aliveTanks[0];
        this.bannerText.setText(winner ? `${winner.name} vinner!` : 'Oavgjort!');
        this.bannerText.setVisible(true);
        this.restartBg.setVisible(true).setInteractive({ useHandCursor: true });
        this.restartBtnText.setVisible(true);
      } else {
        this.newTurn();
      }
    }
  }

  private restart(): void {
    this.bannerText.setVisible(false);
    this.scene.restart();
  }
}
