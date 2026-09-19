import { redirect } from '@sveltejs/kit';

// /about is an alias; the canonical page is /jev
export const load = () => {
	redirect(301, '/jev');
};
