import { BaseComponent } from '../base/base.js';
import { VikiMarkdown } from '../viki-markdown/viki-markdown.js';
import { VikiHtml } from '../viki-html/viki-html.js';

class VikiChatCanvas extends BaseComponent {
    constructor() {
        super('viki-chat-canvas');
        this.agents = [];
        this.selectedAgent = null;
        this.messages = [];
        this.isTyping = false;
        this.currentChatSession = null;
        console.log('🚀 VikiChatCanvas constructor called');
    }

    // Getter to ensure we always access the correct shadow root
    get shadowRoot() {
        return this._shadowRoot || super.shadowRoot;
    }

    async connectedCallback() {
        console.log('🚀 VikiChatCanvas connectedCallback called');
        try {
            console.log('🚀 Calling super.connectedCallback...');
            const shadowRoot = await super.connectedCallback();
            console.log('✅ Super connectedCallback returned:', shadowRoot);
            
            if (shadowRoot) {
                console.log('🚀 Setting up event listeners...');
                this.setupEventListeners(shadowRoot);
                console.log('🚀 Setting up chat session event listeners...');
                this.setupChatSessionEventListeners();
                console.log('🚀 Loading agents...');
                await this.loadAgents();
                
                // Check if there's a session ID in the data attribute
                const sessionId = this.getAttribute('data-session-id');
                if (sessionId) {
                    console.log('🚀 Chat canvas initializing with session ID:', sessionId);
                    await this.loadChatSession(sessionId);
                } else {
                    // Show welcome message for new chat
                    this.showWelcomeMessage();
                }
                console.log('✅ VikiChatCanvas initialization complete');
            } else {
                console.error('❌ No shadowRoot returned from super.connectedCallback');
            }
        } catch (error) {
            console.error('❌ Error in VikiChatCanvas connectedCallback:', error);
        }
    }

    setupEventListeners(shadowRoot) {
        console.log('🚀 Setting up event listeners...');
        const agentSelect = shadowRoot.querySelector('#agentSelect');
        const messageInput = shadowRoot.querySelector('#messageInput');
        const sendButton = shadowRoot.querySelector('#sendButton');
        const chatFooter = shadowRoot.querySelector('#chatFooter');

        console.log('🔍 Elements found:');
        console.log('  agentSelect:', agentSelect);
        console.log('  messageInput:', messageInput);
        console.log('  sendButton:', sendButton);
        console.log('  chatFooter:', chatFooter);

        // Agent selection handler
        agentSelect?.addEventListener('change', (e) => {
            this.handleAgentSelection(e.target.value);
        });

        // Message input handlers
        messageInput?.addEventListener('keypress', (e) => {
            console.log('🔍 Keypress event detected:', e.key);
            if (e.key === 'Enter' && !e.shiftKey) {
                console.log('🚀 Enter key pressed, calling sendMessage...');
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendButton?.addEventListener('click', () => {
            console.log('🚀 Send button clicked, calling sendMessage...');
            this.sendMessage();
        });

        // Event delegation for markdown and HTML buttons
        const chatMessages = shadowRoot.querySelector('.chat-messages');
        chatMessages?.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-markdown-btn')) {
                const button = e.target;
                const messageDiv = button.closest('.bot-message, .user-message');
                const content = messageDiv.getAttribute('data-message-content');
                const messageId = button.getAttribute('data-message-id');
                
                if (content) {
                    this.showMarkdownModal(messageId, content);
                } else {
                    console.error('No content found for markdown display');
                }
            } else if (e.target.classList.contains('view-html-btn')) {
                const button = e.target;
                const messageDiv = button.closest('.bot-message, .user-message');
                const content = messageDiv.getAttribute('data-message-content');
                const messageId = button.getAttribute('data-message-id');
                
                if (content) {
                    this.showHtmlModal(messageId, content);
                } else {
                    console.error('No content found for HTML display');
                }
            }
        });
    }

    setupChatSessionEventListeners() {
        // Listen for chat session changes from left splitter
        document.addEventListener('viki-chat-session-change', (event) => {
            const { sessionId } = event.detail;
            console.log('🚀 Chat canvas received session change:', sessionId);
            this.loadChatSession(sessionId);
        });

        // Listen for chat session cleared events
        document.addEventListener('viki-chat-session-cleared', (event) => {
            console.log('🚀 Chat canvas received session cleared');
            this.clearChatSession();
        });
    }

    async loadAgents() {
        try {
            console.log('🚀 Fetching Agents for Chat...');
            
            const response = await window.apiMethods.get('/api/0.1.0/agents/', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status === 200 && response.data) {
                this.agents = response.data;
                console.log(`✅ Found ${this.agents.length} Agents for chat`);
                
                // Load LLM configurations for each agent
                await this.loadLLMConfigurations();
                this.populateAgentDropdown();
            }
        } catch (error) {
            console.error('Error loading agents:', error);
            this.showError('Failed to load agents. Please check if the server is running.');
        }
    }

    async loadLLMConfigurations() {
        try {
            console.log('🚀 Fetching LLM Configurations...');
            
            const response = await window.apiMethods.get('/api/0.1.0/llm/', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status === 200 && response.data) {
                const llmConfigs = response.data;
                console.log(`✅ Found ${llmConfigs.length} LLM Configurations`);
                
                // Map LLM configurations to agents
                this.agents.forEach(agent => {
                    const llmConfig = llmConfigs.find(config => config.id === agent.llmConfig);
                    if (llmConfig) {
                        agent.llmDetails = {
                            providerType: llmConfig.providerTypeCode,
                            modelCode: llmConfig.modelCode
                        };
                    }
                });
            }
        } catch (error) {
            console.error('Error loading LLM configurations:', error);
        }
    }

