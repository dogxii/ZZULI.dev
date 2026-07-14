import fs from 'node:fs'
import path from 'node:path'

export type Project = {
	name: string
	url: string
	description: string
}

export type Link = {
	text: string
	url: string | null
}

export type Alumni = {
	nickname: string
	github: Link
	blog: Link | null
	avatar: string | null
}

export type BlogPost = {
	id?: string
	title: string
	url: string
	sourceName: string
	sourceSiteName?: string
	sourceUrl: string
	publishedAt: string | null
	fetchedAt: string
	discoveredBy: 'feed' | 'html' | 'sitemap' | string
}

export type BlogSource = {
	name: string
	siteName?: string
	url: string
	status: string
	strategy: string
	itemCount: number
	error?: string
}

type BlogPostsFile = {
	generatedAt?: string
	posts?: BlogPost[]
	sources?: BlogSource[]
}

type LoadSiteDataOptions = {
	postLimit?: number
}

function findRepoFile(relativePath: string): string | null {
	const candidates = [
		path.resolve(process.cwd(), '..', relativePath),
		path.resolve(process.cwd(), relativePath),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	return null
}

function parseLink(md: string): Link {
	const match = md.match(/\[(.*?)\]\((.*?)\)/)
	if (match) {
		return { text: match[1], url: match[2] }
	}

	const text = md.trim()
	return { text, url: text.startsWith('http') ? text : null }
}

function parseReadme(content: string): { projects: Project[]; alumni: Alumni[] } {
	const lines = content.split('\n')
	const projects: Project[] = []
	const alumni: Alumni[] = []
	let currentSection = ''

	for (const line of lines) {
		const trimmedLine = line.trim()

		if (trimmedLine.startsWith('## ')) {
			currentSection = trimmedLine.substring(3).trim()
			continue
		}

		if (currentSection === '项目列表') {
			const match = trimmedLine.match(/^- \[(.*?)\]\((.*?)\): (.*)$/)
			if (match) {
				projects.push({
					name: match[1],
					url: match[2],
					description: match[3],
				})
			}
			continue
		}

		if (currentSection !== '校友大合集') {
			continue
		}

		if (
			trimmedLine.startsWith('| 昵称') ||
			trimmedLine.startsWith('| ---') ||
			!trimmedLine.startsWith('|')
		) {
			continue
		}

		const cols = trimmedLine
			.split('|')
			.map((cell) => cell.trim())
			.filter(Boolean)

		if (cols.length < 2) {
			continue
		}

		const nickname = cols[0]
		const github = parseLink(cols[1])
		const blog = cols[2] ? parseLink(cols[2]) : null
		let avatar: string | null = null

		if (github.url) {
			const match = github.url.match(/github\.com\/([^/]+)/)
			if (match) {
				avatar = `https://github.com/${match[1]}.png`
			}
		}

		alumni.push({
			nickname,
			github,
			blog,
			avatar,
		})
	}

	return { projects, alumni }
}

function readBlogPosts(): {
	generatedAt: string | null
	posts: BlogPost[]
	sources: BlogSource[]
} {
	const postsPath = findRepoFile('data/blog-posts.json')

	if (!postsPath) {
		return {
			generatedAt: null,
			posts: [],
			sources: [],
		}
	}

	try {
		const parsed = JSON.parse(fs.readFileSync(postsPath, 'utf-8')) as BlogPostsFile
		return {
			generatedAt: parsed.generatedAt ?? null,
			posts: parsed.posts ?? [],
			sources: parsed.sources ?? [],
		}
	} catch (error) {
		console.error('Error reading data/blog-posts.json:', error)
		return {
			generatedAt: null,
			posts: [],
			sources: [],
		}
	}
}

export function loadSiteData(options: LoadSiteDataOptions = {}) {
	const readmePath = findRepoFile('README.md')

	if (!readmePath) {
		return {
			projects: [],
			alumni: [],
			blogPosts: [],
			blogPostCount: 0,
			blogPostsGeneratedAt: null,
			blogSources: [],
		}
	}

	try {
		const fileContent = fs.readFileSync(readmePath, 'utf-8')
		const { projects, alumni } = parseReadme(fileContent)
		const blogPosts = readBlogPosts()
		const posts =
			typeof options.postLimit === 'number'
				? blogPosts.posts.slice(0, options.postLimit)
				: blogPosts.posts

		return {
			projects,
			alumni,
			blogPosts: posts,
			blogPostCount: blogPosts.posts.length,
			blogPostsGeneratedAt: blogPosts.generatedAt,
			blogSources: blogPosts.sources,
		}
	} catch (error) {
		console.error('Error reading site data:', error)
		return {
			projects: [],
			alumni: [],
			blogPosts: [],
			blogPostCount: 0,
			blogPostsGeneratedAt: null,
			blogSources: [],
		}
	}
}
