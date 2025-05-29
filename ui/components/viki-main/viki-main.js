import { BaseComponent } from '../base/base.js';
import '../viki-header/viki-header.js';
import '../viki-left-splitter/viki-left-splitter.js';
import '../viki-canvas/viki-canvas.js';

export class VikiMain extends BaseComponent {
    constructor() {
        super('viki-main');
    }
    
    async connectedCallback() {
        const shadowRoot = await super.connectedCallback();
        if (shadowRoot) {
            this.setupEventListeners(shadowRoot);
        }
    }

    setupEventListeners(shadowRoot) {
        // Listen for left splitter toggle events
        this.addEventListener('viki-left-splitter-toggle', (event) => {
            const { collapsed } = event.detail;
            // console.log(`Left splitter ${collapsed ? 'collapsed' : 'expanded'}`);
        });
    }
}

customElements.define('viki-main', VikiMain);
