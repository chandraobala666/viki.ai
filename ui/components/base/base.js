export class BaseComponent extends HTMLElement {
    constructor(templateName, shadowMode = 'closed') {
        super();
        this.templateName = templateName;
        this.shadowMode = shadowMode;
        this._initializationPromise = null;
    }

    connectedCallback() {
        console.log(`🚀 BaseComponent.connectedCallback called for ${this.templateName}`);
        
        // Prevent multiple initialization attempts
        if (this._initializationPromise) {
            console.log(`⏳ Returning existing initialization promise for ${this.templateName}`);
            return this._initializationPromise;
        }

        // If shadow root already exists, return it immediately
        if (this._shadowRoot) {
            console.log(`✅ Shadow root already exists for ${this.templateName}`);
            return Promise.resolve(this._shadowRoot);
        }

        console.log(`🚀 Starting initialization for ${this.templateName}`);
        this._initializationPromise = new Promise((resolve, reject) => {
            const htmlPath = `./ui/components/${this.templateName.toLowerCase()}/${this.templateName.toLowerCase()}.html`;
            console.log(`🚀 Fetching HTML from: ${htmlPath}`);
            
            fetch(htmlPath)
                .then(response => {
                    console.log(`✅ HTML fetched for ${this.templateName}, status: ${response.status}`);
                    return response.text();
                })
                .then(html => {
                    console.log(`🚀 Creating shadow DOM for ${this.templateName}`);

                    // Create shadow DOM only if it doesn't exist
                    if (!this._shadowRoot) {
                        this._shadowRoot = this.attachShadow({ mode: this.shadowMode });
                        console.log(`✅ Shadow DOM created for ${this.templateName}`);
                    }

                    //Load HTML
                    const template = document.createElement('template');
                    template.innerHTML = html;
                    const templateContent = template.content.cloneNode(true);
                    this._shadowRoot.appendChild(templateContent);
                    console.log(`✅ HTML content added to shadow DOM for ${this.templateName}`);
                    
                    // Load and apply CSS
                    const linkElem = document.createElement('link');
                    linkElem.setAttribute('rel', 'stylesheet');
                    linkElem.setAttribute('href', `./ui/components/${this.templateName.toLowerCase()}/${this.templateName.toLowerCase()}.css`);
                    this._shadowRoot.appendChild(linkElem);
                    console.log(`🚀 CSS link added for ${this.templateName}`);

                    // Wait for CSS to load
                    linkElem.onload = () => {
                        console.log(`✅ CSS loaded for ${this.templateName}`);
                        resolve(this._shadowRoot);
                    };
                    linkElem.onerror = () => {
                        console.error(`❌ Failed to load CSS for ${this.templateName}`);
                        reject(new Error('Failed to load CSS'));
                    };
                })
                .catch(error => {
                    console.error(`❌ Error loading component files for ${this.templateName}:`, error);
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