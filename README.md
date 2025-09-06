# 📬 MailMind: AI-Powered Email Summarizer & Reply Suggester

**A privacy-focused Chrome extension that uses Google Gemini AI to summarize your daily Gmail emails and generate intelligent reply suggestions - all without any backend servers.**

## 🔥 Overview

MailMind transforms your Gmail experience by leveraging Google Gemini AI to:
- **Summarize** all emails received today in concise, actionable insights
- **Generate** context-aware reply suggestions that appear directly in Gmail
- **Protect** your privacy - zero data sent to third-party servers
- **Save** hours of email management time daily

Whether you're managing a busy inbox, responding to client emails, or staying on top of important communications, MailMind provides intelligent assistance without compromising your data privacy.

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📅 **Daily Email Summary** | View count and AI-generated summaries of all emails received today |
| 💬 **Smart Reply Suggestions** | Context-aware draft replies appear when you open emails |
| 🔐 **Privacy-First Architecture** | All processing in-browser, direct API calls to Google Gemini only |
| ⚡ **No Backend Required** | Completely client-side extension with zero server dependencies |
| 🎨 **Modern UI** | Clean, responsive design with smooth animations |
| 🚀 **Real-time Processing** | Instant summaries and suggestions as you browse Gmail |

## 🎯 Perfect For

- **💼 Busy Professionals** managing high email volumes
- **🧑‍💻 Entrepreneurs** responding to investor/client communications  
- **🎓 Students** handling administrative emails efficiently
- **📧 Anyone** who wants to spend less time on email management

## 🛠️ Installation & Setup

### Step 1: Download & Install

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/yourusername/mailmind-extension.git
   cd mailmind-extension
   ```

2. **Load into Chrome:**
   - Open `chrome://extensions/` in Chrome
   - Enable **Developer mode** (top-right toggle)
   - Click **"Load unpacked"** → Select the `mailmind-extension` folder
   - The extension icon should appear in your Chrome toolbar

### Step 2: Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the generated API key

### Step 3: Configure MailMind

1. **Open Gmail** in your browser
2. **Click the MailMind extension icon** in your Chrome toolbar
3. **Enter your Gemini API key** in the setup screen
4. Click **"Save"** - the extension will test the connection
5. Start using MailMind! 🎉

## 🚀 How to Use

### 📊 View Daily Email Summary

1. Click the MailMind extension icon while on Gmail
2. See your email stats (total count, unread count)
3. Browse AI-generated summaries of today's emails
4. Click "Refresh Summary" to update with new emails

### 💬 Get Reply Suggestions

1. Open any email in Gmail (click to view full email)
2. MailMind automatically detects the opened email
3. A suggestion box appears above the reply area
4. Click **"Use This Reply"** to insert the suggestion
5. Edit as needed and send!

## 🏗️ Technical Architecture

### Project Structure
```
mailmind-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI interface
├── popup.js              # Popup logic & API calls
├── content.js            # Gmail DOM manipulation
├── background.js         # Service worker
├── styles.css            # Popup styling
├── content.css           # Gmail injection styles
├── icons/                # Extension icons
└── README.md             # This file
```

### Tech Stack

- **🧩 Extension Framework:** Chrome Manifest V3
- **🤖 AI Integration:** Google Gemini Pro API
- **🎨 Frontend:** Vanilla HTML/CSS/JavaScript
- **📱 UI Framework:** Custom responsive design
- **🔒 Storage:** Chrome Extension Storage API
- **🌐 DOM Manipulation:** MutationObserver for real-time Gmail integration

### Privacy & Security

✅ **Zero third-party servers** - all processing happens in your browser  
✅ **Direct API calls** to Google Gemini only  
✅ **Secure credential storage** using Chrome's built-in storage  
✅ **Minimal permissions** - only accesses Gmail when actively used  
✅ **No data persistence** - email content never stored locally  
✅ **Open source** - full transparency of code operations  

## ⚙️ Configuration Options

Access settings by clicking the gear icon in the extension popup:

- **API Key Management:** Update or change your Gemini API key
- **Reply Tone:** Professional, casual, or friendly (future feature)
- **Summary Length:** Short, medium, or detailed summaries (future feature)
- **Auto-inject Replies:** Toggle automatic reply suggestions

## 🔧 Development & Customization

### Prerequisites
- Google Chrome (latest version)
- Google Gemini API key
- Basic knowledge of JavaScript (for customization)

### Local Development
```bash
# Clone the repository
git clone https://github.com/yourusername/mailmind-extension.git
cd mailmind-extension

# Make your changes to the source files
# Load the extension in Chrome for testing
```

### Customizing Prompts

Edit the AI prompts in `popup.js` and `content.js`:

**For email summaries (popup.js):**
```javascript
const prompt = `Summarize the following email in 1-2 sentences:\n\nSubject: ${email.subject}\n\nBody: ${email.preview}`;
```

**For reply suggestions (content.js):**
```javascript
const prompt = `Read the following email and generate a professional, concise reply to it. Keep the reply brief and appropriate:\n\n${emailContent}`;
```

### Adding New Features

The extension is modular and easy to extend:

- **UI changes:** Modify `popup.html` and `styles.css`
- **Gmail integration:** Update `content.js`
- **New API calls:** Extend `popup.js` or `background.js`
- **Settings:** Add storage options in `background.js`

## 🐛 Troubleshooting

### Common Issues

**"Unable to load emails" error:**
- Make sure you're on Gmail (`mail.google.com`)
- Refresh the Gmail page and try again
- Check browser console for detailed error messages

**API key not working:**
- Verify your Gemini API key is correct
- Check that the API key has proper permissions
- Ensure you have available API quota

**Reply suggestions not appearing:**
- Make sure you've fully opened an email (not just preview)
- Wait 1-2 seconds for processing
- Check that auto-inject replies is enabled in settings

**Extension not loading:**
- Ensure you've enabled Developer mode in Chrome
- Try reloading the extension in `chrome://extensions/`
- Check that all files are in the correct folder structure

### Debug Mode

Enable detailed logging by opening Chrome DevTools:
1. Right-click the extension icon → "Inspect popup"
2. Check the Console tab for detailed logs
3. Look for error messages or API response issues

## 🌟 Future Enhancements

### Planned Features
- [ ] **Multiple Email Providers** (Outlook, Yahoo Mail)
- [ ] **Reply Tone Selection** (formal, casual, friendly)
- [ ] **Summary History** with persistent storage
- [ ] **Keyword Filtering** for priority emails
- [ ] **Dark/Light Theme** toggle
- [ ] **Bulk Operations** for email management
- [ ] **Integration with Calendar** for meeting-related emails
- [ ] **Custom Prompt Templates** for different email types

### Contribute

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues:** Report bugs via [GitHub Issues](https://github.com/yourusername/mailmind-extension/issues)
- **Features:** Request features via GitHub Issues
- **Email:** contact@mailmind-extension.com (if you set up support email)

## ⭐ Show Your Support

If MailMind helps you manage your emails better:
- ⭐ Star this repository
- 🐦 Share on social media
- 📧 Tell your colleagues about it
- 🍕 [Buy us a coffee](https://buymeacoffee.com/mailmind) (optional donation link)

---

**Built with ❤️ for productivity enthusiasts who value their privacy.**

*MailMind is not affiliated with Google or Gmail. Google, Gmail, and Gemini are trademarks of Google LLC.*