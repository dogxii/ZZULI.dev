<script lang="ts">
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	type Theme = 'light' | 'dark'

	const HOME_POST_LIMIT = 18
	const SIDEBAR_MEMBER_LIMIT = 20

	let { data }: { data: PageData } = $props()

	let theme = $state<Theme>('light')
	let searchTerm = $state('')
	let showAbout = $state(false)
	let memberSample = $state<PageData['alumni']>([])
	let memberOrder = $state<PageData['alumni']>([])

	let totalAlumni = $derived(data.alumni.length)
	let totalProjects = $derived(data.projects.length)
	let totalBlogs = $derived(data.alumni.filter((person) => person.blog?.url).length)
	let healthyBlogSources = $derived(
		data.blogSources?.filter((source) => source.status === 'ok').length ?? 0,
	)
	let normalizedSearch = $derived(searchTerm.trim().toLowerCase())
	let orderedAlumni = $derived(memberOrder.length > 0 ? memberOrder : data.alumni)
	let filteredAlumni = $derived(
		orderedAlumni.filter((person) => {
			if (!normalizedSearch) return true

			return [
				person.nickname,
				person.github?.text,
				person.github?.url,
				person.blog?.text,
				person.blog?.url,
			]
				.filter(Boolean)
				.some((value) => value?.toLowerCase().includes(normalizedSearch))
		}),
	)
	let homePosts = $derived(data.blogPosts)
	let hasMorePosts = $derived(data.blogPostCount > HOME_POST_LIMIT)
	let avatarMembers = $derived(data.alumni.filter((person) => person.avatar))
	let featuredMembers = $derived(
		memberSample.length > 0
			? memberSample
			: avatarMembers.slice(0, SIDEBAR_MEMBER_LIMIT),
	)
	let hiddenMemberCount = $derived(Math.max(0, avatarMembers.length - featuredMembers.length))
	let alumniByName = $derived(new Map(data.alumni.map((person) => [person.nickname, person])))
	let visibleSources = $derived((data.blogSources ?? []).slice(0, 10))

	onMount(() => {
		const savedTheme = localStorage.getItem('zzuli-theme')
		if (savedTheme === 'dark' || savedTheme === 'light') {
			theme = savedTheme
		}

		memberSample = shuffleMembers(avatarMembers).slice(0, SIDEBAR_MEMBER_LIMIT)
	})

	function shuffleMembers(members: PageData['alumni']) {
		const shuffled = [...members]

		for (let index = shuffled.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(Math.random() * (index + 1))
			;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
		}

		return shuffled
	}

	function shuffleMemberList() {
		memberOrder = shuffleMembers(data.alumni)
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark'
		localStorage.setItem('zzuli-theme', theme)
	}

	function closeAboutOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			showAbout = false
		}
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

	function sourceStatusLabel(status: string): string {
		switch (status) {
			case 'ok':
				return '正常'
			case 'empty':
				return '未发现'
			case 'error':
				return '失败'
			default:
				return status
		}
	}
</script>

<svelte:head>
	<title>ZZULI.dev | 开发者社区</title>
</svelte:head>

<svelte:window onkeydown={closeAboutOnEscape} />

<div
	class:dark={theme === 'dark'}
	class="min-h-screen bg-[#f3f5f7] text-[#202124] selection:bg-[#7dd3fc]/30 dark:bg-[#111418] dark:text-[#e8eaed]"
