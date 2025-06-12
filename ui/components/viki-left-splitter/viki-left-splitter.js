import { BaseComponent } from '../base/base.js';

class VikiLeftSplitter extends BaseComponent {
    constructor() {
        super('viki-left-splitter');
        this.isCollapsed = false;
        this.activeOption = null;
        this.activeChatSession = null;
        this.chatSessions = [];
        this._initializationPromise = null;
        this._isInitialized = false;
    }

    async connectedCallback() {
        // Prevent multiple initialization attempts
        if (this._initializationPromise) {
            return this._initializationPromise;
        }

        this._initializationPromise = this._initialize();
        return this._initializationPromise;
    }

    async _initialize() {
        const shadowRoot = await super.connectedCallback();
        if (shadowRoot) {
            this.setupEventListeners(shadowRoot);
            this.setDefaultActiveOption(shadowRoot);
            await this.loadChatSessions();
            this.setupDocumentEventListeners();
            this._isInitialized = true;
        }
        return shadowRoot;
    }

    async _waitForInitialization() {
        if (this._isInitialized) {
            return this.shadowRoot;
        }
        
        if (this._initializationPromise) {
            await this._initializationPromise;
            return this.shadowRoot;
        }

        // If not initialized and no promise, start initialization
        return this.connectedCallback();
    }

    setupEventListeners(shadowRoot) {
        const hamburgerToggle = shadowRoot.getElementById('hamburgerToggle');
        const navItems = shadowRoot.querySelectorAll('.nav-item');
        const addSessionBtn = shadowRoot.getElementById('addSessionBtn');

        if (hamburgerToggle) {
            hamburgerToggle.addEventListener('click', () => {
                this.toggleCollapse(hamburgerToggle);
            });
        }

        if (navItems) {
            navItems.forEach(navItem => {
                navItem.addEventListener('click', () => {
                    this.handleNavItemClick(navItem, navItems);
                });
            });
        }

        if (addSessionBtn) {
            addSessionBtn.addEventListener('click', () => {
                this.createNewChatSession();
            });
        }
    }

    setupDocumentEventListeners() {
        // Listen for new chat session creation from chat canvas
        document.addEventListener('viki-chat-session-created', async (event) => {
            const { sessionId } = event.detail;
            console.log('🚀 Left splitter received chat session created:', sessionId);
            
            // Reload chat sessions to include the new one
            await this.loadChatSessions();
            
            // Automatically select the new session
            this.selectChatSession(sessionId);
        });
    }

    setDefaultActiveOption(shadowRoot) {
        // Check if there's already an active option from URL
        const urlView = this.getViewFromURL();
        if (urlView) {
            const targetNavItem = shadowRoot.querySelector(`[data-option="${urlView}"]`);
            if (targetNavItem) {
                targetNavItem.classList.add('active');
                this.activeOption = urlView;
                return; // Don't dispatch event as parent will handle URL-based navigation
            }
        }

        // Set the first option (LLM) as default active only if no URL view found
        const firstNavItem = shadowRoot.querySelector('.nav-item');
        if (firstNavItem) {
            firstNavItem.classList.add('active');
            this.activeOption = firstNavItem.dataset.option;
            this.dispatchNavChangeEvent(this.activeOption);
        }
    }

    getViewFromURL() {
        const validViews = ['llm', 'tools', 'rag', 'agents', 'chat'];
        
        // Check URL path first (e.g., /tools, /rag)
        const path = window.location.pathname;
        const pathView = path.substring(1); // Remove leading slash
        if (validViews.includes(pathView)) {
            return pathView;
        }

        // Check URL parameters (e.g., ?view=tools)
        const urlParams = new URLSearchParams(window.location.search);
        const paramView = urlParams.get('view');
        if (validViews.includes(paramView)) {
            return paramView;
        }

        // Check hash (e.g., #tools)
        const hash = window.location.hash.substring(1); // Remove #
        if (validViews.includes(hash)) {
            return hash;
        }

        return null;
    }

