# Branch Protection Setup Guide

Configure branch protection rules to enforce code quality and testing standards.

---

## Why Branch Protection?

Branch protection prevents:

- ❌ Direct pushes to main/develop
- ❌ Merging failing tests
- ❌ Merging without code review
- ❌ Accidental force pushes
- ❌ Deleting protected branches

Branch protection ensures:

- ✅ All code is tested
- ✅ Code is reviewed
- ✅ CI passes before merge
- ✅ History is preserved

---

## Step 1: Navigate to Settings

1. Go to your GitHub repository: https://github.com/madfam-io/dhanam
2. Click **"Settings"** tab (must have admin access)
3. In the left sidebar, click **"Branches"**
4. Click **"Add branch protection rule"** or **"Add rule"**

---

## Step 2: Configure Main Branch Protection

### Branch Name Pattern

```
main
```

### Protection Settings

#### ✅ Require a pull request before merging

- [x] **Require approvals:** `1` (recommended)
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [x] **Require review from Code Owners** (if CODEOWNERS file exists)
- [ ] Restrict who can dismiss pull request reviews
- [x] **Require approval of the most recent reviewable push**

#### ✅ Require status checks to pass before merging

- [x] **Require branches to be up to date before merging**

**Select the following status checks:**

- [x] `test` (Test & Coverage from test-coverage.yml)
- [x] `test-e2e` (E2E Tests from test-coverage.yml)
- [x] `build` (Build Check from test-coverage.yml)
- [x] `lint` (ESLint from lint.yml)
- [x] `type-check` (TypeScript from lint.yml)
- [x] `prettier` (Format check from lint.yml)
- [x] `check-migrations` (Prisma migration drift validation)

_Note: Status checks will appear in the list after they run at least once._

