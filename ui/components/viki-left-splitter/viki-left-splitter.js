import { BaseComponent } from '../base/base.js';

class VikiLeftSplitter extends BaseComponent {
    constructor() {
        super('viki-left-splitter');
        this.isCollapsed = false;
        this.activeOption = null;
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
        // Remove active class from all items
        allNavItems.forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to clicked item
        clickedItem.classList.add('active');
        
        // Store active option
        this.activeOption = clickedItem.dataset.option;
        
        // Dispatch custom event for parent components
        this.dispatchNavChangeEvent(this.activeOption);
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
        
        navItems.forEach(item => {
            if (item.dataset.option === optionName) {
                this.handleNavItemClick(item, navItems);
            }
        });
    }

    // Public method to get current active option
    getActiveOption() {
        return this.activeOption;
    }
}

// Register the custom element
customElements.define('viki-left-splitter', VikiLeftSplitter);