    populateAgentDropdown() {
        const agentSelect = this.shadowRoot.querySelector('#agentSelect');
        if (!agentSelect) return;

        // Clear existing options except the first one
        agentSelect.innerHTML = '<option value="">Select an agent...</option>';

        // Add agent options with LLM model information
        this.agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            
            // Format display text with agent name and LLM model
            let displayText = agent.name;
            if (agent.llmDetails) {
                const modelDisplay = `${agent.llmDetails.providerType} - ${agent.llmDetails.modelCode}`;
                displayText += ` (${modelDisplay})`;
            }
            
            option.textContent = displayText;
            option.setAttribute('data-description', agent.description || '');
            agentSelect.appendChild(option);
        });
    }

    handleAgentSelection(agentId) {
        if (!agentId) {
            this.selectedAgent = null;
            this.disableChatInput();
            if (!this.currentChatSession) {
                this.showWelcomeMessage();
            }
            return;
        }

        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            this.selectedAgent = agent;
            this.enableChatInput();
            this.loadAgentCapabilities(agentId);
            
            // Always show agent introduction when selecting an agent for new chat
            if (!this.currentChatSession) {
                this.showAgentIntroduction();
            }
        }
    }

    async loadAgentCapabilities(agentId) {
        try {
            let toolsCount = 0;
            let ragCount = 0;

            // Load agent tools count
            const toolsResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/tools', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (toolsResponse.status === 200) {
                const agentTools = toolsResponse.data.filter(at => at.agent === agentId);
                toolsCount = agentTools.length;
            }

            // Load agent knowledge bases count
            const kbResponse = await window.apiMethods.get('/api/0.1.0/agent-relationships/knowledge-bases', {
                baseUrl: 'http://localhost:8080'
            });
            
            if (kbResponse.status === 200) {
                const agentKBs = kbResponse.data.filter(akb => akb.agent === agentId);
                ragCount = agentKBs.length;
            }

            // Update agent info for potential future use
            if (this.selectedAgent) {
                this.selectedAgent.toolsCount = toolsCount;
                this.selectedAgent.ragCount = ragCount;
            }

        } catch (error) {
            console.error('Error loading agent capabilities:', error);
        }
    }

    enableChatInput() {
        const messageInput = this.shadowRoot.querySelector('#messageInput');
        const sendButton = this.shadowRoot.querySelector('#sendButton');
        const chatFooter = this.shadowRoot.querySelector('#chatFooter');

        if (messageInput) messageInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        if (chatFooter) chatFooter.style.display = 'flex';
    }

    disableChatInput() {
        const messageInput = this.shadowRoot.querySelector('#messageInput');
        const sendButton = this.shadowRoot.querySelector('#sendButton');
        const chatFooter = this.shadowRoot.querySelector('#chatFooter');

        if (messageInput) {
            messageInput.disabled = true;
            messageInput.value = '';
        }
        if (sendButton) sendButton.disabled = true;
        if (chatFooter) chatFooter.style.display = 'none';
    }

    showWelcomeMessage() {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages) return;

        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="bot-message">
                    <div class="message-avatar">
                        <img src="./ui/assets/chat/bot.svg" alt="Bot" width="32" height="32">
                    </div>
                    <div class="message-content">
                        <p>Welcome! Please select an agent from the dropdown above to start chatting.</p>
                    </div>
                </div>
            </div>
        `;
    }

    async loadChatSession(sessionId) {
        try {
            console.log('🚀 Loading chat session:', sessionId);

            // Load chat session details
            const sessionResponse = await window.apiMethods.get(`/api/0.1.0/chat/sessions/${sessionId}`, {
                baseUrl: 'http://localhost:8080'
            });

            if (sessionResponse.status !== 200) {
                console.error('Failed to load chat session');
                return;
            }

            this.currentChatSession = sessionResponse.data;
            console.log('✅ Loaded chat session:', this.currentChatSession);

            // Find and select the agent for this session
            const agent = this.agents.find(a => a.id === this.currentChatSession.agent);
            if (agent) {
                this.selectedAgent = agent;
                
                // Update agent dropdown
                const agentSelect = this.shadowRoot.querySelector('#agentSelect');
                if (agentSelect) {
                    agentSelect.value = agent.id;
                }

                // Load agent capabilities
                await this.loadAgentCapabilities(agent.id);
                this.enableChatInput();
            } else {
                console.error('Agent not found for session:', this.currentChatSession.agent);
                this.disableChatInput();
            }

            // Load existing messages for this session
            await this.loadChatMessages(sessionId);

        } catch (error) {
            console.error('Error loading chat session:', error);
            this.showError('Failed to load chat session. Please try again.');
        }
    }

    async loadChatMessages(sessionId) {
        try {
            console.log('🚀 Loading messages for session:', sessionId);

            const messagesResponse = await window.apiMethods.get(`/api/0.1.0/chat/sessions/${sessionId}/messages`, {
                baseUrl: 'http://localhost:8080'
            });

            if (messagesResponse.status !== 200) {
                console.error('Failed to load chat messages');
                return;
            }

            const messages = messagesResponse.data || [];
            console.log(`✅ Loaded ${messages.length} messages`);

            // Clear the chat and display messages
            this.clearChatDisplay();
            this.messages = [];

            if (messages.length === 0) {
                // Show agent introduction if no messages
                this.showAgentIntroduction();
            } else {
                // Display each message
                for (const message of messages) {
                    this.displayStoredMessage(message);
                }
                this.scrollToBottom();
            }

        } catch (error) {
            console.error('Error loading chat messages:', error);
            this.showError('Failed to load chat messages. Please try again.');
        }
    }    displayStoredMessage(message) {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages) return;

        // Convert role to type for display
        const type = message.role === 'USER' ? 'user' : 'bot';
        
        // Extract content - handle both string and array formats
        let content = '';
        if (Array.isArray(message.content)) {
            // Find the content from the message array
            const contentItem = message.content.find(item => item.content);
            content = contentItem ? contentItem.content : 'No content';
        } else if (typeof message.content === 'string') {
            content = message.content;
        } else {
            content = 'No content';
        }

        // Filter out <think> tags from bot responses
        if (type === 'bot') {
            content = this.filterThinkTags(content);
            console.log(`🚀 Filtered stored message content after removing <think> tags: ${content}`);
        }

        // Filter out content between <think> tags
        content = this.filterThinkTags(content);

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'user-message' : 'bot-message';
        
        const avatarSrc = type === 'user' ? './ui/assets/chat/user.svg' : './ui/assets/chat/bot.svg';
        const avatarAlt = type === 'user' ? 'User' : 'Bot';

        // Check content type (for bot messages only)
        if (type === 'bot') {
            const contentType = this.getContentType(content);
            console.log('🔍 Content type detected:', contentType, 'for content:', content.substring(0, 100) + '...');
            var hasHtml = contentType === 'html';
            var hasMarkdown = contentType === 'markdown';
        } else {
            var hasHtml = false;
            var hasMarkdown = false;
        }
        
        let actionButton = '';
        let displayContent = '';
        
        if (hasHtml) {
            const messageId = 'stored-msg-' + (message.id || Date.now()) + '-' + Math.random().toString(36).substr(2, 9);
            // Store raw HTML content in a data attribute
            actionButton = `<button class="view-html-btn" data-message-id="${messageId}" title="View as HTML">View HTML</button>`;
            messageDiv.setAttribute('data-message-id', messageId);
            messageDiv.setAttribute('data-message-content', content);
            
            // Display placeholder for HTML content
            displayContent = `<p><em>HTML content detected. Click 'View HTML' to render.</em></p>`;
        } else if (hasMarkdown) {
            const messageId = 'stored-msg-' + (message.id || Date.now()) + '-' + Math.random().toString(36).substr(2, 9);
            // Store raw markdown content in a data attribute
            actionButton = `<button class="view-markdown-btn" data-message-id="${messageId}" title="View as Markdown">View Markdown</button>`;
            messageDiv.setAttribute('data-message-id', messageId);
            messageDiv.setAttribute('data-message-content', content);
            
            // Display placeholder instead of stripped markdown
            displayContent = `<p><em>Markdown content hidden. Click 'View Markdown' to view.</em></p>`;
        } else {
            // Display regular escaped text for non-markdown/non-HTML content with proper newline handling
            const escapedContent = this.escapeHtml(content);
            const contentWithBreaks = escapedContent.replace(/\n/g, '<br>');
            displayContent = `<p>${contentWithBreaks}</p>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="${avatarAlt}" width="32" height="32">
            </div>
            <div class="message-content">
                ${displayContent}
                ${actionButton}
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        
        // Store message in local array
        this.messages.push({
            type,
            content,
            timestamp: new Date(message.creationDt || Date.now()),
            id: message.id
        });
    }

    showAgentIntroduction() {
        if (!this.selectedAgent) return;

        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages) return;

        // Clear messages first
        this.messages = [];
        chatMessages.innerHTML = `
            <div class="bot-message">
                <div class="message-avatar">
                    <img src="./ui/assets/chat/bot.svg" alt="Bot" width="32" height="32">
                </div>
                <div class="message-content">
                    <p>Hello! I'm <strong>${this.selectedAgent.name}</strong>. ${this.selectedAgent.description || 'How can I help you today?'}</p>
                </div>
            </div>
        `;

        // Focus on input
        const messageInput = this.shadowRoot.querySelector('#messageInput');
        if (messageInput) messageInput.focus();
    }

    clearChatSession() {
        this.currentChatSession = null;
        this.selectedAgent = null;
        this.messages = [];
        
        // Reset agent dropdown
        const agentSelect = this.shadowRoot.querySelector('#agentSelect');
        if (agentSelect) {
            agentSelect.value = '';
        }

        this.disableChatInput();
        this.showWelcomeMessage();
    }

    clearChatDisplay() {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
    }

    async sendMessage() {
        console.log('🚀 sendMessage called');
        const messageInput = this.shadowRoot.querySelector('#messageInput');
        console.log('messageInput:', messageInput);
        console.log('selectedAgent:', this.selectedAgent);
        console.log('currentChatSession:', this.currentChatSession);
        
        if (!messageInput || !this.selectedAgent) {
            console.log('❌ Missing required elements for sending message');
            return;
        }

        const messageText = messageInput.value.trim();
        console.log('messageText:', messageText);
        if (!messageText) {
            console.log('❌ No message text');
            return;
        }

        // If no current chat session, create one with the first 30 characters of the message
        if (!this.currentChatSession) {
            console.log('🚀 Creating new chat session for first message...');
            const sessionName = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
            
            try {
                const sessionData = {
                    name: sessionName,
                    agent: this.selectedAgent.id
                };

                const response = await window.apiMethods.post('/api/0.1.0/chat/sessions', sessionData, {
                    baseUrl: 'http://localhost:8080'
                });

                if (response.status >= 200 && response.status < 300) {
                    this.currentChatSession = response.data;
                    console.log('✅ New chat session created:', this.currentChatSession);
                    
                    // Dispatch event to update the left splitter
                    this.dispatchEvent(new CustomEvent('viki-chat-session-created', {
                        bubbles: true,
                        composed: true,
                        detail: { sessionId: this.currentChatSession.id }
                    }));
                } else {
                    console.error('Failed to create chat session');
                    alert('Failed to create chat session');
                    return;
                }
            } catch (error) {
                console.error('Error creating chat session:', error);
                alert('Failed to create chat session: ' + error.message);
                return;
            }
        }

        // Add user message to chat
        console.log('🚀 Adding user message to chat...');
        this.addMessage('user', messageText);
        messageInput.value = '';

        // Show typing indicator
        console.log('🚀 Showing typing indicator...');
        this.showTypingIndicator();

        try {
            // Call the AI chat API which handles both AI response generation and database storage
            console.log('🚀 Starting AI response generation...');
            const agentResponse = await this.getAIResponse(messageText);
            console.log('✅ Got agent response:', agentResponse);
            
            // Hide typing indicator before showing response
            console.log('🚀 Hiding typing indicator...');
            this.hideTypingIndicator();
            
            // Add the bot response message
            console.log('🚀 Adding bot response to chat...');
            this.addMessage('bot', agentResponse);
            console.log('✅ Bot response added to chat');
            
            // Note: Messages are now saved to database by the AI API endpoint
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            const errorMessage = 'Sorry, I encountered an error while processing your message. Please try again.';
            this.addMessage('bot', errorMessage);
        }
    }

    async saveMessageToDatabase(role, content) {
        if (!this.currentChatSession || !this.selectedAgent) {
            console.error('Cannot save message: no active chat session or agent');
            return;
        }

        try {
            const messageData = {
                chatSession: this.currentChatSession.id,
                agentName: this.selectedAgent.name,
                role: role,
                content: [
                    {
                        role: role.toLowerCase() === 'user' ? 'user' : 'assistant',
                        content: content
                    }
                ]
            };

            console.log('🚀 Saving message to database:', messageData);

            const response = await window.apiMethods.post('/api/0.1.0/chat/messages', messageData, {
                baseUrl: 'http://localhost:8080'
            });

            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Message saved successfully');
            } else {
                console.error('Failed to save message:', response);
            }
        } catch (error) {
            console.error('Error saving message to database:', error);
        }
    }

    // Function to filter out content between <think> tags
    filterThinkTags(content) {
        if (!content || typeof content !== 'string') {
            return content;
        }
        
        // Remove content between <think> and </think> tags (case insensitive)
        // This regex handles multiline content and whitespace variations
        const filtered = content.replace(/<think\s*>[\s\S]*?<\/think\s*>/gi, '');
        
        // Clean up any extra whitespace that might be left
        return filtered.trim();
    }

    addMessage(type, content) {
        console.log(`🚀 addMessage called with type: ${type}, content: ${content}`);
        
        // Filter out <think> tags from bot responses
        if (type === 'bot') {
            content = this.filterThinkTags(content);
            console.log(`🚀 Filtered content after removing <think> tags: ${content}`);
        }
        
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        console.log('chatMessages element:', chatMessages);
        if (!chatMessages) {
            console.log('❌ No chatMessages element found in addMessage');
            return;
        }

        // Filter out content between <think> tags
        content = this.filterThinkTags(content);

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'user-message' : 'bot-message';

        const avatarSrc = type === 'user' ? './ui/assets/chat/user.svg' : './ui/assets/chat/bot.svg';
        const avatarAlt = type === 'user' ? 'User' : 'Bot';

        // Check content type (for bot messages only)
        if (type === 'bot') {
            const contentType = this.getContentType(content);
            var hasHtml = contentType === 'html';
            var hasMarkdown = contentType === 'markdown';
        } else {
            var hasHtml = false;
            var hasMarkdown = false;
        }
        
        let actionButton = '';
        let displayContent = '';
        
        if (hasHtml) {
            const messageId = 'stored-msg-' + (Date.now()) + '-' + Math.random().toString(36).substr(2, 9);
            // Store raw HTML content in a data attribute
            actionButton = `<button class="view-html-btn" data-message-id="${messageId}" title="View as HTML">View HTML</button>`;
            messageDiv.setAttribute('data-message-id', messageId);
            messageDiv.setAttribute('data-message-content', content);
            
            // Display placeholder for HTML content
            displayContent = `<p><em>HTML content detected. Click 'View HTML' to render.</em></p>`;
        } else if (hasMarkdown) {
            const messageId = 'stored-msg-' + (Date.now()) + '-' + Math.random().toString(36).substr(2, 9);
            // Store raw markdown content in a data attribute
            actionButton = `<button class="view-markdown-btn" data-message-id="${messageId}" title="View as Markdown">View Markdown</button>`;
            messageDiv.setAttribute('data-message-id', messageId);
            messageDiv.setAttribute('data-message-content', content);
            
            // Show a preview of the content with basic formatting preserved
            const previewContent = this.createMarkdownPreview(content);
            displayContent = `<div class="markdown-preview">${previewContent}</div>`;
        } else {
            // Display regular escaped text for non-markdown/non-HTML content with proper newline handling
            const escapedContent = this.escapeHtml(content);
            const contentWithBreaks = escapedContent.replace(/\n/g, '<br>');
            displayContent = `<p>${contentWithBreaks}</p>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="${avatarAlt}" width="32" height="32">
            </div>
            <div class="message-content">
                ${displayContent}
                ${actionButton}
            </div>
        `;

        console.log('🚀 Appending message to DOM...');
        chatMessages.appendChild(messageDiv);
        
        console.log('✅ Message appended to DOM');
        this.scrollToBottom();

        // Store message in local array
        this.messages.push({
            type,
            content,
            timestamp: new Date()
        });
        console.log(`✅ ${type} message stored in local array`);
    }

    // Create a basic preview of markdown content for display in chat
    createMarkdownPreview(content) {
        if (!content || typeof content !== 'string') return '';
        
        // Filter out <think> tags first
        content = this.filterThinkTags(content);
        
        // Basic markdown-to-HTML conversion for preview
        let preview = this.escapeHtml(content);
        
        // Convert basic markdown patterns to HTML
        preview = preview
            // Headers (process larger headers first to avoid conflicts)
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Bold text (handle ** before * to avoid conflicts)
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
            // Italic text (after bold to avoid conflicts)
            .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
            .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>')
            // Bullet points (preserve indentation)
            .replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1• $2')
            // Numbered lists
            .replace(/^(\s*)(\d+)\.\s+(.+)$/gm, '$1$2. $3')
            // Inline code (before links to avoid conflicts)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            // Line breaks (preserve paragraph structure)
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap in paragraph tags if not already wrapped
        if (!preview.includes('<h') && !preview.includes('<p>')) {
            preview = `<p>${preview}</p>`;
        } else if (preview.includes('</p><p>')) {
            preview = `<p>${preview}</p>`;
        }
        
        return preview;
    }

    showTypingIndicator() {
        console.log('🚀 showTypingIndicator called');
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        console.log('chatMessages element:', chatMessages);
        if (!chatMessages) {
            console.log('❌ No chatMessages element found');
            return;
        }

        const typingDiv = document.createElement('div');
        typingDiv.className = 'bot-message typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <img src="./ui/assets/chat/bot.svg" alt="Bot" width="32" height="32">
            </div>
            <div class="message-content">
                <div class="loading-message">
                    <span>Thinking</span>
                    <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;

        console.log('🚀 Appending typing indicator to DOM...');
        chatMessages.appendChild(typingDiv);
        console.log('✅ Typing indicator appended');
        this.scrollToBottom();
        this.isTyping = true;
    }

    hideTypingIndicator() {
        const typingIndicator = this.shadowRoot.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }    async getAIResponse(userMessage) {
        console.log('🚀 getAIResponse called with:', userMessage);
        
        if (!this.currentChatSession) {
            console.error('❌ No current chat session for AI response');
            throw new Error('No active chat session');
        }
        
        try {
            console.log('🚀 Calling AI chat API...');
            const response = await window.apiMethods.post('/api/0.1.0/chat/ai-chat', {
                message: userMessage,
                chatSessionId: this.currentChatSession.id
            }, {
                baseUrl: 'http://localhost:8080'
            });
            
            if (response.status >= 200 && response.status < 300 && response.data) {
                const aiResponse = response.data;
                
                if (aiResponse.success && aiResponse.response) {
                    console.log('✅ AI response received:', aiResponse.response);
                    return aiResponse.response;
                } else {
                    console.error('❌ AI response failed:', aiResponse.error);
                    throw new Error(aiResponse.error || 'AI response generation failed');
                }
            } else {
                console.error('❌ API call failed:', response);
                throw new Error('Failed to get AI response from server');
            }
        } catch (error) {
            console.error('❌ Error calling AI chat API:', error);
            // Fallback to original mock response for debugging
            console.log('🔄 Falling back to mock response...');
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            let response = `I understand you said: "${userMessage}". `;
            
            if (this.selectedAgent.toolsCount > 0) {
                response += `I have access to ${this.selectedAgent.toolsCount} tools to help you. `;
            }
            
            if (this.selectedAgent.ragCount > 0) {
                response += `I can also reference ${this.selectedAgent.ragCount} knowledge base(s) for more detailed information. `;
            }
            
            response += "How else can I assist you? (Note: This is a fallback response due to an error with the AI service)";
            
            console.log('✅ Generated fallback response:', response);
            return response;
        }
    }

    scrollToBottom() {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages) return;

        chatMessages.innerHTML = `
            <div class="bot-message">
                <div class="message-avatar">
                    <img src="./ui/assets/chat/bot.svg" alt="Bot" width="32" height="32">
                </div>
                <div class="message-content">
                    <p style="color: var(--error-color, #ef4444);">${this.escapeHtml(message)}</p>
                </div>
            </div>
        `;
    }

    detectMarkdown(content) {
        console.log('🔍 Detecting markdown in content:', content?.substring(0, 200) + '...');
        
        // Strong markdown indicators (if any of these are found, it's definitely markdown)
        const strongMarkdownPatterns = [
            /#{1,6}\s+.+/,                   // Headers
            /```[\s\S]*?```/,                // Code blocks (non-HTML)
            /^\s*[-*+]\s+.+/m,               // Unordered lists (with content)
            /^\s*\d+\.\s+.+/m,               // Ordered lists (with content)
            /^\s*\|.+\|/m,                   // Tables
            /^\s*>\s+.+/m,                   // Blockquotes (with content)
            /^\s*[-*_]{3,}\s*$/m,            // Horizontal rules
            /\[[^\]\n]+\]\([^)\n]+\)/        // Links
        ];

        // Check for strong markdown patterns first
        for (const pattern of strongMarkdownPatterns) {
            if (pattern.test(content)) {
                console.log('✅ Markdown detected (strong pattern):', pattern.source);
                console.log('✅ Pattern match:', content.match(pattern)?.[0]);
                return true;
            }
        }

        // Weaker markdown patterns
        const weakMarkdownPatterns = [
            /\*\*[^*\n]+\*\*/,               // Bold text
            /\*[^*\n]+\*/,                   // Italic text
            /__[^_\n]+__/,                   // Bold with underscores
            /_[^_\n]+_/,                     // Italic with underscores
            /`[^`\n]+`/,                     // Inline code
            /!\[[^\]\n]*\]\([^)\n]+\)/,      // Images
            /\n\s*\n/,                       // Multiple line breaks (common in markdown)
            /~~[^~\n]+~~/                    // Strikethrough
        ];

        // Check if content contains multiple weak markdown patterns
        let patternCount = 0;
        let matchedPatterns = [];
        
        for (const pattern of weakMarkdownPatterns) {
            if (pattern.test(content)) {
                patternCount++;
                matchedPatterns.push(pattern.source);
            }
        }

        // Lower threshold for weak patterns - markdown is quite common
        const isMarkdown = patternCount >= 2;
        console.log(`📊 Markdown detection: ${patternCount} weak patterns matched:`, matchedPatterns);
        console.log(`🔍 Is markdown: ${isMarkdown}`);
        return isMarkdown;
    }

    detectHtml(content) {
        console.log('🔍 Detecting HTML in content:', content?.substring(0, 200) + '...');
        
        // Strong HTML indicators that should always trigger HTML view
        const strongHtmlPatterns = [
            /```html[\s\S]*?```/i,                          // HTML code blocks
            /<!DOCTYPE\s+html>/i,                           // DOCTYPE declaration
            /<html[\s\S]*?>/i,                              // HTML tag
            /<head[\s\S]*?>/i,                              // Head tag
            /<body[\s\S]*?>/i,                              // Body tag
            /<style[\s\S]*?>[\s\S]*?<\/style>/i,           // Style tags with content
            /<script[\s\S]*?>[\s\S]*?<\/script>/i,         // Script tags with content
        ];

        // Check for strong HTML indicators first
        let hasStrongHtmlPattern = false;
        let matchedPatterns = [];
        
        for (const pattern of strongHtmlPatterns) {
            if (pattern.test(content)) {
                hasStrongHtmlPattern = true;
                matchedPatterns.push(pattern.source);
                console.log('✅ HTML detected (strong pattern):', pattern.source);
                console.log('✅ Pattern match:', content.match(pattern)?.[0]?.substring(0, 100) + '...');
            }
        }

        // If we have strong HTML patterns, it's definitely HTML
        if (hasStrongHtmlPattern) {
            console.log(`📊 HTML detection: Strong patterns matched:`, matchedPatterns);
            console.log(`🔍 Is HTML: true (strong patterns)`);
            return true;
        }

        // Secondary HTML patterns (require multiple matches)
        const secondaryHtmlPatterns = [
            /<div[\s\S]*?>[\s\S]*?<\/div>/i,               // Div elements
            /<p[\s\S]*?>[\s\S]*?<\/p>/i,                   // Paragraph elements
            /<span[\s\S]*?>[\s\S]*?<\/span>/i,             // Span elements
            /<h[1-6][\s\S]*?>[\s\S]*?<\/h[1-6]>/i,         // Header elements
            /@keyframes\s+[\w-]+\s*\{/,                     // CSS keyframes
            /\.\w+[\s]*\{[\s\S]*?\}/,                       // CSS classes
            /#\w+[\s]*\{[\s\S]*?\}/,                        // CSS IDs
            /animation:\s*[\w-]+/,                          // CSS animations
            /transform:\s*[\w(),-\s]+/,                     // CSS transforms
            /background:\s*linear-gradient/,                // CSS gradients
        ];

        // Check secondary patterns (need multiple matches)
        let secondaryPatternCount = 0;
        let secondaryMatchedPatterns = [];
        for (const pattern of secondaryHtmlPatterns) {
            if (pattern.test(content)) {
                secondaryPatternCount++;
                secondaryMatchedPatterns.push(pattern.source);
            }
        }

        // Consider it HTML only if we have multiple secondary patterns
        const isHtml = secondaryPatternCount >= 3;
        console.log(`📊 HTML detection: ${secondaryPatternCount} secondary patterns matched:`, secondaryMatchedPatterns);
        console.log(`🔍 Is HTML: ${isHtml} (secondary patterns)`);
        return isHtml;
    }

    extractHtmlFromCodeBlocks(content) {
        if (!content) return '';
        
        // Filter out <think> tags first
        content = this.filterThinkTags(content);
        
        // First, try to extract HTML from code blocks
        const htmlBlockRegex = /```html\s*([\s\S]*?)\s*```/gi;
        const matches = content.match(htmlBlockRegex);
        
        if (matches && matches.length > 0) {
            // Extract the HTML content without the code block markers
            const extractedHtml = matches.map(match => {
                return match.replace(/```html\s*/gi, '').replace(/\s*```/g, '').trim();
            }).join('\n\n');
            
            console.log('✅ Extracted HTML from code blocks:', extractedHtml.substring(0, 200) + '...');
            return extractedHtml;
        }
        
        // If no HTML code blocks found, check if the entire content is wrapped in code block markers
        const simpleBlockRegex = /^```html\s*([\s\S]*?)\s*```$/gi;
        const simpleMatch = content.match(simpleBlockRegex);
        
        if (simpleMatch) {
            const cleanedHtml = content.replace(/^```html\s*/gi, '').replace(/\s*```$/g, '').trim();
            console.log('✅ Cleaned HTML from simple wrapper:', cleanedHtml.substring(0, 200) + '...');
            return cleanedHtml;
        }
        
        // If content starts and ends with code markers but no language specified
        if (content.trim().startsWith('```') && content.trim().endsWith('```')) {
            const cleaned = content.replace(/^```[a-zA-Z]*\s*/gi, '').replace(/\s*```$/g, '').trim();
            console.log('✅ Cleaned HTML from generic code block:', cleaned.substring(0, 200) + '...');
            return cleaned;
        }
        
        console.log('ℹ️ No code block markers found, returning content as-is');
        return content;
    }

    stripMarkdown(content) {
        if (!content) return '';

        // Filter out <think> tags first
        let text = this.filterThinkTags(content);

        // Remove code blocks first (to avoid processing their content)
        text = text.replace(/```[\s\S]*?```/g, '[Code Block]');
        
        // Remove inline code
        text = text.replace(/`([^`]+)`/g, '$1');
        
        // Remove headers
        text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');
        
        // Remove bold and italic
        text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
        text = text.replace(/\*([^*]+)\*/g, '$1');
        text = text.replace(/__([^_]+)__/g, '$1');
        text = text.replace(/_([^_]+)_/g, '$1');
        
        // Remove strikethrough
        text = text.replace(/~~([^~]+)~~/g, '$1');
        
        // Remove links but keep the text
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        
        // Remove images
        text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '[Image]');
        
        // Remove blockquotes
        text = text.replace(/^\s*>\s+(.+)$/gm, '$1');
        
        // Remove horizontal rules
        text = text.replace(/^\s*[-*_]{3,}\s*$/gm, '');
        
        // Remove list markers
        text = text.replace(/^\s*[-*+]\s+(.+)$/gm, '$1');
        text = text.replace(/^\s*\d+\.\s+(.+)$/gm, '$1');
        
        // Clean up multiple spaces and line breaks
        text = text.replace(/\n\s*\n/g, '\n');
        text = text.replace(/^\s+|\s+$/g, '');
        
        return text;
    }

    showMarkdownModal(messageId, content) {
        // Filter out <think> tags before displaying in modal
        content = this.filterThinkTags(content);
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'markdown-modal-overlay';
        modal.innerHTML = `
            <div class="markdown-modal">
                <div class="markdown-modal-header">
                    <h3>Markdown View</h3>
                    <div class="modal-actions">
                        <button class="close-markdown-btn">×</button>
                    </div>
                </div>
                <div class="markdown-modal-body">
                    <viki-markdown use-html></viki-markdown>
                </div>
            </div>
        `;

        // Add to body
        document.body.appendChild(modal);

        // Set the markdown content
        setTimeout(() => {
            const markdownComponent = modal.querySelector('viki-markdown');
            if (markdownComponent) {
                markdownComponent.setMarkdown(content);
            }
        }, 0);
        
        // Store content for potential use
        modal.setAttribute('data-markdown-content', content);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-markdown-btn');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Add escape key to close
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        console.log('📖 Markdown modal opened with ID:', messageId);
    }

    showHtmlModal(messageId, content) {
        console.log('🖥️ Opening HTML modal for message:', messageId);
        console.log('🖥️ Raw content:', content);
        
        // Filter out <think> tags before displaying in modal
        content = this.filterThinkTags(content);
        console.log('🖥️ Filtered content after removing <think> tags:', content);
        
        // Extract HTML from code blocks if present
        const extractedHtml = this.extractHtmlFromCodeBlocks(content);
        console.log('🖥️ Extracted HTML:', extractedHtml);
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'html-modal-overlay force-light-theme';
        modal.innerHTML = `
            <div class="html-modal force-light-theme">
                <div class="html-modal-header">
                    <h3>HTML View</h3>
                    <div class="modal-actions">
                        <button class="close-html-btn">×</button>
                    </div>
                </div>
                <div class="html-modal-body">
                    <viki-html allow-styles allow-scripts class="force-light-theme"></viki-html>
                </div>
            </div>
        `;

        // Add to body
        document.body.appendChild(modal);
        console.log('🖥️ Modal added to body');
        
        // Add a style tag to force override dark mode
        const styleOverride = document.createElement('style');
        styleOverride.textContent = `
            .html-modal-overlay viki-html .viki-html {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
            .html-modal-overlay viki-html .html-content {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
            .html-modal-overlay viki-html .html-content::before {
                display: none !important;
            }
            @media (prefers-color-scheme: dark) {
                .html-modal-overlay viki-html .viki-html {
                    --bg-color: #ffffff !important;
                    --text-color: #333333 !important;
                    --text-color-muted: #6a737d !important;
                    --border-color: #e1e4e8 !important;
                    --link-color: #0366d6 !important;
                    --code-bg-color: #f6f8fa !important;
                    --header-bg-color: #f6f8fa !important;
                    --alt-row-bg-color: #f9fafb !important;
                    background-color: #ffffff !important;
                    color: #333333 !important;
                }
                .html-modal-overlay viki-html .html-content {
                    background-color: #ffffff !important;
                    color: #333333 !important;
                }
                .html-modal-overlay viki-html .html-content::before {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(styleOverride);
        
        // Store style element for cleanup
        modal.setAttribute('data-style-override', 'true');
        modal._styleOverride = styleOverride;
        
        // Force apply styles directly via JavaScript with enhanced visibility
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.right = '0';
        modal.style.bottom = '0';
        modal.style.background = 'rgba(0, 0, 0, 0.8)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '99999';
        modal.style.backdropFilter = 'blur(2px)';
        
        // Style the inner modal for better visibility
        const innerModal = modal.querySelector('.html-modal');
        if (innerModal) {
            innerModal.style.background = 'white';
            innerModal.style.borderRadius = '12px';
            innerModal.style.maxWidth = '90vw';
            innerModal.style.maxHeight = '90vh';
            innerModal.style.width = '100%';
            innerModal.style.minHeight = '500px';
            innerModal.style.display = 'flex';
            innerModal.style.flexDirection = 'column';
            innerModal.style.overflow = 'hidden';
            innerModal.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3)';
        }
        
        // Force header styling to match Markdown modal
        const modalHeader = modal.querySelector('.html-modal-header');
        if (modalHeader) {
            modalHeader.style.backgroundColor = '#f9fafb';
            modalHeader.style.borderBottom = '1px solid #e5e7eb';
            modalHeader.style.padding = '1rem';
            modalHeader.style.display = 'flex';
            modalHeader.style.alignItems = 'center';
            modalHeader.style.justifyContent = 'space-between';
        }
        
        const modalTitle = modal.querySelector('.html-modal-header h3');
        if (modalTitle) {
            modalTitle.style.margin = '0';
            modalTitle.style.fontSize = '1.125rem';
            modalTitle.style.fontWeight = '600';
            modalTitle.style.color = '#111827';
        }
        
        const htmlCloseBtn = modal.querySelector('.close-html-btn');
        if (htmlCloseBtn) {
            htmlCloseBtn.style.background = 'none';
            htmlCloseBtn.style.border = 'none';
            htmlCloseBtn.style.fontSize = '1.5rem';
            htmlCloseBtn.style.color = '#6b7280';
            htmlCloseBtn.style.cursor = 'pointer';
            htmlCloseBtn.style.padding = '0.25rem';
            htmlCloseBtn.style.borderRadius = '4px';
            htmlCloseBtn.style.transition = 'all 0.2s ease';
        }
        
        console.log('🖥️ Enhanced modal styles applied');

        // Extract and set the HTML content
        setTimeout(() => {
            console.log('🖥️ Setting HTML content on viki-html component...');
            const htmlComponent = modal.querySelector('viki-html');
            if (htmlComponent) {
                console.log('🖥️ VikiHtml component found:', htmlComponent);
                // Extract HTML from code blocks if present
                const extractedHtml = this.extractHtmlFromCodeBlocks(content);
                console.log('🖥️ Setting extracted HTML content...');
                htmlComponent.setAttribute('html-content', extractedHtml);
                console.log('🖥️ HTML content attribute set');
                
                // Force a style update on the viki-html component
                htmlComponent.style.display = 'block';
                htmlComponent.style.width = '100%';
                htmlComponent.style.height = '100%';
                htmlComponent.style.overflow = 'auto';
                htmlComponent.style.backgroundColor = '#ffffff';
                
                // Force CSS variables to override dark mode
                htmlComponent.style.setProperty('--bg-color', '#ffffff', 'important');
                htmlComponent.style.setProperty('--text-color', '#333333', 'important');
                htmlComponent.style.setProperty('--text-color-muted', '#6a737d', 'important');
                htmlComponent.style.setProperty('--border-color', '#e1e4e8', 'important');
                htmlComponent.style.setProperty('--link-color', '#0366d6', 'important');
                htmlComponent.style.setProperty('--code-bg-color', '#f6f8fa', 'important');
                htmlComponent.style.setProperty('--header-bg-color', '#f6f8fa', 'important');
                htmlComponent.style.setProperty('--alt-row-bg-color', '#f9fafb', 'important');
                
                // Force white background on nested elements
                setTimeout(() => {
                    const vikiHtmlDiv = htmlComponent.querySelector('.viki-html');
                    if (vikiHtmlDiv) {
                        // Force all dark theme variables to light theme
                        const lightThemeVars = {
                            '--bg-color': '#ffffff',
                            '--text-color': '#333333',
                            '--text-color-muted': '#6a737d',
                            '--border-color': '#e1e4e8',
                            '--link-color': '#0366d6',
                            '--code-bg-color': '#f6f8fa',
                            '--header-bg-color': '#f6f8fa',
                            '--alt-row-bg-color': '#f9fafb',
                            '--button-bg-color': '#238636',
                            '--button-text-color': '#ffffff',
                            '--button-hover-bg-color': '#2ea043',
                            '--button-active-bg-color': '#1a7f37'
                        };
                        
                        // Apply to viki-html element
                        Object.entries(lightThemeVars).forEach(([prop, value]) => {
                            vikiHtmlDiv.style.setProperty(prop, value, 'important');
                        });
                        vikiHtmlDiv.style.backgroundColor = '#ffffff';
                        vikiHtmlDiv.style.color = '#333333';
                        
                        // Apply to html component as well
                        Object.entries(lightThemeVars).forEach(([prop, value]) => {
                            htmlComponent.style.setProperty(prop, value, 'important');
                        });
                    }
                    
                    const htmlContentDiv = htmlComponent.querySelector('.html-content');
                    if (htmlContentDiv) {
                        htmlContentDiv.style.backgroundColor = '#ffffff';
                        htmlContentDiv.style.color = '#333333';
                        
                        // Create ultra-specific style override for security indicator
                        const securityStyle = document.createElement('style');
                        securityStyle.textContent = `
                            div.html-modal-overlay viki-html.force-light-theme .html-content::before,
                            .html-modal-overlay .html-content::before,
                            .force-light-theme .html-content::before {
                                display: none !important;
                                content: none !important;
                                visibility: hidden !important;
                            }
                        `;
                        securityStyle.setAttribute('data-hide-security-ultra', 'true');
                        document.head.appendChild(securityStyle);
                        
                        // Store for cleanup
                        modal._securityStyle = securityStyle;
                        
                        // Add mutation observer to catch any dynamic style changes
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                                    const target = mutation.target;
                                    if (target.classList.contains('viki-html') || target.classList.contains('html-content')) {
                                        // Force light theme if dark theme is detected
                                        target.style.backgroundColor = '#ffffff';
                                        target.style.color = '#333333';
                                    }
                                }
                            });
                        });
                        
                        observer.observe(vikiHtmlDiv, { 
                            attributes: true, 
                            attributeFilter: ['style', 'class'],
                            subtree: true 
                        });
                        observer.observe(htmlContentDiv, { 
                            attributes: true, 
                            attributeFilter: ['style', 'class'],
                            subtree: true 
                        });
                        
                        // Store observer for cleanup
                        modal._styleObserver = observer;
                    }
                }, 50);
            } else {
                console.error('❌ VikiHtml component not found in modal');
            }
        }, 100);
        
        // Store content for potential use
        modal.setAttribute('data-html-content', content);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-html-btn');
        closeBtn.addEventListener('click', () => {
            // Clean up style override
            if (modal._styleOverride) {
                modal._styleOverride.remove();
            }
            if (modal._securityStyle) {
                modal._securityStyle.remove();
            }
            if (modal._styleObserver) {
                modal._styleObserver.disconnect();
            }
            modal.remove();
        });
        
        // Add hover effects for close button
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = '#e5e7eb';
            closeBtn.style.color = '#374151';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = 'transparent';
            closeBtn.style.color = '#6b7280';
        });

        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // Clean up style override
                if (modal._styleOverride) {
                    modal._styleOverride.remove();
                }
                if (modal._securityStyle) {
                    modal._securityStyle.remove();
                }
                if (modal._styleObserver) {
                    modal._styleObserver.disconnect();
                }
                modal.remove();
            }
        });

        // Add escape key to close
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                // Clean up style override
                if (modal._styleOverride) {
                    modal._styleOverride.remove();
                }
                if (modal._securityStyle) {
                    modal._securityStyle.remove();
                }
                if (modal._styleObserver) {
                    modal._styleObserver.disconnect();
                }
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        console.log('🖥️ HTML modal opened with ID:', messageId);
    }

    hasStrongHtmlPatterns(content) {
        // Only detect standalone HTML, not HTML within markdown code blocks
        const standaloneHtmlPatterns = [
            /<!DOCTYPE\s+html>/i,                           // DOCTYPE declaration
            /<html[\s\S]*?>/i,                              // HTML tag
            /<head[\s\S]*?>/i,                              // Head tag
            /<body[\s\S]*?>/i,                              // Body tag
            /<style[\s\S]*?>[\s\S]*?<\/style>/i,           // Style tags with content
            /<script[\s\S]*?>[\s\S]*?<\/script>/i,         // Script tags with content
        ];

        // Check if content has markdown structure indicators
        const hasMarkdownStructure = /#{1,6}\s+.+/.test(content) || // Headers
                                   /^\s*[-*+]\s+.+/m.test(content) || // Lists
                                   /^\s*\d+\.\s+.+/m.test(content) || // Numbered lists
                                   /^\s*\|.+\|/m.test(content); // Tables

        // If content has markdown structure, only consider HTML code blocks as HTML
        if (hasMarkdownStructure) {
            const htmlCodeBlockPattern = /```html[\s\S]*?```/i;
            if (htmlCodeBlockPattern.test(content)) {
                console.log('✅ HTML code block found within markdown structure');
                return true;
            }
            console.log('🔍 Markdown structure detected, ignoring standalone HTML patterns');
            return false;
        }

        // Otherwise, check for standalone HTML patterns
        for (const pattern of standaloneHtmlPatterns) {
            if (pattern.test(content)) {
                console.log('✅ Strong standalone HTML pattern found:', pattern.source);
                return true;
            }
        }
        
        // Also check for HTML code blocks in non-markdown content
        if (/```html[\s\S]*?```/i.test(content)) {
            console.log('✅ HTML code block found in non-markdown content');
            return true;
        }
        
        return false;
    }

    determineContentType(content) {
        // Check for markdown structure first
        const hasMarkdownHeaders = /#{1,6}\s+.+/.test(content);
        const hasMarkdownLists = /^\s*[-*+]\s+.+/m.test(content) || /^\s*\d+\.\s+.+/m.test(content);
        const hasMarkdownTables = /^\s*\|.+\|/m.test(content);
        const hasMarkdownQuotes = /^\s*>\s+.+/m.test(content);
        const hasMarkdownCodeBlocks = /```[\s\S]*?```/.test(content);
        
        const markdownStructureCount = [hasMarkdownHeaders, hasMarkdownLists, hasMarkdownTables, hasMarkdownQuotes, hasMarkdownCodeBlocks].filter(Boolean).length;
        
        // Check for HTML patterns
        const hasHtmlCodeBlocks = /```html[\s\S]*?```/i.test(content);
        const hasStandaloneHtml = /<!DOCTYPE\s+html>|<html[\s\S]*?>|<head[\s\S]*?>|<body[\s\S]*?>/i.test(content);
        const hasStyleScriptTags = /<style[\s\S]*?>[\s\S]*?<\/style>|<script[\s\S]*?>[\s\S]*?<\/script>/i.test(content);
        
        console.log('� Content analysis:', {
            markdownStructureCount,
            hasHtmlCodeBlocks,
            hasStandaloneHtml,
            hasStyleScriptTags,
            hasMarkdownHeaders,
            hasMarkdownLists
        });
        
        // Decision logic:
        // 1. If content has significant markdown structure AND HTML is in code blocks -> Markdown
        // 2. If content has standalone HTML elements (DOCTYPE, html, head, body) -> HTML
        // 3. If content has HTML code blocks but no markdown structure -> HTML
        // 4. If content has markdown structure but no HTML -> Markdown
        // 5. Otherwise -> Plain text
        
        if (markdownStructureCount >= 2 && hasHtmlCodeBlocks && !hasStandaloneHtml) {
            console.log('📝 Determined: Markdown (HTML in code blocks)');
            return 'markdown';
        }
        
        if (hasStandaloneHtml || hasStyleScriptTags) {
            console.log('🌐 Determined: HTML (standalone HTML elements)');
            return 'html';
        }
        
        if (hasHtmlCodeBlocks && markdownStructureCount < 2) {
            console.log('🌐 Determined: HTML (HTML code blocks, minimal markdown)');
            return 'html';
        }
        
        if (markdownStructureCount >= 1) {
            console.log('📝 Determined: Markdown');
            return 'markdown';
        }
        
        console.log('📄 Determined: Plain text');
        return 'text';
    }

    // Enhanced content type detection for markdown patterns
    getContentType(content) {
        console.log('🎯 Content type check for:', content?.substring(0, 150) + '...');
        
        // Filter out <think> tags before analyzing content type
        content = this.filterThinkTags(content);
        console.log('🎯 Content after filtering <think> tags:', content?.substring(0, 150) + '...');
        
        const trimmedContent = content.trim();
        
        // Check if it's pure HTML document (starts with HTML tags)
        const startsWithHtml = /^<!DOCTYPE|^<html|^<head|^<body/i.test(trimmedContent);
        
        // Check for specific Markdown formatting (excluding HTML code blocks)
        const hasHeaders = /#{1,6}\s/.test(content);
        const hasBold = /\*\*[^*]+\*\*|__[^_]+__/.test(content);
        const hasItalic = /\*[^*\n]+\*|_[^_\n]+_/.test(content);
        const hasLists = /^\s*[-*+]\s|^\s*\d+\.\s/m.test(content);
        const hasBlockquotes = /^\s*>\s/m.test(content);
        const hasLinks = /\[[^\]]+\]\([^)]+\)/.test(content);
        const hasNonHtmlCodeBlocks = /```(?!html)[a-z]*[\s\S]*?```/i.test(content);
        
        const hasOtherMarkdownFormatting = hasHeaders || hasBold || hasItalic || hasLists || hasBlockquotes || hasLinks || hasNonHtmlCodeBlocks;
        
        console.log('🔍 Markdown formatting check:');
        console.log('  - Headers:', hasHeaders);
        console.log('  - Bold:', hasBold);
        console.log('  - Italic:', hasItalic);
        console.log('  - Lists:', hasLists);
        console.log('  - Blockquotes:', hasBlockquotes);
        console.log('  - Links:', hasLinks);
        console.log('  - Non-HTML code blocks:', hasNonHtmlCodeBlocks);
        console.log('  - Has other Markdown formatting:', hasOtherMarkdownFormatting);
        
        // Check for HTML code blocks
        const hasHtmlCodeBlocks = /```html[\s\S]*?```/i.test(content);
        console.log('🔍 Has HTML code blocks:', hasHtmlCodeBlocks);
        
        // Logic:
        // 1. Pure HTML document (starts with HTML tags and no other Markdown) → HTML
        if (startsWithHtml && !hasOtherMarkdownFormatting) {
            console.log('✅ Pure HTML document - treating as HTML');
            return 'html';
        }
        
        // 2. HTML code blocks with no other Markdown formatting → HTML
        if (hasHtmlCodeBlocks && !hasOtherMarkdownFormatting) {
            console.log('✅ HTML code blocks with no other Markdown formatting - treating as HTML');
            return 'html';
        }
        
        // 3. Has other Markdown formatting → Markdown
        if (hasOtherMarkdownFormatting) {
            console.log('✅ Has other Markdown formatting - treating as MARKDOWN');
            return 'markdown';
        }
        
        // 4. Check for standalone HTML without any code blocks
        if (/<[a-z][^>]*>/i.test(content) && !hasHtmlCodeBlocks) {
            console.log('✅ Contains HTML tags without code blocks - treating as HTML');
            return 'html';
        }
        
        console.log('✅ Plain text - treating as TEXT');
        return 'text';
    }

    // Test the markdown detection with sample content
    testMarkdownDetection() {
        const testContent = `Here are the customer details for the account number "LEASE_AMORT_ADV_MON_DD1_03":

- **Customer ID**: 103017
- **First Name**: TEST
- **Middle Name**: (Not provided)
- **Last Name**: AUTOMATION
- **Gender**: UNDEFINED

Let me know if you need additional information!`;
        
        console.log('🧪 Testing markdown detection with sample content:');
        console.log('Content type:', this.getContentType(testContent));
        console.log('Preview:', this.createMarkdownPreview(testContent));
    }

    // Temporary test function to verify patterns
    testPatterns() {
        const testMarkdown = `
# Test Header
This is **bold** text and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
console.log('code block');
\`\`\`

[Link](http://example.com)
        `;
        
        const testHtml = `
\`\`\`html
<div>
  <h1>Hello World</h1>
  <p>This is HTML content</p>
</div>
\`\`\`
        `;
        
        console.log('🧪 Testing Markdown:');
        console.log('Result:', this.detectMarkdown(testMarkdown));
        
        console.log('🧪 Testing HTML:');
        console.log('Result:', this.detectHtml(testHtml));
        console.log('Strong HTML:', this.hasStrongHtmlPatterns(testHtml));
   }

    // Test function for think tag filtering
    testThinkTagFiltering() {
        console.log('🧪 Testing think tag filtering...');
        
        const testCases = [
            {
                name: 'Simple think tags',
                input: 'Before <think>This should be hidden</think> After',
                expected: 'Before  After'
            },
            {
                name: 'Multiline think tags',
                input: 'Start <think>\nMultiple\nlines\nof thinking\n</think> End',
                expected: 'Start  End'
            },
            {
                name: 'Multiple think tags',
                input: 'First <think>hidden1</think> middle <think>hidden2</think> last',
                expected: 'First  middle  last'
            },
            {
                name: 'Case insensitive',
                input: 'Test <THINK>Hidden</THINK> content',
                expected: 'Test  content'
            },
            {
                name: 'With spaces in tags',
                input: 'Before <think >Hidden content</think > After',
                expected: 'Before  After'
            },
            {
                name: 'No think tags',
                input: 'Regular content without think tags',
                expected: 'Regular content without think tags'
            }
        ];
        
        testCases.forEach(testCase => {
            const result = this.filterThinkTags(testCase.input);
            const trimmedResult = result.trim();
            const trimmedExpected = testCase.expected.trim();
            const passed = trimmedResult === trimmedExpected;
            
            console.log(`${passed ? '✅' : '❌'} ${testCase.name}:`);
            console.log(`  Input: "${testCase.input}"`);
            console.log(`  Expected: "${trimmedExpected}"`);
            console.log(`  Got: "${trimmedResult}"`);
            console.log(`  Passed: ${passed}`);
        });
    }

    // ...existing code...
}

// Define the custom element
customElements.define('viki-chat-canvas', VikiChatCanvas);

export { VikiChatCanvas };