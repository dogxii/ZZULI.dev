#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const README_PATH = path.join(ROOT_DIR, 'README.md')
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'blog-posts.json')

const USER_AGENT =
	'zzuli-developers-blog-crawler/0.1 (+https://github.com/dogxii/zzuli-developers)'
const TIMEOUT_MS = Number(process.env.CRAWL_TIMEOUT_MS ?? 10000)
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY ?? 4)
const POSTS_PER_SOURCE = Number(process.env.POSTS_PER_SOURCE ?? 0)
const MAX_TOTAL_POSTS = Number(process.env.MAX_TOTAL_POSTS ?? 0)
const RECENT_YEARS = Number(process.env.RECENT_YEARS ?? 2)
const DEBUG_LINKED = process.env.DEBUG_LINKED === '1'
const MIN_POST_DATE = process.env.MIN_POST_DATE
	? new Date(process.env.MIN_POST_DATE)
	: yearsAgo(new Date(), RECENT_YEARS)
const MIN_POST_TIME = Number.isNaN(MIN_POST_DATE.getTime()) ? null : MIN_POST_DATE.getTime()

const NAV_TITLES = new Set([
	'about',
	'archives',
	'categories',
	'category',
	'friends',
	'home',
	'links',
	'login',
	'menu',
	'next',
	'previous',
	'rss',
	'search',
	'tag',
	'tags',
	'首页',
	'主页',
	'归档',
	'分类',
	'标签',
	'友链',
	'关于',
	'留言',
	'搜索',
	'登录',
	'加载更多',
	'下一页',
	'上一页',
])

const PATH_BLOCKLIST = [
	/\/(?:about|archives?|categories?|tags?|friends?|links?|login|admin|search)(?:\/|$)/i,
	/\/article\/list\/\d+/i,
	/\/category_\d+\.html$/i,
	/\/page\/\d+\/?$/i,
	/\.(?:7z|avi|css|docx?|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|rar|svg|webm|webp|xlsx?|zip)$/i,
]

