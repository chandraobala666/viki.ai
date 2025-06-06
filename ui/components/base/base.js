export class BaseComponent extends HTMLElement {
    constructor(templateName, shadowMode = 'closed') {
        super();
        this.templateName = templateName;
        this.shadowMode = shadowMode;
        this._initializationPromise = null;
    }

    connectedCallback() {
        // Prevent multiple initialization attempts
        if (this._initializationPromise) {
            return this._initializationPromise;
        }

        // If shadow root already exists, return it immediately
        if (this._shadowRoot) {
            return Promise.resolve(this._shadowRoot);
        }

        this._initializationPromise = new Promise((resolve, reject) => {
            fetch(`./ui/components/${this.templateName.toLowerCase()}/${this.templateName.toLowerCase()}.html`)
                .then(response => response.text())
                .then(html => {

                    // Create shadow DOM only if it doesn't exist
                    if (!this._shadowRoot) {
                        this._shadowRoot = this.attachShadow({ mode: this.shadowMode });
                    }

                    //Load HTML
                    const template = document.createElement('template');
                    template.innerHTML = html;
                    const templateContent = template.content.cloneNode(true);
                    this._shadowRoot.appendChild(templateContent);
                    
                    // Load and apply CSS
                    const linkElem = document.createElement('link');
                    linkElem.setAttribute('rel', 'stylesheet');
                    linkElem.setAttribute('href', `./ui/components/${this.templateName.toLowerCase()}/${this.templateName.toLowerCase()}.css`);
                    this._shadowRoot.appendChild(linkElem);

                    // Wait for CSS to load
                    linkElem.onload = () => resolve(this._shadowRoot);
                    linkElem.onerror = () => reject(new Error('Failed to load CSS'));
                })
                .catch(error => {
                    console.error('Error loading component files:', error);
                    reject(error);
                });
        });

        return this._initializationPromise;
    }

    // Getter to access shadow root
    get shadowRoot() {
        return this._shadowRoot;
    }
}