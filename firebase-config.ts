// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add your Firebase project's configuration here
//
// How to find this:
// 1. Go to the Firebase Console: https://console.firebase.google.com/
// 2. Select your project.
// 3. In the project overview, click the "</>" icon to "Add an app" and choose "Web".
// 4. Give your app a nickname (e.g., "CreateViral Frontend") and click "Register app".
// 5. You will be shown your firebaseConfig object. Copy it and paste it below.

const firebaseConfig = {
  apiKey: "AIzaSyA0UV9I-E0pDCR4azCXCp0I1hdlNqCV200",
  authDomain: "createviral-database.firebaseapp.com",
  projectId: "createviral-database",
  storageBucket: "createviral-database.firebasestorage.app",
  messagingSenderId: "985465455751",
  appId: "1:985465455751:web:e636f383a9a343ce346422",
  measurementId: "G-WC24HZVF3D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the Firestore service
export const db = getFirestore(app);
