import { Anchor, Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';

type DevTestingOverviewSectionProps = {
	vitestCount: number | null;
	integrationCount: number | null;
	e2eCount: number | null;
};

const LAYERS = [
	{
		name: 'Unit',
		command: 'npm test',
		note: 'Vitest — shared/, server/ mocks, fast logic',
	},
	{
		name: 'Component (RTL)',
		command: 'npm test',
		note: 'tests/*.test.tsx with Testing Library',
	},
	{
		name: 'Integration',
		command: 'npm run test:integration',
		note: 'Real Postgres + HTTP API routes',
	},
	{
		name: 'E2E smoke',
		command: 'npm run test:e2e',
		note: 'Playwright — stub auth, API, Vite proxy',
	},
	{
		name: 'Manual',
		command: 'See Manual QA below',
		note: 'Domains A–V — mobile, SSO, visual PDF/email',
	},
];

export function DevTestingOverviewSection({
	vitestCount,
	integrationCount,
	e2eCount,
}: DevTestingOverviewSectionProps) {
	return (
		<Stack gap='md'>
			<Text size='sm' c='dimmed' maw={560}>
				Five automated layers plus manual domains. CI on every PR: lint → unit
				(with coverage thresholds) → integration → E2E → build. Source of
				truth for depth:{' '}
				<Anchor href='#testing-strategy'>testing-strategy.md</Anchor> (embedded
				below).
			</Text>

			<SimpleGrid cols={{ base: 1, sm: 3 }} spacing='sm'>
				<Card padding='sm' withBorder>
					<Text size='xs' c='dimmed'>Vitest cases</Text>
					<Title order={3}>{vitestCount ?? '…'}</Title>
				</Card>
				<Card padding='sm' withBorder>
					<Text size='xs' c='dimmed'>Integration specs</Text>
					<Title order={3}>{integrationCount ?? '…'}</Title>
				</Card>
				<Card padding='sm' withBorder>
					<Text size='xs' c='dimmed'>E2E specs</Text>
					<Title order={3}>{e2eCount ?? '…'}</Title>
				</Card>
			</SimpleGrid>

			<div className='dev-testing-layer-cards'>
				{LAYERS.map((layer) => (
					<Card key={layer.name} padding='sm' withBorder>
						<Text fw={600} size='sm'>{layer.name}</Text>
						<Text size='xs' c='dimmed' mb={4}>
							<code>{layer.command}</code>
						</Text>
						<Text size='sm'>{layer.note}</Text>
					</Card>
				))}
			</div>

			<Text size='sm' maw={560}>
				PR checklist: run <code>npm test</code> and name a manual domain when
				RTL/E2E cannot cover the change (
				<code>.github/pull_request_template.md</code>).
			</Text>
		</Stack>
	);
}
