import { BaseComponent } from '../base/base.js';

class VikiCard extends BaseComponent {
    constructor() {
        super('viki-card');
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
            }
        } catch (error) {
            console.error('Error in VikiCard connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for card specific functionality
    }
}

// Register the custom element
customElements.define('viki-card', VikiCard);

export { VikiCard };