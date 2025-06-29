import { BaseComponent } from '../base/base.js';

class VikiToolsCanvas extends BaseComponent {
    constructor() {
        super('viki-tools-canvas');
        this.tools = []; // Store tools data for display purposes
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                await this.loadToolsView();
            }
        } catch (error) {
            console.error('Error in VikiToolsCanvas connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for Tools canvas specific functionality
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.resources-dropdown')) {
                this.closeAllResourcesDropdowns();
            }
        });
    }

    async loadToolsView() {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Tools</h2>
                <button class="btn-primary add-tools-btn" id="addToolsBtn">
                    <span>+</span> Add Tool
                </button>
            </div>
            <div class="canvas-empty-state-container" id="canvasEmptyStateContainer" style="display: none;">
                <div class="canvas-empty-state">
                    No tool configurations found. Click "Add Tool" to create your first configuration.
                </div>
            </div>
            <div class="tools-list" id="toolsList">
                <div class="loading">Loading Tools...</div>
            </div>
            <div class="tools-modal" id="toolsModal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Add Tool Configuration</h3>
                        <button class="close-btn" id="closeModalBtn">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="toolsForm">
                            <div class="form-group">
                                <label for="name">Name <span class="required">*</span></label>
                                <input type="text" id="name" name="name" required placeholder="e.g., Weather API, Database Connection">
                            </div>
                            <div class="form-group">
                                <label for="description">Description</label>
                                <textarea id="description" name="description" placeholder="Enter tool description" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="mcpCommand">MCP Command <span class="required">*</span></label>
                                <input type="text" id="mcpCommand" name="mcpCommand" required placeholder="e.g., uv run openapi_mcp_server">
                            </div>
                            <div class="form-section">
                                <div class="env-variables-header">
                                    <label class="section-label">Environment Variables</label>
                                    <button type="button" class="btn-add-variable" id="addEnvBtn">
                                        Add Variable
                                    </button>
                                </div>
                                <div class="env-variables-container">
                                    <div class="env-variables-list" id="envVariablesList">
                                        <!-- Environment variables will be dynamically added here -->
                                    </div>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
                                <button type="button" class="btn-secondary" id="testMcpBtn">Test MCP</button>
                                <button type="submit" class="btn-primary" id="saveBtn">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Setup Tools view event listeners
        this.setupToolsViewEventListeners(contentArea);
        
        // Load existing Tools
        await this.loadTools(contentArea);
    }

    setupToolsViewEventListeners(contentArea) {
        const addBtn = contentArea.querySelector('#addToolsBtn');
        const modal = contentArea.querySelector('#toolsModal');
        const closeBtn = contentArea.querySelector('#closeModalBtn');
        const cancelBtn = contentArea.querySelector('#cancelBtn');
        const form = contentArea.querySelector('#toolsForm');
        const addEnvBtn = contentArea.querySelector('#addEnvBtn');
        const testMcpBtn = contentArea.querySelector('#testMcpBtn');

        // Add Tool button
        addBtn?.addEventListener('click', async () => {
            await this.openToolsModal(contentArea);
        });

        // Close modal buttons
        [closeBtn, cancelBtn].forEach(btn => {
            btn?.addEventListener('click', () => {
                this.closeToolsModal(contentArea);
            });
        });

        // Form submission
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleToolsFormSubmit(contentArea);
        });

        // Test MCP button
        testMcpBtn?.addEventListener('click', async () => {
            await this.handleTestMcp(contentArea);
        });

        // Add environment variable button
        addEnvBtn?.addEventListener('click', () => {
            this.addEnvironmentVariable(contentArea);
        });

        // Close modal on outside click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeToolsModal(contentArea);
            }
        });
    }

    async loadTools(contentArea) {
        const toolsList = contentArea.querySelector('#toolsList');
        const canvasEmptyStateContainer = contentArea.querySelector('#canvasEmptyStateContainer');
        
        try {
            console.log('🚀 Fetching Tools from API...');
            
            // Use global API methods to fetch Tools from the correct endpoint
            const response = await window.apiMethods.get('/api/0.1.0/tools/', {
                baseUrl: 'http://localhost:8080'
            });
            
            console.log('📡 API Response:', response);
            
            if (response.status === 200 && response.data) {
                const tools = response.data;
                console.log(`✅ Found ${tools.length} Tools:`, tools);
                
                if (tools.length === 0) {
                    // Show empty state in canvas and hide Tools list
                    canvasEmptyStateContainer.style.display = 'flex';
                    toolsList.style.display = 'none';
                } else {
                    // Hide empty state in canvas and show Tools list
                    canvasEmptyStateContainer.style.display = 'none';
                    toolsList.style.display = 'grid';
                    this.renderToolsCards(toolsList, tools);
                }
            } else {
                console.error('❌ Unexpected response:', response);
                canvasEmptyStateContainer.style.display = 'none';
                toolsList.style.display = 'grid';
                toolsList.innerHTML = '<div class="error-state">Failed to load tool configurations.</div>';
            }
        } catch (error) {
            console.error('💥 Error loading Tools:', error);
            canvasEmptyStateContainer.style.display = 'none';
            toolsList.style.display = 'grid';
            toolsList.innerHTML = '<div class="error-state">Failed to load tool configurations. Make sure the API server is running at http://localhost:8080</div>';
        }
    }

    renderToolsCards(container, tools) {
        container.innerHTML = '';
        
        tools.forEach(tool => {
            const card = this.createToolsCard(tool);
            container.appendChild(card);
        });
        
        // After all cards are rendered, load icons safely
        setTimeout(() => {
            const iconImages = container.querySelectorAll('img[data-tool-name]');
            iconImages.forEach(img => this.loadToolIconSafely(img));
        }, 0);
    }

    getToolsIcon(toolName) {
        const basePath = './ui/assets/tools/';
        
        if (!toolName) {
            return `<img src="${basePath}default.svg" alt="Tool" width="32" height="32">`;
        }
        
        // Clean the tool name to create a valid filename
        const cleanedToolName = toolName.toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
            .trim();
        
        if (!cleanedToolName) {
            return `<img src="${basePath}default.svg" alt="Tool" width="32" height="32">`;
        }
        
        // Create a unique ID for this icon to handle loading
        const iconId = `tool-icon-${cleanedToolName}-${Date.now()}`;
        
        // Return an img element that will be properly handled with error management
        return `<img id="${iconId}" src="${basePath}default.svg" alt="${toolName}" width="32" height="32" data-tool-name="${cleanedToolName}" data-base-path="${basePath}">`;
    }

    // Add this method to safely load tool icons without console errors
    async loadToolIconSafely(imgElement) {
        const toolName = imgElement.dataset.toolName;
        const basePath = imgElement.dataset.basePath;
        
        if (!toolName || !basePath) {
            return; // Already using default
        }
        
        // List of known available tool icons (update this list when adding new icons)
        const availableIcons = new Set(['default']);
        
        // Only attempt to load if the icon is in our known list
        if (availableIcons.has(toolName)) {
            const iconUrl = `${basePath}${toolName}.svg`;
            imgElement.src = iconUrl;
        }
        // Otherwise, keep the default icon that's already loaded
    }

    createToolsCard(tool) {
        const card = document.createElement('div');
        card.className = 'tools-card';
        
        // Truncate tool description if longer than 16 characters
        const originalDescription = tool.description || 'MCP Tool';
        const displayDescription = originalDescription.length > 16 
            ? originalDescription.substring(0, 16) + '..'
            : originalDescription;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-main-content" style="cursor: pointer;">
                    <div class="provider-icon">
                        ${this.getToolsIcon(tool.name)}
                    </div>
                    <div class="card-info">
                        <h3 class="model-name">${tool.name}</h3>
                        <p class="provider-name" title="${originalDescription}">${displayDescription}</p>
                        <div class="function-count">
                            <div class="tools-count">
                                <img src="./ui/assets/icons/database.svg" alt="Functions" width="16" height="16">
                                <span>${tool.mcpFunctionCount || 0} Tools</span>
                            </div>
                            <div class="resources-dropdown">
                                <button class="resources-dropdown-btn" onclick="this.getRootNode().host.toggleResourcesDropdown(event, '${tool.id}')" title="View Resources">
                                    <span class="dropdown-label" id="dropdown-label-${tool.id}">Tools List</span>
                                    <span class="dropdown-arrow">▼</span>
                                </button>
                                <div class="resources-dropdown-content" id="resources-${tool.id}" style="display: none;">
                                    <div class="loading-resources">Loading resources...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-edit" onclick="this.getRootNode().host.editTool(${JSON.stringify(tool).replace(/"/g, '&quot;')})" title="Edit">
                        <img src="./ui/assets/icons/edit.svg" alt="Edit" width="16" height="16">
                    </button>
                    <button class="btn-icon btn-delete" onclick="this.getRootNode().host.deleteTool('${tool.id}')" title="Delete">
                        <img src="./ui/assets/icons/delete.svg" alt="Delete" width="16" height="16">
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }

    async openToolsModal(contentArea, tool = null) {
        const modal = contentArea.querySelector('#toolsModal');
        const form = contentArea.querySelector('#toolsForm');
        const title = contentArea.querySelector('#modalTitle');

        if (tool) {
            // Edit mode
            title.textContent = 'Edit Tool Configuration';
            const nameInput = form.querySelector('#name');
            const descriptionInput = form.querySelector('#description');
            const mcpCommandInput = form.querySelector('#mcpCommand');
            
            if (nameInput) nameInput.value = tool.name || '';
            if (descriptionInput) descriptionInput.value = tool.description || '';
            if (mcpCommandInput) mcpCommandInput.value = tool.mcpCommand || '';
            form.dataset.toolId = tool.id;

            // Load existing environment variables (handle errors gracefully)
            try {
                await this.loadToolEnvironmentVariables(tool.id, contentArea);
            } catch (error) {
                console.log('Could not load environment variables for tool:', tool.id);
                // Clear environment variables as fallback
                this.clearEnvironmentVariables(contentArea);
            }
        } else {
            // Add mode
            title.textContent = 'Add Tool Configuration';
            form.reset();
            delete form.dataset.toolId;
            
            // Clear environment variables
            this.clearEnvironmentVariables(contentArea);
        }

        modal.style.display = 'flex';
    }

    closeToolsModal(contentArea) {
        const modal = contentArea.querySelector('#toolsModal');
        modal.style.display = 'none';
        
        // Clear form
        const form = contentArea.querySelector('#toolsForm');
        form.reset();
        delete form.dataset.toolId;
        
        // Clear environment variables
        this.clearEnvironmentVariables(contentArea);
    }

    async handleToolsFormSubmit(contentArea) {
        const form = contentArea.querySelector('#toolsForm');
        const formData = new FormData(form);
        const isEdit = form.dataset.toolId;

        // Save button to show loading state
        const saveBtn = form.querySelector('#saveBtn');
        const originalSaveBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        const toolData = {
            name: formData.get('name'),
            description: formData.get('description') || null,
            mcpCommand: formData.get('mcpCommand')
        };

        try {
            let response;
            const baseUrl = 'http://localhost:8080';
            let toolId;
            
            if (isEdit) {
                toolId = form.dataset.toolId;
                response = await window.apiMethods.put(`/api/0.1.0/tools/${toolId}`, toolData, {
                    baseUrl: baseUrl
                });
            } else {
                response = await window.apiMethods.post('/api/0.1.0/tools/', toolData, {
                    baseUrl: baseUrl
                });
                if (response.status >= 200 && response.status < 300) {
                    toolId = response.data.id;
                }
            }

            if (response.status >= 200 && response.status < 300 && toolId) {
                // Save environment variables
                await this.saveEnvironmentVariables(toolId, contentArea);
                
                // Test MCP configuration and update function count
                saveBtn.textContent = 'Testing MCP...';
                try {
                    const testResponse = await window.apiMethods.post(`/api/0.1.0/tools/${toolId}/test-mcp`, {}, {
                        baseUrl: baseUrl
                    });
                    
                    if (testResponse.status >= 200 && testResponse.status < 300) {
                        const testResult = testResponse.data;
                        if (testResult.success) {
                            console.log(`✅ MCP test successful. Function count: ${testResult.function_count}`);
                        } else {
                            console.warn(`⚠️ MCP test failed: ${testResult.message}`);
                            alert(`Warning: MCP configuration test failed: ${testResult.message}`);
                        }
                    } else {
                        console.warn('⚠️ Failed to test MCP configuration');
                        alert('Warning: Failed to test MCP configuration. Tool saved but function count may not be accurate.');
                    }
                } catch (mcpError) {
                    console.warn('⚠️ Error testing MCP configuration:', mcpError);
                    alert('Warning: Error testing MCP configuration. Tool saved but function count may not be accurate.');
                }
                
                this.closeToolsModal(contentArea);
                await this.loadTools(contentArea);
            } else {
                alert('Failed to save tool configuration');
            }
        } catch (error) {
            console.error('Error saving tool:', error);
            alert('Failed to save tool configuration');
        } finally {
            // Reset save button
            saveBtn.textContent = originalSaveBtnText;
            saveBtn.disabled = false;
        }
    }

    async handleTestMcp(contentArea) {
        const form = contentArea.querySelector('#toolsForm');
        const formData = new FormData(form);
        const toolId = form.dataset.toolId;
        const testMcpBtn = form.querySelector('#testMcpBtn');

        // Check if this is an edit (tool exists) or a new tool
        if (!toolId) {
            alert('Please save the tool first before testing MCP configuration.');
            return;
        }

        // Save button to show loading state
        const originalBtnText = testMcpBtn.textContent;
        testMcpBtn.textContent = 'Testing...';
        testMcpBtn.disabled = true;

        try {
            const baseUrl = 'http://localhost:8080';
            
            // First save current environment variables
            await this.saveEnvironmentVariables(toolId, contentArea);
            
            // Test MCP configuration
            const testResponse = await window.apiMethods.post(`/api/0.1.0/tools/${toolId}/test-mcp`, {}, {
                baseUrl: baseUrl
            });
            
            if (testResponse.status >= 200 && testResponse.status < 300) {
                const testResult = testResponse.data;
                if (testResult.success) {
                    alert(`✅ MCP Test Successful!\n\nFound ${testResult.function_count} MCP functions.\n\n${testResult.message}`);
                    console.log(`✅ MCP test successful. Function count: ${testResult.function_count}`);
                    
                    // Reload tools to show updated function count
                    await this.loadTools(contentArea);
                } else {
                    alert(`❌ MCP Test Failed!\n\n${testResult.message}`);
                    console.warn(`⚠️ MCP test failed: ${testResult.message}`);
                }
            } else {
                alert('❌ Failed to test MCP configuration. Please check your configuration and try again.');
                console.warn('⚠️ Failed to test MCP configuration');
            }
        } catch (error) {
            console.error('Error testing MCP configuration:', error);
            alert(`❌ Error testing MCP configuration: ${error.message || 'Unknown error'}`);
        } finally {
            // Reset button
            testMcpBtn.textContent = originalBtnText;
            testMcpBtn.disabled = false;
        }
    }

    async editTool(tool) {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        await this.openToolsModal(contentArea, tool);
    }

    async deleteTool(toolId) {
        if (!confirm('Are you sure you want to delete this tool configuration?')) {
            return;
        }

        try {
            const response = await window.apiMethods.delete(`/api/0.1.0/tools/${toolId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                const contentArea = this.shadowRoot.querySelector('.canvas-content');
                await this.loadTools(contentArea);
            } else {
                alert('Failed to delete tool configuration');
            }
        } catch (error) {
            console.error('Error deleting tool:', error);
            alert('Failed to delete tool configuration');
        }
    }

    async toggleResourcesDropdown(event, toolId) {
        event.stopPropagation();
        event.preventDefault();
        
        const dropdown = this.shadowRoot.querySelector(`#resources-${toolId}`);
        const button = event.target.closest('.resources-dropdown-btn');
        const arrow = button.querySelector('.dropdown-arrow');
        
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            // Close all other dropdowns first
            this.closeAllResourcesDropdowns();
            
            // Position the dropdown correctly
            const rect = button.getBoundingClientRect();
            dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
            dropdown.style.left = `${rect.right - 280 + window.scrollX}px`; // Align to right edge
            
            // Open this dropdown
            dropdown.style.display = 'block';
            arrow.textContent = '▲';
            
            // Load resources if not already loaded
            if (dropdown.querySelector('.loading-resources')) {
                await this.loadToolResources(toolId, dropdown);
            }
        } else {
            // Close this dropdown
            dropdown.style.display = 'none';
            arrow.textContent = '▼';
        }
    }

    closeAllResourcesDropdowns() {
        const dropdowns = this.shadowRoot.querySelectorAll('.resources-dropdown-content');
        const arrows = this.shadowRoot.querySelectorAll('.dropdown-arrow');
        
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
        
        arrows.forEach(arrow => {
            arrow.textContent = '▼';
        });
    }

    async loadToolResources(toolId, dropdown) {
        try {
            const response = await window.apiMethods.get(`/api/0.1.0/tools/${toolId}/resources`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status === 200 && response.data) {
                const resources = response.data;
                
                if (resources.length === 0) {
                    dropdown.innerHTML = '<div class="no-resources">No resources found</div>';
                    // Keep default "Tools List" text
                } else {
                    dropdown.innerHTML = resources.map(resource => `
                        <div class="resource-item non-selectable">
                            <div class="resource-name">${resource.resourceName}</div>
                            <div class="resource-description">${resource.resourceDescription || 'No description'}</div>
                        </div>
                    `).join('');
                    
                    // Keep default "Tools List" text instead of changing to resource name
                    // Note: Removed the code that changed the button text to the first resource
                }
            } else {
                dropdown.innerHTML = '<div class="error-resources">Failed to load resources</div>';
            }
        } catch (error) {
            console.error('Error loading tool resources:', error);
            dropdown.innerHTML = '<div class="error-resources">Error loading resources</div>';
        }
    }

    // Environment Variables Management
    addEnvironmentVariable(contentArea, key = '', value = '') {
        const envList = contentArea.querySelector('#envVariablesList');
        const envItem = document.createElement('div');
        envItem.className = 'env-variable-item';
        
        const envId = 'env_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        envItem.innerHTML = `
            <div class="env-variable-row">
                <input type="text" class="env-key" placeholder="Variable Name" value="${key}" data-env-id="${envId}">
                <input type="text" class="env-value" placeholder="Variable Value" value="${value}" data-env-id="${envId}">
                <button type="button" class="btn-remove-env" onclick="this.getRootNode().host.removeEnvironmentVariable('${envId}')" title="Remove Variable">
                    <img src="./ui/assets/icons/delete-env.svg" alt="Remove" width="16" height="16">
                </button>
            </div>
        `;
        
        envList.appendChild(envItem);
    }

    removeEnvironmentVariable(envId) {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        const envItems = contentArea.querySelectorAll('.env-variable-item');
        
        envItems.forEach(item => {
            const keyInput = item.querySelector(`[data-env-id="${envId}"]`);
            if (keyInput) {
                item.remove();
            }
        });
    }

    clearEnvironmentVariables(contentArea) {
        const envList = contentArea.querySelector('#envVariablesList');
        envList.innerHTML = '';
    }

    async loadToolEnvironmentVariables(toolId, contentArea) {
        try {
            const response = await window.apiMethods.get(`/api/0.1.0/tools/${toolId}/env-variables`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300 && response.data) {
                // Clear existing environment variables
                this.clearEnvironmentVariables(contentArea);
                
                // Add each environment variable
                if (Array.isArray(response.data)) {
                    response.data.forEach(env => {
                        this.addEnvironmentVariable(contentArea, env.key || env.name, env.value);
                    });
                } else if (typeof response.data === 'object') {
                    // If it's an object, iterate over key-value pairs
                    Object.entries(response.data).forEach(([key, value]) => {
                        this.addEnvironmentVariable(contentArea, key, value);
                    });
                }
            } else if (response.status === 404) {
                // 404 is normal - tool might not have environment variables yet
                console.log(`No environment variables found for tool ${toolId}`);
                this.clearEnvironmentVariables(contentArea);
            }
        } catch (error) {
            // Handle network errors or other issues gracefully
            if (error.status === 404) {
                console.log(`No environment variables found for tool ${toolId}`);
                this.clearEnvironmentVariables(contentArea);
            } else {
                console.warn('Error loading tool environment variables:', error.message || error);
            }
            // Don't show an error to the user as this might be normal for tools without env vars
        }
    }

    async saveEnvironmentVariables(toolId, contentArea) {
        const envItems = contentArea.querySelectorAll('.env-variable-item');
        const envVariables = [];

        envItems.forEach(item => {
            const keyInput = item.querySelector('.env-key');
            const valueInput = item.querySelector('.env-value');
            
            if (keyInput && valueInput && keyInput.value.trim()) {
                envVariables.push({
                    key: keyInput.value.trim(),
                    value: valueInput.value.trim()
                });
            }
        });

        if (envVariables.length > 0) {
            try {
                const response = await window.apiMethods.post(`/api/0.1.0/tools/${toolId}/env-variables/bulk`, envVariables, {
                    baseUrl: 'http://localhost:8080'
                });

                if (response.status < 200 || response.status >= 300) {
                    console.warn('Failed to save environment variables:', response.status, response.statusText);
                }
            } catch (error) {
                console.warn('Error saving environment variables:', error.message || error);
                // Don't throw the error, just log it as this shouldn't prevent tool saving
            }
        } else {
            console.log('No environment variables to save for tool', toolId);
        }
    }
}

// Register the component
customElements.define('viki-tools-canvas', VikiToolsCanvas);

export { VikiToolsCanvas };
