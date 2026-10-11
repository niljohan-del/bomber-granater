import Phaser from 'phaser';
import type { Terrain } from './terrain';
import type { WeaponDef, WeaponId } from './weapons';

export interface TankOptions {
  x: number;
  color: number;
  name: string;
  angle: number;
}

export class Tank {
  scene: Phaser.Scene;
  x: number;
  y: number = 0;
  hp = 100;
  angle: number;
  power = 55;
  color: number;
  name: string;
  alive = true;
  falling = false;
  fallSpeed = 0;
  fallStartY: number | null = null;
  recoil = 0;
  eliminationAnnounced = false;

  gold = 5;
  ammo: Record<WeaponId, number> = { mini: Infinity, granat: 0, bomb: 0 };
  selectedWeapon: WeaponId = 'mini';
  shieldTurns = 0;

  isAI = false;
  aiLevel: 'easy' | 'hard' | 'extreme' | null = null;

  readonly bodyWidth = 36;
  readonly bodyHeight = 16;
  private readonly barrelLen = 27;

  private lightColor: number;
  private darkColor: number;

  private graphics: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, opts: TankOptions) {
    this.scene = scene;
    this.x = opts.x;
    this.color = opts.color;
    this.name = opts.name;
    this.angle = opts.angle;

    const base = Phaser.Display.Color.ValueToColor(this.color);
    this.lightColor = base.clone().lighten(30).color;
    this.darkColor = base.clone().darken(35).color;

    this.graphics = scene.add.graphics();
    this.hpBarBg = scene.add.graphics();
    this.hpBarFg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, opts.name, {
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '13px',
        color: '#e8e6f0',
      })
      .setOrigin(0.5, 1);
  }

  snapToTerrain(terrain: Terrain): void {
    this.y = terrain.heightAt(this.x) - this.bodyHeight / 2;
  }

  groundY(terrain: Terrain): number {
    return terrain.heightAt(this.x) - this.bodyHeight / 2;
  }

  get centerX(): number {
    return this.x;
  }
  get centerY(): number {
    return this.y - 6;
  }

  muzzlePosition(): { x: number; y: number } {
    const rad = Phaser.Math.DegToRad(this.angle);
    return {
      x: this.x + Math.cos(rad) * this.barrelLen,
      y: this.centerY - Math.sin(rad) * this.barrelLen,
    };
  }

  fireRecoil(): void {
    this.recoil = 1;
  }

  tick(dt: number): void {
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4.5);
  }

  applyDamage(dmg: number): void {
    if (this.shieldTurns > 0) return;
    this.hp = Phaser.Math.Clamp(this.hp - dmg, 0, 100);
    if (this.hp <= 0) this.alive = false;
  }

  canBuy(weapon: WeaponDef): boolean {
    return this.gold >= weapon.cost;
  }

  buyWeapon(weapon: WeaponDef): boolean {
    if (!this.canBuy(weapon)) return false;
    this.gold -= weapon.cost;
    this.ammo[weapon.id] += 1;
    return true;
  }

  draw(isActive: boolean): void {
    const g = this.graphics;
    g.clear();

    const bx = this.x;
    const by = this.y;
    const hw = this.bodyWidth / 2;
    const hh = this.bodyHeight / 2;

    // ground shadow
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(bx, by + hh + 4, this.bodyWidth, 7);

    // treads
    g.fillStyle(0x121217, 1);
    g.fillRoundedRect(bx - hw - 3, by + hh - 6, this.bodyWidth + 6, 10, 4);
    g.fillStyle(0x24242e, 1);
    for (let i = -4; i <= 4; i++) {
      g.fillRoundedRect(bx + i * 5 - 1.5, by + hh - 5, 3, 8, 1);
    }

    // hull shadow band (reads as underside depth)
    g.fillStyle(this.darkColor, 1);
    g.fillRoundedRect(bx - hw, by - hh + 3, this.bodyWidth, this.bodyHeight - 3, 5);

    // hull main
    g.fillStyle(this.color, 1);
    g.fillRoundedRect(bx - hw, by - hh, this.bodyWidth, this.bodyHeight - 5, 5);

    // hull highlight stripe
    g.fillStyle(this.lightColor, 0.9);
    g.fillRoundedRect(bx - hw + 3, by - hh + 1.5, this.bodyWidth - 6, 3, 1.5);

    // turret base shadow + body
    g.fillStyle(this.darkColor, 1);
    g.fillCircle(bx, this.centerY + 1.5, 10);
    g.fillStyle(this.color, 1);
    g.fillCircle(bx, this.centerY, 9.5);
    g.fillStyle(this.lightColor, 0.75);
    g.fillCircle(bx - 2.8, this.centerY - 2.8, 3.4);
    g.lineStyle(1.5, this.darkColor, 0.8);
    g.strokeCircle(bx, this.centerY, 9.5);

    // barrel with recoil pullback + muzzle brake
    const rad = Phaser.Math.DegToRad(this.angle);
    const len = this.barrelLen - this.recoil * 8;
    const dirX = Math.cos(rad);
    const dirY = -Math.sin(rad);
    const baseX = bx + dirX * 6;
    const baseY = this.centerY + dirY * 6;
    const tipX = bx + dirX * len;
    const tipY = this.centerY + dirY * len;

    g.lineStyle(6.5, 0x15151b, 1);
    g.beginPath();
    g.moveTo(baseX, baseY);
    g.lineTo(tipX, tipY);
    g.strokePath();
    g.lineStyle(3, 0x3a3a46, 1);
    g.beginPath();
    g.moveTo(baseX, baseY);
    g.lineTo(tipX, tipY);
    g.strokePath();
    g.fillStyle(0x2c2c35, 1);
    g.fillCircle(tipX, tipY, 4);
    g.fillStyle(0x15151b, 1);
    g.fillCircle(tipX, tipY, 2);

    // antenna
    g.lineStyle(1.4, 0xcfcfd8, 0.85);
    g.beginPath();
    g.moveTo(bx + hw - 5, by - hh + 1);
    g.lineTo(bx + hw - 3, by - hh - 11);
    g.strokePath();
    g.fillStyle(0xff5c5c, 0.95);
    g.fillCircle(bx + hw - 3, by - hh - 11, 1.8);

    if (isActive) {
      const pulse = 0.6 + 0.4 * Math.sin(this.scene.time.now / 160);
      g.lineStyle(2, 0xffe066, pulse);
      g.strokeCircle(bx, this.centerY, 18);
    }

    if (this.shieldTurns > 0) {
      const shimmer = 0.55 + 0.35 * Math.sin(this.scene.time.now / 120);
      g.lineStyle(3, 0x4fe8ff, shimmer);
      g.strokeCircle(bx, this.centerY, 26);
      g.fillStyle(0x4fe8ff, 0.08);
      g.fillCircle(bx, this.centerY, 26);
    }

    // hp bar (below the tank)
    const barW = 42;
    const barX = bx - barW / 2;
    const barY = by + hh + 16;
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x000000, 0.5);
    this.hpBarBg.fillRect(barX, barY, barW, 6);

    this.hpBarFg.clear();
    const hpColor = this.hp > 50 ? 0x5fe35f : this.hp > 20 ? 0xf2c14e : 0xe34f4f;
    this.hpBarFg.fillStyle(hpColor, 1);
    this.hpBarFg.fillRect(barX, barY, (barW * this.hp) / 100, 6);

    this.label.setPosition(bx, by - hh - 6);
  }

  destroy(): void {
    this.graphics.destroy();
    this.hpBarBg.destroy();
    this.hpBarFg.destroy();
    this.label.destroy();
  }
}
