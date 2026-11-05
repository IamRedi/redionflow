'use client';
import type { ComponentProps } from 'react';
import { MachineSidebar } from '@/app/(workzone)/workzone/machine-sidebar';
export function AdminFleet({ production, ...props }: ComponentProps<typeof MachineSidebar> & {
    production: boolean;
}) {
    if (production)
        return null;
    return <MachineSidebar {...props}/>;
}
