import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sliders, 
  Trophy, 
  FileSpreadsheet, 
  Award, 
  Users, 
  UserPlus, 
  Shield, 
  Info, 
  Cpu, 
  Play, 
  Flame, 
  MessageSquare, 
  AlertTriangle, 
  Check, 
  RotateCcw, 
  Radio, 
  Globe, 
  Zap, 
  ExternalLink,
  Lock,
  Megaphone,
  Layers,
  Activity,
  Save,
  Gamepad2,
  Bell
} from 'lucide-react';
import { WebsiteModules, DEFAULT_WEBSITE_MODULES } from '../types';

interface WebsiteModulesManagerProps {
  modules: WebsiteModules;
  onSave: (modules: WebsiteModules) => Promise<void>;
  isSaving: boolean;
  onToast: (title: string, msg: string) => void;
}

export const WebsiteModulesManager: React.FC<WebsiteModulesManagerProps> = ({
  modules,
  onSave,
  isSaving,
  onToast
}) => {
  const [formData, setFormData] = useState<WebsiteModules>({
    ...DEFAULT_WEBSITE_MODULES,
    ...modules
  });

  useEffect(() => {
    setFormData({
      ...DEFAULT_WEBSITE_MODULES,
      ...modules
    });
  }, [modules]);

  const toggleModule = (key: keyof WebsiteModules) => {
    setFormData(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePreset = (presetName: 'all' | 'tournament' | 'recruitment' | 'minimal' | 'maintenance') => {
    if (presetName === 'all') {
      setFormData({
        ...DEFAULT_WEBSITE_MODULES,
        tournaments: true,
        results: true,
        ranking: true,
        roster: true,
        recruitment: true,
        management: true,
        about: true,
        aiStats: true,
        liveStream: true,
        matchCenter: true,
        scrims: true,
        highlights: true,
        achievements: true,
        registrations: true,
        discordIntegration: true,
        maintenanceMode: false
      });
      onToast('Preset Applied', 'All modules activated across the whole website.');
    } else if (presetName === 'tournament') {
      setFormData(prev => ({
        ...prev,
        tournaments: true,
        registrations: true,
        results: true,
        ranking: true,
        matchCenter: true,
        liveStream: true,
        highlights: true,
        discordIntegration: true,
        maintenanceMode: false,
        announcementBanner: true,
        announcementText: '🏆 Tournament Championship Series is now live! Register your squad.',
        announcementLink: 'tournament',
        announcementType: 'gold'
      }));
      onToast('Preset Applied', 'Tournament Season preset configured.');
    } else if (presetName === 'recruitment') {
      setFormData(prev => ({
        ...prev,
        recruitment: true,
        roster: true,
        about: true,
        management: true,
        achievements: true,
        aiStats: true,
        tournaments: true,
        registrations: false,
        maintenanceMode: false,
        announcementBanner: true,
        announcementText: '🎯 Official Roster Scouting is open! Apply to join Alpha Esports.',
        announcementLink: 'recruitment',
        announcementType: 'cyan'
      }));
      onToast('Preset Applied', 'Roster & Recruitment preset configured.');
    } else if (presetName === 'minimal') {
      setFormData(prev => ({
        ...prev,
        tournaments: false,
        registrations: false,
        results: false,
        ranking: false,
        roster: true,
        recruitment: false,
        management: false,
        about: true,
        aiStats: false,
        liveStream: false,
        matchCenter: false,
        scrims: false,
        highlights: false,
        achievements: true,
        maintenanceMode: false
      }));
      onToast('Preset Applied', 'Minimal Core Mode activated.');
    } else if (presetName === 'maintenance') {
      setFormData(prev => ({
        ...prev,
        maintenanceMode: true,
        maintenanceMessage: 'Alpha Esports Grid is currently undergoing scheduled tactical maintenance. Public access will be restored shortly.'
      }));
      onToast('Preset Applied ⚠️', 'Maintenance Lockdown mode enabled in preview. Click Save to deploy.');
    }
  };

  const handleSave = async () => {
    await onSave(formData);
  };

  const activeCount = [
    formData.tournaments,
    formData.results,
    formData.ranking,
    formData.roster,
    formData.recruitment,
    formData.management,
    formData.about,
    formData.aiStats,
    formData.liveStream,
    formData.matchCenter,
    formData.scrims,
    formData.highlights,
    formData.achievements,
    formData.registrations,
    formData.discordIntegration
  ].filter(Boolean).length;

  return (
    <div className="space-y-8 animate-fade-in" id="website-modules-manager">
      {/* Header & Quick Action Presets */}
      <div className="bg-neutral-900 border border-gold/20 p-6 md:p-8 rounded-sm relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/10 border border-gold/30 rounded-full text-[10px] font-black tracking-widest text-gold uppercase">
              <Sliders size={12} className="text-gold animate-spin-slow" /> Global System Architecture
            </div>
            <h2 className="font-bebas text-3xl md:text-5xl text-white tracking-widest leading-none">
              Website <span className="text-gold">Modules</span> Control Grid
            </h2>
            <p className="text-neutral-400 text-xs max-w-2xl leading-relaxed">
              Dynamically activate, pause, or customize every public and operational module on the website in real-time. Changes instantly propagate across the navbar, home showcase, footer links, and route access permissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3.5 bg-gold text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(255,215,0,0.3)] disabled:opacity-50 flex items-center gap-2"
              id="save-modules-top-btn"
            >
              <Save size={14} />
              {isSaving ? 'PROPAGATING...' : 'SAVE & DEPLOY WHOLE SITE'}
            </button>
          </div>
        </div>

        {/* Quick Presets Selector */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Layers size={13} className="text-gold" /> One-Click Architectural Presets:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => handlePreset('all')}
              className="px-3.5 py-2.5 bg-black/50 border border-white/10 hover:border-gold hover:text-gold text-white text-[10px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 text-center"
            >
              <Check size={12} className="text-green-400" /> Full Grid Active
            </button>
            <button
              type="button"
              onClick={() => handlePreset('tournament')}
              className="px-3.5 py-2.5 bg-black/50 border border-white/10 hover:border-gold hover:text-gold text-white text-[10px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 text-center"
            >
              <Trophy size={12} className="text-gold" /> Tournament Season
            </button>
            <button
              type="button"
              onClick={() => handlePreset('recruitment')}
              className="px-3.5 py-2.5 bg-black/50 border border-white/10 hover:border-gold hover:text-gold text-white text-[10px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 text-center"
            >
              <UserPlus size={12} className="text-cyan-400" /> Roster & Scouting
            </button>
            <button
              type="button"
              onClick={() => handlePreset('minimal')}
              className="px-3.5 py-2.5 bg-black/50 border border-white/10 hover:border-gold hover:text-gold text-white text-[10px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 text-center"
            >
              <Shield size={12} className="text-neutral-400" /> Minimal Core
            </button>
            <button
              type="button"
              onClick={() => handlePreset('maintenance')}
              className="px-3.5 py-2.5 bg-red-950/30 border border-red-500/30 hover:border-red-500 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 text-center col-span-2 sm:col-span-1"
            >
              <AlertTriangle size={12} className="text-red-500" /> Maintenance Mode
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Lockdown / Maintenance Mode Bar */}
      <div className={`border p-6 rounded-sm transition-all ${formData.maintenanceMode ? 'bg-red-950/40 border-red-500/60 shadow-[0_0_30px_rgba(255,34,68,0.15)]' : 'bg-neutral-900/60 border-white/10'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center shrink-0 ${formData.maintenanceMode ? 'bg-red-500 text-black' : 'bg-white/5 text-neutral-400'}`}>
              <Lock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bebas text-2xl text-white tracking-wider">Tactical Lockdown / Maintenance Mode</h3>
                {formData.maintenanceMode ? (
                  <span className="px-2.5 py-0.5 bg-red-500 text-black text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse">
                    ACTIVE LOCKDOWN
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest border border-green-500/30 rounded-full">
                    SYSTEMS ONLINE
                  </span>
                )}
              </div>
              <p className="text-neutral-400 text-xs mt-1">
                When enabled, all public visitor routes display a branded maintenance terminal. Super Admins and logged-in Command Staff retain full backend access.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={formData.maintenanceMode} 
              onChange={() => toggleModule('maintenanceMode')} 
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {formData.maintenanceMode && (
          <div className="mt-4 pt-4 border-t border-red-500/20 space-y-2">
            <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Public Maintenance Message Notice:</label>
            <textarea
              value={formData.maintenanceMessage || ''}
              onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
              rows={2}
              className="w-full bg-black/60 border border-red-500/40 p-3 text-xs text-white focus:border-red-400 outline-none font-mono"
              placeholder="Enter message for public visitors..."
            />
          </div>
        )}
      </div>

      {/* Global Announcement Marquee Bar Module */}
      <div className={`border p-6 rounded-sm transition-all ${formData.announcementBanner ? 'bg-neutral-900 border-gold/40 shadow-[0_0_25px_rgba(255,215,0,0.08)]' : 'bg-neutral-900/60 border-white/10'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center shrink-0 ${formData.announcementBanner ? 'bg-gold text-black' : 'bg-white/5 text-neutral-400'}`}>
              <Megaphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bebas text-2xl text-white tracking-wider">Global Announcement Broadcast Bar</h3>
                {formData.announcementBanner ? (
                  <span className="px-2.5 py-0.5 bg-gold text-black text-[9px] font-black uppercase tracking-widest rounded-full">
                    BROADCASTING
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-neutral-800 text-neutral-400 text-[9px] font-black uppercase tracking-widest border border-white/10 rounded-full">
                    OFFLINE
                  </span>
                )}
              </div>
              <p className="text-neutral-400 text-xs mt-1">
                Displays a prominent tactical announcement banner across the top of the entire website.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={formData.announcementBanner} 
              onChange={() => toggleModule('announcementBanner')} 
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gold"></div>
          </label>
        </div>

        {formData.announcementBanner && (
          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Broadcast Message:</label>
              <input
                type="text"
                value={formData.announcementText || ''}
                onChange={(e) => setFormData({ ...formData, announcementText: e.target.value })}
                placeholder="e.g. 🔥 BGMI Season 7 Registrations are now LIVE! Prize Pool: ₹50,000"
                className="w-full bg-black/60 border border-white/10 p-3 text-xs text-white focus:border-gold outline-none font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Action Link (Optional):</label>
              <select
                value={formData.announcementLink || ''}
                onChange={(e) => setFormData({ ...formData, announcementLink: e.target.value })}
                className="w-full bg-black/60 border border-white/10 p-3 text-xs text-white focus:border-gold outline-none"
              >
                <option value="">No Action Button</option>
                <option value="tournament">Tournaments Portal (/tournament)</option>
                <option value="recruitment">Recruitment Form (/recruitment)</option>
                <option value="results">Results Center (/results)</option>
                <option value="ranking">Leaderboard (/ranking)</option>
                <option value="roster">Pro Squad (/roster)</option>
                <option value="about">About Dossier (/about)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Categorized Website Modules Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bebas text-2xl text-white tracking-widest flex items-center gap-2">
            <Globe size={18} className="text-gold" /> Public & Core Website Modules ({activeCount} / 15 Active)
          </h3>
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
            Individual Toggles
          </span>
        </div>

        {/* Section 1: Competitive & Tournament Infrastructure */}
        <div className="space-y-3">
          <div className="text-[11px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
            <Trophy size={14} /> Competitive & Tournament Systems
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tournaments Portal */}
            <ModuleCard
              title="Tournaments & Events"
              route="/tournament"
              desc="Public tournaments directory, bracket visualization, match details, and schedule."
              icon={<Trophy className="text-gold" size={20} />}
              active={formData.tournaments}
              onToggle={() => toggleModule('tournaments')}
            />

            {/* Registrations Module */}
            <ModuleCard
              title="Squad Registrations"
              route="Global / Reg Engine"
              desc="Enables team and solo registration submissions, UID verification, and discord dispatch."
              icon={<FileSpreadsheet className="text-green-400" size={20} />}
              active={formData.registrations}
              onToggle={() => toggleModule('registrations')}
              badge="CRITICAL"
            />

            {/* Results & Standings */}
            <ModuleCard
              title="Results & Standings"
              route="/results"
              desc="Public match results archive, prize distribution records, and champion podiums."
              icon={<Award className="text-yellow-400" size={20} />}
              active={formData.results}
              onToggle={() => toggleModule('results')}
            />

            {/* Circuit Rankings */}
            <ModuleCard
              title="Rankings & Leaderboard"
              route="/ranking"
              desc="Division tier rankings, top fragger ladders, and overall points leaderboard."
              icon={<Activity className="text-cyan-400" size={20} />}
              active={formData.ranking}
              onToggle={() => toggleModule('ranking')}
            />

            {/* Live Match Center */}
            <ModuleCard
              title="Live Match Center"
              route="Home & Match Feed"
              desc="Real-time match scoring, simulation telemetry, and spectator intelligence chat feed."
              icon={<Radio className="text-red-400" size={20} />}
              active={formData.matchCenter}
              onToggle={() => toggleModule('matchCenter')}
            />

            {/* Scrims Hub */}
            <ModuleCard
              title="Daily Scrims Hub"
              route="Scrims Center"
              desc="Tier 1/2 practice scrim schedule, slot bookings, and room coordination."
              icon={<Shield className="text-purple-400" size={20} />}
              active={formData.scrims}
              onToggle={() => toggleModule('scrims')}
            />
          </div>
        </div>

        {/* Section 2: Organization & Roster Infrastructure */}
        <div className="space-y-3 pt-4">
          <div className="text-[11px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
            <Users size={14} /> Organization & Squad Systems
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pro Squad & Roster */}
            <ModuleCard
              title="Pro Squad & Lineups"
              route="/roster"
              desc="Active esports lineups, player cards, K/D telemetry, and individual statistics."
              icon={<Users className="text-blue-400" size={20} />}
              active={formData.roster}
              onToggle={() => toggleModule('roster')}
            />

            {/* Recruitment Portal */}
            <ModuleCard
              title="Recruitment & Tryouts"
              route="/recruitment"
              desc="Public player tryout application forms, role preferences, and scouting pipeline."
              icon={<UserPlus className="text-emerald-400" size={20} />}
              active={formData.recruitment}
              onToggle={() => toggleModule('recruitment')}
            />

            {/* Management & Command Center */}
            <ModuleCard
              title="Org Management"
              route="/management"
              desc="Command staff hierarchy, executive leadership, founders, and division managers."
              icon={<Shield className="text-amber-400" size={20} />}
              active={formData.management}
              onToggle={() => toggleModule('management')}
            />

            {/* About Organization */}
            <ModuleCard
              title="About & Intel Hub"
              route="/about"
              desc="Organization mission profile, historical timeline, facility stats, and official rulebooks."
              icon={<Info className="text-sky-400" size={20} />}
              active={formData.about}
              onToggle={() => toggleModule('about')}
            />

            {/* Trophy Room / Achievements */}
            <ModuleCard
              title="Trophy Room & Accolades"
              route="Accolades Showcase"
              desc="Championship silverware, verified tournament victories, and organization medals."
              icon={<Trophy className="text-amber-300" size={20} />}
              active={formData.achievements}
              onToggle={() => toggleModule('achievements')}
            />

            {/* AI Screenshot OCR Stats */}
            <ModuleCard
              title="AI Combat Analytics"
              route="/screenshot-stats"
              desc="Gemini-powered end-screen OCR scoreboard digitizer and tactical player analysis."
              icon={<Cpu className="text-pink-400" size={20} />}
              active={formData.aiStats}
              onToggle={() => toggleModule('aiStats')}
              badge="AI GEMINI"
            />
          </div>
        </div>

        {/* Section 3: Media & Real-Time Broadcast Infrastructure */}
        <div className="space-y-3 pt-4">
          <div className="text-[11px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
            <Play size={14} /> Media, Streams & Integrations
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Live Broadcast Stream */}
            <ModuleCard
              title="Live Stream Broadcast"
              route="YouTube Stream Overlay"
              desc="Live broadcast overlay banner across homepage and tournament centers when streaming."
              icon={<Play className="text-red-500" size={20} />}
              active={formData.liveStream}
              onToggle={() => toggleModule('liveStream')}
            />

            {/* Video Highlights & Clips */}
            <ModuleCard
              title="Highlights & Clips"
              route="Intel Highlights"
              desc="Curated tournament clutches, squad wipes, sniper montages, and video showcases."
              icon={<Flame className="text-orange-400" size={20} />}
              active={formData.highlights}
              onToggle={() => toggleModule('highlights')}
            />

            {/* Discord Webhook Integration */}
            <ModuleCard
              title="Discord Webhook Dispatch"
              route="Webhook Automation"
              desc="Automated formatted rich embeds dispatched to Discord channels upon registration."
              icon={<MessageSquare className="text-indigo-400" size={20} />}
              active={formData.discordIntegration}
              onToggle={() => toggleModule('discordIntegration')}
              badge="DISPATCH"
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Save Action */}
      <div className="bg-neutral-900 border-t border-gold/30 p-4 md:p-6 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-40 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gold animate-ping" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Ready to update website configuration matrix across all client sessions
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handlePreset('all')}
            className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-black uppercase tracking-widest rounded-sm transition-all"
          >
            Reset All On
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none px-8 py-3.5 bg-gold text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(255,215,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
            id="save-modules-bottom-btn"
          >
            <Save size={14} />
            {isSaving ? 'SAVING & PROPAGATING...' : 'SAVE & PROPAGATE WHOLE SITE'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModuleCardProps {
  title: string;
  route: string;
  desc: string;
  icon: React.ReactNode;
  active: boolean;
  onToggle: () => void;
  badge?: string;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  route,
  desc,
  icon,
  active,
  onToggle,
  badge
}) => {
  return (
    <div 
      onClick={onToggle}
      className={`border p-5 rounded-sm cursor-pointer transition-all flex flex-col justify-between select-none relative group ${
        active 
          ? 'bg-neutral-900/90 border-gold/30 hover:border-gold/60 shadow-[0_0_15px_rgba(255,215,0,0.05)]' 
          : 'bg-black/40 border-white/5 opacity-60 hover:opacity-85'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${active ? 'bg-white/5 border border-white/10' : 'bg-white/5 text-neutral-600'}`}>
              {icon}
            </div>
            <div>
              <h4 className={`font-bebas text-xl tracking-wider ${active ? 'text-white' : 'text-neutral-400'}`}>
                {title}
              </h4>
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider block">
                {route}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className={`text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rounded-sm ${
              active 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-neutral-800 text-neutral-500 border border-white/5'
            }`}>
              {active ? 'ONLINE' : 'OFFLINE'}
            </span>
            {badge && (
              <span className="text-[7px] font-black px-1.5 py-0.2 bg-gold/15 text-gold border border-gold/30 uppercase tracking-widest">
                {badge}
              </span>
            )}
          </div>
        </div>

        <p className="text-neutral-400 text-[11px] leading-relaxed mb-4">
          {desc}
        </p>
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest group-hover:text-gold transition-colors">
          {active ? 'Click to Disable' : 'Click to Enable'}
        </span>

        <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
          <input 
            type="checkbox" 
            checked={active} 
            onChange={() => {}} 
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
        </label>
      </div>
    </div>
  );
};
