/**
 * Every address in the app, built rather than typed out.
 *
 * The route table declared `'book/:id'` and a dozen call sites independently
 * wrote `` `/book/${id}` ``. Nothing connected the two, so renaming a route or
 * its `:id` parameter compiled perfectly and broke navigation at runtime — and
 * the app now has a catch-all route, which means a stale link renders a polite
 * "no such page" rather than throwing. A silent wrong answer, not a crash.
 *
 * The patterns are exported for the route table, so both sides of each route
 * come from the same string.
 */
export const routePatterns = {
  library: '/',
  book: 'book/:id',
  reader: 'book/:id/read',
  review: 'review',
  stats: 'stats',
  profile: 'profile',
  notFound: '*',
} as const;

export const paths = {
  library: () => '/',
  book: (id: string) => `/book/${encodeURIComponent(id)}`,
  reader: (id: string) => `/book/${encodeURIComponent(id)}/read`,
  review: () => '/review',
  stats: () => '/stats',
  profile: () => '/profile',
} as const;
