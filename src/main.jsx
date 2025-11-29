import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Assuming you set up Tailwind CSS via a file named index.css in your Vercel project
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
