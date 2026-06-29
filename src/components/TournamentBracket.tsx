import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  Trophy, 
  Shield, 
  Edit3, 
  X, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle,
  TrendingUp,
  Settings,
  Users
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  score?: number;
}

interface BracketMatch {
  id: string; // e.g. "U-R1M1", "L-R1M1", "GF"
  round: number;
  type: 'upper' | 'lower' | 'grand_final';
  team1: Team;
  team2: Team;
  winnerId?: string;
  nextMatchId?: string; // Next match to advance winner
  nextMatchSlot?: 'team1' | 'team2';
  loserMatchId?: string; // Where the loser drops (only for upper bracket)
  loserMatchSlot?: 'team1' | 'team2';
  status: 'scheduled' | 'live' | 'completed';
  map?: string;
}

interface TournamentBracketProps {
  tournamentId: string;
  registrations: any[];
  isAdmin: boolean;
  onToast: (title: string, message: string) => void;
}

const DEFAULT_PRO_TEAMS = [
  "Sentinels", "Fnatic", "FaZe Clan", "Natus Vincere", 
  "G2 Esports", "Team Liquid", "T1", "ZETA DIVISION",
  "Gen.G", "DRX", "Paper Rex", "LOUD", 
  "Evil Geniuses", "Karmine Corp", "Team Vitality", "100 Thieves"
];

