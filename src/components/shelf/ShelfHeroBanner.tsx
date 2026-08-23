import React, { useState, useMemo } from 'react';
import { Flame, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/schema';
import { AvatarPickerModal } from './AvatarPickerModal';
import { GHIBLI_OFFICIAL_COLLECTIONS } from '@/src/data/ghibliOfficialScenes';

interface ShelfHeroBannerProps {
  customAvatar?: string;
  onUpdateAvatar: (avatarUrl: string) => void;
}

export const ShelfHeroBanner: React.FC<ShelfHeroBannerProps> = ({
  customAvatar,
  onUpdateAvatar,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Query actual reading activity from progress records and books lastReadAt
  const progressList = useLiveQuery(() => db.progress.toArray(), []) || [];
  const booksList = useLiveQuery(() => db.books.toArray(), []) || [];

  // Map of date strings ('YYYY-MM-DD') that have actual reading activity
  const activeDateSet = useMemo(() => {
    const set = new Set<string>();

    const toDateKey = (timestamp: number) => {
      const d = new Date(timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    progressList.forEach((p) => {
      if (p.updatedAt && (p.percentage > 0 || p.cfi)) {
        set.add(toDateKey(p.updatedAt));
      }
    });

    booksList.forEach((b) => {
      if (b.lastReadAt && b.lastReadAt > b.addedAt) {
        set.add(toDateKey(b.lastReadAt));
      }
    });

    return set;
  }, [progressList, booksList]);

  // Compute consecutive day streak ending today (or yesterday)
  const currentStreak = useMemo(() => {
    const toDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const now = new Date();
    const todayKey = toDateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);

    // If neither today nor yesterday has reading activity, streak is 0
    if (!activeDateSet.has(todayKey) && !activeDateSet.has(yesterdayKey)) {
      return 0;
    }

    let streak = 0;
    const checkDate = new Date(now);

    // If today is not yet active, start counting backwards from yesterday
    if (!activeDateSet.has(todayKey)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (activeDateSet.has(toDateKey(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
  }, [activeDateSet]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthName = currentDate.toLocaleString('en-US', { month: 'short' });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar grid for the month
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert to Monday-first (0 is Mon, 6 is Sun)
  const startDayOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const currentDayNumber = today.getDate();

  // Active photo (default to Spirited Away Water Railway)
  const defaultPhoto = GHIBLI_OFFICIAL_COLLECTIONS[0].images[0];
  const avatarUrl = customAvatar || defaultPhoto.url;

  // Find matching Ghibli scene metadata if applicable
  const currentGhibliScene = GHIBLI_OFFICIAL_COLLECTIONS.flatMap((c) => c.images).find(
    (img) => img.url === avatarUrl
  );

  return (
    <section className="w-full grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch select-none">
      {/* 1. Landscape Aspect Ratio (16:10 / 4:3) Animated Avatar Card (5 cols) */}
      <div
        onClick={() => setIsPickerOpen(true)}
        className="md:col-span-5 group relative rounded-3xl overflow-hidden cursor-pointer bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] shadow-xs hover:shadow-lg transition-all flex flex-col justify-end min-h-[220px] sm:min-h-[240px] md:min-h-[190px] aspect-[16/10] md:aspect-auto"
      >
        <img
          src={avatarUrl}
          alt="Reading Vibe Avatar"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Subtle bottom gradient & change badge */}
        <div className="relative z-10 p-3.5 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-center justify-between text-white">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs font-bold truncate">
              {currentGhibliScene ? currentGhibliScene.movieTitle : 'Reading Vibe'}
            </span>
            {currentGhibliScene && (
              <span className="text-[9px] text-zinc-300 truncate mt-0.5 opacity-90">
                {currentGhibliScene.source}
              </span>
            )}
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity font-medium shrink-0">
            Change
          </span>
        </div>
      </div>

      {/* 2. Monthly Streak Heatmap Calendar Card (7 cols) */}
      <div className="md:col-span-7 p-4 sm:p-5 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs flex flex-col justify-between space-y-3">
        {/* Header: Title + Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center shadow-xs">
              <Flame className="w-4 h-4 fill-[var(--accent-color)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[var(--text-primary)]">Reading Streak</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                  currentStreak > 0
                    ? 'text-[var(--accent-color)] bg-[var(--accent-subtle)]'
                    : 'text-[var(--text-muted)] bg-[var(--bg-secondary)]'
                }`}>
                  {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'} Streak
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-2 py-0.5 rounded-xl text-xs">
            <button
              onClick={handlePrevMonth}
              className="p-0.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-[var(--text-primary)] px-1.5 flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3 text-[var(--accent-color)]" />
              {monthName} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-0.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Heatmap Matrix */}
        <div className="space-y-1">
          {/* Day of week labels (Mon -> Sun) */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty slots before month start */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-5 sm:h-6 rounded-md bg-transparent" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = isCurrentMonth && day === currentDayNumber;
              const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasActivity = activeDateSet.has(dayKey);

              return (
                <div
                  key={`day-${day}`}
                  className={`group relative h-5 sm:h-6 rounded-md flex items-center justify-center text-[10px] font-semibold transition-all border ${
                    hasActivity
                      ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-xs font-bold scale-105'
                      : isToday
                      ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] border-[var(--accent-color)]/70 font-semibold'
                      : 'bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] border-[var(--border-color)]/60 hover:border-[var(--border-hover)] hover:bg-[var(--bg-secondary)]'
                  }`}
                  title={`${monthName} ${day}, ${year}${hasActivity ? ' • Read' : ''}`}
                >
                  <span>{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-color)]/40">
          <span>Daily reading keeps streak burning 🔥</span>
          <div className="flex items-center gap-1.5">
            <span>Inactive</span>
            <div className="w-2.5 h-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]" />
            <div className="w-2.5 h-2.5 rounded bg-[var(--accent-color)]" />
            <span className="text-[var(--accent-color)] font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isPickerOpen}
        currentAvatar={avatarUrl}
        onSelectAvatar={onUpdateAvatar}
        onClose={() => setIsPickerOpen(false)}
      />
    </section>
  );
};
