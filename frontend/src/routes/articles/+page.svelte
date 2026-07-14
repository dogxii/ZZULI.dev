<script lang="ts">
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	type Theme = 'light' | 'dark'

	let { data }: { data: PageData } = $props()
	let theme = $state<Theme>('light')
	let alumniByName = $derived(new Map(data.alumni.map((person) => [person.nickname, person])))

	onMount(() => {
		const savedTheme = localStorage.getItem('zzuli-theme')
		if (savedTheme === 'dark' || savedTheme === 'light') {
			theme = savedTheme
		}
	})

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark'
		localStorage.setItem('zzuli-theme', theme)
	}

	function formatDate(value: string | null | undefined): string {
		if (!value) return '未标日期'

		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return '未标日期'

		const isCurrentYear = date.getFullYear() === new Date().getFullYear()

		return new Intl.DateTimeFormat(
			'zh-CN',
			isCurrentYear
				? {
						month: 'short',
						day: 'numeric',
					}
				: {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					},
		).format(date)
	}

	function formatGeneratedAt(value: string | null): string {
		if (!value) return '等待采集'

		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return '等待采集'

		return new Intl.DateTimeFormat('zh-CN', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date)
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
	<header class="sticky top-0 z-30 bg-[#fdfdfd]/90 shadow-[0_1px_0_rgba(31,35,40,0.08)] backdrop-blur dark:bg-[#15191f]/88 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
			<a href="/" class="flex min-w-0 items-center gap-3" aria-label="返回首页">
				<img
					src="/logo.webp"
					alt="ZZULI"
					class="h-8 w-8 rounded-lg bg-white object-contain p-1 shadow-[0_0_0_1px_rgba(31,35,40,0.12)] dark:bg-[#1c2128] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
				/>
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold">ZZULI.dev</p>
					<p class="truncate text-xs text-[#6b7280] dark:text-[#9aa4b2]">文章列表</p>
				</div>
			</a>

			<div class="flex items-center gap-2">
				<a
					href="/"
					class="rounded-full px-3 py-1.5 text-sm font-medium text-[#4b5563] hover:bg-[#eef2f7] dark:text-[#b6beca] dark:hover:bg-[#202631]"
				>
					首页
				</a>
				<button
					type="button"
					onclick={toggleTheme}
					class="flex h-9 w-9 items-center justify-center rounded-full text-[#4b5563] hover:bg-[#eef2f7] dark:text-[#b6beca] dark:hover:bg-[#202631]"
					aria-label="切换暗色模式"
				>
					{#if theme === 'dark'}
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
							<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
						</svg>
					{:else}
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M20.2 14.4A7.7 7.7 0 0 1 9.6 3.8 8.6 8.6 0 1 0 20.2 14.4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</header>

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
								{formatDate(post.publishedAt)}
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
