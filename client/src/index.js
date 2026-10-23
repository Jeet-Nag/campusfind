import { jsx as _jsx } from "preact/jsx-runtime";
import { initApiInterceptor } from './config/api';
import { render } from 'preact';
import { App } from './app';
import './styles/index.css';
// Initialize centralized API routing
initApiInterceptor();
const root = document.getElementById('app');
if (root) {
    render(_jsx(App, {}), root);
}
// Register minimal pass-through service worker for PWA standalone installation
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { });
    });
}
