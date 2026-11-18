/** Tab-memory only. No drafts, passwords, files or request bodies in storage. */
const blockers = new Set<object>();
export function holdAppUpdate() {
  const key = {};
  blockers.add(key);
  return () => { blockers.delete(key); };
}
export function hasAppUpdateBlockers() { return blockers.size > 0; }

type Editable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;
const editableSelector = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]),textarea,select,[contenteditable=true]';
function editable(target: EventTarget | null): Editable | null {
  return target instanceof HTMLElement && target.matches(editableSelector) ? target : null;
}
function value(element: Editable): string {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') return String(element.checked);
    if (element.type === 'file') return element.files?.length ? 'selected-file' : '';
  }
  if (element instanceof HTMLSelectElement) return JSON.stringify(Array.from(element.selectedOptions, o => o.value));
  return 'value' in element ? String(element.value) : element.textContent ?? '';
}
function rendered(element: Element) {
  return !element.closest('[hidden],[inert],[aria-hidden=true]') && element.getClientRects().length > 0;
}

export function trackUpdateActivity(doc: Document, changed: () => void) {
  const initial = new WeakMap<Editable, string>();
  const dirty = new Set<Editable>();
  const capture = (event: Event) => {
    const element = editable(event.target);
    if (element && !initial.has(element) && !dirty.has(element)) initial.set(element, value(element));
  };
  const edit = (event: Event) => {
    const element = editable(event.target);
    if (!element || element.getAttribute('type') === 'search' || element.hasAttribute('data-app-update-ignore')) return;
    // Unfocused/autofill changes are conservatively dirty too.
    if (!initial.has(element)) dirty.add(element);
    else if (value(element) !== initial.get(element)) dirty.add(element);
    else dirty.delete(element);
    changed();
  };
  const remember = (element: Editable) => {
    if (!initial.has(element) && !dirty.has(element)) initial.set(element, value(element));
  };
  doc.querySelectorAll<HTMLElement>(editableSelector).forEach(remember);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      const field = editable(node); if (field) remember(field);
      node.querySelectorAll<HTMLElement>(editableSelector).forEach(remember);
    }
    // Release disconnected controls without repeatedly scanning the whole page
    // for live-list changes or each token of an assistant response.
    if (records.some(record => Array.from(record.removedNodes).some(node => node instanceof HTMLElement)))
      for (const element of dirty) if (!element.isConnected) dirty.delete(element);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('focusin', capture, true);
  doc.addEventListener('beforeinput', capture, true);
  doc.addEventListener('pointerdown', capture, true);
  doc.addEventListener('input', edit, true);
  doc.addEventListener('change', edit, true);
  return {
    blocked() {
      for (const element of dirty) {
        if (!element.isConnected || (initial.has(element) && value(element) === initial.get(element))) dirty.delete(element);
      }
      if (dirty.size || hasAppUpdateBlockers()) return true;
      // Portalled editors, uploads, camera/scanner and streaming panels must finish.
      if (Array.from(doc.querySelectorAll('[role=dialog],[role=alertdialog],[aria-busy=true],[data-app-update-blocked=true]')).some(rendered)) return true;
      if (Array.from(doc.querySelectorAll<HTMLInputElement>('input[type=file],input[type=password]')).some(e => e.type === 'file' ? Boolean(e.files?.length) : Boolean(e.value))) return true;
      return Array.from(doc.querySelectorAll('video,audio')).some(e => rendered(e) && (!(e as HTMLMediaElement).paused || Boolean((e as HTMLMediaElement).srcObject)));
    },
    dispose() {
      observer.disconnect(); dirty.clear();
      doc.removeEventListener('focusin', capture, true);
      doc.removeEventListener('beforeinput', capture, true);
      doc.removeEventListener('pointerdown', capture, true);
      doc.removeEventListener('input', edit, true);
      doc.removeEventListener('change', edit, true);
    },
  };
}
