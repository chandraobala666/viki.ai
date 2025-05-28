export class BaseComponent extends HTMLElement {
    constructor(templateName, shadowMode = 'closed') {
        super();
        this.templateName = templateName;
        this.shadowMode = shadowMode;
    }

    connectedCallback() {
        return new Promise((resolve, reject) => {
            fetch(`./ui/components/${this.templateName.toLowerCase()}/${this.templateName.toLowerCase()}.html`)
                .then(response => response.text())
                .then(html => {

                    // Create shadow DOM
                    const shadowRoot = this.attachShadow({ mode: this.shadowMode });

                    //Load HTML
                    const template = document.createElement('template');
                    template.innerHTML = html;
                    const templateContent = template.content.cloneNode(true);
                    shadowRoot.appendChild(templateContent);
                    
                    // Load and apply CSS
                    const linkElem = document.createElement('link');
                    linkElem.setAttribute('rel', 'stylesheet');
                    linkElem.setAttribute('href', `./ui/components/${this.templateName.toLowerCase()}/${this.templateName.toLowerCase()}.css`);
                    shadowRoot.appendChild(linkElem);

                    // Wait for CSS to load
                    linkElem.onload = () => resolve(shadowRoot);
                    linkElem.onerror = () => reject(new Error('Failed to load CSS'));
                })
                .catch(error => {
                    console.error('Error loading component files:', error);
                    reject(error);
                });
        });
    }

    componentReady() {
        // Default implementation (can be empty)
    }
}