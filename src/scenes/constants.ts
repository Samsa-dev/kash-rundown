export const W = 390;
export const H = 844;
export const HORIZON_Y = 300;

export const SIDE_W = 50;
export const SWALK_W = 10;
export const ROAD_L_BOT = -200;
export const ROAD_R_BOT = W + 200;
export const ROAD_L_HOR = W / 2 - 80;             // 115
export const ROAD_R_HOR = W / 2 + 80;             // 275

export function roadToScreen(rx: number, rz: number): { x: number; y: number; scale: number } {
  const screenY = HORIZON_Y + (H - HORIZON_Y) * rz;
  const roadL = ROAD_L_HOR + (ROAD_L_BOT - ROAD_L_HOR) * rz;
  const roadR = ROAD_R_HOR + (ROAD_R_BOT - ROAD_R_HOR) * rz;
  const screenX = (roadL + roadR) / 2 + rx * (roadR - roadL) / 2;
  const scale = ((roadR - roadL) / (ROAD_R_BOT - ROAD_L_BOT)) * 1.5;
  return { x: screenX, y: screenY, scale };
}

export const SIDE_BLDG_HEIGHTS = [260, 340, 220, 390, 280, 360, 240, 310];
export const SIDE_BLDG_COLS = [4, 5, 3, 4, 5, 4, 3, 5];
export const SIDE_BLDG_COLORS = ['#1e0838', '#160530', '#2a0840', '#120428', '#200848', '#180538', '#250640', '#1a0430'];
