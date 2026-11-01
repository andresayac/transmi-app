import { Fragment, ReactNode } from 'react';

/** Inline: **bold** only. Everything renders as React text nodes (no HTML injection). */
function inline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = re.exec(text))) {
        if (match.index > last) out.push(<Fragment key={i++}>{text.slice(last, match.index)}</Fragment>);
        out.push(<strong key={i++} className="font-semibold text-foreground">{match[1]}</strong>);
        last = match.index + match[0].length;
    }
    if (last < text.length) out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
    return out;
}

type Block = { type: 'p'; lines: string[] } | { type: 'ul' | 'ol'; items: string[] };

function parse(text: string): Block[] {
    const blocks: Block[] = [];
    for (const raw of text.replace(/\r/g, '').split('\n')) {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        const last = blocks[blocks.length - 1];
        if (bullet || numbered) {
            const type = bullet ? 'ul' : 'ol';
            const item = (bullet || numbered)![1];
            if (last && last.type === type) last.items.push(item);
            else blocks.push({ type, items: [item] });
        } else if (!line.trim()) {
            blocks.push({ type: 'p', lines: [] });
        } else if (last?.type === 'p') {
            last.lines.push(line.replace(/^#+\s*/, ''));
        } else {
            blocks.push({ type: 'p', lines: [line.replace(/^#+\s*/, '')] });
        }
    }
    return blocks.filter((b) => (b.type === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

/** Tiny, safe markdown for assistant replies: paragraphs, line breaks, bold, bullet and numbered lists. */
export default function Markdown({ text, className }: { text: string; className?: string }) {
    const blocks = parse(text);
    return (
        <div className={className}>
            {blocks.map((b, i) => {
                if (b.type === 'p') {
                    return (
                        <p key={i} className="[&:not(:first-child)]:mt-2.5">
                            {b.lines.map((l, j) => (
                                <Fragment key={j}>
                                    {j > 0 && <br />}
                                    {inline(l)}
                                </Fragment>
                            ))}
                        </p>
                    );
                }
                const List = b.type === 'ul' ? 'ul' : 'ol';
                return (
                    <List key={i} className={`${b.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1 [&:not(:first-child)]:mt-2.5 marker:text-muted-foreground`}>
                        {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
                    </List>
                );
            })}
        </div>
    );
}