export const TournamentBracket: React.FC<TournamentBracketProps> = ({
  tournamentId,
  registrations,
  isAdmin,
  onToast
}) => {
  const [bracketType, setBracketType] = useState<'single' | 'double'>('single');
  const [teamCount, setTeamCount] = useState<4 | 8 | 16>(8);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [matchMap, setMatchMap] = useState<string>('Haven');
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);

  const canEdit = isAdmin || adminOverride;

  // Listen to Firestore matches subcollection
  useEffect(() => {
    const matchesRef = collection(db, 'tournaments', tournamentId, 'matches');
    
    const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
      const loadedMatches: BracketMatch[] = [];
      snapshot.forEach((doc) => {
        loadedMatches.push({ id: doc.id, ...doc.data() as any });
      });
      
      // Sort matches so rounds and layouts render deterministically
      setMatches(loadedMatches);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to matches:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tournamentId]);

  // Generate a brand new bracket (Single or Double Elimination)
  const handleGenerateBracket = async () => {
    setIsUpdating(true);
    try {
      // 1. Gather tournament teams (or default pro teams if registrations are empty)
      const inputTeams = registrations.map(reg => ({
        id: reg.id || Math.random().toString(36).substr(2, 9),
        name: reg.teamName || reg.playerName
      }));

      // Pad with default pro teams if not enough registered
      const finalTeams: Team[] = [...inputTeams];
      let seedIndex = 0;
      while (finalTeams.length < teamCount) {
        const dummyName = DEFAULT_PRO_TEAMS[seedIndex % DEFAULT_PRO_TEAMS.length] + ` [SEED ${finalTeams.length + 1}]`;
        finalTeams.push({
          id: `virtual-seed-${finalTeams.length + 1}`,
          name: dummyName
        });
        seedIndex++;
      }

      // Slice to match exactly the selected size
      const teams = finalTeams.slice(0, teamCount);

      // Shuffle teams for seed randomness
      for (let i = teams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teams[i], teams[j]] = [teams[j], teams[i]];
      }

      const batch = writeBatch(db);
      const newMatches: BracketMatch[] = [];

      if (bracketType === 'single') {
        // Generate Single Elimination Matches
        // For 8 teams: R1 (4 matches), R2 (2 matches), R3 (1 match - Final)
        const rounds = Math.log2(teamCount); // e.g. 3 rounds for 8 teams
        
        let currentRoundMatches: BracketMatch[] = [];
        
        // Round 1
        const numR1Matches = teamCount / 2;
        for (let m = 0; m < numR1Matches; m++) {
          const matchId = `S-R1M${m + 1}`;
          const nextMatchId = rounds > 1 ? `S-R2M${Math.floor(m / 2) + 1}` : undefined;
          const nextMatchSlot = m % 2 === 0 ? 'team1' : 'team2';
          
          const match: BracketMatch = {
            id: matchId,
            round: 1,
            type: 'upper',
            team1: teams[m * 2],
            team2: teams[m * 2 + 1],
            nextMatchId,
            nextMatchSlot,
            status: 'scheduled',
            map: 'Haven'
          };
          newMatches.push(match);
        }

        // Round 2 to Final
        let matchMultiplier = numR1Matches / 2;
        for (let r = 2; r <= rounds; r++) {
          for (let m = 0; m < matchMultiplier; m++) {
            const matchId = `S-R${r}M${m + 1}`;
            const nextMatchId = r < rounds ? `S-R${r + 1}M${Math.floor(m / 2) + 1}` : undefined;
            const nextMatchSlot = m % 2 === 0 ? 'team1' : 'team2';

            const match: BracketMatch = {
              id: matchId,
              round: r,
              type: r === rounds ? 'grand_final' : 'upper',
              team1: { id: 'TBD', name: `Winner Round ${r-1} Match ${m * 2 + 1}` },
              team2: { id: 'TBD', name: `Winner Round ${r-1} Match ${m * 2 + 2}` },
              nextMatchId,
              nextMatchSlot,
              status: 'scheduled',
              map: 'Split'
            };
            newMatches.push(match);
          }
          matchMultiplier /= 2;
        }

      } else {
        // Double Elimination (Supports 4 or 8 teams for clean layout)
        // Let's implement 8-team Double Elimination
        // Upper Round 1 (4 matches) -> U-R1M1 to U-R1M4
        // Upper Round 2 (2 matches) -> U-R2M1, U-R2M2
        // Upper Round 3 / Upper Final (1 match) -> U-R3M1
        // Lower Round 1 (2 matches) -> L-R1M1, L-R1M2 (Losers of Upper R1 face off)
        // Lower Round 2 (2 matches) -> L-R2M1, L-R2M2 (Winners of Lower R1 face Losers of Upper R2)
        // Lower Round 3 (1 match) -> L-R3M1
        // Lower Round 4 (1 match) -> L-R4M1 (Winner of L-R3 faces Loser of Upper R3)
        // Grand Final (1 or 2 matches) -> GF1
        
        if (teamCount === 4) {
          // 4-Team Double-Elimination
          // Upper Bracket
          newMatches.push({
            id: 'U-R1M1', round: 1, type: 'upper',
            team1: teams[0], team2: teams[1],
            nextMatchId: 'U-R2M1', nextMatchSlot: 'team1',
            loserMatchId: 'L-R1M1', loserMatchSlot: 'team1',
            status: 'scheduled', map: 'Haven'
          });
          newMatches.push({
            id: 'U-R1M2', round: 1, type: 'upper',
            team1: teams[2], team2: teams[3],
            nextMatchId: 'U-R2M1', nextMatchSlot: 'team2',
            loserMatchId: 'L-R1M1', loserMatchSlot: 'team2',
            status: 'scheduled', map: 'Bind'
          });
          // Upper Final
          newMatches.push({
            id: 'U-R2M1', round: 2, type: 'upper',
            team1: { id: 'TBD', name: 'Winner U-R1M1' }, team2: { id: 'TBD', name: 'Winner U-R1M2' },
            nextMatchId: 'GF', nextMatchSlot: 'team1',
            loserMatchId: 'L-R2M1', loserMatchSlot: 'team1',
            status: 'scheduled', map: 'Ascent'
          });
          // Lower Semi-Final / Losers Round 1
          newMatches.push({
            id: 'L-R1M1', round: 1, type: 'lower',
            team1: { id: 'TBD', name: 'Loser U-R1M1' }, team2: { id: 'TBD', name: 'Loser U-R1M2' },
            nextMatchId: 'L-R2M1', nextMatchSlot: 'team2',
            status: 'scheduled', map: 'Sunset'
          });
          // Lower Final
          newMatches.push({
            id: 'L-R2M1', round: 2, type: 'lower',
            team1: { id: 'TBD', name: 'Loser U-R2M1' }, team2: { id: 'TBD', name: 'Winner L-R1M1' },
            nextMatchId: 'GF', nextMatchSlot: 'team2',
            status: 'scheduled', map: 'Split'
          });
          // Grand Final
          newMatches.push({
            id: 'GF', round: 3, type: 'grand_final',
            team1: { id: 'TBD', name: 'Winner Upper Bracket' }, team2: { id: 'TBD', name: 'Winner Lower Bracket' },
            status: 'scheduled', map: 'Lotus'
          });
        } else {
          // 8-Team Double-Elimination (Standard)
          // Upper Round 1
          newMatches.push({
            id: 'U-R1M1', round: 1, type: 'upper',
            team1: teams[0], team2: teams[1],
            nextMatchId: 'U-R2M1', nextMatchSlot: 'team1',
            loserMatchId: 'L-R1M1', loserMatchSlot: 'team1',
            status: 'scheduled', map: 'Haven'
          });
          newMatches.push({
            id: 'U-R1M2', round: 1, type: 'upper',
            team1: teams[2], team2: teams[3],
            nextMatchId: 'U-R2M1', nextMatchSlot: 'team2',
            loserMatchId: 'L-R1M1', loserMatchSlot: 'team2',
            status: 'scheduled', map: 'Bind'
          });
          newMatches.push({
            id: 'U-R1M3', round: 1, type: 'upper',
            team1: teams[4], team2: teams[5],
            nextMatchId: 'U-R2M2', nextMatchSlot: 'team1',
            loserMatchId: 'L-R1M2', loserMatchSlot: 'team1',
            status: 'scheduled', map: 'Ascent'
          });
          newMatches.push({
            id: 'U-R1M4', round: 1, type: 'upper',
            team1: teams[6], team2: teams[7],
            nextMatchId: 'U-R2M2', nextMatchSlot: 'team2',
            loserMatchId: 'L-R1M2', loserMatchSlot: 'team2',
            status: 'scheduled', map: 'Lotus'
          });

          // Upper Round 2 (Semi-Finals)
          newMatches.push({
            id: 'U-R2M1', round: 2, type: 'upper',
            team1: { id: 'TBD', name: 'Winner U-R1M1' }, team2: { id: 'TBD', name: 'Winner U-R1M2' },
            nextMatchId: 'U-R3M1', nextMatchSlot: 'team1',
            loserMatchId: 'L-R2M1', loserMatchSlot: 'team2', // drops down to face L-R1 Winner
            status: 'scheduled', map: 'Sunset'
          });
          newMatches.push({
            id: 'U-R2M2', round: 2, type: 'upper',
            team1: { id: 'TBD', name: 'Winner U-R1M3' }, team2: { id: 'TBD', name: 'Winner U-R1M4' },
            nextMatchId: 'U-R3M1', nextMatchSlot: 'team2',
            loserMatchId: 'L-R2M2', loserMatchSlot: 'team2', // drops down
            status: 'scheduled', map: 'Breeze'
          });

          // Upper Round 3 (Upper Final)
          newMatches.push({
            id: 'U-R3M1', round: 3, type: 'upper',
            team1: { id: 'TBD', name: 'Winner U-R2M1' }, team2: { id: 'TBD', name: 'Winner U-R2M2' },
            nextMatchId: 'GF', nextMatchSlot: 'team1',
            loserMatchId: 'L-R4M1', loserMatchSlot: 'team1', // drops to lower final
            status: 'scheduled', map: 'Split'
          });

          // Lower Round 1
          newMatches.push({
            id: 'L-R1M1', round: 1, type: 'lower',
            team1: { id: 'TBD', name: 'Loser U-R1M1' }, team2: { id: 'TBD', name: 'Loser U-R1M2' },
            nextMatchId: 'L-R2M1', nextMatchSlot: 'team1',
            status: 'scheduled', map: 'Sunset'
          });
          newMatches.push({
            id: 'L-R1M2', round: 1, type: 'lower',
            team1: { id: 'TBD', name: 'Loser U-R1M3' }, team2: { id: 'TBD', name: 'Loser U-R1M4' },
            nextMatchId: 'L-R2M2', nextMatchSlot: 'team1',
            status: 'scheduled', map: 'Haven'
          });

          // Lower Round 2
          newMatches.push({
            id: 'L-R2M1', round: 2, type: 'lower',
            team1: { id: 'TBD', name: 'Winner L-R1M1' }, team2: { id: 'TBD', name: 'Loser U-R2M1' },
            nextMatchId: 'L-R3M1', nextMatchSlot: 'team1',
            status: 'scheduled', map: 'Fracture'
          });
          newMatches.push({
            id: 'L-R2M2', round: 2, type: 'lower',
            team1: { id: 'TBD', name: 'Winner L-R1M2' }, team2: { id: 'TBD', name: 'Loser U-R2M2' },
            nextMatchId: 'L-R3M1', nextMatchSlot: 'team2',
            status: 'scheduled', map: 'Bind'
          });

          // Lower Round 3 (Lower Quarterfinal)
          newMatches.push({
            id: 'L-R3M1', round: 3, type: 'lower',
            team1: { id: 'TBD', name: 'Winner L-R2M1' }, team2: { id: 'TBD', name: 'Winner L-R2M2' },
            nextMatchId: 'L-R4M1', nextMatchSlot: 'team2',
            status: 'scheduled', map: 'Ascent'
          });

          // Lower Round 4 (Lower Final)
          newMatches.push({
            id: 'L-R4M1', round: 4, type: 'lower',
            team1: { id: 'TBD', name: 'Loser U-R3M1' }, team2: { id: 'TBD', name: 'Winner L-R3M1' },
            nextMatchId: 'GF', nextMatchSlot: 'team2',
            status: 'scheduled', map: 'Lotus'
          });

          // Grand Final
          newMatches.push({
            id: 'GF', round: 5, type: 'grand_final',
            team1: { id: 'TBD', name: 'Winner Upper Bracket' }, team2: { id: 'TBD', name: 'Winner Lower Bracket' },
            status: 'scheduled', map: 'Haven'
          });
        }
      }

      // Write all matches to Firestore
      for (const match of newMatches) {
        const matchRef = doc(db, 'tournaments', tournamentId, 'matches', match.id);
        batch.set(matchRef, match);
      }
      await batch.commit();

      onToast('Success', `${bracketType === 'single' ? 'Single' : 'Double'}-elimination bracket generated successfully!`);
    } catch (err: any) {
      console.error(err);
      onToast('Error', 'Failed to generate bracket: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Select a match to edit score
  const handleOpenEdit = (match: BracketMatch) => {
    if (!canEdit) {
      onToast('Unauthorized', 'You must be logged in as an administrator to update scores.');
      return;
    }
    // Cannot edit match with unresolved teams
    if (match.team1.id === 'TBD' || match.team2.id === 'TBD') {
      onToast('Prerequisite Missing', 'Teams for this match must be determined first.');
      return;
    }
    setSelectedMatch(match);
    setScore1(match.team1.score || 0);
    setScore2(match.team2.score || 0);
    setMatchMap(match.map || 'Haven');
  };

  // Submit the scores and advance the winners
  const handleSaveMatch = async () => {
    if (!selectedMatch) return;
    setIsUpdating(true);

    try {
      const winner = score1 > score2 ? selectedMatch.team1 : selectedMatch.team2;
      const loser = score1 > score2 ? selectedMatch.team2 : selectedMatch.team1;

      // Create a batch to atomic update multiple match structures
      const batch = writeBatch(db);

      // 1. Update active match
      const activeMatchRef = doc(db, 'tournaments', tournamentId, 'matches', selectedMatch.id);
      const updatedActiveMatch = {
        ...selectedMatch,
        team1: { ...selectedMatch.team1, score: score1 },
        team2: { ...selectedMatch.team2, score: score2 },
        winnerId: winner.id,
        status: 'completed' as const,
        map: matchMap
      };
      batch.set(activeMatchRef, updatedActiveMatch);

      // 2. Advance winner in nextMatchId
      if (selectedMatch.nextMatchId) {
        const nextMatch = matches.find(m => m.id === selectedMatch.nextMatchId);
        if (nextMatch) {
          const nextMatchRef = doc(db, 'tournaments', tournamentId, 'matches', selectedMatch.nextMatchId);
          
          const teamUpdate = selectedMatch.nextMatchSlot === 'team1' 
            ? { team1: { id: winner.id, name: winner.name } }
            : { team2: { id: winner.id, name: winner.name } };

          batch.update(nextMatchRef, teamUpdate);
        }
      }

      // 3. Move loser to loserMatchId (for Double Elimination upper bracket drop)
      if (selectedMatch.loserMatchId) {
        const loserMatch = matches.find(m => m.id === selectedMatch.loserMatchId);
        if (loserMatch) {
          const loserMatchRef = doc(db, 'tournaments', tournamentId, 'matches', selectedMatch.loserMatchId);

          const loserTeamUpdate = selectedMatch.loserMatchSlot === 'team1'
            ? { team1: { id: loser.id, name: loser.name } }
            : { team2: { id: loser.id, name: loser.name } };

          batch.update(loserMatchRef, loserTeamUpdate);
        }
      }

      await batch.commit();
      onToast('Match Finalized', `${winner.name} won and advanced!`);
      setSelectedMatch(null);
    } catch (err: any) {
      console.error(err);
      onToast('Update Failed', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetLive = async (match: BracketMatch) => {
    try {
      const matchRef = doc(db, 'tournaments', tournamentId, 'matches', match.id);
      await updateDoc(matchRef, { status: 'live' });
      onToast('Status Update', `${match.team1.name} vs ${match.team2.name} is now LIVE!`);
    } catch (err: any) {
      onToast('Error', err.message);
    }
  };

  const resetBracket = async () => {
    if (!window.confirm("Are you sure you want to completely clear and reset the matches? This cannot be undone.")) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      for (const m of matches) {
        const ref = doc(db, 'tournaments', tournamentId, 'matches', m.id);
        batch.delete(ref);
      }
      await batch.commit();
      setMatches([]);
      onToast('Success', 'Bracket has been reset.');
    } catch (err: any) {
      onToast('Reset Failed', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to render matches in a specific column round
  const renderBracketRound = (title: string, roundMatches: BracketMatch[]) => {
    return (
      <div className="flex-1 min-w-[280px] space-y-12">
        <div className="border-b border-gold/10 pb-2 mb-6">
          <h4 className="font-bebas text-lg text-gold tracking-widest text-center">{title}</h4>
          <p className="text-[10px] text-neutral-500 text-center uppercase tracking-wider">{roundMatches.length} Matches</p>
        </div>
        <div className="space-y-8 relative">
          {roundMatches.map((match) => {
            const isWinner1 = match.status === 'completed' && match.winnerId === match.team1.id;
            const isWinner2 = match.status === 'completed' && match.winnerId === match.team2.id;
            const isInteractive = canEdit && match.team1.id !== 'TBD' && match.team2.id !== 'TBD';

            return (
              <motion.div 
                key={match.id}
                layoutId={`match-card-${match.id}`}
                onClick={() => handleOpenEdit(match)}
                className={`relative bg-neutral-950 border ${
                  match.status === 'live' 
                    ? 'border-neon-red/50 shadow-[0_0_15px_rgba(255,34,68,0.15)] animate-pulse' 
                    : isInteractive 
                      ? 'border-gold/20 hover:border-gold/60 cursor-pointer' 
                      : 'border-white/5'
                } p-4 rounded-sm transition-all duration-300 group`}
              >
                {/* Match Info Header */}
                <div className="flex justify-between items-center text-[9px] text-neutral-500 font-mono mb-2 uppercase border-b border-white/5 pb-1">
                  <span>ID: {match.id}</span>
                  <span>{match.map || 'Haven'}</span>
                  {match.status === 'live' && (
                    <span className="flex items-center gap-1 text-neon-red font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-red animate-ping" /> LIVE
                    </span>
                  )}
                  {match.status === 'completed' && (
                    <span className="text-green-400 font-bold">COMPLETED</span>
                  )}
                </div>

                {/* Team 1 Row */}
                <div className={`flex justify-between items-center py-1.5 ${isWinner1 ? 'text-white' : 'text-neutral-500'}`}>
                  <span className={`text-xs font-medium tracking-wide truncate max-w-[180px] ${match.team1.id === 'TBD' ? 'italic text-neutral-600' : ''}`}>
                    {match.team1.name}
                  </span>
                  <span className={`font-mono text-sm font-bold ${isWinner1 ? 'text-gold' : 'text-neutral-600'}`}>
                    {match.status === 'completed' ? match.team1.score : '-'}
                  </span>
                </div>

                {/* Team 2 Row */}
                <div className={`flex justify-between items-center py-1.5 ${isWinner2 ? 'text-white' : 'text-neutral-500'}`}>
                  <span className={`text-xs font-medium tracking-wide truncate max-w-[180px] ${match.team2.id === 'TBD' ? 'italic text-neutral-600' : ''}`}>
                    {match.team2.name}
                  </span>
                  <span className={`font-mono text-sm font-bold ${isWinner2 ? 'text-gold' : 'text-neutral-600'}`}>
                    {match.status === 'completed' ? match.team2.score : '-'}
                  </span>
                </div>

                {/* Quick actions for Admins on Hover */}
                {isInteractive && match.status !== 'completed' && (
                  <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-all duration-200 rounded-sm">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(match);
                      }}
                      className="bg-gold hover:bg-gold-light text-black text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm flex items-center gap-1"
                    >
                      <Edit3 size={12} /> Enter Score
                    </button>
                    {match.status !== 'live' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetLive(match);
                        }}
                        className="bg-neon-red/10 border border-neon-red/30 hover:bg-neon-red hover:text-white text-neon-red text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm"
                      >
                        Go Live
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const getUpperMatches = () => matches.filter(m => m.type === 'upper');
  const getLowerMatches = () => matches.filter(m => m.type === 'lower');
  const getGFMatches = () => matches.filter(m => m.type === 'grand_final');

  return (
    <div className="space-y-12">
      {/* Configuration & Controls Panel */}
      <div className="bg-neutral-900 border border-white/5 p-6 rounded-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="font-bebas text-2xl text-white tracking-widest flex items-center gap-2 uppercase">
              <Trophy className="text-gold" size={20} /> Tactical Match Bracket
            </h3>
            <p className="text-xs text-neutral-400 font-sans">
              Dynamic single and double elimination charts synced live from Firebase Firestore.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Simulated Administrator Override */}
            <label className="flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-2 rounded-sm cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={adminOverride} 
                onChange={(e) => setAdminOverride(e.target.checked)}
                className="rounded border-white/10 text-gold focus:ring-0 focus:ring-offset-0 bg-transparent"
              />
              <span className="text-[10px] font-bold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-1">
                <Settings size={12} className={adminOverride ? "text-gold animate-spin" : "text-neutral-500"} /> Admin Bypass
              </span>
            </label>

            {matches.length > 0 && (
              <button 
                onClick={resetBracket}
                disabled={!canEdit || isUpdating}
                className="border border-white/5 bg-black/20 hover:bg-red-500/10 hover:border-red-500/20 text-neutral-400 hover:text-red-400 px-3 py-2 text-xs uppercase font-bold tracking-wider rounded-sm flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <RefreshCw size={12} className={isUpdating ? "animate-spin" : ""} /> Wipe Bracket
              </button>
            )}
          </div>
        </div>

        {/* Generate Section if No Matches Exist */}
        {matches.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 border border-dashed border-white/10 rounded-sm p-8 text-center bg-black/20 space-y-6"
          >
            <div className="max-w-md mx-auto space-y-2">
              <Users className="text-gold/40 mx-auto" size={40} />
              <h4 className="font-bebas text-xl text-white tracking-widest uppercase">No Bracket Provisioned</h4>
              <p className="text-xs text-neutral-500 font-sans leading-relaxed">
                Organize the enlisted squads into an automated bracket. If fewer than selected teams are registered, the system fills vacant spots with elite simulated seed rosters.
              </p>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-6 max-w-2xl mx-auto pt-4 border-t border-white/5">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Elimination Protocol</label>
                <div className="flex bg-neutral-950 p-1 border border-white/5 rounded-sm">
                  <button 
                    onClick={() => setBracketType('single')}
                    className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm ${bracketType === 'single' ? 'bg-gold text-black' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Single-Elim
                  </button>
                  <button 
                    onClick={() => setBracketType('double')}
                    className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm ${bracketType === 'double' ? 'bg-gold text-black' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Double-Elim
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Squad Scale</label>
                <div className="flex bg-neutral-950 p-1 border border-white/5 rounded-sm">
                  {bracketType === 'single' ? (
                    ([4, 8, 16] as const).map(num => (
                      <button 
                        key={num}
                        onClick={() => setTeamCount(num)}
                        className={`px-3 py-1.5 text-xs font-mono font-bold rounded-sm ${teamCount === num ? 'bg-gold text-black' : 'text-neutral-400 hover:text-white'}`}
                      >
                        {num} T
                      </button>
                    ))
                  ) : (
                    ([4, 8] as const).map(num => (
                      <button 
                        key={num}
                        onClick={() => setTeamCount(num)}
                        className={`px-3 py-1.5 text-xs font-mono font-bold rounded-sm ${teamCount === num ? 'bg-gold text-black' : 'text-neutral-400 hover:text-white'}`}
                      >
                        {num} T
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 md:pt-0">
                <button
                  onClick={handleGenerateBracket}
                  disabled={!canEdit || isUpdating}
                  className="bg-gold hover:bg-gold-light text-black px-6 py-3 font-black text-xs uppercase tracking-widest rounded-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,175,55,0.15)] disabled:opacity-50"
                >
                  <TrendingUp size={14} /> Initialize Tournament Bracket
                </button>
              </div>
            </div>

            {!canEdit && (
              <p className="text-[10px] text-red-400 font-mono uppercase tracking-widest">
                ⚠ Administrator login or Bypass override required to initialize the bracket.
              </p>
            )}
          </motion.div>
        )}
      </div>

      {loading && matches.length > 0 ? (
        <div className="text-center py-20 text-gold font-mono uppercase tracking-widest animate-pulse">
          Syncing Bracket Logistics...
        </div>
      ) : matches.length > 0 && (
        <div className="space-y-16">
          {/* Upper Bracket Display */}
          <div className="space-y-6">
            <h4 className="font-bebas text-2xl text-white tracking-widest border-b border-white/5 pb-2 uppercase">
              {bracketType === 'double' ? 'Upper Bracket (Winner List)' : 'Tournament Tree'}
            </h4>
            <div className="flex overflow-x-auto pb-6 gap-8 no-scrollbar scroll-smooth">
              {bracketType === 'single' ? (
                // Single Elimination rounds
                Array.from({ length: Math.log2(teamCount) }).map((_, rIdx) => {
                  const roundNum = rIdx + 1;
                  const roundMatches = matches.filter(m => m.round === roundNum);
                  const roundTitle = roundNum === Math.log2(teamCount) ? 'Grand Finals' : roundNum === Math.log2(teamCount) - 1 ? 'Semifinals' : `Quarterfinals (R${roundNum})`;
                  return (
                    <React.Fragment key={roundNum}>
                      {renderBracketRound(roundTitle, roundMatches)}
                    </React.Fragment>
                  );
                })
              ) : (
                // Double Elimination upper rounds
                <>
                  {renderBracketRound('Upper Round 1', getUpperMatches().filter(m => m.round === 1))}
                  {renderBracketRound('Upper Semifinals', getUpperMatches().filter(m => m.round === 2))}
                  {teamCount === 8 && renderBracketRound('Upper Finals', getUpperMatches().filter(m => m.round === 3))}
                </>
              )}
            </div>
          </div>

          {/* Lower Bracket Display (Double Elimination only) */}
          {bracketType === 'double' && (
            <div className="space-y-6 pt-8 border-t border-white/5">
              <h4 className="font-bebas text-2xl text-neon-red tracking-widest border-b border-neon-red/10 pb-2 uppercase">
                Lower Bracket (Redemption Protocol)
              </h4>
              <div className="flex overflow-x-auto pb-6 gap-8 no-scrollbar scroll-smooth">
                {renderBracketRound('Lower Round 1', getLowerMatches().filter(m => m.round === 1))}
                {renderBracketRound('Lower Round 2', getLowerMatches().filter(m => m.round === 2))}
                {teamCount === 8 && (
                  <>
                    {renderBracketRound('Lower Semifinals', getLowerMatches().filter(m => m.round === 3))}
                    {renderBracketRound('Lower Finals', getLowerMatches().filter(m => m.round === 4))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Grand Finals (Double Elimination only) */}
          {bracketType === 'double' && (
            <div className="space-y-6 pt-8 border-t border-white/5 max-w-md mx-auto">
              <h4 className="font-bebas text-2xl text-gold tracking-widest border-b border-gold/10 pb-2 text-center uppercase">
                Grand Championship
              </h4>
              <div className="flex justify-center">
                {renderBracketRound('Grand Final Block', getGFMatches())}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Score Input Dialog Modal */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMatch(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-neutral-900 border border-gold/20 p-6 rounded-sm space-y-6 z-10"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <span className="text-[9px] font-bold text-gold font-mono uppercase tracking-widest block">Operational Update</span>
                  <h4 className="font-bebas text-xl text-white tracking-widest uppercase">Input Match scores</h4>
                </div>
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="text-neutral-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Team 1 Score Input */}
                <div className="bg-black/30 border border-white/5 p-4 rounded-sm flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-white truncate max-w-[180px]">{selectedMatch.team1.name}</span>
                  <input 
                    type="number"
                    value={score1}
                    min={0}
                    onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                    className="w-16 bg-neutral-950 border border-white/10 text-center font-mono font-bold text-lg text-gold rounded-sm py-1 focus:outline-none focus:border-gold/40"
                  />
                </div>

                {/* Team 2 Score Input */}
                <div className="bg-black/30 border border-white/5 p-4 rounded-sm flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-white truncate max-w-[180px]">{selectedMatch.team2.name}</span>
                  <input 
                    type="number"
                    value={score2}
                    min={0}
                    onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                    className="w-16 bg-neutral-950 border border-white/10 text-center font-mono font-bold text-lg text-gold rounded-sm py-1 focus:outline-none focus:border-gold/40"
                  />
                </div>

                {/* Tactical map choice */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Tactical Arena (Map)</label>
                  <select 
                    value={matchMap}
                    onChange={(e) => setMatchMap(e.target.value)}
                    className="w-full bg-neutral-950 border border-white/10 text-neutral-300 py-2 px-3 text-xs uppercase font-bold tracking-wider rounded-sm focus:outline-none focus:border-gold/40"
                  >
                    {['Haven', 'Bind', 'Ascent', 'Lotus', 'Sunset', 'Breeze', 'Split', 'Fracture', 'Pearl'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warning/Notes */}
              <div className="flex gap-2 items-start text-[10px] text-neutral-500 bg-black/45 p-3 border border-white/5 rounded-sm">
                <AlertCircle className="shrink-0 text-gold mt-0.5" size={12} />
                <p className="leading-relaxed font-sans">
                  Advancing a winner moves the team immediately to the next node in the live tournament brackets. Retries can be run by re-editing this match score if needed.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMatch(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 py-3 text-xs uppercase font-bold tracking-widest rounded-sm border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatch}
                  disabled={score1 === score2 || isUpdating}
                  className="flex-1 bg-gold hover:bg-gold-light text-black py-3 text-xs uppercase font-black tracking-widest rounded-sm transition-all shadow-[0_0_15px_rgba(212,175,55,0.15)] disabled:opacity-40"
                >
                  {isUpdating ? 'Saving...' : 'Save & Advance'}
                </button>
              </div>
              {score1 === score2 && (
                <p className="text-[9px] text-red-400 text-center uppercase tracking-wider font-mono">
                  ⚠ Match scores cannot end in a draw. Select a winner.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
