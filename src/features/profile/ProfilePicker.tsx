import { useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { useProfile } from './ProfileContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/toastStore';
import type { Profile } from '../../types';

export function ProfilePicker() {
  const { allProfiles, selectProfile, createProfile, deleteProfile } = useProfile();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Derived, not snapshotted. As useState(allProfiles.length === 0) this latched
  // `true` whenever the picker mounted before the profile list had loaded, and
  // never recovered -- so the existing profiles stayed hidden behind the create
  // form. It only ever worked because App gates on isLoading before rendering.
  const [wantsNewProfile, setWantsNewProfile] = useState(false);
  const isCreating = wantsNewProfile || allProfiles.length === 0;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || isBusy) return;
    setIsBusy(true);
    try {
      await createProfile(name);
    } catch (error) {
      console.error('Could not create profile', error);
      toast.error('Could not create that profile. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  /** Deleting a profile cascades to every book, summary, PDF and review card it owns. */
  const handleDelete = async (candidate: Profile) => {
    const confirmed = await confirm({
      title: `Delete ${candidate.name}?`,
      body: `This permanently removes ${candidate.name}'s entire library — every book, summary, note, PDF and review card. It cannot be undone.`,
      confirmLabel: 'Delete profile',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await deleteProfile(candidate.id);
      toast.success(`Deleted ${candidate.name}.`);
    } catch (error) {
      console.error('Could not delete profile', error);
      toast.error('Could not delete that profile. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-parchment dark:bg-night flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center text-white font-serif font-bold italic text-2xl shadow-lg shadow-orange-100">
            B
          </div>
          <h1 className="text-3xl font-serif font-bold text-orange-700 dark:text-orange-400 italic tracking-tighter">
            BookSum
          </h1>
        </div>

        <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
          Who&rsquo;s reading?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
          Profiles keep libraries separate on this device. No passwords, no accounts &mdash;
          everything stays in this browser.
        </p>

        {!isCreating && (
          <ul className="space-y-3 mb-6">
            {allProfiles.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2">
                <button
                  onClick={() => void selectProfile(candidate.id)}
                  className="flex-1 flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm hover:border-orange-200 hover:shadow-md transition-all text-left"
                >
                  <span className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-bold flex items-center justify-center">
                    {candidate.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {candidate.name}
                  </span>
                  <BookOpen size={18} className="ml-auto text-gray-300 dark:text-gray-600" />
                </button>
                <button
                  onClick={() => void handleDelete(candidate)}
                  aria-label={`Delete profile ${candidate.name}`}
                  className="p-3 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {isCreating ? (
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Your name
              </span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Dorian"
                className="w-full px-4 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-gray-900 dark:text-gray-100"
              />
            </label>
            <button
              type="submit"
              disabled={!name.trim() || isBusy}
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
            >
              {isBusy ? <Loader2 size={20} className="animate-spin" /> : null}
              Start reading
            </button>
            {allProfiles.length > 0 && (
              <button
                type="button"
                onClick={() => setWantsNewProfile(false)}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Back to profiles
              </button>
            )}
          </form>
        ) : (
          <button
            onClick={() => setWantsNewProfile(true)}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-500 dark:text-gray-400 hover:border-orange-400 hover:text-orange-700 dark:hover:text-orange-400 transition-all font-semibold"
          >
            <Plus size={18} /> Add a profile
          </button>
        )}
      </div>
    </div>
  );
}
