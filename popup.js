class MailMindPopup {
    constructor() {
        this.apiKey = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        try {
            await this.loadApiKey();
            this.setupEventListeners();
            await this.checkGmailTab();
        } catch (error) {
            console.error('MailMind: Failed to initialize popup:', error);
            this.showError('Failed to initialize extension: ' + error.message);
        }
    }

    async loadApiKey() {
        try {
            const result = await chrome.storage.local.get(['geminiApiKey']);
            this.apiKey = result.geminiApiKey;
            
            if (!this.apiKey) {
                this.showApiSetup();
            } else {
                this.showMainContent();
                // Don't auto-load on init, wait for user action
            }
        } catch (error) {
            console.error('Error loading API key:', error);
            this.showError('Failed to load API key');
        }
    }

    setupEventListeners() {
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.toggleApiSetup();
        });

        document.getElementById('saveApiKey').addEventListener('click', () => {
            this.saveApiKey();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            if (!this.isLoading) {
                this.loadEmailSummary();
            }
        });

        // Enter key support for API key input
        document.getElementById('apiKey').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveApiKey();
            }
        });
    }

    showApiSetup() {
        document.getElementById('apiSetup').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
    }

    showMainContent() {
        document.getElementById('apiSetup').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    }

    toggleApiSetup() {
        const apiSetup = document.getElementById('apiSetup');
        if (apiSetup.style.display === 'none') {
            this.showApiSetup();
            document.getElementById('apiKey').value = this.apiKey || '';
        } else {
            this.showMainContent();
        }
    }

    async saveApiKey() {
        const apiKeyInput = document.getElementById('apiKey');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showError('Please enter a valid API key');
            return;
        }

        // Show loading state while testing
        const saveButton = document.getElementById('saveApiKey');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Testing...';
        saveButton.disabled = true;

        try {
            // Test the API key
            const isValid = await this.testApiKey(apiKey);
            if (isValid) {
                this.apiKey = apiKey;
                await chrome.storage.local.set({ geminiApiKey: apiKey });
                this.hideError();
                this.showMainContent();
                // Auto-load email summary after successful API key setup
                setTimeout(() => this.loadEmailSummary(), 500);
            } else {
                this.showError('Invalid API key. Please check and try again.');
            }
        } catch (error) {
            console.error('Error testing API key:', error);
            this.showError('Failed to test API key: ' + error.message);
        } finally {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }
    }

    async testApiKey(apiKey) {
        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Test connection'
                        }]
                    }]
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error('API key test failed:', error);
            return false;
        }
    }

    async checkGmailTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('mail.google.com')) {
                this.showError('Please open Gmail to use MailMind');
                return false;
            }
            this.hideError();
            return true;
        } catch (error) {
            console.error('Error checking Gmail tab:', error);
            this.showError('Unable to access current tab');
            return false;
        }
    }

    async loadEmailSummary() {
        if (this.isLoading) {
            console.log('Already loading, skipping request');
            return;
        }

        if (!this.apiKey) {
            this.showApiSetup();
            return;
        }

        if (!await this.checkGmailTab()) {
            return;
        }

        this.isLoading = true;
        this.showLoading(true);
        this.hideError();

        // Update button state
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshIcon = document.getElementById('refreshIcon');
        refreshBtn.disabled = true;
        refreshIcon.textContent = '⏳';

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            console.log('MailMind: Requesting emails from tab', tab.id);
            
            // Add timeout to the message sending
            const response = await Promise.race([
                chrome.tabs.sendMessage(tab.id, { action: 'getEmailsToday' }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
                )
            ]);

            console.log('MailMind: Received response:', response);

            if (response.error) {
                throw new Error(response.error);
            }

            if (!response.emails || response.emails.length === 0) {
                this.showEmptyState();
                // Still update counts to show 0
                document.getElementById('emailCount').textContent = '0';
                document.getElementById('unreadCount').textContent = '0';
                return;
            }

            // Update stats - this should fix the incrementing issue
            const emailCount = response.emails.length;
            const unreadCount = response.unreadCount || 0;
            
            console.log('MailMind: Updating UI with', emailCount, 'emails,', unreadCount, 'unread');
            
            document.getElementById('emailCount').textContent = emailCount.toString();
            document.getElementById('unreadCount').textContent = unreadCount.toString();

            // Generate summaries
            await this.generateSummaries(response.emails);

        } catch (error) {
            console.error('Error loading email summary:', error);
            
            // Handle specific error cases
            if (error.message.includes('Could not establish connection')) {
                this.showError('MailMind content script not loaded. Please refresh Gmail and try again.');
            } else if (error.message.includes('timeout')) {
                this.showError('Request timed out. Gmail may be slow to load. Please try again.');
            } else {
                this.showError('Failed to load emails: ' + error.message);
            }
            
            // Reset counts on error
            document.getElementById('emailCount').textContent = '-';
            document.getElementById('unreadCount').textContent = '-';
        } finally {
            this.isLoading = false;
            this.showLoading(false);
            
            // Reset button state
            refreshBtn.disabled = false;
            refreshIcon.textContent = '🔄';
        }
    }

    async generateSummaries(emails) {
        const summariesList = document.getElementById('summariesList');
        summariesList.innerHTML = '';

        // Show progress
        const progressDiv = document.createElement('div');
        progressDiv.className = 'summary-progress';
        progressDiv.textContent = `Generating AI summaries for ${emails.length} today's emails...`;
        summariesList.appendChild(progressDiv);

        let processedCount = 0;
        const totalEmails = Math.min(emails.length, 10);

        for (const email of emails.slice(0, 10)) { // Limit to 10 emails
            try {
                const summary = await this.callGeminiAPI(
                    `Summarize the following email received TODAY in 1-2 sentences. Focus on the key points and any action items:\n\nFrom: ${email.sender}\nSubject: ${email.subject}\n\nContent: ${email.preview}\n\nTime received: ${email.time}`
                );

                const summaryElement = this.createSummaryElement(email, summary);
                
                // Replace progress or append
                if (processedCount === 0) {
                    summariesList.removeChild(progressDiv);
                }
                
                summaryElement.setAttribute('data-email-time', email.time || '');
                summariesList.appendChild(summaryElement);
                processedCount++;
                
                // Update progress if there are more emails
                if (processedCount < totalEmails) {
                    const remainingDiv = document.createElement('div');
                    remainingDiv.className = 'summary-progress';
                    remainingDiv.textContent = `Processing today's emails... (${processedCount}/${totalEmails})`;
                    summariesList.appendChild(remainingDiv);
                }
                
            } catch (error) {
                console.error('Error generating summary for email:', error);
                const summaryElement = this.createSummaryElement(email, 'Unable to generate summary - ' + error.message);
                
                if (processedCount === 0 && summariesList.contains(progressDiv)) {
                    summariesList.removeChild(progressDiv);
                }
                
                summariesList.appendChild(summaryElement);
                processedCount++;
            }
            
            // Small delay to prevent rate limiting
            await this.delay(100);
        }
        
        // Remove any remaining progress indicators
        const remainingProgress = summariesList.querySelector('.summary-progress');
        if (remainingProgress) {
            summariesList.removeChild(remainingProgress);
        }

        // Add a note about today's emails
        if (emails.length > 0) {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'summary-note';
            noteDiv.innerHTML = `<small>📅 Showing ${emails.length} emails received today only</small>`;
            summariesList.appendChild(noteDiv);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createSummaryElement(email, summary) {
        const div = document.createElement('div');
        div.className = 'summary-item';
        
        const isUnread = email.isUnread ? 'unread' : '';
        
        div.innerHTML = `
            <div class="summary-header ${isUnread}">
                <span class="sender">${this.escapeHtml(email.sender || 'Unknown Sender')}</span>
                <span class="time">${this.escapeHtml(email.time || '')}</span>
            </div>
            <div class="summary-subject">${this.escapeHtml(email.subject || 'No Subject')}</div>
            <div class="summary-text">${this.escapeHtml(summary)}</div>
        `;
        
        return div;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async callGeminiAPI(prompt) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.4,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 200,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            throw new Error('No content generated by API');
        }
        
        return generatedText;
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('summariesSection').style.display = show ? 'none' : 'block';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
    }

    showEmptyState() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('summariesSection').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('errorState').style.display = 'none';
    }

    showError(message) {
        console.error('MailMind: Showing error:', message);
        
        // Show error in API setup if visible
        const apiError = document.getElementById('apiError');
        const apiSetup = document.getElementById('apiSetup');
        
        if (apiSetup && apiSetup.style.display !== 'none') {
            if (apiError) {
                apiError.textContent = message;
                apiError.style.display = 'block';
            }
        } else {
            // Show in main error state
            document.getElementById('loading').style.display = 'none';
            document.getElementById('summariesSection').style.display = 'none';
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('errorState').style.display = 'block';
            document.getElementById('errorMessage').textContent = message;
        }
    }

    hideError() {
        const apiError = document.getElementById('apiError');
        if (apiError) {
            apiError.style.display = 'none';
        }
        document.getElementById('errorState').style.display = 'none';
    }
}

// Initialize the popup when DOM is loaded with error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        new MailMindPopup();
    } catch (error) {
        console.error('Failed to initialize MailMind popup:', error);
    }
});