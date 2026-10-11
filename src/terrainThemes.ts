export interface TerrainTheme {
  name: string;
  skyTop: number;
  skyMid: number;
  skyBottom: number;
  groundTop: number;
  groundBottom: number;
  ridgeColor: number;
  distantRidge1: number;
  distantRidge2: number;
  orbColor: number;
  orbGlow: number;
  orbRadius: number;
  starAlpha: number;
}

export const TERRAIN_THEMES: TerrainTheme[] = [
  {
    name: 'Öken',
    skyTop: 0x0b0b2e,
    skyMid: 0x3a1850,
    skyBottom: 0x7a3a5c,
    groundTop: 0x6b4a2f,
    groundBottom: 0x2e1f14,
    ridgeColor: 0x6fae4a,
    distantRidge1: 0x2a2250,
    distantRidge2: 0x3c2d55,
    orbColor: 0xfff6d8,
    orbGlow: 0xfff6d8,
    orbRadius: 36,
    starAlpha: 1,
  },
  {
    name: 'Gräsland',
    skyTop: 0x0c1c3a,
    skyMid: 0x2c4a6e,
    skyBottom: 0x6a8fae,
    groundTop: 0x4a8f3c,
    groundBottom: 0x2b4a1e,
    ridgeColor: 0x8fe06a,
    distantRidge1: 0x1e3350,
    distantRidge2: 0x2c4a5c,
    orbColor: 0xfff3c0,
    orbGlow: 0xfff3c0,
    orbRadius: 34,
    starAlpha: 0.65,
  },
  {
    name: 'Snö',
    skyTop: 0x0a1a3a,
    skyMid: 0x274b73,
    skyBottom: 0x6e93b8,
    groundTop: 0xe8f1f7,
    groundBottom: 0x9db8cc,
    ridgeColor: 0xffffff,
    distantRidge1: 0x24365a,
    distantRidge2: 0x3a5478,
    orbColor: 0xeaf6ff,
    orbGlow: 0xeaf6ff,
    orbRadius: 34,
    starAlpha: 0.9,
  },
  {
    name: 'Vulkan',
    skyTop: 0x1a0505,
    skyMid: 0x4a1208,
    skyBottom: 0x8a2e10,
    groundTop: 0x2a2020,
    groundBottom: 0x120d0d,
    ridgeColor: 0xff6a2c,
    distantRidge1: 0x3a1410,
    distantRidge2: 0x521a12,
    orbColor: 0xffb35c,
    orbGlow: 0xff5c2c,
    orbRadius: 32,
    starAlpha: 0.35,
  },
  {
    name: 'Måne',
    skyTop: 0x000000,
    skyMid: 0x05050a,
    skyBottom: 0x10101c,
    groundTop: 0x8a8a92,
    groundBottom: 0x3a3a42,
    ridgeColor: 0xb8b8c2,
    distantRidge1: 0x16161e,
    distantRidge2: 0x22222c,
    orbColor: 0x6fa8ff,
    orbGlow: 0x3f6fcf,
    orbRadius: 42,
    starAlpha: 1,
  },
];

export function pickRandomTheme(): TerrainTheme {
  return TERRAIN_THEMES[Math.floor(Math.random() * TERRAIN_THEMES.length)];
}
