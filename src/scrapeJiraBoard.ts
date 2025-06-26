import puppeteer, { Browser, Page } from 'puppeteer';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import JiraApi from 'jira-client';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force load environment variables from .env file, overriding system variables
console.log('🔧 Loading environment variables from .env file...');
const envPath = path.resolve(__dirname, '../.env');
console.log(`📁 Looking for .env file at: ${envPath}`);

if (fs.existsSync(envPath)) {
    console.log('✅ .env file found, loading...');
    dotenv.config({ path: envPath, override: true });
} else {
    console.log('⚠️ .env file not found at expected location, trying default...');
    dotenv.config({ override: true });
}

// Debug: Show what was loaded
console.log('🔍 Environment variables loaded:');
console.log(`  SMTP_SERVER: ${process.env.SMTP_SERVER || 'NOT SET'}`);
console.log(`  JIRA_USERNAME: ${process.env.JIRA_USERNAME || 'NOT SET'}`);
console.log(`  SENDER_EMAIL: ${process.env.SENDER_EMAIL || 'NOT SET'}`);
console.log(`  Doc_Email1: ${process.env.Doc_Email1 || 'NOT SET'}`);

// Check if required environment variables are set
const requiredEnvVars = [
    'SMTP_SERVER', 'SMTP_PORT', 'SENDER_EMAIL', 'SENDER_NAME', 
    'smtp_username', 'EMAIL_PASSWORD', 
    'JIRA_USERNAME', 'JIRA_PASSWORD', 'JIRA_RAPID_VIEW'
];

// Optional email variables
const optionalEmailVars = ['Doc_Email1', 'Doc_Email2', 'Doc_Email3'];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
}

console.log(`✅ Using SMTP_SERVER: ${process.env.SMTP_SERVER}`);
console.log(`✅ Using SENDER_EMAIL: ${process.env.SENDER_EMAIL}`);
console.log(`✅ Using smtp_username: ${process.env.smtp_username}`);

interface Issue {
    key: string;
    summary: string;
    status: string;
    assignee: string;
    issueType?: string;
    priority?: string;
}

interface FormattedIssues {
    summary: string;
    table: string;
}

function formatIssuesTable(issues: Issue[]): FormattedIssues {
    // Count issues by status
    const statusCount = issues.reduce((acc: Record<string, number>, issue) => {
        acc[issue.status] = (acc[issue.status] || 0) + 1;
        return acc;
    }, {});

    // Create summary text with each status on a new line
    const summaryLines = [
        `Total issues: ${issues.length}`,
        'Issues by Status:'
    ];
    for (const [status, count] of Object.entries(statusCount)) {
        summaryLines.push(`${status}: ${count} issues`);
    }
    const summary = summaryLines.join('\n');

    // Create table header
    const tableHeader = 'Issue\tTitle\tAssignee\tStatus';

    // Create table rows
    const tableRows = issues.map(issue => 
        `${issue.key}\t${issue.summary}\t${issue.assignee}\t${issue.status}`
    ).join('\n');

    return {
        summary,
        table: `${tableHeader}\n${tableRows}`
    };
}

