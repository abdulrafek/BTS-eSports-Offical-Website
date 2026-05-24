import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, FileImage, Cpu, Eye, CheckCircle2, ShieldCheck, 
  Trash2, Database, Search, ArrowRight, Play, Trophy, 
  LineChart as LucideLineChart, Filter, RefreshCw, LogIn, ExternalLink, HardDrive
} from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, where, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, googleProvider } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { GAME_DATA } from './constants';

interface ExtractedStats {
  kills: number;
  matches: number;
  deaths?: number;
  wins?: number;
  kd?: number;
  playerName?: string;
  imageDriveId?: string;
  imageDriveLink?: string;
  gameName?: string;
  timestamp?: any;
  map?: string;
  category?: string;
  uid?: string;
  division?: string;
}

interface SavedRow extends ExtractedStats {
  id: string;
}

// Google Drive folder management utility helper
async function getOrCreateFolder(name: string, parentId: string = 'root', token: string): Promise<string> {
  const queryStr = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryStr)}&fields=files(id)`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Google Drive folder search failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id; // Folder exists
  }

  // Create folder
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Google Drive folder creation failed: ${createResponse.statusText}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

export function ScreenshotStatsPage({ onToast }: { onToast: (t: string, m: string) => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'analyzing' | 'saving' | 'done'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // OCR processing results state
  const [results, setResults] = useState<ExtractedStats | null>(null);
  const [gameSelection, setGameSelection] = useState<string>('BGMI / PUBG');
  const [customPlayerName, setCustomPlayerName] = useState<string>('');
  const [mapSelection, setMapSelection] = useState<string>('Erangel');
  const [categorySelection, setCategorySelection] = useState<string>('Scrims');

  // Division state for Tournament classifications
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('General');
  const [customDivisionName, setCustomDivisionName] = useState<string>('');

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'divisions'), orderBy('name')));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setDivisions(list);
        if (list.length > 0) {
          setSelectedDivision(list[0].name);
        }
      } catch (err) {
        console.error("Error fetching divisions for stats organizer:", err);
      }
    };
    fetchDivisions();
  }, []);

  const activeDivisionName = selectedDivision === 'Custom' ? (customDivisionName || 'General') : selectedDivision;

  useEffect(() => {
    if (gameSelection === 'BGMI / PUBG') {
      setMapSelection('Erangel');
    } else if (gameSelection === 'Valorant') {
      setMapSelection('Ascent');
    } else if (gameSelection === 'Free Fire') {
      setMapSelection('Bermuda');
    }
  }, [gameSelection]);

  // Loaded database tracker rows
  const [history, setHistory] = useState<SavedRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGame, setFilterGame] = useState('All');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Authentication & OAuth
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Synchronize Firebase auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Fetch tracked historical stats
  const fetchStatsHistory = async () => {
    setHistoryLoading(true);
    try {
      const colRef = collection(db, 'player_screenshot_stats');
      const q = query(colRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const rows: SavedRow[] = [];
      snap.forEach((docSnap) => {
        rows.push({ id: docSnap.id, ...docSnap.data() } as SavedRow);
      });
      setHistory(rows);
    } catch (e: any) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsHistory();
  }, []);

  // Trigger Google Drive token request
  const handleAuthAndToken = async () => {
    try {
      setAuthError(null);
      // Ensure we request the explicit Drive Scope required
      googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result) || (result as any)._credential || (result as any).credential;
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        onToast('Google Drive Active', 'Clearance grant identified. Connected to cloud storage!');
      } else {
        throw new Error('Could not acquire access token from Sign-In. Try again.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'OAuth Connection Failed.');
      onToast('Access Required', 'Cleared scope failed or popup blocked. Verify browser permissions.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setupFile(e.dataTransfer.files[0]);
    }
  };

  const setupFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onToast('Invalid File', 'Please select a valid image file (PNG / JPEG).');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setResults(null);
    setUploadProgress('idle');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setupFile(e.target.files[0]);
    }
  };

  // Convert File to base64 for safe API transport
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const processImageOCR = async () => {
    if (!selectedFile) return;
    setUploadProgress('analyzing');
    try {
      const base64Str = await getBase64(selectedFile);
      const res = await fetch('/api/process-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Str,
          mimeType: selectedFile.type
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Stat analysis failed.');
      }
      const data = await res.json();
      if (data.success && data.stats) {
        setResults({
          ...data.stats,
          map: data.stats.map || mapSelection,
          category: data.stats.category || categorySelection
        });
        if (data.stats.playerName) {
          setCustomPlayerName(data.stats.playerName);
        }
        onToast('Analysis Completed', 'Gameplay metrics captured successfully!');
      } else {
        throw new Error('Response did not contain valid stats elements.');
      }
    } catch (e: any) {
      console.error(e);
      onToast('OCR processing failed', e.message || 'Incompatible layout format.');
      setUploadProgress('idle');
    }
  };

  // Upload parsed image and stats to Google Drive & Firestore
  const uploadAndConfirmStats = async () => {
    if (!selectedFile || !results) return;
    setUploadProgress('saving');

    let imageDriveId = '';
    let imageDriveLink = '';

    // Step A: Check if we have active Google Drive clearance authorization
    if (accessToken) {
      try {
        const base64Data = previewUrl?.split(',')[1] || '';
        // 1. Convert base64 to Blob object
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: selectedFile.type });

        // Build Google Drive Folder Structure
        let targetFolderId = 'root';
        try {
          // Normalize Match Category with exact folder names requested by user
          let folderName = 'scrim';
          const matchCategory = results.category || categorySelection || 'Scrims';
          if (matchCategory === 'Tournament') {
            folderName = 'Tournament';
          } else if (matchCategory === 'Open Room Match' || matchCategory === 'Open Room-Match') {
            folderName = 'open Room match';
          }

          // Search or create top-level category folder
          const topFolderId = await getOrCreateFolder(folderName, 'root', accessToken);

          // If Tournament, create individual division folder inside the top-level Tournament folder
          if (matchCategory === 'Tournament') {
            const divLabel = (results.division || activeDivisionName || 'General').trim();
            targetFolderId = await getOrCreateFolder(divLabel, topFolderId, accessToken);
          } else {
            targetFolderId = topFolderId;
          }
        } catch (folderError) {
          console.error("Error organizing Google Drive folders:", folderError);
          onToast('Folder Organization Error', 'Failed to organize folders, saving to root Drive path instead.');
          targetFolderId = 'root';
        }

        // 2. Prepare multipart metadata payload for Google Drive Upload API
        const metadata = {
          name: `BTS_StatsScreenshot_${Date.now()}.${selectedFile.name.split('.').pop()}`,
          mimeType: selectedFile.type,
          description: `Automatically compiled gameplay stat file tracking. Game: ${gameSelection}. Category: ${results.category || categorySelection}.`,
          parents: [targetFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', imageBlob);

        const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: form
        });

        if (!driveRes.ok) {
          throw new Error('Google Drive API returned non-200 transaction code.');
        }

        const driveData = await driveRes.json();
        if (driveData.id) {
          imageDriveId = driveData.id;
          imageDriveLink = driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`;
        }
      } catch (err: any) {
        console.error("Drive upload error", err);
        onToast('Drive Upload Failed', 'Could not upload to Google Drive. Will backup locally.');
      }
    }

    // Step B: Save directly into Firestore Searchable DB
    try {
      const payload: ExtractedStats = {
        kills: Number(results.kills || 0),
        matches: Number(results.matches || 0),
        deaths: Number(results.deaths || 0),
        wins: Number(results.wins || 0),
        kd: Number(results.kd || 0) || (results.deaths ? Number((results.kills / results.deaths).toFixed(2)) : Number(results.kills)),
        playerName: (customPlayerName || results.playerName || 'Anonymous Driver').trim(),
        gameName: gameSelection,
        imageDriveId,
        imageDriveLink,
        timestamp: serverTimestamp(),
        map: results.map || mapSelection || 'Erangel',
        category: results.category || categorySelection || 'Scrims',
        uid: auth.currentUser?.uid || '',
        division: results.category === 'Tournament' ? (results.division || activeDivisionName || 'General') : ''
      };

      await addDoc(collection(db, 'player_screenshot_stats'), payload);
      onToast('Stats Vaulted', 'Metrics processed and archived into our searchable index.');
      setUploadProgress('done');
      setSelectedFile(null);
      setPreviewUrl(null);
      setResults(null);
      fetchStatsHistory();
    } catch (e: any) {
      console.error(e);
      onToast('Database Save Error', e.message || 'Cleared vault failed.');
      setUploadProgress('idle');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently erase this stat trace tracking row?')) return;
    try {
      await deleteDoc(doc(db, 'player_screenshot_stats', id));
      onToast('Erase trace', 'Record purged from player metrics tracking ledger.');
      fetchStatsHistory();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter historical lists
  const filteredHistory = history.filter((row) => {
    const matchSearch = (row.playerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (row.gameName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterGame === 'All' || row.gameName === filterGame;
    return matchSearch && matchFilter;
  });

  return (
    <div className="pt-24 pb-16 px-4 md:px-8 max-w-7xl mx-auto min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      
      {/* Visual Title Header */}
      <div className="mb-12 border-b border-gold/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="font-orbitron font-black text-3xl tracking-[0.2em] text-gold uppercase">
            Stat Screenshot Tracker
          </h1>
          <p className="text-xs text-neutral-400 mt-2 font-mono tracking-wider max-w-2xl">
            Upload match stats, lobby details, or career overview screenshots. 
            Gemini parses matches played/kills, exports to Drive, and logs data into searchable indexes.
          </p>
        </div>

        {/* OAuth Authentication Button Container */}
        <div>
          {!accessToken ? (
            <button
              onClick={handleAuthAndToken}
              className="flex items-center gap-2 px-4 py-2 border border-gold/40 text-gold bg-gold/5 rounded-[2px] font-orbitron font-bold text-[10px] tracking-wider uppercase hover:bg-gold/10 transition-all cursor-pointer"
            >
              <HardDrive size={12} className="animate-pulse text-gold" />
              Authorize Google Drive Backup
            </button>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-4 py-2 rounded-[2px] text-[10px] font-orbitron font-bold tracking-wider uppercase">
              <CheckCircle2 size={12} />
              Drive Integration Armed
            </div>
          )}
          {authError && (
            <p className="text-[10px] text-red-400 font-mono mt-1 max-w-xs">{authError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Image Upload & OCR Action Hub */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-[2px]">
            <h2 className="font-orbitron font-black text-sm tracking-widest text-white mb-4 uppercase flex items-center gap-2">
              <FileImage size={14} className="text-gold" /> Upload Screenshot
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-400 font-mono tracking-widest mb-1.5">
                  TARGET GAME REGION
                </label>
                <select
                  value={gameSelection}
                  onChange={(e) => setGameSelection(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs px-3 py-2 text-neutral-300 focus:border-gold/50 outline-none mb-3"
                >
                  <option value="BGMI / PUBG">BGMI / PUBG Mobile</option>
                  <option value="Valorant">Valorant Mobile / PC</option>
                  <option value="Free Fire">Garena Free Fire</option>
                </select>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-neutral-400 font-mono tracking-widest mb-1">
                      MATCH CATEGORY
                    </label>
                    <select
                      value={categorySelection}
                      onChange={(e) => setCategorySelection(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 text-[11px] px-3 py-2 text-neutral-300 focus:border-gold/50 outline-none"
                    >
                      <option value="Scrims">Scrims</option>
                      <option value="Tournament">Tournament</option>
                      <option value="Open Room Match">Open Room Match</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-neutral-400 font-mono tracking-widest mb-1">
                      MAP SELECTION
                    </label>
                    <select
                      value={mapSelection}
                      onChange={(e) => setMapSelection(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 text-[11px] px-3 py-2 text-neutral-300 focus:border-gold/50 outline-none"
                    >
                      {(gameSelection === 'BGMI / PUBG' ? ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Karakin', 'Rondo', 'Livik'] :
                        gameSelection === 'Valorant' ? ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'] :
                        ['Bermuda', 'Remastered', 'Purgatory', 'Kalahari', 'Alpine', 'NeXTerra']
                      ).map(mapName => (
                        <option key={mapName} value={mapName}>{mapName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {categorySelection === 'Tournament' && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-[9px] font-black uppercase text-neutral-400 font-mono tracking-widest">
                      TOURNAMENT DIVISION
                    </label>
                    <div className="flex gap-2">
                      {divisions.length > 0 ? (
                        <select
                          value={selectedDivision}
                          onChange={(e) => setSelectedDivision(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 text-xs px-3 py-2 text-neutral-300 focus:border-gold/50 outline-none"
                        >
                          {divisions.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                          <option value="Custom">-- Custom Division --</option>
                        </select>
                      ) : null}
                      {(divisions.length === 0 || selectedDivision === 'Custom') && (
                        <input
                          type="text"
                          value={customDivisionName}
                          onChange={(e) => setCustomDivisionName(e.target.value)}
                          placeholder="Type division name..."
                          className="w-full bg-neutral-950 border border-neutral-800 text-xs px-3 py-2 text-neutral-300 focus:border-gold/50 outline-none font-mono"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drag/Drop Interactive Container */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border border-dashed rounded-[3px] p-6 text-center transition-all ${
                  dragActive ? 'border-gold bg-gold/5' : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                }`}
              >
                {!previewUrl ? (
                  <div className="py-4 cursor-pointer">
                    <Upload size={28} className="mx-auto text-neutral-500 mb-2" />
                    <p className="text-[11px] text-neutral-400 font-mono">
                      Drag stat capture image here
                    </p>
                    <p className="text-[10px] text-neutral-600 font-mono mt-1">or click browse</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Screen Capture Stats"
                      className="max-h-48 mx-auto object-contain border border-neutral-800"
                    />
                    <button
                      onClick={() => { setSelectedFile(null); setPreviewUrl(null); setResults(null); }}
                      className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {selectedFile && uploadProgress === 'idle' && (
                <button
                  onClick={processImageOCR}
                  className="w-full py-3 bg-gold text-black font-orbitron font-black text-xs tracking-widest uppercase hover:bg-gold-light transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cpu size={14} className="animate-spin-slow" /> Scan Image via AI 
                </button>
              )}

              {uploadProgress === 'analyzing' && (
                <div className="p-4 bg-neutral-950/80 border border-gold/20 text-center space-y-2">
                  <RefreshCw className="mx-auto text-gold animate-spin" size={20} />
                  <p className="text-[10px] uppercase font-orbitron text-gold font-bold tracking-widest">
                    Gemini Decryption Engine Active...
                  </p>
                  <p className="text-[9px] text-neutral-500 font-mono">
                    Interrogating matches, telemetry indexes & metrics values...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Verification Results Hub */}
          {results && (
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2px] space-y-4">
              <h2 className="font-orbitron font-black text-xs tracking-widest text-emerald-400 uppercase flex items-center gap-2">
                <Eye size={12} /> Verification Audit Check
              </h2>
              <p className="text-[10px] text-neutral-400 font-mono">
                Verify AI extracted parameters correct. Adjust if any discrepancies are spotted before saving.
              </p>

              <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                <div className="bg-neutral-950 p-2.5 border border-neutral-800">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Extracted Kills</div>
                  <input
                    type="number"
                    value={results.kills}
                    onChange={(e) => setResults({ ...results, kills: Number(e.target.value) })}
                    className="w-full bg-transparent border-0 text-white font-bold outline-none font-orbitron text-sm mt-1"
                  />
                </div>
                <div className="bg-neutral-950 p-2.5 border border-neutral-800">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Matches Played</div>
                  <input
                    type="number"
                    value={results.matches}
                    onChange={(e) => setResults({ ...results, matches: Number(e.target.value) })}
                    className="w-full bg-transparent border-0 text-white font-bold outline-none font-orbitron text-sm mt-1"
                  />
                </div>
                <div className="bg-neutral-950 p-2.5 border border-neutral-800 col-span-2">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Player Name label</div>
                  <input
                    type="text"
                    value={customPlayerName}
                    onChange={(e) => setCustomPlayerName(e.target.value)}
                    placeholder="Specify profile label"
                    className="w-full bg-transparent border-0 text-white font-bold outline-none text-xs mt-1"
                  />
                </div>
                <div className="bg-neutral-950 p-2.5 border border-neutral-800">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Match Category</div>
                  <select
                    value={results.category || categorySelection}
                    onChange={(e) => {
                      setCategorySelection(e.target.value);
                      setResults({ ...results, category: e.target.value });
                    }}
                    className="w-full bg-transparent border-0 text-white font-semibold outline-none text-[11px] mt-1"
                  >
                    <option className="bg-neutral-900 text-white" value="Scrims">Scrims</option>
                    <option className="bg-neutral-900 text-white" value="Tournament">Tournament</option>
                    <option className="bg-neutral-900 text-white" value="Open Room Match">Open Room Match</option>
                  </select>
                </div>

                {(results.category || categorySelection) === 'Tournament' && (
                  <div className="bg-neutral-950 p-2.5 border border-neutral-800 col-span-2">
                    <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Tournament Division</div>
                    <div className="flex gap-2 mt-1">
                      {divisions.length > 0 ? (
                        <select
                          value={selectedDivision}
                          onChange={(e) => {
                            setSelectedDivision(e.target.value);
                            setResults({ ...results, division: e.target.value === 'Custom' ? customDivisionName : e.target.value });
                          }}
                          className="bg-transparent border-0 text-white font-semibold outline-none text-[11px] w-full"
                        >
                          {divisions.map(d => (
                            <option className="bg-neutral-900 text-white" key={d.id} value={d.name}>{d.name}</option>
                          ))}
                          <option className="bg-neutral-900 text-white" value="Custom">Custom...</option>
                        </select>
                      ) : null}
                      {(divisions.length === 0 || selectedDivision === 'Custom') && (
                        <input
                          type="text"
                          value={customDivisionName}
                          onChange={(e) => {
                            setCustomDivisionName(e.target.value);
                            setResults({ ...results, division: e.target.value });
                          }}
                          placeholder="Type Division..."
                          className="bg-transparent border-b border-white/10 text-white outline-none text-xs w-full font-mono animate-pulse"
                        />
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-neutral-950 p-2.5 border border-neutral-800">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Map Analyzed</div>
                  <select
                    value={results.map || mapSelection}
                    onChange={(e) => {
                      setMapSelection(e.target.value);
                      setResults({ ...results, map: e.target.value });
                    }}
                    className="w-full bg-transparent border-0 text-white font-semibold outline-none text-[11px] mt-1"
                  >
                    {(gameSelection === 'BGMI / PUBG' ? ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Karakin', 'Rondo', 'Livik'] :
                      gameSelection === 'Valorant' ? ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'] :
                      ['Bermuda', 'Remastered', 'Purgatory', 'Kalahari', 'Alpine', 'NeXTerra']
                    ).map(m => (
                      <option className="bg-neutral-900 text-white" key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-neutral-950 p-2.5 border border-neutral-800">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Deaths (Optional)</div>
                  <input
                    type="number"
                    value={results.deaths || ''}
                    placeholder="None"
                    onChange={(e) => setResults({ ...results, deaths: Number(e.target.value) })}
                    className="w-full bg-transparent border-0 text-white outline-none font-orbitron text-xs mt-1"
                  />
                </div>
                <div className="bg-neutral-950 p-2.5 border border-neutral-800">
                  <div className="text-neutral-500 uppercase tracking-wider text-[8px]">Wins (Optional)</div>
                  <input
                    type="number"
                    value={results.wins || ''}
                    placeholder="None"
                    onChange={(e) => setResults({ ...results, wins: Number(e.target.value) })}
                    className="w-full bg-transparent border-0 text-white outline-none font-orbitron text-xs mt-1"
                  />
                </div>
              </div>

              {uploadProgress === 'saving' ? (
                <div className="p-4 bg-neutral-950 text-center text-xs font-mono border border-neutral-800 space-y-2">
                  <RefreshCw size={14} className="animate-spin text-gold mx-auto" />
                  <p className="text-neutral-400">Vaulting stats & securing cloud backups...</p>
                </div>
              ) : (
                <button
                  onClick={uploadAndConfirmStats}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-orbitron font-black text-xs tracking-widest uppercase rounded-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={14} /> Commit Stats & Backup screenshot
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Database Ledger Tracking Console */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="font-orbitron font-black text-sm tracking-widest text-white uppercase flex items-center gap-2">
                <Database size={14} className="text-gold" /> Performance Archive DB
              </h2>

              {/* Filtering Controls */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search player name..."
                    className="bg-neutral-950 border border-neutral-800 text-[10px] pl-8 pr-3 py-1.5 text-neutral-300 outline-none w-full md:w-48 placeholder-neutral-600 focus:border-gold/30 font-mono"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter size={10} className="text-neutral-500" />
                  <select
                    value={filterGame}
                    onChange={(e) => setFilterGame(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 text-[10px] px-2.5 py-1.5 text-neutral-300 outline-none font-mono"
                  >
                    <option value="All">All Games</option>
                    <option value="BGMI / PUBG">BGMI / PUBG</option>
                    <option value="Valorant">Valorant</option>
                    <option value="Free Fire">Free Fire</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Historical Metrics Table Row Render */}
            {historyLoading ? (
              <div className="py-20 text-center font-mono text-[10px] text-neutral-500 uppercase tracking-widest space-y-2">
                <RefreshCw size={20} className="animate-spin text-gold mx-auto" />
                <p>Retrieving performance archives...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-20 border border-dashed border-neutral-800/60 rounded text-center text-xs text-neutral-500 font-mono">
                No telemetry data records logged matching current parameters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[10px] text-left">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 uppercase text-[9px] tracking-wider pb-2">
                      <th className="py-3">Player Name</th>
                      <th className="py-3">Game</th>
                      <th className="py-3 text-center">Category</th>
                      <th className="py-3 text-center">Map</th>
                      <th className="py-3 text-center">Matches</th>
                      <th className="py-3 text-center">Kills</th>
                      <th className="py-3 text-center">Avg Kills</th>
                      <th className="py-3 text-center">Win State</th>
                      <th className="py-3 text-center">KD Ratio</th>
                      <th className="py-3 text-center">Backup View</th>
                      <th className="py-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-850">
                    {filteredHistory.map((row) => {
                      const avgKills = row.matches ? (row.kills / row.matches).toFixed(1) : 'N/A';
                      return (
                        <tr key={row.id} className="hover:bg-neutral-850/30 transition-all font-mono">
                          <td className="py-3 font-semibold text-white">{row.playerName}</td>
                          <td className="py-3 text-neutral-400">{row.gameName}</td>
                          <td className="py-3 text-center text-sky-400 font-bold">
                            {row.category || 'Scrims'}
                            {row.category === 'Tournament' && row.division && (
                              <span className="block text-[8px] text-neutral-400 font-mono normal-case">({row.division})</span>
                            )}
                          </td>
                          <td className="py-3 text-center text-amber-500 font-bold">{row.map || 'Erangel'}</td>
                          <td className="py-3 text-center font-orbitron font-semibold text-gold">{row.matches}</td>
                          <td className="py-3 text-center text-neutral-200">{row.kills}</td>
                          <td className="py-3 text-center text-neutral-400">{avgKills}</td>
                          <td className="py-3 text-center font-orbitron">{row.wins !== undefined ? row.wins : 'N/A'}</td>
                          <td className="py-3 text-center text-emerald-400 font-semibold">{row.kd ? row.kd.toFixed(2) : 'N/A'}</td>
                          <td className="py-3 text-center">
                            {row.imageDriveLink ? (
                              <a
                                href={row.imageDriveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] text-sky-400 hover:text-sky-300 font-semibold"
                              >
                                Drive <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-[9px] text-neutral-600">No Backup</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="text-neutral-500 hover:text-red-500 transition-all p-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Simple Dashboard Analytics Track Card */}
          {history.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2px]">
              <h2 className="font-orbitron font-black text-xs tracking-widest text-gold uppercase flex items-center gap-2 mb-4">
                <Trophy size={12} /> Operational Metrics Overview
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center font-mono">
                <div className="bg-neutral-950 p-4 border border-neutral-800">
                  <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Total Monitored Kills</div>
                  <div className="font-orbitron font-black text-lg text-white mt-1">
                    {history.reduce((acc, current) => acc + (current.kills || 0), 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-neutral-950 p-4 border border-neutral-800">
                  <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Total Matches Cataloged</div>
                  <div className="font-orbitron font-black text-lg text-white mt-1">
                    {history.reduce((acc, current) => acc + (current.matches || 0), 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-neutral-950 p-4 border border-neutral-800">
                  <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Aggregate KD Velocity</div>
                  <div className="font-orbitron font-black text-lg text-emerald-400 mt-1">
                    {(() => {
                      const totalK = history.reduce((acc, current) => acc + (current.kills || 0), 0);
                      const totalM = history.reduce((acc, current) => acc + (current.matches || 0), 0);
                      return totalM ? (totalK / totalM).toFixed(2) : '0.00';
                    })()}
                  </div>
                </div>

                <div className="bg-neutral-950 p-4 border border-neutral-800">
                  <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Record Win Entries</div>
                  <div className="font-orbitron font-black text-lg text-gold mt-1">
                    {history.reduce((acc, current) => acc + (current.wins || 0), 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
