import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Explicitly import firestore for its side-effects to ensure the service is registered.
// This should fix the "Service firestore is not available" runtime error.
import "https://aistudiocdn.com/firebase@^10.12.3/firestore.js";

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
