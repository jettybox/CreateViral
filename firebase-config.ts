// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getFirestore, Firestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// Your web app's Firebase configuration from your project settings
const firebaseConfig = {
  apiKey: "AIzaSyA0UV9I-E0pDCR4azCXCp0I1hd1NqCV200",
  authDomain: "createviral-database.firebaseapp.com",
  projectId: "createviral-database",
  storageBucket: "createviral-database.appspot.com",
  messagingSenderId: "985465455751",
  appId: "1:985465455751:web:e636f383a9a343ce346422",
  measurementId: "G-WC24HZVF3D"
};

let db: Firestore | null = null;
let firebaseInitError: string | null = null;

try {
  // Initialize Firebase
  const app: FirebaseApp = initializeApp(firebaseConfig);
  // Get a reference to the Firestore service
  db = getFirestore(app);
} catch (e: any) {
  console.error("CRITICAL: Firebase initialization failed.", e);
  firebaseInitError = e.message || "An unknown error occurred during Firebase initialization. Check the browser console for more details.";
}

export { db, firebaseInitError };
