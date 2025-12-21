import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length > 0) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) throw new Error('Missing Firebase admin env vars');
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function migrate(nk, opts = { deleteAfter: false }) {
  initAdmin();
  const db = getFirestore();
  console.log('Starting migration for', nk);

  // Helper to copy a doc snapshot into food_nights/<nk>/votes/<docId>
  async function copyDoc(srcPath, docId, data) {
    const destRef = db.doc(`food_nights/${nk}/votes/${docId}`);
    await destRef.set(data, { merge: true });
    console.log('Copied', srcPath, '->', `food_nights/${nk}/votes/${docId}`);
  }

  // 1) If there's a root collection named nk, copy any documents that look like votes
  const rootCollections = (await db.listCollections()).map((c) => c.id);
  if (rootCollections.includes(nk)) {
    console.log('Found root collection', nk, '- scanning documents');
    const colRef = db.collection(nk);
    const snap = await colRef.get();
    for (const d of snap.docs) {
      const data = d.data();
      // If doc itself looks like a vote (has intent or selections), copy it
      if (data && (data.intent || Array.isArray(data.selections))) {
        await copyDoc(`${nk}/${d.id}`, d.id, data);
        if (opts.deleteAfter) await d.ref.delete();
      }
      // Also check for a subcollection 'votes' under this doc
      const subCols = (await d.ref.listCollections()).map((sc) => sc.id);
      if (subCols.includes('votes')) {
        const votesSnap = await d.ref.collection('votes').get();
        for (const vdoc of votesSnap.docs) {
          await copyDoc(`${nk}/${d.id}/votes/${vdoc.id}`, vdoc.id, vdoc.data());
          if (opts.deleteAfter) await vdoc.ref.delete();
        }
      }
    }
  }

  // 2) If there's a root collection 'votes' that stores nightKey field, copy matching docs
  if (rootCollections.includes('votes')) {
    console.log('Found root collection votes - scanning for nightKey=', nk);
    const votesRef = db.collection('votes').where('nightKey', '==', nk);
    const vsnap = await votesRef.get();
    for (const vdoc of vsnap.docs) {
      await copyDoc(`votes/${vdoc.id}`, vdoc.id, vdoc.data());
      if (opts.deleteAfter) await vdoc.ref.delete();
    }
  }

  // 3) Check for collection 'nights' or 'food_nights' where doc exists with subcollection 'votes' but was misnamed
  const knownRoots = ['nights', 'food_nights'];
  for (const root of knownRoots) {
    const colIds = (await db.listCollections()).map((c) => c.id);
    if (!colIds.includes(root)) continue;
    const docRef = db.collection(root).doc(nk);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const subCols = (await docRef.listCollections()).map((sc) => sc.id);
      if (subCols.includes('votes')) {
        const vsnap = await docRef.collection('votes').get();
        for (const vdoc of vsnap.docs) {
          await copyDoc(`${root}/${nk}/votes/${vdoc.id}`, vdoc.id, vdoc.data());
          if (opts.deleteAfter) await vdoc.ref.delete();
        }
      }
    }
  }

  console.log('Migration finished for', nk);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/migrate_votes_to_food_nights.mjs <nightKey> [--delete]');
    process.exit(2);
  }
  const nk = argv[0];
  const deleteAfter = argv.includes('--delete');
  try {
    await migrate(nk, { deleteAfter });
    console.log('Done');
  } catch (e) {
    console.error('Migration error', e);
    process.exitCode = 2;
  }
}

main();
