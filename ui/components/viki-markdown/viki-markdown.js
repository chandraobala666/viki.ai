/**
 * VikiMarkdown Component
 * 
 * A markdown rendering component that uses the marked library for parsing.
 * Requires: marked.js (https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.7/marked.min.js)
 * 
 * Features:
 * - GitHub Flavored Markdown support
 * - Custom rendering options
 * - Fallback to custom parser if marked is not available
 * - Security considerations for link handling
 */

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
                this.configureMarked();
                this.render();
            }
        } catch (error) {
            console.error('Error in VikiMarkdown connectedCallback:', error);
        }
   }

    // Configure marked library options
    configureMarked() {
        if (this.isMarkedAvailable()) {
            // Configure marked options for better security and rendering
            marked.setOptions({
                breaks: true,
                gfm: true, // GitHub Flavored Markdown
                sanitize: false, // Allow HTML (be careful with user input)
                silent: false,
                smartLists: true,
                smartypants: false
            });

            // Optional: Configure custom renderer for specific elements
            this.setupCustomRenderer();
        }
    }

    // Setup custom renderer for marked library
    setupCustomRenderer() {
        if (this.isMarkedAvailable()) {
            const renderer = new marked.Renderer();
            
            // Customize link rendering to always open in new tab
            renderer.link = function(href, title, text) {
                return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            };

            // Customize code block rendering
            renderer.code = function(code, language) {
                const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<pre><code class="language-${language || ''}">${escapedCode}</code></pre>`;
            };

            marked.setOptions({
                renderer: renderer
            });
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

    // Parse markdown tables
    parseMarkdownTables(markdown) {
        // Regular expression to match markdown tables
        const tableRegex = /^\|(.+)\|\s*\n\|[\s\-\|:]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm;
        
        return markdown.replace(tableRegex, (match, headerRow, bodyRows) => {
            // Parse header row
            const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
            
            // Parse body rows
            const rows = bodyRows.trim().split('\n').map(row => {
                if (row.startsWith('|') && row.endsWith('|')) {
                    return row.slice(1, -1).split('|').map(cell => cell.trim());
                }
                return [];
            }).filter(row => row.length > 0);
            
            // Build HTML table with minimal whitespace
            let tableHtml = '<table><thead><tr>';
            headers.forEach(header => {
                tableHtml += `<th>${this.escapeHtml(header)}</th>`;
            });
            tableHtml += '</tr></thead><tbody>';
            
            rows.forEach(row => {
                tableHtml += '<tr>';
                row.forEach((cell, index) => {
                    if (index < headers.length) {
                        // Process markdown within table cells
                        let cellContent = cell;
                        // Apply basic markdown formatting to cell content
                        cellContent = cellContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        cellContent = cellContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
                        cellContent = cellContent.replace(/`(.*?)`/g, '<code>$1</code>');
                        cellContent = cellContent.replace(/\[([^\]]*)\]\(([^\)]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
                        
                        tableHtml += `<td>${cellContent}</td>`;
                    }
                });
                tableHtml += '</tr>';
            });
            
            tableHtml += '</tbody></table>';
            return tableHtml;
        });
    }

    // Simple markdown to HTML converter
    markdownToHtml(markdown) {
        if (!markdown) return '';

        let html = markdown;

        // Tables - process first to avoid interference with other formatting
        html = this.parseMarkdownTables(html);

        // Code blocks (triple backticks) - process before other formatting
        html = html.replace(/```([a-z]*)\n([\s\S]*?)\n```/gim, (match, lang, code) => {
            const escapedCode = this.escapeHtml(code);
            return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
        });

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
        html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

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
            return '<ul>' + match + '</ul>';
        });

        // Split content by tables to handle paragraph wrapping properly
        const tablePlaceholder = '___TABLE_PLACEHOLDER___';
        const tables = [];
        let tableIndex = 0;
        
        // Extract tables and replace with placeholders
        html = html.replace(/<table>.*?<\/table>/gims, (match) => {
            tables.push(match);
            return `${tablePlaceholder}${tableIndex++}`;
        });

        // Process paragraphs and line breaks for non-table content
        html = html.replace(/\n\s*\n/gim, '</p><p>');
        html = html.replace(/\n/gim, '<br>');

        // Wrap in paragraphs
        html = '<p>' + html + '</p>';

        // Restore tables
        tables.forEach((table, index) => {
            html = html.replace(`${tablePlaceholder}${index}`, table);
        });

        // Clean up formatting
        html = html.replace(/<p><\/p>/gim, '');
        html = html.replace(/<p>(<h[1-6]>)/gim, '$1');
        html = html.replace(/(<\/h[1-6]>)<\/p>/gim, '$1');
        html = html.replace(/<p>(<hr>)<\/p>/gim, '$1');
        html = html.replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/gim, '$1');
        html = html.replace(/<p>(<pre>.*?<\/pre>)<\/p>/gims, '$1');
        html = html.replace(/<p>(<ul>.*?<\/ul>)<\/p>/gims, '$1');
        html = html.replace(/<p>(<ol>.*?<\/ol>)<\/p>/gims, '$1');
        html = html.replace(/<p>(<table>.*?<\/table>)<\/p>/gims, '$1');
        
        // Clean up any remaining extra spaces around tables
        html = html.replace(/(<\/p>)\s*(<table>)/gims, '$1$2');
        html = html.replace(/(<\/table>)\s*(<p>)/gims, '$1$2');

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
            // Check if marked library is available
            if (this.isMarkedAvailable()) {
                // Use marked library to convert markdown to HTML
                contentElement.innerHTML = marked.parse(this._markdown);
            } else {
                // Fallback to custom markdown parser if marked is not available
                console.warn('Marked library not available, using fallback parser');
                contentElement.innerHTML = this.markdownToHtml(this._markdown);
            }
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
        if (this.isMarkedAvailable()) {
            return marked.parse(this._markdown);
        } else {
            // Fallback to custom markdown parser
            return this.markdownToHtml(this._markdown);
        }
    }

    // Clear content
    clear() {
        this.setMarkdown('');
    }

    // Check if marked library is available and properly loaded
    isMarkedAvailable() {
        return typeof marked !== 'undefined' && typeof marked.parse === 'function';
    }

    // Get the version of marked library if available
    getMarkedVersion() {
        if (this.isMarkedAvailable() && marked.defaults) {
            return marked.defaults.version || 'unknown';
        }
        return null;
    }
}

// Register the custom element
customElements.define('viki-markdown', VikiMarkdown);

export { VikiMarkdown };
