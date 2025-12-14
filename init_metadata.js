import { db } from './src/js/config/firebase.js';
import { doc, setDoc } from 'firebase/firestore';

async function initMetadata() {
  try {
    console.log('Initializing settings/status...');
    await setDoc(doc(db, 'settings', 'status'), { lastUpdated: Date.now() });
    console.log('✅ settings/status created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating settings/status:', error);
    process.exit(1);
  }
}

initMetadata();
