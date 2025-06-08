import { BaseComponent } from '../base/base.js';

class VikiLLMCanvas extends BaseComponent {
    constructor() {
        super('viki-llm-canvas');
        this.providers = []; // Store providers data for display purposes
        this.tempFiles = {}; // Store temporary files for upload
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                await this.loadLLMView();
            }
        } catch (error) {
            console.error('Error in VikiLLMCanvas connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for LLM canvas specific functionality
    }

    async loadLLMView() {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>LLM</h2>
                <button class="btn-primary add-llm-btn" id="addLLMBtn">
                    <span>+</span> Add LLM
                </button>
            </div>
            <div class="canvas-empty-state-container" id="canvasEmptyStateContainer" style="display: none;">
                <div class="canvas-empty-state">
                    No LLM configurations found. Click "Add LLM" to create your first configuration.
                </div>
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

                            <div class="form-section">
                                <label class="section-label">Config Files (optional)</label>
                                <div class="file-upload-container">
                                    <div class="upload-area" id="authConfigUpload">
                                        <div class="upload-icon">🔐</div>
                                        <div class="upload-text">
                                            <span id="authConfigText">No config files uploaded</span>
                                            <br>
                                            <span class="upload-hint">Click 'Upload Files' to add any file type</span>
                                        </div>
                                        <button type="button" class="btn-upload" id="uploadAuthConfigBtn">
                                            📤 Upload Files
                                        </button>
                                    </div>
                                    <input type="file" id="authConfigFileInput" multiple style="display: none;">
                                    <div class="uploaded-files" id="authConfigFiles"></div>
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

        // File upload event listeners
        this.setupFileUploadListeners(contentArea);
    }

    async loadLLMs(contentArea) {
        const llmList = contentArea.querySelector('#llmList');
        const canvasEmptyStateContainer = contentArea.querySelector('#canvasEmptyStateContainer');
        
        try {
            console.log('🚀 Fetching LLMs from API...');
            
            // Use global API methods to fetch LLMs from the correct endpoint
            const response = await window.apiMethods.get('/api/0.1.0/llm/', {
                baseUrl: 'http://localhost:8080'
            });
            
            console.log('📡 API Response:', response);
            
            if (response.status === 200 && response.data) {
                const llms = response.data;
                console.log(`✅ Found ${llms.length} LLMs:`, llms);
                
                if (llms.length === 0) {
                    // Show empty state in canvas and hide LLM list
                    canvasEmptyStateContainer.style.display = 'flex';
                    llmList.style.display = 'none';
                } else {
                    // Hide empty state in canvas and show LLM list
                    canvasEmptyStateContainer.style.display = 'none';
                    llmList.style.display = 'grid';
                    this.renderLLMCards(llmList, llms);
                }
            } else {
                console.error('❌ Unexpected response:', response);
                canvasEmptyStateContainer.style.display = 'none';
                llmList.style.display = 'grid';
                llmList.innerHTML = '<div class="error-state">Failed to load LLM configurations.</div>';
            }
        } catch (error) {
            console.error('💥 Error loading LLMs:', error);
            canvasEmptyStateContainer.style.display = 'none';
            llmList.style.display = 'grid';
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
            
            // Use global API methods to fetch providers from the lookup endpoint
            const response = await window.apiMethods.get('/api/0.1.0/lookups/details/PROVIDER_TYPE_CD', {
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
        const basePath = './ui/assets/llm/';
        switch(provider?.toUpperCase()) {
            case 'OPENAI':
                return `<img src="${basePath}openai.svg" alt="OpenAI" width="32" height="32">`;
            case 'ANTHROPIC':
            case 'CLAUDE':
                return `<img src="${basePath}anthropic.svg" alt="Anthropic" width="32" height="32">`;
            case 'HUGGINGFACE':
                return `<img src="${basePath}huggingface.svg" alt="Hugging Face" width="32" height="32">`;
            case 'OLLAMA':
                return `<img src="${basePath}ollama.svg" alt="Ollama" width="32" height="32">`;
            case 'GROQ':
                return `<img src="${basePath}groq.svg" alt="Groq" width="32" height="32">`;
            case 'AZURE':
                return `<img src="${basePath}azure.svg" alt="Azure" width="32" height="32">`;
            case 'GOOGLE':
                return `<img src="${basePath}google.svg" alt="Google" width="32" height="32">`;
            case 'OPENROUTER':
                return `<img src="${basePath}openrouter.svg" alt="OpenRouter" width="32" height="32">`;
            case 'CEREBRAS':
                return `<img src="${basePath}cerebras.svg" alt="Cerebras" width="32" height="32">`;
            case 'ORACLE':
                return `<img src="${basePath}oracle.svg" alt="Oracle" width="32" height="32">`;
            default:
                return `<img src="${basePath}default.svg" alt="AI Provider" width="32" height="32">`; // Generic AI/tool icon for unknown providers
        }
    }

    getProviderDescription(providerCode) {
        const provider = this.providers.find(p => p.code === providerCode);
        return provider ? provider.description || providerCode : providerCode;
    }

    createLLMCard(llm) {
        const card = document.createElement('div');
        card.className = 'llm-card';
        
        const hasEndpoint = llm.endpointUrl && llm.endpointUrl.trim() !== '';
        const endpointDisplay = hasEndpoint ? llm.endpointUrl : '';
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-main-content">
                    <div class="provider-icon">
                        ${this.getProviderIcon(llm.providerTypeCode)}
                    </div>
                    <div class="card-info">
                        <h3 class="model-name">${llm.modelCode}</h3>
                        <p class="provider-name">${this.getProviderDescription(llm.providerTypeCode)}</p>
                        ${hasEndpoint ? `<p class="endpoint">Endpoint: ${endpointDisplay}</p>` : ''}
                        <div class="llm-info">
                            <span></span>
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-edit" onclick="this.getRootNode().host.editLLM(${JSON.stringify(llm).replace(/"/g, '&quot;')})" title="Edit">
                        <img src="./ui/assets/icons/edit.svg" alt="Edit" width="16" height="16">
                    </button>
                    <button class="btn-icon btn-delete" onclick="this.getRootNode().host.deleteLLM('${llm.id}')" title="Delete">
                        <img src="./ui/assets/icons/delete.svg" alt="Delete" width="16" height="16">
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }

    async openLLMModal(contentArea, llm = null) {
        const modal = contentArea.querySelector('#llmModal');
        const form = contentArea.querySelector('#llmForm');
        const title = contentArea.querySelector('#modalTitle');
        const authConfigText = contentArea.querySelector('#authConfigText');
        const authConfigFiles = contentArea.querySelector('#authConfigFiles');

        // Reset file sections
        if (authConfigText) authConfigText.textContent = 'No config files uploaded';
        if (authConfigFiles) authConfigFiles.innerHTML = '';

        // Clear temp files
        this.tempFiles = {};

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

            // Load existing files
            await this.loadLLMFiles(llm.id, contentArea);
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
        
        // Clear form
        const form = contentArea.querySelector('#llmForm');
        form.reset();
        delete form.dataset.llmId;
        
        // Clear temp files
        this.tempFiles = {};
    }

    async handleLLMFormSubmit(contentArea) {
        const form = contentArea.querySelector('#llmForm');
        const formData = new FormData(form);
        const isEdit = form.dataset.llmId;

        // Save button to show loading state
        const saveBtn = form.querySelector('#saveBtn');
        const originalSaveBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        const llmData = {
            providerTypeCode: formData.get('provider'),
            modelCode: formData.get('model'),
            endpointUrl: formData.get('endpoint') || null,
            apiKey: formData.get('apiKey') || null
        };

        try {
            let response;
            const baseUrl = 'http://localhost:8080';
            let llmId;
            
            if (isEdit) {
                llmId = form.dataset.llmId;
                response = await window.apiMethods.put(`/api/0.1.0/llm/${llmId}`, llmData, {
                    baseUrl: baseUrl
                });
            } else {
                response = await window.apiMethods.post('/api/0.1.0/llm/', llmData, {
                    baseUrl: baseUrl
                });
                if (response.status >= 200 && response.status < 300) {
                    llmId = response.data.id;
                }
            }

            if (response.status >= 200 && response.status < 300 && llmId) {
                // If editing and new files are uploaded, delete existing files first
                if (isEdit && this.tempFiles?.auth?.length > 0) {
                    try {
                        // Get existing files for this LLM
                        const existingFilesResponse = await window.apiMethods.get(`/api/0.1.0/llm/${llmId}/files`, {
                            baseUrl: baseUrl
                        });
                        
                        if (existingFilesResponse.status >= 200 && existingFilesResponse.status < 300) {
                            const existingFiles = existingFilesResponse.data || [];
                            
                            // Delete each existing file
                            for (const file of existingFiles) {
                                await window.apiMethods.delete(`/api/0.1.0/llm/${llmId}/files/${file.id}`, {
                                    baseUrl: baseUrl
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('Error deleting existing files:', error);
                        // Continue with upload even if deletion fails
                    }
                }
                
                // Upload auth config files if any
                if (this.tempFiles?.auth?.length > 0) {
                    await this.uploadFilesToLLM(llmId, 'auth');
                }
                
                this.closeLLMModal(contentArea);
                await this.loadLLMs(contentArea);
            } else {
                alert('Failed to save LLM configuration');
            }
        } catch (error) {
            console.error('Error saving LLM:', error);
            alert('Failed to save LLM configuration');
        } finally {
            // Reset save button
            saveBtn.textContent = originalSaveBtnText;
            saveBtn.disabled = false;
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
            const response = await window.apiMethods.delete(`/api/0.1.0/llm/${llmId}`, {
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

    setupFileUploadListeners(contentArea) {
        const authConfigUpload = contentArea.querySelector('#authConfigUpload');
        const authConfigFileInput = contentArea.querySelector('#authConfigFileInput');
        const uploadAuthConfigBtn = contentArea.querySelector('#uploadAuthConfigBtn');

        // Auth config file upload
        uploadAuthConfigBtn?.addEventListener('click', () => {
            authConfigFileInput.click();
        });

        authConfigFileInput?.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files, 'auth', contentArea);
        });

        // Drag and drop for auth config
        authConfigUpload?.addEventListener('dragover', (e) => {
            e.preventDefault();
            authConfigUpload.classList.add('drag-over');
        });

        authConfigUpload?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            authConfigUpload.classList.remove('drag-over');
        });

        authConfigUpload?.addEventListener('drop', (e) => {
            e.preventDefault();
            authConfigUpload.classList.remove('drag-over');
            this.handleFileSelection(e.dataTransfer.files, 'auth', contentArea);
        });
    }

    handleFileSelection(files, type, contentArea) {
        if (!this.tempFiles[type]) {
            this.tempFiles[type] = [];
        }

        Array.from(files).forEach(file => {
            const fileInfo = {
                id: Date.now() + Math.random(),
                file: file,
                name: file.name,
                size: file.size,
                type: file.type
            };
            this.tempFiles[type].push(fileInfo);
        });

        this.updateFileDisplay(type, contentArea);
    }

    updateFileDisplay(type, contentArea) {
        const files = this.tempFiles[type] || [];
        const textElement = contentArea.querySelector(`#${type}ConfigText`);
        const filesContainer = contentArea.querySelector(`#${type}ConfigFiles`);

        if (files.length === 0) {
            textElement.textContent = 'No config files uploaded';
            filesContainer.innerHTML = '';
            return;
        }

        textElement.textContent = `${files.length} file(s) selected`;
        
        filesContainer.innerHTML = files.map(fileInfo => `
            <div class="file-item" data-file-id="${fileInfo.id}">
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(fileInfo.name)}</div>
                    <div class="file-details">
                        <h4>${fileInfo.name}</h4>
                        <p>${this.formatFileSize(fileInfo.size)}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <button type="button" class="btn-remove" onclick="this.getRootNode().host.removeFile('${type}', '${fileInfo.id}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    removeFile(type, fileId) {
        if (this.tempFiles[type]) {
            this.tempFiles[type] = this.tempFiles[type].filter(f => f.id !== fileId);
            const contentArea = this.shadowRoot.querySelector('.canvas-content');
            this.updateFileDisplay(type, contentArea);
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const iconMap = {
            'json': '📄',
            'yaml': '📄',
            'yml': '📄',
            'txt': '📄',
            'md': '📄',
            'env': '⚙️',
            'config': '⚙️',
            'conf': '⚙️',
            'ini': '⚙️'
        };
        return iconMap[ext] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async uploadFilesToLLM(llmId, type) {
        const files = this.tempFiles?.[type] || [];
        const uploadedFiles = [];
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        const filesContainer = contentArea.querySelector('#authConfigFiles');
        
        // Add progress indicators
        for (const fileInfo of files) {
            const fileElement = filesContainer.querySelector(`[data-file-id="${fileInfo.id}"]`);
            if (fileElement) {
                fileElement.classList.add('uploading');
                const actionsElement = fileElement.querySelector('.file-actions');
                const oldContent = actionsElement.innerHTML;
                actionsElement.innerHTML = '<span class="upload-status">Uploading...</span>';
                
                // Add progress bar
                const progressElement = document.createElement('div');
                progressElement.className = 'file-upload-progress';
                progressElement.innerHTML = '<div class="file-upload-progress-bar" style="width: 0%"></div>';
                fileElement.appendChild(progressElement);
                
                try {
                    const formData = new FormData();
                    formData.append('file', fileInfo.file);
                    
                    const uploadResponse = await window.apiMethods.post(`/api/0.1.0/llm/${llmId}/files`, formData, {
                        baseUrl: 'http://localhost:8080'
                        // Don't set headers - let the browser set Content-Type with boundary for FormData
                    });
                    
                    if (uploadResponse.status >= 200 && uploadResponse.status < 300) {
                        uploadedFiles.push(uploadResponse.data);
                        // Update progress to 100%
                        const progressBar = progressElement.querySelector('.file-upload-progress-bar');
                        progressBar.style.width = '100%';
                        actionsElement.innerHTML = '<span class="upload-status" style="color: #28a745;">✓ Uploaded</span>';
                    } else {
                        throw new Error('Upload failed');
                    }
                } catch (error) {
                    console.error('Error uploading file:', error);
                    actionsElement.innerHTML = '<span class="upload-status" style="color: #dc3545;">✗ Failed</span>';
                }
                
                // Remove uploading class
                setTimeout(() => {
                    fileElement.classList.remove('uploading');
                }, 1000);
            }
        }
        
        return uploadedFiles;
    }

    async loadLLMFiles(llmId, contentArea) {
        try {
            const response = await window.apiMethods.get(`/api/0.1.0/llm/${llmId}/files`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                const files = response.data || [];
                console.log('📁 Loaded LLM files:', files);
                this.displayExistingFiles(files, contentArea);
            }
        } catch (error) {
            console.error('Error loading LLM files:', error);
        }
    }

    displayExistingFiles(files, contentArea) {
        const filesContainer = contentArea.querySelector('#authConfigFiles');
        const textElement = contentArea.querySelector('#authConfigText');
        
        console.log('📂 Displaying existing files:', files);
        
        if (files.length === 0) {
            textElement.textContent = 'No config files uploaded';
            filesContainer.innerHTML = '';
            return;
        }

        textElement.textContent = `${files.length} existing file(s)`;
        
        filesContainer.innerHTML = files.map(file => `
            <div class="file-item" data-file-id="${file.id}">
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.fileName)}</div>
                    <div class="file-details">
                        <h4>${file.fileName}</h4>
                        <p>File • Uploaded ${file.creationDt ? new Date(file.creationDt).toLocaleDateString() : 'Unknown date'}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <button type="button" class="btn-download" onclick="this.getRootNode().host.downloadFile('${file.id}')">
                        Download
                    </button>
                    <button type="button" class="btn-remove" onclick="this.getRootNode().host.deleteFile('${file.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    async downloadFile(fileId) {
        try {
            const form = this.shadowRoot.querySelector('#llmForm');
            const llmId = form.dataset.llmId;
            
            if (!llmId) {
                alert('Cannot download file: LLM ID not found');
                return;
            }
            
            // Use LLM-specific download endpoint
            const downloadUrl = `http://localhost:8080/api/0.1.0/llm/${llmId}/files/${fileId}/download`;
            window.open(downloadUrl, '_blank');
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Failed to download file');
        }
    }

    async deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }

        try {
            const form = this.shadowRoot.querySelector('#llmForm');
            const llmId = form.dataset.llmId;
            
            if (!llmId) {
                alert('Cannot delete file: LLM ID not found');
                return;
            }
            
            // Use LLM-specific delete endpoint
            const response = await window.apiMethods.delete(`/api/0.1.0/llm/${llmId}/files/${fileId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                // Reload the current LLM files
                const contentArea = this.shadowRoot.querySelector('.canvas-content');
                await this.loadLLMFiles(llmId, contentArea);
            } else {
                alert('Failed to delete file');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file');
        }
    }
}

// Register the component
customElements.define('viki-llm-canvas', VikiLLMCanvas);

export { VikiLLMCanvas };
