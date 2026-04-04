-- ============================================================
-- JOBLET.AI — Jobs Near Me: Complete Supabase Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================


-- STEP 1: Enable PostGIS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;


-- STEP 2: US ZIP Codes lookup table (33K+ rows)
-- ============================================================
-- We'll populate this via the batch script. Schema only here.
CREATE TABLE IF NOT EXISTS public.us_zipcodes (
  zip text PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location geography(POINT) GENERATED ALWAYS AS (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::geography
  ) STORED
);

-- Index for fast zip lookups
CREATE INDEX IF NOT EXISTS zipcodes_zip_idx ON public.us_zipcodes (zip);
CREATE INDEX IF NOT EXISTS zipcodes_geo_idx ON public.us_zipcodes USING GIST (location);

-- Make zip codes readable by everyone (it's public data)
ALTER TABLE public.us_zipcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zip_codes_public_read" ON public.us_zipcodes
  FOR SELECT USING (true);


-- STEP 3: Add geo columns to jobs table
-- ============================================================
-- Your jobs already have location text like "Roscoe, Illinois, United States"
-- We add a PostGIS POINT column + metadata

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS geo_location geography(POINT),
ADD COLUMN IF NOT EXISTS geo_city text,
ADD COLUMN IF NOT EXISTS geo_state text,
ADD COLUMN IF NOT EXISTS geo_zip text,
ADD COLUMN IF NOT EXISTS geo_country text DEFAULT 'US',
ADD COLUMN IF NOT EXISTS geo_source text DEFAULT 'pending';
  -- geo_source values: 'nominatim', 'google', 'zip_lookup', 'manual', 'pending'

-- Spatial index for fast radius queries
CREATE INDEX IF NOT EXISTS jobs_geo_location_idx 
ON public.jobs USING GIST (geo_location);


-- STEP 4: Function to store geocoded coordinates on a job
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_job_geo(
  p_job_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_source text DEFAULT 'nominatim'
)
RETURNS void AS $$
BEGIN
  UPDATE public.jobs
  SET
    geo_location = extensions.st_setsrid(
      extensions.st_makepoint(p_lng, p_lat), 4326
    )::geography,
    geo_city = COALESCE(p_city, geo_city),
    geo_state = COALESCE(p_state, geo_state),
    geo_zip = COALESCE(p_zip, geo_zip),
    geo_source = p_source
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 5: Resolve a ZIP code to lat/lng (for applicant search)
-- ============================================================
CREATE OR REPLACE FUNCTION public.zip_to_coords(p_zip text)
RETURNS TABLE (lat double precision, lng double precision) AS $$
BEGIN
  RETURN QUERY
  SELECT z.lat, z.lng
  FROM public.us_zipcodes z
  WHERE z.zip = LPAD(p_zip, 5, '0')  -- handle "7701" → "07701"
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;


-- STEP 6: Main search — Jobs within X miles
-- ============================================================
-- Accepts EITHER (lat, lng) OR (zip) — one of the two.
-- The frontend sends whichever the user provides.

CREATE OR REPLACE FUNCTION public.nearby_jobs(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_radius_miles double precision DEFAULT 25,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  company text,
  location text,           -- the original location text from the JD
  work_mode text,
  salary_min numeric,
  salary_max numeric,
  created_at timestamptz,
  dist_miles double precision,
  job_lat double precision,
  job_lng double precision,
  geo_city text,
  geo_state text
) AS $$
DECLARE
  search_lat double precision;
  search_lng double precision;
  search_point geography;
  radius_meters double precision;
BEGIN
  -- Resolve user location: prefer lat/lng, fallback to zip lookup
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    search_lat := p_lat;
    search_lng := p_lng;
  ELSIF p_zip IS NOT NULL THEN
    SELECT z.lat, z.lng INTO search_lat, search_lng
    FROM public.us_zipcodes z
    WHERE z.zip = LPAD(p_zip, 5, '0')
    LIMIT 1;
  END IF;

  -- If we still have no coordinates, return empty
  IF search_lat IS NULL OR search_lng IS NULL THEN
    RETURN;
  END IF;

  search_point := extensions.st_setsrid(
    extensions.st_makepoint(search_lng, search_lat), 4326
  )::geography;
  radius_meters := p_radius_miles * 1609.34;

  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.company,
    j.location,              -- original location text field from your jobs table
    j.work_mode,
    j.salary_min,
    j.salary_max,
    j.created_at,
    -- Distance in miles (NULL for remote jobs)
    CASE
      WHEN j.work_mode = 'remote' THEN NULL
      ELSE ROUND(
        (extensions.st_distance(j.geo_location, search_point) / 1609.34)::numeric, 1
      )::double precision
    END AS dist_miles,
    -- Coordinates for potential map pins
    CASE WHEN j.geo_location IS NOT NULL
      THEN extensions.st_y(j.geo_location::extensions.geometry)::double precision
      ELSE NULL
    END AS job_lat,
    CASE WHEN j.geo_location IS NOT NULL
      THEN extensions.st_x(j.geo_location::extensions.geometry)::double precision
      ELSE NULL
    END AS job_lng,
    j.geo_city,
    j.geo_state
  FROM public.jobs j
  WHERE
    -- Jobs within radius
    (
      j.geo_location IS NOT NULL
      AND extensions.st_dwithin(j.geo_location, search_point, radius_meters)
    )
    -- OR remote jobs (always included, sorted last)
    OR j.work_mode = 'remote'
  ORDER BY
    CASE
      WHEN j.work_mode = 'remote' THEN 999999
      WHEN j.geo_location IS NULL THEN 999998
      ELSE extensions.st_distance(j.geo_location, search_point)
    END ASC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;


-- STEP 7: Count jobs in radius (for the "247 jobs within 25 mi" header)
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_nearby_jobs(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_radius_miles double precision DEFAULT 25
)
RETURNS integer AS $$
DECLARE
  search_lat double precision;
  search_lng double precision;
  search_point geography;
  radius_meters double precision;
  total integer;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    search_lat := p_lat;
    search_lng := p_lng;
  ELSIF p_zip IS NOT NULL THEN
    SELECT z.lat, z.lng INTO search_lat, search_lng
    FROM public.us_zipcodes z WHERE z.zip = LPAD(p_zip, 5, '0') LIMIT 1;
  END IF;

  IF search_lat IS NULL THEN RETURN 0; END IF;

  search_point := extensions.st_setsrid(
    extensions.st_makepoint(search_lng, search_lat), 4326
  )::geography;
  radius_meters := p_radius_miles * 1609.34;

  SELECT COUNT(*) INTO total
  FROM public.jobs j
  WHERE
    (j.geo_location IS NOT NULL AND extensions.st_dwithin(j.geo_location, search_point, radius_meters))
    OR j.work_mode = 'remote';

  RETURN total;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- TEST QUERIES (run after populating zip codes & geocoding jobs)
-- ============================================================
-- Find jobs near ZIP 78701 (Austin, TX), 25 miles:
-- SELECT * FROM nearby_jobs(p_zip := '78701', p_radius_miles := 25);
--
-- Find jobs near GPS coords (Chicago), 10 miles:
-- SELECT * FROM nearby_jobs(p_lat := 41.8781, p_lng := -87.6298, p_radius_miles := 10);
--
-- Resolve a ZIP code:
-- SELECT * FROM zip_to_coords('90210');
--
-- Count jobs near NYC, 50 miles:
-- SELECT count_nearby_jobs(p_lat := 40.7128, p_lng := -74.0060, p_radius_miles := 50);
