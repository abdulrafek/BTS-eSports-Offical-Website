export interface Player {
  id: string;
  ign: string;
  uid: string;
  role: string;
  kd: string;
  kdHistory: number[];
  div: string;
  matches: number;
  color: string;
  status?: string;
  scrimsKills?: number;
  scrimsMatches?: number;
  tourneyKills?: number;
  tourneyMatches?: number;
  achievements?: string[];
  instagram?: string;
  youtube?: string;
  discord?: string;
  game?: string;
}

export interface Achievement {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  game: string;
  division?: string;
}

export interface DivisionInfo {
  name: string;
  colorClass: string;
  badge: string;
  badgeBorder: string;
  badgeColor: string;
  desc: string;
}

export type TournamentStatus = 'open' | 'upcoming' | 'ongoing' | 'closed' | 'finished';

export interface Tournament {
  id?: string;
  game: string;
  name: string;
  pool?: string;
  prize?: string;
  fee?: string;
  slots: number;
  total: number;
  status: TournamentStatus;
  date: string;
  imageUrl?: string;
  discordLink?: string;
  instagramLink?: string;
  youtubeLink?: string;
}

export interface TournamentResult {
  id: string;
  tournamentId: string;
  tournamentName: string;
  game: string;
  teamName: string;
  rank: number;
  prizeWon: string;
  mvp: string;
  date: string;
}

export type Page = 'home' | 'tournament' | 'registration' | 'ranking' | 'roster' | 'recruitment' | 'management' | 'about' | 'signin' | 'admin' | 'results';

export interface TournamentRegistration {
  id?: string;
  teamName: string;
  leaderName: string;
  ign: string;
  playerId: string;
  discordId?: string;
  contact?: string;
  squad: { ign: string, uid: string }[];
  uid: string;
  email: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: any;
}

export interface RankingPlayer extends Player {
  score: number;
}
