import { SITE_URL } from '$lib/site';

// Canonical / og:url / og:image always point at the public site, whatever host served the page
export const load = () => ({ origin: SITE_URL });
