import { Player, DivisionInfo, Tournament } from './types';

export const PLAYERS: Player[] = [
  
];

export const DIVISIONS: Record<string, DivisionInfo> = {
  
};

export const TOURNAMENTS: Tournament[] = [
 
];

export const GAME_DATA: Record<string, { name: string, maps: string[] }> = {
  BGMI: {
    name: 'BGMI',
    maps: ['Erangel', 'Miramar', 'Rondo', 'Sanhok', 'Vikendi', 'Livik']
  },
  PUBG: {
    name: 'PUBG',
    maps: ['Erangel', 'Miramar', 'Rondo', 'Sanhok', 'Vikendi', 'Livik']
  },
  'Free Fire': {
    name: 'Free Fire',
    maps: ['Bermuda', 'Remastered', 'Purgatory', 'Kalahari', 'Alpine', 'NeXTerra']
  },
  Valorant: {
    name: 'Valorant',
    maps: ['Abyss', 'Lotus', 'Sunset', 'Pearl', 'Fracture', 'Breeze', 'Icebox', 'Bind', 'Haven', 'Split', 'Ascent']
  },
  'COD': {
    name: 'COD',
    maps: ['Nuketown', 'Terminal', 'Shipment', 'Crash']
  }
};
 