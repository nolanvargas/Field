/** Equal-width bars, 84 on both right corners (approved hamburger end-state). */
const HAMBURGER_MARK_D =
	'M84 0 H476 A84 84 0 0 1 560 84 V84 A84 84 0 0 1 476 168 H12 A12 12 0 0 1 0 156 V84 A84 84 0 0 1 84 0 Z M12 224 H476 A84 84 0 0 1 560 308 V308 A84 84 0 0 1 476 392 H12 A12 12 0 0 1 0 380 V236 A12 12 0 0 1 12 224 Z M12 448 H476 A84 84 0 0 1 560 532 V532 A84 84 0 0 1 476 616 H84 A84 84 0 0 1 0 532 V460 A12 12 0 0 1 12 448 Z';

type CompactNavFieldMenuMarkProps = {
	gradientId?: string;
};

export function CompactNavFieldMenuMark({
	gradientId = 'field-compact-nav-brand-gradient',
}: CompactNavFieldMenuMarkProps) {
	return (
		<svg
			className='field-compact-nav-menu-svg'
			width={40}
			height={40}
			viewBox='0 0 1024 1024'
			aria-hidden
		>
			<defs>
				<linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
					<stop offset='0' stopColor='#E31D2D' />
					<stop offset='0.45' stopColor='#BC4F9E' />
					<stop offset='1' stopColor='#702F8B' />
				</linearGradient>
			</defs>
			<rect x='64' y='64' width='896' height='896' rx='184' fill='#ffffff' />
			<g transform='translate(232 176)'>
				<path
					className='field-compact-nav-menu-mark'
					fill={`url(#${gradientId})`}
					d={HAMBURGER_MARK_D}
				/>
			</g>
		</svg>
	);
}
