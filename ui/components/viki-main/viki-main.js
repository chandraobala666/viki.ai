import { BaseComponent } from '../base/base.js';
import '../viki-header/viki-header.js';
import '../viki-left-splitter/viki-left-splitter.js';
import '../viki-llm-canvas/viki-llm-canvas.js';
import '../viki-tools-canvas/viki-tools-canvas.js';
import '../viki-rag-canvas/viki-rag-canvas.js';
import '../viki-agents-canvas/viki-agents-canvas.js';
import '../viki-chat-canvas/viki-chat-canvas.js';

export class VikiMain extends BaseComponent {
    constructor() {
        super('viki-main');
        this.currentView = 'llm'; // Default view
    }
    
    async connectedCallback() {
        const shadowRoot = await super.connectedCallback();
        if (shadowRoot) {
            this.setupEventListeners(shadowRoot);
            // Load default view
            await this.loadView(shadowRoot, 'llm');
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
        console.log('🚀 VikiMain: Navigation change to:', option);
        this.loadView(shadowRoot, option);
    }

    async loadView(shadowRoot, viewType) {
        console.log('🚀 VikiMain: Loading view:', viewType);
        this.currentView = viewType;
        const contentArea = shadowRoot.querySelector('#canvasContent');
        
        if (!contentArea) {
            console.error('❌ VikiMain: Content area not found');
            return;
        }

        // Clear existing content
        contentArea.innerHTML = '';

        // Create and append the appropriate canvas component
        let canvasComponent;
        switch (viewType) {
            case 'llm':
                console.log('🚀 Creating viki-llm-canvas');
                canvasComponent = document.createElement('viki-llm-canvas');
                break;
            case 'tools':
                console.log('🚀 Creating viki-tools-canvas');
                canvasComponent = document.createElement('viki-tools-canvas');
                break;
            case 'rag':
                console.log('🚀 Creating viki-rag-canvas');
                canvasComponent = document.createElement('viki-rag-canvas');
                break;
            case 'agents':
                console.log('🚀 Creating viki-agents-canvas');
                canvasComponent = document.createElement('viki-agents-canvas');
                break;
            case 'chat':
                console.log('🚀 Creating viki-chat-canvas');
                canvasComponent = document.createElement('viki-chat-canvas');
                break;
            default:
                console.log('🚀 Loading default view');
                this.loadDefaultView(contentArea);
                return;
        }

        if (canvasComponent) {
            console.log('🚀 Appending canvas component:', canvasComponent);
            contentArea.appendChild(canvasComponent);
            
            // Debug: Check if component was actually added
            setTimeout(() => {
                console.log('🚀 Content area children after append:', contentArea.children);
                console.log('🚀 Canvas component client dimensions:', {
                    width: canvasComponent.clientWidth,
                    height: canvasComponent.clientHeight,
                    style: canvasComponent.style.cssText
                });
            }, 1000);
        }
    }

    loadDefaultView(contentArea) {
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Welcome to VIKI</h2>
            </div>
            <p>Select an option from the left panel to get started.</p>
        `;
    }
}

customElements.define('viki-main', VikiMain);
