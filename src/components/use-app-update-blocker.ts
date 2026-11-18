'use client';
import { useEffect } from 'react';
import { holdAppUpdate } from '@/lib/deploy/update-activity';

/** For work held in React state rather than a native input/dialog. */
export function useAppUpdateBlocker(blocked: boolean) {
  useEffect(() => blocked ? holdAppUpdate() : undefined, [blocked]);
}