async function sendEmail(issues: Issue[]): Promise<void> {
    let recipients: string[] = [];
    let summary = '';
    let table = '';
    
    try {
        console.log('📧 Configuring email settings...');
        
        // Debug: Show SMTP configuration
        console.log('🔧 SMTP Configuration:');
        console.log(`  Host: ${process.env.SMTP_SERVER}`);
        console.log(`  Port: ${process.env.SMTP_PORT}`);
        console.log(`  Username: ${process.env.smtp_username}`);
        console.log(`  Sender: ${process.env.SENDER_EMAIL}`);
        console.log(`  SSL: ${process.env.USE_SSL}`);
        
        // Create transporter using custom SMTP settings from .env
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_SERVER,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.USE_SSL === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.smtp_username,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                // Do not fail on invalid certs for corporate networks
                rejectUnauthorized: false
            },
            connectionTimeout: 60000, // 60 seconds
            greetingTimeout: 30000, // 30 seconds
            socketTimeout: 60000 // 60 seconds
        });

        // Skip SMTP verification for faster testing
        console.log('🔄 Skipping SMTP verification for faster execution...');

        const { summary: formattedSummary, table: formattedTable } = formatIssuesTable(issues);
        summary = formattedSummary;
        table = formattedTable;

        // Debug: Show loaded email variables
        console.log('🔍 Checking email environment variables:');
        console.log(`  Doc_Email1: ${process.env.Doc_Email1 || 'not set'}`);
        console.log(`  Doc_Email2: ${process.env.Doc_Email2 || 'not set'}`);
        console.log(`  Doc_Email3: ${process.env.Doc_Email3 || 'not set'}`);
        console.log(`  EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? 'set' : 'not set'}`);
        console.log(`  SMTP_SERVER: ${process.env.SMTP_SERVER || 'not set'}`);

        // Prepare recipient list
        recipients = [
            process.env.Doc_Email1,
            process.env.Doc_Email2,
            process.env.Doc_Email3
        ].filter((email): email is string => email !== undefined && email.trim() !== '');

        if (recipients.length === 0) {
            throw new Error('No valid email recipients found in environment variables');
        }

        console.log(`📬 Sending email to ${recipients.length} recipient(s):`);
        recipients.forEach(email => console.log(`  - ${email}`));

        // Email options with updated HTML template
        const mailOptions = {
            from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
            to: recipients.join(','),
            subject: `Sprint Update`,
            text: `Sprint Update\n\nSummary\n${summary}\n\nBelow is the current status of all issues in the active sprint:\nActive Sprint Issues\n${table}\n\nThis is an automated update from the Jira Sprint Board.`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Sprint Update</title>
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                    
                    <!-- Header -->
                    <div style="background: #0052cc; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: left;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Sprint Update</h1>
                    </div>
                    
                    <!-- Main Content Container -->
                    <div style="background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
                        
                        <!-- Summary Section -->
                        <div style="padding: 30px; border-bottom: 1px solid #e1e5e9;">
                            <h2 style="color: #172b4d; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Summary</h2>
                            <div style="background-color: #f4f5f7; padding: 20px; border-radius: 6px; border-left: 4px solid #0052cc;">
                                <pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; white-space: pre-wrap; color: #42526e; font-size: 14px; line-height: 1.5;">${summary}</pre>
                            </div>
                        </div>
                        
                        <!-- Issues Section -->
                        <div style="padding: 30px;">
                            <p style="margin: 0 0 20px 0; color: #42526e; font-size: 14px;">Below is the current status of all issues in the active sprint:</p>
                            
                            <h2 style="color: #0052cc; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">Active Sprint Issues</h2>
                            
                            <!-- Issues Table -->
                            <div style="overflow-x: auto; border: 1px solid #dfe1e6; border-radius: 6px;">
                                <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                                    <thead>
                                        <tr style="background-color: #f4f5f7;">
                                            <th style="border: 1px solid #dfe1e6; padding: 12px 16px; text-align: left; font-weight: 600; color: #172b4d;">Issue</th>
                                            <th style="border: 1px solid #dfe1e6; padding: 12px 16px; text-align: left; font-weight: 600; color: #172b4d;">Title</th>
                                            <th style="border: 1px solid #dfe1e6; padding: 12px 16px; text-align: left; font-weight: 600; color: #172b4d;">Assignee</th>
                                            <th style="border: 1px solid #dfe1e6; padding: 12px 16px; text-align: left; font-weight: 600; color: #172b4d;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${issues.map((issue, index) => `
                                            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafc'}; border-bottom: 1px solid #dfe1e6;">
                                                <td style="border: 1px solid #dfe1e6; padding: 12px 16px;">
                                                    <a href="https://jira.corp.adobe.com/browse/${issue.key}" style="color: #0052cc; text-decoration: none; font-weight: 500; font-size: 14px;">${issue.key}</a>
                                                </td>
                                                <td style="border: 1px solid #dfe1e6; padding: 12px 16px; color: #172b4d; font-size: 14px; line-height: 1.4;">${issue.summary}</td>
                                                <td style="border: 1px solid #dfe1e6; padding: 12px 16px; color: #42526e; font-size: 14px;">${issue.assignee}</td>
                                                <td style="border: 1px solid #dfe1e6; padding: 12px 16px; color: #42526e; font-size: 14px;">
                                                    ${issue.status}
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b778c; font-size: 12px;">
                        <p style="margin: 0;">This is an automated update from the Jira Sprint Board.</p>
                    </div>
                </body>
                </html>
            `
        };

        // Send email with retry logic
        console.log('📤 Sending email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log(`📧 Message ID: ${info.messageId}`);
        console.log(`📬 Recipients: ${recipients.join(', ')}`);
        
        // Additional confirmation
        if (info.accepted && info.accepted.length > 0) {
            console.log(`✅ Email accepted by server for: ${info.accepted.join(', ')}`);
        }
        if (info.rejected && info.rejected.length > 0) {
            console.log(`❌ Email rejected by server for: ${info.rejected.join(', ')}`);
        }
        
    } catch (error) {
        console.error('❌ Error sending email:', error);
        console.log('\n📧 EMAIL CONTENT THAT WOULD HAVE BEEN SENT:');
        console.log('='.repeat(60));
        console.log(`To: ${recipients.join(', ')}`);
        console.log(`Subject: Sprint Update`);
        console.log('\nSUMMARY:');
        console.log(summary);
        console.log('\nISSUES TABLE:');
        console.log(table);
        console.log('='.repeat(60));
        console.log('⚠️ Email sending failed, but issue extraction was successful!');
        // Don't throw error, just continue
    }
}

async function fetchJiraIssuesFromScrumBoard(rapidViewId: string): Promise<Issue[]> {
    console.log('🚀 Extracting REAL issues from scrum board - MANUAL AUTH...');
    
    const browser = await puppeteer.launch({ 
        headless: false, // Make visible for manual authentication
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--start-maximized'
        ],
        defaultViewport: null
    });
    
    try {
        const page = await browser.newPage();
        
        const boardUrl = `https://jira.corp.adobe.com/secure/RapidBoard.jspa?rapidView=${rapidViewId}`;
        console.log(`🔄 Opening scrum board: ${boardUrl}`);
        console.log('');
        console.log('🖥️  MANUAL AUTHENTICATION APPROACH:');
        console.log('   1. Browser will open visibly');
        console.log('   2. Complete any Okta authentication manually if prompted');
        console.log('   3. System will automatically continue once on scrum board');
        console.log('   4. No clicking or automation required - just authenticate');
        console.log('');
        
        // Get expected email from environment
        const expectedEmail = process.env.JIRA_USERNAME || '';
        console.log(`📧 Expected login email: ${expectedEmail}`);
        
        // Navigate to board
        await page.goto(boardUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Simple approach: Wait for user to manually complete authentication if needed
        console.log('⏳ Waiting for board to be accessible...');
        console.log('📝 If you see Okta authentication, please complete it manually');
        console.log('🎯 System will continue automatically once on the scrum board');
        
        // Wait for the scrum board to be accessible
        let boardReady = false;
        let attempts = 0;
        const maxAttempts = 60; // 10 minutes total
        
        while (!boardReady && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            
            try {
                const currentUrl = page.url();
                console.log(`📍 Check ${attempts}/${maxAttempts}: ${currentUrl.includes('RapidBoard') ? '✅ ON SCRUM BOARD' : '⏳ Waiting for authentication...'}`);
                
                if (currentUrl.includes('jira.corp.adobe.com') && currentUrl.includes('RapidBoard')) {
                    console.log('🎉 Scrum board detected! Proceeding with data extraction...');
                    boardReady = true;
                    break;
                }
                
                if (attempts % 6 === 0) { // Every minute
                    console.log(`⏳ Still waiting... (${Math.floor(attempts/6)} minutes elapsed)`);
                    console.log(`📍 Current URL: ${currentUrl}`);
                }
            } catch (error) {
                console.log(`⚠️ Check ${attempts} failed, continuing...`);
            }
        }
        
        if (!boardReady) {
            throw new Error('Timeout waiting for scrum board access - please ensure authentication is completed');
        }
        
        // Wait for board to fully load
        console.log('⏳ Waiting for scrum board to fully load...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // Increased wait time
        
        // Wait for dynamic content to load
        console.log('⏳ Waiting for dynamic content to load...');
        try {
            await page.waitForSelector('.ghx-issue, .js-issue, [data-issue-key]', { timeout: 10000 });
            console.log('✅ Issue elements detected on page');
        } catch (error) {
            console.log('⚠️ No issue elements detected, continuing anyway...');
        }
        
        // Extract ALL real issues from the scrum board
        console.log('🔍 Extracting REAL issues from scrum board (preferring CQDOC)...');
        const issues = await page.evaluate(() => {
            const extractedIssues: any[] = [];
            
            console.log('🔍 Analyzing scrum board for issues with full details...');
            
            // Debug: Check what's on the page
            console.log(`Page title: ${document.title}`);
            console.log(`Page URL: ${window.location.href}`);
            console.log(`Body classes: ${document.body.className}`);
            
            // First, let's focus on the actual scrum board content area
            const boardContent = document.querySelector('#ghx-pool, .ghx-pool, .js-pool, .ghx-work, .ghx-board-content, .rapid-board-content') ||
                                document.querySelector('[data-rapid-view-id]') ||
                                document.querySelector('.ghx-swimlane-header') ||
                                document.body;
            
            console.log(`Analyzing board content area: ${boardContent?.className || 'document.body'}`);
            console.log(`Board content element tag: ${boardContent?.tagName}`);
            console.log(`Board content text length: ${boardContent?.textContent?.length || 0}`);
            
            // Debug: Check for any CQDOC text on the page first
            const pageText = document.body.textContent || '';
            const cqdocInPage = pageText.match(/CQDOC-\d+/g);
            console.log(`🔍 CQDOC issues found in page text: ${cqdocInPage?.length || 0}`);
            if (cqdocInPage && cqdocInPage.length > 0) {
                console.log(`CQDOC issues: ${cqdocInPage.slice(0, 5).join(', ')}${cqdocInPage.length > 5 ? '...' : ''}`);
            }
            
            // Look for issue cards first (more reliable than text parsing)
            const issueCardSelectors = [
                '.ghx-issue',
                '.js-issue',
                '[data-issue-key]',
                '.ghx-issue-content'
            ];
            
            let foundIssues = false;
            
            for (const selector of issueCardSelectors) {
                const cards = boardContent?.querySelectorAll(selector) || [];
                console.log(`Found ${cards.length} cards with selector: ${selector}`);
                
                if (cards.length > 0) {
                    foundIssues = true;
                    cards.forEach((card, index) => {
                        const cardText = card.textContent || '';
                        
                        // Extract issue key
                        const issueKey = card.getAttribute('data-issue-key') ||
                                       cardText.match(/[A-Z]{2,}-\d+/)?.[0];
                        
                        if (issueKey) {
                            console.log(`Processing card ${index + 1}: ${issueKey}`);
                            
                            // Extract summary/title
                            let summary = `Task for ${issueKey}`;
                            const summarySelectors = [
                                '.ghx-summary',
                                '.issue-summary', 
                                '.summary',
                                '.ghx-issue-content',
                                '.ghx-key-summary'
                            ];
                            
                            for (const summarySelector of summarySelectors) {
                                const summaryElement = card.querySelector(summarySelector);
                                if (summaryElement) {
                                    const summaryText = summaryElement.textContent?.trim();
                                    if (summaryText && summaryText.length > 10 && summaryText.length < 300) {
                                        summary = summaryText.replace(issueKey, '').trim();
                                        console.log(`  📄 Found summary: ${summary.substring(0, 50)}...`);
                                        break;
                                    }
                                }
                            }
                            
                            // Extract assignee
                            let assignee = 'Unassigned';
                            
                            // Try to find assignee in the card text
                            const cardTextContent = cardText.toLowerCase();
                            if (cardTextContent.includes('assignee:')) {
                                const assigneeMatch = cardText.match(/Assignee:\s*([^,\n\r\t]+)/i);
                                if (assigneeMatch && assigneeMatch[1]) {
                                    let extractedAssignee = assigneeMatch[1].trim();
                                    extractedAssignee = extractedAssignee.replace(/^Assignee:\s*/i, '').trim();
                                    
                                    if (extractedAssignee && 
                                        !extractedAssignee.toLowerCase().includes('story') &&
                                        !extractedAssignee.toLowerCase().includes('task') &&
                                        !extractedAssignee.toLowerCase().includes('bug') &&
                                        !extractedAssignee.toLowerCase().includes('epic') &&
                                        !extractedAssignee.toLowerCase().includes('cqdoc') &&
                                        !extractedAssignee.toLowerCase().includes('new feature') &&
                                        !extractedAssignee.toLowerCase().includes('issue type') &&
                                        extractedAssignee.length > 2 &&
                                        extractedAssignee.length < 50) {
                                        assignee = extractedAssignee;
                                        console.log(`  👤 Found assignee from text: ${assignee}`);
                                    }
                                }
                            }
                            
                            // If not found in text, try avatar elements
                            if (assignee === 'Unassigned') {
                                const assigneeSelectors = [
                                    '.ghx-avatar img',
                                    '.assignee img',
                                    'img[alt]',
                                    '.ghx-assignee',
                                    '.assignee',
                                    '[data-tooltip*="Assignee"]',
                                    '[title*="Assignee"]',
                                    '.ghx-avatar',
                                    '[data-tooltip]'
                                ];
                                
                                for (const assigneeSelector of assigneeSelectors) {
                                    const assigneeElement = card.querySelector(assigneeSelector);
                                    if (assigneeElement) {
                                        const alt = assigneeElement.getAttribute('alt') || 
                                                  assigneeElement.getAttribute('title') ||
                                                  assigneeElement.getAttribute('data-tooltip') ||
                                                  assigneeElement.textContent?.trim();
                                        if (alt && 
                                            !alt.toLowerCase().includes('avatar') && 
                                            !alt.toLowerCase().includes('story') &&
                                            !alt.toLowerCase().includes('task') &&
                                            !alt.toLowerCase().includes('bug') &&
                                            !alt.toLowerCase().includes('cqdoc') &&
                                            !alt.toLowerCase().includes('new feature') &&
                                            !alt.toLowerCase().includes('issue type') &&
                                            alt.length > 2 && 
                                            alt.length < 50) {
                                            assignee = alt.replace(/^Assignee:\s*/i, '').trim();
                                            console.log(`  👤 Found assignee from avatar: ${assignee}`);
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // Extract status from column
                            let status = 'To Do';
                            
                            // Look for column this card is in
                            let currentElement: Element | null = card;
                            let searchAttempts = 0;
                            const maxSearchAttempts = 10;
                            
                            while (currentElement && searchAttempts < maxSearchAttempts) {
                                searchAttempts++;
                                
                                const elementClasses = currentElement.className || '';
                                
                                if (elementClasses.includes('ghx-column') || 
                                    elementClasses.includes('column') ||
                                    elementClasses.includes('ghx-swimlane')) {
                                    
                                    const columnText = currentElement.textContent?.toLowerCase() || '';
                                    
                                    if (columnText.includes('to do') || columnText.includes('todo')) {
                                        status = 'To Do';
                                    } else if (columnText.includes('qualified')) {
                                        status = 'Qualified';
                                    } else if (columnText.includes('ready to document')) {
                                        status = 'Ready to Document';
                                    } else if (columnText.includes('in progress')) {
                                        status = 'In Progress';
                                    } else if (columnText.includes('tech review')) {
                                        status = 'In Tech Review';
                                    } else if (columnText.includes('seo') || columnText.includes('editorial')) {
                                        status = 'In SEO Optimization and Editorial Review';
                                    } else if (columnText.includes('done') || columnText.includes('complete')) {
                                        status = 'Done';
                                    }
                                    
                                    break;
                                }
                                
                                currentElement = currentElement.parentElement;
                            }
                            
                            console.log(`  📊 Final status: ${status}`);
                            
                            // Add the extracted issue
                            extractedIssues.push({
                                key: issueKey,
                                summary,
                                status,
                                assignee,
                                issueType: 'Documentation',
                                priority: 'Medium'
                            });
                            
                            console.log(`  ✅ Extracted: ${issueKey} | ${assignee} | ${status}`);
                        }
                    });
                    
                    if (extractedIssues.length > 0) {
                        break; // Found issues, no need to try other selectors
                    }
                }
            }
            
            console.log(`🎯 Successfully extracted ${extractedIssues.length} issues from scrum board`);
            return extractedIssues;
        });
        
        if (issues.length === 0) {
            throw new Error('No issues found on the scrum board - please verify the board contains issues');
        }
        
        console.log(`✅ Successfully extracted ${issues.length} REAL issues from scrum board!`);
        
        // Display extracted issues
        console.log('\n📋 EXTRACTED REAL ISSUES:');
        console.log('='.repeat(80));
        issues.forEach((issue, index) => {
            console.log(`${(index + 1).toString().padStart(2)}. ${issue.key}`);
            console.log(`    Summary: ${issue.summary}`);
            console.log(`    Assignee: ${issue.assignee}`);
            console.log(`    Status: ${issue.status}`);
            console.log('');
        });
        console.log('='.repeat(80));
        
        return issues;
        
    } catch (error) {
        console.error('❌ Failed to extract real issues from scrum board:', error);
        throw error;
    } finally {
        // Keep browser open for a moment to see results
        console.log('⏳ Keeping browser open for 10 seconds to review...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
    }
}

async function getJiraIssues(): Promise<void> {
    try {
        console.log('🚀 Starting Jira issue extraction...');
        
        const rapidViewId = process.env.JIRA_RAPID_VIEW || '44313';
        console.log(`📋 Using Rapid View ID: ${rapidViewId}`);
        
        // Only try to get real issues from scrum board
        const issues = await fetchJiraIssuesFromScrumBoard(rapidViewId);
        
        if (issues.length === 0) {
            console.log('❌ No issues extracted from scrum board');
            return;
        }
        
        console.log(`✅ Found ${issues.length} issues from scrum board`);
        
        // Send email with real issues
        await sendEmail(issues);
        
    } catch (error) {
        console.error('❌ Error in getJiraIssues:', error);
        throw error;
    }
}

// Main execution
console.log('🎯 Starting Jira scraper...');
getJiraIssues().catch(console.error); 