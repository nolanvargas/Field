import { Group } from '@mantine/core';
import { BrandLogo } from './BrandLogo';
import { orgLogoSrc } from '../orgLogoSrc';

type ShellBrandRowProps = {
	orgLogoUrl?: string | null;
	/** White backdrop for logos on dark nav backgrounds. */
	highContrast?: boolean;
	fieldSize?: number;
	orgMaxHeight?: number;
};

/** Desktop sidebar: Field mark always, org logo to the right when set. */
export function ShellBrandRow({
	orgLogoUrl,
	highContrast = false,
	fieldSize = 40,
	orgMaxHeight = 40,
}: ShellBrandRowProps) {
	const src = orgLogoSrc(orgLogoUrl);
	return (
		<Group
			gap='sm'
			align='center'
			wrap='nowrap'
			style={highContrast ? { background: '#fff', borderRadius: '8px' } : undefined}
		>
			<BrandLogo size={fieldSize} />
			{src ? (
				<img
					src={src}
					alt=''
					draggable={false}
					style={{
						display: 'block',
						maxHeight: orgMaxHeight,
						maxWidth: 120,
						width: 'auto',
						height: 'auto',
						objectFit: 'contain',
					}}
				/>
			) : null}
		</Group>
	);
}
