const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
let isSyncing = false;
let pendingSync = false;

function runCommand(command) {
    try {
        return execSync(command, { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
        if (error.stdout) console.error(error.stdout);
        if (error.stderr) console.error(error.stderr);
        return false;
    }
}

async function syncChanges() {
    if (isSyncing) {
        pendingSync = true;
        return;
    }
    isSyncing = true;
    console.log('\n--- Syncing changes to GitHub ---');
    try {
        runCommand('git add .');

        const status = runCommand('git status --porcelain');
        if (status && status.trim().length > 0) {
            runCommand('git commit -m "Auto-sync: team updates"');
        }

        console.log('📥 Pulling latest changes from team...');
        const pullResult = runCommand('git pull origin main --rebase');
        
        if (pullResult === false) {
             console.log("⚠️ Could not pull automatically. Please resolve any merge conflicts.");
        } else {
             console.log('📤 Pushing updates to GitHub...');
             const pushResult = runCommand('git push origin main');
             if (pushResult !== false) {
                 console.log('✅ Changes successfully uploaded! Vercel and Render will now deploy.');
             }
        }
    } catch (e) {
        console.error("Auto-sync error:", e);
    }

    isSyncing = false;
    if (pendingSync) {
        pendingSync = false;
        setTimeout(syncChanges, 3000);
    }
}

let debounceTimer;
console.log('👀 Auto-Sync is running. Watching for file saves...');

fs.watch(projectRoot, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    // Ignore internal git operations and node_modules
    if (filename.includes('.git') || filename.includes('node_modules')) {
        return;
    }

    clearTimeout(debounceTimer);
    
    // Wait 4 seconds after file save to initiate sync (so we don't spam multiple commits)
    debounceTimer = setTimeout(() => {
        console.log(`\nDetected save in: ${filename}`);
        syncChanges();
    }, 4000);
});

// Run an initial sync on start
syncChanges();
