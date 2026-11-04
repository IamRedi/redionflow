'use client';
import type { ComponentProps } from 'react';
import { usePathname } from 'next/navigation';
import { MachineSidebar } from '@/app/(workzone)/workzone/machine-sidebar';
export function AdminFleet({ production, ...props }: ComponentProps<typeof MachineSidebar> & {
    production: boolean;
}) {
    const path = usePathname();
    if (production && path === '/app/dashboard')
        return null;
    return <MachineSidebar {...props}/>;
}
