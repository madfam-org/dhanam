-- Keep the product catalog enum aligned with catalog.yaml.
-- Routecraft is categorized as travel in the canonical ecosystem catalog.

ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'travel';
