import type { LiveBus } from '@/types/transit';
import { occupancyInfo } from '@/components/transit/OccupancyMeter';
import { readableOn } from '@/lib/color';

/** Small DOM builder: popups are built with textContent, never innerHTML, since data comes from upstream APIs. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string, style?: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    if (style) Object.assign(el.style, style);
    return el;
}

function badge(code: string, color: string) {
    return h('span', 'font-signage inline-flex items-center justify-center h-6 min-w-9 px-1.5 rounded-md text-14 font-bold leading-none', code, {
        backgroundColor: color,
        color: readableOn(color),
    });
}

/** The bus marker element: route-colored disc, heading arrow, occupancy dot. */
export function createBusElement(color: string) {
    const root = h('div', 'bus-marker');
    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');

    const arrow = h('div', 'bus-marker__arrow');
    const tip = h('div', '', undefined, {
        position: 'absolute',
        left: '50%',
        top: '-5px',
        transform: 'translateX(-50%)',
        width: '0',
        height: '0',
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderBottom: '7px solid #ffffff',
        filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))',
    });
    arrow.appendChild(tip);

    const body = h('div', 'bus-marker__body', undefined, { backgroundColor: color, color: readableOn(color) });
    // Bus glyph (lucide "bus-front"), drawn inline so markers don't need React
    body.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/></svg>';

    const occ = h('div', 'bus-marker__occ');

    root.append(arrow, body, occ);
    return { root, arrow, body, occ };
}

export function paintBusElement(parts: ReturnType<typeof createBusElement>, bus: LiveBus, color: string, routeCode: string) {
    parts.arrow.style.transform = `rotate(${bus.bearing}deg)`;
    parts.body.style.backgroundColor = color;
    parts.body.style.color = readableOn(color);
    const occ = occupancyInfo(bus.occupancy);
    parts.occ.style.display = occ.bars > 0 ? 'block' : 'none';
    parts.occ.style.backgroundColor = occ.color;
    parts.root.setAttribute('aria-label', `Bus ${bus.label} de la ruta ${routeCode}, ${occ.label}`);
}

export function busPopupContent(bus: LiveBus, color: string, routeCode: string) {
    const wrap = h('div', 'p-3 min-w-[190px] font-sans');
    const top = h('div', 'flex items-center gap-2 mb-1.5');
    top.append(badge(routeCode, color), h('span', 'font-signage text-17 font-bold', bus.label || 'Bus'));
    wrap.appendChild(top);
    if (bus.destination) wrap.appendChild(h('p', 'text-13 font-medium', `Hacia ${bus.destination}`));
    const occ = occupancyInfo(bus.occupancy);
    const occRow = h('p', 'flex items-center gap-1.5 text-12 text-muted-foreground mt-1');
    occRow.append(h('span', 'inline-block w-2 h-2 rounded-full', undefined, { backgroundColor: occ.color }), document.createTextNode(occ.label));
    wrap.appendChild(occRow);
    if (bus.accessibility) wrap.appendChild(h('p', 'text-12 text-muted-foreground', bus.accessibility.charAt(0) + bus.accessibility.slice(1).toLowerCase()));
    if (bus.lastSeen) wrap.appendChild(h('p', 'text-11 text-muted-foreground mt-1', `Reportado a las ${bus.lastSeen.toLowerCase()}`));
    return wrap;
}

export function stopPopupContent(name: string, sub: string, routeCode?: string, color?: string) {
    const wrap = h('div', 'p-3 min-w-[170px] font-sans');
    if (routeCode && color) {
        const top = h('div', 'mb-1.5');
        top.appendChild(badge(routeCode, color));
        wrap.appendChild(top);
    }
    wrap.appendChild(h('p', 'font-signage text-17 font-bold leading-tight', name));
    if (sub) wrap.appendChild(h('p', 'text-12 text-muted-foreground mt-0.5', sub));
    return wrap;
}

export function tooltipContent(text: string) {
    return h('div', 'px-2.5 py-1.5 rounded-lg bg-black/85 text-white text-12 font-semibold whitespace-nowrap', text);
}

export function pointPopupContent(p: { n?: string; a?: string; l?: string; wk?: string; sat?: string; hol?: string }, kindLabel: string) {
    const wrap = h('div', 'p-3 min-w-[200px] max-w-[240px] font-sans');
    wrap.appendChild(h('p', 'text-11 text-muted-foreground', kindLabel));
    wrap.appendChild(h('p', 'font-signage text-17 font-bold leading-tight mt-0.5', (p.n || 'Punto').trim()));
    if (p.a) wrap.appendChild(h('p', 'text-12 mt-0.5', p.a));
    if (p.l) wrap.appendChild(h('p', 'text-12 text-muted-foreground', p.l));
    const rows: [string, string | undefined][] = [['Entre semana', p.wk], ['Sábados', p.sat], ['Domingos y festivos', p.hol]];
    const list = h('div', 'mt-2 space-y-0.5');
    for (const [label, value] of rows) {
        if (!value) continue;
        const row = h('p', 'flex justify-between gap-3 text-12');
        row.append(h('span', 'text-muted-foreground', label), h('span', 'tabular font-medium', value));
        list.appendChild(row);
    }
    if (list.childElementCount) wrap.appendChild(list);
    return wrap;
}

export function userDotElement() {
    const el = h('div', '', undefined, { width: '22px', height: '22px', position: 'relative' });
    el.setAttribute('aria-label', 'Tu ubicación');
    const halo = h('div', 'animate-ping', undefined, {
        position: 'absolute', inset: '0', borderRadius: '9999px', background: 'rgba(59,130,246,0.35)',
    });
    const dot = h('div', '', undefined, {
        position: 'absolute', inset: '4px', borderRadius: '9999px', background: '#3b82f6', border: '3px solid #ffffff',
        boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
    });
    el.append(halo, dot);
    return el;
}
