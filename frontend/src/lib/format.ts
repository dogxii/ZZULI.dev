export function formatPostDate(value: string | null | undefined): string {
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

export function formatGeneratedAt(value: string | null): string {
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
