# Jira MCP Tool for Cursor

A Model Context Protocol (MCP) tool that allows Cursor AI to read Jira issue descriptions and comments directly within your coding environment.

## Setup in Cursor

1. **Install the dependencies and build the package**:
   ```bash
   npm install
   npm run build
   ```

2. **Configure your Jira credentials** in the .env file:
   Make a copy of .env.example as .env and add all your credentials in that file

3. **Register the tool in Cursor**:
   - Open Cursor
   - Go to Settings > MCP Tools
   - Click "Add Tool"
   - Enter the command: `node /<clone_repo_parennt>/cursor-jira-mcp/build/index.js`
   - Click "Add"

## Using with Cursor AI

Once configured, you can ask Cursor AI to retrieve Jira information using natural language:

- "Show me the description for PROJ-123"
- "What are the comments on JIRA-456?"
- "Get details about the bug in TEAM-789"

### Available Commands

Cursor AI can use these commands through the MCP tool:

1. **Read Issue Description**: Retrieves the full description of a Jira issue
2. **Read Issue Comments**: Retrieves all comments on a Jira issue

### Example Interactions

**Asking about a Jira issue:**
```
You: Can you tell me about PROJ-123?
Cursor AI: Let me check that Jira issue for you...
[Cursor AI retrieves and displays the issue description]
```

**Asking about comments:**
```
You: What feedback did the team leave on TEAM-456?
Cursor AI: Let me get the comments from that Jira issue...
[Cursor AI retrieves and displays the issue comments]
```
## Recommendations

1. Try with `jira.dev.corp.company.com` first as the jira URL, if that doesn't work then use `jira.corp.comapny.com`.

## Troubleshooting

If the tool isn't working properly in Cursor:

1. Verify your credentials are correctly set in your .env folder
2. Try running `npm run start` to check if JIRA authentication is successful.