>
	<header class="sticky top-0 z-30 bg-[#fdfdfd]/90 shadow-[0_1px_0_rgba(31,35,40,0.08)] backdrop-blur dark:bg-[#15191f]/88 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
			<a
				href="#feed"
				class="flex min-w-0 items-center gap-3"
				aria-label="回到文章列表"
			>
				<img
					src="logo.webp"
					alt="ZZULI"
					class="h-8 w-8 rounded-lg bg-white object-contain p-1 shadow-[0_0_0_1px_rgba(31,35,40,0.12)] dark:bg-[#1c2128] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
				/>
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold">ZZULI.dev</p>
					<p class="truncate text-xs text-[#6b7280] dark:text-[#9aa4b2]">开发者社区</p>
				</div>
			</a>

			<div class="flex items-center gap-2">
				<a
					href="/articles"
					class="rounded-full px-3 py-1.5 text-sm font-medium text-[#4b5563] hover:bg-[#eef2f7] dark:text-[#b6beca] dark:hover:bg-[#202631]"
				>
					文章
				</a>
				<button
					type="button"
					onclick={() => (showAbout = true)}
					class="rounded-full px-3 py-1.5 text-sm font-medium text-[#4b5563] hover:bg-[#eef2f7] dark:text-[#b6beca] dark:hover:bg-[#202631]"
				>
					关于
				</button>
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

	<main class="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_340px]">
		<section id="feed" class="min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
			<div class="flex items-center justify-between gap-4 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
				<div class="flex min-w-0 items-center gap-3">
					<h1 class="text-base font-semibold">文章</h1>
					<span class="hidden truncate text-sm text-[#6b7280] sm:inline dark:text-[#9aa4b2]">
						{data.blogPostCount} 篇 · {formatGeneratedAt(data.blogPostsGeneratedAt)}
					</span>
				</div>
				<a
					href="https://github.com/dogxii/zzuli-developers"
					target="_blank"
					rel="noopener noreferrer"
					class="shrink-0 rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#0969da] hover:bg-[#ddf4ff] dark:bg-[#10233a] dark:text-[#7cc4ff] dark:hover:bg-[#17314f]"
				>
					提交收录
				</a>
			</div>

			{#if homePosts.length === 0}
				<div class="px-5 py-12 text-sm text-[#6b7280] dark:text-[#9aa4b2]">
					暂无文章数据。运行 <code class="rounded bg-[#eef2f7] px-1.5 py-0.5 dark:bg-[#202631]">npm --prefix frontend run collect:posts</code> 后会显示。
				</div>
			{:else}
				<div>
					{#each homePosts as post}
						<a
							href={post.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex gap-3 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.07)] last:shadow-none hover:bg-[#f8fafc] dark:shadow-[0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
						>
							{#if getPostAvatar(post.sourceName)}
								<img
									src={getPostAvatar(post.sourceName)}
									alt={post.sourceName}
									class="mt-1 h-10 w-10 rounded-xl bg-[#eef2f7] object-cover dark:bg-[#202631]"
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef6ff] text-sm font-semibold text-[#0969da] dark:bg-[#10233a] dark:text-[#7cc4ff]">
									文
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<h2 class="line-clamp-2 text-[15px] font-semibold leading-6 text-[#1d4ed8] group-hover:text-[#0f3a9c] dark:text-[#80bfff] dark:group-hover:text-[#a7d5ff]">
									{post.title}
								</h2>
								<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6b7280] dark:text-[#9aa4b2]">
									<span class="font-medium text-[#374151] dark:text-[#cbd5e1]">{post.sourceName}</span>
									<span>{formatDate(post.publishedAt)}</span>
									<span>{post.discoveredBy === 'feed' ? 'RSS' : '网页'}</span>
								</div>
							</div>
						</a>
					{/each}
				</div>
				{#if hasMorePosts}
					<div class="px-4 py-3 text-center shadow-[0_-1px_0_rgba(31,35,40,0.07)] dark:shadow-[0_-1px_0_rgba(255,255,255,0.07)]">
						<a
							href="/articles"
							class="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-[#0969da] hover:bg-[#eef6ff] dark:text-[#7cc4ff] dark:hover:bg-[#10233a]"
						>
							查看更多文章
						</a>
					</div>
				{/if}
			{/if}
		</section>

		<aside class="space-y-4">
			<section class="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div>
						<p class="text-xl font-semibold">{data.blogPostCount}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">文章</p>
					</div>
					<div>
						<p class="text-xl font-semibold">{totalAlumni}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">成员</p>
					</div>
					<div>
						<p class="text-xl font-semibold">{totalProjects}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">项目</p>
					</div>
					<div>
						<p class="text-xl font-semibold">{healthyBlogSources}/{totalBlogs}</p>
						<p class="text-[#6b7280] dark:text-[#9aa4b2]">文章源</p>
					</div>
				</div>
			</section>

			<section
				id="projects"
				class="rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
			>
				<div class="px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
					<h2 class="text-sm font-semibold">项目</h2>
				</div>
				<div>
					{#each data.projects as project}
						<a
							href={project.url}
							target="_blank"
							rel="noopener noreferrer"
							class="block px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.07)] last:shadow-none hover:bg-[#f8fafc] dark:shadow-[0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
						>
							<p class="line-clamp-1 text-sm font-semibold text-[#1d4ed8] dark:text-[#80bfff]">{project.name}</p>
							<p class="mt-1 line-clamp-2 text-xs leading-5 text-[#6b7280] dark:text-[#9aa4b2]">
								{project.description}
							</p>
						</a>
					{/each}
				</div>
			</section>

			<section class="hidden rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(31,35,40,0.08)] md:block dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
				<h2 class="text-sm font-semibold">成员</h2>
				<div class="mt-3 grid grid-cols-7 gap-2">
					{#each featuredMembers as person}
						<a
							href={person.github.url}
							target="_blank"
							rel="noopener noreferrer"
							title={person.nickname}
							class="rounded-xl hover:ring-2 hover:ring-[#7dd3fc]/60"
						>
							<img
								src={person.avatar}
								alt={person.nickname}
								class="h-9 w-9 rounded-xl bg-[#eef2f7] object-cover dark:bg-[#202631]"
								loading="lazy"
								decoding="async"
								referrerpolicy="no-referrer"
							/>
						</a>
					{/each}
					{#if hiddenMemberCount > 0}
						<a
							href="#members"
							title={`还有 ${hiddenMemberCount} 位成员`}
							aria-label={`还有 ${hiddenMemberCount} 位成员`}
							class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f5f7] text-lg font-semibold leading-none text-[#6b7280] hover:bg-[#e5eaf0] dark:bg-[#202631] dark:text-[#9aa4b2] dark:hover:bg-[#2a3340]"
						>
							…
						</a>
					{/if}
				</div>
			</section>
		</aside>

		<section
			id="members"
			class="min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] md:col-span-2 dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
		>
			<div class="flex flex-col gap-3 px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] sm:flex-row sm:items-center sm:justify-between dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
				<div>
					<h2 class="text-sm font-semibold">成员</h2>
					<p class="mt-0.5 text-xs text-[#6b7280] dark:text-[#9aa4b2]">{filteredAlumni.length}/{totalAlumni}</p>
				</div>
				<div class="flex w-full gap-2 sm:w-auto">
					<label class="block min-w-0 flex-1 sm:w-80">
						<span class="sr-only">搜索成员</span>
						<input
							type="search"
							bind:value={searchTerm}
							placeholder="搜索昵称、GitHub 或博客"
							class="w-full rounded-full bg-[#f3f5f7] px-4 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-[#7dd3fc] dark:bg-[#202631]"
						/>
					</label>
					<button
						type="button"
						onclick={shuffleMemberList}
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#eef2f7] dark:text-[#9aa4b2] dark:hover:bg-[#202631]"
						aria-label="随机成员排序"
						title="随机成员排序"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M16 3h5v5M4 20h2.5c2.5 0 4.1-1.1 5.5-3l1.4-2M4 4h2.5c2.5 0 4.1 1.1 5.5 3l4 6c1.4 1.9 3 3 5.5 3H22M16 21h5v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
			</div>

			<div class="grid sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredAlumni as person}
					<article class="px-4 py-3 shadow-[1px_1px_0_rgba(31,35,40,0.07)] dark:shadow-[1px_1px_0_rgba(255,255,255,0.07)]">
						<div class="flex items-center gap-3">
							{#if person.avatar}
								<img
									src={person.avatar}
									alt={person.nickname}
									class="h-10 w-10 rounded-xl bg-[#eef2f7] object-cover dark:bg-[#202631]"
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2f7] text-sm font-semibold text-[#6b7280] dark:bg-[#202631] dark:text-[#9aa4b2]">
									{person.nickname.charAt(0).toUpperCase()}
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-semibold">{person.nickname}</h3>
								<p class="truncate text-xs text-[#6b7280] dark:text-[#9aa4b2]">{person.github.text}</p>
							</div>
						</div>

						<div class="mt-3 flex gap-2">
							{#if person.github?.url}
								<a
									href={person.github.url}
									target="_blank"
									rel="noopener noreferrer"
									class="rounded-full bg-[#f3f5f7] px-2.5 py-1 text-xs hover:bg-[#e5eaf0] dark:bg-[#202631] dark:hover:bg-[#2a3340]"
								>
									GitHub
								</a>
							{/if}
							{#if person.blog?.url}
								<a
									href={person.blog.url}
									target="_blank"
									rel="noopener noreferrer"
									class="rounded-full bg-[#eef6ff] px-2.5 py-1 text-xs text-[#0969da] hover:bg-[#ddf4ff] dark:bg-[#10233a] dark:text-[#7cc4ff] dark:hover:bg-[#17314f]"
								>
									博客
								</a>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</section>

		<section
			id="sources"
			class="min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(31,35,40,0.08)] md:col-span-2 dark:bg-[#15191f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
		>
			<div class="px-4 py-3 shadow-[0_1px_0_rgba(31,35,40,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
				<h2 class="text-sm font-semibold">文章来源</h2>
			</div>
			<div class="grid sm:grid-cols-2 lg:grid-cols-5">
				{#each visibleSources as source}
					<a
						href={source.url}
						target="_blank"
						rel="noopener noreferrer"
						class="px-4 py-3 shadow-[1px_1px_0_rgba(31,35,40,0.07)] hover:bg-[#f8fafc] dark:shadow-[1px_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-[#1b2129]"
					>
						<p class="truncate text-sm font-medium">{source.name}</p>
						<p class="mt-1 truncate text-xs text-[#6b7280] dark:text-[#9aa4b2]">
							{sourceStatusLabel(source.status)} · {source.itemCount} 条
						</p>
					</a>
				{/each}
			</div>
		</section>
	</main>

	{#if showAbout}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6 backdrop-blur-sm dark:bg-black/55"
		>
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				aria-label="关闭关于弹窗"
				onclick={() => (showAbout = false)}
			></button>
			<div
				class="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-[#15191f]"
				role="dialog"
				aria-modal="true"
				aria-labelledby="about-title"
				tabindex="-1"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<h2 id="about-title" class="text-lg font-semibold">关于 ZZULI.dev</h2>
						<p class="mt-1 text-sm text-[#6b7280] dark:text-[#9aa4b2]">
							ZZULI 开发者的成员和博客文章索引。
						</p>
					</div>
					<button
						type="button"
						onclick={() => (showAbout = false)}
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[#eef2f7] dark:hover:bg-[#202631]"
						aria-label="关闭关于弹窗"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
						</svg>
					</button>
				</div>

				<div class="mt-5 space-y-3 text-sm">
					<a
						href="https://github.com/dogxii/zzuli-developers"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-between rounded-xl bg-[#f3f5f7] px-4 py-3 hover:bg-[#e9eef5] dark:bg-[#202631] dark:hover:bg-[#2a3340]"
					>
						<span>GitHub 仓库</span>
						<span class="text-[#1d4ed8] dark:text-[#80bfff]">dogxii/zzuli-developers</span>
					</a>
					<a
						href="mailto:hi@dogxi.me"
						class="flex items-center justify-between rounded-xl bg-[#f3f5f7] px-4 py-3 hover:bg-[#e9eef5] dark:bg-[#202631] dark:hover:bg-[#2a3340]"
					>
						<span>联系邮箱</span>
						<span class="text-[#1d4ed8] dark:text-[#80bfff]">hi@dogxi.me</span>
					</a>
				</div>

				<p class="mt-5 text-sm leading-6 text-[#6b7280] dark:text-[#9aa4b2]">
					想加入可以直接提交 PR 修改 README，也可以在 GitHub 提 Issue。文章数据由定时脚本从成员博客抓取标题和链接。
				</p>
			</div>
		</div>
	{/if}
</div>
