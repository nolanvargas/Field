import { useEffect, useState } from 'react';

import { Alert, Loader, Stack, Text, Title } from '@mantine/core';

import { fetchTestingInventory } from '../../../api/devTestingInventory';
import {
	buildDevTestFileHref,
	type DevTestLinksConfig,
} from '../../../devTestsFileLink';

function FileList({
	title,
	files,
	links,
	blurb,
}: {
	title: string;
	files: { path: string }[];
	links?: DevTestLinksConfig;
	blurb: string;
}) {
	return (
		<Stack gap='xs'>
			<Title order={5}>{title}</Title>
			<Text size='sm' c='dimmed'>{blurb}</Text>
			<ul className='dev-testing-inventory-list'>
				{files.map((file) => {
					const href = buildDevTestFileHref(links, file.path, null);
					return (
						<li key={file.path}>
							{href ? (
								<a href={href} className='dev-tests-file-link'>
									{file.path}
								</a>
							) : (
								<code>{file.path}</code>
							)}
						</li>
					);
				})}
			</ul>
		</Stack>
	);
}

export function DevTestingInventorySection({
	onCountsChange,
}: {
	onCountsChange?: (integration: number, e2e: number) => void;
}) {
	const [integration, setIntegration] = useState<{ path: string }[]>([]);
	const [e2e, setE2e] = useState<{ path: string }[]>([]);
	const [links, setLinks] = useState<DevTestLinksConfig | undefined>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		void fetchTestingInventory(controller.signal)
			.then((data) => {
				if (controller.signal.aborted) return;
				setIntegration(data.integration);
				setE2e(data.e2e);
				setLinks(data.links);
				onCountsChange?.(data.integration.length, data.e2e.length);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(
					err instanceof Error ? err.message : 'Failed to load inventory',
				);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [onCountsChange]);

	if (loading) {
		return (
			<Stack align='center' py='md'>
				<Loader size='sm' />
			</Stack>
		);
	}

	if (error) {
		return (
			<Alert color='red' title='Could not load inventory'>
				{error}
			</Alert>
		);
	}

	return (
		<Stack gap='lg'>
			<FileList
				title='Integration'
				files={integration}
				links={links}
				blurb='Run: npm run test:integration (FIELD_API_REQUIRE_AUTH=1, Docker Postgres).'
			/>
			<FileList
				title='E2E'
				files={e2e}
				links={links}
				blurb='Run: npm run test:e2e or npm run test:e2e:ui. See docs/AGENTS/e2e-stub-auth.md for auth mode.'
			/>
		</Stack>
	);
}
