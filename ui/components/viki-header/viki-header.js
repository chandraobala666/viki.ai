import { BaseComponent } from '../base/base.js';

export class VikiHeader extends BaseComponent {
    constructor() {
        super('viki-header');
    }

    async connectedCallback() {
        const shadowRoot = await super.connectedCallback();
        this.componentReady(shadowRoot);
    }
    
    componentReady(shadowRoot) {
        // Additional initialization can be added here if needed
        console.log('VIKI Header component is ready');
    }
}

customElements.define('viki-header', VikiHeader);