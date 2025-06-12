import { BaseComponent } from '../base/base.js';

class VikiMarkdown extends BaseComponent {
    constructor() {
        super('viki-markdown');
        this._markdown = '';
        this._useHtml = false;
    }

    static get observedAttributes() {
        return ['markdown', 'use-html'];
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners(shadowRoot);
                this.render();
            }
        } catch (error) {
            console.error('Error in VikiMarkdown connectedCallback:', error);
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'markdown') {
            this._markdown = newValue || '';
            this.render();
        } else if (name === 'use-html') {
            this._useHtml = newValue !== null;
            this.render();
        }
    }

    setupEventListeners(shadowRoot) {
        // Event listeners for markdown specific functionality
    }

    // Set markdown content programmatically
    setMarkdown(markdown) {
        this._markdown = markdown || '';
        this.render();
    }

    // Get current markdown content
    getMarkdown() {
        return this._markdown;
    }

    // Enable/disable HTML rendering
    setUseHtml(useHtml) {
        this._useHtml = useHtml;
        this.render();
    }

    // Simple markdown to HTML converter
    markdownToHtml(markdown) {
        if (!markdown) return '';

        let html = markdown;

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
        html = html.replace(/__(.*)/gim, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
        html = html.replace(/_(.*)/gim, '<em>$1</em>');

        // Code blocks (triple backticks)
        html = html.replace(/```([a-z]*)\n([\s\S]*?)\n```/gim, (match, lang, code) => {
            const escapedCode = this.escapeHtml(code);
            return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]*)`/gim, '<code>$1</code>');

        // Links
        html = html.replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img alt="$1" src="$2" />');

        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

        // Horizontal rules
        html = html.replace(/^\-{3,}$/gim, '<hr>');
        html = html.replace(/^\*{3,}$/gim, '<hr>');

        // Unordered lists
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\+ (.*$)/gim, '<li>$1</li>');

        // Ordered lists
        html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

        // Wrap consecutive <li> elements in <ul> or <ol>
        html = html.replace(/(<li>.*<\/li>)/gims, (match) => {
            // Check if this is part of an ordered or unordered list
            const lines = match.split('\n');
            return '<ul>\n' + match + '\n</ul>';
        });

        // Line breaks
        html = html.replace(/\n\n/gim, '</p><p>');
        html = html.replace(/\n/gim, '<br>');

        // Wrap in paragraphs
        html = '<p>' + html + '</p>';

        // Clean up empty paragraphs and fix formatting
        html = html.replace(/<p><\/p>/gim, '');
        html = html.replace(/<p>(<h[1-6]>)/gim, '$1');
        html = html.replace(/(<\/h[1-6]>)<\/p>/gim, '$1');
        html = html.replace(/<p>(<hr>)<\/p>/gim, '$1');
        html = html.replace(/<p>(<blockquote>.*<\/blockquote>)<\/p>/gim, '$1');
        html = html.replace(/<p>(<pre>.*<\/pre>)<\/p>/gims, '$1');
        html = html.replace(/<p>(<ul>.*<\/ul>)<\/p>/gims, '$1');
        html = html.replace(/<p>(<ol>.*<\/ol>)<\/p>/gims, '$1');

        return html;
    }

    // Escape HTML characters
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Render the markdown content
    render() {
        if (!this._shadowRoot) return;

        const contentElement = this._shadowRoot.getElementById('markdown-content');
        if (!contentElement) return;

        if (this._useHtml) {
            // If use-html is enabled, render the markdown as HTML
            contentElement.innerHTML = this.markdownToHtml(this._markdown);
        } else {
            // Otherwise, just display as plain text
            contentElement.textContent = this._markdown;
        }
    }

    // Load markdown from a URL
    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch markdown: ${response.status}`);
            }
            const markdown = await response.text();
            this.setMarkdown(markdown);
        } catch (error) {
            console.error('Error loading markdown from URL:', error);
            this.setMarkdown(`Error loading markdown: ${error.message}`);
        }
    }

    // Export as HTML
    exportAsHtml() {
        return this.markdownToHtml(this._markdown);
    }

    // Clear content
    clear() {
        this.setMarkdown('');
    }
}

// Register the custom element
customElements.define('viki-markdown', VikiMarkdown);

export { VikiMarkdown };
