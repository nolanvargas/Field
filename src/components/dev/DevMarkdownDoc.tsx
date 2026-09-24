import { useMemo, type ReactNode } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
	buildDevTestFileHref,
	type DevTestLinksConfig,
} from '../../devTestsFileLink';
import { MARKDOWN_DOC_HREF_TO_SECTION } from '../../pages/dev/testing/testingHubSections';

type DevMarkdownDocProps = {
	source: string;
	links?: DevTestLinksConfig;
};

function normalizeHref(href: string): string {
	try {
		const url = new URL(href, 'http://local');
		return url.pathname.replace(/^\//, '');
	} catch {
		return href;
	}
}

function resolveMarkdownHref(
	href: string,
	links?: DevTestLinksConfig,
): string {
	if (href.startsWith('#')) return href;

	const bare = href.split('#')[0];
	const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
	const normalized = normalizeHref(bare);
	const fileName = normalized.split('/').pop() ?? normalized;

	const section = MARKDOWN_DOC_HREF_TO_SECTION[fileName];
	if (section) {
		return `#${section}${hash === '#' ? '' : hash}`;
	}

	if (
		normalized.startsWith('docs/') ||
		normalized.includes('.md') ||
		normalized.startsWith('.github/')
	) {
		const docPath = normalized.startsWith('docs/')
			? normalized
			: normalized.startsWith('.github/')
				? normalized
				: `docs/${normalized}`;
		const ide = buildDevTestFileHref(links, docPath, 1);
		if (ide) return ide;
	}

	if (href.startsWith('http://') || href.startsWith('https://')) {
		return href;
	}

	return href;
}

export function DevMarkdownDoc({ source, links }: DevMarkdownDocProps) {
	const components = useMemo(
		() => ({
			a: ({
				href,
				children,
			}: {
				href?: string;
				children?: ReactNode;
			}) => {
				if (!href) return <>{children}</>;
				const resolved = resolveMarkdownHref(href, links);
				const external =
					resolved.startsWith('http') || resolved.startsWith('vscode://');
				return (
					<a
						href={resolved}
						target={external ? '_blank' : undefined}
						rel={external ? 'noreferrer' : undefined}
					>
						{children}
					</a>
				);
			},
			code: ({
				className,
				children,
			}: {
				className?: string;
				children?: ReactNode;
			}) => {
				const text = String(children ?? '').replace(/\n$/, '');
				const isMermaid =
					className?.includes('language-mermaid') ||
					(className == null && text.startsWith('flowchart'));
				if (isMermaid) {
					return (
						<pre className='dev-markdown-mermaid'>
							<code>{text}</code>
						</pre>
					);
				}
				return <code className={className}>{children}</code>;
			},
		}),
		[links],
	);

	return (
		<div className='dev-markdown-doc'>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{source}
			</ReactMarkdown>
		</div>
	);
}
