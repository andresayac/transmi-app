'use client';

import { useSyncExternalStore } from 'react';

/**
 * Computer layout from 64rem (Tailwind's `lg`): navigation rail on the left,
 * side panels next to the map instead of bottom sheets. In rem, so a large
 * text size keeps the phone layout on smaller screens.
 */
export const DESKTOP_QUERY = '(min-width: 64rem)';

/** Map side panel width plus its margin (see BottomSheet). */
export const SIDE_PANEL_SPACE = 400 + 16 + 16;

export function isDesktop(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches;
}

function subscribe(onChange: () => void) {
    const query = window.matchMedia(DESKTOP_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribe, isDesktop, () => false);
}

/** Camera padding that keeps the target clear of the panel: bottom sheet on phones, side panel on computers. */
export function panelPadding(bottom: number) {
    return isDesktop() ? { top: 0, bottom: 0, left: SIDE_PANEL_SPACE, right: 0 } : { top: 0, bottom, left: 0, right: 0 };
}
