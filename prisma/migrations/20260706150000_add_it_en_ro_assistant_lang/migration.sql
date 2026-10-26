-- i18n Phase 1: extend AssistantLanguage with EN, IT, RO so office / worker
-- profiles can store the language they operate the app in. Existing rows
-- (DE / SQ / PL) are unaffected.

ALTER TYPE "AssistantLanguage" ADD VALUE IF NOT EXISTS 'EN';
ALTER TYPE "AssistantLanguage" ADD VALUE IF NOT EXISTS 'IT';
ALTER TYPE "AssistantLanguage" ADD VALUE IF NOT EXISTS 'RO';
