# Steel phase documents and asset codes

Review candidate, 6 November 2026. Publication and owner/device acceptance are
separate from local verification. Existing site documents, production
confirmations, custody, workshop transitions and printed legacy codes remain valid.

## Documents

The **Fazat** button beside **Dokumentet** groups private site documents into
Piketim, Rilevim, Projektim, Porosi, Prodhimi and Montimi. Office users, field
engineers, factory engineers and existing legacy engineer roles can open,
download, share and upload within their company. Ordinary workers and mechanics
receive no additional document access. Every server action and file GET resolves
one fresh authenticated identity; mixed admin/worker sessions are refused.

There are no assigned recipients. **E mora** records only the signed-in person's
name and server timestamp. Repeating it is idempotent. It is a receipt, not proof
of reading, a work-stage completion or a production confirmation. A new version
stores a new immutable file, archives its predecessor and starts with no receipts.
The predecessor's bytes and receipts remain in history. Uploaders can replace or
archive their own files; office staff can manage all site phase files.

**Dërgo** opens the device's native share chooser when supported. It shares the
file where supported, otherwise its authenticated link. Without native sharing,
it copies that authenticated link. Cancellation sends nothing. There is no
automatic email, external upload or public document link.

PDF, DOCX and XLSX retain their bytes. Uploaded JPEG/PNG/WebP become compact WebP
without EXIF/GPS metadata. Documents are capped at 15 MB, raster input at 12 MB;
each site has an explicit cumulative limit of 300 stored versions / 250 MB.
Archive retains history and therefore does not reclaim this allowance. File
signatures are checked using the existing site-file validator. The existing
content-scanner seam remains unchanged; its default no-op is not malware scanning.
Private downloads use no-store, nosniff and sandbox response headers. Office
formats download as attachments. Displayed timestamps use Europe/Tirane.

## Individual assets

The factory barcode/QR is an alias, distinct from an individual asset's unique
label. Registering several copies of one model records the same factory alias on
each physical unit and gives each its own short internal Code39 barcode. Scanning
a shared model code returns candidates with their internal identity, holder and
current status. The user chooses the unit; scanning never performs a handover or
repair transition automatically. Unknown codes offer registration with the raw
factory value prefilled. Existing allocation and workshop blocks still apply.

Factory payload case, punctuation, leading zeroes and GS1 field separators are preserved. QR URLs are
matched as data and never followed. Checksum-valid UPC/EAN variants share a GTIN
identity; arbitrary numeric strings do not. Lookup uses exact codes, not fuzzy
name matching, and applies the existing asset visibility boundary before results
and counts. Inactive records can be identified without making them usable.

Managers can add up to ten factory aliases, unlink one with retained history, or
generate/reuse one individual label. Generation and printing are separate: GET
printing does not write business data. Office-worker and admin printing uses the
same authenticated tenant boundary. No existing barcode is rewritten. Code39
labels include quiet zones; camera and photo decoding reuse installed ZXing,
with native detection used only when all configured formats are available.

## Data and verification

The additive migration creates three private tables: SitePhaseDocument,
SitePhaseDocumentReceipt and CompanyAssetCode. Composite tenant foreign keys,
forced RLS, shape checks and partial label uniqueness supplement application
authorization. Version replacement, receipt and alias writes serialize on owned
locks; upload request UUIDs prevent duplicate retry uploads. File bytes are not
included in list responses. Photo processing shares the existing bounded native
image lock. No secrets, providers, infrastructure, CI triggers or live data are
changed during preparation.

Local gates cover exact/ambiguous/legacy codes, receipt identity and retries,
version concurrency, fresh role revocation, tenant/RLS boundaries, image bytes,
private download headers, real image decoding and responsive interactions.
Browser proof uses synthetic data only. Physical phone camera, label printer,
native share-target delivery, office file rendering and owner production
acceptance remain separate device checks; do not infer them from compilation or
synthetic browser tests. Final verification evidence and publication status belong
in the review PR and the existing canonical project continuation.
