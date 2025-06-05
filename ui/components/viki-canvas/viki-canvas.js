import { BaseComponent } from '../base/base.js';
import '../viki-card/viki-card.js';
import { get, post, put, delete as deleteRequest } from '../../script/api-client.js';

class VikiCanvas extends BaseComponent {
    constructor() {
        super('viki-canvas');
        this.currentView = 'llm'; // Default view
        this.providers = []; // Store providers data for display purposes
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                // Load default view (LLM)
                await this.loadView(shadowRoot, 'llm');
            }
        } catch (error) {
            console.error('Error in VikiCanvas connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for canvas-specific functionality can be added here
        // Navigation changes are now handled directly via loadView method calls
    }

    async loadView(shadowRoot, viewType) {
        console.log('Loading view:', viewType);
        this.currentView = viewType;
        const contentArea = shadowRoot.querySelector('.canvas-content');
        
        if (!contentArea) {
            console.error('Content area not found');
            return;
        }

        switch (viewType) {
            case 'llm':
                await this.loadLLMView(contentArea);
                break;
            case 'tools':
                this.loadToolsView(contentArea);
                break;
            case 'rag':
                this.loadRAGView(contentArea);
                break;
            case 'agents':
                this.loadAgentsView(contentArea);
                break;
            case 'chat':
                this.loadChatView(contentArea);
                break;
            default:
                this.loadDefaultView(contentArea);
        }
    }

    async loadLLMView(contentArea) {
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>LLM Management</h2>
                <button class="btn-primary add-llm-btn" id="addLLMBtn">
                    <span>+</span> Add LLM
                </button>
            </div>
            <div class="llm-list" id="llmList">
                <div class="loading">Loading LLMs...</div>
            </div>
            <div class="llm-modal" id="llmModal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Add LLM Configuration</h3>
                        <button class="close-btn" id="closeModalBtn">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="llmForm">
                            <div class="form-group">
                                <label for="provider">Provider <span class="required">*</span></label>
                                <select id="provider" name="provider" required>
                                    <option value="">Loading providers...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="model">Model <span class="required">*</span></label>
                                <input type="text" id="model" name="model" required placeholder="e.g., gpt-4, claude-3-opus">
                            </div>
                            <div class="form-group">
                                <label for="endpoint">Endpoint URL</label>
                                <input type="url" id="endpoint" name="endpoint" placeholder="https://api.openai.com/v1">
                            </div>
                            <div class="form-group">
                                <label for="apiKey">API Key</label>
                                <input type="password" id="apiKey" name="apiKey" placeholder="Enter your API key">
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
                                <button type="submit" class="btn-primary" id="saveBtn">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Setup LLM view event listeners
        this.setupLLMViewEventListeners(contentArea);
        
        // Load existing LLMs
        await this.loadLLMs(contentArea);
        
        // Load providers for the dropdown
        await this.loadProviders(contentArea);
    }

    setupLLMViewEventListeners(contentArea) {
        const addBtn = contentArea.querySelector('#addLLMBtn');
        const modal = contentArea.querySelector('#llmModal');
        const closeBtn = contentArea.querySelector('#closeModalBtn');
        const cancelBtn = contentArea.querySelector('#cancelBtn');
        const form = contentArea.querySelector('#llmForm');

        // Add LLM button
        addBtn?.addEventListener('click', async () => {
            await this.openLLMModal(contentArea);
        });

        // Close modal buttons
        [closeBtn, cancelBtn].forEach(btn => {
            btn?.addEventListener('click', () => {
                this.closeLLMModal(contentArea);
            });
        });

        // Form submission
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLLMFormSubmit(contentArea);
        });

        // Close modal on outside click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeLLMModal(contentArea);
            }
        });
    }

    async loadLLMs(contentArea) {
        const llmList = contentArea.querySelector('#llmList');
        
        try {
            console.log('🚀 Fetching LLMs from API...');
            
            // Use api-client to fetch LLMs from the correct endpoint
            const response = await get('/api/0.1.0/llm/', {
                baseUrl: 'http://localhost:8080'
            });
            
            console.log('📡 API Response:', response);
            
            if (response.status === 200 && response.data) {
                const llms = response.data;
                console.log(`✅ Found ${llms.length} LLMs:`, llms);
                
                if (llms.length === 0) {
                    llmList.innerHTML = '<div class="empty-state">No LLM configurations found. Click "Add LLM" to create your first configuration.</div>';
                } else {
                    this.renderLLMCards(llmList, llms);
                }
            } else {
                console.error('❌ Unexpected response:', response);
                llmList.innerHTML = '<div class="error-state">Failed to load LLM configurations.</div>';
            }
        } catch (error) {
            console.error('💥 Error loading LLMs:', error);
            llmList.innerHTML = '<div class="error-state">Failed to load LLM configurations. Make sure the API server is running at http://localhost:8080</div>';
        }
    }

    async loadProviders(contentArea) {
        const providerSelect = contentArea.querySelector('#provider');
        
        if (!providerSelect) {
            console.warn('Provider select element not found');
            return;
        }
        
        try {
            console.log('🚀 Fetching providers from API...');
            
            // Use api-client to fetch providers from the lookup endpoint
            const response = await get('/api/0.1.0/lookups/details/PROVIDER_TYPE_CD', {
                baseUrl: 'http://localhost:8080'
            });
            
            console.log('📡 Provider API Response:', response);
            
            if (response.status === 200 && response.data) {
                const providers = response.data;
                console.log(`✅ Found ${providers.length} providers:`, providers);
                
                // Store providers data for later use
                this.providers = providers;
                
                // Clear the loading option
                providerSelect.innerHTML = '<option value="">Select Provider</option>';
                
                // Sort providers by sortOrder if available, otherwise by description
                const sortedProviders = providers.sort((a, b) => {
                    if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
                        return a.sortOrder - b.sortOrder;
                    }
                    return (a.description || a.code || '').localeCompare(b.description || b.code || '');
                });
                
                // Add provider options
                sortedProviders.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.code; // Store the code as value
                    option.textContent = provider.description || provider.code; // Display the description
                    providerSelect.appendChild(option);
                });
                
            } else {
                console.error('❌ Unexpected provider response:', response);
                providerSelect.innerHTML = '<option value="">Failed to load providers</option>';
            }
        } catch (error) {
            console.error('💥 Error loading providers:', error);
            providerSelect.innerHTML = '<option value="">Failed to load providers</option>';
        }
    }

    renderLLMCards(container, llms) {
        container.innerHTML = '';
        
        llms.forEach(llm => {
            const card = this.createLLMCard(llm);
            container.appendChild(card);
        });
    }

    getProviderIcon(provider) {
        switch(provider?.toUpperCase()) {
            case 'OPENAI':
                return '🤖';
            case 'ANTHROPIC':
            case 'CLAUDE':
                return '🧠';
            case 'HUGGINGFACE':
                return '🤗';
            case 'OLLAMA':
                return '🦙';
            case 'GROQ':
                return '⚡';
            case 'AZURE':
                return '☁️';
            case 'GOOGLE':
                return '🔍';
            case 'OPENROUTER':
                return '🛣️';
            case 'CEREBRAS':
                return '🧩';
            case 'ORACLE':
                return '🔮';
            default:
                return '🔧'; // Generic AI/tool icon for unknown providers
        }
    }

    getProviderDescription(providerCode) {
        const provider = this.providers.find(p => p.code === providerCode);
        return provider ? provider.description || providerCode : providerCode;
    }

    createLLMCard(llm) {
        const card = document.createElement('div');
        card.className = 'llm-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">
                    <div class="provider-icon">${this.getProviderIcon(llm.providerTypeCode)}</div>
                    <div class="title-text">
                        <h4>${llm.modelCode || 'Unknown Model'}</h4>
                        <span class="card-subtitle">${this.getProviderDescription(llm.providerTypeCode)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon edit-btn" data-llm-id="${llm.id}" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete-btn" data-llm-id="${llm.id}" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <div class="info-item">
                        <span class="info-label">Endpoint:</span>
                        <span class="info-value">${llm.endpointUrl || 'Default'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">API Key:</span>
                        <span class="info-value">${llm.apiKey ? '✅ Configured' : '❌ Not set'}</span>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for card actions
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        editBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.editLLM(llm);
        });

        deleteBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteLLM(llm.id);
        });

        return card;
    }

    async openLLMModal(contentArea, llm = null) {
        const modal = contentArea.querySelector('#llmModal');
        const form = contentArea.querySelector('#llmForm');
        const title = contentArea.querySelector('#modalTitle');

        // Load providers first to ensure the dropdown is populated
        await this.loadProviders(contentArea);

        if (llm) {
            // Edit mode
            title.textContent = 'Edit LLM Configuration';
            const providerSelect = form.querySelector('#provider');
            const modelInput = form.querySelector('#model');
            const endpointInput = form.querySelector('#endpoint');
            const apiKeyInput = form.querySelector('#apiKey');
            
            if (providerSelect) providerSelect.value = llm.providerTypeCode;
            if (modelInput) modelInput.value = llm.modelCode;
            if (endpointInput) endpointInput.value = llm.endpointUrl || '';
            if (apiKeyInput) apiKeyInput.value = llm.apiKey || '';
            form.dataset.llmId = llm.id;
        } else {
            // Add mode
            title.textContent = 'Add LLM Configuration';
            form.reset();
            delete form.dataset.llmId;
        }

        modal.style.display = 'flex';
    }

    closeLLMModal(contentArea) {
        const modal = contentArea.querySelector('#llmModal');
        modal.style.display = 'none';
    }

    async handleLLMFormSubmit(contentArea) {
        const form = contentArea.querySelector('#llmForm');
        const formData = new FormData(form);
        const isEdit = form.dataset.llmId;

        const llmData = {
            providerTypeCode: formData.get('provider'),
            modelCode: formData.get('model'),
            endpointUrl: formData.get('endpoint') || null,
            apiKey: formData.get('apiKey') || null
        };

        try {
            let response;
            const baseUrl = 'http://localhost:8080';
            
            if (isEdit) {
                response = await put(`/api/0.1.0/llm/${form.dataset.llmId}`, llmData, {
                    baseUrl: baseUrl
                });
            } else {
                response = await post('/api/0.1.0/llm/', llmData, {
                    baseUrl: baseUrl
                });
            }

            if (response.status >= 200 && response.status < 300) {
                this.closeLLMModal(contentArea);
                await this.loadLLMs(contentArea);
            } else {
                alert('Failed to save LLM configuration');
            }
        } catch (error) {
            console.error('Error saving LLM:', error);
            alert('Failed to save LLM configuration');
        }
    }

    async editLLM(llm) {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        await this.openLLMModal(contentArea, llm);
    }

    async deleteLLM(llmId) {
        if (!confirm('Are you sure you want to delete this LLM configuration?')) {
            return;
        }

        try {
            const response = await deleteRequest(`/api/0.1.0/llm/${llmId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                const contentArea = this.shadowRoot.querySelector('.canvas-content');
                await this.loadLLMs(contentArea);
            } else {
                alert('Failed to delete LLM configuration');
            }
        } catch (error) {
            console.error('Error deleting LLM:', error);
            alert('Failed to delete LLM configuration');
        }
    }

    loadToolsView(contentArea) {
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Tools Management</h2>
            </div>
            <p>Tools management interface coming soon...</p>
        `;
    }

    loadRAGView(contentArea) {
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>RAG Management</h2>
            </div>
            <p>RAG management interface coming soon...</p>
        `;
    }

    loadAgentsView(contentArea) {
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Agents Management</h2>
            </div>
            <p>Agents management interface coming soon...</p>
        `;
    }

    loadChatView(contentArea) {
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Chat Interface</h2>
            </div>
            <p>Chat interface coming soon...</p>
        `;
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

// Register the custom element
customElements.define('viki-canvas', VikiCanvas);