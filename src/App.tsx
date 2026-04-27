import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Gamepad2, 
  Trophy, 
  Users, 
  UserPlus,
  User as UserIcon,
  Settings, 
  Info, 
  LogIn, 
  Flame, 
  Target, 
  Skull, 
  Menu, 
  X, 
  Instagram, 
  Youtube, 
  MessageSquare, 
  Smartphone,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Award,
  Globe,
  Download,
  Calendar,
  IndianRupee,
  Briefcase,
  Share2,
  Copy,
  LogOut,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Check,
  Ban,
  Trash2,
  Eye,
  Play,
  ExternalLink,
  Lock,
  Loader2
} from 'lucide-react';
import { Page, Tournament, Player, RankingPlayer } from './types';
import { PLAYERS, DIVISIONS, TOURNAMENTS } from './constants';
import { auth, googleProvider, db, handleFirestoreError as firebaseErrorHandler } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  collectionGroup,
  addDoc, 
  serverTimestamp, 
  setDoc, 
  doc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  query, 
  orderBy, 
  writeBatch, 
  where, 
  limit, 
  onSnapshot, 
  increment 
} from 'firebase/firestore';

const Sparkline = ({ data, color }: { data: number[], color: string }) => {
  const chartData = data.map((val, i) => ({ value: val, index: i }));
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis hide domain={['dataMin - 0.5', 'dataMax + 0.5']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
const Toast = ({ title, msg, visible, onClose }: { title: string, msg: string, visible: boolean, onClose: () => void }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="fixed bottom-8 right-8 z-[9999] bg-neutral-900 border border-gold border-l-4 p-4 min-w-[280px] shadow-2xl"
      >
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-gold font-bold font-orbitron text-sm">{title}</h4>
            <p className="text-neutral-400 text-xs mt-1">{msg}</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ShareMenu = ({ title, url, onToast }: { title: string, url: string, onToast: (t: string, m: string) => void }) => {
  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    let shareUrl = '';
    
    if (platform === 'whatsapp') {
      shareUrl = `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank');
      onToast('Shared', `Opening ${platform}...`);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    onToast('Link Copied', 'URL copied to your clipboard!');
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <button onClick={() => handleShare('whatsapp')} className="text-neutral-500 hover:text-[#25D366] transition-colors" title="Share on WhatsApp">
        <MessageSquare size={14} />
      </button>
      <button onClick={copyToClipboard} className="text-neutral-500 hover:text-gold transition-colors" title="Copy Link">
        <Copy size={14} />
      </button>
    </div>
  );
};

const reportFirestoreError = (error: unknown, operationType: any, path: string | null, onToast: (t: string, m: string) => void) => {
  onToast('Access Denied', error instanceof Error ? (error.message.includes('insufficient permissions') ? 'Protocol rejection: Insufficient clearance.' : error.message) : 'Security breach detected.');
  firebaseErrorHandler(error, operationType as any, path);
};

const SectionHeader = ({ tag, title, sub, goldSpan, className = "text-center mb-12" }: { tag: string, title: string, sub?: string, goldSpan?: string, className?: string }) => (
  <div className={className}>
    <span className="text-neon-red text-[11px] font-bold tracking-[0.3em] uppercase block mb-3 font-orbitron">{tag}</span>
    <h2 className="font-bebas text-5xl md:text-6xl text-white tracking-wider mb-4">
      {title} <span className="text-gold">{goldSpan}</span>
    </h2>
    {sub && <p className={`text-neutral-400 text-sm md:text-base max-w-xl ${className.includes('text-left') ? 'mr-auto' : 'mx-auto'} leading-relaxed`}>{sub}</p>}
  </div>
);

// --- Pages ---

const Home = ({ onNavigate, onToast, userRole, isAdmin, user }: { onNavigate: (p: Page) => void, onToast: (t: string, m: string) => void, userRole?: string, isAdmin?: boolean, user?: User | null }) => {
  const [dbTournaments, setDbTournaments] = useState<any[]>([]);
  const [dbHighlights, setDbHighlights] = useState<any[]>([]);
  const [liveConfig, setLiveConfig] = useState<{ isLive: boolean, videoId: string, title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dbAchievements, setDbAchievements] = useState<any[]>([]);
  const [socialLinks, setSocialLinks] = useState<{ youtube: string, instagram: string }>({ youtube: '', instagram: '' });

  useEffect(() => {
    // Listen for live status
    const unsubLive = onSnapshot(doc(db, 'site_config', 'youtube_live'), (doc) => {
      if (doc.exists()) {
        setLiveConfig(doc.data() as any);
      }
    }, (error) => {
      console.error("Live Config Error:", error);
      firebaseErrorHandler(error, 'get', 'site_config/youtube_live');
    });

    return () => unsubLive();
  }, []);

  const heroSlides = useMemo(() => {
    const isStandard = user && !isAdmin && userRole === 'User';

    return [
      {
        tag: "🔥 India's Premier eSports Organization",
        title: ["Rise.", "Dominate.", "Conquer."],
        desc: "BTS eSports is building the next generation of competitive gaming talent in India. Join us and compete at the highest level.",
        btn1: "Join Now",
        btn2: "Tournaments",
        nav1: "recruitment",
        nav2: "tournament",
        accent: "gold"
      },
      {
        tag: "🏆 Champion Mindset",
        title: ["Train.", "Win.", "Repeat."],
        desc: "Our elite divisions are constantly scouting for the best talent in the region. Are you ready for the big leagues?",
        btn1: isStandard ? "Apply Now" : "View Roster",
        btn2: isStandard ? "Latest Events" : "Leaderboard",
        nav1: isStandard ? "recruitment" : "roster",
        nav2: isStandard ? "tournament" : "ranking",
        accent: "neon-red"
      },
      {
        tag: "🎮 Tactical Dominance",
        title: ["Aim.", "Shoot.", "Succeed."],
        desc: "From BGMI to Valorant, we are expanding our tactical footprint across all major competitive titles.",
        btn1: isStandard ? "Join Squad" : "Latest Results",
        btn2: "Recruitment",
        nav1: isStandard ? "recruitment" : "results",
        nav2: "recruitment",
        accent: "blue-500"
      }
    ];
  }, [user, isAdmin, userRole]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tSnap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(3)));
        setDbTournaments(tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const hSnap = await getDocs(query(collection(db, 'highlights'), orderBy('createdAt', 'desc'), limit(4)));
        setDbHighlights(hSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const aSnap = await getDocs(query(collection(db, 'achievements'), orderBy('date', 'desc'), limit(8)));
        setDbAchievements(aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const sSnap = await getDoc(doc(db, 'site_config', 'social'));
        if (sSnap.exists()) {
          setSocialLinks(sSnap.data() as any);
        }
      } catch (error) {
        console.error("Error fetching home data:", error);
        reportFirestoreError(error, 'list', 'home_data', onToast);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const displayTournaments = dbTournaments.length > 0 ? dbTournaments : TOURNAMENTS.slice(0, 3);
  const displayHighlights = dbHighlights.length > 0 ? dbHighlights : [
    { 
      title: "1v4 Clutch | BTS Prime vs Global Esports", 
      thumb: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800",
      tag: "SQUAD WIPE",
      date: "2 days ago"
    },
    { 
      title: "Insane Snipe Shots | BTS ScoutGod Montage", 
      thumb: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800",
      tag: "SNIPER KING",
      date: "1 week ago"
    },
    { 
      title: "Grand Finals Highlights - S1 Championship", 
      thumb: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&q=80&w=800",
      tag: "CHAMPIONSHIP",
      date: "Feb 2025"
    },
    { 
      title: "Strategic Masterclass | BTS Arise vs Team X", 
      thumb: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=800",
      tag: "BRAIN GAMES",
      date: "Mar 2025"
    }
  ];

  return (
    <div className="relative pt-16">
      {/* Live Stream Banner */}
      <AnimatePresence>
        {liveConfig?.isLive && liveConfig.videoId && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-black border-b border-red-500/30 overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600 animate-pulse" />
            <div className="container mx-auto flex flex-col lg:flex-row items-center gap-6 py-8 px-4">
               <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                     <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                     </span>
                     <span className="text-red-500 text-[10px] font-black uppercase tracking-[0.3em] font-orbitron">Live Stream Active</span>
                  </div>
                  <h2 className="font-bebas text-4xl text-white tracking-widest leading-none drop-shadow-lg">{liveConfig.title || 'Official BTS eSports Broadcast'}</h2>
                  <p className="text-neutral-400 text-xs font-medium uppercase tracking-[0.1em]">Watch the latest tournament action live on YouTube.</p>
                  <div className="flex gap-4 pt-2">
                     <a 
                       href={`https://youtube.com/watch?v=${liveConfig.videoId}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="bg-red-600 text-white px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-2"
                     >
                       <ExternalLink size={14} /> Join Chat
                     </a>
                  </div>
               </div>
               <div className="w-full lg:w-[480px] aspect-video border border-white/10 shadow-[0_0_50px_rgba(255,0,0,0.1)] relative group">
                  <iframe 
                    src={`https://www.youtube.com/embed/${liveConfig.videoId}?autoplay=1&mute=1`}
                    className="w-full h-full"
                    allowFullScreen
                    title="Live Stream"
                  />
                  <div className="absolute top-4 right-4 pointer-events-none">
                     <span className="bg-red-600/90 text-white text-[8px] font-black px-3 py-1 uppercase tracking-widest">Live Now</span>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-64px)] overflow-hidden flex items-center px-4 md:px-8">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(255,215,0,0.06)_0%,transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_80%,rgba(255,34,68,0.08)_0%,transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
               style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #FFD700 40px, #FFD700 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #FFD700 40px, #FFD700 41px)' }} />
        </div>

        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.6 }}
            >
              <div className={`inline-block border text-[11px] font-bold tracking-widest px-4 py-1 mb-6 uppercase ${
                heroSlides[currentSlide].accent === 'gold' ? 'bg-gold/15 border-gold/40 text-gold' : 
                heroSlides[currentSlide].accent === 'neon-red' ? 'bg-neon-red/15 border-neon-red/40 text-neon-red' : 
                'bg-blue-500/15 border-blue-500/40 text-blue-400'
              }`}>
                {heroSlides[currentSlide].tag}
              </div>
              <h1 className="font-bebas text-7xl md:text-9xl leading-[0.9] tracking-tight mb-6">
                <span className="block text-white">{heroSlides[currentSlide].title[0]}</span>
                <span className={`block ${heroSlides[currentSlide].accent === 'gold' ? 'text-gold' : heroSlides[currentSlide].accent === 'neon-red' ? 'text-neon-red' : 'text-blue-500'}`}>
                  {heroSlides[currentSlide].title[1]}
                </span>
                <span className="block text-white">{heroSlides[currentSlide].title[2]}</span>
              </h1>
              <p className="text-neutral-400 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">
                {heroSlides[currentSlide].desc}
              </p>
              <div className="flex gap-4 flex-wrap">
                <button 
                  onClick={() => onNavigate(heroSlides[currentSlide].nav1 as Page)}
                  className={`btn-clip px-8 py-3.5 font-bold tracking-widest uppercase transition-all transform hover:-translate-y-1 ${
                    heroSlides[currentSlide].accent === 'gold' ? 'bg-gold text-black hover:bg-gold-light' : 
                    heroSlides[currentSlide].accent === 'neon-red' ? 'bg-neon-red text-white hover:bg-neon-red/80' : 
                    'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {heroSlides[currentSlide].btn1}
                </button>
                <button 
                  onClick={() => onNavigate(heroSlides[currentSlide].nav2 as Page)}
                  className={`btn-clip border px-8 py-3.5 font-bold tracking-widest uppercase transition-all transform hover:-translate-y-1 ${
                    heroSlides[currentSlide].accent === 'gold' ? 'border-gold text-gold hover:bg-gold/10' : 
                    heroSlides[currentSlide].accent === 'neon-red' ? 'border-neon-red text-neon-red hover:bg-neon-red/10' : 
                    'border-blue-500 text-blue-500 hover:bg-blue-500/10'
                  }`}
                >
                  {heroSlides[currentSlide].btn2}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { num: '40+', label: 'Active Players', glow: true },
                { num: '5', label: 'Divisions', glow: false },
                { num: '30+', label: 'Tournaments Hosted', glow: false },
                { num: 'TOP 10', label: 'Global Rank', glow: false },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className={`bg-white/5 border border-gold/15 p-6 relative overflow-hidden group hover:border-gold/40 transition-colors ${stat.glow ? 'shadow-[0_0_20px_rgba(255,215,0,0.1)]' : ''}`}
                  style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-gold to-transparent" />
                  <span className="block font-orbitron font-black text-3xl text-gold mb-1">{stat.num}</span>
                  <span className="block text-neutral-500 text-[10px] uppercase tracking-widest font-bold">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Slide Indicators */}
            <div className="flex gap-2 justify-center md:justify-start">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1.5 transition-all outline-none ${currentSlide === i ? 'w-12 bg-gold' : 'w-4 bg-white/20 hover:bg-white/40'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section className="py-24 bg-gold-[0.02] border-y border-gold/5 px-4 overflow-hidden">
        <div className="container mx-auto">
          <SectionHeader tag="Multi-Game Ecosystem" title="Strategic" goldSpan="Expansion" sub="We are not just a one-game org. BTS is diversifying across multiple competitive architectures to dominate the Indian eSports scene." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Gamepad2 className="text-gold" size={48} />, name: 'BGMI', desc: 'Mobile Battle Royale Excellence', status: 'Active', players: 24 },
              { icon: <Target className="text-blue-400" size={48} />, name: 'Valorant', desc: 'Tactical Team-Based Shooter', status: 'Expanding', players: 10 },
              { icon: <Flame className="text-orange-500" size={48} />, name: 'Free Fire', desc: 'Fast-Paced Mobile Survival', status: 'Active', players: 12 },
              { icon: <Smartphone className="text-purple-500" size={48} />, name: 'Wild Rift', desc: 'Mobile MOBA Strategy', status: 'Soon', players: 0 },
            ].map((game, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5, borderColor: 'rgba(212,175,55,0.4)' }}
                className="bg-neutral-900 border border-white/5 p-8 relative group overflow-hidden"
                onClick={() => game.status !== 'Soon' && onNavigate('tournament')}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   {game.icon}
                </div>
                <div className="mb-6">{game.icon}</div>
                <h3 className="font-bebas text-3xl text-white tracking-widest mb-2 group-hover:text-gold transition-colors">{game.name}</h3>
                <p className="text-neutral-500 text-xs mb-6 font-medium leading-relaxed">{game.desc}</p>
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] uppercase font-black tracking-widest px-3 py-1 border ${
                    game.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 
                    game.status === 'Expanding' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    'bg-neutral-800 text-neutral-500 border-white/10'
                  }`}>
                    {game.status}
                  </span>
                  {game.players > 0 && (
                    <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">
                      {game.players} OPERATIVES
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Events & Highlights Section */}
      <section className="py-24 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Latest Events Column */}
          <div className="lg:col-span-1 space-y-8">
            <div>
              <SectionHeader tag="Uplink" title="Latest" goldSpan="Events" className="!text-left !items-start" />
              <p className="text-neutral-500 text-sm mt-4">Active and upcoming deployments in the BTS grid.</p>
            </div>
            
            <div className="space-y-4">
              {displayTournaments.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onNavigate('tournament')}
                  className="bg-white/5 border border-white/10 p-4 group hover:border-gold/30 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gold uppercase tracking-tighter">{t.game}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-[2px] ${
                      t.status === 'open' || t.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <h4 className="text-white font-bebas text-lg tracking-widest group-hover:text-gold transition-colors">{t.name}</h4>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-neutral-500 font-bold">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {t.date}</span>
                    <span className="flex items-center gap-1 text-gold">{(t.pool || t.prize)}</span>
                  </div>
                </motion.div>
              ))}
              <button 
                onClick={() => onNavigate('tournament')}
                className="w-full py-4 border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 hover:text-gold hover:border-gold/20 transition-all"
              >
                View All Operations
              </button>
            </div>
          </div>

          {/* Highlights Column */}
          <div className="lg:col-span-2 space-y-8">
            <SectionHeader tag="Combat Archive" title="Tournament" goldSpan="Highlights" className="!text-left !items-start" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayHighlights.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-video overflow-hidden border border-white/10 group-hover:border-gold/40 transition-all">
                    <img 
                      src={getSafeImageUrl(h.thumb)} 
                      alt={h.title}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-gold/90 text-black rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-[0_0_20px_rgba(255,215,0,0.4)]">
                        <Play size={24} fill="currentColor" />
                      </div>
                    </div>
                    <div className="absolute top-4 left-4">
                      <span className="bg-gold text-black text-[8px] font-black px-2 py-1 tracking-widest uppercase rounded-[2px]">{h.tag}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h5 className="text-white font-bebas text-xl tracking-wider group-hover:text-gold transition-colors line-clamp-1">{h.title}</h5>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mt-1">{h.date}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <IntelUplink socialLinks={socialLinks} />
      <SquadAchievementGallery achievements={dbAchievements} />
    </div>
  );
};

const TournamentCard = ({ tournament, onToast, user, onNavigate }: { tournament: Tournament, onToast: (t: string, m: string) => void, user?: User | null, onNavigate: (p: Page, d?: any) => void, key?: any }) => {
  const pct = Math.round((tournament.slots / tournament.total) * 100);
  const statusStyles = {
    open: 'bg-green-500/20 text-green-400 border-green-500/40',
    upcoming: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    ongoing: 'bg-gold/20 text-gold border-gold/40',
    closed: 'bg-neon-red/20 text-neon-red border-neon-red/40',
    finished: 'bg-neutral-800 text-neutral-400 border-white/20'
  };

  const handleRegister = () => {
    if (!user) {
      onToast('Login Required', 'Please sign in to register for tournaments.');
      onNavigate('signin', tournament);
      return;
    }
    onNavigate('registration', tournament);
  };

  return (
    <div className="bg-neutral-900 border border-gold/15 overflow-hidden group hover:border-gold/40 transition-all flex flex-col relative">
      <div 
        className="p-6 border-b border-gold/10 relative overflow-hidden"
        style={tournament.imageUrl ? {
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${getSafeImageUrl(tournament.imageUrl)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {
          backgroundImage: `linear-gradient(to bottom right, rgba(212,175,55,0.1), rgba(255,0,0,0.1))`
        }}
      >
        <div className="flex justify-between items-start relative z-10">
          <div>
            <div className="text-[10px] font-bold text-gold tracking-widest uppercase mb-1 font-orbitron">{tournament.game}</div>
            <h3 className="font-bebas text-2xl text-white tracking-wide">{tournament.name || 'Untitled Tournament'}</h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm border ${statusStyles[tournament.status as keyof typeof statusStyles] || 'bg-neutral-800 text-neutral-400 border-white/10'}`}>
              {tournament.status}
            </span>
            <ShareMenu 
              title={`Join me at ${tournament.name} on BTS eSports!`} 
              url={`${window.location.origin}/tournament/${(tournament.name || '').toLowerCase().replace(/ /g, '-')}`} 
              onToast={onToast} 
            />
          </div>
        </div>
      </div>
      <div className="p-6 flex-grow">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Prize Pool</div>
            <div className="text-gold font-orbitron font-bold flex items-center gap-1"><IndianRupee size={12}/>{(tournament.pool || tournament.prize || '0').replace('₹', '')}</div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Entry Fee</div>
            <div className="text-gold font-orbitron font-bold flex items-center gap-1"><IndianRupee size={12}/>{(tournament.fee || 'FREE').replace('₹', '')}</div>
          </div>
        </div>
        
        <div className="flex justify-between text-xs text-neutral-400 mb-2 font-bold tracking-widest">
          <span className="uppercase">Slots filled: {tournament.slots}/{tournament.total}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-6">
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            className="h-full bg-gradient-to-r from-gold to-neon-red rounded-full"
          />
        </div>

        {tournament.status === 'open' ? (
          <button 
            onClick={handleRegister}
            className="btn-clip bg-gold text-black w-full py-3 font-bold uppercase tracking-widest hover:bg-gold-light transition-colors"
          >
            Register Now
          </button>
        ) : tournament.status === 'upcoming' ? (
          <button 
            onClick={() => onToast('Reminder Set', 'We will notify you when slots open!')}
            className="btn-clip border border-gold text-gold w-full py-3 font-bold uppercase tracking-widest hover:bg-gold/10 transition-colors"
          >
            Set Reminder
          </button>
        ) : (
          <button className="btn-clip border border-white/10 text-white/30 w-full py-3 font-bold uppercase tracking-widest cursor-not-allowed">
            Closed
          </button>
        )}

        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
          {tournament.discordLink && (
            <a 
              href={formatSocialLink(tournament.discordLink, 'discord')} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#5865F2] hover:text-white transition-colors"
            >
              <MessageSquare size={14} /> Discord
            </a>
          )}
          {tournament.instagramLink && (
            <a 
              href={formatSocialLink(tournament.instagramLink, 'instagram')} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#E4405F] hover:text-white transition-colors"
            >
              <Instagram size={14} /> Instagram
            </a>
          )}
          {tournament.youtubeLink && (
            <a 
              href={formatSocialLink(tournament.youtubeLink, 'youtube')} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FF0000] hover:text-white transition-colors"
            >
              <Youtube size={14} /> YouTube
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const IntelUplink = ({ socialLinks }: { socialLinks?: { youtube?: string, instagram?: string } }) => (
  <div className="mt-32 pb-24 border-t border-white/5 pt-24 text-center">
    <SectionHeader 
      tag="INTEL UPLINK" 
      title="Stay" 
      goldSpan="Connected" 
      sub="Follow our official intelligence channels for recruitment alerts, high-stakes highlights, and tactical breakdowns."
    />
    <div className="flex flex-wrap justify-center gap-6 mt-8 px-4">
        <a 
          href={socialLinks?.youtube || "https://youtube.com/@btsesportsofficial"} 
          target="_blank" 
          rel="noreferrer"
          className="group relative px-10 py-4 bg-red-600 text-white font-black uppercase tracking-[0.2em] overflow-hidden flex-1 sm:flex-none min-w-[240px]"
        >
          <div className="absolute inset-0 bg-black opacity-10 group-hover:opacity-0 transition-opacity" />
          <div className="relative flex items-center justify-center gap-3">
              <Youtube size={20} />
              <span>Subscribe YouTube</span>
          </div>
        </a>
        <a 
          href={socialLinks?.instagram || "https://www.instagram.com/bts__esports"} 
          target="_blank" 
          rel="noreferrer"
          className="group relative px-10 py-4 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white font-black uppercase tracking-[0.2em] overflow-hidden flex-1 sm:flex-none min-w-[240px]"
        >
          <div className="absolute inset-0 bg-black opacity-20 group-hover:opacity-0 transition-opacity" />
          <div className="relative flex items-center justify-center gap-3">
              <Instagram size={20} />
              <span>Follow Instagram</span>
          </div>
        </a>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-16 px-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="aspect-video bg-neutral-900 border border-white/5 relative group overflow-hidden">
            <img 
              referrerPolicy="no-referrer"
              src={`https://images.unsplash.com/photo-${1502000000000 + i * 100000}?auto=format&fit=crop&q=100&w=600`} 
              alt="Social Feed" 
              className="w-full h-full object-cover opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                {i % 2 === 0 ? <Instagram className="text-white" size={24} /> : <Play className="text-white fill-white" size={24} />}
            </div>
          </div>
        ))}
    </div>
  </div>
);

