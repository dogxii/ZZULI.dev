import { loadSiteData } from '$lib/server/site-data'
import type { PageServerLoad } from './$types'

export const prerender = true

export const load: PageServerLoad = async () => loadSiteData()
