import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Title } from '@mantine/core';
import {
	PAGE_HEADER_TITLE_MIN_VIEWPORT_PX,
	pageHeaderTitleFits,
	pageHeaderTitleLayout,
} from '../pageHeaderTitleFits';

type PageHeaderProps = {
	title: ReactNode;
	left?: ReactNode;
	right?: ReactNode;
};

function slotContentWidth(el: HTMLElement | null): number {
	if (!el || getComputedStyle(el).display === 'none') return 0;
	return el.scrollWidth;
}

/** Wide header: title centered on full width unless both left and right slots are used (then centered between them). Narrow: title + controls share a row, or stack when both slots are used. Title is omitted below 1200px and whenever the full word cannot fit. */
export function PageHeader({ title, left, right }: PageHeaderProps) {
	const headerRef = useRef<HTMLDivElement>(null);
	const leftRef = useRef<HTMLDivElement>(null);
	const rightRef = useRef<HTMLDivElement>(null);
	const probeRef = useRef<HTMLSpanElement>(null);
	const [titleFits, setTitleFits] = useState(false);

	useLayoutEffect(() => {
		const header = headerRef.current;
		const probe = probeRef.current;
		if (!header || !probe) return;

		const update = () => {
			const rem =
				parseFloat(getComputedStyle(document.documentElement).fontSize) ||
				16;
			const gap = parseFloat(getComputedStyle(header).gap) || 0;
			const leftWidth = slotContentWidth(leftRef.current);
			const rightWidth = slotContentWidth(rightRef.current);
			const layout = pageHeaderTitleLayout({
				headerWidth: header.clientWidth,
				rem,
				hasLeft: leftWidth > 0,
				hasRight: rightWidth > 0,
			});
			const titlePad =
				layout === 'overlay' || layout === 'split' ? gap * 2 : 0;
			setTitleFits(
				pageHeaderTitleFits({
					headerWidth: header.clientWidth,
					titleWidth: probe.scrollWidth + titlePad,
					leftWidth,
					rightWidth,
					gap,
					layout,
					viewportWidth: window.innerWidth,
				}),
			);
		};

		update();
		const ro = new ResizeObserver(update);
		ro.observe(header);
		ro.observe(probe);
		if (leftRef.current) ro.observe(leftRef.current);
		if (rightRef.current) ro.observe(rightRef.current);
		const mq = window.matchMedia(
			`(min-width: ${PAGE_HEADER_TITLE_MIN_VIEWPORT_PX}px)`,
		);
		mq.addEventListener('change', update);
		void document.fonts?.ready.then(update);
		return () => {
			ro.disconnect();
			mq.removeEventListener('change', update);
		};
	}, [title]);

	return (
		<div
			ref={headerRef}
			className={[
				'field-page-header',
				titleFits ? '' : 'field-page-header--title-hidden',
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div
				ref={leftRef}
				className='field-page-header-slot field-page-header-left'
			>
				{left}
			</div>
			<span
				ref={probeRef}
				className='field-page-header-title-probe'
				aria-hidden='true'
			>
				{title}
			</span>
			{titleFits ? (
				<Title
					order={1}
					fz={{ base: 'h3', sm: 'h2' }}
					className='field-page-header-title'
				>
					{title}
				</Title>
			) : null}
			<div
				ref={rightRef}
				className='field-page-header-slot field-page-header-right'
			>
				{right}
			</div>
		</div>
	);
}
