<script lang="ts">
	import SiteHeader from '$lib/components/SiteHeader.svelte'
	import { formatGeneratedAt, formatPostDate } from '$lib/format'
	import { getNextTheme, getSavedTheme, saveTheme, type Theme } from '$lib/theme'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
	let theme = $state<Theme>('light')
	let alumniByName = $derived(new Map(data.alumni.map((person) => [person.nickname, person])))

	onMount(() => {
		theme = getSavedTheme() ?? theme
	})

	function toggleTheme() {
		theme = getNextTheme(theme)
		saveTheme(theme)
	}

	function getPostAvatar(sourceName: string): string | null {
		return alumniByName.get(sourceName)?.avatar ?? null
	}
</script>

<svelte:head>
	<title>文章列表 | ZZULI.dev</title>
</svelte:head>

<div
	class:dark={theme === 'dark'}
	class="min-h-screen bg-[#f3f5f7] text-[#202124] selection:bg-[#7dd3fc]/30 dark:bg-[#111418] dark:text-[#e8eaed]"
>
	<SiteHeader
		onToggleTheme={toggleTheme}
		showHomeLink
		subtitle="文章列表"
		{theme}
	/>

	<main class="mx-auto max-w-5xl px-4 py-5 sm:px-6">
		<section class="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
			<div class="flex items-center justify-between gap-4 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
				<div>
					<h1 class="text-base font-semibold">文章列表</h1>
					<p class="mt-0.5 text-xs text-[#6b7280] dark:text-[#9aa4b2]">
						{data.blogPostCount} 篇 · {formatGeneratedAt(data.blogPostsGeneratedAt)}
					</p>
				</div>
			</div>

			{#if data.blogPosts.length === 0}
				<div class="px-5 py-12 text-sm text-[#6b7280] dark:text-[#9aa4b2]">
					暂无文章。
				</div>
			{:else}
				<div>
					{#each data.blogPosts as post}
						<a
							href={post.url}
							target="_blank"
							rel="noopener noreferrer"
							class="grid gap-2 px-4 py-3 text-sm shadow-[0_1px_0_rgba(31,35,40,0.07)] last:shadow-none hover:bg-[#f8fafc] sm:grid-cols-[5.5rem_1fr_10rem] sm:items-center dark:shadow-[0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
						>
							<span class="text-xs text-[#6b7280] dark:text-[#9aa4b2]">
								{formatPostDate(post.publishedAt)}
							</span>
							<span class="truncate font-medium text-[#1d4ed8] dark:text-[#80bfff]">
								{post.title}
							</span>
							<span class="flex min-w-0 items-center gap-2 text-xs text-[#6b7280] sm:justify-end dark:text-[#9aa4b2]">
								{#if getPostAvatar(post.sourceName)}
									<img
										src={getPostAvatar(post.sourceName)}
										alt={post.sourceName}
										class="h-5 w-5 shrink-0 rounded-md bg-[#eef2f7] object-cover dark:bg-[#202631]"
										loading="lazy"
										decoding="async"
										referrerpolicy="no-referrer"
									/>
								{:else}
									<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#eef6ff] text-[10px] font-semibold text-[#0969da] dark:bg-[#10233a] dark:text-[#7cc4ff]">
										文
									</span>
								{/if}
								<span class="truncate">{post.sourceName}</span>
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</main>
</div>
