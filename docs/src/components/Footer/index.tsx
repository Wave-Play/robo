import React from 'react'
import './styles.css'

const Footer = (props) => {
	return (
		<footer className={`footer ${props.className || ''}`} style={props.style || {}}>
			<img src="/img/logo.png" alt="Robo.js Logo" width={55} height={55} />
			<p>
				MIT © {new Date().getFullYear()} <strong>Robo.js</strong> By <strong className='waveplay'>WavePlay</strong>
			</p>
			<p>
				<strong>
					<a href="https://www.youtube.com/@MrJAwesomeYT">MrJAwesome</a>
				</strong>{' '}
				|{' '}
				<strong>
					<a href="/templates/discord-bots/mrjawesome-dev-toolkit-js">Dev Toolkit</a>
				</strong>{' '}
				|{' '}
				<strong>
					<a href="/templates/discord-bots/mrjawesome-slash-commands-js">Slash Command Packages</a>
				</strong>
			</p>
		</footer>
	)
}

export default Footer
