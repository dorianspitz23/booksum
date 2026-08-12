import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './useTheme';
import type { ThemeChoice } from './useTheme';

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => void setTheme(value)}
          aria-pressed={theme === value}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            theme === value
              ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </div>
  );
}
