// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getFirestore, Firestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage, FirebaseStorage } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// =================================================================================
// --- ACTION REQUIRED: REPLACE WITH YOUR FIREBASE PROJECT CONFIGURATION ---
// =================================================================================
// The object below is a PUBLIC DEMO configuration. It points to an empty, read-only
// database. To see YOUR videos, you must replace this entire `firebaseConfig`
// object with the one from your own Firebase project.
//
// HOW TO GET YOUR CONFIG:
// 1. Go to the Firebase Console: https://console.firebase.google.com/
// 2. Select your project (e.g., 'createviral-database').
// 3. In Project Settings > General, scroll down to "Your apps".
// 4. Under "Firebase SDK snippet", select the "Config" radio button.
// 5. Copy the entire object and paste it here, completely replacing the one below.
//
// If you don't do this, the app will connect to the demo database and your
// video collection will appear empty.
// =================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyA0UV9I-E0pDCR4azCXCp0I1hdlNqCV200",
  authDomain: "createviral-database.firebaseapp.com",
  projectId: "createviral-database",
  storageBucket: "createviral-database.appspot.com",
  messagingSenderId: "985465455751",
  appId: "1:985465455751:web:e636f383a9a343ce346422",
  measurementId: "G-WC24HZVF3D"
};
// =================================================================================
// --- END OF CONFIGURATION SECTION ---
// =================================================================================


// Initialize services within a temporary object to handle potential errors.
const services = (() => {
  try {
    const appInstance = initializeApp(firebaseConfig);
    const dbInstance = getFirestore(appInstance);
    const storageInstance = getStorage(appInstance);
    return {
      app: appInstance as FirebaseApp,
      db: dbInstance as Firestore,
      storage: storageInstance as FirebaseStorage,
      error: null as string | null,
    };
  } catch (e: any) {
    console.error("CRITICAL: Firebase initialization failed.", e);
    let errorMsg: string;
    if (e.message.includes("apiKey")) {
      errorMsg = "Firebase initialization failed: The API Key is missing or invalid. Please ensure you have copied the correct firebaseConfig from your project settings into `firebase-config.ts`."
    } else {
      errorMsg = e.message || "An unknown error occurred during Firebase initialization. Check the browser console for more details.";
    }
    return { app: null, db: null, storage: null, error: errorMsg };
  }
})();

// Export each service as a named constant. This is a more robust pattern
// for build tools and avoids issues with top-level `let` declarations.
export const app = services.app;
export const db = services.db;
export const storage = services.storage;
export const firebaseInitError = services.error;
