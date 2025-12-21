import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';

async function run() {
  const now = new Date();
  const nk = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;

  // Minimal client config for emulator use
  const app = initializeApp({
    apiKey: 'fake',
    authDomain: 'localhost',
    projectId: 'demo-project',
  });

  const auth = getAuth(app);
  // auth/firestore emulators ports are configured in firebase.json
  connectAuthEmulator(auth, 'http://localhost:9095', { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, 'localhost', 8085);

  try {
    const cred = await signInAnonymously(auth);
    console.log('Signed in anonymously, uid=', cred.user.uid);

    const voteRef = doc(db, 'food_nights', nk, 'votes', cred.user.uid);

    const payload = {
      userId: cred.user.uid,
      nightKey: nk,
      intent: 'yes',
      createdAt: new Date(),
      selections: [{ venueId: 'test-venue', price: 10, updatedAt: new Date() }],
    };

    await setDoc(voteRef, payload);
    console.log('Write succeeded: vote written to', voteRef.path);
  } catch (e) {
    console.error('Write failed:', e && e.message ? e.message : e);
    process.exitCode = 2;
  }
}

run().then(() => process.exit()).catch((e) => { console.error(e); process.exit(1); });
