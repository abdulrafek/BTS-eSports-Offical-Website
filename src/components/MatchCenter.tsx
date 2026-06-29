import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Tv, 
  MessageSquare, 
  Users, 
  Clock, 
  Radio, 
  Maximize2, 
  Minimize2, 
  Send, 
  Flame, 
  Award, 
  Zap,
  TrendingUp,
  Gamepad2
} from 'lucide-react';

interface MockMatch {
  id: string;
  game: string;
  team1: string;
  team1Logo: string;
  team2: string;
  team2Logo: string;
  score1: number;
  score2: number;
  status: 'live' | 'upcoming' | 'completed';
  map: string;
  streamUrl: string;
  viewerCount: number;
  timeRemaining?: string;
  roundName: string;
}

interface ChatMessage {
  id: string;
  user: string;
  badge?: 'mod' | 'sub' | 'staff' | 'vip';
  badgeColor?: string;
  text: string;
  timestamp: string;
}

const MOCK_MATCHES: MockMatch[] = [
  {
    id: 'm1',
    game: 'VALORANT',
    team1: 'Sentinels',
    team1Logo: '🔴',
    team2: 'Fnatic',
    team2Logo: '🟠',
    score1: 11,
    score2: 9,
    status: 'live',
    map: 'Ascent',
    streamUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1',
    viewerCount: 42800,
    roundName: 'Upper Bracket Final'
  },
  {
    id: 'm2',
    game: 'BGMI',
    team1: 'GodLike Esports',
    team1Logo: '🔵',
    team2: 'Team Soul',
    team2Logo: '🟢',
    score1: 45,
    score2: 41,
    status: 'live',
    map: 'Erangel - Match 4',
    streamUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1',
    viewerCount: 125000,
    roundName: 'Grand Finals - Day 2'
  },
  {
    id: 'm3',
    game: 'VALORANT',
    team1: 'Paper Rex',
    team1Logo: '🟣',
    team2: 'LOUD',
    team2Logo: '🟢',
    score1: 0,
    score2: 0,
    status: 'upcoming',
    map: 'Haven',
    streamUrl: '',
    viewerCount: 0,
    timeRemaining: '00:45:15',
    roundName: 'Lower Semifinals'
  },
  {
    id: 'm4',
    game: 'VALORANT',
    team1: 'Natus Vincere',
    team1Logo: '🟡',
    team2: 'G2 Esports',
    team2Logo: '⚪',
    score1: 2,
    score2: 0,
    status: 'completed',
    map: 'Sunset & Bind',
    streamUrl: '',
    viewerCount: 0,
    roundName: 'Lower Bracket Round 2'
  }
];

const AnimatedScore = ({ score, colorClass }: { score: number, colorClass: string }) => {
  return (
    <div className="relative inline-flex items-center justify-center overflow-hidden min-w-[36px] h-9">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={score}
          initial={{ opacity: 0, y: -15, scale: 0.6, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 15, scale: 0.6, filter: 'blur(2px)' }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 15 
          }}
          className={`text-2xl font-black ${colorClass} inline-block select-none`}
        >
          {score}
        </motion.span>
      </AnimatePresence>
      
      {/* Dynamic light ripple background flash effect on score change */}
      <AnimatePresence>
        <motion.span
          key={`ripple-${score}`}
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0 rounded-full bg-white/20 pointer-events-none"
        />
      </AnimatePresence>
    </div>
  );
};

