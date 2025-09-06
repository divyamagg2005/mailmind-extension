class GmailContentScript {
    constructor() {
        this.observer = null;
        this.currentEmailContent = null;
        this.replyInjected = false;
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.init();
    }

    async init() {
        // Add a small delay to ensure Gmail is fully loaded
        await this.delay(2000);
        this.setupMessageListener();
        this.startObservingGmail();
        this.isInitialized = true;
        console.log('MailMind content script initialized');
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
                return true; // Keep the message channel open for async response
            }
        });
    }

    async getEmailsFromToday() {
        try {
            // Wait for Gmail to load with retries
            await this.waitForGmailLoadWithRetries();

            const emails = [];
            let unreadCount = 0;

            // Try multiple strategies to get email elements
            const emailRows = await this.getEmailRowsWithFallbacks();
            console.log('MailMind debug – emailRows found:', emailRows.length);
            
            if (emailRows.length === 0) {
                console.log('MailMind: No email rows found, trying alternative selectors');
                // Try to force a refresh of the Gmail interface
                await this.delay(1000);
                const retryRows = await this.getEmailRowsWithFallbacks();
                if (retryRows.length === 0) {
                    return {
                        emails: [],
                        unreadCount: 0,
                        debug: 'No email rows found in Gmail interface'
                    };
                }
                emailRows.push(...retryRows);
            }
            
            for (const row of emailRows) {
                const emailData = this.extractEmailData(row);
                if (emailData) {
                    // Count only emails that we can positively identify as received TODAY
                    if (this.isFromToday(emailData.time)) {
                        emails.push(emailData);
                        if (emailData.isUnread) {
                            unreadCount++;
                        }
                    }
                }
            }

            console.log('MailMind: Found', emails.length, 'emails today,', unreadCount, 'unread');

            return {
                emails: emails,
                unreadCount: unreadCount,
                debug: `Processed ${emailRows.length} rows, found ${emails.length} today's emails`
            };
        } catch (error) {
            console.error('Error getting emails:', error);
            return { 
                error: error.message,
                emails: [],
                unreadCount: 0
            };
        }
    }

    async waitForGmailLoadWithRetries() {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                await this.waitForGmailLoad();
                return; // Success
            } catch (error) {
                console.log(`MailMind: Gmail load attempt ${attempt + 1} failed`);
                if (attempt === this.maxRetries - 1) {
                    throw error;
                }
                await this.delay(1000 * (attempt + 1)); // Progressive delay
            }
        }
    }

    waitForGmailLoad() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 30; // Increased attempts
            let attempts = 0;

            const checkGmail = () => {
                attempts++;
                
                // Multiple selectors for different Gmail states
                const gmailSelectors = [
                    '[role="main"]',
                    '.nH',
                    '[gh="tl"]',
                    '.aeJ',
                    '.AO',
                    '.Tm.aeJ',
                    '[jscontroller="SoVkNd"]'
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
                    reject(new Error('Gmail interface not found after ' + maxAttempts + ' attempts'));
                }
            };

            checkGmail();
        });
    }

    async getEmailRowsWithFallbacks() {
        // Multiple strategies to get email rows
        const strategies = [
            () => this.getEmailRowsStrategy1(), // Original approach
            () => this.getEmailRowsStrategy2(), // Table-based approach
            () => this.getEmailRowsStrategy3(), // Conversation-based approach
            () => this.getEmailRowsStrategy4()  // Aria-label based approach
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const rows = await strategies[i]();
                if (rows.length > 0) {
                    console.log(`MailMind: Strategy ${i + 1} found ${rows.length} email rows`);
                    return rows.slice(0, 50); // Increased limit
                }
            } catch (error) {
                console.log(`MailMind: Strategy ${i + 1} failed:`, error.message);
            }
        }

        return [];
    }

    getEmailRowsStrategy1() {
        // Original selectors with additions
        const selectors = [
            'tr[jsaction*="mouseenter"]',
            'tr[jsaction*="click"]',
            '.zA',
            '[data-legacy-thread-id]',
            '.Cp',
            'tr.zA',
            'tr.yW',
            '.yW',
            '[role="listitem"]',
            '[jsmodel="SzKmE"]'
        ];

        for (const selector of selectors) {
            const rows = document.querySelectorAll(selector);
            if (rows.length > 0) {
                return Array.from(rows).filter(row => {
                    // Filter out non-email rows
                    const text = row.textContent;
                    return text && text.length > 10 && !text.includes('Compose') && !text.includes('Sent');
                });
            }
        }
        return [];
    }

    getEmailRowsStrategy2() {
        // Table-based approach - Gmail uses tables for email lists
        const tables = document.querySelectorAll('table[role="grid"], table.F');
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length > 1) { // Skip header row
                return Array.from(rows).slice(1).filter(row => {
                    return row.cells && row.cells.length > 2; // Has multiple columns
                });
            }
        }
        return [];
    }

    getEmailRowsStrategy3() {
        // Look for conversation elements
        const conversations = document.querySelectorAll('[data-thread-id], [data-legacy-thread-id]');
        if (conversations.length > 0) {
            return Array.from(conversations);
        }
        return [];
    }

    getEmailRowsStrategy4() {
        // Aria-label based approach
        const elements = document.querySelectorAll('[aria-label*="email"], [aria-label*="message"], [aria-label*="conversation"]');
        return Array.from(elements).filter(el => {
            const ariaLabel = el.getAttribute('aria-label') || '';
            return ariaLabel.includes('@') || ariaLabel.includes('unread') || ariaLabel.includes('from');
        });
    }

    extractEmailData(row) {
        try {
            // Enhanced extraction with more fallbacks
            const emailData = {
                sender: this.extractSender(row),
                subject: this.extractSubject(row),
                preview: this.extractPreview(row),
                time: this.extractTime(row),
                isUnread: this.extractUnreadStatus(row)
            };

            // Validate that we have at least some data
            if (!emailData.sender && !emailData.subject && !emailData.preview) {
                return null;
            }

            console.log('MailMind debug – extracted email:', {
                sender: emailData.sender?.substring(0, 20) + '...',
                subject: emailData.subject?.substring(0, 30) + '...',
                time: emailData.time,
                isUnread: emailData.isUnread
            });

            return emailData;
        } catch (error) {
            console.error('Error extracting email data:', error);
            return null;
        }
    }

    extractSender(row) {
        const senderSelectors = [
            '[email]',
            '.yW',
            '.yP',
            '[name]',
            '.go span[email]',
            '.bA4 span',
            '.a4W span',
            '.yX span'
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

        // Fallback: look for email patterns in text content
        const text = row.textContent || '';
        const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
            return emailMatch[0];
        }

        return '';
    }

    extractSubject(row) {
        const subjectSelectors = [
            '.bog',
            '[data-thread-perm-id] .y6 span',
            '.y6 span',
            '.y6',
            '.aYS',
            '.Zt',
            '.a4W .ao9',
            '.bqe span'
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
            '.y2',
            '.bog + span',
            '.y6 + .y2',
            '.aYS + .y2',
            '.Zt + span',
            '.snippetText'
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
            'time',
            'td.xW span',
            '.xW span',
            '.xY span',
            '[title*=":"]',
            '.xz',
            '.g3 span',
            '.byg span',
            'span[title]', // Generic span with title attribute
            '.xY', // Direct element
            '.xW' // Direct element
        ];

        // Try direct selectors first
        for (const selector of timeSelectors) {
            const el = row.querySelector(selector);
            if (el) {
                // Try title attribute first (often contains full timestamp)
                let timeText = el.getAttribute('title');
                if (timeText && timeText.trim()) {
                    timeText = this.cleanTimeText(timeText);
                    if (this.isValidTimeText(timeText)) {
                        console.log('MailMind debug – Found time via title:', timeText);
                        return timeText;
                    }
                }
                
                // Try text content
                timeText = el.textContent;
                if (timeText && timeText.trim()) {
                    timeText = this.cleanTimeText(timeText);
                    if (this.isValidTimeText(timeText)) {
                        console.log('MailMind debug – Found time via textContent:', timeText);
                        return timeText;
                    }
                }
            }
        }

        // Fallback: look for time patterns in the entire row's aria-label
        const ariaLabel = row.getAttribute('aria-label') || '';
        if (ariaLabel) {
            // Gmail often puts the time at the end of aria-label
            const timePatterns = [
                /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/g,
                /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s*\d{4})?)\b/g,
                /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{4})?)\b/g,
                /\b(yesterday)\b/gi,
                /\b(today)\b/gi,
                /(\d{1,2}\/\d{1,2}\/\d{2,4})/g
            ];

            for (const pattern of timePatterns) {
                const matches = ariaLabel.match(pattern);
                if (matches && matches.length > 0) {
                    // Take the last match (usually the timestamp)
                    const timeText = this.cleanTimeText(matches[matches.length - 1]);
                    if (this.isValidTimeText(timeText)) {
                        console.log('MailMind debug – Found time via aria-label pattern:', timeText);
                        return timeText;
                    }
                }
            }
        }

        // Last resort: look for any time-like text in row
        const rowText = row.textContent || '';
        const timeInRowPattern = /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\b/;
        const match = rowText.match(timeInRowPattern);
        if (match) {
            console.log('MailMind debug – Found time in row text:', match[1]);
            return this.cleanTimeText(match[1]);
        }

        console.log('MailMind debug – No time found for row');
        return '';
    }

    // Helper to validate if extracted text looks like a time/date
    isValidTimeText(timeText) {
        if (!timeText || timeText.length < 2) return false;
        
        // Should contain either time pattern or date words
        const hasTime = /\d{1,2}:\d{2}/.test(timeText);
        const hasDate = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|today|yesterday|\d{1,2}\/\d{1,2})/i.test(timeText);
        
        return hasTime || hasDate;
    }

    extractUnreadStatus(row) {
        // Multiple ways to detect unread status
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
        if (!text) {
            // If we cannot determine the time, do NOT count it as today
            return false;
        }

        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth(); // 0-indexed
        const todayYear = today.getFullYear();
        const lower = text.toLowerCase();

        try {
            // 1) Explicit keywords
            if (lower.includes('yesterday')) return false;
            if (lower.includes('today')) return true;

            // 2) Strict time-of-day only (e.g., "10:30", "10:30 AM") with nothing else -> treat as today
            if (/^\d{1,2}:\d{2}\s*(?:am|pm)?$/i.test(text)) return true;

            // 3) Month name + day (e.g., "Sep 6" or "6 Sep", optional year)
            const monthShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            const monthLong = ['january','february','march','april','may','june','july','august','september','october','november','december'];
            const monthIdxShort = monthShort.findIndex(m => lower.includes(m));
            const monthIdxLong = monthLong.findIndex(m => lower.includes(m));
            const monthIdx = monthIdxShort !== -1 ? monthIdxShort : monthIdxLong;
            if (monthIdx !== -1) {
                // Extract a standalone day number
                const dayMatch = lower.match(/\b(\d{1,2})\b/);
                if (dayMatch) {
                    const d = parseInt(dayMatch[1], 10);
                    if (d === todayDay && monthIdx === todayMonth) return true;
                    return false;
                }
            }

            // 4) Slash-separated dates: dd/mm[/yyyy] OR mm/dd[/yyyy]. Consider today if either interpretation matches
            const slash = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
            if (slash) {
                const a = parseInt(slash[1], 10);
                const b = parseInt(slash[2], 10);
                const y = slash[3] ? parseInt(slash[3], 10) : todayYear;
                const yNorm = y < 100 ? 2000 + y : y;
                // Try mm/dd
                if (a - 1 === todayMonth && b === todayDay && yNorm === todayYear) return true;
                // Try dd/mm
                if (b - 1 === todayMonth && a === todayDay && yNorm === todayYear) return true;
                return false;
            }

            // 5) ISO-like format yyyy-mm-dd
            const iso = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
            if (iso) {
                const yi = parseInt(iso[1], 10);
                const mi = parseInt(iso[2], 10) - 1;
                const di = parseInt(iso[3], 10);
                return yi === todayYear && mi === todayMonth && di === todayDay;
            }

            // 6) Last resort: try native Date parsing (handles strings like "Sep 6, 2025, 10:30 PM")
            const parsed = new Date(text);
            if (!isNaN(parsed)) {
                return parsed.getFullYear() === todayYear && parsed.getMonth() === todayMonth && parsed.getDate() === todayDay;
            }

            // Not confidently identified as today
            return false;
        } catch (error) {
            console.log('MailMind: Error parsing date:', text, error);
            return false;
        }
    }

    cleanTimeText(text) {
        return (text || '')
            .replace(/\u00a0/g, ' ')  // Non-breaking space
            .replace(/\u202F/g, ' ')  // Narrow no-break space
            .replace(/\s+/g, ' ')     // Multiple spaces
            .trim();
    }

    startObservingGmail() {
        // Observe DOM changes to detect when emails are opened
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Check if an email conversation view opened
                if (mutation.type === 'childList') {
                    const emailView = document.querySelector('[role="main"] [data-message-id]') ||
                                    document.querySelector('.ii.gt .a3s.aiL') ||
                                    document.querySelector('.ii.gt .a3s');
                    
                    if (emailView && !this.replyInjected) {
                        setTimeout(() => this.handleEmailOpen(), 1000);
                    }
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async handleEmailOpen() {
        try {
            const emailContent = this.extractOpenEmailContent();
            if (emailContent && emailContent !== this.currentEmailContent) {
                this.currentEmailContent = emailContent;
                await this.generateAndInjectReply(emailContent);
            }
        } catch (error) {
            console.error('Error handling email open:', error);
        }
    }

    extractOpenEmailContent() {
        // Get the currently open email content
        const contentSelectors = [
            '.ii.gt .a3s.aiL',
            '.a3s.aiL',
            '[data-message-id] .a3s',
            '.ii.gt div[dir="ltr"]',
            '.hx .ii.gt div'
        ];

        for (const selector of contentSelectors) {
            const contentEl = document.querySelector(selector);
            if (contentEl && contentEl.textContent.trim()) {
                return contentEl.textContent.trim();
            }
        }

        return null;
    }

    async generateAndInjectReply(emailContent) {
        try {
            // Get API key from storage
            const result = await chrome.storage.local.get(['geminiApiKey']);
            const apiKey = result.geminiApiKey;
            
            if (!apiKey) {
                console.log('No API key found, skipping reply generation');
                return;
            }

            // Generate reply using Gemini
            const reply = await this.generateReply(emailContent, apiKey);
            
            // Inject reply into Gmail compose box
            this.injectReplyIntoComposeBox(reply);
            
        } catch (error) {
            console.error('Error generating reply:', error);
        }
    }

    async generateReply(emailContent, apiKey) {
        const prompt = `Read the following email and generate a professional, concise reply to it. Keep the reply brief and appropriate:

${emailContent}

Reply:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
                    temperature: 0.6,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 300,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0]?.content?.parts[0]?.text || 'Thank you for your email.';
    }

    injectReplyIntoComposeBox(replyText) {
        // Look for reply/compose boxes
        const composeSelectors = [
            '[aria-label*="Message Body"]',
            '[contenteditable="true"][aria-label*="compose"]',
            '.Am.Al.editable',
            '[g_editable="true"]',
            '.editable[contenteditable="true"]'
        ];

        let composeBox = null;
        for (const selector of composeSelectors) {
            composeBox = document.querySelector(selector);
            if (composeBox) break;
        }

        if (composeBox) {
            // Create a suggestion box
            this.createReplySuggestion(composeBox, replyText);
            this.replyInjected = true;
            
            // Reset after some time
            setTimeout(() => {
                this.replyInjected = false;
                this.currentEmailContent = null;
            }, 30000);
        }
    }

    createReplySuggestion(composeBox, replyText) {
        // Remove any existing suggestions
        const existingSuggestion = document.querySelector('.mailmind-suggestion');
        if (existingSuggestion) {
            existingSuggestion.remove();
        }

        // Create suggestion container
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'mailmind-suggestion';
        suggestionDiv.innerHTML = `
            <div class="mailmind-suggestion-header">
                <span>📬 MailMind AI Suggestion</span>
                <button class="mailmind-close">×</button>
            </div>
            <div class="mailmind-suggestion-content">${replyText}</div>
            <div class="mailmind-suggestion-actions">
                <button class="mailmind-use-suggestion">Use This Reply</button>
                <button class="mailmind-dismiss">Dismiss</button>
            </div>
        `;

        // Style the suggestion
        suggestionDiv.style.cssText = `
            position: absolute;
            top: -200px;
            left: 0;
            right: 0;
            background: #f8f9fa;
            border: 1px solid #dadce0;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
        `;

        // Position relative to compose box
        composeBox.parentElement.style.position = 'relative';
        composeBox.parentElement.insertBefore(suggestionDiv, composeBox);

        // Add event listeners
        suggestionDiv.querySelector('.mailmind-use-suggestion').addEventListener('click', () => {
            composeBox.innerHTML = replyText.replace(/\n/g, '<br>');
            composeBox.focus();
            suggestionDiv.remove();
        });

        suggestionDiv.querySelector('.mailmind-dismiss').addEventListener('click', () => {
            suggestionDiv.remove();
        });

        suggestionDiv.querySelector('.mailmind-close').addEventListener('click', () => {
            suggestionDiv.remove();
        });
    }
}

// Add error handling for initialization
try {
    // Wait a bit before initializing to ensure DOM is ready
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