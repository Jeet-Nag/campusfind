import { jsx as _jsx } from "preact/jsx-runtime";
import { render } from 'preact';
import { initApiInterceptor } from './config/api';
import { BetaApp } from './components/BetaApp';
import './styles/index.css';
// Initialize centralized API routing
initApiInterceptor();
const root = document.getElementById('beta-app');
if (root) {
    render(_jsx(BetaApp, {}), root);
}
