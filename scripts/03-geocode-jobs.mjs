/**
 * JOBLET.AI — Batch Geocode Existing Jobs
 * 
 * Reads all jobs that have a location text but no geo_location coordinates,
 * geocodes them using Nominatim (OpenStreetMap, free), and stores the result.
 * 
 * Nominatim rate limit: 1 request/second. For ~5000 jobs = ~1.5 hours.
 * Run this once, then add real-time geocoding to your job ingest pipeline.
 * 
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=your-service-role-key node 03-geocode-jobs.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars');
  process.exit(1);
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Joblet.ai/1.0 (contact@joblet.ai)'; // Required by Nominatim TOS
const RATE_LIMIT_MS = 1100; // 1 request per second + buffer

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Geocode a location string using Nominatim
 * "Roscoe, Illinois, United States" → { lat: 42.41, lng: -89.01, city: "Roscoe", state: "IL" }
 */
async function geocode(locationText) {
  const params = new URLSearchParams({
    q: locationText,
    format: 'json',
    countrycodes: 'us',
    limit: '1',
    addressdetails: '1',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data[0]) return null;

  const result = data[0];
  const addr = result.address || {};

  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    city: addr.city || addr.town || addr.village || addr.county || null,
    state: addr.state || null,
    zip: addr.postcode || null,
    display: result.display_name,
  };
}

/**
 * Fetch jobs that need geocoding from Supabase
 */
async function fetchUngecodedJobs(limit = 1000) {
  // Adjust the column name to match your actual location text field
  // Common names: "location", "job_location", "city", "location_text"
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/jobs?geo_source=eq.pending&select=id,location,company,work_mode&limit=${limit}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    // If geo_source column doesn't exist yet, try fetching jobs where geo_location is null
    const fallbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/jobs?geo_location=is.null&select=id,location,company,work_mode&limit=${limit}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    return await fallbackRes.json();
  }

  return await res.json();
}

/**
 * Update a job with geocoded coordinates via RPC
 */
async function updateJobGeo(jobId, geo) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_job_geo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      p_job_id: jobId,
      p_lat: geo.lat,
      p_lng: geo.lng,
      p_city: geo.city,
      p_state: geo.state,
      p_zip: geo.zip,
      p_source: 'nominatim',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RPC set_job_geo failed: ${err}`);
  }
}

/**
 * Mark a job as "skipped" (no geocodable location)
 */
async function markSkipped(jobId, reason) {
  await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      geo_source: `skip:${reason}`,
    }),
  });
}

async function main() {
  console.log('Fetching jobs that need geocoding...\n');
  const jobs = await fetchUngecodedJobs(5000);
  console.log(`Found ${jobs.length} jobs to geocode\n`);

  if (jobs.length === 0) {
    console.log('No jobs need geocoding. All done!');
    return;
  }

  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    // Skip remote jobs — they don't have a physical location
    if (job.work_mode === 'remote') {
      await markSkipped(job.id, 'remote');
      skipped++;
      continue;
    }

    // The location field from your jobs table
    // Adjust "location" to match your actual column name
    const locationText = job.location;

    if (!locationText || locationText.trim() === '' || locationText.toLowerCase() === 'remote') {
      await markSkipped(job.id, 'no_location_text');
      skipped++;
      continue;
    }

    try {
      // Rate limit: 1 req/sec for Nominatim
      await sleep(RATE_LIMIT_MS);

      const geo = await geocode(locationText);

      if (!geo) {
        // Try with company name added for context
        await sleep(RATE_LIMIT_MS);
        const geoWithCompany = await geocode(`${job.company} ${locationText}`);
        
        if (!geoWithCompany) {
          console.log(`  [SKIP] #${i + 1} "${locationText}" — no results`);
          await markSkipped(job.id, 'geocode_failed');
          failed++;
          continue;
        }

        await updateJobGeo(job.id, geoWithCompany);
        geocoded++;
        console.log(`  [OK]   #${i + 1} "${locationText}" → ${geoWithCompany.lat}, ${geoWithCompany.lng} (${geoWithCompany.city}, ${geoWithCompany.state}) [with company name]`);
      } else {
        await updateJobGeo(job.id, geo);
        geocoded++;
        console.log(`  [OK]   #${i + 1} "${locationText}" → ${geo.lat}, ${geo.lng} (${geo.city}, ${geo.state})`);
      }
    } catch (err) {
      console.error(`  [ERR]  #${i + 1} "${locationText}" — ${err.message}`);
      failed++;
    }

    // Progress every 50 jobs
    if ((i + 1) % 50 === 0) {
      const pct = Math.round(((i + 1) / jobs.length) * 100);
      const eta = Math.round(((jobs.length - i) * RATE_LIMIT_MS) / 60000);
      console.log(`\n  Progress: ${i + 1}/${jobs.length} (${pct}%) | Geocoded: ${geocoded} | Skipped: ${skipped} | Failed: ${failed} | ETA: ~${eta} min\n`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Batch geocoding complete!`);
  console.log(`  Geocoded: ${geocoded}`);
  console.log(`  Skipped:  ${skipped} (remote or no location)`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Total:    ${jobs.length}`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`Test: SELECT * FROM nearby_jobs(p_zip := '78701', p_radius_miles := 25);`);
}

main().catch(console.error);
