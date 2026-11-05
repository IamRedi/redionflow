'use client';

import { createContext, useContext, type ReactNode } from 'react';

const FooterBrand = createContext<ReactNode>(null);

export function FooterBrandProvider({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return <FooterBrand.Provider value={mark}>{children}</FooterBrand.Provider>;
}

export function FooterProductMark() {
  return useContext(FooterBrand);
}
