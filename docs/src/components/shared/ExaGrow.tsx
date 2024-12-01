import React, { CSSProperties, useState } from 'react'

interface GrowOnHoverProps {
	children: React.ReactNode
	className?: string
	scale?: number
	style?: React.CSSProperties
}

export const ExaGrow = (props: GrowOnHoverProps) => {
	const { children, className, scale = 1.1, style } = props
	const [isHovered, setIsHovered] = useState(false)

	const combinedStyle: CSSProperties = {
		display: 'flex',
		transition: 'transform 0.3s',
		transform: isHovered ? `scale(${scale})` : 'scale(1)',
		...style
	}

	return (
		<div
			className={className}
			style={combinedStyle}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{children}
		</div>
	)
}
