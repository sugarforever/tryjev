export const SITE_URL = 'https://www.tryjev.xyz';
export const SITE_NAME = 'tryjev';
export const TWITTER = '@verysmallwoods';
export const REPO_URL = 'https://github.com/sugarforever/tryjev';

/** Every indexable route, in sitemap order. Bump lastmod when a page's content changes. */
export const PAGES: { path: string; lastmod: string; changefreq: 'weekly' | 'monthly'; priority: string }[] = [
	{ path: '/', lastmod: '2026-09-20', changefreq: 'weekly', priority: '1.0' },
	{ path: '/jev', lastmod: '2026-09-20', changefreq: 'monthly', priority: '0.8' }
];
