import React, { useState, useRef, useEffect, cloneElement, useId } from 'react'

interface ExaShapeProps {
	accentColor?: string
	accentLineWidth?: number
	autoWidth?: boolean
	blur?: boolean
	children?: React.ReactElement
	clip?: boolean
	defaultHeight?: number
	defaultWidth?: number
	highlight?: boolean
	innerBorderWidth?: number
	innerColor?: string
	outerColor?: string
	slope?: number
	style?: React.CSSProperties
}

export const ExaShape = (props: ExaShapeProps) => {
	let {
		accentColor = '#489178',
		accentLineWidth = 0,
		autoWidth = true,
		blur = true,
		children,
		clip = false,
		defaultHeight = 48,
		defaultWidth = 100,
		highlight = true,
		innerBorderWidth = 1,
		innerColor = 'var(--card-background-color)',
		outerColor = 'var(--ifm-color-emphasis-200)',
		slope = 24,
		style
	} = props
	const clipPathId = useId()

	const [dimensions, setDimensions] = useState({
		width: defaultWidth,
		height: defaultHeight
	})
	const { width, height } = dimensions
	const containerRef = useRef<HTMLDivElement>(null)

	// Listen for hover events on containerRef
	const [isHovering, setHovering] = useState(false)

	useEffect(() => {
		const node = containerRef.current
		if (node) {
			const handleMouseEnter = () => setHovering(true)
			const handleMouseLeave = () => setHovering(false)
			node.addEventListener('mouseenter', handleMouseEnter)
			node.addEventListener('mouseleave', handleMouseLeave)
			return () => {
				node.removeEventListener('mouseenter', handleMouseEnter)
				node.removeEventListener('mouseleave', handleMouseLeave)
			}
		}
	}, [containerRef])

	// Highlight the shape when hovering
	const currentOuterColor = isHovering && highlight ? 'var(--ifm-color-primary)' : outerColor

	const horizontalTopEdgeD = `M ${slope + accentLineWidth / 4},0 L ${width},0`
	const slopedTopEdgeD = `M 0,${slope + accentLineWidth / 2} L ${slope + accentLineWidth / 2},0`

	// Use a single path for both border and inner fill
	const innerD = `
    M ${innerBorderWidth},${slope + innerBorderWidth}
    L ${slope + innerBorderWidth},${innerBorderWidth}
    L ${width - slope - innerBorderWidth},${innerBorderWidth}
    L ${width - innerBorderWidth},${innerBorderWidth}
    L ${width - innerBorderWidth},${height - slope - innerBorderWidth}
    L ${width - slope - innerBorderWidth},${height - innerBorderWidth}
    L ${slope + innerBorderWidth},${height - innerBorderWidth}
    L ${innerBorderWidth},${height - innerBorderWidth}
    Z
  `

	useEffect(() => {
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const rect = entry.target.getBoundingClientRect()
				const width = rect.width
				const height = rect.height
				setDimensions({ width, height })
			}
		})
		if (containerRef.current) {
			observer.observe(containerRef.current)
		}
		return () => {
			if (containerRef.current) {
				observer.unobserve(containerRef.current)
			}
		}
	}, [])

	return (
		<>
			<svg
				width={width}
				height={height}
				style={{
					width,
					height,
					position: 'absolute',
					top: 0,
					bottom: 0,
					zIndex: -1,
					backdropFilter: blur ? 'blur(8px)' : undefined,
					WebkitBackdropFilter: blur ? 'blur(8px)' : undefined
				}}
				xmlns="http://www.w3.org/2000/svg"
			>
				{clip && (
					<defs>
						<clipPath id={clipPathId}>
							<path d={innerD} />
						</clipPath>
					</defs>
				)}
				<path
					d={innerD}
					fill={innerColor}
					fillOpacity={0.54}
					stroke={currentOuterColor}
					strokeWidth={innerBorderWidth}
					strokeOpacity={0.69}
				/>
				{accentLineWidth > 0 && (
					<>
						<path d={horizontalTopEdgeD} stroke={accentColor} strokeWidth={accentLineWidth} fill="none" />
						<path d={slopedTopEdgeD} stroke={accentColor} strokeWidth={accentLineWidth / 2} fill="none" />
					</>
				)}
			</svg>
			{children && clip ? (
				<div
					ref={containerRef}
					style={{
						width: `100%`,
						height: `100%`,
						clipPath: `url(#${clipPathId})`
					}}
				>
					{cloneElement(children, {
						ref: containerRef
					})}
				</div>
			) : (
				children &&
				cloneElement(children, {
					ref: containerRef
				})
			)}
		</>
	)
}
