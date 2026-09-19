export const prerender = false;
import { SITE_URL } from '$lib/site';

export const GET = () =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
