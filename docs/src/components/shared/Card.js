import React from 'react'
import Link from '@docusaurus/Link'
import Heading from '@theme/Heading'
import { ExaShape } from './ExaShape'
import { ExaGrow } from './ExaGrow'

export const Card = (props) => {
	const { description, href, style, title } = props

	return (
		<ExaGrow className="col col--6 nodecor margin-bottom--lg" scale={1.05} style={{ position: 'relative', ...style }}>
			<Link style={{ width: '100%', textDecoration: 'none', position: 'relative', ...style }} to={href}>
				<ExaShape innerBorderWidth={2}>
					<div className={'card padding--lg cardContent'}>
						<Heading as="h4" className="text--truncate cardTitle">
							{title}
						</Heading>
						<p className="text--truncate cardDescription">{description}</p>
					</div>
				</ExaShape>
			</Link>
		</ExaGrow>
	)
}