const ARTICLE_HINTS = [
	/\/(?:post|posts|article|articles|archives|blog|p|entry)\/[^/]+/i,
	/\/blogs\/[^?#]+\.html$/i,
	/\/\d{4}\/\d{1,2}(?:\/\d{1,2})?\//,
	/\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
	/\/p\/\d+\.html$/i,
	/\/article\/details\/\d+/i,
]

function parseMarkdownLink(value) {
	const match = value.match(/\[(.*?)\]\((.*?)\)/)
	if (!match) return null

	return {
		text: match[1].trim(),
		url: match[2].trim(),
	}
}

async function readSources() {
	const content = await fs.readFile(README_PATH, 'utf-8')
	const lines = content.split('\n')
	const sources = []
	let currentSection = ''

	for (const line of lines) {
		const trimmed = line.trim()

		if (trimmed.startsWith('## ')) {
			currentSection = trimmed.slice(3).trim()
			continue
		}

		if (currentSection !== '校友大合集') continue
		if (
			trimmed.startsWith('| 昵称') ||
			trimmed.startsWith('| ---') ||
			!trimmed.startsWith('|')
		) {
			continue
		}

		const cells = trimmed
			.split('|')
			.map((cell) => cell.trim())
			.filter(Boolean)

		if (cells.length < 3) continue

		const blog = parseMarkdownLink(cells[2])
		if (!blog?.url || !/^https?:\/\//i.test(blog.url)) continue

		sources.push({
			name: cells[0],
			siteName: blog.text || cells[0],
			url: normalizeUrl(blog.url),
		})
	}

	return dedupeBy(sources, (source) => source.url)
}

function normalizeUrl(value, baseUrl) {
	const url = new URL(value, baseUrl)
	url.hash = ''

	if (url.pathname !== '/') {
		url.pathname = url.pathname.replace(/\/+$/, '')
	}

	return url.toString()
}

function withTrailingSlash(value) {
	return value.endsWith('/') ? value : `${value}/`
}

function takeLimit(values, limit) {
	return limit > 0 ? values.slice(0, limit) : values
}

function yearsAgo(date, years) {
	const result = new Date(date)
	result.setFullYear(result.getFullYear() - years)

	return result
}

function parseAttributes(tag) {
	const attrs = new Map()
	const attrPattern = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

	for (const match of tag.matchAll(attrPattern)) {
		const key = match[1].toLowerCase()
		if (key === 'link' || key === 'a') continue

		attrs.set(key, decodeHtml(match[2] ?? match[3] ?? match[4] ?? ''))
	}

	return attrs
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

	try {
		const response = await fetch(url, {
			headers: {
				accept,
				'user-agent': USER_AGENT,
			},
			redirect: 'follow',
			signal: controller.signal,
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		return {
			url: response.url,
			contentType: response.headers.get('content-type') ?? '',
			text: await response.text(),
		}
	} finally {
		clearTimeout(timeout)
	}
}

function extractFeedLinks(html, baseUrl) {
	const links = []

	for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
		const attrs = parseAttributes(match[0])
		const rel = attrs.get('rel') ?? ''
		const type = attrs.get('type') ?? ''
		const href = attrs.get('href')

		if (!href) continue
		if (!/\balternate\b/i.test(rel)) continue
		if (!/(rss|atom|feed|json)/i.test(type)) continue

		try {
			links.push(normalizeUrl(href, baseUrl))
		} catch {
			// Ignore malformed feed links.
		}
	}

	return links
}

function candidateFeedUrls(homeUrl) {
	const base = withTrailingSlash(homeUrl)
	const url = new URL(homeUrl)
	const root = `${url.origin}/`
	const suffixes = [
		'feed',
		'feed/',
		'feed.xml',
		'rss',
		'rss/',
		'rss.xml',
		'atom.xml',
		'index.xml',
	]
	const candidates = []

	for (const suffix of suffixes) {
		candidates.push(normalizeUrl(suffix, base))
		candidates.push(normalizeUrl(suffix, root))
	}

	const pathParts = url.pathname.split('/').filter(Boolean)

	if (/^blog\.csdn\.net$/i.test(url.hostname) && pathParts[0]) {
		candidates.unshift(`https://rss.csdn.net/${pathParts[0]}/rss/map`)
		candidates.unshift(`${url.origin}/${pathParts[0]}/rss/list`)
	}

	if (/^(www\.)?cnblogs\.com$/i.test(url.hostname) && pathParts[0]) {
		candidates.unshift(`${url.origin}/${pathParts[0]}/rss/`)
	}

	return dedupe(candidates)
}

function looksLikeFeed(text, contentType) {
	const sample = text.slice(0, 500).toLowerCase()
	return (
		/(rss|atom|feed|xml|json)/i.test(contentType) ||
		sample.includes('<rss') ||
		sample.includes('<feed') ||
		sample.includes('<rdf:rdf') ||
		sample.includes('"items"')
	)
}

async function collectSource(source, depth = 0) {
	const fetchedAt = new Date().toISOString()
	let homepage
	let homeError
	let activeSource = source

	for (const homeUrl of candidateHomeUrls(source.url)) {
		try {
			homepage = await fetchText(homeUrl)
			activeSource = { ...source, url: normalizeUrl(homepage.url) }
			homeError = null
			break
		} catch (error) {
			homeError = error
		}
	}

	const feedUrls = dedupe([
		...(homepage ? extractFeedLinks(homepage.text, homepage.url) : []),
		...candidateFeedUrls(homepage?.url ?? activeSource.url),
	])

	for (const feedUrl of feedUrls.slice(0, 18)) {
		try {
			const feed = await fetchText(
				feedUrl,
				'application/rss+xml,application/atom+xml,application/feed+json,application/xml,text/xml,*/*;q=0.8',
			)

			if (!looksLikeFeed(feed.text, feed.contentType)) continue

			const posts = parseFeed(feed.text, feed.url, activeSource, fetchedAt)
			if (posts.length > 0) {
				return {
					source: activeSource,
					status: 'ok',
					strategy: 'feed',
					feedUrl: feed.url,
					posts: takeLimit(posts, POSTS_PER_SOURCE),
				}
			}
		} catch {
			// Feed candidates are best-effort.
		}
	}

	if (homepage) {
		const htmlPosts = await extractHtmlPosts(homepage.text, homepage.url, activeSource, fetchedAt)
		if (htmlPosts.length > 0) {
			return {
				source: activeSource,
				status: 'ok',
				strategy: 'html',
				posts: takeLimit(htmlPosts, POSTS_PER_SOURCE),
			}
		}
	}

	const sitemapPosts = await collectSitemapPosts(homepage?.url ?? activeSource.url, activeSource, fetchedAt)
	if (sitemapPosts.length > 0) {
		return {
			source: activeSource,
			status: 'ok',
			strategy: 'sitemap',
			posts: takeLimit(sitemapPosts, POSTS_PER_SOURCE),
		}
	}

	if (homepage && depth < 1) {
		for (const linkedUrl of extractLinkedBlogUrls(homepage.text, homepage.url).slice(0, 3)) {
			if (DEBUG_LINKED) console.log(`linked candidate ${source.name}: ${linkedUrl}`)
			const linkedResult = await collectSource({ ...source, url: linkedUrl }, depth + 1)
			if (DEBUG_LINKED) {
				console.log(
					`linked result ${source.name}: ${linkedResult.status} ${linkedResult.strategy} ${linkedResult.posts.length}`,
				)
			}
			if (linkedResult.status === 'ok') {
				return {
					...linkedResult,
					strategy: `linked-${linkedResult.strategy}`,
				}
			}
		}
	}

	if (homeError) {
		return {
			source: activeSource,
			status: 'error',
			strategy: 'home',
			error: homeError.message,
			posts: [],
		}
	}

	return {
		source: activeSource,
		status: 'empty',
		strategy: 'none',
		error: 'No feed, article links, or sitemap posts found.',
		posts: [],
	}
}

function candidateHomeUrls(homeUrl) {
	const url = new URL(homeUrl)
	const urls = [normalizeUrl(homeUrl)]

	if (url.hostname.startsWith('www.')) {
		const apex = new URL(url)
		apex.hostname = apex.hostname.replace(/^www\./i, '')
		urls.push(normalizeUrl(apex.toString()))
	}

	return dedupe(urls)
}

function extractLinkedBlogUrls(html, baseUrl) {
	const candidates = []

	for (const [index, match] of [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].entries()) {
		const attrs = parseAttributes(`<a ${match[1]}>`)
		const href = attrs.get('href')
		if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue

		let url
		try {
			url = normalizeUrl(href, baseUrl)
		} catch {
			continue
		}

		if (isSameSite(url, baseUrl)) continue

		const parsedUrl = new URL(url)
		if (/(github|bilibili|qq|twitter|x\.com|discord|vercel|hexo)\./i.test(parsedUrl.hostname)) {
			continue
		}

		const label = cleanText(attrs.get('title') ?? '') || cleanText(match[2])
		const haystack = `${label} ${parsedUrl.hostname} ${parsedUrl.pathname}`.toLowerCase()
		let score = 0

		if (/(blog|博客|文章)/i.test(haystack)) score += 5
		if (/(note|notes|笔记)/i.test(haystack)) score += 4
		if (/csdn\.net|cnblogs\.com|github\.io/i.test(parsedUrl.hostname)) score += 2
		if (score <= 0) continue

		candidates.push({ url, score, index })
	}

	return dedupeBy(
		candidates.sort((a, b) => b.score - a.score || a.index - b.index),
		(candidate) => candidate.url,
	).map((candidate) => candidate.url)
}

function parseFeed(text, feedUrl, source, fetchedAt) {
	const trimmed = text.trim()

	if (trimmed.startsWith('{')) {
		return parseJsonFeed(trimmed, feedUrl, source, fetchedAt)
	}

	const itemMatches = [...trimmed.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
	const entryMatches = [...trimmed.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
	const blocks = itemMatches.length > 0 ? itemMatches : entryMatches

	return blocks
		.map((match, index) => {
			const block = match[0]
			const title = cleanText(readXmlTag(block, 'title'))
			const link =
				cleanText(readXmlTag(block, 'link')) ||
				readAtomLink(block) ||
				cleanText(readXmlTag(block, 'guid'))
			const publishedAt =
				parseDate(readXmlTag(block, 'pubDate')) ??
				parseDate(readXmlTag(block, 'published')) ??
				parseDate(readXmlTag(block, 'updated')) ??
				parseDate(readXmlTag(block, 'dc:date'))

			if (!title || !link) return null

			return makePost({
				title,
				url: link,
				baseUrl: feedUrl,
				source,
				publishedAt,
				fetchedAt,
				discoveredBy: 'feed',
				rank: index,
			})
		})
		.filter(Boolean)
}

function parseJsonFeed(text, feedUrl, source, fetchedAt) {
	try {
		const parsed = JSON.parse(text)
		if (!Array.isArray(parsed.items)) return []

		return parsed.items
			.map((item, index) => {
				const title = cleanText(item.title ?? item.summary ?? item.content_text ?? '')
				const link = item.url ?? item.external_url ?? item.id
				const publishedAt = parseDate(item.date_published) ?? parseDate(item.date_modified)

				if (!title || !link) return null

				return makePost({
					title,
					url: link,
					baseUrl: feedUrl,
					source,
					publishedAt,
					fetchedAt,
					discoveredBy: 'feed',
					rank: index,
				})
			})
			.filter(Boolean)
	} catch {
		return []
	}
}

function readXmlTag(block, tagName) {
	const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const match = block.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
	if (!match) return ''

	return decodeHtml(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim())
}

function readAtomLink(block) {
	for (const match of block.matchAll(/<link\b[^>]*>/gi)) {
		const attrs = parseAttributes(match[0])
		const rel = attrs.get('rel') ?? 'alternate'
		const href = attrs.get('href')

		if (href && /^(alternate|)$/i.test(rel)) {
			return href
		}
	}

	return ''
}

async function extractHtmlPosts(html, baseUrl, source, fetchedAt) {
	const candidates = []

	for (const [index, match] of [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].entries()) {
		const attrs = parseAttributes(`<a ${match[1]}>`)
		const href = attrs.get('href')
		if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue

		let url
		try {
			url = normalizeUrl(href, baseUrl)
		} catch {
			continue
		}

		if (!isSameSite(url, baseUrl)) continue

		const title = refineTitle(cleanText(attrs.get('title') ?? '') || cleanText(match[2]))
		if (!isPlausibleTitle(title)) continue

		const score = scoreHtmlCandidate(url, title, match[0])
		if (score < 5) continue

		candidates.push({
			title,
			url,
			score,
			index,
			publishedAt: inferDateFromUrl(url),
		})
	}

	const selectedCandidates = dedupeBy(candidates, (candidate) => candidate.url)
		.sort((a, b) => b.score - a.score || a.index - b.index)
	const limitedCandidates = takeLimit(selectedCandidates, POSTS_PER_SOURCE)

	const resolvedCandidates = await mapLimit(limitedCandidates, 2, async (candidate) => {
		try {
			const page = await fetchText(candidate.url)
			const pageTitle = extractPageTitle(page.text, source)
			if (pageTitle) {
				return { ...candidate, title: pageTitle }
			}
		} catch {
			// The homepage title is good enough when the article page blocks requests.
		}

		return candidate
	})

	return resolvedCandidates
		.map((candidate, rank) =>
			makePost({
				title: candidate.title,
				url: candidate.url,
				source,
				publishedAt: candidate.publishedAt,
				fetchedAt,
				discoveredBy: 'html',
				rank,
			}),
		)
		.filter(Boolean)
}

function isSameSite(value, baseUrl) {
	const url = new URL(value)
	const base = new URL(baseUrl)

	return url.hostname === base.hostname
}

function isPlausibleTitle(title) {
	const normalized = title.trim()
	const navKey = normalized.toLowerCase()

	return normalized.length >= 3 && normalized.length <= 120 && !NAV_TITLES.has(navKey)
}

function scoreHtmlCandidate(value, title, anchorHtml) {
	const url = new URL(value)
	const pathValue = decodeURIComponent(url.pathname)
	const lowerPath = pathValue.toLowerCase()
	let score = 0

	if (PATH_BLOCKLIST.some((pattern) => pattern.test(lowerPath))) score -= 10
	if (ARTICLE_HINTS.some((pattern) => pattern.test(value))) score += 7
	if (/(post|article|entry|item|title|card|archive)/i.test(anchorHtml)) score += 3
	if (/<h[1-3]\b/i.test(anchorHtml)) score += 2
	if (title.length >= 6 && title.length <= 80) score += 2
	if (pathValue.split('/').filter(Boolean).length >= 2) score += 1
	if (/^\W+$/.test(title)) score -= 6

	return score
}

async function collectSitemapPosts(homeUrl, source, fetchedAt) {
	const home = new URL(homeUrl)
	const sitemapUrls = dedupe([
		normalizeUrl('sitemap.xml', withTrailingSlash(homeUrl)),
		`${home.origin}/sitemap.xml`,
	])
	const documents = []

	for (const sitemapUrl of sitemapUrls) {
		try {
			documents.push(await fetchText(sitemapUrl, 'application/xml,text/xml,*/*;q=0.8'))
			break
		} catch {
			// Try the next sitemap location.
		}
	}

	const firstDocument = documents[0]
	if (!firstDocument) return []

	const locs = parseSitemapLocs(firstDocument.text)
	const nestedSitemaps = locs
		.map((entry) => entry.loc)
		.filter((loc) => /\.xml(?:\.gz)?$/i.test(loc) && /(?:post|article|page|sitemap)/i.test(loc))
		.slice(0, 4)

	for (const nestedUrl of nestedSitemaps) {
		try {
			documents.push(await fetchText(nestedUrl, 'application/xml,text/xml,*/*;q=0.8'))
		} catch {
			// Nested sitemaps are best-effort.
		}
	}

	const entries = takeLimit(dedupeBy(
		documents
			.flatMap((document) => parseSitemapLocs(document.text))
			.filter((entry) => isSameSite(entry.loc, homeUrl))
			.filter((entry) => isLikelySitemapArticle(entry.loc, homeUrl))
			.map((entry) => ({
				...entry,
				publishedAt: parseDate(entry.lastmod) ?? inferDateFromUrl(entry.loc),
			}))
			.sort(
				(a, b) =>
					Number(new Date(b.publishedAt ?? 0)) - Number(new Date(a.publishedAt ?? 0)),
			),
		(entry) => entry.loc,
	), POSTS_PER_SOURCE)

	const resolvedEntries = await mapLimit(entries, 2, async (entry, rank) => {
		const fallbackTitle = titleFromUrl(entry.loc)
		let title = fallbackTitle

		try {
			const page = await fetchText(entry.loc)
			title = extractPageTitle(page.text, source) || fallbackTitle
		} catch {
			// URL-derived titles are an acceptable sitemap fallback.
		}

		if (!isUsefulSitemapTitle(title, fallbackTitle, source)) return null

		return makePost({
			title,
			url: entry.loc,
			source,
			publishedAt: entry.publishedAt,
			fetchedAt,
			discoveredBy: 'sitemap',
			rank,
		})
	})

	return resolvedEntries.filter(Boolean)
}

function isLikelySitemapArticle(value, homeUrl) {
	if (ARTICLE_HINTS.some((pattern) => pattern.test(value))) return true

	const url = new URL(value)
	const pathParts = url.pathname.split('/').filter(Boolean)
	const lowerPath = decodeURIComponent(url.pathname).toLowerCase()

	if (PATH_BLOCKLIST.some((pattern) => pattern.test(lowerPath))) return false

	if (url.hostname === 'hello-ctf.com') {
		return pathParts.length >= 2 && !/^docker-template$/i.test(pathParts[0])
	}

	if (url.hostname === new URL(homeUrl).hostname && pathParts.length >= 3) {
		return /\d{4}/.test(lowerPath)
	}

	return false
}

function parseSitemapLocs(xml) {
	const entries = []

	for (const match of xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)) {
		const block = match[0]
		const loc = cleanText(readXmlTag(block, 'loc'))
		if (!loc) continue

		entries.push({
			loc,
			lastmod: cleanText(readXmlTag(block, 'lastmod')),
		})
	}

	if (entries.length > 0) return entries

	return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((match) => ({
		loc: decodeHtml(match[1].trim()),
		lastmod: null,
	}))
}

function makePost({ title, url, baseUrl, source, publishedAt, fetchedAt, discoveredBy, rank }) {
	let normalizedUrl

	try {
		normalizedUrl = normalizeUrl(url, baseUrl)
	} catch {
		return null
	}

	return {
		id: crypto.createHash('sha1').update(`${source.url}:${normalizedUrl}`).digest('hex').slice(0, 12),
		title: cleanText(title),
		url: normalizedUrl,
		sourceName: source.name,
		sourceSiteName: source.siteName,
		sourceUrl: source.url,
		publishedAt,
		fetchedAt,
		discoveredBy,
		rank,
	}
}

function extractPageTitle(html, source) {
	const metaTitle =
		readMetaContent(html, 'property', 'og:title') ||
		readMetaContent(html, 'name', 'twitter:title') ||
		readMetaContent(html, 'name', 'title')
	const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
	const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]

	const cleanTitle = stripSiteSuffix(cleanText(metaTitle || h1 || title || ''))

	if (!cleanTitle || cleanTitle === source.siteName || cleanTitle === source.name) {
		return ''
	}

	return cleanTitle
}

function readMetaContent(html, attrName, attrValue) {
	for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attrs = parseAttributes(match[0])
		if (attrs.get(attrName)?.toLowerCase() === attrValue.toLowerCase()) {
			return attrs.get('content') ?? ''
		}
	}

	return ''
}

function stripSiteSuffix(value) {
	return value
		.replace(/[_-].{0,60}CSDN博客$/u, '')
		.replace(/\s*[-_|·]\s*[^-_|·]{1,40}$/u, '')
		.replace(/\s+[-|·]\s+[^-|·]{1,40}$/u, '')
		.replace(/\s+/g, ' ')
		.trim()
}

function refineTitle(value) {
	return value
		.replace(/\s+原创\s+博文更新于[\s\S]*$/u, '')
		.replace(/\s+原创\s+[\s\S]*阅读[\s\S]*$/u, '')
		.replace(/^(.{6,36})\s+\1[\s\S]*$/u, '$1')
		.replace(/\s+在不开启[\s\S]*$/u, '')
		.replace(/\s+的系统版本为[\s\S]*$/u, '')
		.replace(/\s+/g, ' ')
		.trim()
}

function isUsefulSitemapTitle(title, fallbackTitle, source) {
	if (!isPlausibleTitle(title)) return false
	if (title === source.siteName || title === source.name) return false
	if (/^\d+$/.test(title) && /^\d+$/.test(fallbackTitle)) return false

	return true
}

function cleanText(value) {
	return decodeHtml(
		String(value ?? '')
			.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
			.replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim(),
	)
}

function decodeHtml(value) {
	const named = {
		amp: '&',
		apos: "'",
		gt: '>',
		lt: '<',
		nbsp: ' ',
		quot: '"',
	}

	return String(value ?? '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, code) => {
		if (code[0] === '#') {
			const isHex = code[1]?.toLowerCase() === 'x'
			const number = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10)

			return Number.isFinite(number) ? String.fromCodePoint(number) : entity
		}

		return named[code.toLowerCase()] ?? entity
	})
}

