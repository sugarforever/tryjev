<script lang="ts">
	// Top bar for the content pages (/jev, /cookbook): wordmark + subtitle, nav, theme switch
	import SiteNav from '$lib/SiteNav.svelte';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	let { sub, current }: { sub: string; current: '/jev' | '/cookbook' } = $props();
</script>

<header class="topbar">
	<div class="title">
		<div>
			<a href="/" class="home" aria-label="Jev Playground home">tryjev</a>
			<p class="sub">{sub}</p>
		</div>
		<SiteNav {current} />
	</div>
	<div class="meta">
		<ThemeSwitch />
	</div>
</header>
