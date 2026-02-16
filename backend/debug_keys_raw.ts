import fs from 'fs';
import https from 'https';
import path from 'path';

const envPath = path.resolve(__dirname, '.env');
console.log('Reading .env from:', envPath);

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    let serviceKeyRaw = '';
    let urlRaw = '';

    for (const line of lines) {
        if (line.trim().startsWith('SUPABASE_SERVICE_KEY=')) {
            // Get everything after the equals sign
            serviceKeyRaw = line.substring(line.indexOf('=') + 1);
        }
        if (line.trim().startsWith('SUPABASE_URL=')) {
            urlRaw = line.substring(line.indexOf('=') + 1);
        }
    }

    // Inspect the raw value
    console.log('\n--- Key Inspection ---');
    console.log('Raw length (from read file):', serviceKeyRaw.length);

    // Clean it manually to see if it makes a difference
    const serviceKeyClean = serviceKeyRaw.trim().replace(/^["']|["']$/g, '');
    const urlClean = urlRaw.trim().replace(/^["']|["']$/g, '');

    console.log('Cleaned length:', serviceKeyClean.length);
    console.log('First 5 chars:', serviceKeyClean.substring(0, 5));
    console.log('Last 5 chars:', serviceKeyClean.substring(serviceKeyClean.length - 5));

    // Check for suspicious characters
    if (serviceKeyRaw.includes(' ')) console.log('⚠️  WARNING: Raw key contains spaces!');
    if (serviceKeyRaw.includes('\r')) console.log('⚠️  WARNING: Raw key contains carriage returns!');
    if (serviceKeyRaw.startsWith('"') || serviceKeyRaw.startsWith("'")) console.log('⚠️  WARNING: Raw key starts with quotes!');

    console.log('\n--- Raw HTTPS Request Test ---');
    // Make a raw request
    const options = {
        method: 'GET',
        headers: {
            'apikey': serviceKeyClean,
            'Authorization': `Bearer ${serviceKeyClean}`
        }
    };

    // Extract hostname and path from URL
    if (!urlClean) {
        console.error('URL missing');
        process.exit(1);
    }

    try {
        const urlObj = new URL(urlClean);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: '/rest/v1/distributions?select=count&limit=1',
            method: 'GET',
            headers: {
                'apikey': serviceKeyClean,
                'Authorization': `Bearer ${serviceKeyClean}`
            }
        };

        console.log(`Requesting: https://${reqOptions.hostname}${reqOptions.path}`);

        const req = https.request(reqOptions, res => {
            console.log(`Status Code: ${res.statusCode}`);

            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                console.log('Response Body:', data);
            });
        });

        req.on('error', error => {
            console.error('Request Error:', error);
        });

        req.end();

    } catch (e) {
        console.error('URL Parse Error:', e);
    }

} catch (err) {
    console.error('Error reading .env:', err);
}
