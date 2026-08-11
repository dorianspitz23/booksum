
import React, { useState, useMemo, useRef } from 'react';
import type { UserProfile, BookInsight } from '../legacy-types';
import { Settings, ShieldAlert, BookOpen, Target, Calendar, Edit3, Save, Volume2, Trash2, Download, Upload, FileJson, Check } from 'lucide-react';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
  books: BookInsight[];
  onResetLibrary: () => void;
  onImportLibrary: (books: BookInsight[], profile: UserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onUpdate, books, onResetLibrary, onImportLibrary }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const stats = useMemo(() => {
    const finishedCount = books.filter(b => b.status === 'Finished').length;
    const progressPercent = Math.min(100, (finishedCount / profile.monthlyGoal) * 100);
    const joinedDate = new Date(profile.joinedAt).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const categoryCounts: Record<string, number> = {};
    books.forEach(b => {
      categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
    });

    const topGenres = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    return { finishedCount, progressPercent, joinedDate, topGenres };
  }, [books, profile]);

  const handleSave = () => {
    onUpdate(editedProfile);
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleExport = () => {
    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      profile: profile,
      books: books
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booksum-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Basic validation
        if (!data.profile || !Array.isArray(data.books)) {
          alert("Invalid backup file format. Please use a valid BookSum export file.");
          setImportStatus('error');
          return;
        }

        if (confirm(`Found ${data.books.length} books in backup. This will merge with your current library. Continue?`)) {
           onImportLibrary(data.books, data.profile);
           setImportStatus('success');
           setTimeout(() => setImportStatus('idle'), 3000);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to read backup file.");
        setImportStatus('error');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-orange-600 rounded-3xl flex items-center justify-center text-white text-3xl font-serif font-bold shadow-2xl shadow-orange-100 border-4 border-white">
            {getInitials(profile.name)}
          </div>
          <div>
            <h1 className="text-4xl font-serif font-bold text-gray-900">{profile.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-gray-500 font-medium">
              <span className="flex items-center gap-1.5"><Calendar size={16} /> Joined {stats.joinedDate}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              <span className="flex items-center gap-1.5 text-orange-600 font-bold"><BookOpen size={16} /> {books.length} Books in Library</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            isEditing 
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' 
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {isEditing ? <><Save size={18} /> Save Profile</> : <><Edit3 size={18} /> Edit Profile</>}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Monthly Goal Card */}
        <div className="md:col-span-1 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-50" strokeWidth="3" />
              <circle 
                cx="18" cy="18" r="16" fill="none" 
                className="stroke-orange-500 transition-all duration-1000 ease-out" 
                strokeWidth="3" 
                strokeDasharray={`${stats.progressPercent}, 100`} 
                strokeLinecap="round" 
                transform="rotate(-90 18 18)" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{stats.finishedCount}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">of {profile.monthlyGoal}</span>
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Monthly Goal</h3>
          <p className="text-sm text-gray-500 mb-4">Reading insights is the best way to compound knowledge.</p>
          
          {isEditing && (
            <div className="w-full mt-2">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block">Adjust Goal</label>
              <input 
                type="range" min="1" max="20" 
                value={editedProfile.monthlyGoal}
                onChange={(e) => setEditedProfile({...editedProfile, monthlyGoal: parseInt(e.target.value)})}
                className="w-full accent-orange-600"
              />
              <span className="text-orange-600 font-bold">{editedProfile.monthlyGoal} books</span>
            </div>
          )}
        </div>

        {/* Interests and Bio */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-full">
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Target className="text-orange-600" /> Bio & Motivation
              </h3>
              {isEditing ? (
                <textarea 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 transition-all text-gray-700 min-h-[100px]"
                  value={editedProfile.bio}
                  onChange={(e) => setEditedProfile({...editedProfile, bio: e.target.value})}
                />
              ) : (
                <p className="text-gray-600 leading-relaxed italic border-l-4 border-orange-100 pl-4">
                  "{profile.bio}"
                </p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Volume2 className="text-orange-600" /> AI Preferences
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'].map((voice) => (
                  <button
                    key={voice}
                    disabled={!isEditing}
                    onClick={() => setEditedProfile({...editedProfile, favoriteVoice: voice as any})}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      (isEditing ? editedProfile.favoriteVoice : profile.favoriteVoice) === voice
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {voice} Voice
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-3">
           <FileJson size={24} className="text-gray-400" /> Data Management
        </h2>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                 <h3 className="font-bold text-gray-900 mb-1">Backup & Restore</h3>
                 <p className="text-sm text-gray-500">
                    Since BookSum runs locally on your device, you need to manually export your data if you want to move it to another device (like from your laptop to your phone).
                 </p>
              </div>
              
              <div className="flex items-center gap-4">
                 <button 
                   onClick={handleExport}
                   className="flex items-center gap-2 px-5 py-3 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                 >
                    <Download size={18} /> Export Data
                 </button>

                 <div className="relative">
                   <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImport}
                   />
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold border transition-colors ${
                        importStatus === 'success' 
                           ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                           : importStatus === 'error'
                             ? 'bg-red-50 text-red-600 border-red-100'
                             : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                     }`}
                   >
                      {importStatus === 'success' ? (
                        <><Check size={18} /> Imported!</>
                      ) : (
                        <><Upload size={18} /> Import Data</>
                      )}
                   </button>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Account Settings */}
      <section className="space-y-6">
        <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-3">
          <Settings size={24} className="text-gray-400" /> Settings
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <ShieldAlert size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-900">Privacy Mode</p>
                <p className="text-xs text-gray-500">Local storage encryption</p>
              </div>
            </div>
            <div className="w-12 h-6 bg-orange-600 rounded-full p-1 cursor-pointer">
              <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm" />
            </div>
          </div>

          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <Trash2 size={20} />
              </div>
              <div>
                <p className="font-bold text-rose-900">Danger Zone</p>
                <p className="text-xs text-rose-700">Clear your entire library</p>
              </div>
            </div>
            <button 
              onClick={onResetLibrary}
              className="px-4 py-2 bg-white text-rose-600 text-xs font-black uppercase tracking-widest rounded-lg border border-rose-200 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
            >
              Reset All
            </button>
          </div>
        </div>
      </section>

      {/* Top Genres Visualization */}
      <section className="bg-stone-900 rounded-[2rem] p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] -mr-32 -mt-32" />
        <div className="relative z-10">
          <h2 className="text-3xl font-serif font-bold italic mb-6">Knowledge Topography</h2>
          <div className="flex flex-wrap gap-4">
            {stats.topGenres.length > 0 ? (
              stats.topGenres.map((genre, i) => (
                <div key={genre} className="flex flex-col items-center">
                   <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center font-black border-2 ${
                     i === 0 ? 'bg-orange-500 border-orange-400' : 'bg-stone-800 border-stone-700'
                   }`}>
                     {i + 1}
                   </div>
                   <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{genre}</span>
                </div>
              ))
            ) : (
              <p className="text-stone-500 font-medium">Add books to reveal your knowledge map.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
