# MailMind - AI Email Assistant

MailMind is a Chrome extension that brings AI-powered email assistance directly to your Gmail interface. Using Google's Gemini AI, it provides intelligent email summaries, reply suggestions, and multi-email processing capabilities to help you manage your inbox more efficiently.

## Features

### 🤖 AI-Powered Email Processing
- **Email Summaries**: Get concise summaries of individual emails
- **Smart Reply Suggestions**: Generate contextual, professional reply drafts
- **Multi-Email Selection**: Process and summarize multiple emails at once
- **Today's Email Count**: Track daily email volume in the popup

### 📧 Single Email Features
- **Floating Sidebar**: Non-intrusive sidebar appears when reading emails
- **One-Click Reply Integration**: Insert AI suggestions directly into Gmail compose
- **Real-time Processing**: Instant summaries as you open emails

### 📚 Multi-Email Features
- **Bulk Processing**: Select multiple emails for batch summarization
- **Export Capabilities**: Export summaries to text files
- **Collapsible Sidebar**: Hide/show multi-email sidebar while maintaining selection
- **Progress Tracking**: Visual feedback during bulk processing

### ⚡ Performance & Caching
- **Smart Caching**: Avoid re-processing the same emails
- **Queue Management**: Efficient API call handling with rate limiting
- **Incremental Updates**: Real-time UI updates as summaries complete

## Installation

### Prerequisites
- Chrome browser
- Gmail account
- Google AI Studio API key ([Get one here](https://makersuite.google.com/app/apikey))

### Setup Steps
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The MailMind icon should appear in your extensions toolbar

### Initial Configuration
1. Click the MailMind extension icon
2. Enter your Gemini API key in the setup screen
3. Navigate to Gmail - the extension will automatically activate

## Usage

### Single Email Processing
1. Open any email in Gmail
2. The MailMind sidebar will automatically appear
3. View the AI-generated summary and reply suggestion
4. Click "Use This Reply" to insert the suggestion into a compose window
5. Or click "Copy Reply" to copy the text to your clipboard

### Multi-Email Processing
1. Select multiple emails using Gmail's checkboxes
2. The multi-email sidebar will automatically appear
3. View individual summaries for each selected email
4. Export all summaries using the "Export Summaries" button
5. Use the hide/show button to manage sidebar visibility

### Popup Interface
- View today's email count
- Access extension settings
- Monitor processing status

## File Structure

```
mailmind/
├── manifest.json          # Extension configuration
├── background.js           # Service worker for extension lifecycle
├── content.js             # Gmail integration and AI processing
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── styles.css             # Main popup styles
├── popup-styles.css       # Additional popup styling
└── icons/                 # Extension icons
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Technical Architecture

### Core Components

#### Background Script (`background.js`)
- Manages extension lifecycle and installation
- Handles API key storage and validation
- Manages tab updates and Gmail injection
- Provides notification services

#### Content Script (`content.js`)
- **GmailContentScript Class**: Main orchestrator
- **Single Email Processing**: Detects opened emails and creates sidebars
- **Multi-Email Processing**: Handles bulk email selection and processing
- **Caching System**: Intelligent summary caching with persistent storage
- **Queue Management**: Serialized API calls to prevent rate limiting
- **DOM Integration**: Seamless Gmail interface integration

#### Popup Interface (`popup.js`, `popup.html`)
- **MailMindPopup Class**: Manages popup lifecycle
- **API Key Management**: Secure storage and validation
- **Email Counting**: Real-time display of daily email volumes
- **Error Handling**: Comprehensive error states and messaging

### Key Technologies
- **Chrome Extension Manifest V3**: Modern extension architecture
- **Google Gemini AI**: Advanced language model for text processing
- **Chrome Storage API**: Secure local data persistence
- **MutationObserver**: Real-time Gmail DOM monitoring
- **CSS Grid/Flexbox**: Responsive UI layouts

## API Integration

### Gemini API Configuration
- **Model**: `gemini-2.0-flash-exp`
- **Temperature**: 0.4 (balanced creativity/consistency)
- **Max Output Tokens**: 150-200 (depending on task)
- **Content Safety**: Built-in Gemini content filtering

### Rate Limiting
- **Queue System**: Serialized API calls
- **Caching**: Prevents duplicate processing
- **Error Recovery**: Automatic retry with exponential backoff

## Privacy & Security

### Data Handling
- **Local Processing**: Email content processed locally before API calls
- **No Data Storage**: No email content stored permanently
- **API Key Security**: Encrypted storage using Chrome's secure storage
- **Minimal Permissions**: Only required Gmail and API access

### Permissions Explained
- `storage`: API key and settings storage
- `tabs`: Gmail tab detection
- `scripting`: Content script injection
- `activeTab`: Current tab interaction
- `notifications`: User feedback
- `https://mail.google.com/*`: Gmail access only
- `https://generativelanguage.googleapis.com/*`: Gemini API access only

## Development

### Local Development
```bash
# Clone the repository
git clone https://github.com/divyamagg2005/mailmind-extension.git
cd mailmind-extension

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project directory
```

### Key Development Areas

#### Content Script Enhancement
```javascript
// Example: Adding new email detection patterns
getEmailRowsStrategy5() {
    // Custom email row detection logic
    const customSelector = '[data-custom-email-attr]';
    return document.querySelectorAll(customSelector);
}
```

#### API Integration
```javascript
// Example: Adding new AI capabilities
async generateEmailPriority(emailContent, emailSubject) {
    const prompt = `Rate the priority of this email (High/Medium/Low): ${emailSubject}`;
    return await this.callGeminiAPI(prompt, 50);
}
```

### Testing Considerations
- **Gmail Interface Variations**: Test across different Gmail views
- **API Rate Limits**: Implement proper error handling
- **Browser Compatibility**: Ensure Chrome Manifest V3 compliance
- **Performance**: Monitor memory usage with large email volumes

## Troubleshooting

### Common Issues

#### Extension Not Loading
- Verify Gmail is fully loaded before activation
- Check browser console for error messages
- Ensure API key is properly configured

#### API Errors
- Verify Gemini API key validity
- Check API quotas and billing
- Monitor network connectivity

#### Gmail Integration Issues
- Gmail interface changes may require selector updates
- Clear browser cache and reload extension
- Check for conflicting Gmail extensions

### Debug Mode
Enable console logging for detailed debugging:
```javascript
// In content.js, set debug flag
const DEBUG_MODE = true;
```

## Contributing

### Development Guidelines
- Follow existing code patterns and structure
- Test across different Gmail configurations
- Maintain backward compatibility when possible
- Document any new features or API changes

### Contribution Process
1. Fork the repository
2. Create a feature branch
3. Implement changes with proper testing
4. Submit a pull request with detailed description

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

### Getting Help
- Check the troubleshooting section above
- Review browser console for error messages
- Ensure Gmail and API key are properly configured

### Reporting Issues
When reporting issues, please include:
- Browser version and OS
- Gmail interface type (new/classic)
- Console error messages
- Steps to reproduce

## Roadmap

### Planned Features
- **Email Prioritization**: AI-powered importance scoring
- **Custom Prompts**: User-defined AI instructions
- **Calendar Integration**: Meeting scheduling suggestions
- **Email Templates**: AI-generated template library
- **Analytics Dashboard**: Email processing insights

### Version History
- **v1.0.0**: Initial release with core AI features
  - Single email processing
  - Multi-email selection
  - Caching and queue management
  - Gmail integration