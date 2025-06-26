# Jira Issue Extractor & Email Automation

This project automates the extraction of CQDOC issues from a specific Jira scrum board and sends daily email updates with the current status of all issues.

## Features

- **Real Issue Extraction**: Extracts actual issues from Jira scrum board using web scraping
- **Automated Okta Authentication**: Handles Adobe Okta SSO authentication automatically
- **Accurate Status Detection**: Detects real status from board columns (To Review, Documentation in Progress, Qualified, Close, etc.)
- **Assignee Detection**: Extracts real assignee information for each issue
- **Email Automation**: Sends formatted HTML emails with issue summaries and tables
- **Screenshot Cleanup**: Automatically cleans up temporary screenshots
- **Environment Security**: All credentials stored in .env file

## Project Structure

```
cursor-jira-mcp2/
├── src/
│   └── scrapeJiraBoard.ts    # Main application file
├── build/
│   └── scrapeJiraBoard.js    # Compiled JavaScript
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── .env-example             # Environment variables template
├── .gitignore              # Git ignore rules
├── LICENSE                 # MIT License
└── README.md               # This file
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# SMTP Configuration
SMTP_SERVER=authrelay.corp.adobe.com
SMTP_PORT=587
USE_SSL=false
smtp_username=your-smtp-username@adobe.com
EMAIL_PASSWORD=your-email-password
SENDER_EMAIL=your-sender-email@adobe.com
SENDER_NAME=Your Name

# Jira Configuration
JIRA_USERNAME=your-jira-username@adobe.com
JIRA_PASSWORD=your-jira-password
JIRA_RAPID_VIEW=44313

# Email Recipients
Doc_Email1=recipient1@adobe.com
Doc_Email2=recipient2@adobe.com
Doc_Email3=recipient3@adobe.com
```

**Important**: Ensure your `.env` file is encoded in UTF-8 format, not UTF-16.

### 3. Build the Project
```bash
npm run build
```

### 4. Run the Application
```bash
npm run start
```

## How It Works

### Authentication Flow
1. **Automated Okta**: The system automatically handles Adobe Okta SSO authentication
2. **Email Verification**: If email matches JIRA_USERNAME, it attempts to click "Yes, it's me" automatically
3. **Manual Fallback**: If automation fails, it falls back to manual authentication with monitoring

### Issue Extraction Process
1. **Board Access**: Opens the specified Jira scrum board (RapidView 44313)
2. **Real Data Extraction**: Extracts actual issues from the board using comprehensive selectors
3. **Status Detection**: Determines real status based on which column each issue is in:
   - Qualification Required
   - Qualified
   - To Document
   - Documentation in Progress
   - To Review
   - Documented
   - Close
4. **Assignee Detection**: Extracts real assignee names using multiple detection methods
5. **Data Validation**: Validates and cleans extracted data

### Email Features
- **HTML Formatting**: Professional email template with tables and styling
- **Issue Summary**: Count of issues by status
- **Detailed Table**: Complete list with Issue ID, Title, Assignee, and Status
- **Clickable Links**: Direct links to Jira issues
- **No Dates**: Clean format without timestamps per user requirements

## Current Results

The system successfully extracts **CQDOC issues**.

## Security Features

- **Environment Variables**: All sensitive data stored in .env file
- **No Hardcoded Credentials**: No sensitive information in source code
- **Automatic Cleanup**: Screenshots and temporary files automatically deleted
- **SSL/TLS Support**: Secure email transmission

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Ensure .env file is in UTF-8 encoding
   - Check file path and permissions
   - Verify all required variables are set

2. **Authentication Issues**
   - Verify JIRA_USERNAME and JIRA_PASSWORD
   - Check Okta authentication flow
   - Ensure network connectivity to Adobe systems

3. **Email Delivery Issues**
   - Verify SMTP settings
   - Check email credentials
   - Ensure corporate network access

4. **Issue Extraction Problems**
   - Verify board access permissions
   - Check RapidView ID (44313)
   - Ensure board contains issues

## Development

### Building
```bash
npm run build
```

### Running
```bash
npm run start
```

### Dependencies
- **puppeteer**: Web scraping and automation
- **nodemailer**: Email sending
- **jira-client**: Jira API client (backup)
- **axios**: HTTP requests
- **dotenv**: Environment variable management

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions, please check the troubleshooting section above or contact the development team.
