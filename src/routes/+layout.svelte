<script lang="ts">
	import '../app.css';
	import '../theme-candy.css';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { SITE_URL, SITE_NAME } from '$lib/site';
	import { theme, isTheme } from '$lib/theme.svelte';
	let { children } = $props();
	injectAnalytics({ mode: dev ? 'development' : 'production' });

	// app.html already set <html data-theme> before paint; adopt it, then persist every change from the switch
	onMount(() => {
		const t = document.documentElement.dataset.theme;
		if (isTheme(t)) theme.value = t;
	});
	$effect(() => {
		document.documentElement.dataset.theme = theme.value;
		try { localStorage.setItem('jev-theme', theme.value); } catch {}
	});

	const website = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'Jev Playground',
		alternateName: SITE_NAME,
		url: SITE_URL + '/'
	});
</script>

<svelte:head>
	<!-- Site-wide tags only; each route renders its own title / description / canonical / OG via $lib/Seo.svelte -->
	<meta name="author" content="VerySmallWoods" />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="theme-color" content="#f7cb46" />

	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />

	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800;900&family=Inter+Tight:wght@700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap"
		rel="stylesheet"
	/>
	{@html `<script type="application/ld+json">${website}</script>`}
</svelte:head>

{@render children()}
