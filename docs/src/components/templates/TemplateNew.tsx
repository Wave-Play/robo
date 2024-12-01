import React from 'react'
import styles from '../../pages/templates.module.css'
import { ExaButton } from '../shared/ExaButton'

export const TemplateNew = () => {
	return (
		<div className={styles.templateNewContainer}>
			<h3 className={styles.filterTitle}>Not what you're looking for?</h3>
			<p>Create your own template and share it with the community!</p>
			<ExaButton href="https://github.com/Wave-Play/robo.js/blob/main/CONTRIBUTING.md" style={{ height: 48 }}>
				Create Template
			</ExaButton>
		</div>
	)
}

