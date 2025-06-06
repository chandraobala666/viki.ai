import { BaseComponent } from '../base/base.js';

class VikiRAGCanvas extends BaseComponent {
    constructor() {
        super('viki-rag-canvas');
        this.documents = []; // Store documents data for display purposes
        this.tempFiles = {}; // Store temporary files for upload
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                await this.loadRAGView();
            }
        } catch (error) {
            console.error('Error in VikiRAGCanvas connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for RAG canvas specific functionality
    }

    async loadRAGView() {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        
        contentArea.innerHTML = `
            <div class="view-header">
                <h2>Knowledge Bases</h2>
                <button class="btn-primary add-docs-btn" id="addDocsBtn">
                    <span>+</span> Add Knowledge Base
                </button>
            </div>
            <div class="canvas-empty-state-container" id="canvasEmptyStateContainer" style="display: none;">
                <div class="canvas-empty-state">
                    No knowledge bases found. Click "Add Knowledge Base" to create your first knowledge base.
                </div>
            </div>
            <div class="docs-list" id="docsList">
                <div class="loading">Loading knowledge bases...</div>
            </div>
            <div class="docs-modal" id="docsModal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Add Knowledge Base</h3>
                        <button class="close-btn" id="closeModalBtn">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="docsForm">
                            <div class="form-group">
                                <label for="name">Name <span class="required">*</span></label>
                                <input type="text" id="name" name="name" required placeholder="e.g., Company Policies, Technical Documentation">
                            </div>
                            <div class="form-group">
                                <label for="description">Description <span class="required">*</span></label>
                                <textarea id="description" name="description" required placeholder="Enter knowledge base description" rows="3"></textarea>
                            </div>
                            
                            <div class="form-section">
                                <label class="section-label">Documents <span class="required">*</span></label>
                                <div class="file-upload-container">
                                    <div class="upload-area" id="docsUpload">
                                        <div class="upload-icon">📄</div>
                                        <div class="upload-text">
                                            <span id="docsText">No documents uploaded</span>
                                            <br>
                                            <span class="upload-hint">Click 'Upload Files' to add PDF, Excel, TXT and other documents</span>
                                        </div>
                                        <button type="button" class="btn-upload" id="uploadDocsBtn">
                                            📤 Upload Files
                                        </button>
                                    </div>
                                    <input type="file" id="docsFileInput" multiple accept=".pdf,.doc,.docx,.txt,.md,.rtf,.xls,.xlsx" style="display: none;">
                                    <div class="uploaded-files" id="docsFiles"></div>
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

        // Setup RAG view event listeners
        this.setupRAGViewEventListeners(contentArea);
        
        // Load existing documents
        await this.loadDocuments(contentArea);
    }

    setupRAGViewEventListeners(contentArea) {
        const addBtn = contentArea.querySelector('#addDocsBtn');
        const modal = contentArea.querySelector('#docsModal');
        const closeBtn = contentArea.querySelector('#closeModalBtn');
        const cancelBtn = contentArea.querySelector('#cancelBtn');
        const form = contentArea.querySelector('#docsForm');

        // Add Docs button
        addBtn?.addEventListener('click', async () => {
            await this.openDocsModal(contentArea);
        });

        // Close modal buttons
        [closeBtn, cancelBtn].forEach(btn => {
            btn?.addEventListener('click', () => {
                this.closeDocsModal(contentArea);
            });
        });

        // Form submission
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDocsFormSubmit(contentArea);
        });

        // Close modal on outside click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeDocsModal(contentArea);
            }
        });

        // File upload event listeners
        this.setupFileUploadListeners(contentArea);
    }

    async loadDocuments(contentArea) {
        const docsList = contentArea.querySelector('#docsList');
        const emptyStateContainer = contentArea.querySelector('#canvasEmptyStateContainer');
        
        try {
            console.log('🚀 Fetching Knowledge Bases from API...');
            
            // Fetch knowledge bases from the API
            const response = await window.apiMethods.get('/api/0.1.0/knowledge-bases/', {
                baseUrl: 'http://localhost:8080'
            });
            
            console.log('📡 Knowledge Base API Response:', response);
            
            if (response.status === 200 && response.data) {
                const knowledgeBases = response.data;
                console.log(`✅ Found ${knowledgeBases.length} Knowledge Bases:`, knowledgeBases);
                
                // Transform API data to match the UI format and fetch document counts
                const documents = await Promise.all(knowledgeBases.map(async (kb) => {
                    let fileCount = 0;
                    
                    try {
                        // Fetch documents for this knowledge base to get the count
                        const documentsResponse = await window.apiMethods.get(`/api/0.1.0/knowledge-bases/${kb.id}/documents`, {
                            baseUrl: 'http://localhost:8080'
                        });
                        
                        if (documentsResponse.status === 200 && documentsResponse.data) {
                            fileCount = documentsResponse.data.length;
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch documents for KB ${kb.id}:`, error);
                    }
                    
                    return {
                        id: kb.id,
                        name: kb.name,
                        description: kb.description || 'No description available',
                        fileCount: fileCount,
                        createdAt: kb.creationDt ? new Date(kb.creationDt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                    };
                }));
                
                this.documents = documents;
            } else {
                console.error('❌ Unexpected Knowledge Base response:', response);
                this.documents = [];
            }
            
            if (this.documents.length === 0) {
                docsList.style.display = 'none';
                emptyStateContainer.style.display = 'flex';
            } else {
                emptyStateContainer.style.display = 'none';
                docsList.style.display = 'grid';
                this.renderDocuments(docsList, this.documents);
            }
        } catch (error) {
            console.error('Error loading Knowledge Bases:', error);
            docsList.innerHTML = `<div class="error">Error loading knowledge bases: ${error.message}</div>`;
        }
    }

    renderDocuments(container, documents) {
        container.innerHTML = '';
        
        documents.forEach(docData => {
            const card = this.createDocumentCard(docData);
            container.appendChild(card);
        });
    }

    createDocumentCard(docData) {
        const card = document.createElement('div');
        card.className = 'docs-card';
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-main-content" onclick="this.getRootNode().host.viewKnowledgeBaseDetails('${docData.id}')" style="cursor: pointer;">
                    <div class="card-info">
                        <h3 class="model-name">${docData.name}</h3>
                        <p class="provider-name">${docData.description}</p>
                        <div class="file-count">
                            <img src="./ui/assets/icons/file.svg" alt="Files" width="16" height="16">
                            <span>${docData.fileCount} Documents</span>
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-edit" onclick="this.getRootNode().host.editDocument(${JSON.stringify(docData).replace(/"/g, '&quot;')})" title="Edit">
                        <img src="./ui/assets/icons/edit.svg" alt="Edit" width="16" height="16">
                    </button>
                    <button class="btn-icon btn-delete" onclick="this.getRootNode().host.deleteDocument('${docData.id}')" title="Delete">
                        <img src="./ui/assets/icons/delete.svg" alt="Delete" width="16" height="16">
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }

    async openDocsModal(contentArea, docData = null) {
        const modal = contentArea.querySelector('#docsModal');
        const form = contentArea.querySelector('#docsForm');
        const title = contentArea.querySelector('#modalTitle');
        const docsText = contentArea.querySelector('#docsText');
        const docsFiles = contentArea.querySelector('#docsFiles');

        // Reset file sections
        if (docsText) docsText.textContent = 'No documents uploaded';
        if (docsFiles) docsFiles.innerHTML = '';

        // Clear temp files
        this.tempFiles = {};

        if (docData) {
            // Edit mode
            title.textContent = 'Edit Knowledge Base';
            const nameInput = form.querySelector('#name');
            const descriptionInput = form.querySelector('#description');
            
            if (nameInput) nameInput.value = docData.name || '';
            if (descriptionInput) descriptionInput.value = docData.description || '';
            form.dataset.docId = docData.id;

            // Load existing files
            await this.loadKnowledgeBaseFiles(docData.id, contentArea);
        } else {
            // Add mode
            title.textContent = 'Add Knowledge Base';
            form.reset();
            delete form.dataset.docId;
        }

        modal.style.display = 'flex';
    }

    closeDocsModal(contentArea) {
        const modal = contentArea.querySelector('#docsModal');
        modal.style.display = 'none';
        
        // Clear form
        const form = contentArea.querySelector('#docsForm');
        form.reset();
        delete form.dataset.docId;
        
        // Clear temp files
        this.tempFiles = {};
    }

    async handleDocsFormSubmit(contentArea) {
        const form = contentArea.querySelector('#docsForm');
        const formData = new FormData(form);
        const isEdit = form.dataset.docId;

        // Validate that files are uploaded for new documents
        if (!isEdit && (!this.tempFiles.docs || this.tempFiles.docs.length === 0)) {
            alert('Please upload at least one document.');
            return;
        }

        // Save button to show loading state
        const saveBtn = form.querySelector('#saveBtn');
        const originalSaveBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        const docData = {
            name: formData.get('name'),
            description: formData.get('description'),
        };

        try {
            let response;
            const baseUrl = 'http://localhost:8080';
            let kbId;
            
            if (isEdit) {
                // Update existing knowledge base
                kbId = form.dataset.docId;
                response = await window.apiMethods.put(`/api/0.1.0/knowledge-bases/${kbId}`, docData, {
                    baseUrl: baseUrl
                });
            } else {
                // Create new knowledge base
                response = await window.apiMethods.post('/api/0.1.0/knowledge-bases/', docData, {
                    baseUrl: baseUrl
                });
                
                if (response.status >= 200 && response.status < 300) {
                    kbId = response.data.id;
                }
            }

            if (response.status >= 200 && response.status < 300) {
                // Upload files if new files were selected (for both edit and create)
                if (this.tempFiles.docs && this.tempFiles.docs.length > 0) {
                    console.log('🚀 Uploading files to knowledge base...');
                    
                    const uploadPromises = this.tempFiles.docs.map(async (fileInfo) => {
                        const fileFormData = new FormData();
                        fileFormData.append('file', fileInfo.file);
                        fileFormData.append('auto_add_to_documents', 'true');
                        
                        try {
                            const uploadResponse = await window.apiMethods.post(
                                `/api/0.1.0/knowledge-bases/${kbId}/files`, 
                                fileFormData, 
                                {
                                    baseUrl: baseUrl,
                                    headers: {} // Remove Content-Type header to let browser set it with boundary for FormData
                                }
                            );
                            console.log(`✅ File ${fileInfo.name} uploaded successfully`);
                            return uploadResponse;
                        } catch (error) {
                            console.error(`❌ Failed to upload file ${fileInfo.name}:`, error);
                            throw error;
                        }
                    });
                    
                    await Promise.all(uploadPromises);
                    console.log('✅ All files uploaded successfully');
                }
                
                this.closeDocsModal(contentArea);
                await this.loadDocuments(contentArea);
                
                // Show success message
                alert(isEdit ? 'Knowledge base updated successfully!' : 'Knowledge base created successfully!');
            } else {
                alert('Failed to save knowledge base');
            }
            
        } catch (error) {
            console.error('Error saving knowledge base:', error);
            alert('Failed to save knowledge base: ' + (error.message || 'Unknown error'));
        } finally {
            // Reset save button
            saveBtn.textContent = originalSaveBtnText;
            saveBtn.disabled = false;
        }
    }

    async viewKnowledgeBaseDetails(kbId) {
        try {
            console.log('🔍 Fetching details for Knowledge Base:', kbId);
            
            // Fetch knowledge base details
            const kbResponse = await window.apiMethods.get(`/api/0.1.0/knowledge-bases/${kbId}`, {
                baseUrl: 'http://localhost:8080'
            });
            
            // Fetch documents for this knowledge base
            const documentsResponse = await window.apiMethods.get(`/api/0.1.0/knowledge-bases/${kbId}/documents`, {
                baseUrl: 'http://localhost:8080'
            });
            
            if (kbResponse.status === 200 && documentsResponse.status === 200) {
                const kb = kbResponse.data;
                const documents = documentsResponse.data;
                
                console.log('📄 Knowledge Base Details:', kb);
                console.log('📋 Documents:', documents);
                
                this.showKnowledgeBaseModal(kb, documents);
            } else {
                alert('Failed to fetch knowledge base details');
            }
            
        } catch (error) {
            console.error('Error fetching knowledge base details:', error);
            alert('Failed to fetch knowledge base details: ' + (error.message || 'Unknown error'));
        }
    }

    showKnowledgeBaseModal(kb, documents) {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        
        // Create modal if it doesn't exist
        let modal = contentArea.querySelector('#kbDetailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'kbDetailsModal';
            modal.className = 'docs-modal';
            modal.style.display = 'none';
            contentArea.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Knowledge Base Details</h3>
                    <button class="close-btn" onclick="this.closest('.docs-modal').style.display='none'">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px;">
                        <h4>${kb.name}</h4>
                        <p style="color: #666; margin: 8px 0;">${kb.description || 'No description available'}</p>
                        <p style="color: #888; font-size: 14px;">Created: ${kb.creationDt ? new Date(kb.creationDt).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                    
                    <div>
                        <h5 style="margin-bottom: 16px;">Documents (${documents.length})</h5>
                        ${documents.length === 0 ? 
                            '<p style="color: #666; font-style: italic;">No documents in this knowledge base</p>' :
                            `<div class="documents-list" style="max-height: 400px; overflow-y: auto;">
                                ${documents.map(doc => `
                                    <div class="document-item" style="padding: 12px; border: 1px solid #e1e5e9; border-radius: 6px; margin-bottom: 8px; background: #f8f9fa;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div style="flex: 1;">
                                                <div style="font-weight: 500; margin-bottom: 4px;">Document ID: ${doc.fileStore}</div>
                                                <div style="font-size: 14px; color: #666;">Knowledge Base: ${doc.knowledgeBase}</div>
                                                ${doc.creationDt ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">Added: ${new Date(doc.creationDt).toLocaleDateString()}</div>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`
                        }
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    async editDocument(docData) {
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        await this.openDocsModal(contentArea, docData);
    }

    async deleteDocument(docId) {
        if (!confirm('Are you sure you want to delete this knowledge base?')) {
            return;
        }

        try {
            console.log('🗑️ Deleting knowledge base:', docId);
            
            // Delete knowledge base using API
            const response = await window.apiMethods.delete(`/api/0.1.0/knowledge-bases/${docId}`, {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Knowledge base deleted successfully');
                
                const contentArea = this.shadowRoot.querySelector('.canvas-content');
                await this.loadDocuments(contentArea);
                
                alert('Knowledge base deleted successfully!');
            } else {
                alert('Failed to delete knowledge base');
            }
            
        } catch (error) {
            console.error('Error deleting knowledge base:', error);
            alert('Failed to delete knowledge base: ' + (error.message || 'Unknown error'));
        }
    }

    async loadKnowledgeBaseFiles(kbId, contentArea) {
        try {
            console.log('🚀 Loading files for Knowledge Base:', kbId);
            const response = await window.apiMethods.get(`/api/0.1.0/knowledge-bases/${kbId}/files`, {
                baseUrl: 'http://localhost:8080'
            });

            console.log('📡 Files API Response:', response);

            if (response.status >= 200 && response.status < 300) {
                const files = response.data || [];
                console.log('📁 Loaded Knowledge Base files:', files);
                this.displayExistingFiles(files, contentArea);
            } else {
                console.error('❌ Failed to load files. Status:', response.status);
            }
        } catch (error) {
            console.error('Error loading Knowledge Base files:', error);
        }
    }

    displayExistingFiles(files, contentArea) {
        const filesContainer = contentArea.querySelector('#docsFiles');
        const textElement = contentArea.querySelector('#docsText');
        
        console.log('📂 Displaying existing files:', files);
        
        if (files.length === 0) {
            textElement.textContent = 'No documents uploaded';
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
            const form = this.shadowRoot.querySelector('#docsForm');
            const kbId = form.dataset.docId;
            
            if (!kbId) {
                alert('Cannot download file: Knowledge Base ID not found');
                return;
            }
            
            // Use Knowledge Base-specific download endpoint
            const downloadUrl = `http://localhost:8080/api/0.1.0/knowledge-bases/${kbId}/files/${fileId}/download`;
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
            const form = this.shadowRoot.querySelector('#docsForm');
            const kbId = form.dataset.docId;
            
            if (!kbId) {
                alert('Cannot delete file: Knowledge Base ID not found');
                return;
            }
            
            // Use Knowledge Base-specific delete endpoint
            const response = await window.apiMethods.delete(`/api/0.1.0/knowledge-bases/${kbId}/files/${fileId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                // Reload the current Knowledge Base files
                const contentArea = this.shadowRoot.querySelector('.canvas-content');
                await this.loadKnowledgeBaseFiles(kbId, contentArea);
            } else {
                alert('Failed to delete file');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file');
        }
    }

    setupFileUploadListeners(contentArea) {
        const docsUpload = contentArea.querySelector('#docsUpload');
        const docsFileInput = contentArea.querySelector('#docsFileInput');
        const uploadDocsBtn = contentArea.querySelector('#uploadDocsBtn');

        // Docs file upload
        uploadDocsBtn?.addEventListener('click', () => {
            docsFileInput.click();
        });

        docsFileInput?.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files, 'docs', contentArea);
        });

        // Drag and drop for docs
        docsUpload?.addEventListener('dragover', (e) => {
            e.preventDefault();
            docsUpload.classList.add('drag-over');
        });

        docsUpload?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            docsUpload.classList.remove('drag-over');
        });

        docsUpload?.addEventListener('drop', (e) => {
            e.preventDefault();
            docsUpload.classList.remove('drag-over');
            this.handleFileSelection(e.dataTransfer.files, 'docs', contentArea);
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
        const textElement = contentArea.querySelector(`#${type}Text`);
        const filesContainer = contentArea.querySelector(`#${type}Files`);

        if (files.length === 0) {
            textElement.textContent = 'No documents uploaded';
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
            'pdf': '📄',
            'doc': '📄',
            'docx': '📄',
            'txt': '📄',
            'md': '📝',
            'rtf': '📄',
            'xls': '📊',
            'xlsx': '📊',
            'html': '🌐',
            'htm': '🌐',
            'xml': '📄',
            'json': '📄'
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

    handleAddDocs() {
        // Legacy method - now handled by openDocsModal
        const contentArea = this.shadowRoot.querySelector('.canvas-content');
        this.openDocsModal(contentArea);
    }
}

// Register the custom element
customElements.define('viki-rag-canvas', VikiRAGCanvas);
