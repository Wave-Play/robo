import React from 'react'
import styles from '../../pages/templates.module.css'
import Icon from '@mdi/react'
import type { TemplateFilter } from '@site/src/data/templates'

interface TemplateFiltersItemProps {
	filter: TemplateFilter
	onClick?: (filter: TemplateFilter) => void
	selected?: boolean
}

export const TemplateFiltersItem = (props: TemplateFiltersItemProps) => {
	const { filter, onClick, selected } = props

	return (
		<button
			key={filter.value}
			className={styles.filterOption + (selected ? ' ' + styles.filterOptionSelected : ' ' + styles.filterOptionUnselected)}
			onClick={() => onClick?.(filter)}
		>
			<Icon path={filter.icon} size={1} color={selected ? '#00BFA5' : 'rgb(142, 141, 145)'} />
			<span className={styles.filterOptionLabel + (selected ? ' ' + styles.filterOptionLabelSelected : '')}>
				{filter.name}
			</span>
		</button>
	)
}
