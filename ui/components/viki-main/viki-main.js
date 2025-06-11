import { BaseComponent } from '../base/base.js';

export class VikiMain extends BaseComponent {
    constructor() {
        super('viki-main');
        this.currentView = 'llm'; // Default view
        this.validViews = ['llm', 'tools', 'rag', 'agents', 'chat'];
        this.currentChatSession = null;
    }
    
    async connectedCallback() {
        const shadowRoot = await super.connectedCallback();
        if (shadowRoot) {
            this.setupEventListeners(shadowRoot);
            this.setupURLNavigation();
            // Load view based on URL or default
            const urlParams = this.getURLParams();
            const initialView = urlParams.view || 'llm';
            const initialChatSession = urlParams.session;
            
            await this.loadView(shadowRoot, initialView, initialChatSession);
            await this.syncLeftSplitterWithURL();
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
            const { option, clearSession } = event.detail;
            if (clearSession && option === 'chat') {
                // Clear session and navigate to chat without session
                this.currentChatSession = null;
                this.handleNavigationChange(shadowRoot, option);
            } else {
                this.handleNavigationChange(shadowRoot, option);
            }
        });

        // Listen for chat session change events
        this.addEventListener('viki-chat-session-change', (event) => {
            const { sessionId, option } = event.detail;
            console.log('🚀 VikiMain: Chat session change to:', sessionId);
            
            // Update current chat session
            this.currentChatSession = sessionId;
            
            // Ensure we're on the chat view and update URL with session
            if (this.currentView !== 'chat') {
                this.handleNavigationChange(shadowRoot, 'chat', sessionId);
            } else {
                // Just update URL with new session
                this.updateURL('chat', sessionId);
                // Reload the chat view with the new session
                this.loadView(shadowRoot, 'chat', sessionId);
            }
        });

        // Listen for chat session cleared events
        this.addEventListener('viki-chat-session-cleared', (event) => {
            console.log('🚀 VikiMain: Chat session cleared');
            this.currentChatSession = null;
            this.updateURL('chat'); // Remove session parameter
        });
    }

    handleNavigationChange(shadowRoot, option, sessionId = null) {
        console.log('🚀 VikiMain: Navigation change to:', option, sessionId ? `with session: ${sessionId}` : '');
        
        // Update current chat session if provided
        if (sessionId) {
            this.currentChatSession = sessionId;
        } else if (option === 'chat') {
            // For chat navigation without sessionId, clear current session
            this.currentChatSession = null;
        } else if (option !== 'chat') {
            // Clear chat session when navigating away from chat
            this.currentChatSession = null;
        }
        
        this.updateURL(option, this.currentChatSession);
        this.loadView(shadowRoot, option, this.currentChatSession);
    }

    async loadView(shadowRoot, viewType, sessionId = null) {
        console.log('🚀 VikiMain: Loading view:', viewType, sessionId ? `with session: ${sessionId}` : '');
        this.currentView = viewType;
        
        // Update current chat session
        if (viewType === 'chat' && sessionId) {
            this.currentChatSession = sessionId;
        } else if (viewType !== 'chat') {
            this.currentChatSession = null;
        }
        
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
                
                // If we have a session ID, pass it to the chat canvas
                if (sessionId) {
                    canvasComponent.setAttribute('data-session-id', sessionId);
                    console.log('🚀 Setting session ID on chat canvas:', sessionId);
                }
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

    // URL Navigation Methods
    setupURLNavigation() {
        // Listen for browser back/forward navigation
        window.addEventListener('popstate', async (event) => {
            const urlParams = this.getURLParams();
            const view = urlParams.view || 'llm';
            const sessionId = urlParams.session;
            
            if (view !== this.currentView || (view === 'chat' && sessionId !== this.currentChatSession)) {
                await this.loadView(this.shadowRoot, view, sessionId);
                await this.syncLeftSplitterWithURL();
            }
        });
    }

    getURLParams() {
        // Parse URL parameters and return view and session information
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view');
        const session = urlParams.get('session');
        
        // Validate view parameter
        const validView = this.validViews.includes(view) ? view : null;
        
        return {
            view: validView,
            session: session
        };
    }

    getViewFromURL() {
        // Backward compatibility method
        return this.getURLParams().view;
    }

    updateURL(view, sessionId = null) {
        // Update URL with query parameters without page reload
        const urlParams = new URLSearchParams(window.location.search);
        const currentView = urlParams.get('view');
        const currentSession = urlParams.get('session');
        
        // Update view parameter
        if (view) {
            urlParams.set('view', view);
        } else {
            urlParams.delete('view');
        }
        
        // Update session parameter for chat view
        if (view === 'chat' && sessionId) {
            urlParams.set('session', sessionId);
        } else {
            urlParams.delete('session');
        }
        
        // Only update if URL has actually changed to avoid unnecessary history entries
        const newParamsString = urlParams.toString();
        const currentParamsString = new URLSearchParams(window.location.search).toString();
        
        if (newParamsString !== currentParamsString) {
            const newURL = `${window.location.origin}${window.location.pathname}${newParamsString ? '?' + newParamsString : ''}`;
            
            // Create a descriptive title
            let title = `VIKI - ${view ? view.toUpperCase() : 'HOME'}`;
            if (view === 'chat' && sessionId) {
                title += ` (Session: ${sessionId})`;
            }
            
            window.history.pushState({ view, sessionId }, title, newURL);
            console.log('🚀 VikiMain: URL updated to:', newURL);
        }
    }

    async syncLeftSplitterWithURL() {
        // Update the left splitter to reflect the current URL
        const urlParams = this.getURLParams();
        const view = urlParams.view || 'llm';
        const sessionId = urlParams.session;
        
        const leftSplitter = this.shadowRoot.querySelector('viki-left-splitter');
        if (leftSplitter) {
            // Set the active option/view
            if (leftSplitter.setActiveOption) {
                await leftSplitter.setActiveOption(view);
            }
            
            // If it's a chat view with a session, also select the chat session silently
            if (view === 'chat' && sessionId && leftSplitter.selectChatSessionSilent) {
                leftSplitter.selectChatSessionSilent(sessionId);
            }
        }
    }
    
    // Public methods for getting current state
    getCurrentView() {
        return this.currentView;
    }
    
    getCurrentChatSession() {
        return this.currentChatSession;
    }
    
    // Public method to programmatically navigate to a specific chat session
    async navigateToChatSession(sessionId) {
        const shadowRoot = this.shadowRoot;
        if (shadowRoot) {
            this.handleNavigationChange(shadowRoot, 'chat', sessionId);
        }
    }
    
    // Public method to clear current chat session
    clearChatSession() {
        this.currentChatSession = null;
        if (this.currentView === 'chat') {
            this.updateURL('chat'); // Remove session parameter
        }
    }
}

customElements.define('viki-main', VikiMain);
