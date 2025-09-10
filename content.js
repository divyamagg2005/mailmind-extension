class GmailContentScript {
    constructor() {
        this.observer = null;
        this.currentEmailId = null;
        this.currentSidebar = null;
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.apiKey = null;
        this.init();
    }

    async init() {
        await this.delay(2000);
        await this.loadApiKey();
        this.setupMessageListener();
        this.startObservingGmail();
        this.isInitialized = true;
        console.log('MailMind content script initialized');
    }

    async loadApiKey() {
        try {
            const result = await chrome.storage.local.get(['geminiApiKey']);
            this.apiKey = result.geminiApiKey;
        } catch (error) {
            console.error('Error loading API key:', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getEmailsToday') {
                console.log('MailMind: Received request for emails');
                this.getEmailsFromToday()
                    .then(result => {
                        console.log('MailMind: Sending response:', result);
                        sendResponse(result);
                    })
                    .catch(error => {
                        console.error('MailMind: Error getting emails:', error);
                        sendResponse({ error: error.message });
                    });
                return true;
            }
        });
    }

    async getEmailsFromToday() {
        try {
            await this.waitForGmailLoadWithRetries();
            const emails = [];
            const emailRows = await this.getEmailRowsWithFallbacks();
            
            console.log('MailMind debug – emailRows found:', emailRows.length);
            
            if (emailRows.length === 0) {
                return {
                    emails: [],
                    debug: 'No email rows found in Gmail interface'
                };
            }
            
            for (const row of emailRows) {
                const emailData = this.extractEmailData(row);
                if (emailData) {
                    if (this.isFromToday(emailData.time)) {
                        emails.push(emailData);
                    }
                }
            }

            console.log('MailMind: Found', emails.length, 'emails today');

            return {
                emails: emails,
                debug: `Processed ${emailRows.length} rows, found ${emails.length} today's emails`
            };
        } catch (error) {
            console.error('Error getting emails:', error);
            return { 
                error: error.message,
                emails: []
            };
        }
    }

    async waitForGmailLoadWithRetries() {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                await this.waitForGmailLoad();
                return;
            } catch (error) {
                console.log(`MailMind: Gmail load attempt ${attempt + 1} failed`);
                if (attempt === this.maxRetries - 1) {
                    throw error;
                }
                await this.delay(1000 * (attempt + 1));
            }
        }
    }

    waitForGmailLoad() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 30;
            let attempts = 0;

            const checkGmail = () => {
                attempts++;
                const gmailSelectors = [
                    '[role="main"]', '.nH', '[gh="tl"]', '.aeJ', '.AO', '.Tm.aeJ', '[jscontroller="SoVkNd"]'
                ];
                
                let gmailContent = null;
                for (const selector of gmailSelectors) {
                    gmailContent = document.querySelector(selector);
                    if (gmailContent) break;
                }
                
                if (gmailContent) {
                    console.log('MailMind: Gmail interface detected');
                    resolve();
                } else if (attempts < maxAttempts) {
                    setTimeout(checkGmail, 500);
                } else {
                    reject(new Error('Gmail interface not found'));
                }
            };

            checkGmail();
        });
    }

    async getEmailRowsWithFallbacks() {
        const strategies = [
            () => this.getEmailRowsStrategy1(),
            () => this.getEmailRowsStrategy2(),
            () => this.getEmailRowsStrategy3(),
            () => this.getEmailRowsStrategy4()
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const rows = await strategies[i]();
                if (rows.length > 0) {
                    console.log(`MailMind: Strategy ${i + 1} found ${rows.length} email rows`);
                    return rows.slice(0, 50);
                }
            } catch (error) {
                console.log(`MailMind: Strategy ${i + 1} failed:`, error.message);
            }
        }
        return [];
    }

    getEmailRowsStrategy1() {
        const selectors = [
            'tr[jsaction*="mouseenter"]', 'tr[jsaction*="click"]', '.zA', '[data-legacy-thread-id]',
            '.Cp', 'tr.zA', 'tr.yW', '.yW', '[role="listitem"]', '[jsmodel="SzKmE"]'
        ];

        for (const selector of selectors) {
            const rows = document.querySelectorAll(selector);
            if (rows.length > 0) {
                return Array.from(rows).filter(row => {
                    const text = row.textContent;
                    return text && text.length > 10 && !text.includes('Compose') && !text.includes('Sent');
                });
            }
        }
        return [];
    }

    getEmailRowsStrategy2() {
        const tables = document.querySelectorAll('table[role="grid"], table.F');
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length > 1) {
                return Array.from(rows).slice(1).filter(row => {
                    return row.cells && row.cells.length > 2;
                });
            }
        }
        return [];
    }

    getEmailRowsStrategy3() {
        const conversations = document.querySelectorAll('[data-thread-id], [data-legacy-thread-id]');
        if (conversations.length > 0) {
            return Array.from(conversations);
        }
        return [];
    }

    getEmailRowsStrategy4() {
        const elements = document.querySelectorAll('[aria-label*="email"], [aria-label*="message"], [aria-label*="conversation"]');
        return Array.from(elements).filter(el => {
            const ariaLabel = el.getAttribute('aria-label') || '';
            return ariaLabel.includes('@') || ariaLabel.includes('unread') || ariaLabel.includes('from');
        });
    }

    extractEmailData(row) {
        try {
            const emailData = {
                sender: this.extractSender(row),
                subject: this.extractSubject(row),
                preview: this.extractPreview(row),
                time: this.extractTime(row),
                isUnread: this.extractUnreadStatus(row)
            };

            if (!emailData.sender && !emailData.subject && !emailData.preview) {
                return null;
            }

            return emailData;
        } catch (error) {
            console.error('Error extracting email data:', error);
            return null;
        }
    }

    extractSender(row) {
        const senderSelectors = [
            '[email]', '.yW', '.yP', '[name]', '.go span[email]', 
            '.bA4 span', '.a4W span', '.yX span'
        ];

        for (const selector of senderSelectors) {
            const el = row.querySelector(selector);
            if (el) {
                return el.getAttribute('email') || 
                       el.getAttribute('name') || 
                       el.getAttribute('title') || 
                       el.textContent.trim();
            }
        }

        const text = row.textContent || '';
        const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
            return emailMatch[0];
        }

        return '';
    }

    extractSubject(row) {
        const subjectSelectors = [
            '.bog', '[data-thread-perm-id] .y6 span', '.y6 span', '.y6',
            '.aYS', '.Zt', '.a4W .ao9', '.bqe span'
        ];

        for (const selector of subjectSelectors) {
            const el = row.querySelector(selector);
            if (el && el.textContent.trim()) {
                return el.textContent.trim();
            }
        }
        return '';
    }

    extractPreview(row) {
        const previewSelectors = [
            '.y2', '.bog + span', '.y6 + .y2', '.aYS + .y2', '.Zt + span', '.snippetText'
        ];

        for (const selector of previewSelectors) {
            const el = row.querySelector(selector);
            if (el && el.textContent.trim()) {
                return el.textContent.trim();
            }
        }
        return '';
    }

    extractTime(row) {
        const timeSelectors = [
            'time', 'td.xW span', '.xW span', '.xY span', '[title*=":"]',
            '.xz', '.g3 span', '.byg span', 'span[title]', '.xY', '.xW'
        ];

        for (const selector of timeSelectors) {
            const el = row.querySelector(selector);
            if (el) {
                let timeText = el.getAttribute('title');
                if (timeText && timeText.trim()) {
                    timeText = this.cleanTimeText(timeText);
                    if (this.isValidTimeText(timeText)) {
                        return timeText;
                    }
                }
                
                timeText = el.textContent;
                if (timeText && timeText.trim()) {
                    timeText = this.cleanTimeText(timeText);
                    if (this.isValidTimeText(timeText)) {
                        return timeText;
                    }
                }
            }
        }

        const ariaLabel = row.getAttribute('aria-label') || '';
        if (ariaLabel) {
            const timePatterns = [
                /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/g,
                /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s*\d{4})?)\b/g,
                /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{4})?)\b/g,
                /\b(yesterday)\b/gi, /\b(today)\b/gi, /(\d{1,2}\/\d{1,2}\/\d{2,4})/g
            ];

            for (const pattern of timePatterns) {
                const matches = ariaLabel.match(pattern);
                if (matches && matches.length > 0) {
                    const timeText = this.cleanTimeText(matches[matches.length - 1]);
                    if (this.isValidTimeText(timeText)) {
                        return timeText;
                    }
                }
            }
        }

        const rowText = row.textContent || '';
        const timeInRowPattern = /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\b/;
        const match = rowText.match(timeInRowPattern);
        if (match) {
            return this.cleanTimeText(match[1]);
        }

        return '';
    }

    isValidTimeText(timeText) {
        if (!timeText || timeText.length < 2) return false;
        const hasTime = /\d{1,2}:\d{2}/.test(timeText);
        const hasDate = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|today|yesterday|\d{1,2}\/\d{1,2})/i.test(timeText);
        return hasTime || hasDate;
    }

    extractUnreadStatus(row) {
        const unreadIndicators = [
            () => row.classList.contains('zE'),
            () => row.classList.contains('yW'),
            () => row.querySelector('.yW') !== null,
            () => row.querySelector('[style*="font-weight: bold"]') !== null,
            () => row.querySelector('[style*="font-weight:bold"]') !== null,
            () => row.querySelector('.zE') !== null,
            () => row.style.fontWeight === 'bold',
            () => {
                const ariaLabel = row.getAttribute('aria-label') || '';
                return ariaLabel.toLowerCase().includes('unread');
            }
        ];

        return unreadIndicators.some(indicator => {
            try {
                return indicator();
            } catch {
                return false;
            }
        });
    }

    isFromToday(timeText) {
        const text = this.cleanTimeText(timeText);
        if (!text) return false;

        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth();
        const todayYear = today.getFullYear();
        const lower = text.toLowerCase();

        try {
            if (lower.includes('yesterday')) return false;
            if (lower.includes('today')) return true;
            if (/^\d{1,2}:\d{2}\s*(?:am|pm)?$/i.test(text)) return true;

            const monthShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            const monthLong = ['january','february','march','april','may','june','july','august','september','october','november','december'];
            const monthIdxShort = monthShort.findIndex(m => lower.includes(m));
            const monthIdxLong = monthLong.findIndex(m => lower.includes(m));
            const monthIdx = monthIdxShort !== -1 ? monthIdxShort : monthIdxLong;
            
            if (monthIdx !== -1) {
                const dayMatch = lower.match(/\b(\d{1,2})\b/);
                if (dayMatch) {
                    const d = parseInt(dayMatch[1], 10);
                    if (d === todayDay && monthIdx === todayMonth) return true;
                    return false;
                }
            }

            const slash = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
            if (slash) {
                const a = parseInt(slash[1], 10);
                const b = parseInt(slash[2], 10);
                const y = slash[3] ? parseInt(slash[3], 10) : todayYear;
                const yNorm = y < 100 ? 2000 + y : y;
                if (a - 1 === todayMonth && b === todayDay && yNorm === todayYear) return true;
                if (b - 1 === todayMonth && a === todayDay && yNorm === todayYear) return true;
                return false;
            }

            const iso = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
            if (iso) {
                const yi = parseInt(iso[1], 10);
                const mi = parseInt(iso[2], 10) - 1;
                const di = parseInt(iso[3], 10);
                return yi === todayYear && mi === todayMonth && di === todayDay;
            }

            const parsed = new Date(text);
            if (!isNaN(parsed)) {
                return parsed.getFullYear() === todayYear && 
                       parsed.getMonth() === todayMonth && 
                       parsed.getDate() === todayDay;
            }

            return false;
        } catch (error) {
            console.log('MailMind: Error parsing date:', text, error);
            return false;
        }
    }

    cleanTimeText(text) {
        return (text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\u202F/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    startObservingGmail() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if an email conversation view opened
                    const emailView = document.querySelector('[role="main"] [data-message-id]') ||
                                    document.querySelector('.ii.gt .a3s.aiL') ||
                                    document.querySelector('.ii.gt .a3s');
                    
                    if (emailView) {
                        // Get a unique identifier for this email
                        const emailId = this.getEmailId(emailView);
                        if (emailId && emailId !== this.currentEmailId) {
                            this.currentEmailId = emailId;
                            setTimeout(() => this.handleEmailOpen(emailView), 1000);
                        }
                    } else {
                        // Email closed, remove sidebar
                        this.removeEmailSidebar();
                        this.currentEmailId = null;
                    }
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    getEmailId(emailView) {
        // Try to get a unique identifier for the email
        const messageId = emailView.getAttribute('data-message-id') ||
                         emailView.closest('[data-message-id]')?.getAttribute('data-message-id') ||
                         emailView.closest('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id');
        
        if (messageId) return messageId;

        // Fallback: use subject + sender as identifier
        const subject = this.extractOpenEmailSubject(emailView);
        const sender = this.extractOpenEmailSender(emailView);
        
        return subject && sender ? `${sender}-${subject}`.substring(0, 50) : Date.now().toString();
    }

    async handleEmailOpen(emailView) {
        if (!this.apiKey) {
            console.log('No API key available for email processing');
            return;
        }

        try {
            const emailContent = this.extractOpenEmailContent(emailView);
            const emailSubject = this.extractOpenEmailSubject(emailView);
            const emailSender = this.extractOpenEmailSender(emailView);

            if (!emailContent) {
                console.log('No email content found');
                return;
            }

            console.log('MailMind: Processing opened email');
            await this.createEmailSidebar(emailContent, emailSubject, emailSender);
            
        } catch (error) {
            console.error('Error handling email open:', error);
        }
    }

    extractOpenEmailContent(emailView) {
        const contentSelectors = [
            '.ii.gt .a3s.aiL',
            '.a3s.aiL',
            '[data-message-id] .a3s',
            '.ii.gt div[dir="ltr"]',
            '.hx .ii.gt div',
            '.a3s'
        ];

        for (const selector of contentSelectors) {
            const contentEl = emailView.querySelector(selector) || document.querySelector(selector);
            if (contentEl && contentEl.textContent.trim()) {
                return contentEl.textContent.trim();
            }
        }

        return null;
    }

    extractOpenEmailSubject(emailView) {
        const subjectSelectors = [
            'h2[data-thread-perm-id]',
            '.hP',
            '[data-thread-perm-id]',
            'h2',
            '.subject'
        ];

        for (const selector of subjectSelectors) {
            const subjectEl = document.querySelector(selector);
            if (subjectEl && subjectEl.textContent.trim()) {
                return subjectEl.textContent.trim();
            }
        }

        return 'Email';
    }

    extractOpenEmailSender(emailView) {
        const senderSelectors = [
            '.go .g2',
            '.go span[email]',
            '.gD',
            '[email]',
            '.sender'
        ];

        for (const selector of senderSelectors) {
            const senderEl = document.querySelector(selector);
            if (senderEl) {
                const email = senderEl.getAttribute('email') || senderEl.textContent.trim();
                if (email) return email;
            }
        }

        return 'Unknown Sender';
    }

    async createEmailSidebar(emailContent, emailSubject, emailSender) {
        // Remove existing sidebar
        this.removeEmailSidebar();

        // Create sidebar container
        const sidebar = document.createElement('div');
        sidebar.id = 'mailmind-email-sidebar';
        sidebar.className = 'mailmind-sidebar';
        
        // Initial loading state
        sidebar.innerHTML = `
            <div class="mailmind-sidebar-header">
                <div class="mailmind-sidebar-title">
                    <span class="mailmind-icon">🤖</span>
                    <span>MailMind AI</span>
                </div>
                <button class="mailmind-close-btn">&times;</button>
            </div>
            <div class="mailmind-sidebar-content">
                <div class="mailmind-loading">
                    <div class="mailmind-spinner"></div>
                    <p>Generating summary and reply...</p>
                </div>
            </div>
        `;

        // Add styles
        this.addSidebarStyles();
        
        // Position and show sidebar
        document.body.appendChild(sidebar);
        this.currentSidebar = sidebar;

        // Add event listeners
        sidebar.querySelector('.mailmind-close-btn').addEventListener('click', () => {
            this.removeEmailSidebar();
        });

        // Generate content
        try {
            const [summary, suggestedReply] = await Promise.all([
                this.generateEmailSummary(emailContent, emailSubject, emailSender),
                this.generateSuggestedReply(emailContent, emailSubject, emailSender)
            ]);

            this.updateSidebarContent(sidebar, summary, suggestedReply);
        } catch (error) {
            console.error('Error generating AI content:', error);
            this.updateSidebarError(sidebar, error.message);
        }
    }

    async generateEmailSummary(emailContent, emailSubject, emailSender) {
        const prompt = `Summarize this email in 2-3 clear sentences, focusing on key points and any action items:

From: ${emailSender}
Subject: ${emailSubject}

Content: ${emailContent}`;

        return await this.callGeminiAPI(prompt, 150);
    }

    async generateSuggestedReply(emailContent, emailSubject, emailSender) {
        const prompt = `Generate a professional, concise reply to this email. Keep it brief but appropriate:

From: ${emailSender}
Subject: ${emailSubject}

Content: ${emailContent}

Reply:`;

        return await this.callGeminiAPI(prompt, 200);
    }

    async callGeminiAPI(prompt, maxTokens = 200) {
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
                    maxOutputTokens: maxTokens,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            throw new Error('No content generated');
        }
        
        return generatedText.trim();
    }

    updateSidebarContent(sidebar, summary, suggestedReply) {
        const content = sidebar.querySelector('.mailmind-sidebar-content');
        content.innerHTML = `
            <div class="mailmind-section">
                <h4>📄 Email Summary</h4>
                <div class="mailmind-summary-text">${this.escapeHtml(summary)}</div>
            </div>
            <div class="mailmind-section">
                <h4>💬 Suggested Reply</h4>
                <div class="mailmind-reply-text">${this.escapeHtml(suggestedReply)}</div>
                <div class="mailmind-reply-actions">
                    <button class="mailmind-use-reply-btn">Use This Reply</button>
                    <button class="mailmind-copy-reply-btn">Copy Reply</button>
                </div>
            </div>
        `;

        // Add event listeners for reply actions
        content.querySelector('.mailmind-use-reply-btn').addEventListener('click', () => {
            this.insertReplyIntoCompose(suggestedReply);
        });

        content.querySelector('.mailmind-copy-reply-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(suggestedReply).then(() => {
                const btn = content.querySelector('.mailmind-copy-reply-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            });
        });
    }

    updateSidebarError(sidebar, errorMessage) {
        const content = sidebar.querySelector('.mailmind-sidebar-content');
        content.innerHTML = `
            <div class="mailmind-error">
                <div class="mailmind-error-icon">⚠️</div>
                <h4>Unable to process email</h4>
                <p>${this.escapeHtml(errorMessage)}</p>
            </div>
        `;
    }

    insertReplyIntoCompose(replyText) {
        // Look for compose/reply boxes
        const composeSelectors = [
            '[aria-label*="Message Body"]',
            '[contenteditable="true"][aria-label*="compose"]',
            '.Am.Al.editable',
            '[g_editable="true"]',
            '.editable[contenteditable="true"]',
            '[role="textbox"][contenteditable="true"]'
        ];

        for (const selector of composeSelectors) {
            const composeBox = document.querySelector(selector);
            if (composeBox) {
                composeBox.innerHTML = replyText.replace(/\n/g, '<br>');
                composeBox.focus();
                
                // Show success message
                this.showTemporaryMessage('Reply inserted into compose box!');
                return;
            }
        }

        // If no compose box found, try to open reply
        const replyButton = document.querySelector('[aria-label*="Reply"]') || 
                          document.querySelector('[data-tooltip*="Reply"]') ||
                          document.querySelector('.ams.bkH .amn');
        
        if (replyButton) {
            replyButton.click();
            setTimeout(() => this.insertReplyIntoCompose(replyText), 1000);
        } else {
            this.showTemporaryMessage('Please open the reply composer first');
        }
    }

    showTemporaryMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mailmind-temp-message';
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(messageDiv);
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    removeEmailSidebar() {
        if (this.currentSidebar) {
            this.currentSidebar.remove();
            this.currentSidebar = null;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addSidebarStyles() {
        if (document.getElementById('mailmind-sidebar-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'mailmind-sidebar-styles';
        styles.textContent = `
            .mailmind-sidebar {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 350px;
                max-height: 80vh;
                background: white;
                border: 1px solid #e1e5e9;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                animation: slideInRight 0.3s ease-out;
            }

            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .mailmind-sidebar-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .mailmind-sidebar-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                font-size: 16px;
            }

            .mailmind-close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }

            .mailmind-close-btn:hover {
                background-color: rgba(255,255,255,0.2);
            }

            .mailmind-sidebar-content {
                padding: 20px;
                max-height: 60vh;
                overflow-y: auto;
            }

            .mailmind-loading {
                text-align: center;
                padding: 40px 20px;
            }

            .mailmind-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .mailmind-section {
                margin-bottom: 24px;
            }

            .mailmind-section:last-child {
                margin-bottom: 0;
            }

            .mailmind-section h4 {
                margin: 0 0 12px 0;
                color: #2d3748;
                font-size: 14px;
                font-weight: 600;
            }

            .mailmind-summary-text,
            .mailmind-reply-text {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 14px;
                font-size: 14px;
                line-height: 1.5;
                color: #2d3748;
                margin-bottom: 12px;
            }

            .mailmind-reply-actions {
                display: flex;
                gap: 8px;
            }

            .mailmind-use-reply-btn,
            .mailmind-copy-reply-btn {
                flex: 1;
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .mailmind-use-reply-btn {
                background: #667eea;
                color: white;
            }

            .mailmind-use-reply-btn:hover {
                background: #5a67d8;
            }

            .mailmind-copy-reply-btn {
                background: #edf2f7;
                color: #4a5568;
                border: 1px solid #e2e8f0;
            }

            .mailmind-copy-reply-btn:hover {
                background: #e2e8f0;
            }

            .mailmind-error {
                text-align: center;
                padding: 40px 20px;
            }

            .mailmind-error-icon {
                font-size: 32px;
                margin-bottom: 12px;
            }

            .mailmind-error h4 {
                color: #e53e3e;
                margin-bottom: 8px;
            }

            .mailmind-error p {
                color: #718096;
                font-size: 13px;
                line-height: 1.4;
            }

            @media (max-width: 500px) {
                .mailmind-sidebar {
                    right: 10px;
                    width: calc(100vw - 20px);
                    max-width: 350px;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Initialize with error handling
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => new GmailContentScript(), 1000);
        });
    } else {
        setTimeout(() => new GmailContentScript(), 1000);
    }
} catch (error) {
    console.error('MailMind: Failed to initialize content script:', error);
}