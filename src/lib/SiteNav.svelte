<script lang="ts">
	// Top-bar navigation shared by every page; `current` marks the page being viewed
	let { current }: { current: '/' | '/jev' | '/cookbook' } = $props();
	const items: { href: '/' | '/jev' | '/cookbook'; label: string }[] = [
		{ href: '/', label: 'Playground' },
		{ href: '/jev', label: 'What is Jev?' },
		{ href: '/cookbook', label: 'Cookbook' }
	];
</script>

<nav class="nav" aria-label="Site">
	{#each items as it (it.href)}
		<a href={it.href} aria-current={it.href === current ? 'page' : undefined}>{it.label}</a>
	{/each}
</nav>
