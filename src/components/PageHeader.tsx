import type { ReactNode } from 'react';
import { Title } from '@mantine/core';

type PageHeaderProps = {
	title: ReactNode;
	left?: ReactNode;
	right?: ReactNode;
};

/** Wide header: centered title with left/right slots. Narrow: title + controls share a row, or stack when both slots are used. */
export function PageHeader({ title, left, right }: PageHeaderProps) {
	return (
		<div className='field-page-header'>
			<div className='field-page-header-slot field-page-header-left'>
				{left}
			</div>
			<Title
				order={1}
				fz={{ base: 'h3', sm: 'h2' }}
				className='field-page-header-title'
			>
				{title}
			</Title>
			<div className='field-page-header-slot field-page-header-right'>
				{right}
			</div>
		</div>
	);
}
