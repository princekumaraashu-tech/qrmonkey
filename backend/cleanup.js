const admin = require("firebase-admin");
const fs = require('fs');
const path = require('path');

// 1. Initialize Firebase Admin
// The serviceAccountKey.json must be downloaded from Firebase Console
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERROR: serviceAccountKey.json not found!");
    console.error("Please download it from Firebase Console -> Project Settings -> Service Accounts, and save it as 'serviceAccountKey.json' in the backend folder.");
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://fir-5b437-default-rtdb.firebaseio.com"
});

const db = admin.database();

async function cleanupExpiredQRs() {
    console.log(`[${new Date().toISOString()}] Starting QR cleanup job...`);
    
    const scansRef = db.ref("scans");
    const archivesRef = db.ref("archived_scans");
    const now = Date.now();

    try {
        const snapshot = await scansRef.once('value');
        if (!snapshot.exists()) {
            console.log("No scans found in database.");
            process.exit(0);
        }

        const scans = snapshot.val();
        let deletedCount = 0;

        for (const scanId in scans) {
            const scan = scans[scanId];
            
            // Check if expired
            if (scan.expiresAt && scan.expiresAt < now) {
                console.log(`- Expired scan found: ${scanId} (Expired at: ${new Date(scan.expiresAt).toLocaleString()})`);
                
                // Bundle important tracking data
                const archiveData = {
                    original_scan_id: scanId,
                    uid: scan.uid || 'guest',
                    email: scan.email || 'unknown',
                    ip_address: scan.ip_address || 'unknown',
                    type: scan.type || 'unknown',
                    filename: scan.filename || 'none',
                    created_at: scan.timestamp || null,
                    archived_at: now
                };

                // 1. Save bundle to archives
                await archivesRef.push(archiveData);
                console.log(`  ✅ Archived tracking data for ${scanId}`);

                // 2. Delete heavy data from main scans node
                await scansRef.child(scanId).remove();
                console.log(`  🗑️ Deleted heavy image/qr data for ${scanId}`);
                
                deletedCount++;
            }
        }

        console.log(`[${new Date().toISOString()}] Cleanup finished. Total expired QRs deleted & archived: ${deletedCount}`);
        process.exit(0);

    } catch (error) {
        console.error("❌ Error during cleanup:", error);
        process.exit(1);
    }
}

// Run the function
cleanupExpiredQRs();
