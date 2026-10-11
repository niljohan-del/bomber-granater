import Phaser from 'phaser';
import type { Terrain } from './terrain';
import type { Tank } from './tank';

export type AILevel = 'easy' | 'hard' | 'extreme';

export const AI_LEVEL_NAMES: Record<AILevel, string> = {
  easy: 'Easypeasy',
  hard: 'Hardypardy',
  extreme: 'Extremeteme',
};

const GRAVITY = 260;
const WIND_FACTOR = 0.12;

function simulateLanding(
  startX: number,
  startY: number,
  angleDeg: number,
  power: number,
  wind: number,
  terrain: Terrain
): number {
  const rad = Phaser.Math.DegToRad(angleDeg);
  const speed = 130 + power * 3.6;
  let x = startX;
  let y = startY;
  let vx = Math.cos(rad) * speed;
  let vy = -Math.sin(rad) * speed;
  const dt = 0.03;

  for (let i = 0; i < 400; i++) {
    vy += GRAVITY * dt;
    vx += wind * WIND_FACTOR * dt;
    x += vx * dt;
    y += vy * dt;
    if (x < -200 || x > terrain.width + 200) break;
    if (y >= terrain.heightAt(x)) break;
  }
  return x;
}

function solvePower(
  startX: number,
  startY: number,
  angleDeg: number,
  targetX: number,
  wind: number,
  terrain: Terrain
): number {
  const desiredDist = Math.abs(targetX - startX);
  let lo = 5;
  let hi = 100;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const landX = simulateLanding(startX, startY, angleDeg, mid, wind, terrain);
    const dist = Math.abs(landX - startX);
    if (dist < desiredDist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Numerically aims at the target using the same physics as real shots, then adds difficulty-based error. */
export function computeAIShot(
  shooter: Tank,
  target: Tank,
  wind: number,
  terrain: Terrain,
  level: AILevel
): { angle: number; power: number } {
  const dir = target.x >= shooter.x ? 1 : -1;
  const baseAngle = dir > 0 ? 50 : 130;

  const power = solvePower(shooter.x, shooter.centerY, baseAngle, target.x, wind, terrain);

  const errorScale = level === 'easy' ? 1 : level === 'hard' ? 0.35 : 0.08;
  const angleError = (Math.random() * 2 - 1) * 18 * errorScale;
  const powerError = (Math.random() * 2 - 1) * 20 * errorScale;

  return {
    angle: Phaser.Math.Clamp(baseAngle + angleError, 5, 175),
    power: Phaser.Math.Clamp(power + powerError, 5, 100),
  };
}
