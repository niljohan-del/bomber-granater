import Phaser from 'phaser';
import type { Terrain } from './terrain';

export type CrateReward =
  | { type: 'bomb'; amount: number }
  | { type: 'granat'; amount: number }
  | { type: 'gold'; amount: number }
  | { type: 'empty' };

export function rollCrateReward(): CrateReward {
  const roll = Phaser.Math.Between(1, 10);
  if (roll === 1) return { type: 'bomb', amount: 3 };
  if (roll === 2) return { type: 'bomb', amount: 1 };
  if (roll === 3) return { type: 'granat', amount: 3 };
  if (roll === 4) return { type: 'granat', amount: 1 };
  if (roll <= 9) return { type: 'gold', amount: 5 };
  return { type: 'empty' };
}

export function describeCrateReward(reward: CrateReward): string {
  switch (reward.type) {
    case 'bomb':
      return `+${reward.amount} Bomb`;
    case 'granat':
      return `+${reward.amount} Granat`;
    case 'gold':
      return `+${reward.amount} Güld`;
    default:
      return 'Tomt!';
  }
}

export class Crate {
  scene: Phaser.Scene;
  x: number;
  y: number;
  falling = true;
  readonly size = 22;
  readonly hitRadius = 18;
  readonly reward: CrateReward;
  private fallSpeed = 55;
  private sway = Math.random() * Math.PI * 2;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.reward = rollCrateReward();
    this.graphics = scene.add.graphics().setDepth(5);
  }

  update(dt: number, terrain: Terrain): void {
    if (!this.falling) return;
    this.sway += dt * 2;
    this.x += Math.sin(this.sway) * 6 * dt;
    this.y += this.fallSpeed * dt;
    const groundY = terrain.heightAt(this.x) - this.size / 2;
    if (this.y >= groundY) {
      this.y = groundY;
      this.falling = false;
    }
  }

  draw(): void {
    const g = this.graphics;
    g.clear();
    const hw = this.size / 2;

    if (this.falling) {
      const canopyY = this.y - hw - 26;
      g.lineStyle(1.5, 0xe8e6f0, 0.8);
      g.beginPath();
      g.moveTo(this.x - hw, this.y - hw);
      g.lineTo(this.x - 12, canopyY + 6);
      g.moveTo(this.x + hw, this.y - hw);
      g.lineTo(this.x + 12, canopyY + 6);
      g.moveTo(this.x, this.y - hw);
      g.lineTo(this.x, canopyY + 8);
      g.strokePath();

      g.fillStyle(0xe2574c, 1);
      g.beginPath();
      g.arc(this.x, canopyY + 10, 22, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xf2f2f2, 1);
      g.beginPath();
      g.arc(this.x - 11, canopyY + 10, 11, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xf2f2f2, 1);
      g.beginPath();
      g.arc(this.x + 11, canopyY + 10, 11, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
    }

    g.fillStyle(0x6b4a2f, 1);
    g.fillRect(this.x - hw, this.y - hw, this.size, this.size);
    g.lineStyle(2, 0x3a2a1c, 1);
    g.strokeRect(this.x - hw, this.y - hw, this.size, this.size);
    g.lineStyle(1.5, 0x3a2a1c, 0.9);
    g.beginPath();
    g.moveTo(this.x - hw, this.y - hw);
    g.lineTo(this.x + hw, this.y + hw);
    g.moveTo(this.x + hw, this.y - hw);
    g.lineTo(this.x - hw, this.y + hw);
    g.strokePath();
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
