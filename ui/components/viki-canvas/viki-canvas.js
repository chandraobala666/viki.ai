import { BaseComponent } from '../base/base.js';

class VikiCanvas extends BaseComponent {
    constructor() {
        super('viki-canvas');
    }

    async connectedCallback() {
        const shadowRoot = await super.connectedCallback();
        if (shadowRoot) {
            this.setupEventListeners(shadowRoot);
        }
    }

    setupEventListeners(shadowRoot) {
        // Add any canvas-specific event listeners here
        console.log('Viki Canvas component loaded');
    }
}

// Register the custom element
customElements.define('viki-canvas', VikiCanvas);