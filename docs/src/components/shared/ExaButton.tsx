import React from 'react'
import Link from '@docusaurus/Link'
import { ExaShape } from './ExaShape'
import { ExaGrow } from './ExaGrow'

interface ExaButtonProps {
	autoWidth?: boolean
	borderColor?: string
	children?: React.ReactNode
	defaultHeight?: number
	defaultWidth?: number
	disabled?: boolean
	href: string
	style?: React.CSSProperties
}

export const ExaButton = (props: ExaButtonProps) => {
	const { autoWidth, borderColor = '#FFD600', children, defaultHeight, defaultWidth, disabled, href, style } = props

	return (
		<ExaGrow>
			<Link style={{ position: 'relative', textDecoration: 'none', ...style }} to={href}>
				<ExaShape
					accentLineWidth={0}
					autoWidth={autoWidth}
					defaultHeight={defaultHeight}
					defaultWidth={defaultWidth}
					highlight={false}
					innerBorderWidth={2}
					innerColor={'#F0B90B'}
					outerColor={borderColor}
					slope={12}
				>
					<div className="exaButtonContainer">
						<p className="exaButtonText">{children}</p>
					</div>
				</ExaShape>
			</Link>
		</ExaGrow>
	)
}
