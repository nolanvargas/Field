import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, Text, Title } from '@mantine/core';
import { PageHeader } from '../components/PageHeader';
import {
	DEVELOPMENT_BASE_PATH,
	DEVELOPMENT_SECTIONS,
	developmentSectionPath,
} from '../developmentSections';

function DevelopmentHome() {
	return (
		<Box maw={560}>
			<Title order={4} mb='xs'>
				Local development tools
			</Title>
			<Text size='sm' c='dimmed'>
				These pages are available only when running the Vite dev server. Pick a
				section from the sidebar to browse tests, run npm scripts, or prototype
				settings UI.
			</Text>
		</Box>
	);
}

export function DevelopmentPage() {
	const location = useLocation();

	if (!import.meta.env.DEV) {
		return <Navigate to='/' replace />;
	}

	const isIndex =
		location.pathname === DEVELOPMENT_BASE_PATH ||
		location.pathname === `${DEVELOPMENT_BASE_PATH}/`;

	return (
		<div className='field-management-page'>
			<PageHeader title='Development' />

			<div className='field-management-body'>
				<nav className='field-management-nav' aria-label='Development sections'>
					{DEVELOPMENT_SECTIONS.map((section) => {
						const to = developmentSectionPath(section.path);
						const active = location.pathname === to;
						return (
							<Link
								key={section.id}
								to={to}
								className='field-management-nav-btn'
								data-active={active || undefined}
								aria-current={active ? 'page' : undefined}
							>
								{section.label}
							</Link>
						);
					})}
				</nav>

				<div className='field-management-divider' aria-hidden='true' />

				<div className='field-management-content'>
					{isIndex ? <DevelopmentHome /> : <Outlet />}
				</div>
			</div>
		</div>
	);
}
