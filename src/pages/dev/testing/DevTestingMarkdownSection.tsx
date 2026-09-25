import { DevMarkdownDoc } from '../../../components/dev/DevMarkdownDoc';
import type { DevTestLinksConfig } from '../../../devTestsFileLink';

type DevTestingMarkdownSectionProps = {
	source: string;
	links?: DevTestLinksConfig;
};

export function DevTestingMarkdownSection({
	source,
	links,
}: DevTestingMarkdownSectionProps) {
	return <DevMarkdownDoc source={source} links={links} />;
}
