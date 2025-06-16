/**
 * VikiHtml Component
 * 
 * An HTML rendering component that safely renders HTML, CSS, and JavaScript from LLM outputs.
 * Uses DOMPurify for sanitization to prevent XSS attacks.
 * Requires: DOMPurify (https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.6/purify.min.js)
 * 
 * Features:
 * - Safe HTML rendering with DOMPurify sanitization
 * - CSS support with style tag processing
 * - JavaScript execution in isolated context
 * - Code block detection and extraction
 * - Security-first approach with configurable sanitization
 */

import { BaseComponent } from '../base/base.js';

class VikiHtml extends BaseComponent {
    constructor() {
        super('viki-html');
        this._htmlContent = '';
        this._allowScripts = false;
        this._allowStyles = true;
        this._domPurifyConfig = {
            ALLOWED_TAGS: [
                'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote',
                'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'a', 'img', 'figure', 'figcaption', 'canvas', 'svg', 'path', 'circle', 'rect',
                'form', 'input', 'textarea', 'button', 'select', 'option', 'label',
                'style', 'link'
            ],
            ALLOWED_ATTR: [
                'class', 'id', 'style', 'title', 'alt', 'src', 'href', 'target', 'rel',
                'width', 'height', 'data-*', 'aria-*', 'role',
                'type', 'value', 'placeholder', 'name', 'for', 'disabled', 'readonly',
                'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'x', 'y'
            ],
            ALLOW_DATA_ATTR: true,
            ALLOW_ARIA_ATTR: true,
            ADD_TAGS: ['style'],
            ADD_ATTR: ['target', 'style']
        };
    }

    static get observedAttributes() {
        return ['html-content', 'allow-scripts', 'allow-styles'];
    }

