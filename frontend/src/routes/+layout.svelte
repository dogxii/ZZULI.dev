<script lang="ts">
	import '../app.css'
	import type { Snippet } from 'svelte'

	let { children }: { children: Snippet } = $props()
</script>

<svelte:head>
	<link rel="icon" href="/logo.webp" />
</svelte:head>

{@render children()}
