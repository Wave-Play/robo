import React from 'react'
import { ExaShape } from '../shared/ExaShape'
import Link from '@docusaurus/Link'
import styles from '../../pages/templates.module.css'
import { getPreview, Template } from '@site/src/data/templates'
import Icon from '@mdi/react'
import {
	mdiHelp,
	mdiLanguageJavascript,
	mdiLanguageTypescript,
	mdiLightbulb,
	mdiPowerPlug,
	mdiRobot,
	mdiShapePlus,
	mdiWeb
} from '@mdi/js'
import { ExaGrow } from '../shared/ExaGrow'

interface TemplateGridItemProps {
	template: Template
}

export const TemplateGridItem = (props: TemplateGridItemProps) => {
	const { template } = props

	return (
		<ExaGrow scale={1.05} style={{ maxWidth: 'min(calc(100vw - 32px), 444px)', width: '100%' }}>
			<Link className={styles.templateItem} to={template.href}>
				<ExaShape defaultHeight={360} defaultWidth={432} innerBorderWidth={2}>
					<div className={styles.template}>
						<ExaShape
							blur={false}
							clip={true}
							defaultHeight={249.75}
							highlight={false}
							innerBorderWidth={2}
							innerColor={'var(--template-item-background)'}
							outerColor={'transparent'}
						>
							<>
								<img className={styles.templateImage} src={getPreview(template)} alt={template.title} />
								<div className={styles.templateImageStub} />
							</>
						</ExaShape>
						<h3 className={styles.templateTitle}>{template.title}</h3>
						<p className={styles.templateDescription}>{template.description}</p>
						<div className={styles.templateFooter}>
							{template.tags.map((tag) => getTagIcon(tag))}
							{template.author && (
								<span className={styles.templateAuthorContainer}>
									<span className={styles.templateAuthorBy}>By </span>
									<strong
										className={template.author === 'WavePlay' ? styles.templateAuthorWavePlay : styles.templateAuthor}
									>
										{template.author}
									</strong>
								</span>
							)}
						</div>
					</div>
				</ExaShape>
			</Link>
		</ExaGrow>
	)
}

function getTagIcon(tag: string) {
	switch (tag) {
		case 'Discord Activity':
			return <Icon path={mdiShapePlus} color={'#25C2A0'} size={'20px'} />
		case 'Discord Bot':
			return <Icon path={mdiRobot} color={'#5865F2'} size={'20px'} />
		case 'JavaScript':
			return <Icon path={mdiLanguageJavascript} color={'#F7DF1E'} size={'20px'} />
		case 'MrJAwesome':
			return <Icon path={mdiLightbulb} color={'#FFD700'} size={'20px'} />
		case 'Plugin':
			return <Icon path={mdiPowerPlug} size={'20px'} />
		case 'TypeScript':
			return <Icon path={mdiLanguageTypescript} color={'#3178C6'} size={'20px'} />
		case 'Web App':
			return <Icon path={mdiWeb} color={'#00BCD4'} size={'20px'} />
		default:
			return <Icon path={mdiHelp} size={'20px'} />
	}
}
