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

        // Listen for navigation change events
        this.addEventListener('viki-nav-change', (event) => {
            const { option } = event.detail;
            this.handleNavigationChange(shadowRoot, option);
        });
    }

    handleNavigationChange(shadowRoot, option) {
        const canvas = shadowRoot.querySelector('viki-canvas');
        if (canvas && canvas.shadowRoot) {
            // Call loadView directly on the canvas component to avoid event loops
            canvas.loadView(canvas.shadowRoot, option);
        }
    }
}

customElements.define('viki-main', VikiMain);
