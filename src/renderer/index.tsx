import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FilesWindow } from './screens/FilesWindow';
import './assets/index.css';

const container = document.getElementById('root');
const isFilesWindow = window.location.hash === '#files';

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      {isFilesWindow ? <FilesWindow /> : <App />}
    </React.StrictMode>,
  );
}
