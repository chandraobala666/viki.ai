// Loading HTTP Client Libraries
import { get, post, put, delete as deleteRequest, createApiClient } from './api-client.js';

// Make HTTP clients available globally
window.apiMethods = { get, post, put, delete: deleteRequest, createApiClient };

console.log('✅ HTTP client libraries loaded successfully');

// Loading HTML Components
const componentFiles = [
    '../components/viki-header/viki-header.js',
    '../components/viki-footer/viki-footer.js',
    '../components/viki-main/viki-main.js',
    '../components/viki-canvas/viki-canvas.js',
    '../components/viki-card/viki-card.js',
    '../components/viki-left-splitter/viki-left-splitter.js'
];

componentFiles.forEach(file => {
    import(file).catch(error => {
        console.error(`Failed to load component: ${file}`, error);
    });
});