const ListScore = ({ score, colorClass }: { score: number | string, colorClass: string }) => {
  return (
    <div className="relative inline-flex items-center justify-center min-w-[20px] h-5">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={score}
          initial={{ opacity: 0, scale: 0.5, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 5 }}
          transition={{ duration: 0.2 }}
          className={`font-mono text-xs font-bold ${colorClass} inline-block`}
        >
          {score}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

const CHAT_USERS = [
  { name: 'NinjaOperative', badge: 'sub', badgeColor: 'text-gold' },
  { name: 'X_Tactician_X', badge: 'vip', badgeColor: 'text-cyan-400' },
  { name: 'ValorantNoob', badge: 'sub', badgeColor: 'text-gold' },
  { name: 'StreamSniper99', badge: undefined, badgeColor: '' },
  { name: 'eSportsMaster', badge: 'mod', badgeColor: 'text-green-400' },
  { name: 'Slayer_King', badge: undefined, badgeColor: '' },
  { name: 'Valkyrie_Lover', badge: 'vip', badgeColor: 'text-cyan-400' },
  { name: 'ErangelGlitcher', badge: 'sub', badgeColor: 'text-gold' },
  { name: 'T1_Fanboy', badge: undefined, badgeColor: '' }
];

const CHAT_PHRASES = [
  "OH MY GOD WHAT A PLAY!!! 😱🔥",
  "Is that legal??? Let's goooo! 🚀",
  "POGGERS! The clutch of the season!",
  "LUL team 1 is throwing so hard right now",
  "BTS eSports is literally the best tournament organizer 🙌",
  "Sentinels take my energy ༼ つ ◕_◕ ༽つ",
  "GG WP!! Unreal skill",
  "Who is the MVP? Gotta be the Jett!",
  "Calculated. 🤓",
  "BGMI Lobby is stacked tonight, can't wait for match 5",
  "Unbelievable headshot across Ascent mid!",
  "Spam 🟢 for GodLike or 🔴 for Team Soul",
  "Lobby credentials when?",
  "This live feed is butter smooth, loving the UX!"
];

export const MatchCenter: React.FC<{ onToast: (t: string, m: string) => void }> = ({ onToast }) => {
  const [activeMatch, setActiveMatch] = useState<MockMatch>(MOCK_MATCHES[0]);
  const [liveMatches, setLiveMatches] = useState<MockMatch[]>(MOCK_MATCHES);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [quality, setQuality] = useState('1080p60');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userMsg, setUserMsg] = useState('');
  const [countdown, setCountdown] = useState({ hr: 0, min: 45, sec: 15 });
  
  // Stream game events ticker
  const [tickerMessage, setTickerMessage] = useState<string>('Warmup round in progress. Match starts shortly!');
  const [tickerSub, setTickerSub] = useState<string>('BTS ESPORTS LIVE PROTOCOL');
  const [tickerBadge, setTickerBadge] = useState<string>('PRE-START');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.sec > 0) {
          return { ...prev, sec: prev.sec - 1 };
        } else if (prev.min > 0) {
          return { ...prev, min: prev.min - 1, sec: 59 };
        } else if (prev.hr > 0) {
          return { hr: prev.hr - 1, min: 59, sec: 59 };
        } else {
          return { hr: 0, min: 45, sec: 15 }; // loop
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize mock Twitch Chat stream
  useEffect(() => {
    // Fill initial chat
    const initialMsgs: ChatMessage[] = Array.from({ length: 15 }).map((_, i) => {
      const user = CHAT_USERS[Math.floor(Math.random() * CHAT_USERS.length)];
      return {
        id: `chat-${Date.now()}-${i}`,
        user: user.name,
        badge: user.badge as any,
        badgeColor: user.badgeColor,
        text: CHAT_PHRASES[Math.floor(Math.random() * CHAT_PHRASES.length)],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    });
    setChatMessages(initialMsgs);

    // Chat dynamic additions
    const interval = setInterval(() => {
      const user = CHAT_USERS[Math.floor(Math.random() * CHAT_USERS.length)];
      const newMsg: ChatMessage = {
        id: `chat-${Date.now()}-${Math.random()}`,
        user: user.name,
        badge: user.badge as any,
        badgeColor: user.badgeColor,
        text: CHAT_PHRASES[Math.floor(Math.random() * CHAT_PHRASES.length)],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setChatMessages(prev => [...prev.slice(-30), newMsg]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Sync scroll on chat addition
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle active stream scores drift/simulation
  useEffect(() => {
    const gameSimulation = setInterval(() => {
      // Pick random live match and increase score slightly
      setLiveMatches(prev => prev.map(m => {
        if (m.status === 'live') {
          const increaseTeam = Math.random() > 0.5 ? 1 : 2;
          const mapLimit = m.game === 'VALORANT' ? 13 : 100;
          
          let newScore1 = m.score1;
          let newScore2 = m.score2;

          if (increaseTeam === 1 && m.score1 < mapLimit) {
            newScore1 += m.game === 'BGMI' ? Math.floor(Math.random() * 4) + 1 : 1;
            // Trigger stream event overlay if active match
            if (m.id === activeMatch.id) {
              triggerStreamEvent(m.team1, m.game);
            }
          } else if (increaseTeam === 2 && m.score2 < mapLimit) {
            newScore2 += m.game === 'BGMI' ? Math.floor(Math.random() * 4) + 1 : 1;
            if (m.id === activeMatch.id) {
              triggerStreamEvent(m.team2, m.game);
            }
          }

          return { ...m, score1: newScore1, score2: newScore2 };
        }
        return m;
      }));
    }, 12000);

    return () => clearInterval(gameSimulation);
  }, [activeMatch.id]);

  const triggerStreamEvent = (team: string, game: string) => {
    const events = game === 'VALORANT' ? [
      { badge: 'ACE!', sub: `${team} MVP is absolutely pop-off!`, msg: `${team} wipes opposition squad!` },
      { badge: 'TACTICAL', sub: 'CLUTCH DEFUSE SECURED', msg: `${team} completes 1v3 site retake` },
      { badge: 'ROUND WIN', sub: 'FLAWLESS EXECUTION', msg: `${team} secures tactical thrifty round` }
    ] : [
      { badge: 'SQUAD WIPE', sub: 'MILITARY ACCELERATOR', msg: `${team} dominates bridge ambush` },
      { badge: 'AIR DROP', sub: 'SUPPLY CHRONOLOGY', msg: `${team} secures premium level-3 tactical loot` },
      { badge: 'VEHICLE CLUTCH', sub: 'SPEED RUN DEPLOYMENT', msg: `${team} rotates inside safe zone` }
    ];

    const pick = events[Math.floor(Math.random() * events.length)];
    setTickerBadge(pick.badge);
    setTickerSub(pick.sub);
    setTickerMessage(pick.msg);

    // Make mock chat react immediately!
    const reactiveUser = CHAT_USERS[Math.floor(Math.random() * CHAT_USERS.length)];
    const reacts = [
      `WTF! ${team} is playing out of their mind! 🤯`,
      `LETS GOOO ${team}!`,
      `POG!!! What a play!`,
      `EZ for ${team}!`,
      `omg did you see that defuse??`
    ];
    
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: `chat-react-${Date.now()}-${Math.random()}`,
          user: reactiveUser.name,
          badge: 'sub',
          badgeColor: 'text-gold',
          text: reacts[Math.floor(Math.random() * reacts.length)],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      ]);
    }, 800);
  };

  // Sync active match score when list updates
  useEffect(() => {
    const currentFromList = liveMatches.find(m => m.id === activeMatch.id);
    if (currentFromList) {
      setActiveMatch(currentFromList);
    }
  }, [liveMatches]);

  const selectMatch = (match: MockMatch) => {
    if (match.status === 'upcoming') {
      onToast('Broadcast Pending', `${match.team1} vs ${match.team2} stream will start in ${match.timeRemaining}`);
      return;
    }
    setActiveMatch(match);
    setTickerMessage(`Broadcast swapped to ${match.team1} vs ${match.team2}.`);
    setTickerBadge('CONNECTED');
    setTickerSub(match.roundName.toUpperCase());
    onToast('Broadcast Feed Swapped', `Now viewing live telemetry for ${match.team1} vs ${match.team2}`);
  };

  const handlePostMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const myMsg: ChatMessage = {
      id: `user-msg-${Date.now()}-${Math.random()}`,
      user: 'You (Operative)',
      badge: 'staff',
      badgeColor: 'text-gold animate-pulse',
      text: userMsg.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setChatMessages(prev => [...prev, myMsg]);
    setUserMsg('');

    // Simulate viewers replying to user after 1.5s
    setTimeout(() => {
      const bots = CHAT_USERS.filter(u => u.name !== 'You');
      const replier = bots[Math.floor(Math.random() * bots.length)];
      const botReplies = [
        `@You (Operative) I totally agree with that!`,
        `Facts! @You (Operative) 👍`,
        `No way @You (Operative) is speaking truth haha`,
        `BTS eSports chat is so active tonight!`,
        `Agreed! What a match!`
      ];

      setChatMessages(prev => [
        ...prev,
        {
          id: `reply-${Date.now()}-${Math.random()}`,
          user: replier.name,
          badge: replier.badge as any,
          badgeColor: replier.badgeColor,
          text: botReplies[Math.floor(Math.random() * botReplies.length)],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      ]);
    }, 1500);
  };

  const pad = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="pt-24 container mx-auto px-4 max-w-7xl pb-24 min-h-screen space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-neon-red font-orbitron uppercase tracking-widest mb-1">
            <Radio size={14} className="animate-pulse" /> LIVE STREAM PROTOCOL
          </span>
          <h1 className="font-bebas text-4xl md:text-5xl text-white tracking-wider uppercase">
            BTS eSports Match Center
          </h1>
          <p className="text-neutral-500 text-xs font-sans">
            Stream high-fidelity custom match overlays, simulated fan engagement, and instant score updates.
          </p>
        </div>

        {/* Dynamic Countdown Header Banner */}
        <div className="bg-neutral-900 border border-gold/20 px-4 py-2 flex items-center gap-4 rounded-sm">
          <Clock className="text-gold animate-spin" size={16} />
          <div>
            <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest font-mono">NEXT UPCOMING SHOWDOWN</p>
            <p className="font-mono text-sm text-white font-black tracking-wider">
              {pad(countdown.hr)}:{pad(countdown.min)}:{pad(countdown.sec)}
            </p>
          </div>
          <span className="bg-gold/10 text-gold text-[8px] font-black font-orbitron border border-gold/20 px-2 py-0.5 rounded-sm uppercase tracking-wider">
            VALORANT
          </span>
        </div>
      </div>

      {/* Main Grid: Theater layout or side list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Stream Player Area (Spans 3 cols in desktop, 4 if expanded) */}
        <div className={`lg:col-span-3 space-y-6 ${theaterMode ? 'lg:col-span-4' : ''}`}>
          
          {/* Main Visual Stream Simulator Canvas container */}
          <div className="relative bg-neutral-950 aspect-video rounded-sm overflow-hidden border border-white/5 shadow-[0_15px_30px_rgba(0,0,0,0.6)] group">
            
            {/* Background Simulated Grid Canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black pointer-events-none opacity-80" />
            
            {/* Live Camera Feed Simulator HUD */}
            <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none z-10 font-mono">
              {/* TOP HUD */}
              <div className="flex justify-between items-start">
                <div className="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-sm pointer-events-auto flex items-center gap-3">
                  <span className="w-2.5 h-2.5 bg-neon-red rounded-full animate-ping" />
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{activeMatch.team1} vs {activeMatch.team2}</h3>
                    <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight">{activeMatch.roundName} • Map: {activeMatch.map}</p>
                  </div>
                </div>

                <div className="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-sm flex items-center gap-2">
                  <Users size={12} className="text-gold" />
                  <span className="text-[11px] font-black text-white">{(activeMatch.viewerCount / 1000).toFixed(1)}K WATCHING</span>
                </div>
              </div>

              {/* CENTER DYNAMIC TOURNAMENT FEED TICKER (Animated Event overlay) */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={tickerMessage}
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -15 }}
                  className="bg-black/90 backdrop-blur-md border border-gold/30 p-4 rounded-sm max-w-sm mx-auto pointer-events-auto text-center space-y-1.5 shadow-[0_0_20px_rgba(212,175,55,0.15)] self-center"
                >
                  <span className="bg-gold text-black text-[9px] font-black px-2.5 py-0.5 rounded-[2px] uppercase tracking-widest">
                    {tickerBadge}
                  </span>
                  <p className="text-[9px] text-neutral-400 font-bold tracking-widest uppercase">{tickerSub}</p>
                  <p className="text-sm font-black text-white uppercase tracking-wide leading-tight">{tickerMessage}</p>
                </motion.div>
              </AnimatePresence>

              {/* BOTTOM SCOREBOARD HUD */}
              <div className="flex justify-between items-end">
                {/* Scoreboard block */}
                <div className="bg-black/95 backdrop-blur-md border border-white/10 p-4 rounded-sm flex items-center gap-6 pointer-events-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-widest">TEAM 1</span>
                    <span className="text-base font-black text-white tracking-wider">{activeMatch.team1}</span>
                  </div>
                  <div className="bg-neutral-900 border border-white/5 px-4 py-1.5 rounded-sm flex items-center gap-3 font-orbitron">
                    <AnimatedScore score={activeMatch.score1} colorClass="text-gold" />
                    <span className="text-neutral-600 text-xs font-bold">:</span>
                    <AnimatedScore score={activeMatch.score2} colorClass="text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-widest">TEAM 2</span>
                    <span className="text-base font-black text-white tracking-wider">{activeMatch.team2}</span>
                  </div>
                </div>

                {/* Simulated FPS / Delay info */}
                <div className="text-right text-[9px] text-neutral-500 uppercase font-mono space-y-0.5">
                  <p>FEED STATUS: OPTIMAL</p>
                  <p>DELAY: 0.02S • BITRATE: 6800 KBPS</p>
                </div>
              </div>
            </div>

            {/* Simulated Live Feed Graphics (Video placeholder with animated ambient elements) */}
            <div className="absolute inset-0 bg-neutral-900/10 pointer-events-none flex flex-col items-center justify-center">
              {/* Pulsing Game Radar circle */}
              <div className="relative w-48 h-48 border border-white/5 rounded-full flex items-center justify-center animate-pulse">
                <div className="w-36 h-36 border border-white/10 rounded-full flex items-center justify-center">
                  <div className="w-24 h-24 border border-gold/15 rounded-full flex items-center justify-center">
                    <Gamepad2 size={28} className="text-gold/20 animate-spin duration-10000" />
                  </div>
                </div>
                {/* Ping blip */}
                <span className="absolute top-8 left-12 w-2 h-2 rounded-full bg-gold/40 animate-ping" />
                <span className="absolute bottom-12 right-8 w-2.5 h-2.5 rounded-full bg-neon-red/30 animate-ping" />
              </div>
            </div>

            {/* Custom Interactive Player Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-auto">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="text-white hover:text-gold transition-colors p-1"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white hover:text-gold transition-colors p-1"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {isPlaying ? 'STREAM ACTIVE' : 'STREAM PAUSED'}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Quality switcher */}
                <select 
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="bg-black/60 border border-white/10 text-neutral-300 font-mono text-[9px] px-2.5 py-1 rounded-sm focus:outline-none"
                >
                  <option value="1080p60">1080p60 (Source)</option>
                  <option value="720p60">720p60</option>
                  <option value="480p">480p</option>
                </select>

                <button 
                  onClick={() => setTheaterMode(!theaterMode)}
                  className="text-white hover:text-gold transition-colors p-1"
                  title="Toggle Theater Mode"
                >
                  {theaterMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>

          </div>

          {/* Broadcast Highlights & Stream Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-neutral-900/30 border border-white/5 p-6 rounded-sm">
            <div className="space-y-1 md:border-r md:border-white/5 md:pr-6">
              <span className="text-[9px] font-bold text-gold uppercase tracking-widest font-orbitron flex items-center gap-1">
                <Award size={12} /> SPONSOR OVERSIGHT
              </span>
              <h4 className="font-bebas text-lg text-white tracking-widest uppercase">BTS ESPORTS DEPLOYMENT</h4>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Matches are hosted on official cloud servers. Anticheat protocols are deployed on active terminals.
              </p>
            </div>

            <div className="space-y-1 md:border-r md:border-white/5 md:px-6">
              <span className="text-[9px] font-bold text-gold uppercase tracking-widest font-orbitron flex items-center gap-1">
                <Flame size={12} /> SERVER LATENCY
              </span>
              <h4 className="font-bebas text-lg text-white tracking-widest uppercase">20MS DEPLOYMENT</h4>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Guaranteed high tick-rate competitive esports server architecture with minimal routing spikes.
              </p>
            </div>

            <div className="space-y-1 md:pl-6">
              <span className="text-[9px] font-bold text-gold uppercase tracking-widest font-orbitron flex items-center gap-1">
                <Zap size={12} /> STREAM CHANNELS
              </span>
              <h4 className="font-bebas text-lg text-white tracking-widest uppercase">MULTI-VIEW TELEMETRY</h4>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Select other active games in the matching panel to switch camera feeds instantly.
              </p>
            </div>
          </div>

        </div>

        {/* Live Chat sidebar & Matches (Hidden if theater mode & desktop only) */}
        <div className={`space-y-6 ${theaterMode ? 'lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0' : 'lg:col-span-1'}`}>
          
          {/* Active / Live Matches Interactive sidebar */}
          <div className="bg-neutral-900 border border-white/5 p-4 rounded-sm space-y-4">
            <h3 className="font-bebas text-lg text-white tracking-widest border-b border-white/5 pb-2 uppercase flex items-center gap-2">
              <Tv size={16} className="text-gold" /> Active Broadcasts
            </h3>

            <div className="space-y-3">
              {liveMatches.map((m) => {
                const isActive = m.id === activeMatch.id;
                return (
                  <div 
                    key={m.id}
                    onClick={() => selectMatch(m)}
                    className={`border p-3 rounded-sm transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-gold/5 border-gold shadow-[0_0_10px_rgba(212,175,55,0.05)]' 
                        : 'bg-black/30 border-white/5 hover:border-white/25'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[8px] font-mono mb-2 uppercase text-neutral-500">
                      <span>{m.game} • {m.roundName}</span>
                      {m.status === 'live' ? (
                        <span className="text-neon-red font-black animate-pulse flex items-center gap-0.5">
                          ● LIVE
                        </span>
                      ) : m.status === 'upcoming' ? (
                        <span className="text-cyan-400">UPCOMING</span>
                      ) : (
                        <span className="text-neutral-600">FINISHED</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center gap-1.5">
                      <div className="flex items-center gap-1.5 max-w-[70%]">
                        <span className="text-xs text-neutral-400">{m.team1Logo}</span>
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                          {m.team1}
                        </span>
                      </div>
                      <ListScore score={m.status === 'completed' || m.status === 'live' ? m.score1 : '-'} colorClass="text-gold" />
                    </div>

                    <div className="flex justify-between items-center gap-1.5 mt-1">
                      <div className="flex items-center gap-1.5 max-w-[70%]">
                        <span className="text-xs text-neutral-400">{m.team2Logo}</span>
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                          {m.team2}
                        </span>
                      </div>
                      <ListScore score={m.status === 'completed' || m.status === 'live' ? m.score2 : '-'} colorClass="text-neutral-400" />
                    </div>

                    {m.status === 'upcoming' && m.timeRemaining && (
                      <div className="flex items-center gap-1 text-[8px] text-cyan-400 font-mono uppercase mt-2 pt-1 border-t border-white/5">
                        <Clock size={10} /> Commencing in {m.timeRemaining}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrolling Simulated Twitch Chat Container */}
          <div className="bg-neutral-900 border border-white/5 rounded-sm flex flex-col h-[400px]">
            <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="font-bebas text-sm text-white tracking-widest uppercase flex items-center gap-1.5">
                <MessageSquare size={14} className="text-gold" /> Fan Live Chat
              </h3>
              <div className="flex items-center gap-1 text-[9px] text-neutral-500 font-mono uppercase">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Live Feed
              </div>
            </div>

            {/* Scrolling Messages viewport */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-2.5 font-sans text-xs scrollbar-thin"
            >
              {chatMessages.map((msg) => (
                <div key={msg.id} className="leading-relaxed bg-black/10 p-1.5 rounded-sm hover:bg-black/20 transition-colors">
                  <span className="text-[8px] text-neutral-600 font-mono mr-1.5">{msg.timestamp}</span>
                  {msg.badge && (
                    <span className={`text-[8px] font-black uppercase tracking-widest font-orbitron bg-white/5 px-1 py-0.5 rounded-[2px] mr-1.5 border border-white/5 ${msg.badgeColor}`}>
                      {msg.badge}
                    </span>
                  )}
                  <span className="font-bold text-neutral-300 mr-1.5 hover:text-gold cursor-pointer transition-colors">
                    {msg.user}
                  </span>
                  <span className="text-neutral-400 break-words">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* User Chat input field */}
            <form onSubmit={handlePostMessage} className="p-3 border-t border-white/5 bg-black/10 flex gap-2">
              <input 
                type="text"
                placeholder="Post a dynamic fan message..."
                value={userMsg}
                onChange={(e) => setUserMsg(e.target.value)}
                maxLength={100}
                className="flex-1 bg-neutral-950 border border-white/5 text-xs text-white rounded-sm py-2 px-3 focus:outline-none focus:border-gold/40 placeholder-neutral-600"
              />
              <button 
                type="submit"
                className="bg-gold hover:bg-gold-light text-black px-3.5 py-2 rounded-sm flex items-center justify-center transition-all shadow-[0_0_10px_rgba(212,175,55,0.15)] cursor-pointer"
              >
                <Send size={12} />
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
