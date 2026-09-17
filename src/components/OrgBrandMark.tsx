import type { CSSProperties } from 'react';
import { BrandLogo } from './BrandLogo';
import { orgLogoSrc } from '../orgLogoSrc';

type OrgBrandMarkProps = {
	orgLogoUrl?: string | null;
	/** Square Field mark size when falling back. */
	size?: number;
	/** Max height for org logo image. */
	maxHeight?: number;
	/** Max width for org logo image. */
	maxWidth?: number;
	alt?: string;
	className?: string;
	style?: CSSProperties;
};

/** Org logo when set; otherwise the Field product mark. */
export function OrgBrandMark({
	orgLogoUrl,
	size = 40,
	maxHeight,
	maxWidth = 240,
	alt = 'Field',
	className,
	style,
}: OrgBrandMarkProps) {
	const src = orgLogoSrc(orgLogoUrl);
	if (!src) {
		return <BrandLogo size={size} className={className} />;
	}

	const height = maxHeight ?? size;
	return (
		<img
			src={src}
			alt={alt}
			draggable={false}
			className={className}
			style={{
				display: 'block',
				maxHeight: height,
				maxWidth,
				width: 'auto',
				height: 'auto',
				objectFit: 'contain',
				...style,
			}}
		/>
	);
}
