import { BaseComponent } from '../base/base.js';

class VikiChatCanvas extends BaseComponent {
    constructor() {
        super('viki-chat-canvas');
        this.agents = [];
        this.selectedAgent = null;
        this.messages = [];
        this.isTyping = false;
        this.currentChatSession = null;
    }

    async connectedCallback() {
        try {
            const shadowRoot = await super.connectedCallback();
            if (shadowRoot) {
                this.setupEventListeners();
                this.setupChatSessionEventListeners();
                await this.loadAgents();
                
                // Check if there's a session ID in the data attribute
                const sessionId = this.getAttribute('data-session-id');
                if (sessionId) {
                    console.log('🚀 Chat canvas initializing with session ID:', sessionId);
                    await this.loadChatSession(sessionId);
                }
            }
        } catch (error) {
            console.error('Error in VikiChatCanvas connectedCallback:', error);
        }
    }

    setupEventListeners() {
        const agentSelect = this.shadowRoot.querySelector('#agentSelect');
        const messageInput = this.shadowRoot.querySelector('#messageInput');
        const sendButton = this.shadowRoot.querySelector('#sendButton');
        const chatFooter = this.shadowRoot.querySelector('#chatFooter');

        // Agent selection handler
        agentSelect?.addEventListener('change', (e) => {
            this.handleAgentSelection(e.target.value);
        });

        // Message input handlers
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendButton?.addEventListener('click', () => {
            this.sendMessage();
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
            
            // Only initialize a new chat session if we don't have one active
            if (!this.currentChatSession) {
                this.initializeChatSession();
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

    initializeChatSession() {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages || !this.selectedAgent) return;

        // Clear messages and show agent introduction
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
    }

    displayStoredMessage(message) {
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

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="${avatarAlt}" width="32" height="32">
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(content)}</p>
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
        const messageInput = this.shadowRoot.querySelector('#messageInput');
        if (!messageInput || !this.selectedAgent || !this.currentChatSession) return;

        const messageText = messageInput.value.trim();
        if (!messageText) return;

        // Add user message to chat
        this.addMessage('user', messageText);
        messageInput.value = '';

        // Save user message to database
        await this.saveMessageToDatabase('USER', messageText);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Here you would typically call your chat API
            // For now, we'll simulate a response
            const agentResponse = await this.simulateAgentResponse(messageText);
            
            // Hide typing indicator before showing response
            this.hideTypingIndicator();
            
            // Add the bot response message
            this.addMessage('bot', agentResponse);
            
            // Save agent response to database
            await this.saveMessageToDatabase('AI', agentResponse);
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            const errorMessage = 'Sorry, I encountered an error while processing your message. Please try again.';
            this.addMessage('bot', errorMessage);
            // Save error message to database
            await this.saveMessageToDatabase('AI', errorMessage);
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
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'user-message' : 'bot-message';

        const avatarSrc = type === 'user' ? './ui/assets/chat/user.svg' : './ui/assets/chat/bot.svg';
        const avatarAlt = type === 'user' ? 'User' : 'Bot';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="${avatarAlt}" width="32" height="32">
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(content)}</p>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Store message in local array
        this.messages.push({
            type,
            content,
            timestamp: new Date()
        });
    }

    showTypingIndicator() {
        const chatMessages = this.shadowRoot.querySelector('#chatMessages');
        if (!chatMessages) return;

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

        chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
        this.isTyping = true;
    }

    hideTypingIndicator() {
        const typingIndicator = this.shadowRoot.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }

    async simulateAgentResponse(userMessage) {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Generate a simple response (in a real implementation, this would call your chat API)
        let response = `I understand you said: "${userMessage}". `;
        
        if (this.selectedAgent.toolsCount > 0) {
            response += `I have access to ${this.selectedAgent.toolsCount} tools to help you. `;
        }
        
        if (this.selectedAgent.ragCount > 0) {
            response += `I can also reference ${this.selectedAgent.ragCount} knowledge base(s) for more detailed information. `;
        }
        
        response += "How else can I assist you?";

        return response;
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
}

// Define the custom element
customElements.define('viki-chat-canvas', VikiChatCanvas);

export { VikiChatCanvas };