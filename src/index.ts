import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Try loading from parent directory of script
try {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} catch (e) {
  console.error("Error loading .env file:", e);
  // Ignore errors
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import JiraClient from "jira-client";

// Jira client configuration
interface JiraConfig {
  protocol: string;
  host: string;
  username: string;
  password: string;
  apiVersion: string;
  strictSSL: boolean;
}

// Initialize Jira client with environment variables
const jiraConfig: JiraConfig = {
  protocol: process.env.JIRA_PROTOCOL || "https",
  host: process.env.JIRA_HOST || "jira.corp.adobe.com",
  username: process.env.JIRA_USERNAME || "",
  password: process.env.JIRA_PASSWORD || "",
  apiVersion: process.env.JIRA_API_VERSION || "2",
  strictSSL: process.env.JIRA_STRICT_SSL !== "false",
};

// Create Jira client instance
const jira = new JiraClient(jiraConfig);

// Helper function to validate Jira configuration
function validateJiraConfig(): string | null {
  if (!jiraConfig.host) return "JIRA_HOST environment variable is not set";
  if (!jiraConfig.username) return "JIRA_USERNAME environment variable is not set";
  if (!jiraConfig.password) return "JIRA_PASSWORD environment variable is not set";
  return null;
}

// Function to test Jira authentication
async function testJiraAuthentication(): Promise<string | null> {
  try {
    // Try to get current user to verify credentials
    console.log('jiraConfig', jiraConfig);
    await jira.getCurrentUser();
    return null;
  } catch (error) {
    return `Authentication failed: ${(error as Error).message}`;
  }
}

// Create server instance
const server = new McpServer({
  name: "jira",
  version: "1.0.0",
});

// Register Jira tools
server.tool(
  "read-description",
  "Get the description of a Jira issue",
  {
    issueKey: z.string().describe("The Jira issue key (e.g., PROJECT-123)"),
  },
  async ({ issueKey }) => {
    // Validate Jira configuration
    const configError = validateJiraConfig();
    if (configError) {
      return {
        content: [
          {
            type: "text",
            text: `Configuration error: ${configError}\n\n`,
          },
        ],
      };
    }

    try {
      // Get issue data
      const issue = await jira.findIssue(issueKey);
      
      if (!issue) {
        return {
          content: [
            {
              type: "text",
              text: `Issue ${issueKey} not found`,
            },
          ],
        };
      }

      // Format issue description
      const description = issue.fields.description || "No description available";
      const summary = issue.fields.summary || "No summary available";
      const status = issue.fields.status?.name || "Unknown status";
      const issueType = issue.fields.issuetype?.name || "Unknown type";
      
      const formattedDescription = [
        `Issue: ${issueKey}`,
        `Summary: ${summary}`,
        `Type: ${issueType}`,
        `Status: ${status}`,
        `\nDescription:\n${description}`,
      ].join("\n");

      return {
        content: [
          {
            type: "text",
            text: formattedDescription,
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching Jira issue:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve issue ${issueKey}: ${(error as Error).message}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "read-comments",
  "Get the comments for a Jira issue",
  {
    issueKey: z.string().describe("The Jira issue key (e.g., PROJECT-123)"),
  },
  async ({ issueKey }) => {
    // Validate Jira configuration
    const configError = validateJiraConfig();
    if (configError) {
      return {
        content: [
          {
            type: "text",
            text: `Configuration error: ${configError}\n\n`,
          },
        ],
      };
    }

    try {
      // Get issue comments
      const comments = await jira.getComments(issueKey);
      
      if (!comments || !comments.comments || comments.comments.length === 0) {
        return {  
          content: [
            {
              type: "text",
              text: `No comments found for issue ${issueKey}`,
            },
          ],
        };
      }

      // Format comments
      const formattedComments = comments.comments.map((comment: any) => {
        const author = comment.author?.displayName || "Unknown";
        const created = new Date(comment.created).toLocaleString();
        const body = comment.body || "No content";
        
        return [
          `Author: ${author}`,
          `Date: ${created}`,
          `Comment:\n${body}`,
          "---",
        ].join("\n");
      });

      const commentsText = `Comments for ${issueKey}:\n\n${formattedComments.join("\n")}`;

      return {
        content: [
          {
            type: "text",
            text: commentsText,
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching Jira comments:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve comments for issue ${issueKey}: ${(error as Error).message}`,
          },
        ],
      };
    }
  },
);

// Start the server
async function main() {
  try {
    // Check Jira configuration
    const configError = validateJiraConfig();
    if (configError) {
      console.error(`Jira configuration error: ${configError}`);
      console.error("Please configure the required environment variables.");
      
      // For Cursor MCP, we should still start the server but tools will return error messages
      console.error("Starting server in limited mode (tools will return configuration instructions)");
    } else {
      // Test Jira authentication
      console.error("Testing Jira authentication...");
      const authError = await testJiraAuthentication();
      if (authError) {
        console.error(`Jira authentication error: ${authError}`);
        console.error("Please check your credentials.");
        
        // For Cursor MCP, we should still start the server but tools will return error messages
        console.error("Starting server in limited mode (tools will return authentication error messages)");
      } else {
        console.error("Jira authentication successful!");
      }
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Jira MCP Server running on stdio");
  } catch (error) {
    console.error("Error starting Jira MCP server:", error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.error('Received SIGINT signal, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM signal, shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});