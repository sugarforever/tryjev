<script lang="ts">
	import '../app.css';
	import '../theme-candy.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Jev Playground · tryjev</title>
	<meta name="description" content="Build a state + typed questions, send it to typesafe/jev through OpenRouter, and watch the probabilities." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800;900&family=Inter+Tight:wght@700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}
