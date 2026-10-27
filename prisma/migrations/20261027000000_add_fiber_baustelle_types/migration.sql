-- Fiber-optic civil works (Glasfaser-Tiefbau) site types for BauFlow:
-- open-trench routes, directional drilling and house connections.

ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'FIBER_TRENCH';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'FIBER_DRILLING';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'FIBER_HOUSE_CONNECTION';
