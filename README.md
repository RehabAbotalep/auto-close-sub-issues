# Auto Close Sub-Issues

Automatically closes all sub-issues associated with a parent issue when the parent is closed.

![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Ready-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

- Automatically closes all open sub-issues when parent issue is closed
- Adds a summary comment to the parent issue listing closed sub-issues
- Handles large numbers of sub-issues safely with pagination

## Usage

Add this workflow to your repository at `.github/workflows/close-sub-issues.yml`:

```yaml
name: Close Sub-Issues

on:
  issues:
    types: [closed]

permissions:
  issues: write      # Required to close issues and add comments
  contents: read     # Required to access repository

jobs:
  close-sub-issues:
    runs-on: ubuntu-latest
    steps:
      - name: Close Sub-Issues
        uses: RehabAbotalep/auto-close-sub-issues@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          issue_number: ${{ github.event.issue.number }}
          repository: ${{ github.repository }}
```

## Permissions

This action requires the following permissions to work correctly:

| Permission | Reason |
|------------|--------|
| `issues: write` | Required to close sub-issues and add comments to the parent issue |
| `contents: read` | Required to access repository information |

> **Note:** If you encounter a `403 - Resource not accessible by integration` error, make sure you've added the `permissions` block to your workflow file as shown above.

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `github_token` | GitHub token for authentication | Yes |
| `issue_number` | The issue number of the parent issue | Yes |
| `repository` | The repository in `owner/repo` format | Yes |

## Outputs

| Output | Description |
|--------|-------------|
| `closed_count` | The number of sub-issues that were successfully closed |
| `total_count` | The total number of sub-issues found |

## Example

When a parent issue is closed, this action will:

1. Find all open sub-issues
2. Close each sub-issue
3. Add a comment to the parent issue:
```
✅ Automatically closed the following sub-issues: #2 #3 #4
```

## License

MIT
