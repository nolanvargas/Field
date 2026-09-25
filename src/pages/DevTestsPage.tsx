import { useCallback, useEffect, useState } from 'react';

import { Navigate } from 'react-router-dom';

import { Box, Select, Text, Title } from '@mantine/core';

import { useMediaQuery } from '@mantine/hooks';

import { listDevTests } from '../api/devTests';
import type { DevTestLinksConfig } from '../devTestsFileLink';
import { PageHeader } from '../components/PageHeader';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';

import testingStrategyMd from '../../docs/testing-strategy.md?raw';
import manualTestOverviewMd from '../../docs/manual-test-overview.md?raw';
import pilotUatScriptMd from '../../docs/pilot-uat-script.md?raw';

import { DevTestingInventorySection } from './dev/testing/DevTestingInventorySection';
import { DevTestingMarkdownSection } from './dev/testing/DevTestingMarkdownSection';
import { DevTestingOverviewSection } from './dev/testing/DevTestingOverviewSection';
import { DevTestingRunSection } from './dev/testing/DevTestingRunSection';
import { DevVitestCatalogSection } from './dev/testing/DevVitestCatalogSection';
import {
	TESTING_HUB_SECTIONS,
	type TestingHubSectionId,
} from './dev/testing/testingHubSections';

function scrollToSection(id: TestingHubSectionId) {
	document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export function DevTestsPage() {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const [activeSection, setActiveSection] =
		useState<TestingHubSectionId>('overview');
	const [vitestCount, setVitestCount] = useState<number | null>(null);
	const [integrationCount, setIntegrationCount] = useState<number | null>(null);
	const [e2eCount, setE2eCount] = useState<number | null>(null);
	const [links, setLinks] = useState<DevTestLinksConfig | undefined>();

	useEffect(() => {
		const controller = new AbortController();
		void listDevTests({ signal: controller.signal })
			.then((catalog) => {
				if (!controller.signal.aborted) {
					setVitestCount(catalog.tests.length);
					setLinks(catalog.links);
				}
			})
			.catch(() => {
				// catalog section shows its own errors
			});
		return () => controller.abort();
	}, []);

	const onInventoryCounts = useCallback((integration: number, e2e: number) => {
		setIntegrationCount(integration);
		setE2eCount(e2e);
	}, []);

	const onVitestCount = useCallback((count: number) => {
		setVitestCount(count);
	}, []);

	if (!import.meta.env.DEV) {
		return <Navigate to='/' replace />;
	}

	const navSelectData = TESTING_HUB_SECTIONS.map((section) => ({
		value: section.id,
		label: section.label,
	}));

	return (
		<Box className='tasks-page'>
			<PageHeader title='Testing' />

			<Text size='sm' c='dimmed' mb='md' maw={560}>
				Dev-only hub for automated layers, runners, catalogs, and manual QA
				docs. Edit markdown under <code>docs/</code> and refresh Vite to update
				embedded sections.
			</Text>

			<div className='dev-testing-hub'>
				{isMobile ? (
					<Select
						className='dev-testing-hub-nav-select'
						label='Section'
						data={navSelectData}
						value={activeSection}
						onChange={(value) => {
							if (!value) return;
							const id = value as TestingHubSectionId;
							setActiveSection(id);
							scrollToSection(id);
						}}
						mb='sm'
					/>
				) : (
					<nav
						className='dev-testing-hub-nav'
						aria-label='Testing hub sections'
					>
						{TESTING_HUB_SECTIONS.map((section) => (
							<button
								key={section.id}
								type='button'
								className='dev-testing-hub-nav-button'
								data-active={
									activeSection === section.id ? true : undefined
								}
								onClick={() => {
									setActiveSection(section.id);
									scrollToSection(section.id);
								}}
							>
								{section.label}
							</button>
						))}
					</nav>
				)}

				<div className='dev-testing-hub-content'>
					<section
						id='overview'
						className='dev-testing-hub-section'
						aria-labelledby='testing-overview-title'
					>
						<Title
							id='testing-overview-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Overview
						</Title>
						<DevTestingOverviewSection
							vitestCount={vitestCount}
							integrationCount={integrationCount}
							e2eCount={e2eCount}
						/>
					</section>

					<section
						id='run'
						className='dev-testing-hub-section'
						aria-labelledby='testing-run-title'
					>
						<Title
							id='testing-run-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Run automated tests
						</Title>
						<DevTestingRunSection />
					</section>

					<section
						id='vitest-catalog'
						className='dev-testing-hub-section'
						aria-labelledby='testing-vitest-title'
					>
						<Title
							id='testing-vitest-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Vitest catalog
						</Title>
						<Text size='sm' c='dimmed' mb='sm'>
							All unit and RTL cases (Vitest list — does not run tests).
						</Text>
						<DevVitestCatalogSection onCountsChange={onVitestCount} />
					</section>

					<section
						id='integration-e2e'
						className='dev-testing-hub-section'
						aria-labelledby='testing-inventory-title'
					>
						<Title
							id='testing-inventory-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Integration &amp; E2E
						</Title>
						<DevTestingInventorySection onCountsChange={onInventoryCounts} />
					</section>

					<section
						id='testing-strategy'
						className='dev-testing-hub-section'
						aria-labelledby='testing-strategy-title'
					>
						<Title
							id='testing-strategy-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Testing strategy
						</Title>
						<DevTestingMarkdownSection
							source={testingStrategyMd}
							links={links}
						/>
					</section>

					<section
						id='manual-qa'
						className='dev-testing-hub-section'
						aria-labelledby='testing-manual-title'
					>
						<Title
							id='testing-manual-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Manual QA
						</Title>
						<DevTestingMarkdownSection
							source={manualTestOverviewMd}
							links={links}
						/>
					</section>

					<section
						id='pilot-uat'
						className='dev-testing-hub-section'
						aria-labelledby='testing-pilot-title'
					>
						<Title
							id='testing-pilot-title'
							order={4}
							className='dev-testing-hub-section-title'
						>
							Pilot UAT
						</Title>
						<Text size='sm' c='dimmed' mb='sm'>
							Automated helper:{' '}
							<code>node scripts/run-pilot-uat.mjs &lt;externalKey&gt;</code>
						</Text>
						<DevTestingMarkdownSection
							source={pilotUatScriptMd}
							links={links}
						/>
					</section>
				</div>
			</div>
		</Box>
	);
}
