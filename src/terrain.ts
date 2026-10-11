import Phaser from 'phaser';
import type { TerrainTheme } from './terrainThemes';

export class Terrain {
  readonly width: number;
  readonly height: number;
  private heights: Float32Array;
  private graphics: Phaser.GameObjects.Graphics;
  private minY: number;
  private maxY: number;
  private theme: TerrainTheme;
  private difficulty: number;

  /** @param difficulty 0-100. Higher = rougher terrain and more likely to have a tall blocking peak. */
  constructor(
    scene: Phaser.Scene,
    width: number,
    height: number,
    theme: TerrainTheme,
    difficulty = 0
  ) {
    this.width = width;
    this.height = height;
    this.theme = theme;
    this.difficulty = Phaser.Math.Clamp(difficulty, 0, 100);
    this.minY = height * 0.35;
    this.maxY = height * 0.82;
    this.heights = new Float32Array(width);
    this.graphics = scene.add.graphics();
    this.generate();
    this.redraw();
  }

  /** Midpoint displacement fractal landscape, plus an optional blocking peak at higher difficulty. */
  private generate(): void {
    let size = 1;
    while (size + 1 < this.width) size *= 2;
    size += 1;
    const work = new Float32Array(size);

    const roughness = 1 + (this.difficulty / 100) * 0.7;

    const baseline = (this.minY + this.maxY) / 2;
    work[0] = baseline + (Math.random() * 2 - 1) * this.height * 0.12;
    work[size - 1] = baseline + (Math.random() * 2 - 1) * this.height * 0.12;

    let step = size - 1;
    let amplitude = this.height * 0.22 * roughness;
    while (step > 1) {
      const half = step / 2;
      for (let i = half; i < size - 1; i += step) {
        const avg = (work[i - half] + work[i + half]) / 2;
        work[i] = avg + (Math.random() * 2 - 1) * amplitude;
      }
      amplitude *= 0.52;
      step = half;
    }

    for (let x = 0; x < this.width; x++) {
      const srcIdx = (x / (this.width - 1)) * (size - 1);
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(i0 + 1, size - 1);
      const t = srcIdx - i0;
      let h = work[i0] * (1 - t) + work[i1] * t;
      h = Phaser.Math.Clamp(h, this.minY, this.maxY);
      this.heights[x] = h;
    }

    this.smooth(2);
    this.maybeAddBlockingPeak();
  }

  /** At higher difficulty, chance of a tall mountain that blocks direct line-of-fire between players. */
  private maybeAddBlockingPeak(): void {
    const chance = this.difficulty / 100;
    if (Math.random() >= chance) return;

    const peakX = Phaser.Math.Between(Math.floor(this.width * 0.32), Math.floor(this.width * 0.68));
    const peakWidth = Phaser.Math.Between(70, 130);
    const peakExtra = this.height * 0.05 + (this.difficulty / 100) * this.height * 0.22;
    const floor = this.height * 0.06;

    const x0 = Math.max(0, peakX - peakWidth);
    const x1 = Math.min(this.width - 1, peakX + peakWidth);
    for (let x = x0; x <= x1; x++) {
      const dx = (x - peakX) / peakWidth;
      const falloff = Math.cos(Phaser.Math.Clamp(dx, -1, 1) * (Math.PI / 2));
      const bump = peakExtra * falloff * falloff;
      const candidate = Math.max(floor, this.heights[x] - bump);
      this.heights[x] = Math.min(this.heights[x], candidate);
    }
  }

  private smooth(passes: number): void {
    for (let p = 0; p < passes; p++) {
      const copy = this.heights.slice();
      for (let x = 1; x < this.width - 1; x++) {
        this.heights[x] = (copy[x - 1] + copy[x] * 2 + copy[x + 1]) / 4;
      }
    }
  }

  heightAt(x: number): number {
    const cx = Phaser.Math.Clamp(Math.round(x), 0, this.width - 1);
    return this.heights[cx];
  }

  /** Carve a round crater into the terrain, returns affected x-range for debris FX. */
  crater(cx: number, cy: number, radius: number): { x0: number; x1: number } {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius));
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const inside = radius * radius - dx * dx;
      if (inside <= 0) continue;
      const craterFloor = cy + Math.sqrt(inside);
      if (craterFloor > this.heights[x]) {
        this.heights[x] = Math.min(this.maxY + 60, craterFloor);
      }
    }
    this.redraw();
    return { x0, x1 };
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    g.fillGradientStyle(
      this.theme.groundTop,
      this.theme.groundTop,
      this.theme.groundBottom,
      this.theme.groundBottom,
      1,
      1,
      1,
      1
    );
    g.beginPath();
    g.moveTo(0, this.height);
    for (let x = 0; x < this.width; x++) g.lineTo(x, this.heights[x]);
    g.lineTo(this.width, this.height);
    g.closePath();
    g.fillPath();

    g.lineStyle(4, this.theme.ridgeColor, 1);
    g.beginPath();
    g.moveTo(0, this.heights[0]);
    for (let x = 1; x < this.width; x++) g.lineTo(x, this.heights[x]);
    g.strokePath();
  }
}
