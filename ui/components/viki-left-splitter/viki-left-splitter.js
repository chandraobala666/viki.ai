import { BaseComponent } from '../base/base.js';

class VikiLeftSplitter extends BaseComponent {
    constructor() {
        super('viki-left-splitter');
        this.isCollapsed = false;
        this.activeOption = null;
    }

    async connectedCallback() {
        const shadowRoot = await super.connectedCallback();
        if (shadowRoot) {
            this.setupEventListeners(shadowRoot);
            this.setDefaultActiveOption(shadowRoot);
        }
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
        // Set the first option (LLM) as default active
        const firstNavItem = shadowRoot.querySelector('.nav-item');
        if (firstNavItem) {
            firstNavItem.classList.add('active');
            this.activeOption = firstNavItem.dataset.option;
            this.dispatchNavChangeEvent(this.activeOption);
        }
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
    setCollapsed(collapsed) {
        if (this.isCollapsed !== collapsed) {
            const shadowRoot = this.shadowRoot;
            const hamburgerToggle = shadowRoot.getElementById('hamburgerToggle');
            this.toggleCollapse(hamburgerToggle);
        }
    }

    // Public method to get current state
    getCollapsed() {
        return this.isCollapsed;
    }

    // Public method to programmatically set active option
    setActiveOption(optionName) {
        const shadowRoot = this.shadowRoot;
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