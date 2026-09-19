<script lang="ts">
	// Per-route head: title, description, canonical, Open Graph, Twitter card and JSON-LD.
	// Site-wide tags (icons, fonts, robots, site_name) live in +layout.svelte.
	import { SITE_URL, SITE_NAME, TWITTER } from '$lib/site';
	type Props = {
		title: string;
		description: string;
		/** Route path, e.g. '/' or '/jev'; joined with SITE_URL for canonical and og:url */
		path: string;
		image?: string;
		imageAlt: string;
		type?: 'website' | 'article';
		keywords?: string;
		jsonLd?: Record<string, unknown>[];
	};
	let { title, description, path, image = '/og.png', imageAlt, type = 'website', keywords, jsonLd = [] }: Props = $props();
	const url = $derived(SITE_URL + path);
	const img = $derived(SITE_URL + image);
	// '</' can never appear unescaped inside a <script> block
	const ld = $derived(jsonLd.map((o) => JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/<\//g, '<\\/')));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	{#if keywords}<meta name="keywords" content={keywords} />{/if}

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={img} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageAlt} />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={img} />
	<meta name="twitter:image:alt" content={imageAlt} />
	<meta name="twitter:site" content={TWITTER} />
	<meta name="twitter:creator" content={TWITTER} />

	{#each ld as json, i (i)}
		{@html `<script type="application/ld+json">${json}</script>`}
	{/each}
</svelte:head>
