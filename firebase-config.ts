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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the Firestore service
export const db = getFirestore(app);
