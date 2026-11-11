import { test, expect } from "@playwright/test";

test("Complete Instantly E2E Journey: Landing -> Auth Guard -> Workspace -> Logout", async ({
  page,
}) => {
  // 1. Open Landing Page ("/")
  await page.goto("/");
  await expect(page.getByTestId("landing-page")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your inbox, sorted for you." })
  ).toBeVisible();

  // 2. Verify logged-out guard: visiting /tasks directly redirects to /login?next=%2Ftasks
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login\?next=%2Ftasks/);

  // 3. Navigate to Register and back to Login
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/register/);
  await expect(
    page.getByRole("heading", { name: "Create account" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 4. Enter Demo Workspace and verify redirect to Overview
  await page.getByTestId("enter-demo-workspace-button").click();
  await expect(page).toHaveURL(/\/overview/);
  await expect(page.getByText("Your day, in focus.")).toBeVisible();

  // 5. Open Unified Inbox, search, filter, and rewrite a reply draft
  await page.getByTestId("nav-inbox").click();
  await expect(page).toHaveURL(/\/inbox/);
  await expect(
    page.getByRole("heading", { name: "Unified Inbox" })
  ).toBeVisible();

  const searchInput = page.getByTestId("inbox-search-input");
  await searchInput.fill("Elena");
  await expect(page.getByText("Elena Rostova").first()).toBeVisible();
  await searchInput.fill("");

  await page.getByTestId("inbox-urgency-filter").selectOption("IMMEDIATE");
  await page.getByTestId("inbox-message-card-demo-msg-001").click();
  await page.getByTestId("tab-reply-assistant").click();
  await page.getByTestId("tone-concise").click();
  await page.getByTestId("regenerate-reply-button").click();
  await expect(page.getByTestId("reply-draft-textarea")).toContainText(
    "Received regarding"
  );

  // 6. Navigate to Tasks, create a task, and mark it done
  await page.getByTestId("nav-tasks").click();
  await expect(page).toHaveURL(/\/tasks/);
  await page
    .getByTestId("new-task-title-input")
    .fill("E2E Verified Executive Follow-up");
  await page.getByTestId("create-task-submit-button").click();
  await expect(
    page.getByText("E2E Verified Executive Follow-up")
  ).toBeVisible();

  const completeButtons = page.locator('[data-testid^="complete-task-"]');
  await completeButtons.first().click();

  // 7. View Analytics and export report
  await page.getByTestId("nav-analytics").click();
  await expect(page).toHaveURL(/\/analytics/);
  await page.getByTestId("export-report-button").click();
  await expect(page.getByTestId("toast-notification").first()).toBeVisible();

  // 8. Logout returns to Landing Page ("/")
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByTestId("landing-page")).toBeVisible();
});