    async connectedCallback() {
        console.log('🚀 VikiHtml connectedCallback called');
        try {
            const shadowRoot = await super.connectedCallback();
            console.log('🚀 VikiHtml shadowRoot created:', !!shadowRoot);
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                await this.loadDOMPurify();
                this.render();
                console.log('✅ VikiHtml initialization complete');
            }
        } catch (error) {
            console.error('❌ Error in VikiHtml connectedCallback:', error);
        }
    }

    // Load DOMPurify library
    async loadDOMPurify() {
        if (this.isDOMPurifyAvailable()) {
            console.log('DOMPurify already available');
            return;
        }

        // Try multiple CDN sources for better reliability
        const cdnSources = [
            'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js',
            'https://unpkg.com/dompurify@3.0.8/dist/purify.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.8/purify.min.js'
        ];

        for (const src of cdnSources) {
            try {
                const script = document.createElement('script');
                script.src = src;
                script.crossOrigin = 'anonymous';
                script.referrerPolicy = 'no-referrer';
                
                const loaded = await new Promise((resolve) => {
                    script.onload = () => {
                        console.log(`DOMPurify loaded successfully from ${src}`);
                        resolve(true);
                    };
                    script.onerror = () => {
                        console.warn(`Failed to load DOMPurify from ${src}`);
                        resolve(false);
                    };
                    document.head.appendChild(script);
                });

                if (loaded && this.isDOMPurifyAvailable()) {
                    return; // Successfully loaded
                }
            } catch (error) {
                console.warn(`Error loading DOMPurify from ${src}:`, error);
            }
        }

        console.warn('All DOMPurify CDN sources failed, will use basic sanitization');
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log('🔄 VikiHtml attributeChanged:', name, 'newValue length:', newValue ? newValue.length : 0);
        
        if (name === 'html-content') {
            this._htmlContent = newValue || '';
            console.log('🔄 Setting HTML content:', this._htmlContent ? this._htmlContent.substring(0, 100) + '...' : 'Empty');
            this.render();
        } else if (name === 'allow-scripts') {
            this._allowScripts = newValue !== null;
            this.render();
        } else if (name === 'allow-styles') {
            this._allowStyles = newValue !== null;
            this.render();
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for HTML-specific functionality
        // Prevent form submissions and external navigation for security
        shadowRoot.addEventListener('submit', (event) => {
            event.preventDefault();
            console.log('Form submission prevented for security');
        });

        shadowRoot.addEventListener('click', (event) => {
            if (event.target.tagName === 'A' && event.target.href) {
                // Allow navigation but in new tab for security
                event.preventDefault();
                window.open(event.target.href, '_blank', 'noopener,noreferrer');
            }
        });
    }

    // Set HTML content programmatically
    setHtmlContent(htmlContent) {
        this._htmlContent = htmlContent || '';
        this.render();
    }

    // Get current HTML content
    getHtmlContent() {
        return this._htmlContent;
    }

    // Enable/disable script execution
    setAllowScripts(allowScripts) {
        this._allowScripts = allowScripts;
        this.render();
    }

    // Enable/disable style processing
    setAllowStyles(allowStyles) {
        this._allowStyles = allowStyles;
        this.render();
    }

    // Extract and separate HTML, CSS, and JavaScript from content
    parseContent(content) {
        if (!content) return { html: '', css: '', js: '' };

        let html = content;
        let css = '';
        let js = '';

        // Extract CSS from style tags
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gim;
        let styleMatch;
        while ((styleMatch = styleRegex.exec(content)) !== null) {
            css += styleMatch[1] + '\n';
        }

        // Extract JavaScript from script tags
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gim;
        let scriptMatch;
        while ((scriptMatch = scriptRegex.exec(content)) !== null) {
            js += scriptMatch[1] + '\n';
        }

        // Extract HTML/CSS/JS from code blocks
        const codeBlockRegex = /```(html|css|javascript|js)\n([\s\S]*?)\n```/gim;
        let codeMatch;
        while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
            const language = codeMatch[1].toLowerCase();
            const code = codeMatch[2];
            
            if (language === 'html') {
                // Parse HTML code blocks for additional CSS and JS
                const parsed = this.parseContent(code);
                html += '\n' + parsed.html;
                css += '\n' + parsed.css;
                js += '\n' + parsed.js;
            } else if (language === 'css') {
                css += '\n' + code;
            } else if (language === 'javascript' || language === 'js') {
                js += '\n' + code;
            }
            
            // Remove the code block from HTML to avoid duplication
            html = html.replace(codeMatch[0], '');
        }

        return {
            html: html.trim(),
            css: css.trim(),
            js: js.trim()
        };
    }

    // Sanitize HTML content using DOMPurify
    sanitizeContent(content) {
        if (!this.isDOMPurifyAvailable()) {
            console.warn('DOMPurify not available, using basic sanitization');
            return this.basicSanitize(content);
        }

        try {
            const config = { ...this._domPurifyConfig };
            
            if (!this._allowScripts) {
                config.FORBID_TAGS = ['script'];
                config.FORBID_ATTR = ['onclick', 'onload', 'onerror', 'onmouseover'];
            }

            if (!this._allowStyles) {
                config.FORBID_TAGS = [...(config.FORBID_TAGS || []), 'style', 'link'];
                config.FORBID_ATTR = [...(config.FORBID_ATTR || []), 'style'];
            }

            return DOMPurify.sanitize(content, config);
        } catch (error) {
            console.error('Error sanitizing content:', error);
            return this.basicSanitize(content);
        }
    }

    // Basic sanitization fallback when DOMPurify is not available
    basicSanitize(content) {
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = content;
        
        // Remove script tags and event handlers for basic security
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Remove potentially dangerous attributes
        const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'];
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(element => {
            dangerousAttrs.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    element.removeAttribute(attr);
                }
            });
        });
        
        return temp.innerHTML;
    }

    // Execute JavaScript in a controlled manner
    executeJavaScript(jsCode) {
        if (!this._allowScripts || !jsCode.trim()) {
            return;
        }

        try {
            // Create a controlled execution context
            const contextWindow = {
                console: {
                    log: (...args) => console.log('[VikiHtml Script]:', ...args),
                    error: (...args) => console.error('[VikiHtml Script]:', ...args),
                    warn: (...args) => console.warn('[VikiHtml Script]:', ...args)
                },
                // Provide access to the rendered content element
                document: {
                    getElementById: (id) => this._shadowRoot.getElementById(id),
                    querySelector: (selector) => this._shadowRoot.querySelector(selector),
                    querySelectorAll: (selector) => this._shadowRoot.querySelectorAll(selector),
                    createElement: (tagName) => document.createElement(tagName),
                    addEventListener: (event, handler, options) => {
                        // Add event listener to the shadow root container
                        const container = this._shadowRoot.querySelector('.content');
                        if (container) {
                            if (event === 'DOMContentLoaded') {
                                // Since we're in a controlled environment, fire DOMContentLoaded immediately
                                setTimeout(() => handler(), 0);
                            } else {
                                container.addEventListener(event, handler, options);
                            }
                        }
                    },
                    removeEventListener: (event, handler, options) => {
                        const container = this._shadowRoot.querySelector('.content');
                        if (container) {
                            container.removeEventListener(event, handler, options);
                        }
                    },
                    body: this._shadowRoot.querySelector('.content') || this._shadowRoot,
                    documentElement: this._shadowRoot,
                    readyState: 'complete'
                },
                // Add window-like properties
                window: null, // Will be set to contextWindow
                setTimeout: (fn, delay) => setTimeout(fn, delay),
                setInterval: (fn, delay) => setInterval(fn, delay),
                clearTimeout: (id) => clearTimeout(id),
                clearInterval: (id) => clearInterval(id),
                requestAnimationFrame: (fn) => requestAnimationFrame(fn),
                cancelAnimationFrame: (id) => cancelAnimationFrame(id)
            };
            
            // Set window reference
            contextWindow.window = contextWindow;

            // Execute the JavaScript with controlled context
            const func = new Function(
                'window', 
                'document', 
                'console', 
                'setTimeout', 
                'setInterval', 
                'clearTimeout', 
                'clearInterval', 
                'requestAnimationFrame', 
                'cancelAnimationFrame', 
                jsCode
            );
            func.call(
                null, 
                contextWindow, 
                contextWindow.document, 
                contextWindow.console,
                contextWindow.setTimeout,
                contextWindow.setInterval,
                contextWindow.clearTimeout,
                contextWindow.clearInterval,
                contextWindow.requestAnimationFrame,
                contextWindow.cancelAnimationFrame
            );
        } catch (error) {
            console.error('Error executing JavaScript:', error);
        }
    }

    // Apply CSS styles
    applyStyles(cssCode) {
        if (!this._allowStyles || !cssCode.trim()) {
            return;
        }

        // Remove existing custom styles
        const existingStyle = this._shadowRoot.querySelector('#viki-html-custom-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create and append new style element
        const styleElement = document.createElement('style');
        styleElement.id = 'viki-html-custom-styles';
        styleElement.textContent = cssCode;
        this._shadowRoot.appendChild(styleElement);
    }

    // Render the HTML content
    render() {
        console.log('🎨 VikiHtml render called');
        console.log('🎨 HTML content:', this._htmlContent ? this._htmlContent.substring(0, 200) + '...' : 'No content');
        
        if (!this._shadowRoot) {
            console.log('❌ No shadowRoot in VikiHtml render');
            return;
        }

        const contentElement = this._shadowRoot.getElementById('html-content');
        if (!contentElement) {
            console.log('❌ No content element found in VikiHtml render');
            return;
        }

        // Check if we're in a modal context and apply modal-specific styling
        this.applyModalStyling();

        if (!this._htmlContent) {
            console.log('ℹ️ No HTML content to render');
            contentElement.innerHTML = '';
            return;
        }

        try {
            console.log('🎨 Parsing content...');
            // Parse the content to extract HTML, CSS, and JavaScript
            const parsed = this.parseContent(this._htmlContent);
            console.log('🎨 Parsed content:', { 
                htmlLength: parsed.html.length, 
                cssLength: parsed.css.length, 
                jsLength: parsed.js.length 
            });
            
            // Sanitize the HTML content
            const sanitizedHtml = this.sanitizeContent(parsed.html);
            console.log('🎨 Sanitized HTML length:', sanitizedHtml.length);
            
            // Set the sanitized HTML content
            contentElement.innerHTML = sanitizedHtml;
            console.log('🎨 Content set in DOM');
            
            // Apply CSS styles if allowed
            if (this._allowStyles && parsed.css) {
                this.applyStyles(parsed.css);
            }
            
            // Execute JavaScript if allowed
            if (this._allowScripts && parsed.js) {
                // Use setTimeout to allow DOM to be ready
                setTimeout(() => {
                    this.executeJavaScript(parsed.js);
                }, 0);
            }
        } catch (error) {
            console.error('Error rendering HTML content:', error);
            contentElement.innerHTML = `<div style="color: red; padding: 16px; border: 1px solid red; border-radius: 4px;">
                <strong>Rendering Error:</strong> ${error.message}
            </div>`;
        }
    }

    // Apply modal-specific styling when the component is in a modal context
    applyModalStyling() {
        if (!this._shadowRoot) return;

        // Check if we're in a modal context
        const isInModal = this.classList.contains('force-light-theme') ||
                         this.closest('.html-modal-overlay') ||
                         this.closest('.force-light-theme');

        if (isInModal) {
            console.log('🎨 VikiHtml detected modal context, applying light theme overrides');
            
            // Inject modal-specific styles into shadow DOM
            let modalStyle = this._shadowRoot.querySelector('#modal-style-override');
            if (!modalStyle) {
                modalStyle = document.createElement('style');
                modalStyle.id = 'modal-style-override';
                modalStyle.textContent = `
                    /* Force light theme in modal context */
                    :host {
                        --bg-color: #ffffff !important;
                        --text-color: #333333 !important;
                        --text-color-muted: #6a737d !important;
                        --border-color: #e1e4e8 !important;
                        --link-color: #0366d6 !important;
                        --code-bg-color: #f6f8fa !important;
                        --header-bg-color: #f6f8fa !important;
                        --alt-row-bg-color: #f9fafb !important;
                        --button-bg-color: #238636 !important;
                        --button-text-color: #ffffff !important;
                        --button-hover-bg-color: #2ea043 !important;
                        --button-active-bg-color: #1a7f37 !important;
                    }
                    
                    .viki-html {
                        background-color: #ffffff !important;
                        color: #333333 !important;
                    }
                    
                    .html-content {
                        background-color: #ffffff !important;
                        color: #333333 !important;
                    }
                    
                    /* Hide security indicator in modal */
                    .html-content::before {
                        display: none !important;
                    }
                    
                    /* Override any dark theme media queries */
                    @media (prefers-color-scheme: dark) {
                        :host {
                            --bg-color: #ffffff !important;
                            --text-color: #333333 !important;
                            --text-color-muted: #6a737d !important;
                            --border-color: #e1e4e8 !important;
                            --link-color: #0366d6 !important;
                            --code-bg-color: #f6f8fa !important;
                            --header-bg-color: #f6f8fa !important;
                            --alt-row-bg-color: #f9fafb !important;
                            --button-bg-color: #238636 !important;
                            --button-text-color: #ffffff !important;
                            --button-hover-bg-color: #2ea043 !important;
                            --button-active-bg-color: #1a7f37 !important;
                        }
                        
                        .viki-html {
                            background-color: #ffffff !important;
                            color: #333333 !important;
                        }
                        
                        .html-content {
                            background-color: #ffffff !important;
                            color: #333333 !important;
                        }
                        
                        .html-content::before {
                            display: none !important;
                        }
                    }
                `;
                this._shadowRoot.appendChild(modalStyle);
            }
        }
    }

    // Load HTML from a URL
    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch HTML: ${response.status}`);
            }
            const html = await response.text();
            this.setHtmlContent(html);
        } catch (error) {
            console.error('Error loading HTML from URL:', error);
            this.setHtmlContent(`<div style="color: red;">Error loading HTML: ${error.message}</div>`);
        }
    }

    // Export rendered content as HTML
    exportAsHtml() {
        const contentElement = this._shadowRoot?.getElementById('html-content');
        return contentElement ? contentElement.innerHTML : '';
    }

    // Clear content
    clear() {
        this.setHtmlContent('');
        
        // Remove custom styles
        const existingStyle = this._shadowRoot?.querySelector('#viki-html-custom-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
    }

    // Check if DOMPurify library is available
    isDOMPurifyAvailable() {
        return typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function';
    }

    // Get DOMPurify version if available
    getDOMPurifyVersion() {
        if (this.isDOMPurifyAvailable() && DOMPurify.version) {
            return DOMPurify.version;
        }
        return null;
    }

    // Update DOMPurify configuration
    updateSanitizationConfig(config) {
        this._domPurifyConfig = { ...this._domPurifyConfig, ...config };
        this.render(); // Re-render with new config
    }

    // Get current sanitization config
    getSanitizationConfig() {
        return { ...this._domPurifyConfig };
    }

    // Enable/disable specific HTML tags
    setAllowedTags(tags) {
        this._domPurifyConfig.ALLOWED_TAGS = tags;
        this.render();
    }

    // Enable/disable specific HTML attributes
    setAllowedAttributes(attrs) {
        this._domPurifyConfig.ALLOWED_ATTR = attrs;
        this.render();
    }
}

// Register the custom element
customElements.define('viki-html', VikiHtml);

export { VikiHtml };