const SquadAchievementGallery = ({ achievements }: { achievements: any[] }) => {
  if (achievements.length === 0) return null;
  
  return (
    <div className="mt-24 mb-16 overflow-hidden">
      <SectionHeader 
        tag="MISSION DEBRIEF" 
        title="Victory" 
        goldSpan="Archive" 
        sub="The digital legacy of BTS eSports. Every conquest, every trophy, every dominant performance immortalized in our achievement vault."
      />

      <div className="relative mt-12 group cursor-pointer">
        {/* Gradients to hide edges for a cleaner cinematic look */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

        <motion.div 
          className="flex gap-6 py-4"
          animate={achievements.length > 3 ? { x: ["0%", "-50%"] } : {}}
          transition={{
            duration: achievements.length * 6,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{ width: 'max-content' }}
        >
          {(achievements.length > 3 ? [...achievements, ...achievements] : achievements).map((ach, idx) => (
            <div
              key={`${ach.id}-${idx}`}
              className="w-[320px] bg-neutral-900 border border-white/5 relative group/card overflow-hidden shrink-0 hover:border-gold/30 transition-colors"
            >
               <div className="aspect-video relative overflow-hidden">
                  <img 
                    referrerPolicy="no-referrer"
                    src={getSafeImageUrl(ach.imageUrl)} 
                    alt={ach.title} 
                    className="w-full h-full object-cover opacity-50 group-hover/card:opacity-100 group-hover/card:scale-110 transition-all duration-700" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />
                  <div className="absolute top-3 left-3 bg-gold/90 text-black text-[8px] font-black px-2 py-0.5 uppercase tracking-widest">
                     {ach.game}
                  </div>
               </div>
               <div className="p-5 space-y-2 bg-neutral-950/80 backdrop-blur-sm">
                  <h4 className="font-bebas text-xl text-white tracking-widest line-clamp-1 group-hover/card:text-gold transition-colors">{ach.title}</h4>
                  <div className="flex justify-between items-center text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                     <span>{ach.date}</span>
                     {ach.division && <span className="text-gold/60">{ach.division}</span>}
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-2 pt-2 border-t border-white/5">{ach.description}</p>
               </div>
               <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gold scale-x-0 group-hover/card:scale-x-100 transition-transform origin-left" />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

const getSafeImageUrl = (url: string) => {
  if (!url) return '';
  const trimmed = url.trim();
  // Handle Google Drive links
  if (trimmed.includes('drive.google.com')) {
    const idMatch = trimmed.match(/\/d\/(.+?)(\/|$)/) || trimmed.match(/id=(.+?)(&|$)/);
    if (idMatch && idMatch[1]) {
      return `https://docs.google.com/uc?export=view&id=${idMatch[1]}`;
    }
  }
  return trimmed;
};

const formatSocialLink = (val: string, platform: 'instagram' | 'youtube' | 'discord') => {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http')) return trimmed;
  if (trimmed.startsWith('www.')) return `https://${trimmed}`;
  
  if (platform === 'instagram') {
    if (trimmed.includes('instagram.com/')) return `https://${trimmed.replace('https://', '').replace('http://', '')}`;
    return `https://instagram.com/${trimmed.replace('@', '')}`;
  }
  if (platform === 'youtube') {
    if (trimmed.includes('youtube.com/')) return `https://${trimmed.replace('https://', '').replace('http://', '')}`;
    return `https://youtube.com/@${trimmed.replace('@', '')}`;
  }
  if (platform === 'discord') {
    if (trimmed.includes('discord.com/')) return `https://${trimmed.replace('https://', '').replace('http://', '')}`;
    return `https://discord.com/users/${trimmed}`;
  }
  return trimmed;
};

const RosterPage = ({ onToast }: { onToast: (t: string, m: string) => void }) => {
  const [activeDiv, setActiveDiv] = useState<string>('all');
  const [activeGame, setActiveGame] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [dbPlayers, setDbPlayers] = useState<any[]>([]);
  const [dbDivisions, setDbDivisions] = useState<any[]>([]);
  const [dbAchievements, setDbAchievements] = useState<any[]>([]);
  const [socialLinks, setSocialLinks] = useState<{ youtube: string, instagram: string }>({ youtube: '', instagram: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        const qPlayers = query(collection(db, 'squad'), orderBy('createdAt', 'desc'));
        const qDivs = query(collection(db, 'divisions'), orderBy('name'));
        const qAchs = query(collection(db, 'achievements'), orderBy('date', 'desc'), limit(8));
        
        const [playersSnap, divsSnap, achSnap, sSnap] = await Promise.all([
          getDocs(qPlayers),
          getDocs(qDivs),
          getDocs(qAchs),
          getDoc(doc(db, 'site_config', 'social'))
        ]);
        
        setDbPlayers(playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setDbDivisions(divsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setDbAchievements(achSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        if (sSnap.exists()) {
          setSocialLinks(sSnap.data() as any);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeamData();
  }, []);

  const displayPlayers = useMemo(() => {
    let filtered = dbPlayers.length > 0 ? dbPlayers : PLAYERS;
    
    if (activeGame !== 'all') {
      filtered = filtered.filter(p => p.game === activeGame);
    }

    if (!searchTerm) return filtered;
    const term = searchTerm.toLowerCase();
    return filtered.filter(p => 
      (p.ign || '').toLowerCase().includes(term) || 
      (p.role || '').toLowerCase().includes(term)
    );
  }, [dbPlayers, searchTerm, activeGame]);
  
  const resolvedDivisions = useMemo(() => {
    if (dbDivisions.length > 0) {
      const dict: Record<string, any> = {};
      dbDivisions.forEach(d => {
        dict[d.key] = d;
      });
      return dict;
    }
    return DIVISIONS;
  }, [dbDivisions]);

  const filteredDivs = useMemo(() => {
    if (activeDiv === 'all') return Object.keys(resolvedDivisions);
    return [activeDiv];
  }, [activeDiv, resolvedDivisions]);

  return (
    <div className="pt-24 container mx-auto px-4 min-h-screen">
      <SectionHeader tag="The Squad" title="Our" goldSpan="Roster" />
      
      <div className="flex flex-col gap-6 mb-12">
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setActiveGame('all')}
            className={`btn-clip-sm px-4 py-1.5 text-[10px] font-bold font-orbitron uppercase tracking-widest border transition-all ${
              activeGame === 'all' ? 'border-gold text-gold bg-gold/5' : 'border-white/10 text-neutral-600 hover:border-white/30'
            }`}
          >
            All Games
          </button>
          {['BGMI', 'Free Fire', 'COD', 'Valorant'].map(game => (
            <button
              key={game}
              onClick={() => setActiveGame(game)}
              className={`btn-clip-sm px-4 py-1.5 text-[10px] font-bold font-orbitron uppercase tracking-widest border transition-all ${
                activeGame === game ? 'border-gold text-gold bg-gold/5 shadow-[0_0_10px_rgba(255,215,0,0.1)]' : 'border-white/10 text-neutral-600 hover:border-white/30'
              }`}
            >
              {game}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-white/5 pt-6">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveDiv('all')}
              className={`btn-clip-sm px-5 py-2 text-xs font-bold font-orbitron uppercase tracking-widest border transition-all ${
                activeDiv === 'all' ? 'border-gold bg-gold/10 text-gold' : 'border-gold/20 text-neutral-500 hover:border-gold/50'
              }`}
            >
              All Divisions
            </button>
            {(Object.entries(resolvedDivisions) as [string, any][]).map(([key, div]) => (
              <button
                key={key}
                onClick={() => setActiveDiv(key)}
                className={`btn-clip-sm px-5 py-2 text-xs font-bold font-orbitron uppercase tracking-widest border transition-all ${
                  activeDiv === key ? 'border-gold bg-gold/10 text-gold shadow-[0_0_10px_rgba(255,215,0,0.2)]' : 'border-gold/20 text-neutral-500 hover:border-gold/50'
                }`}
              >
                {div.name}
              </button>
            ))}
          </div>

          <div className="relative group min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40 group-focus-within:text-gold transition-colors" size={16} />
            <input 
              type="text"
              placeholder="SEARCH OPERATIVE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 border border-gold/20 focus:border-gold text-gold text-[10px] font-black tracking-widest px-12 py-3 uppercase transition-all focus:outline-none focus:shadow-[0_0_15px_rgba(255,215,0,0.1)]"
            />
          </div>
        </div>
      </div>
      
      {loading && dbPlayers.length === 0 ? (
        <div className="py-20 text-center font-orbitron text-gold animate-pulse">Syncing Tactical Roster...</div>
      ) : (
        <div className="space-y-16 pb-24">
          {filteredDivs.map(divKey => {
            const div = resolvedDivisions[divKey];
            const divPlayers = displayPlayers.filter(p => p.div === divKey);
            return (
              <motion.div 
                key={divKey}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-gold/10 pb-4">
                  <div className="w-1 h-8 rounded-full" style={{ backgroundColor: div.badgeColor || '#FFD700' }} />
                  <h3 className="font-bebas text-4xl text-white tracking-widest">{div.name}</h3>
                  <span className="ml-auto text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">{divPlayers.length} ACTIVE PLAYERS</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {divPlayers.map(p => (
                    <motion.div 
                      key={p.id}
                      whileHover={{ y: -5 }}
                      onClick={() => setSelectedPlayer(p)}
                      className="bg-neutral-900 border border-gold/10 p-6 text-center group relative overflow-hidden cursor-pointer"
                    >
                    <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-gold/5 to-transparent skew-x-12 group-hover:left-[100%] transition-all duration-500" />
                    {p.status && p.status !== 'Active' && (
                      <div className={`absolute top-2 right-2 text-[8px] px-2 py-0.5 font-black uppercase tracking-widest ${
                        p.status === 'On Trial' ? 'bg-blue-600/80 text-white' : 'bg-neutral-800 text-white/40'
                      }`}>
                        {p.status}
                      </div>
                    )}
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-gold/30 to-neon-red/30 mx-auto mb-4 flex items-center justify-center font-orbitron font-black text-xl text-black border-2 border-gold/20 ${p.status === 'Inactive' ? 'grayscale opacity-50' : ''}`}>
                      {p.ign.split('•')[1]?.charAt(0) || p.ign.charAt(0) || 'P'}
                    </div>
                    <div className={`font-orbitron font-bold text-white text-sm truncate mb-1 flex items-center justify-center gap-2 ${p.status === 'Inactive' ? 'text-neutral-500' : ''}`}>
                      <span className="truncate">{p.ign}</span>
                      {p.status && p.status !== 'Active' && (
                        <span className={`flex-shrink-0 text-[7px] px-1 py-0.5 rounded-xs uppercase tracking-tighter font-black ${
                          p.status === 'On Trial' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-neutral-800 text-white/40 border border-white/5'
                        }`}>
                          {p.status}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="text-[10px] font-bold text-gold uppercase tracking-tighter">{p.role}</div>
                      {p.game && <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">{p.game}</div>}
                    </div>
                      <div className="flex justify-center items-center gap-3 mb-4">
                        <ShareMenu 
                           title={`Meet ${p.ign} from the BTS eSports ${resolvedDivisions[p.div]?.name || 'Official'} division!`} 
                           url={`${window.location.origin}/player/${(p.ign || '').toLowerCase().replace(/•/g, '-').replace(/ /g, '-')}`} 
                          onToast={onToast} 
                        />
                        {p.instagram && (
                          <a 
                            href={formatSocialLink(p.instagram, 'instagram')} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-neutral-500 hover:text-gold transition-colors"
                          >
                            <Instagram size={16} />
                          </a>
                        )}
                      </div>
                      <div className="flex justify-center gap-6">
                        <div className="text-center">
                          <span className="block font-orbitron font-black text-gold leading-none">{p.kd}</span>
                          <span className="text-[9px] text-neutral-500 uppercase font-black">K/D</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-orbitron font-black text-gold leading-none">{p.matches}</span>
                          <span className="text-[9px] text-neutral-500 uppercase font-black">GP</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <IntelUplink socialLinks={socialLinks} />
      <SquadAchievementGallery achievements={dbAchievements} />

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-neutral-950 border border-gold/20 shadow-[0_0_100px_rgba(255,215,0,0.1)] overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Profile Header Side */}
                <div className="p-8 bg-neutral-900/50 border-r border-white/5 flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gold/40 to-neon-red/40 p-1 mb-6">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bebas text-5xl text-gold border border-gold/20">
                      {(selectedPlayer.ign || 'P').charAt(0)}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <h2 className="font-bebas text-5xl text-white tracking-widest">{selectedPlayer.ign}</h2>
                    {selectedPlayer.status && (
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm ${
                        selectedPlayer.status === 'Active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        selectedPlayer.status === 'On Trial' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-neutral-800 text-white/40 border border-white/5'
                      }`}>
                        {selectedPlayer.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-black text-gold uppercase tracking-[0.3em] mb-8">{selectedPlayer.role}</div>
                  
                  <div className="grid grid-cols-2 gap-4 w-full mb-8">
                    <div className="bg-white/5 p-4 rounded-[2px] border border-white/5">
                      <div className="text-[8px] text-neutral-500 uppercase font-black mb-1">SCRIMS K/D</div>
                      <div className="text-2xl font-bebas text-white tracking-widest">
                        {selectedPlayer.scrimsMatches > 0 ? (selectedPlayer.scrimsKills / selectedPlayer.scrimsMatches).toFixed(2) : selectedPlayer.kd}
                      </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-[2px] border border-white/5">
                      <div className="text-[8px] text-neutral-500 uppercase font-black mb-1">TOURNEY K/D</div>
                      <div className="text-2xl font-bebas text-white tracking-widest">
                        {selectedPlayer.tourneyMatches > 0 ? (selectedPlayer.tourneyKills / selectedPlayer.tourneyMatches).toFixed(2) : selectedPlayer.kd}
                      </div>
                    </div>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex justify-center gap-4 mb-6">
                      {selectedPlayer.instagram && (
                        <a href={formatSocialLink(selectedPlayer.instagram, 'instagram')} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-neutral-500 hover:border-gold hover:text-gold transition-all">
                          <Instagram size={18} />
                        </a>
                      )}
                      {selectedPlayer.youtube && (
                        <a href={formatSocialLink(selectedPlayer.youtube, 'youtube')} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-neutral-500 hover:border-gold hover:text-gold transition-all">
                          <Youtube size={18} />
                        </a>
                      )}
                      {selectedPlayer.discord && (
                        <a href={formatSocialLink(selectedPlayer.discord, 'discord')} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-neutral-500 hover:border-gold hover:text-gold transition-all">
                          <MessageSquare size={18} />
                        </a>
                      )}
                    </div>
                    <div className="text-[9px] text-neutral-500 uppercase font-black text-left tracking-widest">Achievements</div>
                    <div className="space-y-2">
                       {(selectedPlayer.achievements && selectedPlayer.achievements.length > 0 ? selectedPlayer.achievements : ['Tournament MVP - S4', 'Highest Frags - BTS Cup', 'Pro League Finalist']).map((ach, i) => (
                         <div key={i} className="flex items-center gap-3 text-left">
                            <div className="w-1.5 h-1.5 rotate-45 bg-gold" />
                            <span className="text-[10px] text-neutral-300 font-bold uppercase tracking-wider">{ach}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Performance & History Side */}
                <div className="lg:col-span-2 p-8 lg:p-12 space-y-8 overflow-y-auto max-h-[80vh] lg:max-h-none">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-bebas text-3xl text-white tracking-widest">Tactical Analysis</h3>
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Simulated Performance Trends</p>
                    </div>
                    <button onClick={() => setSelectedPlayer(null)} className="text-neutral-500 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  {/* Performance Trend Chart */}
                  <div className="bg-black/40 border border-white/5 p-6 rounded-sm">
                    <div className="h-40 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={(selectedPlayer.kdHistory || [0, 0, 0, 0, 0]).map((val, i) => ({ val, i }))}>
                           <defs>
                             <linearGradient id="colorKd" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <XAxis dataKey="i" hide />
                           <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,215,0,0.2)', fontSize: '10px', borderRadius: '2px' }}
                             itemStyle={{ color: '#FFD700' }}
                             labelStyle={{ display: 'none' }}
                           />
                           <Area type="monotone" dataKey="val" stroke="#FFD700" strokeWidth={2} fillOpacity={1} fill="url(#colorKd)" />
                         </AreaChart>
                       </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex justify-between text-[8px] text-neutral-600 font-black uppercase tracking-widest">
                       <span>Performance history (Last 10 updates)</span>
                       <span className="text-gold flex items-center gap-1">
                         Current Form: {selectedPlayer.kdHistory && selectedPlayer.kdHistory.length > 1 && selectedPlayer.kdHistory[selectedPlayer.kdHistory.length-1] >= selectedPlayer.kdHistory[selectedPlayer.kdHistory.length-2] ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                       </span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-bebas text-2xl text-white tracking-widest border-b border-white/5 pb-2">Mission Log</h4>
                    <div className="space-y-3">
                      {[
                        { map: 'Erangel', result: 'WIN', kills: 7, rank: '#1', date: '2h ago' },
                        { map: 'Miramar', result: 'LOSS', kills: 3, rank: '#12', date: '5h ago' },
                        { map: 'Sanhok', result: 'WIN', kills: 12, rank: '#1', date: 'Yesterday' },
                        { map: 'Vikendi', result: 'WIN', kills: 5, rank: '#3', date: 'Yesterday' },
                      ].map((match, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-gold/20 transition-all group">
                           <div className="flex items-center gap-4">
                              <div className={`w-1 h-8 ${match.result === 'WIN' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div>
                                 <div className="text-[10px] font-black text-white uppercase tracking-widest">{match.map}</div>
                                 <div className="text-[8px] text-neutral-500 uppercase font-bold">{match.date}</div>
                              </div>
                           </div>
                           <div className="flex gap-8 text-right">
                              <div>
                                 <div className="text-[10px] font-black text-gold uppercase tracking-widest">{match.kills} KILLS</div>
                                 <div className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">ELIMINATIONS</div>
                              </div>
                              <div>
                                 <div className="text-[10px] font-black text-white uppercase tracking-widest">{match.rank}</div>
                                 <div className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">PLACEMENT</div>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <button className="flex-1 bg-gold text-black py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all">
                       Challenge Operative
                    </button>
                    <button className="flex-1 border border-white/10 text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:border-gold transition-all">
                       Full Statistics
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RecruitmentPage = ({ onToast, user }: { onToast: (t: string, m: string) => void, user: User | null }) => {
  const [selectedGame, setSelectedGame] = useState('BGMI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<'apply' | 'status'>('apply');
  const [searchQuery, setSearchQuery] = useState('');
  const [trackResult, setTrackResult] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    ign: '',
    uid: '',
    gameUid: '',
    age: '',
    whatsapp: '',
    location: '',
    game: 'BGMI',
    role: 'IGL (In-Game Leader)',
    kd: '',
    fps: '60 FPS',
    experience: '',
    activeTime: '7PM – 11PM',
    language: 'English',
    videoLink: ''
  });

  const checkStatus = async () => {
    if (!searchQuery) return;
    setIsSubmitting(true);
    try {
      // Check by application ID first
      const byId = await getDoc(doc(db, 'applications', searchQuery));
      if (byId.exists()) {
        setTrackResult([{ id: byId.id, ...byId.data() }]);
      } else {
        // Check by game UID or IGN
        const q = query(collection(db, 'applications'), where('gameUid', '==', searchQuery));
        const q2 = query(collection(db, 'applications'), where('ign', '==', searchQuery));
        const snap = await getDocs(q);
        const snap2 = await getDocs(q2);
        
        const results = [...snap.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() }));
        setTrackResult(results);
      }
      if (trackResult.length === 0) onToast('Not Found', 'No application matches that ID or UID.');
    } catch (error) {
      reportFirestoreError(error, 'get', 'applications/search', onToast);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const submitApplication = async () => {
    if (!user) {
      onToast('Login Required', 'Please sign in to submit an application.');
      return;
    }

    if (!formData.fullName || !formData.ign || !formData.gameUid) {
      onToast('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'applications'), {
        ...formData,
        game: selectedGame,
        uid: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      onToast('Application Success', 'Our scouts will contact you within 48 hours for trials.');
      setFormData({
        fullName: '',
        ign: '',
        uid: '',
        gameUid: '',
        age: '',
        whatsapp: '',
        location: '',
        game: 'BGMI',
        role: 'IGL (In-Game Leader)',
        kd: '',
        fps: '60 FPS',
        experience: '',
        activeTime: '7PM – 11PM',
        language: 'English',
        videoLink: ''
      });
    } catch (error) {
      reportFirestoreError(error, 'create', 'applications', onToast);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-24 container mx-auto px-4 min-h-screen">
      <SectionHeader tag="Join Us" title="Apply to" goldSpan="BTS eSports" sub="We are looking for disciplined, skilled players across all titles. Think you have what it takes? Show us your skills." />
      
      <div className="flex gap-4 mb-12 border-b border-gold/10">
        <button 
          onClick={() => setActiveView('apply')}
          className={`px-8 py-3 font-bebas text-2xl tracking-widest transition-all ${activeView === 'apply' ? 'text-gold border-b-2 border-gold' : 'text-neutral-600 hover:text-neutral-400'}`}
        >
          Submit Application
        </button>
        <button 
          onClick={() => setActiveView('status')}
          className={`px-8 py-3 font-bebas text-2xl tracking-widest transition-all ${activeView === 'status' ? 'text-gold border-b-2 border-gold' : 'text-neutral-600 hover:text-neutral-400'}`}
        >
          Track Status
        </button>
      </div>

      {activeView === 'apply' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {['BGMI', 'Free Fire', 'Valorant', 'COD: Mobile'].map((game) => (
              <button
                key={game}
                onClick={() => setSelectedGame(game)}
                className={`p-6 border transition-all text-center group ${
                  selectedGame === game ? 'bg-gold/10 border-gold text-gold' : 'bg-neutral-900 border-gold/10 text-neutral-500 hover:border-gold/30'
                }`}
              >
                 <div className="text-sm font-black font-orbitron uppercase tracking-widest">{game}</div>
              </button>
            ))}
          </div>
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 pb-24">
            {/* Form */}
            <div className="bg-neutral-900 border border-gold/15 p-8 md:p-12">
              <h3 className="font-bebas text-3xl text-gold mb-8 tracking-wider">Application Form</h3>
              
              <div className="space-y-8">
                 <div>
                  <div className="text-xs font-bold text-neon-red uppercase tracking-widest border-b border-neon-red/20 pb-2 mb-6">Personal details</div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Full Name</label>
                      <input name="fullName" value={formData.fullName} onChange={handleInputChange} type="text" placeholder="Real Name" className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">In-Game Name</label>
                      <input name="ign" value={formData.ign} onChange={handleInputChange} type="text" placeholder="IGN" className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Age</label>
                      <input name="age" value={formData.age} onChange={handleInputChange} type="number" placeholder="16+" className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">WhatsApp / Phone</label>
                      <input name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} type="tel" placeholder="+91..." className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Location</label>
                      <input name="location" value={formData.location} onChange={handleInputChange} type="text" placeholder="City, State" className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-neon-red uppercase tracking-widest border-b border-neon-red/20 pb-2 mb-6">Game Stats & Identity</div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Game Title</label>
                      <select name="game" value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white appearance-none">
                        <option>BGMI</option>
                        <option>Free Fire</option>
                        <option>Valorant</option>
                        <option>COD: Mobile</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Current Role</label>
                      <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white appearance-none">
                        <option>IGL (In-Game Leader)</option>
                        <option>Assaulter</option>
                        <option>Sniper</option>
                        <option>Support</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">K/D (Current Season)</label>
                      <input name="kd" value={formData.kd} onChange={handleInputChange} type="text" placeholder="e.g. 5.2" className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Game UID</label>
                      <input name="gameUid" value={formData.gameUid} onChange={handleInputChange} type="text" placeholder="5678..." className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">FPS Capability</label>
                      <select name="fps" value={formData.fps} onChange={handleInputChange} className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white appearance-none">
                        <option>30 FPS</option>
                        <option>40 FPS</option>
                        <option>60 FPS</option>
                        <option>90 FPS</option>
                        <option>120 FPS</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Gameplay Video Link</label>
                      <input name="videoLink" value={formData.videoLink} onChange={handleInputChange} type="url" placeholder="YouTube/G-Drive Link" className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Tournament Experience</label>
                  <textarea name="experience" value={formData.experience} onChange={handleInputChange} placeholder="Describe your competitive history..." className="w-full bg-white/5 border border-gold/15 p-3 font-sans focus:border-gold outline-none text-white min-h-[100px]" />
                </div>

                <button 
                  disabled={isSubmitting}
                  onClick={submitApplication}
                  className={`btn-clip bg-gold text-black w-full py-4 text-sm font-black uppercase tracking-widest hover:bg-gold-light transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'} <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Info Column */}
            <div className="space-y-8">
              <div className="bg-neutral-900 border border-gold/15 p-8">
                <h4 className="font-bebas text-xl text-gold mb-6 tracking-widest">Requirements</h4>
                <ul className="space-y-4">
                  {[
                    'Minimum 1 Year Competitive Exp',
                    'Active 7PM – 11PM daily for scrims',
                    'Device supporting 60+ FPS',
                    'No toxic history + Discord active',
                    'Ready for 3-day trial matches',
                  ].map((req, i) => (
                    <li key={i} className="flex gap-4 items-start text-sm border-b border-white/5 pb-3">
                      <span className="text-gold mt-1">▸</span>
                      <span className="text-neutral-400">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-neutral-900 border border-gold/15 p-8">
                <h4 className="font-bebas text-xl text-gold mb-6 tracking-widest">Organization Benefits</h4>
                <ul className="space-y-4">
                  {[
                    'Daily high-level practice lobbies',
                    'Entry fees covered by organization',
                    'Winning bonus + Performance pay',
                    'Personalized jersey & branding',
                    'Sponsorship opportunities',
                  ].map((benefit, i) => (
                    <li key={i} className="flex gap-4 items-start text-sm border-b border-white/5 pb-3">
                      <span className="text-neon-red mt-1">✦</span>
                      <span className="text-neutral-400">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-gold/5 to-neon-red/5 border border-gold/15 p-8">
                <h4 className="font-bebas text-xl text-neon-red mb-6 tracking-widest">Trial System</h4>
                <div className="space-y-4 text-xs font-bold text-neutral-400 tracking-wider">
                  <div className="flex justify-between"><span>STEP 01</span><span className="text-white">Admin Review</span></div>
                  <div className="w-full h-px bg-white/10" />
                  <div className="flex justify-between"><span>STEP 02</span><span className="text-white">1v1 Assessment</span></div>
                  <div className="w-full h-px bg-white/10" />
                  <div className="flex justify-between"><span>STEP 03</span><span className="text-white">Scrim Trial (3 Days)</span></div>
                  <div className="w-full h-px bg-white/10" />
                  <div className="flex justify-between"><span>STEP 04</span><span className="text-white">Team Synergy Check</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="max-w-2xl mx-auto pb-32">
          <div className="bg-neutral-900 border border-gold/15 p-8 md:p-12 mb-12">
            <h3 className="font-bebas text-3xl text-gold mb-4 tracking-wider text-center">Track Your Journey</h3>
            <p className="text-neutral-500 text-xs text-center uppercase tracking-widest mb-8">Enter your Game UID or Application ID</p>
            
            <div className="flex gap-4">
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID: xY7z9... or UID: 5678..." 
                className="flex-1 bg-white/5 border border-gold/15 p-4 text-white focus:border-gold outline-none font-mono" 
              />
              <button 
                onClick={checkStatus}
                disabled={isSubmitting}
                className="bg-gold text-black px-8 font-black uppercase tracking-widest text-xs hover:bg-gold-light"
              >
                Search
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {trackResult.length > 0 ? (
              trackResult.map(res => (
                <div key={res.id} className="bg-white/5 border border-gold/20 p-8 relative">
                   <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-gold text-[10px] font-black uppercase tracking-widest mb-1">{res.game} Division</div>
                        <div className="font-bebas text-4xl text-white tracking-widest">{res.ign}</div>
                      </div>
                      <div className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] border ${
                        res.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                        res.status === 'accepted' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                        'bg-red-500/10 text-red-500 border-red-500/30'
                      }`}>
                        {res.status}
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-8 text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-t border-white/10 pt-6">
                      <div>
                        Application ID: <span className="text-white font-mono lowercase">{res.id}</span>
                      </div>
                      <div className="text-right">
                        Submitted: <span className="text-white">Recent</span>
                      </div>
                   </div>
                   {res.status === 'pending' && (
                     <div className="mt-8 p-4 bg-white/5 border border-white/5 text-[10px] text-neutral-400 italic">
                       * Your application is currently in the scout queue. Please wait at least 48 hours before requesting a follow-up.
                     </div>
                   )}
                </div>
              ))
            ) : (
              !isSubmitting && searchQuery && (
                <div className="text-center py-20 text-neutral-700 font-bebas text-2xl tracking-widest border border-dashed border-white/10">
                  Enter credentials search our records
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ManagementPage = ({ isAdmin, onNavigate }: { isAdmin?: boolean, onNavigate?: (p: Page) => void }) => (
  <div className="pt-24 container mx-auto px-4 min-h-screen">
    <SectionHeader tag="Professional Infrastructure" title="Business" goldSpan="Management" sub="We provide foundational support for teams, brands, and players in the Indian eSports ecosystem." />
    
    {isAdmin && onNavigate && (
      <div className="bg-gold/10 border-2 border-gold border-dashed p-6 mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
           <div className="text-gold font-black uppercase tracking-widest text-xs mb-1">Authenticated Administrator Detected</div>
           <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-tighter">You have elevated access to the BTS configuration terminal.</div>
        </div>
        <button 
          onClick={() => onNavigate('admin')}
          className="btn-clip bg-gold text-black px-10 py-3 font-black uppercase tracking-widest hover:bg-gold-light shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all"
        >
          Open Admin Portal
        </button>
      </div>
    )}
    
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
      {[
        { icon: <Trophy />, title: 'Tournament Hosting', desc: 'Secure, bracket-managed tournament execution with live broadcast support.' },
        { icon: <Users />, title: 'Team Management', desc: 'Full roster logic, scheduling, and performance analytics for pro teams.' },
        { icon: <Briefcase />, title: 'Sponsorship Handling', desc: 'Connecting brands with hyper-engaged young demographic through gaming.' },
        { icon: <TrendingUp />, title: 'Player Branding', desc: 'Content strategy, social media management, and growth consultation.' },
        { icon: <Globe />, title: 'Social Media Mgmt', desc: 'Dedicated editors and managers for YouTube, Instagram, and Discord.' },
        { icon: <Smartphone />, title: 'Scrim Network', desc: 'Exclusive access to Tier 1 scrim lobbies and practice networks.' },
      ].map((s, i) => (
        <div key={i} className="bg-neutral-900 border border-gold/10 p-8 group hover:border-gold/30 transition-all">
          <div className="text-gold mb-6 group-hover:scale-110 transition-transform">{s.icon}</div>
          <h4 className="font-bebas text-2xl text-gold mb-2 tracking-widest">{s.title}</h4>
          <p className="text-neutral-500 text-sm leading-relaxed">{s.desc}</p>
        </div>
      ))}
    </div>

    <div className="bg-neutral-900 border border-gold/15 p-8 md:p-16 grid lg:grid-cols-[1.5fr_1fr] gap-12 items-center">
      <div>
        <h2 className="font-bebas text-5xl text-white mb-6">Partner with <span className="text-gold">BTS eSports</span></h2>
        <p className="text-neutral-400 text-base leading-relaxed mb-8 max-w-xl">
          Leverage our network of competitive players and highly active gaming community. We provide end-to-end partnership activations that deliver real value to brands.
        </p>
        <div className="flex gap-4 mb-8">
          <button className="btn-clip bg-gold text-black px-6 py-3 text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Download size={14}/> Media Kit
          </button>
          <button className="btn-clip border border-gold text-gold px-6 py-3 text-xs font-black uppercase tracking-widest">
            Partner Inquiries
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { val: '40+', lbl: 'Active Pro Players' },
            { val: '10K+', lbl: 'Social Reach' },
            { val: '30+', lbl: 'Events Hosted' },
            { val: '5', lbl: 'Game Titles' },
          ].map((stat, i) => (
            <div key={i} className="text-center p-4 bg-white/5 border border-white/5">
              <span className="block font-orbitron font-black text-gold text-xl">{stat.val}</span>
              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">{stat.lbl}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-black/50 border border-gold/20 p-8">
         <h4 className="font-bebas text-xl text-gold mb-6 tracking-widest">Quick Enquiry</h4>
         <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Brand Name</label>
              <input type="text" className="w-full bg-white/5 border border-gold/15 p-2.5 text-sm text-white focus:border-gold outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Budget Range</label>
              <select className="w-full bg-white/5 border border-gold/15 p-2.5 text-sm text-white focus:border-gold outline-none appearance-none">
                <option>₹10,000 – ₹50,000</option>
                <option>₹50,000 – ₹2,00,000</option>
                <option>Unlimited</option>
              </select>
            </div>
            <button className="btn-clip bg-gold text-black w-full py-3 text-xs font-black uppercase tracking-widest mt-2 hover:bg-gold-light">
              Send Message
            </button>
         </div>
      </div>
    </div>
  </div>
);

const AboutPage = () => (
  <div className="pt-24 container mx-auto px-4 min-h-screen">
    <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
      <div>
        <span className="text-neon-red text-[11px] font-bold tracking-[0.4em] uppercase block mb-3 font-orbitron">Our Legacy</span>
        <h1 className="font-bebas text-7xl md:text-8xl leading-none text-gold mb-8">BTS<br/><span className="text-white">eSports</span></h1>
        <div className="space-y-4 text-neutral-400 leading-relaxed text-base md:text-lg">
          <p>
            BTS eSports is a performance-driven gaming organization founded in 2023 with a mission to identify and cultivate elite talent in India.
          </p>
          <p>
            What started as a single BGMI roster has evolved into a multi-divisional power infrastructure, representing professional standards in team coordination, strategy, and mental fortitude.
          </p>
          <p>
            We believe that eSports is an engine for growth, requiring the same level of discipline and dedication as traditional athletics. Every player who wears our colors is chosen for their character as much as their skills.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { color: 'border-gold', val: '2023', lbl: 'Founded' },
          { color: 'border-neon-red', val: '5', lbl: 'Divisions' },
          { color: 'border-gold', val: '40+', lbl: 'Pro Roster' },
          { color: 'border-neon-red', val: 'ALL', lbl: 'India Presence' },
        ].map((item, i) => (
          <div key={i} className={`bg-neutral-900 border ${item.color} border-t-4 p-8 text-center`}>
            <div className="font-bebas text-5xl text-white mb-2">{item.val}</div>
            <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{item.lbl}</div>
          </div>
        ))}
      </div>
    </div>

    <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent mb-24" />

    <SectionHeader tag="Foundational Code" title="Core" goldSpan="Values" />
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-24">
      {[
        { icon: '⚔️', title: 'Discipline', desc: 'Practice consistency is non-negotiable for all players.' },
        { icon: '🔥', title: 'Passion', desc: 'Gaming is our life, not just our job.' },
        { icon: '🏆', title: 'Excellence', desc: 'Every tournament entry is a commitment to victory.' },
        { icon: '🤝', title: 'Brotherhood', desc: 'We operate as a single unit, supporting every teammate.' },
        { icon: '📈', title: 'Growth', desc: 'Constant analysis and evolution of our strategies.' },
        { icon: '🌍', title: 'Nationhood', desc: 'Representing India with pride on the global stage.' },
      ].map((v, i) => (
        <div key={i} className="bg-neutral-900 border border-gold/10 p-8 border-t-2 border-t-gold text-center hover:bg-gold/5 transition-all">
          <div className="text-3xl mb-4">{v.icon}</div>
          <h4 className="font-bebas text-xl text-gold mb-2 tracking-widest">{v.title}</h4>
          <p className="text-xs text-neutral-500 leading-relaxed">{v.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

const SignInPage = ({ onToast, user, isAdmin, onNavigate }: { onToast: (t: string, m: string) => void, user: User | null, isAdmin?: boolean, onNavigate?: (p: Page) => void }) => {
  const [role, setRole] = useState<'player' | 'admin' | 'super'>('player');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onToast('Login Success', 'Welcome back to the portal.');
    } catch (error: any) {
      onToast('Login Error', error.message || 'Failed to sign in');
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // Generate a unique system ID for the user
      const systemId = `BTS-OP-${Math.floor(1000 + Math.random() * 9000)}`;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        ign: 'Operative',
        systemId: systemId,
        role: 'User',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      onToast('Account Created', `Registration successful. Your System ID is ${systemId}`);
    } catch (error: any) {
      onToast('Registration Error', error.message || 'Failed to create account');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user document already exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      const systemId = userDoc.exists() && userDoc.data().systemId 
        ? userDoc.data().systemId 
        : `BTS-OP-${Math.floor(1000 + Math.random() * 9000)}`;

      const existingData = userDoc.exists() ? userDoc.data() : null;
      const initialRole = existingData?.role || 'User';
      const initialCreatedAt = existingData?.createdAt || serverTimestamp();

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        ign: existingData?.ign || (user.displayName || 'Operative'),
        systemId: systemId,
        role: initialRole,
        updatedAt: serverTimestamp(),
        createdAt: initialCreatedAt
      }, { merge: true });

      onToast('Login Success', `Welcome back, ${user.displayName || 'Operative'}!`);
    } catch (error: any) {
      console.error("Google Login Error:", error);
      if (error.code === 'auth/popup-blocked') {
        onToast('Popup Blocked', 'Please enable popups for this site to sign in with Google.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore user cancellation
      } else {
        onToast('Login Error', error.message || 'Failed to sign in with Google');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onToast('Signed Out', 'You have been successfully signed out.');
    } catch (error: any) {
      onToast('Error', 'Failed to sign out');
    }
  };

  const [userRegs, setUserRegs] = useState<any[]>([]);
  const [userApps, setUserApps] = useState<any[]>([]);
  const [userData, setUserData] = useState<any | null>(null);
  const [squadProfile, setSquadProfile] = useState<any | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamCodeInput, setTeamCodeInput] = useState('');

  // Edit Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    ign: '',
    role: 'Assaulter',
    division: '',
    kd: 0,
    matches: 0
  });

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const rQuery = query(collectionGroup(db, 'registrations'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
      const aQuery = query(collection(db, 'applications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
      const sQuery = query(collection(db, 'squad'), where('uid', '==', user.uid), limit(1));
      
      let rSnap, aSnap, sSnap;
      try {
        [rSnap, aSnap, sSnap] = await Promise.all([
          getDocs(rQuery), 
          getDocs(aQuery),
          getDocs(sQuery)
        ]);
      } catch (err) {
        reportFirestoreError(err, 'get', 'multiple/user_data', onToast);
        return;
      }
      
      setUserRegs(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setUserApps(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      if (!sSnap.empty) {
        setSquadProfile({ id: sSnap.docs[0].id, ...sSnap.docs[0].data() });
      }

      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (err) {
        reportFirestoreError(err, 'get', `users/${user.uid}`, onToast);
        return;
      }

      const uData = userDoc.data();
      if (uData) {
        setUserData({ id: userDoc.id, ...uData });
        setProfileForm({
          ign: uData.ign || '',
          role: uData.role || 'Assaulter',
          division: uData.division || '',
          kd: uData.kd || 0,
          matches: uData.matches || 0
        });
      }
      let currentTeamId = uData?.teamId;

      if (!currentTeamId) {
        try {
          const ownerQuery = query(collection(db, 'teams'), where('ownerUid', '==', user.uid), limit(1));
          const ownerSnap = await getDocs(ownerQuery);
          if (!ownerSnap.empty) {
            currentTeamId = ownerSnap.docs[0].id;
          }
        } catch (err) {
          reportFirestoreError(err, 'list', 'teams', onToast);
        }
      }

      if (currentTeamId) {
        try {
          const teamDoc = await getDoc(doc(db, 'teams', currentTeamId));
          if (teamDoc.exists()) {
            setTeam({ id: teamDoc.id, ...teamDoc.data() });
            const mSnap = await getDocs(collection(db, `teams/${currentTeamId}/members`));
            setTeamMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } catch (err) {
          reportFirestoreError(err, 'get', `teams/${currentTeamId}`, onToast);
        }
      }
    } catch (error) {
      console.error("Critical error in fetchUserData:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      setUserRegs([]);
      setUserApps([]);
      setTeam(null);
      setTeamMembers([]);
      setLoading(true);
    }
  }, [user]);

  const handleCreateTeam = async () => {
    if (!user || !newTeamName) return;
    setIsCreatingTeam(true);
    try {
      const teamCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamRef = await addDoc(collection(db, 'teams'), {
        name: newTeamName,
        code: teamCode,
        ownerUid: user.uid,
        verified: false,
        isVisible: true,
        isRecruiting: false,
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, `teams/${teamRef.id}/members`, user.uid), {
        uid: user.uid,
        teamId: teamRef.id,
        ign: user.displayName || 'Owner',
        role: 'Owner',
        joinedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', user.uid), {
        teamId: teamRef.id,
        teamName: newTeamName
      });

      onToast('Team Created', `${newTeamName} has been established.`);
      fetchUserData();
    } catch (error) {
      reportFirestoreError(error, 'create', 'teams', onToast);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...profileForm,
        updatedAt: serverTimestamp()
      });
      setIsEditModalOpen(false);
      onToast('Clearance Updated', 'Your competitive identity has been synchronized.');
      fetchUserData();
    } catch (error) {
      reportFirestoreError(error, 'write', 'users', onToast);
    }
  };

  const handleJoinTeam = async () => {
    if (!user || !teamCodeInput) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'teams'), where('code', '==', teamCodeInput.trim().toUpperCase()), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        onToast('Invalid Code', 'No organization found with this clearance code.');
        return;
      }

      const targetTeam = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

      const memberRef = doc(db, `teams/${targetTeam.id}/members`, user.uid);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        onToast('Access Denied', 'Already a registered member.');
        return;
      }

      await setDoc(memberRef, {
        uid: user.uid,
        teamId: targetTeam.id,
        ign: profileForm.ign || user.displayName || 'Operative',
        role: 'Member',
        joinedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', user.uid), {
        teamId: targetTeam.id,
        teamName: targetTeam.name
      });

      onToast('Clearance Granted', `Welcome to ${targetTeam.name}.`);
      setTeamCodeInput('');
      fetchUserData();
    } catch (error) {
      reportFirestoreError(error, 'write', 'teams/members', onToast);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!user || !team) return;
    if (team.ownerUid === user.uid) {
      onToast('Restricted', 'Owners cannot leave. Disband instead.');
      return;
    }
    
    if (!window.confirm('Leave this organization?')) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, `teams/${team.id}/members`, user.uid));
      await updateDoc(doc(db, 'users', user.uid), {
        teamId: null,
        teamName: null
      });
      onToast('Defected', 'You have been removed from the roster.');
      setTeam(null);
      setTeamMembers([]);
      fetchUserData();
    } catch (error) {
      reportFirestoreError(error, 'delete', 'teams/members', onToast);
    } finally {
      setLoading(false);
    }
  };

  if (user) {

    return (
      <div className="pt-24 container mx-auto px-4 min-h-screen pb-24 flex items-center justify-center">
        <div className="max-w-md w-full">
          <SectionHeader tag="Authenticated" title="User" goldSpan="Account" sub={`System access granted as ${user.email}`} />
        
          <div className="bg-neutral-900 border border-gold/15 p-12 text-center relative overflow-hidden mt-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full -mr-16 -mt-16" />
            
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold to-neon-red mx-auto mb-8 flex items-center justify-center font-orbitron font-black text-3xl text-black border-2 border-gold/30 shadow-[0_0_20px_rgba(255,215,0,0.2)] relative z-10">
              {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <h3 className="font-bebas text-4xl text-white mb-2 tracking-widest">{user.displayName || (userData && userData.ign) || 'Operative'}</h3>
            <p className="text-neutral-500 text-xs mb-1 uppercase tracking-widest font-bold font-orbitron">{user.email}</p>
            <div className="flex flex-col items-center gap-2 mb-8">
               <div className="bg-gold/10 border border-gold/30 py-1 px-4 text-gold font-orbitron font-black text-xs uppercase tracking-widest">
                  {userData?.systemId || 'ID PENDING'}
               </div>
               <div className="bg-black/40 border border-white/5 py-1 px-3 inline-block rounded font-mono text-[9px] text-neutral-600 select-all cursor-copy" title="Protocol UID">
                  AUTH: {user.uid}
               </div>
            </div>
            
            <div className="space-y-4 text-left">
              {squadProfile && (
                <div className="bg-gold/5 border border-gold/20 p-6 text-left mb-6">
                  <div className="text-[10px] font-black text-gold uppercase tracking-[0.2em] mb-4">Professional Profile {squadProfile.squadNumber && `#${squadProfile.squadNumber}`}</div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Roster IGN</label>
                      <input 
                        value={squadProfile.ign || ''}
                        onChange={(e) => setSquadProfile({...squadProfile, ign: e.target.value})}
                        className="w-full bg-black/60 border border-white/10 p-3 text-xs text-white focus:border-gold outline-none" 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Instagram</label>
                        <input 
                          value={squadProfile.instagram || ''}
                          onChange={(e) => setSquadProfile({...squadProfile, instagram: e.target.value})}
                          placeholder="Link"
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Squad Number</label>
                        <input 
                          value={squadProfile.squadNumber || ''}
                          onChange={(e) => {
                            if (isAdmin) {
                              setSquadProfile({...squadProfile, squadNumber: e.target.value});
                            }
                          }}
                          disabled={!isAdmin}
                          placeholder="ID"
                          className={`w-full bg-black/60 border border-white/10 p-2 text-xs text-white focus:border-gold outline-none ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`} 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">YouTube</label>
                        <input 
                          value={squadProfile.youtube || ''}
                          onChange={(e) => setSquadProfile({...squadProfile, youtube: e.target.value})}
                          placeholder="Link"
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Discord</label>
                        <input 
                          value={squadProfile.discord || ''}
                          onChange={(e) => setSquadProfile({...squadProfile, discord: e.target.value})}
                          placeholder="ID"
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white focus:border-gold outline-none" 
                        />
                      </div>
                    </div>

                    <button 
                      onClick={async () => {
                        try {
                          const { id, ...p } = squadProfile;
                          // Use complete payload or ensure rules handle partial correctly
                          await updateDoc(doc(db, 'squad', id), {
                            ign: p.ign || '',
                            instagram: p.instagram || '',
                            youtube: p.youtube || '',
                            discord: p.discord || '',
                            squadNumber: p.squadNumber || '',
                            updatedAt: serverTimestamp()
                          });
                          onToast('Updated', 'Professional identity synchronized.');
                        } catch (err) {
                           console.error("Profile Update Error:", err);
                           reportFirestoreError(err, 'update', `squad/${squadProfile.id}`, onToast);
                        }
                      }}
                      className="w-full bg-white/5 border border-gold/40 text-gold py-3 text-[10px] font-black uppercase tracking-widest hover:bg-gold hover:text-black transition-all"
                    >
                      Update Member Info
                    </button>
                  </div>
                </div>
              )}

              {isAdmin && (
                <button 
                  onClick={() => onNavigate && onNavigate('admin')}
                  className="btn-clip bg-gold text-black w-full py-5 text-xs font-black uppercase tracking-widest hover:bg-gold-light shadow-[0_0_30px_rgba(212,175,55,0.4)] border-none transition-all flex items-center justify-center gap-2"
                >
                  🚀 DEPLOYMENT PORTAL
                </button>
              )}
              
              <button 
                onClick={() => onNavigate && onNavigate('tournament')}
                className="btn-clip border border-gold/30 text-gold w-full py-4 text-xs font-black uppercase tracking-widest hover:bg-gold/10 transition-all font-orbitron"
              >
                Return to Events
              </button>

              <button 
                onClick={handleSignOut}
                className="w-full py-4 text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] hover:text-neon-red transition-colors mt-8"
              >
                Sign Out / Disconnect
              </button>
            </div>
          </div>





        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 container mx-auto px-4 min-h-screen">
      <SectionHeader tag="Authentication" title="Member" goldSpan="Login" sub="Access your secure organizational portal." />
      
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            { id: 'player', icon: <Gamepad2 />, title: 'Player', desc: 'View stats & wallet' },
            { id: 'admin', icon: <Trophy />, title: 'Admin', desc: 'Manage tournaments' },
            { id: 'super', icon: <Settings />, title: 'Super Admin', desc: 'Platform Control' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id as any)}
              className={`p-6 border-2 transition-all flex flex-col items-center text-center ${
                role === r.id ? 'bg-gold/5 border-gold shadow-[0_0_15px_rgba(255,215,0,0.1)]' : 'bg-neutral-900 border-gold/10 hover:border-gold/30'
              }`}
            >
              <div className="text-gold mb-3 opacity-80">{r.icon}</div>
              <h5 className="font-bebas text-lg text-white mb-1 tracking-wider">{r.title}</h5>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{r.desc}</p>
            </button>
          ))}
        </div>

        <div className="bg-neutral-900 border border-gold/15 p-12 max-w-md mx-auto relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-gold opacity-10" />
          <h3 className="font-bebas text-3xl text-gold mb-8 tracking-widest text-center">Portal Access</h3>
          
          <div className="space-y-6">
            <button 
              onClick={handleGoogleLogin}
              className="btn-clip bg-white text-black w-full py-4 text-xs font-black uppercase tracking-widest hover:bg-neutral-200 transition-all flex items-center justify-center gap-3"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Sign in with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-neutral-900 px-2 text-neutral-600">Or use {isRegistering ? 'registration' : 'identifier'}</span></div>
            </div>

            <form onSubmit={isRegistering ? handleEmailRegister : handleEmailLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@organization.com" 
                  className="w-full bg-white/5 border border-gold/15 p-3 text-sm focus:border-gold outline-none" 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Security Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-white/5 border border-gold/15 p-3 text-sm focus:border-gold outline-none" 
                  required
                />
              </div>
              <button type="submit" className="btn-clip bg-gold text-black w-full py-4 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                {isRegistering ? 'Create Account' : 'Member Sign In'}
              </button>
            </form>

            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-[10px] text-neutral-500 font-bold uppercase tracking-widest hover:text-gold transition-colors"
            >
              {isRegistering ? 'Already have credentials? Login' : 'New operative? Register center'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



const TournamentPage = ({ onToast, user, onNavigate }: { onToast: (t: string, m: string) => void, user: User | null, onNavigate: (p: Page, d?: any) => void }) => {
  const [dbTournaments, setDbTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTournaments = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
      setDbTournaments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  return (
    <div className="pt-24 container mx-auto px-4 min-h-screen">
      <SectionHeader tag="Competitive" title="Active" goldSpan="Tournaments" sub="Register now to compete. All matches are held on official servers." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gold animate-pulse font-bold tracking-widest text-xs">Syncing with server...</div>
        ) : dbTournaments.length === 0 ? (
          <div className="col-span-full text-center py-20 text-neutral-600 uppercase tracking-widest text-xs">No active tournaments discovered</div>
        ) : (
          dbTournaments.map((t) => (
            <TournamentCard 
              key={t.id} 
              tournament={{
                id: t.id,
                name: t.name,
                game: t.game,
                prize: t.prize || 'TBD',
                slots: t.slots || 0,
                total: t.total || 0,
                status: t.status as any,
                date: t.date || 'Upcoming',
                imageUrl: t.imageUrl || ''
              }} 
              onToast={onToast} 
              user={user}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
};

const ResultsPage = ({ onToast, isAdmin }: { onToast: (t: string, m: string) => void, isAdmin?: boolean }) => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'results'), orderBy('createdAt', 'desc')));
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Admin: Remove this result from Hall of Fame?')) return;
    try {
      await deleteDoc(doc(db, 'results', id));
      onToast('Removed', 'Result deleted.');
      fetchResults();
    } catch (e) {
      onToast('Error', 'Failed to delete result');
    }
  };

  return (
    <div className="pt-24 container mx-auto px-4 min-h-screen">
      <SectionHeader tag="Hall of Fame" title="Tournament" goldSpan="Results" sub="Celebrating our organization's champions and top performers." />
      
      {loading ? (
        <div className="text-center py-20 text-gold font-orbitron animate-pulse">Syncing Hall of Fame...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-24">
          {results.length === 0 ? (
            <div className="col-span-full text-center py-32 bg-white/5 border border-white/10 rounded-sm">
              <Skull className="mx-auto text-neutral-800 mb-4" size={64} />
              <div className="text-neutral-500 font-bebas text-2xl tracking-widest uppercase">No verified results archived yet</div>
            </div>
          ) : (
            results.map((res) => (
              <motion.div 
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-neutral-900 border border-gold/15 p-8 relative overflow-hidden group hover:border-gold/40 transition-all"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 -rotate-45 translate-x-12 -translate-y-12 pointer-events-none" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-[10px] font-bold text-gold tracking-widest uppercase mb-1 font-orbitron">{res.game}</div>
                    <h3 className="font-bebas text-3xl text-white tracking-wide">{res.tournamentName}</h3>
                  </div>
                  <div className="bg-gold text-black px-3 py-1 font-orbitron font-black text-sm rounded-sm">
                    RANK #{res.rank}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-6">
                  <div>
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em] mb-1">Squad</span>
                    <span className="block font-bebas text-2xl text-white tracking-widest">{res.teamName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em] mb-1">Earnings</span>
                    <span className="block font-bebas text-2xl text-gold tracking-widest">{res.prizeWon}</span>
                  </div>
                </div>

                {res.pointsTableUrl && (
                  <div className="mt-6 border border-gold/10 overflow-hidden bg-black/40">
                    <div className="p-2 border-b border-gold/10 flex justify-between items-center">
                       <span className="text-[9px] font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                         Match Points Table
                       </span>
                    </div>
                    <img 
                      src={getSafeImageUrl(res.pointsTableUrl)} 
                      alt="Match Points Table" 
                      className="w-full h-auto object-cover opacity-80 hover:opacity-100 transition-opacity" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                
                <div className="flex justify-between items-end border-t border-white/5 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-orbitron font-black text-xs">MVP</div>
                    <div>
                      <span className="block text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Most Valuable Player</span>
                      <span className="block font-bold text-white text-sm">{res.mvp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(res.id)}
                        className="p-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors"
                        title="Delete Result"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div className="text-[10px] text-neutral-600 font-medium font-orbitron uppercase tracking-tighter italic">
                      Verified Match Result
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <ShareMenu 
                    title={`Check out ${res.teamName}'s Rank #${res.rank} victory in ${res.tournamentName}!`} 
                    url={`${window.location.origin}/results/${res.id}`} 
                    onToast={onToast} 
                  />
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ onToast, adminRole, user }: { onToast: (t: string, m: string) => void, adminRole: string | null, user: User | null }) => {
  const [activeTab, setActiveTab] = useState<'tournaments' | 'applications' | 'results' | 'highlights' | 'squad' | 'scrims' | 'registrations' | 'divisions' | 'users' | 'admins' | 'stats' | 'live' | 'achievements' | 'settings'>('tournaments');
  const [squad, setSquad] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [scrims, setScrims] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedTournamentForRegs, setSelectedTournamentForRegs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null);
  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null);
  const [editingAchievementId, setEditingAchievementId] = useState<string | null>(null);
  
  const [matchStatForm, setMatchStatForm] = useState({
    playerId: '',
    matchType: 'scrim' as 'scrim' | 'tournament' | 'open_room',
    kills: '0',
    matchBrief: ''
  });
  const [resultForm, setResultForm] = useState({
    tournamentId: '',
    teamName: '',
    rank: '1',
    prizeWon: '',
    mvp: '',
    pointsTableUrl: ''
  });
  const [divisionForm, setDivisionForm] = useState({
    key: '',
    name: '',
    desc: '',
    badgeColor: '#FFD700',
    badge: 'rgba(255,215,0,0.15)',
    badgeBorder: 'rgba(255,215,0,0.4)',
    colorClass: 'c-prime'
  });
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    game: 'BGMI',
    prize: '',
    total: '20',
    status: 'open',
    date: '',
    imageUrl: '',
    discordLink: '',
    instagramLink: '',
    youtubeLink: ''
  });
  const [highlightForm, setHighlightForm] = useState({
    title: '',
    tag: '',
    thumb: '',
    date: ''
  });
  const [achievementForm, setAchievementForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    date: '',
    game: 'BGMI',
    division: 'prime'
  });
  const [squadForm, setSquadForm] = useState({
    ign: '',
    role: 'Assaulter',
    div: 'prime',
    scrimsKills: '0',
    scrimsMatches: '0',
    tourneyKills: '0',
    tourneyMatches: '0',
    openRoomKills: '0',
    openRoomMatches: '0',
    achievements: '',
    uid: '',
    status: 'Active',
    instagram: '',
    youtube: '',
    discord: '',
    squadNumber: '',
    game: 'BGMI'
  });

  const availableTabs = [
    { id: 'tournaments', roles: ['Super Admin', 'Tournament Manager'] },
    { id: 'registrations', roles: ['Super Admin', 'Tournament Manager'] },
    { id: 'results', roles: ['Super Admin', 'Tournament Manager'] },
    { id: 'stats', roles: ['Super Admin', 'Tournament Manager', 'Head Scout'] },
    { id: 'live', roles: ['Super Admin', 'Content Moderator'] },
    { id: 'highlights', roles: ['Super Admin', 'Content Moderator'] },
    { id: 'achievements', roles: ['Super Admin', 'Content Moderator'] },
    { id: 'scrims', roles: ['Super Admin', 'Content Moderator'] },
    { id: 'divisions', roles: ['Super Admin', 'Content Moderator'] },
    { id: 'applications', roles: ['Super Admin', 'Head Scout'] },
    { id: 'squad', roles: ['Super Admin', 'Head Scout'] },
    { id: 'users', roles: ['Super Admin', 'Head Scout', 'Tournament Manager'] },
    { id: 'admins', roles: ['Super Admin'] },
    { id: 'settings', roles: ['Super Admin'] },
  ];

  const filteredTabs = availableTabs.filter(tab => tab.roles.includes(adminRole || ''));

  useEffect(() => {
    if (filteredTabs.length > 0 && !filteredTabs.find(t => t.id === activeTab)) {
      setActiveTab(filteredTabs[0].id as any);
    }
  }, [adminRole]);

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedTournamentForRegs]);

  const startEditing = (t: any) => {
    setEditingTournamentId(t.id);
    setTournamentForm({
      name: t.name || '',
      game: t.game || 'BGMI',
      prize: t.prize || '',
      total: String(t.total || '20'),
      status: t.status || 'open',
      date: t.date || '',
      imageUrl: t.imageUrl || '',
      discordLink: t.discordLink || '',
      instagramLink: t.instagramLink || '',
      youtubeLink: t.youtubeLink || ''
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditingResult = (r: any) => {
    setEditingResultId(r.id);
    setResultForm({
      tournamentId: r.tournamentId || '',
      teamName: r.teamName || '',
      rank: String(r.rank || '1'),
      prizeWon: r.prizeWon || '',
      mvp: r.mvp || '',
      pointsTableUrl: r.pointsTableUrl || ''
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditingHighlight = (h: any) => {
    setEditingHighlightId(h.id);
    setHighlightForm({
      title: h.title || '',
      tag: h.tag || '',
      thumb: h.thumb || '',
      date: h.date || ''
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditingSquad = (s: any) => {
    setEditingSquadId(s.id);
    setSquadForm({
      ign: s.ign || '',
      role: s.role || 'Assaulter',
      div: s.div || 'prime',
      scrimsKills: String(s.scrimsKills || '0'),
      scrimsMatches: String(s.scrimsMatches || '0'),
      tourneyKills: String(s.tourneyKills || '0'),
      tourneyMatches: String(s.tourneyMatches || '0'),
      openRoomKills: String(s.openRoomKills || '0'),
      openRoomMatches: String(s.openRoomMatches || '0'),
      achievements: Array.isArray(s.achievements) ? s.achievements.join(', ') : (s.achievements || ''),
      uid: s.uid || '',
      status: s.status || 'Active',
      instagram: s.instagram || '',
      youtube: s.youtube || '',
      discord: s.discord || '',
      squadNumber: s.squadNumber || '',
      game: s.game || 'BGMI'
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditingDivision = (d: any) => {
    setEditingDivisionId(d.id);
    setDivisionForm({
      key: d.key || '',
      name: d.name || '',
      desc: d.desc || '',
      badgeColor: d.badgeColor || '#FFD700',
      badge: d.badge || 'rgba(255,215,0,0.15)',
      badgeBorder: d.badgeBorder || 'rgba(255,215,0,0.4)',
      colorClass: d.colorClass || 'c-prime'
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditingAchievement = (a: any) => {
    setEditingAchievementId(a.id);
    setAchievementForm({
      title: a.title || '',
      description: a.description || '',
      imageUrl: a.imageUrl || '',
      date: a.date || '',
      game: a.game || 'BGMI',
      division: a.division || 'prime'
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingTournamentId(null);
    setEditingResultId(null);
    setEditingHighlightId(null);
    setEditingSquadId(null);
    setEditingDivisionId(null);
    setEditingAchievementId(null);
    setTournamentForm({
      name: '',
      game: 'BGMI',
      prize: '',
      total: '20',
      status: 'open',
      date: '',
      imageUrl: '',
      discordLink: '',
      instagramLink: '',
      youtubeLink: ''
    });
    setResultForm({
      tournamentId: '',
      teamName: '',
      rank: '1',
      prizeWon: '',
      mvp: '',
      pointsTableUrl: ''
    });
    setHighlightForm({
      title: '',
      tag: '',
      thumb: '',
      date: ''
    });
    setAchievementForm({
      title: '',
      description: '',
      imageUrl: '',
      date: '',
      game: 'BGMI',
      division: 'prime'
    });
    setSquadForm({
      ign: '',
      role: 'Assaulter',
      div: 'prime',
      scrimsKills: '0',
      scrimsMatches: '0',
      tourneyKills: '0',
      tourneyMatches: '0',
      openRoomKills: '0',
      openRoomMatches: '0',
      achievements: '',
      uid: '',
      status: 'Active',
      instagram: '',
      youtube: '',
      discord: '',
      squadNumber: '',
      game: 'BGMI'
    });
    setDivisionForm({
      key: '',
      name: '',
      desc: '',
      badgeColor: '#FFD700',
      badge: 'rgba(255,215,0,0.15)',
      badgeBorder: 'rgba(255,215,0,0.4)',
      colorClass: 'c-prime'
    });
  };

  const [liveConfig, setLiveConfig] = useState<{ isLive: boolean, videoId: string, title: string }>({ isLive: false, videoId: '', title: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'live') {
        const docSnap = await getDoc(doc(db, 'site_config', 'youtube_live'));
        if (docSnap.exists()) {
          setLiveConfig(docSnap.data() as any);
        }
      } else if (activeTab === 'applications') {
        const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setApplications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'tournaments') {
        const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setTournaments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'results') {
        const q = query(collection(db, 'results'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const tSnap = await getDocs(query(collection(db, 'tournaments'), orderBy('name')));
        setTournaments(tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'highlights') {
        const q = query(collection(db, 'highlights'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setHighlights(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'achievements') {
        const q = query(collection(db, 'achievements'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setAchievements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'scrims') {
        const q = query(collection(db, 'scrims'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setScrims(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'squad') {
        const q = query(collection(db, 'squad'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setSquad(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const dSnap = await getDocs(query(collection(db, 'divisions'), orderBy('name')));
        setDivisions(dSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'divisions') {
        const q = query(collection(db, 'divisions'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setDivisions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'users') {
        const q = query(collection(db, 'users'), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'stats') {
        const q = query(collection(db, 'squad'), orderBy('ign'));
        const snap = await getDocs(q);
        setSquad(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'admins') {
        const q = query(collection(db, 'admins'), orderBy('email'));
        const snap = await getDocs(q);
        setAdmins(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'settings') {
        const sSnap = await getDoc(doc(db, 'site_config', 'social'));
        if (sSnap.exists()) {
          setSocialLinksForm(sSnap.data() as any);
        }
      } else if (activeTab === 'registrations') {
        const tSnap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
        const allTournaments = tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournaments(allTournaments);
        
        const targetTId = selectedTournamentForRegs || (allTournaments.length > 0 ? allTournaments[0].id : null);
        if (targetTId) {
          const q = query(collection(db, 'tournaments', targetTId, 'registrations'), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          setRegistrations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setSelectedTournamentForRegs(targetTId);
        }
      }
    } catch (error) {
      const errorPath = activeTab === 'live' ? 'site_config/youtube_live' : activeTab;
      const opType = (activeTab === 'live' || activeTab === 'highlights' || activeTab === 'scrims') ? 'get' : 'list';
      reportFirestoreError(error, opType as any, errorPath, onToast);
    } finally {
      setLoading(false);
    }
  };

  const [socialLinksForm, setSocialLinksForm] = useState({ youtube: '', instagram: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'site_config', 'social'), { ...socialLinksForm, updatedAt: serverTimestamp() }, { merge: true });
      onToast('Settings Saved', 'Social media configuration updated.');
    } catch (error) {
      reportFirestoreError(error, 'write', 'site_config/social', onToast);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const promoteToSquad = async (app: any) => {
    try {
      // Check if already in squad
      const q = query(collection(db, 'squad'), where('uid', '==', app.uid), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        onToast('Redundant', 'Member already in professional roster.');
        return;
      }

      await addDoc(collection(db, 'squad'), {
        uid: app.uid,
        ign: app.ign,
        role: app.role || 'Assaulter',
        div: 'prime',
        scrimsKills: 0,
        scrimsMatches: 0,
        tourneyKills: 0,
        tourneyMatches: 0,
        kd: '0.00',
        matches: 0,
        kills: 0,
        achievements: [],
        status: 'Active',
        squadNumber: '', // Can be edited later
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'applications', app.id), { status: 'promoted', updatedAt: serverTimestamp() });
      onToast('Promotion Complete', `${app.ign} added to Squad.`);
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'create', 'squad', onToast);
    }
  };

  const [actingUserId, setActingUserId] = useState<string | null>(null);

  const demoteFromSquad = async (user: any) => {
    try {
      setActingUserId(user.id);
      if (!confirm(`Are you sure you want to remove ${user.ign || 'this user'} from the Professional Roster? This will delete their squad profile but keep their user account.`)) {
        setActingUserId(null);
        return;
      }

      const q = query(collection(db, 'squad'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      snap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      batch.update(doc(db, 'users', user.id), { 
        role: 'User', 
        updatedAt: serverTimestamp() 
      });

      await batch.commit();
      
      onToast('Tactical Demotion', `${user.ign} has been returned to standard User status.`);
      fetchData();
    } catch (error) {
      console.error("Demotion Error:", error);
      reportFirestoreError(error, 'delete', 'squad', onToast);
    } finally {
      setActingUserId(null);
    }
  };

  const promoteToSquadFromUser = async (user: any) => {
    try {
      setActingUserId(user.id);
      const q = query(collection(db, 'squad'), where('uid', '==', user.uid), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        onToast('Redundant', 'This user is already a professional member.');
        setActingUserId(null);
        return;
      }

      const squadRef = doc(collection(db, 'squad'));
      const batch = writeBatch(db);

      batch.set(squadRef, {
        uid: user.uid,
        ign: user.ign || 'New Operative',
        role: 'Assaulter',
        div: 'prime',
        scrimsKills: 0,
        scrimsMatches: 0,
        tourneyKills: 0,
        tourneyMatches: 0,
        kd: '0.00',
        matches: 0,
        kills: 0,
        achievements: [],
        status: 'Active',
        systemId: user.systemId || `BTS-OP-${Math.floor(1000 + Math.random() * 9000)}`,
        squadNumber: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.update(doc(db, 'users', user.id), { 
        role: 'Squad Member', 
        updatedAt: serverTimestamp() 
      });

      await batch.commit();
      onToast('Tactical Promotion', `${user.ign} has been inducted into the Squad.`);
      fetchData();
    } catch (error) {
      console.error("Promotion Error:", error);
      reportFirestoreError(error, 'create', 'squad', onToast);
    } finally {
      setActingUserId(null);
    }
  };

  const updateAppStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'applications', id), { status, updatedAt: serverTimestamp() });
      onToast('Success', `Application ${status}`);
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'update', `applications/${id}`, onToast);
    }
  };

  const deleteAllApplications = async () => {
    if (!confirm('DANGER: This will permanently delete ALL recruitment applications. Proceed?')) return;
    try {
      const snap = await getDocs(collection(db, 'applications'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      onToast('Wiped', 'All applications have been cleared.');
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'delete', 'applications', onToast);
    }
  };

  const deleteApplication = async (id: string) => {
    if (!confirm('Permanently delete this application?')) return;
    try {
      console.log(`Attempting to delete application: ${id}`);
      await deleteDoc(doc(db, 'applications', id));
      onToast('Deleted', 'Application removed.');
      fetchData();
    } catch (error) {
      console.error("Delete Error:", error);
      onToast('Error', 'Insufficient permissions to delete.');
      reportFirestoreError(error, 'delete', `applications/${id}`, onToast);
    }
  };

  const deleteTournament = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;
    try {
      console.log(`Attempting to delete tournament: ${id}`);
      await deleteDoc(doc(db, 'tournaments', id));
      onToast('Deleted', 'Tournament removed from system.');
      fetchData();
    } catch (error) {
      console.error("Delete Error:", error);
      onToast('Error', 'Insufficient permissions to delete.');
      reportFirestoreError(error, 'delete', `tournaments/${id}`, onToast);
    }
  };

  const submitDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divisionForm.name || !divisionForm.key) {
      onToast('Error', 'Name and Key are required.');
      return;
    }

    try {
      const payload = {
        ...divisionForm,
        key: divisionForm.key.toLowerCase(),
        updatedAt: serverTimestamp()
      };

      if (editingDivisionId) {
        await updateDoc(doc(db, 'divisions', editingDivisionId), payload);
        onToast('Updated', 'Division configuration saved.');
      } else {
        await addDoc(collection(db, 'divisions'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        onToast('Success', 'New dynamic division added to the grid.');
      }

      cancelForm();
      fetchData();
    } catch (error) {
      reportFirestoreError(error, editingDivisionId ? 'update' : 'create', 'divisions', onToast);
    }
  };

  const deleteDivision = async (id: string) => {
    if (!confirm('Permanently decommission this division? All linked players will remain but their division assignment may break.')) return;
    try {
      await deleteDoc(doc(db, 'divisions', id));
      onToast('Decommissioned', 'Division removed from organization.');
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'delete', `divisions/${id}`, onToast);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    // Get headers from first object
    const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt').join(',');
    const rows = data.map(obj => 
      Object.keys(data[0])
        .filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt')
        .map(k => {
          const val = obj[k] === null || obj[k] === undefined ? '' : String(obj[k]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submitTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentForm.name || !tournamentForm.prize) {
      onToast('Error', 'Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        ...tournamentForm,
        slots: Number(tournamentForm.total),
        total: Number(tournamentForm.total),
        updatedAt: serverTimestamp()
      };

      if (editingTournamentId) {
        await updateDoc(doc(db, 'tournaments', editingTournamentId), payload);
        onToast('Updated', 'Tournament details saved.');
      } else {
        await addDoc(collection(db, 'tournaments'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        onToast('Created', 'New tournament added successfully.');
      }

      cancelForm();
      fetchData();
    } catch (error) {
      reportFirestoreError(error, editingTournamentId ? 'update' : 'create', 'tournaments', onToast);
    }
  };

  const submitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultForm.tournamentId || !resultForm.teamName) {
      onToast('Error', 'Tournament and Team name are required.');
      return;
    }

    try {
      const selectedT = tournaments.find(t => t.id === resultForm.tournamentId);
      const payload = {
        ...resultForm,
        tournamentName: selectedT?.name || 'Unknown Tournament',
        game: selectedT?.game || 'Unknown Game',
        rank: Number(resultForm.rank),
        updatedAt: serverTimestamp()
      };

      if (editingResultId) {
        await updateDoc(doc(db, 'results', editingResultId), payload);
        onToast('Updated', 'Match result updated successfully.');
      } else {
        await addDoc(collection(db, 'results'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        onToast('Success', 'Result archived in Hall of Fame.');
      }

      cancelForm();
      fetchData();
    } catch (error) {
      reportFirestoreError(error, editingResultId ? 'update' : 'create', 'results', onToast);
    }
  };

  const deleteResult = async (id: string) => {
    if (!confirm('Are you sure you want to remove this result?')) return;
    try {
      console.log(`Attempting to delete result: ${id}`);
      await deleteDoc(doc(db, 'results', id));
      onToast('Deleted', 'Result removed from Hall of Fame.');
      fetchData();
    } catch (error) {
      console.error("Delete Error:", error);
      onToast('Error', 'Insufficient permissions to delete.');
      reportFirestoreError(error, 'delete', `results/${id}`, onToast);
    }
  };

  const submitHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightForm.title || !highlightForm.thumb) {
      onToast('Error', 'Title and Thumbnail are required.');
      return;
    }

    try {
      const payload = {
        ...highlightForm,
        updatedAt: serverTimestamp()
      };

      if (editingHighlightId) {
        await updateDoc(doc(db, 'highlights', editingHighlightId), payload);
        onToast('Updated', 'Highlight updated.');
      } else {
        await addDoc(collection(db, 'highlights'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        onToast('Success', 'Highlight published.');
      }

      cancelForm();
      fetchData();
    } catch (error) {
      reportFirestoreError(error, editingHighlightId ? 'update' : 'create', 'highlights', onToast);
    }
  };

  const deleteHighlight = async (id: string) => {
    if (!confirm('Permanently remove this highlight?')) return;
    try {
      console.log(`Attempting to delete highlight: ${id}`);
      await deleteDoc(doc(db, 'highlights', id));
      onToast('Deleted', 'Highlight removed.');
      fetchData();
    } catch (error) {
      console.error("Delete Error:", error);
      onToast('Error', 'Insufficient permissions to delete.');
      reportFirestoreError(error, 'delete', `highlights/${id}`, onToast);
    }
  };

  const submitAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!achievementForm.title || !achievementForm.imageUrl) {
      onToast('Error', 'Title and image URL are required.');
      return;
    }

    try {
      const payload = {
        ...achievementForm,
        updatedAt: serverTimestamp()
      };

      if (editingAchievementId) {
        await updateDoc(doc(db, 'achievements', editingAchievementId), payload);
        onToast('Updated', 'Achievement updated.');
      } else {
        await addDoc(collection(db, 'achievements'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        onToast('Success', 'Achievement added to gallery.');
      }

      cancelForm();
      fetchData();
    } catch (error) {
      reportFirestoreError(error, editingAchievementId ? 'update' : 'create', 'achievements', onToast);
    }
  };

  const deleteAchievement = async (id: string) => {
    if (!confirm('Permanently remove this achievement?')) return;
    try {
      await deleteDoc(doc(db, 'achievements', id));
      onToast('Deleted', 'Achievement removed.');
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'delete', `achievements/${id}`, onToast);
    }
  };

  const submitSquadMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadForm.ign) {
      onToast('Error', 'IGN is required.');
      return;
    }

    try {
      const sKills = parseInt(squadForm.scrimsKills) || 0;
      const sMatches = parseInt(squadForm.scrimsMatches) || 0;
      const tKills = parseInt(squadForm.tourneyKills) || 0;
      const tMatches = parseInt(squadForm.tourneyMatches) || 0;
      const oKills = parseInt(squadForm.openRoomKills) || 0;
      const oMatches = parseInt(squadForm.openRoomMatches) || 0;
      
      const totalKills = sKills + tKills + oKills;
      const totalMatches = sMatches + tMatches + oMatches;
      const calculatedKD = totalMatches > 0 ? (totalKills / totalMatches).toFixed(2) : '0.00';

      const payload: any = {
        ign: squadForm.ign,
        role: squadForm.role,
        div: squadForm.div,
        scrimsKills: sKills,
        scrimsMatches: sMatches,
        tourneyKills: tKills,
        tourneyMatches: tMatches,
        openRoomKills: oKills,
        openRoomMatches: oMatches,
        kd: calculatedKD,
        matches: totalMatches,
        kills: totalKills,
        achievements: squadForm.achievements.split(',').map(s => s.trim()).filter(s => s !== ''),
        uid: squadForm.uid,
        status: squadForm.status,
        instagram: squadForm.instagram,
        youtube: squadForm.youtube,
        discord: squadForm.discord,
        game: squadForm.game,
        updatedAt: serverTimestamp()
      };

      if (editingSquadId) {
        // Handle trend history
        const existingMember = squad.find(s => s.id === editingSquadId);
        if (existingMember) {
          const currentHistory = existingMember.kdHistory || [];
          // Only add to history if KD changed significantly or periodically
          // For simplicity, let's just append current calculated KD to history
          const newHistory = [...currentHistory, parseFloat(calculatedKD)].slice(-10); // Keep last 10
          payload.kdHistory = newHistory;
        }

        await updateDoc(doc(db, 'squad', editingSquadId), payload);
        onToast('Updated', 'Squad member profile synced.');
      } else {
        payload.kdHistory = [parseFloat(calculatedKD)];
        await addDoc(collection(db, 'squad'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        onToast('Enlisted', 'New member joined the squad.');
      }

      cancelForm();
      fetchData();
    } catch (error) {
      reportFirestoreError(error, editingSquadId ? 'update' : 'create', 'squad', onToast);
    }
  };

  const deleteSquadMember = async (id: string) => {
    if (!confirm('Terminate this operative from the official roster?')) return;
    try {
      await deleteDoc(doc(db, 'squad', id));
      onToast('Deleted', 'Operative removed from roster.');
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'delete', `squad/${id}`, onToast);
    }
  };

  const submitMatchStat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchStatForm.playerId) {
      onToast('Error', 'Please select a player.');
      return;
    }

    const player = squad.find(s => s.id === matchStatForm.playerId);
    if (!player) return;

    try {
      const killsToAdd = parseInt(matchStatForm.kills) || 0;
      
      let updateData: any = {};
      if (matchStatForm.matchType === 'scrim') {
        updateData.scrimsKills = (player.scrimsKills || 0) + killsToAdd;
        updateData.scrimsMatches = (player.scrimsMatches || 0) + 1;
      } else if (matchStatForm.matchType === 'tournament') {
        updateData.tourneyKills = (player.tourneyKills || 0) + killsToAdd;
        updateData.tourneyMatches = (player.tourneyMatches || 0) + 1;
      } else if (matchStatForm.matchType === 'open_room') {
        updateData.openRoomKills = (player.openRoomKills || 0) + killsToAdd;
        updateData.openRoomMatches = (player.openRoomMatches || 0) + 1;
      }

      // Calculate totals reliably
      const sk = updateData.scrimsKills !== undefined ? updateData.scrimsKills : (player.scrimsKills || 0);
      const sm = updateData.scrimsMatches !== undefined ? updateData.scrimsMatches : (player.scrimsMatches || 0);
      const tk = updateData.tourneyKills !== undefined ? updateData.tourneyKills : (player.tourneyKills || 0);
      const tm = updateData.tourneyMatches !== undefined ? updateData.tourneyMatches : (player.tourneyMatches || 0);
      const ok = updateData.openRoomKills !== undefined ? updateData.openRoomKills : (player.openRoomKills || 0);
      const om = updateData.openRoomMatches !== undefined ? updateData.openRoomMatches : (player.openRoomMatches || 0);

      const totalKills = sk + tk + ok;
      const totalMatches = sm + tm + om;

      updateData.kills = totalKills;
      updateData.matches = totalMatches;
      updateData.kd = totalMatches > 0 ? (totalKills / totalMatches).toFixed(2) : '0.00';
      updateData.updatedAt = serverTimestamp();

      const existingHistory = player.kdHistory || [];
      const newHistory = [...existingHistory, parseFloat(updateData.kd)].slice(-10);
      updateData.kdHistory = newHistory;

      await updateDoc(doc(db, 'squad', matchStatForm.playerId), updateData);
      
      onToast('Stats Synchronized', `${player.ign}'s combat log updated (+${killsToAdd} kills).`);
      setMatchStatForm({ ...matchStatForm, kills: '0', matchBrief: '' });
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'update', `squad/${matchStatForm.playerId}`, onToast);
    }
  };

  const updateLiveStatus = async (config: typeof liveConfig) => {
    try {
      await setDoc(doc(db, 'site_config', 'youtube_live'), {
        ...config,
        updatedAt: serverTimestamp()
      });
      setLiveConfig(config);
      onToast('Broadcast Synced', `Live status: ${config.isLive ? 'ON' : 'OFF'}`);
    } catch (error) {
      reportFirestoreError(error, 'write', 'site_config/youtube_live', onToast);
    }
  };

  const removeAdmin = async (id: string) => {
    if (id === user?.uid) {
      onToast('Error', 'Cannot revoke your own access.');
      return;
    }
    if (!confirm('Revoke all administrative access for this user?')) return;
    try {
      await deleteDoc(doc(db, 'admins', id));
      onToast('Access Revoked', 'Admin permissions purged from system.');
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'delete', `admins/${id}`, onToast);
    }
  };

  const [adminForm, setAdminForm] = useState({ uid: '', email: '', role: 'Tournament Manager' as any });

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.uid || !adminForm.email) {
      onToast('Error', 'UID and Email are required.');
      return;
    }
    try {
      await setDoc(doc(db, 'admins', adminForm.uid), {
        ...adminForm,
        updatedAt: serverTimestamp()
      });
      onToast('Permission Granted', 'New administrative access level configured.');
      setAdminForm({ uid: '', email: '', role: 'Tournament Manager' });
      fetchData();
    } catch (error) {
      reportFirestoreError(error, 'write', `admins/${adminForm.uid}`, onToast);
    }
  };

  return (
    <div className="pt-24 container mx-auto px-4 min-h-screen">
      <SectionHeader tag="Admin" title="Control" goldSpan="Panel" sub="Manage operations, reviews, and event coordination." />
      
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-none">
        {filteredTabs.map((tabObj) => (
          <button
            key={tabObj.id}
            onClick={() => setActiveTab(tabObj.id as any)}
            className={`px-6 py-2 font-bebas text-lg tracking-widest border transition-all whitespace-nowrap ${
              activeTab === tabObj.id ? 'bg-gold text-black border-gold' : 'text-gold border-gold/30 hover:border-gold'
            }`}
          >
            {tabObj.id}
          </button>
        ))}
      </div>

      <div className="bg-neutral-900 border border-gold/15 p-8 pb-32">
        {loading ? (
          <div className="text-center py-20 text-gold font-orbitron animate-pulse">Accessing Encrypted Data...</div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'applications' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 p-6 border border-gold/10">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-neutral-500 text-[10px] uppercase tracking-[0.2em] font-bold">Total Submissions</span>
                      <span className="text-2xl font-bebas text-gold tracking-widest">{applications.length}</span>
                    </div>
                    {applications.length > 0 && (
                      <button 
                        onClick={() => exportToCSV(applications, 'BTS_Recruitment_Applications')}
                        className="flex items-center gap-2 text-gold/60 hover:text-gold text-[10px] font-black uppercase tracking-widest transition-all mt-auto"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    )}
                  </div>
                  {applications.length > 0 && (
                    <button 
                      onClick={deleteAllApplications}
                      className="flex items-center gap-2 bg-red-600/10 text-red-500 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-red-600/20 shadow-lg shadow-red-600/5"
                    >
                      <Trash2 size={14} /> WIPE ALL RECORDS
                    </button>
                  )}
                </div>

                {applications.length === 0 ? (
                  <div className="text-center py-32 bg-white/5 border border-white/5 rounded-sm">
                    <div className="text-neutral-600 uppercase tracking-[0.3em] text-xs font-bold">Secure Vault Empty</div>
                    <div className="text-neutral-700 text-[10px] mt-2 italic">No recruitment data detected in the grid.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {applications.map(app => (
                      <div key={app.id} className="bg-neutral-900 border border-white/10 p-5 group hover:border-gold/30 transition-all relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-white font-bebas text-2xl tracking-widest leading-none">{app.ign}</span>
                              <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-[2px] border ${
                                app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                app.status === 'accepted' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                app.status === 'reviewed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                'bg-red-500/10 text-red-500 border-red-500/30'
                              }`}>
                                {app.status || 'pending'}
                              </span>
                            </div>
                            <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">{app.fullName} • <span className="text-gold/80">{app.game}</span></div>
                            <div className="text-neutral-600 text-[9px] font-mono mt-2 break-all">{app.email || 'No email provided'}</div>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-white/5">
                               <div className="space-y-0.5">
                                  <div className="text-[7px] text-neutral-500 uppercase tracking-widest font-black">Game UID</div>
                                  <div className="text-[10px] text-white font-mono">{app.gameUid || 'N/A'}</div>
                               </div>
                               <div className="space-y-0.5">
                                  <div className="text-[7px] text-neutral-500 uppercase tracking-widest font-black">K/D Ratio</div>
                                  <div className="text-[10px] text-gold font-orbitron">{app.kd || 'N/A'}</div>
                               </div>
                               <div className="space-y-0.5">
                                  <div className="text-[7px] text-neutral-500 uppercase tracking-widest font-black">FPS / Device</div>
                                  <div className="text-[10px] text-white uppercase">{app.fps || 'N/A'}</div>
                               </div>
                               <div className="space-y-0.5">
                                  <div className="text-[7px] text-neutral-500 uppercase tracking-widest font-black">Contact</div>
                                  <div className="text-[10px] text-white">{app.whatsapp || 'N/A'}</div>
                               </div>
                            </div>

                            {app.videoLink && (
                              <div className="mt-4">
                                <a 
                                  href={app.videoLink} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-[9px] text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                  <ExternalLink size={10} /> View Gameplay Video
                                </a>
                              </div>
                            )}

                            {app.experience && (
                              <div className="mt-4 p-3 bg-white/5 rounded-[2px]">
                                <div className="text-[7px] text-neutral-500 uppercase tracking-widest font-black mb-1">Competitive Experience</div>
                                <div className="text-[9px] text-neutral-400 line-clamp-3 italic leading-relaxed">{app.experience}</div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => deleteApplication(app.id)} 
                              className="p-2 text-neutral-700 hover:text-red-500 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 pt-5 border-t border-white/5 flex flex-wrap gap-2">
                          <button 
                            onClick={() => updateAppStatus(app.id, 'accepted')} 
                            className="flex-1 flex items-center justify-center gap-2 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white border border-green-500/20 py-2 text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            <Check size={12} /> Accept
                          </button>
                          {app.status === 'accepted' && (
                            <button 
                              onClick={() => promoteToSquad(app)}
                              className="flex-1 flex items-center justify-center gap-2 bg-gold/10 text-gold hover:bg-gold hover:text-black border border-gold/20 py-2 text-[9px] font-black uppercase tracking-widest transition-all"
                            >
                              <UserPlus size={12} /> Promote
                            </button>
                          )}
                          <button 
                            onClick={() => updateAppStatus(app.id, 'reviewed')} 
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 py-2 text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            <Eye size={12} /> Review
                          </button>
                          <button 
                            onClick={() => updateAppStatus(app.id, 'rejected')} 
                            className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 py-2 text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            <Ban size={12} /> Reject
                          </button>
                        </div>
                        
                        {/* Background subtle indicator */}
                        <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-3xl opacity-10 pointer-events-none ${
                          app.status === 'accepted' ? 'bg-green-500' : 
                          app.status === 'reviewed' ? 'bg-blue-500' : 
                          app.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'squad' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center bg-white/5 p-6 border border-gold/10">
                   <div>
                      <h4 className="font-bebas text-2xl text-gold tracking-widest">Digital Roster</h4>
                      <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">{squad.length} Active Operatives</p>
                   </div>
                   <button 
                     onClick={() => showCreateForm ? cancelForm() : setShowCreateForm(true)}
                     className="bg-gold text-black px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all rounded-[2px]"
                   >
                     {showCreateForm ? 'Abort' : 'Recruit New'}
                   </button>
                </div>

                {showCreateForm && (
                  <motion.form 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={submitSquadMember}
                    className="bg-white/5 border border-gold/20 p-8 space-y-6"
                   >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">In-Game Name (IGN)</label>
                          <input 
                            required
                            value={squadForm.ign}
                            onChange={(e) => setSquadForm({...squadForm, ign: e.target.value})}
                            type="text" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Clearance Code (UID)</label>
                          <input 
                            value={squadForm.uid}
                            onChange={(e) => setSquadForm({...squadForm, uid: e.target.value})}
                            type="text" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Role</label>
                          <select 
                            value={squadForm.role}
                            onChange={(e) => setSquadForm({...squadForm, role: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none"
                          >
                             {['IGL', 'Assaulter', 'Sniper', 'Support', 'Fragger', 'Scout'].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Squad Number</label>
                          <input 
                            value={squadForm.squadNumber}
                            onChange={(e) => setSquadForm({...squadForm, squadNumber: e.target.value})}
                            placeholder="e.g. 07"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-orbitron" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Combat Game</label>
                          <select 
                            value={squadForm.game}
                            onChange={(e) => setSquadForm({...squadForm, game: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none"
                          >
                             {['BGMI', 'Free Fire', 'COD', 'Valorant'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Division</label>
                          <select 
                            value={squadForm.div}
                            onChange={(e) => setSquadForm({...squadForm, div: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none"
                          >
                             {divisions.length > 0 ? (
                                divisions.map(d => <option key={d.id} value={d.key}>{d.name}</option>)
                             ) : (
                                Object.entries(DIVISIONS).map(([key, d]) => <option key={key} value={key}>{d.name}</option>)
                             )}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Scrims Kills</label>
                          <input 
                            value={squadForm.scrimsKills}
                            onChange={(e) => setSquadForm({...squadForm, scrimsKills: e.target.value})}
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Scrims Matches</label>
                          <input 
                            value={squadForm.scrimsMatches}
                            onChange={(e) => setSquadForm({...squadForm, scrimsMatches: e.target.value})}
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Tourney Kills</label>
                          <input 
                            value={squadForm.tourneyKills}
                            onChange={(e) => setSquadForm({...squadForm, tourneyKills: e.target.value})}
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Tourney Matches</label>
                          <input 
                            value={squadForm.tourneyMatches}
                            onChange={(e) => setSquadForm({...squadForm, tourneyMatches: e.target.value})}
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Open Room Kills</label>
                          <input 
                            value={squadForm.openRoomKills}
                            onChange={(e) => setSquadForm({...squadForm, openRoomKills: e.target.value})}
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Open Room Matches</label>
                          <input 
                            value={squadForm.openRoomMatches}
                            onChange={(e) => setSquadForm({...squadForm, openRoomMatches: e.target.value})}
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</label>
                          <select 
                            value={squadForm.status}
                            onChange={(e) => setSquadForm({...squadForm, status: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none"
                          >
                             {['Active', 'Inactive', 'On Trial'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1 md:col-span-2 lg:col-span-3">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Achievements (Comma separated)</label>
                          <input 
                            value={squadForm.achievements}
                            onChange={(e) => setSquadForm({...squadForm, achievements: e.target.value})}
                            placeholder="e.g. Tournament MVP - S4, BTS Cup Winner"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Instagram Handle or URL</label>
                          <input 
                            value={squadForm.instagram}
                            onChange={(e) => setSquadForm({...squadForm, instagram: e.target.value})}
                            placeholder="Handle (e.g. bts_official) or full URL"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">YouTube URL</label>
                          <input 
                            value={squadForm.youtube}
                            onChange={(e) => setSquadForm({...squadForm, youtube: e.target.value})}
                            placeholder="https://youtube.com/@channel"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Discord ID</label>
                          <input 
                            value={squadForm.discord}
                            onChange={(e) => setSquadForm({...squadForm, discord: e.target.value})}
                            placeholder="UserID"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                    </div>
                    <div className="bg-gold/5 p-4 border border-gold/20 flex justify-between items-center">
                       <div>
                          <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block">Calculated Performance</span>
                          <div className="flex gap-4 mt-1">
                             <div className="text-white font-orbitron text-xl">
                                KD: <span className="text-gold">{((parseInt(squadForm.scrimsKills) + parseInt(squadForm.tourneyKills) + parseInt(squadForm.openRoomKills)) / (Math.max(1, parseInt(squadForm.scrimsMatches) + parseInt(squadForm.tourneyMatches) + parseInt(squadForm.openRoomMatches)))).toFixed(2)}</span>
                             </div>
                             <div className="text-white font-orbitron text-xl">
                                GP: <span className="text-gold">{parseInt(squadForm.scrimsMatches) + parseInt(squadForm.tourneyMatches) + parseInt(squadForm.openRoomMatches)}</span>
                             </div>
                          </div>
                       </div>
                       <button type="submit" className="bg-gold text-black px-12 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-white transition-all">
                          {editingSquadId ? 'Update Internal Data' : 'Finalize Recruitment'}
                       </button>
                    </div>
                  </motion.form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {squad.map(player => (
                      <div key={player.id} className="bg-neutral-900 border border-white/5 p-6 group hover:border-gold/20 transition-all flex justify-between items-start relative overflow-hidden">
                         {player.status === 'Inactive' && (
                           <div className="absolute top-0 right-0 bg-red-500/80 text-[8px] font-black text-white px-2 py-1 uppercase tracking-widest">Inactive</div>
                         )}
                         <div className="flex-1">
                            <div className="text-[8px] font-black text-gold uppercase tracking-widest mb-1">
                               {divisions.find(d => d.key === player.div)?.name || player.div}
                            </div>
                            <h5 className="font-bebas text-2xl text-white tracking-widest">{player.ign}</h5>
                            <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{player.role}</div>
                            
                            <div className="grid grid-cols-3 gap-2 mt-4">
                               <div className="bg-white/5 p-2 border border-white/5">
                                  <div className="text-[7px] text-neutral-600 font-black uppercase">Scrims</div>
                                  <div className="text-[10px] text-white font-mono">{player.scrimsKills || 0}/{player.scrimsMatches || 0}</div>
                               </div>
                               <div className="bg-white/5 p-2 border border-white/5">
                                  <div className="text-[7px] text-neutral-600 font-black uppercase">Tourney</div>
                                  <div className="text-[10px] text-white font-mono">{player.tourneyKills || 0}/{player.tourneyMatches || 0}</div>
                               </div>
                               <div className="bg-white/5 p-2 border border-white/5">
                                  <div className="text-[7px] text-neutral-600 font-black uppercase">Open</div>
                                  <div className="text-[10px] text-white font-mono">{player.openRoomKills || 0}/{player.openRoomMatches || 0}</div>
                               </div>
                            </div>
                            <div className="mt-3 flex gap-4">
                               <div className="text-[10px] font-black text-gold uppercase tracking-widest">KD: {player.kd}</div>
                               <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">GP: {player.matches}</div>
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <button onClick={() => startEditingSquad(player)} className="p-2 text-neutral-600 hover:text-gold transition-colors">
                               <Settings size={14} />
                            </button>
                            <button onClick={() => deleteSquadMember(player.id)} className="p-2 text-neutral-600 hover:text-neon-red transition-colors">
                               <Trash2 size={14} />
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center bg-white/5 p-6 border border-gold/10">
                   <div>
                      <h4 className="font-bebas text-2xl text-gold tracking-widest">Achievement Gallery</h4>
                      <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">{achievements.length} Strategic Victories Locked</p>
                   </div>
                   <button 
                     onClick={() => showCreateForm ? cancelForm() : setShowCreateForm(true)}
                     className="bg-gold text-black px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all rounded-[2px]"
                   >
                     {showCreateForm ? 'Abort' : 'Log Victory'}
                   </button>
                </div>

                {showCreateForm && (
                  <motion.form 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={submitAchievement}
                    className="bg-white/5 border border-gold/20 p-8 space-y-6"
                   >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Achievement Title</label>
                          <input 
                            required
                            value={achievementForm.title}
                            onChange={(e) => setAchievementForm({...achievementForm, title: e.target.value})}
                            type="text" 
                            placeholder="e.g. Winner Winner Chicken Dinner"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Image URL (Victory Screenshot)</label>
                          <input 
                            required
                            value={achievementForm.imageUrl}
                            onChange={(e) => setAchievementForm({...achievementForm, imageUrl: e.target.value})}
                            type="url" 
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Date</label>
                          <input 
                            required
                            value={achievementForm.date}
                            onChange={(e) => setAchievementForm({...achievementForm, date: e.target.value})}
                            type="text" 
                            placeholder="e.g. 24 April 2024"
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Game</label>
                          <select 
                            value={achievementForm.game}
                            onChange={(e) => setAchievementForm({...achievementForm, game: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none"
                          >
                             {['BGMI', 'Free Fire', 'COD', 'Valorant'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Division (Optional)</label>
                          <select 
                            value={achievementForm.division}
                            onChange={(e) => setAchievementForm({...achievementForm, division: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none"
                          >
                             {divisions.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1 md:col-span-2 lg:col-span-3">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Description</label>
                          <textarea 
                            value={achievementForm.description}
                            onChange={(e) => setAchievementForm({...achievementForm, description: e.target.value})}
                            rows={3}
                            placeholder="Briefly describe this victory..."
                            className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none resize-none" 
                          />
                       </div>
                    </div>
                    <div className="flex justify-end">
                       <button type="submit" className="bg-gold text-black px-12 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-white transition-all">
                          {editingAchievementId ? 'Update Log' : 'Secure Archive'}
                       </button>
                    </div>
                  </motion.form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {achievements.map(ach => (
                      <div key={ach.id} className="bg-neutral-900 border border-white/5 group hover:border-gold/20 transition-all overflow-hidden">
                         <div className="aspect-video relative overflow-hidden">
                            <img referrerPolicy="no-referrer" src={getSafeImageUrl(ach.imageUrl)} alt={ach.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 text-[8px] font-black text-gold uppercase tracking-widest border border-gold/20">
                               {ach.game}
                            </div>
                         </div>
                         <div className="p-4 space-y-2">
                            <h5 className="font-bebas text-xl text-white tracking-widest truncate">{ach.title}</h5>
                            <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{ach.date}</div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                               <button onClick={() => startEditingAchievement(ach)} className="p-2 text-neutral-600 hover:text-gold transition-colors">
                                  <Settings size={14} />
                               </button>
                               <button onClick={() => deleteAchievement(ach.id)} className="p-2 text-neutral-600 hover:text-neon-red transition-colors">
                                  <Trash2 size={14} />
                               </button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center bg-white/5 p-6 border border-gold/10">
                   <div>
                      <h4 className="font-bebas text-2xl text-gold tracking-widest">Global Intelligence Network</h4>
                      <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">{users.length} Data Profiles Identified</p>
                   </div>
                   <div className="flex gap-4">
                      <button 
                        onClick={() => exportToCSV(users, 'users_directory')}
                        className="p-2 border border-white/10 text-neutral-500 hover:text-gold transition-colors"
                        title="Export Database"
                      >
                        <Download size={18} />
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {users.map(u => (
                    <div key={u.id} className="bg-neutral-900 border border-white/10 p-6 flex flex-col justify-between group hover:border-gold/30 transition-all relative overflow-hidden">
                      {u.role === 'Admin' && (
                        <div className="absolute top-0 right-0 bg-gold text-black text-[8px] font-black px-2 py-1 uppercase tracking-widest">Administrator</div>
                      )}
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="bg-white/5 p-3 border border-white/10 rounded-[2px]">
                            <UserIcon size={24} className="text-neutral-500" />
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] font-black text-gold uppercase tracking-widest italic">{u.systemId || 'LEGACY-PROFILE'}</div>
                             <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest">Auth: {u.uid.slice(0, 8)}...</div>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-bebas text-3xl text-white tracking-widest leading-none">{u.ign || 'Anonymous'}</h5>
                          <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest truncate">{u.email}</p>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(u.email);
                                onToast('Tactical Data', 'Email intelligence copied to clipboard.');
                              }}
                              className="text-neutral-600 hover:text-gold transition-colors p-1"
                              title="Copy Email ID"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[8px] font-black uppercase tracking-widest">
                           <div className="bg-black/40 p-2 border border-white/5">
                              <span className="text-neutral-600 block mb-1">Status</span>
                              <span className="text-emerald-500">Online</span>
                           </div>
                           <div className="bg-black/40 p-2 border border-white/5">
                              <span className="text-neutral-600 block mb-1">Clearance</span>
                              <span className={u.role === 'Admin' ? 'text-gold' : 'text-blue-400'}>{u.role || 'User'}</span>
                           </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                         <div className="flex flex-col gap-2">
                            <div className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-1 px-1 flex items-center justify-between">
                               Select Clearance Profile
                               {actingUserId === u.id && <Loader2 size={10} className="animate-spin text-gold" />}
                            </div>
                            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 border border-white/10">
                               <button 
                                 onClick={() => u.role !== 'User' && demoteFromSquad(u)}
                                 disabled={u.role === 'User' || actingUserId === u.id}
                                 className={`py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
                                   u.role === 'User' 
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                                    : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-white border border-transparent'
                                 } disabled:cursor-default`}
                               >
                                  Standard User
                               </button>
                               <button 
                                 onClick={() => u.role !== 'Squad Member' && promoteToSquadFromUser(u)}
                                 disabled={u.role === 'Squad Member' || actingUserId === u.id}
                                 className={`py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
                                   u.role === 'Squad Member' 
                                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-white border border-transparent'
                                 } disabled:cursor-default`}
                               >
                                  Squad Member
                               </button>
                            </div>
                         </div>
                         
                         <div className="flex gap-2">
                           <button className="flex-1 py-3 border border-white/10 text-neutral-600 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-500 transition-all">
                              <Ban size={14} /> Full Ban Status
                           </button>
                         </div>
                      </div>
                    </div>
                  ))}
                  
                  {users.length === 0 && !loading && (
                    <div className="col-span-full py-20 bg-white/5 border border-dashed border-white/10 text-center flex flex-col items-center justify-center gap-4">
                      <Shield size={40} className="text-neutral-800" />
                      <div className="text-neutral-500 font-bebas text-xl tracking-widest">Network Database Empty</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'admins' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 p-8 border border-gold/10">
                  <div className="space-y-1">
                    <h4 className="font-bebas text-3xl text-gold tracking-widest leading-none">Security Oversight Command</h4>
                    <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em]">Manage high-clearance administrative access levels.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1">
                    <form onSubmit={addAdmin} className="bg-neutral-900 border border-gold/20 p-6 space-y-6 sticky top-24">
                      <div className="flex items-center gap-2 mb-4 border-b border-gold/10 pb-4">
                        <ShieldAlert className="text-gold" size={20} />
                        <span className="font-bebas text-xl text-white tracking-widest">New Authorization</span>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Target UID</label>
                        <input 
                          required
                          value={adminForm.uid}
                          onChange={e => setAdminForm({...adminForm, uid: e.target.value})}
                          placeholder="Firebase User UID"
                          className="w-full bg-black/60 border border-white/10 p-3 text-xs text-white focus:border-gold outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Target Email</label>
                        <input 
                          required
                          type="email"
                          value={adminForm.email}
                          onChange={e => setAdminForm({...adminForm, email: e.target.value})}
                          placeholder="Admin email address"
                          className="w-full bg-black/60 border border-white/10 p-3 text-xs text-white focus:border-gold outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Clearance Level</label>
                        <select 
                          value={adminForm.role}
                          onChange={e => setAdminForm({...adminForm, role: e.target.value as any})}
                          className="w-full bg-black/60 border border-white/10 p-3 text-xs text-white focus:border-gold outline-none appearance-none"
                        >
                          <option value="Super Admin">Super Admin (Full Access)</option>
                          <option value="Tournament Manager">Tournament Manager</option>
                          <option value="Content Moderator">Content Moderator</option>
                          <option value="Head Scout">Head Scout</option>
                        </select>
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-gold text-black py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                      >
                        Authorize Agent
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-px bg-gold/20 flex-1"></div>
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">Authorized Personnel ({admins.length})</span>
                      <div className="h-px bg-gold/20 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {admins.map(adm => (
                        <div key={adm.id} className="bg-white/5 border border-white/10 p-5 flex justify-between items-center group hover:border-gold/30 transition-all">
                          <div className="flex items-center gap-5">
                            <div className={`p-3 rounded-full border ${
                              adm.role === 'Super Admin' ? 'bg-gold/10 border-gold/30 text-gold' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            }`}>
                              <Shield size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-bebas text-xl text-white tracking-widest">{adm.email}</span>
                                <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-[2px] ${
                                  adm.role === 'Super Admin' ? 'border-gold text-gold bg-gold/5' : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                                }`}>
                                  {adm.role || 'Super Admin'}
                                </span>
                              </div>
                              <div className="text-[9px] text-neutral-600 font-mono mt-1">UID: {adm.uid}</div>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => removeAdmin(adm.id)}
                            className="p-3 text-neutral-700 hover:text-red-500 transition-colors"
                            title="Revoke access"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}

                      {admins.length === 0 && (
                        <div className="text-center py-20 bg-black/20 border border-dashed border-white/5">
                          <p className="text-neutral-600 font-bebas tracking-[0.2em]">No custom admin authorizations found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 p-8 border border-gold/10">
                  <div className="space-y-1">
                    <h4 className="font-bebas text-3xl text-gold tracking-widest leading-none">Combat Log Engine</h4>
                    <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em]">Real-time match statistics and performance synchronization.</p>
                  </div>
                </div>

                <div className="max-w-4xl mx-auto bg-neutral-900 border border-gold/20 p-8">
                  <form onSubmit={submitMatchStat} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                           <Target size={14} className="text-gold" />
                           Select Operative
                        </label>
                        <select 
                          required
                          value={matchStatForm.playerId}
                          onChange={e => setMatchStatForm({...matchStatForm, playerId: e.target.value})}
                          className="w-full bg-black/60 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none h-14 appearance-none"
                        >
                          <option value="">Choose a Squad Member...</option>
                          {squad.map(s => <option key={s.id} value={s.id}>{s.ign} ({s.role})</option>)}
                        </select>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                           <ShieldAlert size={14} className="text-gold" />
                           Engagement Type
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                          <button 
                            type="button"
                            onClick={() => setMatchStatForm({...matchStatForm, matchType: 'scrim'})}
                            className={`p-4 border text-[10px] font-black uppercase tracking-widest transition-all ${
                              matchStatForm.matchType === 'scrim' ? 'bg-gold text-black border-gold' : 'bg-black/40 text-neutral-500 border-white/10 hover:border-gold/30'
                            }`}
                          >
                            Scrim Engagement
                          </button>
                          <button 
                            type="button"
                            onClick={() => setMatchStatForm({...matchStatForm, matchType: 'tournament'})}
                            className={`p-4 border text-[10px] font-black uppercase tracking-widest transition-all ${
                              matchStatForm.matchType === 'tournament' ? 'bg-gold text-black border-gold' : 'bg-black/40 text-neutral-500 border-white/10 hover:border-gold/30'
                            }`}
                          >
                            Official Tournament
                          </button>
                          <button 
                            type="button"
                            onClick={() => setMatchStatForm({...matchStatForm, matchType: 'open_room'})}
                            className={`p-4 border text-[10px] font-black uppercase tracking-widest transition-all ${
                              matchStatForm.matchType === 'open_room' ? 'bg-gold text-black border-gold' : 'bg-black/40 text-neutral-500 border-white/10 hover:border-gold/30'
                            }`}
                          >
                            Open Room
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                      <div className="md:col-span-1 space-y-4">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Kills Confirmed</label>
                        <div className="relative">
                          <input 
                            required
                            type="number"
                            min="0"
                            value={matchStatForm.kills}
                            onChange={e => setMatchStatForm({...matchStatForm, kills: e.target.value})}
                            className="w-full bg-black/60 border border-white/10 p-4 text-2xl font-orbitron text-gold focus:border-gold outline-none h-16 text-center"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                         <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Match Brief/Context (Optional)</label>
                         <input 
                           value={matchStatForm.matchBrief}
                           onChange={e => setMatchStatForm({...matchStatForm, matchBrief: e.target.value})}
                           placeholder="e.g. Round 3 Final Circle Clutch"
                           className="w-full bg-black/60 border border-white/10 p-4 text-xs text-white focus:border-gold outline-none h-16"
                         />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gold/10">
                      <button 
                        type="submit"
                        className="w-full bg-gold text-black py-5 font-black uppercase text-xs tracking-[0.3em] hover:bg-white transition-all shadow-[0_10px_30px_rgba(212,175,55,0.15)] flex items-center justify-center gap-3"
                      >
                         <Lock size={16} />
                         Synchronize Combat Data
                      </button>
                      <p className="text-center text-[9px] text-neutral-600 mt-4 uppercase tracking-widest font-bold italic">
                        Caution: This action will automatically recalculate K/D and total matches.
                      </p>
                    </div>
                  </form>
                </div>

                {matchStatForm.playerId && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto p-6 bg-white/5 border border-white/10 flex flex-wrap gap-12 justify-center"
                  >
                     <div className="text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Current KD</span>
                        <div className="font-bebas text-3xl text-white tracking-widest">{squad.find(s => s.id === matchStatForm.playerId)?.kd || '0.00'}</div>
                     </div>
                     <div className="text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Current Matches</span>
                        <div className="font-bebas text-3xl text-white tracking-widest">{squad.find(s => s.id === matchStatForm.playerId)?.matches || 0}</div>
                     </div>
                     <div className="text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Projected KD</span>
                        <div className="font-bebas text-3xl text-gold tracking-widest">
                           {(() => {
                              const p = squad.find(s => s.id === matchStatForm.playerId);
                              if (!p) return '0.00';
                              const tk = (p.kills || 0) + (parseInt(matchStatForm.kills) || 0);
                              const tm = (p.matches || 0) + 1;
                              return (tk / tm).toFixed(2);
                           })()}
                        </div>
                     </div>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === 'divisions' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center bg-white/5 p-6 border border-gold/10">
                   <div>
                      <h4 className="font-bebas text-2xl text-gold tracking-widest">Division Matrix</h4>
                      <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">{divisions.length} Operational Sectors</p>
                   </div>
                   <button 
                     onClick={() => showCreateForm ? cancelForm() : setShowCreateForm(true)}
                     className="bg-gold text-black px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all rounded-[2px]"
                   >
                     {showCreateForm ? 'Abort' : 'Establish New'}
                   </button>
                </div>

                {showCreateForm && (
                  <motion.form 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onSubmit={submitDivision}
                    className="bg-white/5 border border-gold/20 p-8 space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">System Key (Unique ID)</label>
                        <input 
                          required
                          value={divisionForm.key}
                          onChange={(e) => setDivisionForm({...divisionForm, key: e.target.value.toLowerCase().replace(/\s/g, '')})}
                          placeholder="e.g. prime, arise, legends"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-mono" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Display Name</label>
                        <input 
                          required
                          value={divisionForm.name}
                          onChange={(e) => setDivisionForm({...divisionForm, name: e.target.value})}
                          placeholder="e.g. BTS Prime"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Strategic Description</label>
                        <textarea 
                          value={divisionForm.desc}
                          onChange={(e) => setDivisionForm({...divisionForm, desc: e.target.value})}
                          rows={2}
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-neutral-300 focus:border-gold outline-none resize-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Identity Color (HEX)</label>
                        <div className="flex gap-2">
                          <input 
                            type="color"
                            value={divisionForm.badgeColor}
                            onChange={(e) => setDivisionForm({...divisionForm, badgeColor: e.target.value})}
                            className="h-10 w-10 bg-transparent border-none cursor-pointer"
                          />
                          <input 
                            value={divisionForm.badgeColor}
                            onChange={(e) => setDivisionForm({...divisionForm, badgeColor: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 p-3 text-xs text-white uppercase font-mono" 
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Tailwind Class (Optional)</label>
                        <input 
                          value={divisionForm.colorClass}
                          onChange={(e) => setDivisionForm({...divisionForm, colorClass: e.target.value})}
                          placeholder="e.g. c-prime"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-blue-400 focus:border-blue-500 outline-none" 
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button type="submit" className="flex-1 bg-gold text-black py-4 text-xs font-black uppercase tracking-widest hover:bg-white transition-all">
                        {editingDivisionId ? 'Synchronize Matrix' : 'Establish Operational Sector'}
                      </button>
                    </div>
                  </motion.form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {divisions.map(d => (
                    <div key={d.id} className="bg-neutral-900 border border-white/10 p-6 flex flex-col justify-between group hover:border-gold/30 transition-all">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: d.badgeColor }} />
                          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tighter">ID: {d.key}</span>
                        </div>
                        <h5 className="font-bebas text-3xl text-white tracking-widest mb-2">{d.name}</h5>
                        <p className="text-[10px] text-neutral-500 leading-relaxed min-h-[30px]">{d.desc || 'No strategic description provided.'}</p>
                      </div>
                      <div className="mt-6 pt-6 border-t border-white/5 flex gap-2">
                        <button onClick={() => startEditingDivision(d)} className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-neutral-400 border border-white/10 py-2 text-[9px] font-black uppercase tracking-widest hover:text-gold hover:border-gold/30 transition-all">
                           <Settings size={12} /> Configure
                        </button>
                        <button onClick={() => deleteDivision(d.id)} className="p-2 border border-white/10 text-neutral-600 hover:text-red-500 transition-colors">
                           <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {divisions.length === 0 && !loading && (
                    <div className="col-span-full py-20 bg-white/5 border border-dashed border-white/10 text-center flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-full border border-gold/20 flex items-center justify-center text-gold/30">
                        <ShieldAlert size={24} />
                      </div>
                      <div>
                        <div className="text-neutral-500 font-bebas text-xl tracking-widest">No dynamic divisions found</div>
                        <p className="text-[9px] text-neutral-700 uppercase font-black tracking-widest mt-1">Establish your first sector to begin dynamic management</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'tournaments' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <button 
                    onClick={() => showCreateForm ? cancelForm() : setShowCreateForm(true)}
                    className="flex items-center gap-3 bg-gold text-black px-6 py-3 text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(255,184,0,0.3)] transition-all rounded-[2px]"
                  >
                    {showCreateForm ? <X size={18} /> : <Plus size={18} />} 
                    {showCreateForm ? 'Cancel Operation' : 'Initialize Tournament'}
                  </button>
                  {tournaments.length > 0 && (
                    <div className="flex items-center gap-4">
                       <div className="text-right hidden sm:block">
                         <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Active Events</div>
                         <div className="text-white text-lg font-bebas tracking-widest">{tournaments.filter(t => t.status === 'open' || t.status === 'ongoing').length} / {tournaments.length}</div>
                       </div>
                       <button 
                        onClick={() => exportToCSV(tournaments, 'BTS_Events_History')}
                        className="flex items-center gap-2 border border-white/10 px-4 py-2 text-white/60 hover:text-gold hover:border-gold/30 text-[10px] font-black uppercase tracking-widest transition-all rounded-[2px]"
                      >
                        <Download size={14} /> EXPORT
                      </button>
                    </div>
                  )}
                </div>

                {showCreateForm && (
                  <motion.form 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    onSubmit={submitTournament}
                    className="mb-12 bg-white/5 border-l-4 border-gold p-8 space-y-6 overflow-hidden shadow-2xl"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2 h-2 bg-gold rounded-full animate-ping" />
                      <h3 className="text-white font-orbitron text-xs font-black uppercase tracking-[0.3em]">
                        {editingTournamentId ? 'Edit Resource Data' : 'New Tournament Uplink'}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Operations Name</label>
                        <input 
                          required
                          value={tournamentForm.name}
                          onChange={(e) => setTournamentForm({...tournamentForm, name: e.target.value})}
                          type="text" 
                          placeholder="e.g. ULTIMATE SHOWDOWN 2026"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bebas tracking-widest text-lg" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Game Architecture</label>
                        <select 
                          value={tournamentForm.game}
                          onChange={(e) => setTournamentForm({...tournamentForm, game: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none appearance-none font-bold"
                        >
                          <option>BGMI</option>
                          <option>Free Fire</option>
                          <option>Valorant</option>
                          <option>CODM</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Resource Pool (Prize)</label>
                        <input 
                          required
                          value={tournamentForm.prize}
                          onChange={(e) => setTournamentForm({...tournamentForm, prize: e.target.value})}
                          type="text" 
                          placeholder="e.g. ₹1,00,000"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-gold focus:border-gold outline-none font-black" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Max Capacity (Slots)</label>
                        <input 
                          value={tournamentForm.total}
                          onChange={(e) => setTournamentForm({...tournamentForm, total: e.target.value})}
                          type="number" 
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Deployment Date</label>
                        <input 
                          value={tournamentForm.date}
                          onChange={(e) => setTournamentForm({...tournamentForm, date: e.target.value})}
                          type="text" 
                          placeholder="e.g. 25 OCT 2026"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Execution Status</label>
                        <select 
                          value={tournamentForm.status}
                          onChange={(e) => setTournamentForm({...tournamentForm, status: e.target.value as any})}
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bold"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="open">Open / Live</option>
                          <option value="closed">Closed / Full</option>
                          <option value="ongoing">Ongoing / Active</option>
                          <option value="finished">Finished / Archived</option>
                        </select>
                      </div>
                      <div className="space-y-1 md:col-span-2 lg:col-span-3">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Asset Visual (URL)</label>
                        <input 
                          value={tournamentForm.imageUrl}
                          onChange={(e) => setTournamentForm({...tournamentForm, imageUrl: e.target.value})}
                          type="url" 
                          placeholder="https://images.unsplash.com/..."
                          className="w-full bg-black/40 border border-white/10 p-3 text-xs text-neutral-400 focus:border-gold outline-none font-mono" 
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2 lg:col-span-3">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Discord Channel / Discussion Link</label>
                        <input 
                          value={tournamentForm.discordLink}
                          onChange={(e) => setTournamentForm({...tournamentForm, discordLink: e.target.value})}
                          type="url" 
                          placeholder="https://discord.gg/..."
                          className="w-full bg-black/40 border border-white/10 p-3 text-xs text-blue-400 focus:border-blue-500 outline-none font-mono" 
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2 lg:col-span-3">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Instagram Coverage</label>
                        <input 
                          value={tournamentForm.instagramLink}
                          onChange={(e) => setTournamentForm({...tournamentForm, instagramLink: e.target.value})}
                          type="url" 
                          placeholder="https://instagram.com/..."
                          className="w-full bg-black/40 border border-white/10 p-3 text-xs text-pink-400 focus:border-pink-500 outline-none font-mono" 
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2 lg:col-span-3">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">YouTube Stream</label>
                        <input 
                          value={tournamentForm.youtubeLink}
                          onChange={(e) => setTournamentForm({...tournamentForm, youtubeLink: e.target.value})}
                          type="url" 
                          placeholder="https://youtube.com/..."
                          className="w-full bg-black/40 border border-white/10 p-3 text-xs text-red-400 focus:border-red-500 outline-none font-mono" 
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex gap-4">
                      <button type="submit" className="flex-1 bg-gold text-black py-4 text-xs font-black uppercase tracking-widest hover:bg-gold-light transition-all rounded-[2px] shadow-lg">
                        {editingTournamentId ? 'Synchronize Data' : 'Authorize Publication'}
                      </button>
                      {editingTournamentId && (
                        <button type="button" onClick={cancelForm} className="px-8 border border-white/10 text-white/40 hover:text-white text-xs font-black uppercase tracking-widest transition-all rounded-[2px]">
                          Abort
                        </button>
                      )}
                    </div>
                  </motion.form>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {tournaments.length === 0 ? (
                    <div className="col-span-full text-center py-32 bg-white/5 border border-white/5 rounded-sm">
                      <div className="text-neutral-600 uppercase tracking-[0.3em] text-xs font-bold">Network Quiet</div>
                      <div className="text-neutral-700 text-[10px] mt-2 italic">Zero events found in current sector.</div>
                    </div>
                  ) : (
                    tournaments.map(t => (
                      <div key={t.id} className="bg-neutral-900 border border-white/10 overflow-hidden group hover:border-gold/30 transition-all flex flex-col relative">
                        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-black/20">
                          <div className="flex items-center gap-3">
                             <div className={`w-2 h-2 rounded-full ${
                               t.status === 'open' ? 'bg-green-500 animate-pulse' :
                               t.status === 'ongoing' ? 'bg-yellow-500 animate-pulse' :
                               t.status === 'upcoming' ? 'bg-blue-500' :
                               'bg-neutral-600'
                             }`} />
                             <span className="text-gold text-[10px] font-bold tracking-[0.2em] uppercase">{t.game}</span>
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-[2px] ${
                            t.status === 'open' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            t.status === 'ongoing' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                            'bg-white/5 text-neutral-400 border-white/10'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-white font-bebas text-2xl tracking-widest mb-1 group-hover:text-gold transition-colors">{t.name}</h4>
                            <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-bold uppercase tracking-tight mt-2">
                              <span className="flex items-center gap-1.5"><Calendar size={12} className="text-gold/60" /> {t.date}</span>
                              <span className="flex items-center gap-1.5"><Users size={12} className="text-gold/60" /> {t.slots}/{t.total} slots</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-4 mt-8 border-t border-white/5 pt-5">
                            <button 
                              onClick={() => startEditing(t)} 
                              className="flex-1 bg-white/5 text-white/60 hover:text-gold hover:bg-gold/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm border border-transparent hover:border-gold/30"
                            >
                              Configure
                            </button>
                            <button 
                              onClick={() => deleteTournament(t.id)} 
                              className="bg-red-600 text-white p-2.5 rounded-sm hover:bg-red-700 transition-colors border border-red-700 shadow-xl"
                              title="Delete Resource"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'live' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 p-8 border border-gold/10">
                  <div className="space-y-1">
                    <h4 className="font-bebas text-3xl text-gold tracking-widest leading-none">Broadcast Control Center</h4>
                    <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em]">Manage YouTube live stream visibility on the home page.</p>
                  </div>
                </div>

                <div className="max-w-xl mx-auto bg-neutral-900 border border-gold/20 p-8 space-y-8">
                   <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10">
                      <div className="flex items-center gap-4">
                         <div className={`w-3 h-3 rounded-full ${liveConfig.isLive ? 'bg-red-500 animate-pulse' : 'bg-neutral-700'}`} />
                         <span className="font-bebas text-2xl text-white tracking-widest">LIVE STATUS: {liveConfig.isLive ? 'BROADCASTING' : 'OFFLINE'}</span>
                      </div>
                      <button 
                        onClick={() => updateLiveStatus({ ...liveConfig, isLive: !liveConfig.isLive })}
                        className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest border transition-all ${
                          liveConfig.isLive ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-gold text-gold hover:bg-gold/10'
                        }`}
                      >
                        {liveConfig.isLive ? 'Deactivate Live' : 'Go Live Now'}
                      </button>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">YouTube Video ID</label>
                        <input 
                          value={liveConfig.videoId}
                          onChange={(e) => setLiveConfig({...liveConfig, videoId: e.target.value})}
                          placeholder="e.g. dQw4w9WgXcQ"
                          className="w-full bg-black/60 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none h-14"
                        />
                        <p className="text-[9px] text-neutral-600 italic">Copy the 11 character ID from your stream URL.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Stream Title</label>
                        <input 
                          value={liveConfig.title}
                          onChange={(e) => setLiveConfig({...liveConfig, title: e.target.value})}
                          placeholder="e.g. BTS vs Global eSports - Grand Finals"
                          className="w-full bg-black/60 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none h-14"
                        />
                      </div>

                      <button 
                        onClick={() => updateLiveStatus(liveConfig)}
                        className="w-full bg-gold text-black py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-[0_5px_15px_rgba(212,175,55,0.1)]"
                      >
                        Push Settings to Roster
                      </button>
                   </div>
                </div>

                {liveConfig.isLive && liveConfig.videoId && (
                  <div className="max-w-3xl mx-auto aspect-video bg-black border border-white/10 shadow-2xl">
                     <iframe 
                       src={`https://www.youtube.com/embed/${liveConfig.videoId}?autoplay=1&mute=1`}
                       className="w-full h-full"
                       allowFullScreen
                       title="Live Preview"
                     />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'highlights' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <button 
                    onClick={() => showCreateForm ? cancelForm() : setShowCreateForm(true)}
                    className="flex items-center gap-3 bg-gold text-black px-6 py-3 text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(255,184,0,0.3)] transition-all rounded-[2px]"
                  >
                    {showCreateForm ? <X size={18} /> : <Plus size={18} />} 
                    {showCreateForm ? 'Cancel Operation' : 'Add New Highlight'}
                  </button>
                </div>

                {showCreateForm && (
                  <motion.form 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    onSubmit={submitHighlight}
                    className="mb-12 bg-white/5 border-l-4 border-gold p-8 space-y-6 overflow-hidden shadow-2xl"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2 h-2 bg-gold rounded-full animate-ping" />
                      <h3 className="text-white font-orbitron text-xs font-black uppercase tracking-[0.3em]">
                        {editingHighlightId ? 'Update Visual Record' : 'New Web Highlight'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Highlight Title</label>
                        <input 
                          required
                          value={highlightForm.title}
                          onChange={(e) => setHighlightForm({...highlightForm, title: e.target.value})}
                          type="text" 
                          placeholder="e.g. 1v4 Clutch | BTS vs Global"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bebas tracking-widest text-lg" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Visual Tag (e.g. SQUAD WIPE)</label>
                        <input 
                          required
                          value={highlightForm.tag}
                          onChange={(e) => setHighlightForm({...highlightForm, tag: e.target.value})}
                          type="text" 
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bold uppercase transition-all" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Timestamp/Date</label>
                        <input 
                          required
                          value={highlightForm.date}
                          onChange={(e) => setHighlightForm({...highlightForm, date: e.target.value})}
                          type="text" 
                          placeholder="e.g. 2 days ago"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Thumbnail Image URL</label>
                        <input 
                          required
                          value={highlightForm.thumb}
                          onChange={(e) => setHighlightForm({...highlightForm, thumb: e.target.value})}
                          type="url" 
                          placeholder="https://..."
                          className="w-full bg-black/40 border border-white/10 p-3 text-xs text-neutral-400 focus:border-gold outline-none font-mono" 
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex gap-4">
                      <button type="submit" className="flex-1 bg-gold text-black py-4 text-xs font-black uppercase tracking-widest hover:bg-gold-light transition-all rounded-[2px] shadow-lg">
                        {editingHighlightId ? 'Sync Highlight' : 'Publish Highlight'}
                      </button>
                      {editingHighlightId && (
                        <button type="button" onClick={cancelForm} className="px-8 border border-white/10 text-white/40 hover:text-white text-xs font-black uppercase tracking-widest transition-all rounded-[2px]">
                          Discard
                        </button>
                      )}
                    </div>
                  </motion.form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {highlights.length === 0 ? (
                    <div className="col-span-full text-center py-32 bg-white/5 border border-white/5 rounded-sm">
                      <div className="text-neutral-600 uppercase tracking-[0.3em] text-xs font-bold">Grid Empty</div>
                      <div className="text-neutral-700 text-[10px] mt-2 italic">Zero highlights captured in history.</div>
                    </div>
                  ) : (
                    highlights.map(h => (
                      <div key={h.id} className="bg-neutral-900 border border-white/10 group hover:border-gold/30 transition-all flex flex-col overflow-hidden">
                        <div className="relative aspect-video">
                          <img src={getSafeImageUrl(h.thumb)} alt="" className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-all" />
                          <div className="absolute top-2 left-2 bg-gold text-black text-[8px] font-black px-1.5 py-0.5 uppercase tracking-widest">{h.tag}</div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-white font-bebas text-lg tracking-widest leading-tight group-hover:text-gold transition-colors">{h.title}</h4>
                            <p className="text-neutral-600 text-[10px] uppercase font-bold mt-1">{h.date}</p>
                          </div>
                          <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                            <button onClick={() => startEditingHighlight(h)} className="flex-1 bg-white/5 text-[10px] font-black uppercase tracking-widest py-2 text-white/40 hover:text-gold hover:bg-gold/10 transition-all border border-transparent hover:border-gold/30">Edit</button>
                            <button onClick={() => deleteHighlight(h.id)} className="bg-red-600/10 text-red-600 p-2 hover:bg-red-600 hover:text-white transition-all border border-red-600/20"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <button 
                    onClick={() => showCreateForm ? cancelForm() : setShowCreateForm(true)}
                    className="flex items-center gap-3 bg-gold text-black px-6 py-3 text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(255,184,0,0.3)] transition-all rounded-[2px]"
                  >
                    {showCreateForm ? <X size={18} /> : <Plus size={18} />} 
                    {showCreateForm ? 'Cancel Operation' : 'Add New Result'}
                  </button>
                  {results.length > 0 && (
                    <button 
                      onClick={() => exportToCSV(results, 'BTS_Tournament_Results')}
                      className="flex items-center gap-2 border border-white/10 px-4 py-2 text-white/60 hover:text-gold hover:border-gold/30 text-[10px] font-black uppercase tracking-widest transition-all rounded-[2px]"
                    >
                      <Download size={14} /> EXPORT DATA
                    </button>
                  )}
                </div>

                {showCreateForm && (
                  <motion.form 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    onSubmit={submitResult}
                    className="mb-12 bg-white/5 border-l-4 border-gold p-8 space-y-6 overflow-hidden shadow-2xl"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2 h-2 bg-gold rounded-full animate-ping" />
                      <h3 className="text-white font-orbitron text-xs font-black uppercase tracking-[0.3em]">
                        {editingResultId ? 'Update History Record' : 'New Archive Entry'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Operations Node (Event)</label>
                        <select 
                          required
                          value={resultForm.tournamentId}
                          onChange={(e) => setResultForm({...resultForm, tournamentId: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bold"
                        >
                          <option value="">-- Choose Event --</option>
                          {tournaments.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.game})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Victorious Team</label>
                        <input 
                          required
                          value={resultForm.teamName}
                          onChange={(e) => setResultForm({...resultForm, teamName: e.target.value})}
                          type="text" 
                          placeholder="Team Alpha"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bebas tracking-widest text-lg" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Deployment Rank</label>
                        <select 
                          value={resultForm.rank}
                          onChange={(e) => setResultForm({...resultForm, rank: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none font-bold"
                        >
                          <option value="1">1st Place (Champion)</option>
                          <option value="2">2nd Place (Runner-up)</option>
                          <option value="3">3rd Place</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Prize Captured</label>
                        <input 
                          value={resultForm.prizeWon}
                          onChange={(e) => setResultForm({...resultForm, prizeWon: e.target.value})}
                          type="text" 
                          placeholder="e.g. ₹25,000"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-gold focus:border-gold outline-none font-black" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Elite Operator (MVP)</label>
                        <input 
                          value={resultForm.mvp}
                          onChange={(e) => setResultForm({...resultForm, mvp: e.target.value})}
                          type="text" 
                          placeholder="e.g. SKYLER_OP"
                          className="w-full bg-black/40 border border-white/10 p-3 text-sm text-white focus:border-gold outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest italic opacity-60">Evidence URL (Points Table)</label>
                        <input 
                          value={resultForm.pointsTableUrl}
                          onChange={(e) => setResultForm({...resultForm, pointsTableUrl: e.target.value})}
                          type="url" 
                          placeholder="https://..."
                          className="w-full bg-black/40 border border-white/10 p-3 text-xs text-neutral-400 focus:border-gold outline-none font-mono" 
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex gap-4">
                      <button type="submit" className="flex-1 bg-gold text-black py-4 text-xs font-black uppercase tracking-widest hover:bg-gold-light transition-all rounded-[2px] shadow-lg">
                        {editingResultId ? 'Update History' : 'Archive Result'}
                      </button>
                      {editingResultId && (
                        <button type="button" onClick={cancelForm} className="px-8 border border-white/10 text-white/40 hover:text-white text-xs font-black uppercase tracking-widest transition-all rounded-[2px]">
                          Discard
                        </button>
                      )}
                    </div>
                  </motion.form>
                )}

                <div className="space-y-4">
                  {results.length === 0 ? (
                    <div className="text-center py-32 bg-white/5 border border-white/5 rounded-sm">
                      <div className="text-neutral-600 uppercase tracking-[0.3em] text-xs font-bold">Archives Empty</div>
                      <div className="text-neutral-700 text-[10px] mt-2 italic">No match outcomes registered in database.</div>
                    </div>
                  ) : (
                    results.map(res => (
                      <div key={res.id} className="bg-neutral-900 border border-white/10 p-5 group hover:border-gold/30 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-gold/10 border border-gold/20 flex items-center justify-center font-bebas text-2xl text-gold">
                            #{res.rank}
                          </div>
                          <div>
                            <div className="text-white font-bebas text-2xl tracking-widest leading-none mb-1 group-hover:text-gold transition-colors">{res.teamName}</div>
                            <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">{res.tournamentName} • <span className="text-gold/80">{res.game}</span></div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[9px] text-neutral-600 font-mono uppercase tracking-tighter">Prize: {res.prizeWon || 'N/A'}</span>
                              <span className="text-[9px] text-neutral-600 font-mono uppercase tracking-tighter decoration-gold">MVP: {res.mvp || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                          <button 
                            onClick={() => startEditingResult(res)} 
                            className="flex-1 md:flex-none border border-white/10 bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteResult(res.id)} 
                            className="bg-red-600 text-white p-2.5 rounded-sm hover:bg-red-700 transition-colors border border-red-700 shadow-xl"
                            title="Permanent Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'registrations' && (
              <div className="space-y-8">
                 <div className="bg-white/5 p-6 border border-gold/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="w-full md:w-auto">
                       <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block italic opacity-60">Filter by Resource (Tournament)</label>
                       <select 
                         value={selectedTournamentForRegs || ''}
                         onChange={(e) => setSelectedTournamentForRegs(e.target.value)}
                         className="w-full md:w-80 bg-black/40 border border-gold/15 p-3 text-sm text-gold focus:border-gold outline-none font-bold"
                       >
                         {tournaments.map(t => (
                           <option key={t.id} value={t.id}>{t.name} ({t.game})</option>
                         ))}
                       </select>
                    </div>
                    {registrations.length > 0 && (
                      <button 
                        onClick={() => exportToCSV(registrations, `BTS_Registrations_${selectedTournamentForRegs}`)}
                        className="flex items-center gap-2 border border-gold/20 bg-gold/5 px-6 py-3 text-gold hover:bg-gold hover:text-black text-[10px] font-black uppercase tracking-widest transition-all rounded-[2px]"
                      >
                        <Download size={14} /> EXPORT PLAYER LIST
                      </button>
                    )}
                 </div>

                 {registrations.length === 0 ? (
                   <div className="text-center py-32 bg-white/5 border border-white/5 rounded-sm">
                      <div className="text-neutral-600 uppercase tracking-[0.3em] text-xs font-bold">No Operatives Registered</div>
                      <div className="text-neutral-700 text-[10px] mt-2 italic">Zero deployment data for this sector.</div>
                   </div>
                 ) : (
                   <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-gold/10 text-[9px] text-neutral-500 uppercase tracking-widest font-black">
                           <th className="px-4 py-4">Team Name</th>
                           <th className="px-4 py-4">Leader / IGN / Discord</th>
                           <th className="px-4 py-4">Squad Depth</th>
                           <th className="px-4 py-4">Contact</th>
                           <th className="px-4 py-4 text-right">Actions</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                         {registrations.map(reg => (
                           <tr key={reg.id} className="group hover:bg-white-[0.02] transition-all">
                             <td className="px-4 py-4">
                               <div className="text-white font-bebas text-xl tracking-widest">{reg.teamName}</div>
                               <div className="text-[8px] text-gold/60 uppercase font-bold tracking-tighter">Registered: {reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleDateString() : 'Recent'}</div>
                             </td>
                             <td className="px-4 py-4">
                               <div className="text-neutral-300 text-xs font-bold font-orbitron">{reg.leaderName}</div>
                               <div className="text-[9px] text-neutral-500 uppercase">{reg.ign} <span className="text-gold/60 mx-1">|</span> UID: {reg.playerId}</div>
                               <div className="text-[9px] text-[#7289DA] font-mono mt-0.5">{reg.discordId}</div>
                             </td>
                             <td className="px-4 py-4">
                               <div className="flex -space-x-1.5 flex-wrap gap-y-1">
                                  <div className="w-6 h-6 rounded-full bg-gold border border-black flex items-center justify-center text-[7px] font-black text-black z-10" title={`Leader: ${reg.ign}`}>L</div>
                                  {(reg.squad || []).map((member: any, i: number) => (
                                    <div 
                                      key={i} 
                                      className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[7px] font-black text-gold hover:bg-neutral-700 transition-colors cursor-help"
                                      title={`P${i+1}: ${member.ign || 'N/A'} (UID: ${member.uid || 'N/A'})`}
                                    >
                                      P{i+1}
                                    </div>
                                  ))}
                               </div>
                               <div className="text-[8px] text-neutral-600 mt-1 uppercase font-bold tracking-tighter">{(reg.squad?.length || 0) + 1} Total Operatives</div>
                             </td>
                             <td className="px-4 py-4">
                               <div className="text-[10px] text-neutral-400 font-mono italic">{reg.contact || 'N/A'}</div>
                             </td>
                             <td className="px-4 py-4 text-right">
                                <button 
                                  onClick={async () => {
                                    if (!confirm('Cancel this registration and free up the slot?')) return;
                                    try {
                                      // Note: In rules, typically we'd need a special admin path to update count easily if we delete
                                      // or just delete the registration and manually update the tournament doc.
                                      await deleteDoc(doc(db, 'tournaments', selectedTournamentForRegs!, 'registrations', reg.id));
                                      await updateDoc(doc(db, 'tournaments', selectedTournamentForRegs!), {
                                        slots: increment(-1)
                                      });
                                      onToast('Removed', 'Team entry deleted and slot regained.');
                                      fetchData();
                                    } catch (e) {
                                      reportFirestoreError(e, 'delete', `tournaments/${selectedTournamentForRegs}/registrations/${reg.id}`, onToast);
                                    }
                                  }}
                                  className="p-2 text-neutral-700 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                <SectionHeader 
                  tag="System Configuration" 
                  title="Global" 
                  goldSpan="Settings" 
                  sub="Manage the organization's public identity channels and social links."
                  className="!text-left !items-start"
                />

                <div className="max-w-2xl bg-neutral-900 border border-gold/15 p-8 md:p-12 space-y-8">
                   <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                          <Youtube size={14} className="text-red-500" /> YouTube Channel Link
                        </label>
                        <input 
                          value={socialLinksForm.youtube}
                          onChange={(e) => setSocialLinksForm({...socialLinksForm, youtube: e.target.value})}
                          placeholder="https://youtube.com/@..."
                          className="w-full bg-black/40 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none h-14 font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                          <Instagram size={14} className="text-pink-500" /> Instagram Profile Link
                        </label>
                        <input 
                          value={socialLinksForm.instagram}
                          onChange={(e) => setSocialLinksForm({...socialLinksForm, instagram: e.target.value})}
                          placeholder="https://instagram.com/..."
                          className="w-full bg-black/40 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none h-14 font-mono"
                        />
                      </div>
                   </div>

                   <button 
                     disabled={isSavingSettings}
                     onClick={saveSettings}
                     className="w-full bg-gold text-black py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all disabled:opacity-50"
                   >
                     {isSavingSettings ? 'Synchronizing Intelligence...' : 'Update Global Social Links'}
                   </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RankingPage = () => {
  const [rankedPlayers, setRankedPlayers] = useState<RankingPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'squad'), (snap) => {
      const players = snap.docs.map(doc => {
        const data = doc.data();
        const kills = parseInt(data.kills || '0');
        const matches = parseInt(data.matches || '0');
        const status = data.status || 'Active';
        
        // Ranking Algorithm: 
        // 1. Kills (100 pts)
        // 2. Matches (10 pts)
        // 3. Inactive penalty (-5000)
        let score = (kills * 100) + (matches * 10);
        if (status === 'Inactive') score -= 5000;

        return {
          id: doc.id,
          ...data,
          score
        } as any as RankingPlayer;
      });

      const sorted = players.sort((a, b) => b.score - a.score);
      setRankedPlayers(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching ranking:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="container mx-auto px-4 py-24">
      <SectionHeader 
        tag="Clan Excellence" 
        title="Operative" 
        goldSpan="Rankings" 
        sub="The definitive merit-based ranking of BTS eSports clan members. Points calculated via cross-operation kill counts, mission frequency, and tactical availability."
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full"
          />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="grid grid-cols-12 px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-white/5">
             <div className="col-span-1">Rank</div>
             <div className="col-span-3 lg:col-span-3">Operative</div>
             <div className="col-span-1 text-center hidden md:block">Sector</div>
             <div className="col-span-1 text-center font-mono">Scrims K/M</div>
             <div className="col-span-1 text-center font-mono">Tourney K/M</div>
             <div className="col-span-1 text-center font-mono">Open Room K/M</div>
             <div className="col-span-2 text-center font-mono">Total Kills/Matches</div>
             <div className="col-span-2 text-right">Combat Score</div>
          </div>

          {rankedPlayers.map((player, index) => (
            <motion.div 
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`grid grid-cols-12 items-center px-6 py-6 border border-white/5 group hover:border-gold/30 transition-all relative overflow-hidden ${
                index === 0 ? 'bg-gold/5 border-gold/20' : 'bg-neutral-900/50'
              }`}
            >
              <div className="col-span-1 font-orbitron font-black text-2xl">
                 <span className={index < 3 ? 'text-gold' : 'text-neutral-700'}>
                   #{index + 1}
                 </span>
              </div>

              <div className="col-span-3 lg:col-span-3 flex items-center gap-4">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bebas text-xl border hidden sm:flex ${
                   index === 0 ? 'bg-gold text-black border-gold' : 'bg-neutral-800 text-gold border-white/5'
                 }`}>
                   {player.ign.charAt(0)}
                 </div>
                 <div>
                    <div className="font-bebas text-xl text-white tracking-widest flex items-center gap-2">
                      {player.ign}
                      {player.status && player.status !== 'Active' && (
                        <span className={`text-[7px] px-1.5 py-0.5 border font-black uppercase tracking-tighter ${
                          player.status === 'On Trial' ? 'bg-blue-900/50 text-blue-400 border-blue-500/20' : 'bg-red-900/50 text-red-400 border-red-500/20'
                        }`}>
                          {player.status === 'Inactive' ? 'MIA' : player.status}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">{player.role}</div>
                 </div>
              </div>

              <div className="col-span-1 text-center hidden md:block">
                 <span className="text-[8px] font-black text-gold/80 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-[2px] border border-white/5">
                   {DIVISIONS[player.div]?.name || 'N/A'}
                 </span>
              </div>

              <div className="col-span-1 text-center">
                 <div className="text-[10px] text-white font-mono">{player.scrimsKills || 0}/{player.scrimsMatches || 0}</div>
                 <div className="text-[7px] text-neutral-600 font-black uppercase">Scrims</div>
              </div>

              <div className="col-span-1 text-center">
                 <div className="text-[10px] text-white font-mono">{player.tourneyKills || 0}/{player.tourneyMatches || 0}</div>
                 <div className="text-[7px] text-neutral-600 font-black uppercase">Tourney</div>
              </div>

              <div className="col-span-1 text-center">
                 <div className="text-[10px] text-white font-mono">{player.openRoomKills || 0}/{player.openRoomMatches || 0}</div>
                 <div className="text-[7px] text-neutral-600 font-black uppercase">Open</div>
              </div>

              <div className="col-span-2 text-center flex flex-col items-center">
                 <div className="font-orbitron font-bold text-white flex items-center gap-2">
                    {player.kills}/{player.matches}
                    {player.kdHistory && player.kdHistory.length > 1 && (
                      <span className={player.kdHistory[player.kdHistory.length - 1] >= player.kdHistory[player.kdHistory.length - 2] ? 'text-green-500' : 'text-red-500'}>
                        {player.kdHistory[player.kdHistory.length - 1] >= player.kdHistory[player.kdHistory.length - 2] ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      </span>
                    )}
                 </div>
                 <div className="text-[8px] font-bold text-neutral-500">KD: {player.kd}</div>
                 <div className="h-4 w-full mt-1 hidden lg:block">
                    {player.kdHistory && player.kdHistory.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={player.kdHistory.map((val, i) => ({ val, i }))}>
                          <Line type="monotone" dataKey="val" stroke={index === 0 ? "#000" : "#FFD700"} strokeWidth={1} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                 </div>
              </div>

              <div className="col-span-2 text-right">
                 <div className="font-orbitron font-black text-xl text-gold">{Math.floor(player.score).toLocaleString()}</div>
                 <div className="text-[8px] text-neutral-600 font-black uppercase tracking-widest">Efficiency Rating</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const RegistrationPage = ({ tournament, user, onNavigate, onToast }: { tournament: Tournament, user: User, onNavigate: (p: Page, d?: any) => void, onToast: (t: string, m: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    teamName: '',
    playerName: '',
    ign: '',
    playerId: '',
    discordId: '',
    contact: '',
    squad: [
      { ign: '', uid: '' },
      { ign: '', uid: '' },
      { ign: '', uid: '' },
      { ign: '', uid: '' },
      { ign: '', uid: '' },
      { ign: '', uid: '' }
    ],
    agree: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agree) {
      onToast('Error', 'You must agree to the tournament rules.');
      return;
    }

    setLoading(true);
    try {
      // 1. One registration per user per tournament (ID is uid)
      const regRef = doc(db, 'tournaments', tournament.id, 'registrations', user.uid);
      const regSnap = await getDoc(regRef);
      
      if (regSnap.exists()) {
        onToast('Already Registered', 'You have already registered for this tournament.');
        setLoading(false);
        return;
      }

      // 2. Check duplicate team name 
      const teamQuery = query(collection(db, 'tournaments', tournament.id, 'registrations'), where('teamName', '==', formData.teamName));
      const teamSnap = await getDocs(teamQuery);
      if (!teamSnap.empty) {
        onToast('Team Name Taken', 'This team name is already taken for this tournament.');
        setLoading(false);
        return;
      }

      // Validate Player ID (numeric or alphanumeric)
      const playerIdRegex = /^[a-zA-Z0-9]+$/;
      if (!playerIdRegex.test(formData.playerId.trim())) {
        onToast('Invalid ID', 'Player ID must be alphanumeric (Letters & Numbers only).');
        setLoading(false);
        return;
      }

      // 3. Check capacity
      if (tournament.slots >= tournament.total) {
        onToast('Tournament Full', 'No more slots available for this tournament.');
        setLoading(false);
        return;
      }

      // 4. Save registration
      await setDoc(regRef, {
        teamName: formData.teamName.trim(),
        playerName: formData.playerName.trim(),
        ign: formData.ign.trim(),
        playerId: formData.playerId.trim(),
        discordId: formData.discordId.trim(),
        contact: formData.contact.trim(),
        squad: formData.squad.filter(s => s.ign.trim() !== '' || s.uid.trim() !== ''),
        uid: user.uid,
        email: user.email,
        tournamentName: tournament.name,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 5. Update joined count
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        slots: increment(1)
      });

      setIsSuccess(true);
      onToast('Success ✅', 'Registration Successful. Good luck, Operative!');
    } catch (error) {
      console.error(error);
      onToast('Registration Error', 'Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="pt-32 pb-48 container mx-auto px-4 max-w-2xl text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-neutral-900 border border-gold/30 p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gold shadow-[0_0_20px_rgba(212,175,55,0.5)]" />
          <div className="w-20 h-20 bg-gold/10 border border-gold rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
             <Check size={40} className="text-gold" />
          </div>
          <h2 className="font-bebas text-5xl text-white tracking-[0.1em] mb-4">Registration Successful ✅</h2>
          <p className="text-neutral-400 text-sm font-mono mb-8 uppercase tracking-widest leading-relaxed">
            Deployment order confirmed for <span className="text-gold">{tournament.name}</span>. <br/>
            Confirmation signal transmitted to: <br/>
            <span className="text-white font-bold">{user.email}</span>
          </p>
          <div className="flex flex-col gap-4">
             <button 
               onClick={() => onNavigate('tournament')}
               className="btn-clip bg-gold text-black py-4 font-black uppercase tracking-widest hover:bg-white transition-colors"
             >
               Return to Battleground
             </button>
             <button 
               onClick={() => onNavigate('home')}
               className="text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
             >
               Back to Command Center
             </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-24 container mx-auto px-4 max-w-3xl pb-24">
      <div className="mb-12">
        <button 
          onClick={() => onNavigate('tournament')}
          className="text-neutral-500 hover:text-gold flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors mb-6"
        >
          <X size={14} /> Cancel Registration
        </button>
        <SectionHeader 
          tag="Deployment Portal" 
          title="Tournament" 
          goldSpan="Registration" 
          sub={`Registering for: ${tournament.name}`}
          className="!text-left"
        />
      </div>

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-8 bg-neutral-900/50 border border-gold/10 p-8 md:p-12"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Team Name *</label>
            <input 
              required
              value={formData.teamName}
              onChange={e => setFormData({...formData, teamName: e.target.value})}
              placeholder="e.g. BTS Warriors"
              className="w-full bg-black/40 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Player Name *</label>
            <input 
              required
              value={formData.playerName}
              onChange={e => setFormData({...formData, playerName: e.target.value})}
              placeholder="Your full name"
              className="w-full bg-black/40 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Email Address *</label>
            <input 
              disabled
              value={user.email || ''}
              className="w-full bg-black/20 border border-white/5 p-4 text-sm text-neutral-500 outline-none font-mono cursor-not-allowed"
            />
            <p className="text-[8px] text-neutral-600 uppercase font-bold">Auto-filled from profile for verification</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">In-Game Name (IGN) *</label>
            <input 
              required
              value={formData.ign}
              onChange={e => setFormData({...formData, ign: e.target.value})}
              placeholder="e.g. BTS•Sniper"
              className="w-full bg-black/40 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Player Character ID *</label>
            <input 
              required
              value={formData.playerId}
              onChange={e => setFormData({...formData, playerId: e.target.value})}
              placeholder="e.g. 5123456789"
              className="w-full bg-black/40 border border-white/10 p-4 text-sm text-gold focus:border-gold outline-none font-mono tracking-widest"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Discord ID (User#0000) *</label>
            <input 
              required
              value={formData.discordId}
              onChange={e => setFormData({...formData, discordId: e.target.value})}
              placeholder="e.g. Operative#1234"
              className="w-full bg-black/40 border border-white/10 p-4 text-sm text-[#7289DA] focus:border-[#7289DA] outline-none font-mono"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Contact Number (Optional)</label>
            <input 
              value={formData.contact}
              onChange={e => setFormData({...formData, contact: e.target.value})}
              placeholder="+91 XXXXX XXXXX"
              className="w-full bg-black/40 border border-white/10 p-4 text-sm text-white focus:border-gold outline-none font-mono"
            />
          </div>
        </div>

        <div className="space-y-6 pt-8 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gold uppercase tracking-[0.3em]">Squad Formation</label>
            <span className="text-[9px] text-neutral-600 uppercase font-bold tracking-tighter">Optional: Up to 6 additional operatives</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {formData.squad.map((member, i) => (
              <div key={i} className="space-y-2 group">
                <div className="flex justify-between items-center bg-white/5 px-3 py-1.5 border-l-2 border-gold/30">
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Player {i+1}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    value={member.ign}
                    onChange={e => {
                      const newSquad = [...formData.squad];
                      newSquad[i].ign = e.target.value;
                      setFormData({...formData, squad: newSquad});
                    }}
                    placeholder="IGN"
                    className="w-full bg-black/20 border border-white/5 p-3 text-[10px] text-white focus:border-gold/50 outline-none placeholder:text-neutral-700"
                  />
                  <input 
                    value={member.uid}
                    onChange={e => {
                      const newSquad = [...formData.squad];
                      newSquad[i].uid = e.target.value;
                      setFormData({...formData, squad: newSquad});
                    }}
                    placeholder="UID"
                    className="w-full bg-black/20 border border-white/5 p-3 text-[10px] text-gold/70 focus:border-gold/50 outline-none placeholder:text-neutral-700 font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8 space-y-6">
          <label className="flex items-start gap-4 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.agree}
              onChange={e => setFormData({...formData, agree: e.target.checked})}
              className="mt-1 w-4 h-4 border-white/10 bg-black/40 rounded-sm text-gold focus:ring-gold"
            />
            <span className="text-[10px] text-neutral-500 uppercase leading-snug group-hover:text-neutral-300 transition-colors">
              I agree to the <span className="text-gold">official tournament rules</span> and confirm that the provided information is correct. Any false data may lead to disqualification.
            </span>
          </label>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full btn-clip py-5 font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${
              loading ? 'bg-gold/50 cursor-not-allowed' : 'bg-gold text-black hover:bg-gold-light shadow-[0_0_20px_rgba(212,175,55,0.3)]'
            }`}
          >
            {loading ? (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
              />
            ) : (
              <>
                <Check size={18} /> Confirm Registration
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const navigate = (page: Page, data?: any) => {
    if (data) setSelectedTournament(data);
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('User');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string, msg: string, visible: boolean }>({ title: '', msg: '', visible: false });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Auto-redirect to registration if user was trying to register
      if (u && currentPage === 'signin' && selectedTournament) {
        setCurrentPage('registration');
      }
    });
    return () => unsubscribe();
  }, [currentPage, selectedTournament]);

  useEffect(() => {
    if (user) {
      const checkAdmin = async () => {
        try {
          // Fetch user role from users collection
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'User');
          } else {
            setUserRole('User');
          }

          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setIsAdmin(true);
            setAdminRole(adminDoc.data().role || 'Super Admin');
          } else if (user.email === 'argaming2020119@gmail.com') {
            setIsAdmin(true);
            setAdminRole('Super Admin');
          } else {
            setIsAdmin(false);
            setAdminRole(null);
          }
        } catch (e) {
          console.error("Admin check failed:", e);
          if (user.email === 'argaming2020119@gmail.com') {
            setIsAdmin(true);
            setAdminRole('Super Admin');
          } else {
            setIsAdmin(false);
            setAdminRole(null);
          }
        }
      };
      checkAdmin();
    } else {
      setIsAdmin(false);
      setAdminRole(null);
      setUserRole('User');
    }
  }, [user]);

  const showToast = (title: string, msg: string) => {
    setToast({ title, msg, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  const navLinks = useMemo(() => {
    const full = [
      { id: 'home', label: 'Home' },
      { id: 'tournament', label: 'Events' },
      { id: 'results', label: 'Results' },
      { id: 'ranking', label: 'Ranks' },
      { id: 'roster', label: 'Squad' },
      { id: 'recruitment', label: 'Join' },
      { id: 'management', label: 'Org' },
      { id: 'about', label: 'Info' },
    ];

    let base = full;
    
    // Standard User Restriction (logged in but only 'User' role)
    if (user && !isAdmin && userRole === 'User') {
      base = full.filter(link => ['home', 'tournament', 'recruitment', 'about'].includes(link.id));
    }

    if (isAdmin) {
      base.push({ id: 'admin', label: 'Deployment Portal' } as any);
    }
    return base;
  }, [isAdmin, userRole, user]);

  useEffect(() => {
    if (user && !isAdmin && userRole === 'User') {
      const allowed = ['home', 'tournament', 'recruitment', 'about', 'registration', 'signin'];
      if (!allowed.includes(currentPage)) {
        setCurrentPage('home');
      }
    }
  }, [currentPage, user, isAdmin, userRole]);

  return (
    <div className="min-h-screen bg-dark-bg font-sans selection:bg-gold selection:text-black scroll-smooth">
      <Toast 
        title={toast.title} 
        msg={toast.msg} 
        visible={toast.visible} 
        onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full h-16 z-[1000] bg-neutral-950/80 backdrop-blur-md border-b border-gold/10 px-4 md:px-8 flex items-center justify-between">
        <button 
          onClick={() => setCurrentPage('home')}
          className="font-orbitron font-black text-xl tracking-[0.2em] text-gold decoration-none"
        >
          BTS<span className="text-neon-red">⚡</span>ESPORTS
        </button>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setCurrentPage(link.id)}
              className={`px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] transition-all rounded-[2px] ${
                currentPage === link.id 
                  ? 'text-gold bg-gold/10 shadow-[inset_0_0_0_1px_rgba(255,215,0,0.2)]' 
                  : link.id === 'admin' 
                    ? 'text-gold border border-gold/40 hover:bg-gold/10 ml-2 animate-pulse' 
                    : 'text-neutral-500 hover:text-gold hover:bg-gold/5'
              }`}
            >
              {link.label}
            </button>
          ))}
          <button 
            onClick={() => setCurrentPage('signin')}
            className="ml-4 px-6 py-2 bg-gold text-black text-[11px] font-black uppercase tracking-[0.15em] rounded-[2px] hover:bg-gold-light transition-all"
          >
            {user ? 'Account' : 'Sign In'}
          </button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="lg:hidden text-gold p-2"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-0 w-full z-[999] bg-neutral-950/95 border-b border-gold/20 p-6 lg:hidden"
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    setCurrentPage(link.id);
                    setIsMenuOpen(false);
                  }}
                  className={`text-left font-black uppercase tracking-widest text-sm flex items-center justify-between group ${
                    currentPage === link.id 
                      ? 'text-gold' 
                      : link.id === 'admin' 
                        ? 'text-gold border-b border-gold/40 pb-1' 
                        : 'text-neutral-500'
                  }`}
                >
                  {link.label}
                  <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity`} />
                </button>
              ))}
              <div className="h-px bg-gold/10 my-2" />
              <button 
                onClick={() => {
                  setCurrentPage('signin');
                  setIsMenuOpen(false);
                }}
                className="w-full bg-gold text-black py-4 font-black uppercase tracking-widest rounded-sm text-sm"
              >
                {user ? 'Account' : 'Sign In'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {currentPage === 'home' && <Home onNavigate={navigate} onToast={showToast} userRole={userRole} isAdmin={isAdmin} user={user} />}
            {currentPage === 'tournament' && (
              <TournamentPage onToast={showToast} user={user} onNavigate={navigate} />
            )}
            {currentPage === 'registration' && selectedTournament && user && (
              <RegistrationPage tournament={selectedTournament} user={user} onNavigate={navigate} onToast={showToast} />
            )}
            {currentPage === 'results' && <ResultsPage onToast={showToast} isAdmin={isAdmin} />}
            {currentPage === 'ranking' && <RankingPage onToast={showToast} />}
            {currentPage === 'roster' && <RosterPage onToast={showToast} />}
            {currentPage === 'recruitment' && <RecruitmentPage onToast={showToast} user={user} />}
            {currentPage === 'management' && <ManagementPage isAdmin={isAdmin} onNavigate={setCurrentPage} />}
            {currentPage === 'about' && <AboutPage />}
            {currentPage === 'signin' && <SignInPage onToast={showToast} user={user} isAdmin={isAdmin} onNavigate={setCurrentPage} />}
            {currentPage === 'admin' && isAdmin && <AdminDashboard onToast={showToast} adminRole={adminRole} user={user} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-gold/10 pt-24 pb-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <div className="font-orbitron font-black text-2xl tracking-[0.2em] text-gold">BTS<span className="text-neon-red">⚡</span>ESPORTS</div>
              <p className="text-neutral-500 text-sm leading-relaxed">
                India's premier competitive gaming organization. Building the next generation of professional eSports talent through infrastructure, coaching, and discipline.
              </p>
              <div className="flex gap-4 items-center text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                <span>📍 Bangalore, India</span>
                <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                <span>🎮 Multiple Titles</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <h5 className="font-bebas text-lg text-gold tracking-widest uppercase underline decoration-neon-red/30 underline-offset-8">Quick Links</h5>
              <ul className="space-y-4">
                {navLinks.slice(0, 4).map(l => (
                  <li key={l.id}>
                    <button onClick={() => setCurrentPage(l.id)} className="text-neutral-500 hover:text-gold text-sm font-bold uppercase tracking-[0.1em] transition-colors">{l.label}</button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h5 className="font-bebas text-lg text-gold tracking-widest uppercase underline decoration-neon-red/30 underline-offset-8">Organization</h5>
              <ul className="space-y-4">
                {navLinks.slice(4).map(l => (
                  <li key={l.id}>
                    <button onClick={() => setCurrentPage(l.id)} className="text-neutral-500 hover:text-gold text-sm font-bold uppercase tracking-[0.1em] transition-colors">{l.label}</button>
                  </li>
                ))}
                <li>
                  <button onClick={() => setCurrentPage('signin')} className="text-neutral-500 hover:text-gold text-sm font-bold uppercase tracking-[0.1em] transition-colors">{user ? 'Account' : 'Sign In'}</button>
                </li>
              </ul>
            </div>

            <div className="space-y-6">
              <h5 className="font-bebas text-lg text-gold tracking-widest uppercase underline decoration-neon-red/30 underline-offset-8">Stay Connected</h5>
              <p className="text-neutral-500 text-sm">Join our newsletter for the latest tournament announcements and squad updates.</p>
              <div className="flex">
                <input type="email" placeholder="Email Address" className="bg-white/5 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:border-gold w-full" />
                <button className="bg-gold text-black px-4 font-black uppercase tracking-widest text-[10px]">Join</button>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
              © 2025 BTS eSports. All rights reserved. Professionalism in Gaming.
            </div>
            
            <div className="flex gap-4">
              {[
                { icon: <Instagram size={18}/>, label: 'Instagram', url: 'https://www.instagram.com/bts__esports' },
                { icon: <Youtube size={18}/>, label: 'YouTube', url: 'https://youtube.com/@btsesportsofficial' },
                { icon: <MessageSquare size={18}/>, label: 'Discord', url: 'https://discord.gg/btsesports' },
                { icon: <Smartphone size={18}/>, label: 'WhatsApp', url: '#' },
              ].map((social, i) => (
                <a 
                  key={i}
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 border border-white/10 flex items-center justify-center text-neutral-500 hover:border-gold hover:text-gold transition-all duration-300 transform hover:-translate-y-1"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
