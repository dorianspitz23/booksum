/**
 * Every localStorage key the app owns, in one place.
 *
 * These used to be string literals written out at each call site, and two of
 * them were spelled out in more than one file — so clearing a profile built its
 * cache key by hand while the writer built the same key from a constant. Renaming
 * the constant would have compiled cleanly and silently stopped reset from
 * clearing anything.
 */

/** The user's Gemini API key. */
export const API_KEY = 'booksum.apiKey';

/** Which profile the picker last selected. */
export const ACTIVE_PROFILE = 'booksum.activeProfile';

/** Set once the one-time localStorage-to-IndexedDB migration has run. */
export const MIGRATION_MARKER = 'booksum.migratedAt';

/** Cached AI recommendations, per profile. */
export const recommendationsKey = (profileId: string) => `booksum.recs.${profileId}`;

/** The day the Daily Wisdom card was last shown, per profile. */
export const dailyWisdomKey = (profileId: string) => `booksum.dailyWisdom.${profileId}`;

/** Keys written by the pre-IndexedDB version of the app. Read once, never written. */
export const LEGACY_LIBRARY_PREFIX = 'booksum_library_';
export const legacyProfileKey = (userId: string) => `booksum_profile_${userId}`;

/** Everything this profile owns, for a clean reset. */
export const perProfileKeys = (profileId: string) => [
  recommendationsKey(profileId),
  dailyWisdomKey(profileId),
];
