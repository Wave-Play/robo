import React, { useEffect, useRef } from 'react'
import styles from '../../pages/templates.module.css'
import { Filters } from '@site/src/data/templates'
import { useTemplateFilters } from '@site/src/hooks/useTemplateFilters'
import { mdiMagnify } from '@mdi/js'
import Icon from '@mdi/react'
import { TemplateFiltersItem } from './TemplateFiltersItem'
import type { TemplateFilter } from '@site/src/data/templates'

export const TemplateFilters = () => {
	const { filter: selectedFilter, setFilter, setSearchQuery } = useTemplateFilters()
	const searchRef = useRef<HTMLInputElement>(null)

	// Apply filter and search from URL if available
	useEffect(() => {
		const url = new URL(window.location.href)
		const filter = url.searchParams.get('filter')
		const filterFound = Filters.find((f) => f.value === filter)
		const search = url.searchParams.get('search')

		if (filterFound) {
			setFilter(filterFound)
		}
		if (search) {
			setSearchQuery(search)
			searchRef.current?.focus()
			searchRef.current?.setAttribute('value', search)
			searchRef.current?.setSelectionRange(search.length, search.length)
		}
	}, [])

	const onClickFilter = (filter: TemplateFilter) => {
		setFilter(filter)

		// Update URL query
		const url = new URL(window.location.href)
		if (filter.value === 'all-templates') {
			url.searchParams.delete('filter')
		} else {
			url.searchParams.set('filter', filter.value)
		}
		window.history.pushState({}, '', url.toString())
	}

	const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchQuery(e.target.value)

		// Update URL query
		const url = new URL(window.location.href)
		if (!e.target.value?.trim()) {
			url.searchParams.delete('search')
		} else {
			url.searchParams.set('search', e.target.value)
		}
		window.history.pushState({}, '', url.toString())
	}

	return (
		<div className={styles.filterBar}>
			<h3 className={styles.filterTitle}>Filter Templates</h3>
			<div className={styles.searchContainer}>
				<Icon className={styles.searchIcon} path={mdiMagnify} size={'20px'} color="rgb(142, 141, 145)" />
				<input ref={searchRef} className={styles.searchInput} onChange={onSearch} placeholder="Search..." type="text" />
			</div>
			<div className={styles.filterOptions}>
				{Filters.map((filter) => (
					<TemplateFiltersItem
						key={filter.value}
						filter={filter}
						onClick={onClickFilter}
						selected={selectedFilter.value === filter.value}
					/>
				))}
			</div>
		</div>
	)
}