    handleNavItemClick(clickedItem, allNavItems) {
        const newOption = clickedItem.dataset.option;
        
        // Special handling for chat navigation
        if (newOption === 'chat') {
            // Clear any active chat session when clicking on Chat nav item
            this.activeChatSession = null;
            
            // Clear active session in UI
            const shadowRoot = this.shadowRoot;
            if (shadowRoot) {
                const sessionItems = shadowRoot.querySelectorAll('.session-item');
                sessionItems.forEach(item => {
                    item.classList.remove('active');
                });
            }
            
            // Dispatch event to clear chat and show welcome message
            this.dispatchEvent(new CustomEvent('viki-chat-session-cleared', {
                bubbles: true,
                composed: true
            }));
        }
        
        // Remove active class from all items
        allNavItems.forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to clicked item
        clickedItem.classList.add('active');
        
        // Store active option
        this.activeOption = newOption;
        
        // Dispatch custom event for parent components
        // For chat, we dispatch without sessionId to clear the URL parameter
        if (newOption === 'chat') {
            this.dispatchEvent(new CustomEvent('viki-nav-change', {
                bubbles: true,
                composed: true,
                detail: {
                    option: newOption,
                    clearSession: true  // Signal to clear session from URL
                }
            }));
        } else {
            this.dispatchNavChangeEvent(this.activeOption);
        }
    }

    dispatchNavChangeEvent(option) {
        console.log('🚀 VikiLeftSplitter: Dispatching nav change event for:', option);
        this.dispatchEvent(new CustomEvent('viki-nav-change', {
            bubbles: true,
            composed: true,
            detail: {
                option: option
            }
        }));
    }

    toggleCollapse(hamburgerElement) {
        this.isCollapsed = !this.isCollapsed;
        
        // Toggle classes for visual feedback
        hamburgerElement.classList.toggle('active', this.isCollapsed);
        this.classList.toggle('collapsed', this.isCollapsed);
        
        // Dispatch custom event for parent components to listen to
        this.dispatchEvent(new CustomEvent('viki-left-splitter-toggle', {
            bubbles: true,
            composed: true,
            detail: {
                collapsed: this.isCollapsed
            }
        }));
    }

    // Public method to programmatically collapse/expand
    async setCollapsed(collapsed) {
        if (this.isCollapsed !== collapsed) {
            const shadowRoot = await this._waitForInitialization();
            if (shadowRoot) {
                const hamburgerToggle = shadowRoot.getElementById('hamburgerToggle');
                this.toggleCollapse(hamburgerToggle);
            }
        }
    }

    // Public method to get current state
    getCollapsed() {
        return this.isCollapsed;
    }

