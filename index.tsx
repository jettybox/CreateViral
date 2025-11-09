import React from 'react';
import ReactDOM from 'react-dom/client';
// By importing Firestore here for its side effects, we ensure the service is
// registered with Firebase before any other component tries to use it. This
// is a robust way to prevent race conditions in production builds on platforms
// like Vercel.
import "https://aistudiocdn.com/firebase@^10.12.3/firestore.js";
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
