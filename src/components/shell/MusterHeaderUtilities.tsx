import { MusterPreferences } from './MusterPreferences';
import s from './muster-header.module.css';

/** Only the explicit Muster shell mounts this one global appearance control. */
export function MusterHeaderUtilities() {
  return <div className={s.utilities} data-testid="muster-header-utilities"><MusterPreferences/></div>;
}
