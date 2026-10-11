export type WeaponId = 'mini' | 'granat' | 'bomb';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cost: number;
  damage: number;
  radius: number;
}

export const WEAPON_ORDER: WeaponId[] = ['mini', 'granat', 'bomb'];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  mini: { id: 'mini', name: 'Minigranat', cost: 0, damage: 15, radius: 17 },
  granat: { id: 'granat', name: 'Granat', cost: 6, damage: 34, radius: 38 },
  bomb: { id: 'bomb', name: 'Bomb', cost: 12, damage: 130, radius: 62 },
};
