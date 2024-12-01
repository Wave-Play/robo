import { mdiDotsGrid } from '@mdi/js'
import { atom, useAtom } from 'jotai'
import type { TemplateFilter } from '../data/templates'

const Default = {
	icon: mdiDotsGrid,
	name: 'All Templates',
	value: 'all-templates'
}

const templateFiltersAtom = atom({
	filter: Default as TemplateFilter,
	searchQuery: ''
})

export function useTemplateFilters() {
	const [templateFilters, setTemplateFilters] = useAtom(templateFiltersAtom)

	const setFilter = (filter: TemplateFilter) => {
		setTemplateFilters((prev) => ({ ...prev, filter }))
	}
	const setSearchQuery = (searchQuery: string) => {
		setTemplateFilters((prev) => ({ ...prev, searchQuery }))
	}

	return {
		filter: templateFilters.filter,
		searchQuery: templateFilters.searchQuery,
		setFilter,
		setSearchQuery
	}
}