    // Public method to programmatically set active option
    async setActiveOption(optionName) {
        // Wait for component to be fully initialized
        const shadowRoot = await this._waitForInitialization();
        
        if (!shadowRoot) {
            console.warn('VikiLeftSplitter: shadowRoot not available');
            return;
        }
        
        const navItems = shadowRoot.querySelectorAll('.nav-item');
        
        // Silently update the active option without triggering navigation
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.option === optionName) {
                item.classList.add('active');
            }
        });
        
        this.activeOption = optionName;
    }

    // Public method to get current active option
    getActiveOption() {
        return this.activeOption;
    }

    // Chat Session Management Methods
    async loadChatSessions() {
        try {
            console.log('🚀 Loading chat sessions...');
            const response = await window.apiMethods.get('/api/0.1.0/chat/sessions', {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status === 200 && response.data) {
                this.chatSessions = response.data;
                console.log(`✅ Found ${this.chatSessions.length} chat sessions`);
                this.renderChatSessions();
            }
        } catch (error) {
            console.error('Error loading chat sessions:', error);
        }
    }

    renderChatSessions() {
        const shadowRoot = this.shadowRoot;
        if (!shadowRoot) return;

        const sessionsList = shadowRoot.getElementById('chatSessionsList');
        if (!sessionsList) return;

        if (this.chatSessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="session-empty-state">
                    No chat sessions yet. Click + to create one.
                </div>
            `;
            return;
        }

        sessionsList.innerHTML = this.chatSessions.map(session => `
            <div class="session-item" data-session-id="${session.id}">
                <div class="session-icon">
                    <img src="./ui/assets/icons/chat-icon.svg" alt="Chat" width="16" height="16">
                </div>
                <span class="session-name" title="${session.name}">${session.name}</span>
                <div class="session-actions">
                    <button class="btn-session-action delete" title="Delete Session" data-session-id="${session.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners to session items
        const sessionItems = sessionsList.querySelectorAll('.session-item');
        sessionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.session-actions')) {
                    const sessionId = item.dataset.sessionId;
                    this.selectChatSession(sessionId);
                }
            });
        });

        // Add event listeners to delete buttons
        const deleteButtons = sessionsList.querySelectorAll('.btn-session-action.delete');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = btn.dataset.sessionId;
                this.deleteChatSession(sessionId);
            });
        });
    }

    async createNewChatSession() {
        // Navigate to chat without any session - this will show the welcome message
        const shadowRoot = this.shadowRoot;
        if (!shadowRoot) return;

        // Clear any active chat session
        this.activeChatSession = null;
        
        // Clear active session in UI
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        sessionItems.forEach(item => {
            item.classList.remove('active');
        });

        // Navigate to chat view
        this.activeOption = 'chat';
        
        // Update nav items to show chat as active
        const navItems = shadowRoot.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.option === 'chat') {
                item.classList.add('active');
            }
        });

        // Dispatch event to show chat with welcome message
        this.dispatchEvent(new CustomEvent('viki-chat-session-cleared', {
            bubbles: true,
            composed: true
        }));
        
        this.dispatchNavChangeEvent('chat');
    }

    selectChatSession(sessionId) {
        const shadowRoot = this.shadowRoot;
        if (!shadowRoot) return;

        // Update active session in UI
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        sessionItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.sessionId === sessionId) {
                item.classList.add('active');
            }
        });

        this.activeChatSession = sessionId;

        // Navigate to chat view with the selected session
        this.activeOption = 'chat';
        
        // Update nav items to show chat as active
        const navItems = shadowRoot.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.option === 'chat') {
                item.classList.add('active');
            }
        });

        // Dispatch event to load chat with session
        this.dispatchEvent(new CustomEvent('viki-chat-session-change', {
            bubbles: true,
            composed: true,
            detail: {
                sessionId: sessionId,
                option: 'chat'
            }
        }));
    }

    // Silent version for syncing with URL changes (doesn't dispatch events)
    selectChatSessionSilent(sessionId) {
        const shadowRoot = this.shadowRoot;
        if (!shadowRoot) return;

        // Update active session in UI
        const sessionItems = shadowRoot.querySelectorAll('.session-item');
        sessionItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.sessionId === sessionId) {
                item.classList.add('active');
            }
        });

        this.activeChatSession = sessionId;

        // Navigate to chat view with the selected session
        this.activeOption = 'chat';
        
        // Update nav items to show chat as active
        const navItems = shadowRoot.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.option === 'chat') {
                item.classList.add('active');
            }
        });
    }

    async deleteChatSession(sessionId) {
        const session = this.chatSessions.find(s => s.id === sessionId);
        if (!session) return;

        if (!confirm(`Are you sure you want to delete the chat session "${session.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            console.log('🚀 Deleting chat session:', sessionId);
            const response = await window.apiMethods.delete(`/api/0.1.0/chat/sessions/${sessionId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Chat session deleted successfully');
                
                // If this was the active session, clear it
                if (this.activeChatSession === sessionId) {
                    this.activeChatSession = null;
                    
                    // Dispatch event to clear chat
                    this.dispatchEvent(new CustomEvent('viki-chat-session-cleared', {
                        bubbles: true,
                        composed: true
                    }));
                }
                
                await this.loadChatSessions();
            } else {
                console.error('Failed to delete chat session');
                alert('Failed to delete chat session');
            }
        } catch (error) {
            console.error('Error deleting chat session:', error);
            alert('Failed to delete chat session: ' + error.message);
        }
    }

    // Public method to get active chat session
    getActiveChatSession() {
        return this.activeChatSession;
    }

    // Public method to refresh chat sessions
    async refreshChatSessions() {
        await this.loadChatSessions();
    }
}

// Register the custom element
customElements.define('viki-left-splitter', VikiLeftSplitter);