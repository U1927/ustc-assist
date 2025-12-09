
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("[Index] Application Starting...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("[Index] FATAL: Could not find root element!");
  throw new Error("Could not find root element to mount to");
}

console.log("[Index] Mounting React Root...");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
