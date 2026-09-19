<script lang="ts">
	import { theme } from '$lib/theme.svelte';
</script>

<span class="theme-switch" role="group" aria-label="Theme">
	<button class={theme.value === 'swiss' ? 'on' : ''} aria-pressed={theme.value === 'swiss'} onclick={() => (theme.value = 'swiss')}>Swiss</button>
	<button class={theme.value === 'candy' ? 'on' : ''} aria-pressed={theme.value === 'candy'} onclick={() => (theme.value = 'candy')}>Candy</button>
</span>
