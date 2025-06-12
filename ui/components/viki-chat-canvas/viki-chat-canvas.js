import { BaseComponent } from '../base/base.js';
import { VikiMarkdown } from '../viki-markdown/viki-markdown.js';

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

        // Event delegation for markdown buttons
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

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'user-message' : 'bot-message';
        
        const avatarSrc = type === 'user' ? './ui/assets/chat/user.svg' : './ui/assets/chat/bot.svg';
        const avatarAlt = type === 'user' ? 'User' : 'Bot';

        // Check if the content looks like markdown (for bot messages only)
        const hasMarkdown = type === 'bot' && this.detectMarkdown(content);
        
        let markdownButton = '';
        let displayContent = '';
        
        if (hasMarkdown) {
            const messageId = 'stored-msg-' + (message.id || Date.now()) + '-' + Math.random().toString(36).substr(2, 9);
            // Store raw markdown content in a data attribute
            markdownButton = `<button class="view-markdown-btn" data-message-id="${messageId}" title="View as Markdown">View Markdown</button>`;
            messageDiv.setAttribute('data-message-id', messageId);
            messageDiv.setAttribute('data-message-content', content);
            
            // Display placeholder instead of stripped markdown
            displayContent = `<p><em>Markdown content hidden. Click 'View Markdown' to view.</em></p>`;
        } else {
            // Display regular escaped text for non-markdown content
            displayContent = `<p>${this.escapeHtml(content)}</p>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="${avatarAlt}" width="32" height="32">
            </div>
            <div class="message-content">
                ${displayContent}
                ${markdownButton}
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

    addMessage(type, content) {
        console.log(`🚀 addMessage called with type: ${type}, content: ${content}`);
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        console.log('chatMessages element:', chatMessages);
        if (!chatMessages) {
            console.log('❌ No chatMessages element found in addMessage');
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'user-message' : 'bot-message';

        const avatarSrc = type === 'user' ? './ui/assets/chat/user.svg' : './ui/assets/chat/bot.svg';
        const avatarAlt = type === 'user' ? 'User' : 'Bot';

        // Check if the content looks like markdown (for bot messages only)
        const hasMarkdown = type === 'bot' && this.detectMarkdown(content);
        
        let markdownButton = '';
        let displayContent = '';
        
        if (hasMarkdown) {
            const messageId = 'stored-msg-' + (Date.now()) + '-' + Math.random().toString(36).substr(2, 9);
            // Store raw markdown content in a data attribute
            markdownButton = `<button class="view-markdown-btn" data-message-id="${messageId}" title="View as Markdown">View Markdown</button>`;
            messageDiv.setAttribute('data-message-id', messageId);
            messageDiv.setAttribute('data-message-content', content);
            
            // Display placeholder and hide markdown in chat view
            displayContent = `<p><em>Markdown content hidden. Click 'View Markdown' to view.</em></p>`;
        } else {
            // Display regular escaped text for non-markdown content
            displayContent = `<p>${this.escapeHtml(content)}</p>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="${avatarAlt}" width="32" height="32">
            </div>
            <div class="message-content">
                ${displayContent}
                ${markdownButton}
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
        console.log('🔍 Detecting markdown in content:', content?.substring(0, 100) + '...');
        
        // Simple markdown detection patterns
        const markdownPatterns = [
            /#{1,6}\s+.+/,                    // Headers (# ## ### etc.)
            /\*\*[^*\n]+\*\*/,               // Bold text
            /\*[^*\n]+\*/,                   // Italic text
            /__[^_\n]+__/,                   // Bold with underscores
            /_[^_\n]+_/,                     // Italic with underscores
            /`[^`\n]+`/,                     // Inline code
            /```[\s\S]*?```/,                // Code blocks
            /^\s*[-*+]\s+/m,                 // Unordered lists
            /^\s*\d+\.\s+/m,                 // Ordered lists
            /\[[^\]\n]+\]\([^)\n]+\)/,       // Links
            /!\[[^\]\n]*\]\([^)\n]+\)/,      // Images
            /^\s*>\s+/m,                     // Blockquotes
            /^\s*[-*_]{3,}\s*$/m,            // Horizontal rules
            /^\s*\|.+\|/m,                   // Tables
            /\n\s*\n/,                       // Multiple line breaks (common in markdown)
            /~~[^~\n]+~~/                    // Strikethrough
        ];

        // Check if content contains multiple markdown patterns or significant formatting
        let patternCount = 0;
        let matchedPatterns = [];
        
        for (const pattern of markdownPatterns) {
            if (pattern.test(content)) {
                patternCount++;
                matchedPatterns.push(pattern.source);
                // If we find headers, code blocks, lists, or tables, it's likely markdown
                if (pattern.source.includes('#{1,6}') || 
                    pattern.source.includes('```') || 
                    pattern.source.includes('[-*+]') ||
                    pattern.source.includes('\\d+\\.') ||
                    pattern.source.includes('\\|.+\\|')) {
                    console.log('✅ Markdown detected (strong pattern):', pattern.source);
                    return true;
                }
            }
        }

        // If we have multiple markdown patterns, consider it markdown
        const isMarkdown = patternCount >= 2;
        console.log(`📊 Markdown detection: ${patternCount} patterns matched:`, matchedPatterns);
        console.log(`🔍 Is markdown: ${isMarkdown}`);
        return isMarkdown;
    }

    stripMarkdown(content) {
        if (!content) return '';

        let text = content;

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

    copyMarkdownContent(messageId, button) {
        const modal = button.closest('.markdown-modal-overlay');
        const content = modal.getAttribute('data-markdown-content');
        
        if (navigator.clipboard && content) {
            navigator.clipboard.writeText(content).then(() => {
                // Show feedback
                const originalText = button.textContent;
                button.textContent = '✅ Copied!';
                button.style.background = '#10b981';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy content: ', err);
                // Fallback for older browsers
                this.fallbackCopyTextToClipboard(content, button);
            });
        } else {
            this.fallbackCopyTextToClipboard(content, button);
        }
    }

    fallbackCopyTextToClipboard(text, button) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                const originalText = button.textContent;
                button.textContent = '✅ Copied!';
                button.style.background = '#10b981';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '';
                }, 2000);
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    }
}

// Define the custom element
customElements.define('viki-chat-canvas', VikiChatCanvas);

export { VikiChatCanvas };