# Codecov Setup Instructions

Follow these steps to enable Codecov coverage reporting for the Dhanam Ledger project.

---

## Step 1: Sign Up for Codecov

1. Go to https://codecov.io/
2. Click **"Sign up"** in the top right
3. Choose **"Sign in with GitHub"**
4. Authorize Codecov to access your GitHub account

---

## Step 2: Add Repository

1. After signing in, you'll be on the Codecov dashboard
2. Click **"Add new repository"** or use the **"+"** button
3. Find and select **`madfam-io/dhanam`** from the list
4. Click **"Setup repo"**

If you don't see your repository:

- Make sure you're logged in with the correct GitHub account
- Check that you have admin access to the repository
- Try refreshing the page

---

## Step 3: Get Repository Upload Token

1. In the Codecov dashboard, navigate to your repository
2. Click on **"Settings"** (gear icon)
3. Go to **"General"** tab
4. Find the **"Repository Upload Token"** section
5. Click **"Show"** or **"Copy"** to reveal the token
6. Copy the entire token string (it looks like: `a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6`)

**Important:** Keep this token secret! Don't commit it to your repository.

---

## Step 4: Add Token to GitHub Secrets

1. Go to your GitHub repository: https://github.com/madfam-io/dhanam
2. Click on **"Settings"** tab
3. In the left sidebar, navigate to **"Secrets and variables"** → **"Actions"**
4. Click **"New repository secret"** button
5. Fill in the form:
   - **Name:** `CODECOV_TOKEN`
   - **Secret:** (paste the token you copied from Codecov)
6. Click **"Add secret"**

---

## Step 5: Verify Setup

### Option A: Push a Commit

1. Push any commit to your branch
2. Go to GitHub → Actions tab
3. Watch the "Test Coverage" workflow run
4. After completion, check Codecov dashboard for the report

### Option B: Manual Trigger

1. Go to GitHub → Actions tab
2. Select "Test Coverage" workflow
3. Click "Run workflow" dropdown
4. Select your branch
5. Click "Run workflow" button

---

## Step 6: Verify Coverage Upload

After the workflow completes:

1. Go back to Codecov dashboard: https://codecov.io/gh/madfam-io/dhanam
2. You should see:
   - Latest commit with coverage percentage
   - Coverage graph/chart
   - Files with coverage data
   - Component breakdown

If you see an error or no data:

- Check GitHub Actions logs for upload errors
- Verify the token was added correctly
- Ensure the workflow completed successfully
- Wait a few minutes and refresh Codecov

---

## Step 7: Configure Coverage Settings (Optional)

In Codecov dashboard:

1. Go to Settings → General
2. Adjust settings:
   - **Default Branch:** `main`
   - **Coverage Precision:** `2` (already configured in codecov.yml)
   - **Status Checks:** Enable for pull requests

3. Go to Settings → Badges & Graphs
4. Copy badge markdown for your README (already done)

---

## Step 8: Test Pull Request Integration

1. Create a new branch
2. Make a small change (e.g., add a comment)
3. Push and create a pull request
4. Wait for CI to complete
5. You should see:
   - Codecov bot comment on PR
   - Coverage comparison to base branch
   - Status check (pass/fail)

---

## Troubleshooting

### Token Not Working

**Error:** `Error uploading coverage reports`

**Solution:**

```bash
# Verify token is set correctly
# Go to GitHub Settings → Secrets → Actions
# Make sure CODECOV_TOKEN exists and is not expired
```

### No Coverage Data

**Error:** Coverage shows 0% or "No data"

**Solution:**

1. Check that tests are actually running in CI
2. Verify `lcov.info` file is generated
3. Check GitHub Actions logs for coverage step
4. Ensure `apps/api/coverage/lcov.info` path is correct

### Upload Fails

**Error:** `HTTP 403 Forbidden`

**Solution:**

- Token may be incorrect or expired
- Regenerate token in Codecov settings
- Update GitHub secret with new token

### Coverage Decreased

**Warning:** "Coverage decreased by X%"

**This is expected when:**

- Adding new uncovered code
- Removing tests
- Changing coverage configuration

**To fix:**

- Add tests for new code
- Ensure coverage stays above 80%
- Review Codecov comments for specific files

---

## Verification Checklist

After completing setup:

- [ ] Codecov account created
- [ ] Repository added to Codecov
- [ ] Upload token copied
- [ ] Token added to GitHub Secrets as `CODECOV_TOKEN`
- [ ] Workflow ran successfully
- [ ] Coverage data visible in Codecov dashboard
- [ ] Badge shows coverage percentage
- [ ] PR comments working (test with a PR)
- [ ] Status checks enabled
- [ ] Team has access to Codecov dashboard

---

## Next Steps

1. **Monitor Coverage Trends**
   - Check Codecov dashboard weekly
   - Review coverage on every PR
   - Aim to maintain or increase coverage

2. **Set Up Notifications** (Optional)
   - Configure Slack integration
   - Set up email alerts for coverage drops
   - Enable GitHub annotations

3. **Share with Team**
   - Share Codecov dashboard link
   - Explain how to read coverage reports
   - Set expectations for coverage thresholds

---

## Useful Links

- Codecov Dashboard: https://codecov.io/gh/madfam-io/dhanam
- Codecov Docs: https://docs.codecov.com/
- GitHub Actions: https://github.com/madfam-io/dhanam/actions
- Coverage Badge: Already in README.md

---

## Support

**Issues with Codecov:**

- Codecov Support: https://codecov.io/support
- GitHub Discussions: https://github.com/codecov/codecov-action/discussions

**Issues with GitHub Actions:**

- Check workflow logs
- Review CICD_SETUP.md
- Contact team lead

---

**Estimated Setup Time:** 5-10 minutes

**Status:** Ready for setup ✅
