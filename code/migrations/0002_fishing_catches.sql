-- Additive migration: preserve all existing island names, resources and buildings.
ALTER TABLE "Island" ADD COLUMN "catches" JSONB NOT NULL DEFAULT '{}';
