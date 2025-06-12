import { BaseComponent } from '../base/base.js';

class VikiAgentsCanvas extends BaseComponent {
    constructor() {
        super('viki-agents-canvas');
        this.agents = [];
        this.availableTools = [];
        this.availableKnowledgeBases = [];
        this.selectedTools = new Set();
        this.selectedKnowledgeBases = new Set();
        this.editingAgent = null;
        // Track original relationships when editing an agent
        this.originalToolIds = new Set();
        this.originalKnowledgeBaseIds = new Set();
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners();
                await this.loadAgentsView();
            }
        } catch (error) {
            console.error('Error in VikiAgentsCanvas connectedCallback:', error);
        }
    }

    setupEventListeners() {
        // Will be called after connectedCallback - we set up listeners in setupAgentsViewEventListeners instead
    }

    setupAgentsViewEventListeners(contentArea) {
        const addBtn = contentArea.querySelector('#addAgentBtn');
        const modal = contentArea.querySelector('#agentModal');
        const closeBtn = contentArea.querySelector('#closeAgentModal');
        const cancelBtn = contentArea.querySelector('#cancelBtn');
        const form = contentArea.querySelector('#agentForm');
        const toolsSearch = contentArea.querySelector('#toolsSearch');
        const knowledgeBasesSearch = contentArea.querySelector('#knowledgeBasesSearch');

        // Add Agent button
        addBtn?.addEventListener('click', () => {
            this.openAgentModal(contentArea);
        });

        // Close modal buttons
        [closeBtn, cancelBtn].forEach(btn => {
            btn?.addEventListener('click', () => {
                this.closeAgentModal(contentArea);
            });
        });

        // Form submission
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(contentArea);
        });

        // Close modal on outside click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeAgentModal(contentArea);
            }
        });

        // Search functionality
        toolsSearch?.addEventListener('input', (e) => {
            this.filterTools(e.target.value);
        });

        knowledgeBasesSearch?.addEventListener('input', (e) => {
            this.filterKnowledgeBases(e.target.value);
        });
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
                <div class="loading">Loading Agents...</div>
            </div>
            
            <!-- Agent Modal -->
            <div id="agentModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Add Agent</h3>
                        <button class="close-btn" id="closeAgentModal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="agentForm">
                            <div class="form-group">
                                <label for="agentName">Name <span class="required">*</span></label>
                                <input type="text" id="agentName" name="name" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="agentDescription">Description <span class="required">*</span></label>
                                <textarea id="agentDescription" name="description" required rows="3"></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="agentModel">Model (LLM) <span class="required">*</span></label>
                                <select id="agentModel" name="llm_id" required>
                                    <option value="">Select a model...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="agentSystemPrompt">System Prompt</label>
                                <textarea id="agentSystemPrompt" name="system_prompt" rows="4" placeholder="Optional system prompt for the agent..."></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label>Tools</label>
                                <div class="search-container">
                                    <input type="text" id="toolsSearch" placeholder="Search tools..." class="search-input">
                                    <div id="toolsSearchResults" class="search-results"></div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>RAG Documents</label>
                                <div class="search-container">
                                    <input type="text" id="knowledgeBasesSearch" placeholder="Search documents..." class="search-input">
                                    <div id="knowledgeBasesSearchResults" class="search-results"></div>
                                </div>
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

        // Setup event listeners
        this.setupAgentsViewEventListeners(contentArea);
        
        // Load initial data
        await this.loadAgents(contentArea);
        await this.loadTools();
        await this.loadKnowledgeBases();
        await this.loadLLMConfigs();
    }

    async loadAgents(contentArea) {
        const agentsList = contentArea.querySelector('#agentsList');
        const canvasEmptyStateContainer = contentArea.querySelector('#canvasEmptyStateContainer');
        
        try {
            console.log('🚀 Fetching Agents from API...');
            
            const response = await window.apiMethods.get('/api/0.1.0/agents/', {
                baseUrl: 'http://localhost:8080'
            });
            
            console.log('📡 Agents API Response:', response);
            
            if (response.status === 200 && response.data) {
                this.agents = response.data;
                console.log(`✅ Found ${this.agents.length} Agents:`, this.agents);
                
                if (this.agents.length === 0) {
                    // Show empty state in canvas and hide agents list
                    canvasEmptyStateContainer.style.display = 'flex';
                    agentsList.style.display = 'none';
                } else {
                    // Hide empty state in canvas and show agents list
                    canvasEmptyStateContainer.style.display = 'none';
                    agentsList.style.display = 'grid';
                    this.renderAgentsCards(agentsList, this.agents);
                }
            } else {
                console.error('❌ Failed to fetch agents:', response);
                canvasEmptyStateContainer.style.display = 'none';
                agentsList.style.display = 'grid';
                agentsList.innerHTML = '<div class="error-state">Failed to load agents.</div>';
            }
        } catch (error) {
            console.error('Error loading agents:', error);
            canvasEmptyStateContainer.style.display = 'none';
            agentsList.style.display = 'grid';
            agentsList.innerHTML = '<div class="error-state">Failed to load agents. Make sure the API server is running at http://localhost:8080</div>';
        }
    }

    async loadTools() {
        try {
            console.log('🚀 Fetching Tools...');
            
            const response = await window.apiMethods.get('/api/0.1.0/tools/', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status === 200 && response.data) {
                this.availableTools = response.data;
                console.log(`✅ Found ${this.availableTools.length} Tools`);
                this.renderToolsSearch();
            }
        } catch (error) {
            console.error('Error loading tools:', error);
        }
    }

    async loadKnowledgeBases() {
        try {
            console.log('🚀 Fetching Knowledge Bases...');
            
            const response = await window.apiMethods.get('/api/0.1.0/knowledge-bases/', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status === 200 && response.data) {
                this.availableKnowledgeBases = response.data;
                console.log(`✅ Found ${this.availableKnowledgeBases.length} Knowledge Bases`);
                this.renderKnowledgeBasesSearch();
            }
        } catch (error) {
            console.error('Error loading knowledge bases:', error);
        }
    }

    async loadLLMConfigs() {
        try {
            console.log('🚀 Fetching LLM Configurations...');
            
            const response = await window.apiMethods.get('/api/0.1.0/llm/', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status === 200 && response.data) {
                const llmConfigs = response.data;
                console.log(`✅ Found ${llmConfigs.length} LLM Configurations`);
                
                // Store for later use when modal is opened
                this.llmConfigs = llmConfigs;
            }
        } catch (error) {
            console.error('Error loading LLM configurations:', error);
        }
    }

    populateLLMSelect(contentArea) {
        const llmSelect = contentArea.querySelector('#agentModel');
        if (llmSelect && this.llmConfigs) {
            llmSelect.innerHTML = '<option value="">Select a model...</option>';
            this.llmConfigs.forEach(config => {
                const option = document.createElement('option');
                option.value = config.id;
                option.textContent = `${config.providerTypeCode} - ${config.modelCode}`;
                llmSelect.appendChild(option);
            });
        }
    }

    renderAgentsCards(container, agents) {
        container.innerHTML = '';
        
        agents.forEach(agent => {
            const card = this.createAgentCard(agent);
            container.appendChild(card);
        });
        
        // After all cards are rendered, load icons safely
        setTimeout(() => {
            const iconImages = container.querySelectorAll('img[data-agent-name]');
            iconImages.forEach(img => this.loadAgentIconSafely(img));
        }, 0);
    }
    
    getAgentIcon(agentName) {
        const basePath = './ui/assets/agents/';
        
        if (!agentName) {
            return `<img src="${basePath}default.svg" alt="Agent" width="32" height="32">`;
        }
        
        // Clean the agent name to create a valid filename
        const cleanedAgentName = agentName.toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
            .trim();
        
        if (!cleanedAgentName) {
            return `<img src="${basePath}default.svg" alt="Agent" width="32" height="32">`;
        }
        
        // Create a unique ID for this icon to handle loading
        const iconId = `agent-icon-${cleanedAgentName}-${Date.now()}`;
        
        // Return an img element that will be properly handled with error management
        return `<img id="${iconId}" src="${basePath}default.svg" alt="${agentName}" width="32" height="32" data-agent-name="${cleanedAgentName}" data-base-path="${basePath}">`;
    }

    // Add this method to safely load agent icons without console errors
    async loadAgentIconSafely(imgElement) {
        const agentName = imgElement.dataset.agentName;
        const basePath = imgElement.dataset.basePath;
        
        if (!agentName || !basePath) {
            return; // Already using default
        }
        
        // List of known available agent icons (update this list when adding new icons)
        const availableIcons = new Set(['default']);
        
        // Only attempt to load if the icon is in our known list
        if (availableIcons.has(agentName)) {
            const iconUrl = `${basePath}${agentName}.svg`;
            imgElement.src = iconUrl;
        }
        // Otherwise, keep the default icon that's already loaded
    }

    createAgentCard(agent) {
        const card = document.createElement('div');
        card.className = 'agents-card';
        
        // Truncate agent description if longer than 16 characters
        const originalDescription = agent.description || '';
        const displayDescription = originalDescription.length > 16 
            ? originalDescription.substring(0, 16) + '..'
            : originalDescription;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-main-content">
                    <div class="provider-icon">
                        ${this.getAgentIcon(agent.name)}
                    </div>
                    <div class="card-info">
                        <h3 class="model-name">${agent.name}</h3>
                        <p class="provider-name" title="${originalDescription}">${displayDescription}</p>
                        <div class="agent-info">
                            <div class="agent-counts" id="agent-counts-${agent.id}">
                                <span class="loading-counts">Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-edit" onclick="this.getRootNode().host.editAgent('${agent.id}')" title="Edit">
                        <img src="./ui/assets/icons/edit.svg" alt="Edit" width="16" height="16">
                    </button>
                    <button class="btn-icon btn-delete" onclick="this.getRootNode().host.deleteAgent('${agent.id}')" title="Delete">
                        <img src="./ui/assets/icons/delete.svg" alt="Delete" width="16" height="16">
                    </button>
                </div>
            </div>
        `;
        
        // Load agent relationship counts asynchronously
        this.loadAgentCounts(agent.id);
        
        return card;
    }

    async loadAgentCounts(agentId) {
        try {
            let toolsCount = 0;
            let ragCount = 0;

            // Load agent tools count
            const toolsResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/tools', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (toolsResponse.status === 200) {
                const agentTools = toolsResponse.data.filter(at => at.agent === agentId);
                toolsCount = agentTools.length;
            }

            // Load agent knowledge bases count
            const kbResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/knowledge-bases', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (kbResponse.status === 200) {
                const agentKBs = kbResponse.data.filter(akb => akb.agent === agentId);
                ragCount = agentKBs.length;
            }

            // Update the display
            this.updateAgentCountsDisplay(agentId, toolsCount, ragCount);

        } catch (error) {
            console.error('Error loading agent counts:', error);
            // Show error state
            this.updateAgentCountsDisplay(agentId, 0, 0, true);
        }
    }

    updateAgentCountsDisplay(agentId, toolsCount, ragCount, hasError = false) {
        const countsElement = this.shadowRoot.querySelector(`#agent-counts-${agentId}`);
        if (countsElement) {
            if (hasError) {
                countsElement.innerHTML = '<span class="error-counts">Error loading counts</span>';
            } else {
                countsElement.innerHTML = `
                    <div class="tools-count">
                        <img src="./ui/assets/icons/database.svg" alt="Tools" width="16" height="16">
                        <span>${toolsCount} Tools</span>
                    </div>
                    <div class="rag-count">
                        <img src="./ui/assets/icons/file.svg" alt="RAG" width="16" height="16">
                        <span>${ragCount} RAG</span>
                    </div>
                `;
            }
        }
    }

    renderToolsSearch() {
        const toolsResults = this.shadowRoot.querySelector('#toolsSearchResults');
        if (!toolsResults) return;

        if (this.availableTools.length === 0) {
            toolsResults.innerHTML = '<div class="no-results">No tools available</div>';
            return;
        }

        this.displayTools(this.availableTools);
    }

    renderKnowledgeBasesSearch() {
        const kbResults = this.shadowRoot.querySelector('#knowledgeBasesSearchResults');
        if (!kbResults) return;

        if (this.availableKnowledgeBases.length === 0) {
            kbResults.innerHTML = '<div class="no-results">No knowledge bases available</div>';
            return;
        }

        this.displayKnowledgeBases(this.availableKnowledgeBases);
    }

    displayTools(tools) {
        const toolsResults = this.shadowRoot.querySelector('#toolsSearchResults');
        
        const toolsHTML = tools.map(tool => `
            <div class="search-item">
                <div class="search-item-label">
                    <div class="search-item-content">
                        <div class="search-item-name">${tool.name}</div>
                        <div class="search-item-description">${tool.description || 'MCP Tool'}</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" class="tool-checkbox" data-tool-id="${tool.id}" 
                               ${this.selectedTools.has(tool.id) ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `).join('');

        toolsResults.innerHTML = toolsHTML;

        // Add event listeners
        toolsResults.querySelectorAll('.tool-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const toolId = e.target.dataset.toolId;
                if (e.target.checked) {
                    this.selectedTools.add(toolId);
                } else {
                    this.selectedTools.delete(toolId);
                }
            });
        });
    }

    displayKnowledgeBases(knowledgeBases) {
        const kbResults = this.shadowRoot.querySelector('#knowledgeBasesSearchResults');
        
        const kbHTML = knowledgeBases.map(kb => `
            <div class="search-item">
                <div class="search-item-label">
                    <div class="search-item-content">
                        <div class="search-item-name">${kb.name}</div>
                        <div class="search-item-description">${kb.description || 'Knowledge Base'}</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" class="kb-checkbox" data-kb-id="${kb.id}" 
                               ${this.selectedKnowledgeBases.has(kb.id) ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `).join('');

        kbResults.innerHTML = kbHTML;

        // Add event listeners
        kbResults.querySelectorAll('.kb-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const kbId = e.target.dataset.kbId;
                if (e.target.checked) {
                    this.selectedKnowledgeBases.add(kbId);
                } else {
                    this.selectedKnowledgeBases.delete(kbId);
                }
            });
        });
    }

    filterTools(searchTerm) {
        const filteredTools = this.availableTools.filter(tool =>
            tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (tool.description && tool.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        this.displayTools(filteredTools);
    }

    filterKnowledgeBases(searchTerm) {
        const filteredKBs = this.availableKnowledgeBases.filter(kb =>
            kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        this.displayKnowledgeBases(filteredKBs);
    }

    openAgentModal(contentArea, agent = null) {
        const modal = contentArea.querySelector('#agentModal');
        const form = contentArea.querySelector('#agentForm');
        const modalTitle = contentArea.querySelector('#modalTitle');

        // Populate LLM select
        this.populateLLMSelect(contentArea);

        // Clear previous selections
        this.selectedTools.clear();
        this.selectedKnowledgeBases.clear();
        this.originalToolIds.clear();
        this.originalKnowledgeBaseIds.clear();
        this.editingAgent = agent;

        if (agent) {
            // Edit mode
            modalTitle.textContent = 'Edit Agent';
            form.querySelector('#agentName').value = agent.name || '';
            form.querySelector('#agentDescription').value = agent.description || '';
            form.querySelector('#agentModel').value = agent.llmConfig || '';
            form.querySelector('#agentSystemPrompt').value = agent.systemPrompt || '';
            
            // Load existing relationships
            this.loadAgentRelationships(agent.id);
        } else {
            // Add mode
            modalTitle.textContent = 'Add Agent';
            form.reset();
        }

        modal.style.display = 'flex';
    }

    closeAgentModal(contentArea) {
        const modal = contentArea.querySelector('#agentModal');
        const form = contentArea.querySelector('#agentForm');
        
        modal.style.display = 'none';
        form.reset();
        this.selectedTools.clear();
        this.selectedKnowledgeBases.clear();
        this.editingAgent = null;

        // Reset checkboxes
        this.renderToolsSearch();
        this.renderKnowledgeBasesSearch();
    }

    async loadAgentRelationships(agentId) {
        try {
            console.log(`🔄 Loading agent relationships for agent: ${agentId}`);
            
            // Load agent tools
            const toolsResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/tools', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (toolsResponse.status === 200) {
                const agentTools = toolsResponse.data.filter(at => at.agent === agentId);
                console.log(`🔧 Found ${agentTools.length} existing tool relationships:`, agentTools);
                
                // Store both selected and original relationships
                agentTools.forEach(at => {
                    this.selectedTools.add(at.tool);
                    this.originalToolIds.add(at.tool);
                });
            }

            // Load agent knowledge bases
            const kbResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/knowledge-bases', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (kbResponse.status === 200) {
                const agentKBs = kbResponse.data.filter(akb => akb.agent === agentId);
                console.log(`📚 Found ${agentKBs.length} existing knowledge base relationships:`, agentKBs);
                
                // Store both selected and original relationships
                agentKBs.forEach(akb => {
                    this.selectedKnowledgeBases.add(akb.knowledgeBase);
                    this.originalKnowledgeBaseIds.add(akb.knowledgeBase);
                });
            }

            console.log(`📊 Current selected tools:`, Array.from(this.selectedTools));
            console.log(`📊 Current selected KBs:`, Array.from(this.selectedKnowledgeBases));

            // Update displays
            this.renderToolsSearch();
            this.renderKnowledgeBasesSearch();
        } catch (error) {
            console.error('Error loading agent relationships:', error);
        }
    }

    async handleFormSubmit(contentArea) {
        const form = contentArea.querySelector('#agentForm');
        const formData = new FormData(form);
        
        // Save button to show loading state
        const saveBtn = form.querySelector('#saveBtn');
        const originalSaveBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        const agentData = {
            name: formData.get('name'),
            description: formData.get('description'),
            llmConfig: formData.get('llm_id'),
            systemPrompt: formData.get('system_prompt') || null
        };

        try {
            let response;
            let agentId;

            if (this.editingAgent) {
                // Update existing agent
                agentId = this.editingAgent.id;
                response = await window.apiMethods.put(`/api/0.1.0/agents/${agentId}`, agentData, {
                    baseUrl: 'http://localhost:8080'
                });
            } else {
                // Create new agent
                response = await window.apiMethods.post('/api/0.1.0/agents/', agentData, {
                    baseUrl: 'http://localhost:8080'
                });
                if (response.status >= 200 && response.status < 300) {
                    agentId = response.data.id;
                }
            }

            if (response.status >= 200 && response.status < 300 && agentId) {
                // Save relationships
                await this.saveAgentRelationships(agentId);
                
                this.closeAgentModal(contentArea);
                await this.loadAgents(contentArea);
                
                alert(this.editingAgent ? 'Agent updated successfully!' : 'Agent created successfully!');
            } else {
                alert('Failed to save agent');
            }
        } catch (error) {
            console.error('Error saving agent:', error);
            alert('Failed to save agent: ' + error.message);
        } finally {
            // Reset save button
            saveBtn.textContent = originalSaveBtnText;
            saveBtn.disabled = false;
        }
    }

    async saveAgentRelationships(agentId) {
        try {
            // When editing an agent, we need to handle both adding and removing relationships
            
            // 1. Get current relationships to determine what needs to be removed
            let currentToolIds = new Set();
            let currentKnowledgeBaseIds = new Set();
            
            if (this.editingAgent) {
                // Load current relationships from the server
                const toolsResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/tools', {
                    baseUrl: 'http://localhost:8080'
                });
                
                if (toolsResponse.status === 200) {
                    const agentTools = toolsResponse.data.filter(at => at.agent === agentId);
                    agentTools.forEach(at => currentToolIds.add(at.tool));
                }

                const kbResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/knowledge-bases', {
                    baseUrl: 'http://localhost:8080'
                });
                
                if (kbResponse.status === 200) {
                    const agentKBs = kbResponse.data.filter(akb => akb.agent === agentId);
                    agentKBs.forEach(akb => currentKnowledgeBaseIds.add(akb.knowledgeBase));
                }
            }

            // 2. Remove relationships that are no longer selected
            for (const toolId of currentToolIds) {
                if (!this.selectedTools.has(toolId)) {
                    try {
                        await window.apiMethods.delete(`/api/0.1.0/agent-relationships/tools/${agentId}/${toolId}`, {
                            baseUrl: 'http://localhost:8080'
                        });
                        console.log(`✅ Removed tool relationship: ${toolId}`);
                    } catch (error) {
                        if (error.status !== 404) { // Ignore if relationship doesn't exist
                            console.warn(`Failed to remove tool relationship ${toolId}:`, error);
                        }
                    }
                }
            }

            for (const kbId of currentKnowledgeBaseIds) {
                if (!this.selectedKnowledgeBases.has(kbId)) {
                    try {
                        await window.apiMethods.delete(`/api/0.1.0/agent-relationships/knowledge-bases/${agentId}/${kbId}`, {
                            baseUrl: 'http://localhost:8080'
                        });
                        console.log(`✅ Removed knowledge base relationship: ${kbId}`);
                    } catch (error) {
                        if (error.status !== 404) { // Ignore if relationship doesn't exist
                            console.warn(`Failed to remove knowledge base relationship ${kbId}:`, error);
                        }
                    }
                }
            }

            // 3. Add new tool relationships
            for (const toolId of this.selectedTools) {
                try {
                    await window.apiMethods.post('/api/0.1.0/agent-relationships/tools', {
                        agent: agentId,
                        tool: toolId
                    }, {
                        baseUrl: 'http://localhost:8080'
                    });
                    console.log(`✅ Added tool relationship: ${toolId}`);
                } catch (error) {
                    if (error.status !== 400) { // Ignore if already exists
                        throw error;
                    }
                }
            }

            // 4. Add new knowledge base relationships
            for (const kbId of this.selectedKnowledgeBases) {
                try {
                    await window.apiMethods.post('/api/0.1.0/agent-relationships/knowledge-bases', {
                        agent: agentId,
                        knowledgeBase: kbId
                    }, {
                        baseUrl: 'http://localhost:8080'
                    });
                    console.log(`✅ Added knowledge base relationship: ${kbId}`);
                } catch (error) {
                    if (error.status !== 400) { // Ignore if already exists
                        throw error;
                    }
                }
            }

            console.log('✅ Agent relationships saved successfully');
        } catch (error) {
            console.error('❌ Failed to save agent relationships:', error);
        }
    }

    async editAgent(agentId) {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            this.openAgentModal(contentArea, agent);
        }
    }

    async deleteAgent(agentId) {
        if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await window.apiMethods.delete(`/api/0.1.0/agents/${agentId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                const contentArea = this.shadowRoot.querySelector('.canvas-content');
                await this.loadAgents(contentArea);
                alert('Agent deleted successfully!');
            } else {
                alert('Failed to delete agent');
            }
        } catch (error) {
            console.error('Error deleting agent:', error);
            alert('Failed to delete agent: ' + error.message);
        }
    }
}

// Define the custom element
customElements.define('viki-agents-canvas', VikiAgentsCanvas);

export default VikiAgentsCanvas;