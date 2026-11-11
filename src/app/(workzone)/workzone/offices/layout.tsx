import type {ReactNode} from 'react';
import s from '@/components/offices/studio.module.css';
export default function OfficeLayout({children}:{children:ReactNode}){return <div className={s.workspace}>{children}</div>;}
