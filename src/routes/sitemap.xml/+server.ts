export const prerender = false;
export const GET = ({ url }) =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url.origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
