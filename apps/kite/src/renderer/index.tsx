import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FilesWindow } from './screens/FilesWindow';
import { KeyboardWindow } from './screens/KeyboardWindow';
import './assets/index.css';

const container = document.getElementById('root');
const hash = window.location.hash;

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      {hash === '#keyboard' ? (
        <KeyboardWindow />
      ) : hash === '#files' ? (
        <FilesWindow />
      ) : (
        <App />
      )}
    </React.StrictMode>,
  );
}
