<script lang="ts">
	import '../app.css';
	import '../theme-candy.css';
	let { children, data } = $props();
	const title = 'Jev Playground · typed decisions from a fast decision model';
	const description =
		'Try Jev, TypeSafe AI’s System One decision model: give it a state and typed questions (noul, choice, score), get back probabilities instead of text. Five preset scenarios, bring your own key from OpenRouter, Vercel AI Gateway or TypeSafe.';
	const og = $derived(`${data.origin}/og.png`);
	const jsonLd = $derived(JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Jev Playground',
		alternateName: 'tryjev',
		url: data.origin,
		description,
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Web',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		image: og
	}));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={data.origin + '/'} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="theme-color" content="#f7cb46" />
	<meta name="keywords" content="Jev, TypeSafe AI, System One model, decision model, noul, choice, score, OpenRouter, Vercel AI Gateway, playground" />

	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="tryjev" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={data.origin + '/'} />
	<meta property="og:image" content={og} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="JEV · Playground for the fast decision model" />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={og} />
	<meta name="twitter:site" content="@verysmallwoods" />
	<meta name="twitter:creator" content="@verysmallwoods" />

	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800;900&family=Inter+Tight:wght@700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap"
		rel="stylesheet"
	/>
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

{@render children()}
