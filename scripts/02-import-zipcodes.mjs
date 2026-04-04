/**
 * JOBLET.AI — Import US ZIP Codes into Supabase
 * 
 * Loads ~33K US ZIP code centroids with lat/lng into the us_zipcodes table.
 * Run once after creating the table via the SQL migration.
 * 
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=your-service-role-key node 02-import-zipcodes.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Use service_role key for bulk inserts

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars');
  process.exit(1);
}

const CSV_URL = 'https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%20Zip%20Codes%20from%202013%20Government%20Data';

async function main() {
  console.log('Downloading US ZIP code data...');
  const res = await fetch(CSV_URL);
  const text = await res.text();
  
  const lines = text.trim().split('\n').slice(1); // skip header
  console.log(`Parsed ${lines.length} ZIP codes`);

  // Parse CSV into rows
  const rows = lines.map(line => {
    const [zip, lat, lng] = line.split(',').map(s => s.trim());
    return { zip: zip.padStart(5, '0'), lat: parseFloat(lat), lng: parseFloat(lng) };
  }).filter(r => !isNaN(r.lat) && !isNaN(r.lng));

  console.log(`Valid rows: ${rows.length}`);

  // Insert in batches of 500 (Supabase limit)
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/us_zipcodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates', // upsert on conflict
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Batch ${i}-${i + batch.length} failed:`, err);
      // Continue anyway — some zips might conflict
    } else {
      inserted += batch.length;
    }

    // Progress
    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`  Inserted ${inserted}/${rows.length} (${Math.round(inserted/rows.length*100)}%)`);
    }
  }

  console.log(`\nDone! Inserted ${inserted} ZIP codes into us_zipcodes table.`);
  console.log('Test: SELECT * FROM zip_to_coords(\'90210\');');
}

main().catch(console.error);
