// src/index.js
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

// Initialize the application
const container = document.getElementById('root');
const root = createRoot(container);
root.render(h(App));
