'use client';

import { useLayoutEffect, useRef } from 'react';

/** Reserve the initial header clearance while allowing content to scroll behind it. */
export function WorkspaceHeaderOffset() {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const header = marker.current?.closest('header');
    const shell = header?.parentElement;
    if (!header || !shell) return;
    const navigation = shell.querySelector<HTMLElement>('[data-testid="app-workspace-navigation"]');
    const measure = () => {
      shell.style.setProperty('--workspace-header-height', `${header.getBoundingClientRect().height}px`);
      shell.style.setProperty('--workspace-navigation-height', `${navigation?.getBoundingClientRect().height ?? 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (navigation) observer.observe(navigation);
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--workspace-header-height');
      shell.style.removeProperty('--workspace-navigation-height');
    };
  }, []);
  return <span ref={marker} hidden />;
}