Local pre-push hooks run `pnpm format:check`, `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `pnpm build`, and Prisma schema validation. The live migration
status check only runs locally when `DATABASE_URL` is explicitly supplied; the
required database-backed drift gate is the `check-migrations` workflow above.

#### ✅ Require conversation resolution before merging

- [x] **Require conversation resolution before merging**

#### ✅ Require signed commits (Optional but recommended)

- [ ] Require signed commits

#### ✅ Require linear history (Optional)

- [ ] Require linear history

#### ✅ Require deployments to succeed before merging (Optional)

- [ ] Require deployments to succeed

#### ❌ Do not allow bypassing the above settings

- [ ] Allow specified actors to bypass required pull requests
  - Unless you need admins to bypass (not recommended)

#### ✅ Restrict who can push to matching branches (Optional)

- [ ] Restrict pushes that create matching branches
  - Leave unchecked to allow creating branches

#### ✅ Rules applied to everyone

- [x] **Do not allow bypassing the above settings**
- [x] **Include administrators**

---

## Step 3: Configure Develop Branch Protection

Click **"Add rule"** again and repeat with these settings:

### Branch Name Pattern

```
develop
```

### Protection Settings

Same as main branch, but you might want to:

- Reduce required approvals to `0` or `1` (for faster iteration)
- Keep all status checks required
- Allow force push with lease (optional for rebasing)

#### Recommended Settings for Develop:

- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ❌ Require pull request reviews (optional for develop)
- ✅ Require conversation resolution
- ❌ Require linear history

---

## Step 4: Configure Claude Branch Protection (Optional)

For automated branches from Claude:

### Branch Name Pattern

```
claude/**
```

### Protection Settings

More lenient for development:

- ❌ Require pull request reviews (allow direct push)
- ✅ Require status checks to pass
- ❌ Require branches to be up to date (optional)
- ❌ Require conversation resolution
- ❌ Restrict pushes

**Purpose:** Allow Claude to push directly but still run CI checks

---

## Step 5: Verify Protection Rules

After saving:

1. Go back to **Settings** → **Branches**
2. You should see your rules listed:

   ```
   main          (3 rules active)
   develop       (2 rules active)
   claude/**     (1 rule active)
   ```

3. Click on each rule to verify settings

---

## Step 6: Test Branch Protection

### Test 1: Try Direct Push to Main

```bash
git checkout main
git commit --allow-empty -m "test: branch protection"
git push origin main
```

**Expected:** ❌ Push rejected with error:

```
remote: error: GH006: Protected branch update failed
```

### Test 2: Create PR with Failing Tests

1. Create a branch
2. Break a test intentionally
3. Push and create PR
4. **Expected:** ❌ Status checks fail, merge blocked

### Test 3: Create PR with Passing Tests

1. Create a branch
2. Make a valid change
3. Push and create PR
4. Wait for CI to pass
5. **Expected:** ✅ Merge button enabled

---

## Recommended Branch Protection Matrix

| Setting                 | main | develop | claude/\*\* | feature/\* |
| ----------------------- | ---- | ------- | ----------- | ---------- |
| Require PR              | ✅   | ✅      | ❌          | ❌         |
| Require approvals       | 1-2  | 0-1     | 0           | 0          |
| Require status checks   | ✅   | ✅      | ✅          | ❌         |
| Up to date required     | ✅   | ✅      | ❌          | ❌         |
| Conversation resolution | ✅   | ✅      | ❌          | ❌         |
| Include administrators  | ✅   | ✅      | ❌          | ❌         |
| Allow force push        | ❌   | ❌      | ✅          | ✅         |
| Allow deletions         | ❌   | ❌      | ✅          | ✅         |

---

## Status Checks Reference

These checks must pass before merging:

### From `test-coverage.yml`:

- **test** - Unit tests with coverage (15 min timeout)
- **test-e2e** - E2E integration tests (10 min timeout)
- **build** - Build verification (10 min timeout)

### From `lint.yml`:

- **lint** - ESLint checks (5 min timeout)
- **type-check** - TypeScript validation (5 min timeout)
- **prettier** - Code formatting (5 min timeout)

**Total time:** ~15-20 minutes for full CI run

---

## Bypassing Protection (Emergency)

If you need to bypass protection rules (emergency only):

### Option 1: Temporary Rule Modification

1. Go to Settings → Branches
2. Edit the rule
3. Uncheck "Include administrators"
4. Push your change
5. **Immediately re-enable the rule**

### Option 2: Use GitHub API

```bash
# Not recommended - leaves audit trail
gh api repos/madfam-io/dhanam/branches/main/protection \
  --method DELETE
```

### Option 3: Create Emergency Branch

```bash
# Use a different pattern not covered by rules
git checkout -b emergency/fix-prod
git push origin emergency/fix-prod
# Then merge via web with admin override
```

**⚠️ Only use in true emergencies!**

---

## Updating Protection Rules

As your team grows, adjust rules:

### Add More Reviewers

```
Require approvals: 1 → 2
```

### Add CODEOWNERS

Create `.github/CODEOWNERS`:

```
# API code requires backend team review
/apps/api/ @madfam-io/backend-team

# Web code requires frontend team review
/apps/web/ @madfam-io/frontend-team

# Infrastructure requires devops review
/infra/ @madfam-io/devops-team

# Critical files require admin review
/package.json @madfam-io/admins
/.github/workflows/ @madfam-io/admins
```

### Add More Status Checks

As you add workflows:

```
test-e2e
test-integration
test-performance
security-scan
dependency-check
```

---

## Troubleshooting

### Can't Merge - Status Checks Not Showing

**Issue:** Status checks required but not appearing

**Solution:**

1. Checks must run at least once to appear in list
2. Push a commit to trigger workflows
3. Wait for workflows to complete
4. Refresh Settings → Branches page
5. Checks should now appear in dropdown

### Status Check Names Don't Match

**Issue:** Check names in settings don't match workflow

**Solution:**
Check `jobs.<job_id>.name` in workflow files:

```yaml
jobs:
  test:
    name: Test & Coverage # This is what appears
```

Use the `name:` value, not the job ID.

### Can't Push to Protected Branch

**Issue:** Push rejected even though you're admin

**Solution:**
Check "Include administrators" is unchecked if you need admin bypass.

### PR Merge Blocked Despite Passing

**Issue:** All checks pass but can't merge

**Reasons:**

- Conversation not resolved
- Branch not up to date
- Review not approved
- Stale approval after new push

**Solution:** Address the specific blocking reason shown

---

## Best Practices

### ✅ DO:

- Require all status checks on main
- Require at least 1 approval
- Include administrators in rules
- Require conversation resolution
- Keep rules consistent across environments

### ❌ DON'T:

- Bypass protection rules regularly
- Allow direct push to main/develop
- Skip status checks to "save time"
- Disable rules temporarily and forget to re-enable
- Over-complicate with too many rules

---

## Verification Checklist

After setup:

- [ ] Main branch protection enabled
- [ ] Develop branch protection enabled
- [ ] Required status checks configured:
  - [ ] test
  - [ ] test-e2e
  - [ ] build
  - [ ] lint
  - [ ] type-check
  - [ ] prettier
- [ ] Pull request reviews required (1+ approvals)
- [ ] Branches must be up to date
- [ ] Conversation resolution required
- [ ] Include administrators checked
- [ ] Protection tested (try direct push)
- [ ] Team notified about new rules

---

## Migration Plan

If you have existing branches:

### Week 1: Soft Launch

- Enable protection on develop only
- Required checks but no reviews
- Let team adjust to workflow

### Week 2: Add Reviews

- Require 1 approval on develop
- Monitor for slowdowns
- Adjust as needed

### Week 3: Protect Main

- Enable full protection on main
- Required checks + reviews
- Enforce strictly

### Week 4: Review & Optimize

- Collect team feedback
- Adjust rules if needed
- Document any exceptions

---

## Support

**Issues with Branch Protection:**

- GitHub Docs: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- Team Lead: Review settings together
- GitHub Support: For technical issues

---

**Estimated Setup Time:** 5-10 minutes

**Status:** Ready for configuration ✅
