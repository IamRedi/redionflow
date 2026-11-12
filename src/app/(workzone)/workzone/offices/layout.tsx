import type {ReactNode} from 'react';
import s from '@/components/offices/studio.module.css';
import {OfficeWorkspace} from '@/components/offices/OfficeWorkspace';
export default function OfficeLayout({children}:{children:ReactNode}){return <div className={s.workspace}><OfficeWorkspace>{children}</OfficeWorkspace></div>;}