function parseDate(value) {
	if (!value) return null

	const date = new Date(decodeHtml(value).trim())
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function inferDateFromUrl(value) {
	const match = value.match(/(?:^|[/-])(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?/)
	if (!match) return null

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3] ?? 1)
	const date = new Date(Date.UTC(year, month - 1, day))

	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function titleFromUrl(value) {
	const url = new URL(value)
	const segments = url.pathname.split('/').filter(Boolean)
	const slug = segments.at(-1)?.replace(/\.(html?|php)$/i, '') ?? url.hostname

	return decodeURIComponent(slug)
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function dedupe(values) {
	return [...new Set(values)]
}

function dedupeBy(values, keyFn) {
	const seen = new Set()
	const result = []

	for (const value of values) {
		const key = keyFn(value)
		if (seen.has(key)) continue

		seen.add(key)
		result.push(value)
	}

	return result
}

async function mapLimit(values, limit, mapper) {
	const results = new Array(values.length)
	let index = 0

	async function worker() {
		while (index < values.length) {
			const currentIndex = index
			index += 1
			results[currentIndex] = await mapper(values[currentIndex], currentIndex)
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
	return results
}

function sortPosts(posts) {
	return posts.sort((a, b) => {
		const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
		const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0

		if (aTime || bTime) return bTime - aTime
		return a.rank - b.rank
	})
}

function isRecentPost(post) {
	if (!MIN_POST_TIME || !post.publishedAt) return true

	const time = new Date(post.publishedAt).getTime()
	if (Number.isNaN(time)) return true

	return time >= MIN_POST_TIME
}

function filterRecentResult(result) {
	const posts = result.posts.filter(isRecentPost)

	if (result.status === 'ok' && posts.length === 0) {
		return {
			...result,
			status: 'empty',
			error: `No posts since ${MIN_POST_DATE.toISOString().slice(0, 10)}.`,
			posts,
		}
	}

	return {
		...result,
		posts,
	}
}

const sources = await readSources()
console.log(`Collecting posts from ${sources.length} blog sources...`)
if (MIN_POST_TIME) {
	console.log(`Keeping posts since ${MIN_POST_DATE.toISOString().slice(0, 10)}...`)
}

const results = (await mapLimit(sources, CONCURRENCY, (source) => collectSource(source))).map(
	filterRecentResult,
)
const generatedAt = new Date().toISOString()
const posts = takeLimit(sortPosts(
	dedupeBy(
		results
			.flatMap((result) => result.posts)
			.filter(Boolean),
		(post) => post.url,
	),
), MAX_TOTAL_POSTS)

const output = {
	generatedAt,
	sourceCount: sources.length,
	okSourceCount: results.filter((result) => result.status === 'ok').length,
	posts,
	sources: results.map((result) => ({
		name: result.source.name,
		siteName: result.source.siteName,
		url: result.source.url,
		status: result.status,
		strategy: result.strategy,
		feedUrl: result.feedUrl,
		itemCount: result.posts.length,
		error: result.error,
	})),
}

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
await fs.writeFile(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(output, null, 2)}\n`, 'utf-8')
await fs.rename(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH)

for (const result of results) {
	const status = result.status === 'ok' ? 'ok' : result.status
	console.log(`${status.padEnd(5)} ${result.strategy.padEnd(7)} ${String(result.posts.length).padStart(2)} ${result.source.name}`)
}

console.log(`Wrote ${posts.length} posts to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`)
