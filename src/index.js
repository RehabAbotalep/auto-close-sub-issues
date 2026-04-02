const core = require('@actions/core');
const { Octokit } = require('@octokit/rest');

async function run() {
  try {
    // Get inputs from action.yml
    const token = core.getInput('github_token', { required: true });
    const repository = core.getInput('repository', { required: true });
    const issueNumber = core.getInput('issue_number', { required: true });

    // Validate inputs
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: "${repository}". Expected "owner/repo".`);
    }

    if (!issueNumber || isNaN(parseInt(issueNumber, 10))) {
      throw new Error(`Invalid issue_number: "${issueNumber}". Expected a numeric value.`);
    }

    const issueNumberInt = parseInt(issueNumber, 10);

    // Initialize Octokit
    const octokit = new Octokit({ auth: token });

    core.info(`Fetching sub-issues for parent issue #${issueNumber} in ${repository}...`);
    
    // Fetch sub-issues for the parent issue using GitHub's Sub-issues API
    // This is an official GitHub API endpoint supported by Octokit
    // See: https://docs.github.com/en/issues/tracking-your-work-with-issues/about-tasklists
    // Uses pagination to handle repositories with many sub-issues
    const subIssues = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100; // Maximum allowed by GitHub API
    let totalSubIssues = 0;

    while (hasMore) {
      const response = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues', {
        owner,
        repo,
        issue_number: issueNumberInt,
        per_page: perPage,
        page,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      const issues = response.data;
      if (issues.length === 0) {
        hasMore = false;
      } else {
        totalSubIssues += issues.length;
        // Only collect open sub-issues; closed ones should remain unchanged
        subIssues.push(...issues
          .filter((issue) => issue.state === 'open')
          .map((issue) => issue.number));
        // If we received fewer items than requested, we've reached the last page
        if (issues.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    // Check if there are sub-issues
    if (subIssues.length === 0) {
      core.info('No open sub-issues found for the parent issue.');
      core.setOutput('closed_count', 0);
      core.setOutput('total_count', totalSubIssues);
      return;
    }

    core.info(`Found ${subIssues.length} open sub-issue(s): ${subIssues.join(', ')}`);

    // Close each sub-issue concurrently for better performance
    // Process in chunks to avoid overwhelming the API
    const chunkSize = 10;
    const closedIssues = [];
    const failedIssues = [];

    for (let i = 0; i < subIssues.length; i += chunkSize) {
      const chunk = subIssues.slice(i, i + chunkSize);
      const promises = chunk.map(async (subIssueNumber) => {
        try {
          await octokit.issues.update({
            owner,
            repo,
            issue_number: subIssueNumber,
            state: 'closed',
            state_reason: 'completed',
          });
          core.info(`Successfully closed sub-issue #${subIssueNumber}`);
          return { success: true, number: subIssueNumber };
        } catch (error) {
          core.warning(`Failed to close sub-issue #${subIssueNumber}: ${error.message}`);
          return { success: false, number: subIssueNumber, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => {
        if (result.success) {
          closedIssues.push(result.number);
        } else {
          failedIssues.push(result.number);
        }
      });
    }

    // Add comment to parent issue
    if (closedIssues.length > 0 || failedIssues.length > 0) {
      let commentBody;
      if (closedIssues.length > 0 && failedIssues.length > 0) {
        commentBody = `✅ Automatically closed the following sub-issues: ${closedIssues.map(num => `#${num}`).join(' ')}\n\n⚠️ Failed to close ${failedIssues.length} sub-issue(s): ${failedIssues.map(num => `#${num}`).join(' ')}`;
      } else if (closedIssues.length > 0) {
        commentBody = `✅ Automatically closed the following sub-issues: ${closedIssues.map(num => `#${num}`).join(' ')}`;
      } else {
        commentBody = `⚠️ Failed to close all sub-issue(s): ${failedIssues.map(num => `#${num}`).join(' ')}`;
      }

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumberInt,
        body: commentBody
      });
      core.info('Added comment to parent issue.');
    }

    // Set outputs
    core.setOutput('closed_count', closedIssues.length);
    core.setOutput('total_count', totalSubIssues);
    
    const summary = `Closed ${closedIssues.length}/${subIssues.length} sub-issue(s).`;
    if (failedIssues.length > 0) {
      core.warning(`${summary} ${failedIssues.length} sub-issue(s) failed to close.`);
    } else {
      core.info(`${summary} All sub-issues processed successfully.`);
    }

  } catch (error) {
    // Provide more detailed error information for debugging
    core.error(`Error details: ${error.stack || error.message}`);
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();