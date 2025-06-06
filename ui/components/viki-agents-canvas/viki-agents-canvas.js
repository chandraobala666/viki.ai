import { BaseComponent } from '../base/base.js';

class VikiAgentsCanvas extends BaseComponent {
    constructor() {
        super('viki-agents-canvas');
        this.agents = []; // Store agents data for display purposes
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                await this.loadAgentsView();
            }
        } catch (error) {
            console.error('Error in VikiAgentsCanvas connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for Agents canvas specific functionality
    }

    async loadAgentsView() {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Agents</h2>
                <button class="btn-primary add-agent-btn" id="addAgentBtn">
                    <span>+</span> Add Agent
                </button>
            </div>
            <div class="canvas-empty-state-container" id="canvasEmptyStateContainer" style="display: none;">
                <div class="canvas-empty-state">
                    No agents found. Click "Add Agent" to create your first agent.
                </div>
            </div>
            <div class="agents-list" id="agentsList">
                <div class="loading">Loading agents...</div>
            </div>
        `;

        // Setup Agents view event listeners
        this.setupAgentsViewEventListeners(contentArea);
        
        // Load existing agents
        await this.loadAgents(contentArea);
    }

    setupAgentsViewEventListeners(contentArea) {
        const addBtn = contentArea.querySelector('#addAgentBtn');
        
        addBtn.addEventListener('click', () => {
            this.handleAddAgent();
        });
    }

    async loadAgents(contentArea) {
        const agentsList = contentArea.querySelector('#agentsList');
        const emptyStateContainer = contentArea.querySelector('#canvasEmptyStateContainer');
        
        try {
            // TODO: Replace with actual API call when backend is ready
            // const agents = await get('/api/agents');
            const agents = []; // Placeholder for now
            
            this.agents = agents;
            
            if (agents.length === 0) {
                agentsList.style.display = 'none';
                emptyStateContainer.style.display = 'flex';
            } else {
                emptyStateContainer.style.display = 'none';
                agentsList.style.display = 'grid';
                this.renderAgents(agentsList, agents);
            }
        } catch (error) {
            console.error('Error loading agents:', error);
            agentsList.innerHTML = `<div class="error">Error loading agents: ${error.message}</div>`;
        }
    }

    renderAgents(container, agents) {
        // TODO: Implement agent rendering when cards are needed
        container.innerHTML = '<div class="info">Agents will be displayed here when implemented.</div>';
    }

    handleAddAgent() {
        // TODO: Implement Add Agent functionality
        console.log('Add Agent clicked - functionality to be implemented');
        alert('Add Agent functionality will be implemented soon!');
    }
}

// Define the custom element
customElements.define('viki-agents-canvas', VikiAgentsCanvas);

export default VikiAgentsCanvas;