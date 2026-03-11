import { expect, test, type Locator, type Page } from '@playwright/test';

type CanvasPoint = {
  x: number;
  y: number;
};

const SINGLE_WAYPOINT: CanvasPoint = { x: 300, y: 250 };
const EMPTY_CANVAS_SPOT: CanvasPoint = { x: 40, y: 40 };
const FIRST_PATH_WAYPOINT: CanvasPoint = { x: 240, y: 170 };
const SECOND_PATH_WAYPOINT: CanvasPoint = { x: 360, y: 170 };
const FIRST_SECTION_MIDPOINT: CanvasPoint = { x: 300, y: 170 };

const getCanvas = (page: Page): Locator => {
  return page.getByLabel('robot path editor canvas');
};

const getWaypointButtons = (page: Page): Locator => {
  return page.locator('[aria-label^="Select waypoint "]');
};

const clickCanvas = async (page: Page, point: CanvasPoint): Promise<void> => {
  const canvas = getCanvas(page);
  await expect(canvas).toBeVisible();
  await canvas.click({ position: point });
};

const addWaypoint = async (page: Page, point: CanvasPoint): Promise<void> => {
  await page.getByRole('button', { name: 'tool add point' }).click();
  await clickCanvas(page, point);
};

const expectWaypointCount = async (
  page: Page,
  count: number,
): Promise<void> => {
  await expect(getWaypointButtons(page)).toHaveCount(count);
};

test('basic editing flow works', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByLabel('top toolbar')).toBeVisible();
  await expect(getCanvas(page)).toBeVisible();

  await addWaypoint(page, SINGLE_WAYPOINT);

  await expectWaypointCount(page, 1);
  await expect(page.getByLabel('waypoint properties')).toBeVisible();

  const headingButton = page.getByRole('button', {
    name: 'Heading',
    exact: true,
  });
  await headingButton.click();
  await expect(headingButton).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'file menu' }).click();
  await page.getByRole('button', { name: 'Export CSV' }).click();
});

test('path and library management are accessible', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'create new path' }).click();
  await expect(page.getByLabel(/set Path 2 active/i)).toBeVisible();
  await expect(page.getByLabel('rename Path 2')).toBeVisible();

  await page.getByRole('button', { name: 'new library point' }).click();
  await expect(page.getByLabel('library point name')).toBeVisible();
  await expect(page.getByLabel('library point x')).toBeVisible();
});

test('section rMin inspector appears after section selection', async ({
  page,
}) => {
  await page.goto('/');

  await addWaypoint(page, FIRST_PATH_WAYPOINT);
  await addWaypoint(page, SECOND_PATH_WAYPOINT);
  await page.getByRole('button', { name: 'tool select' }).click();

  await clickCanvas(page, FIRST_SECTION_MIDPOINT);

  const sectionRMinInput = page.getByRole('spinbutton', {
    name: 'section r min',
  });
  await expect(sectionRMinInput).toBeVisible();
  await sectionRMinInput.fill('0.088');
  await expect(sectionRMinInput).toHaveValue('0.088');
});

test('add-point preview appears on canvas hover and placement selects the waypoint', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'tool add point' }).click();
  await getCanvas(page).hover({ position: SINGLE_WAYPOINT });
  await expect(page.getByLabel('preview waypoint WP 1')).toBeVisible();

  await clickCanvas(page, SINGLE_WAYPOINT);

  await expectWaypointCount(page, 1);
  await expect(page.getByLabel('waypoint properties')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'tool select' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('undo/redo tracks domain changes only', async ({ page }) => {
  await page.goto('/');

  const undoButton = page.getByRole('button', { name: 'undo workspace' });
  const redoButton = page.getByRole('button', { name: 'redo workspace' });

  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await page.getByRole('button', { name: 'Heading', exact: true }).click();
  await expect(undoButton).toBeDisabled();

  await page.getByRole('button', { name: 'Path', exact: true }).click();
  await addWaypoint(page, SINGLE_WAYPOINT);

  await expectWaypointCount(page, 1);
  await expect(undoButton).toBeEnabled();

  await undoButton.click();
  await expectWaypointCount(page, 0);
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expectWaypointCount(page, 1);
});

test('clicking the canvas background clears the floating inspector', async ({
  page,
}) => {
  await page.goto('/');

  await addWaypoint(page, FIRST_PATH_WAYPOINT);
  await addWaypoint(page, SECOND_PATH_WAYPOINT);
  await page.getByRole('button', { name: 'tool select' }).click();

  await clickCanvas(page, FIRST_SECTION_MIDPOINT);
  await expect(page.getByLabel('floating inspector')).toBeVisible();

  await clickCanvas(page, EMPTY_CANVAS_SPOT);
  await expect(page.getByLabel('floating inspector')).not.toBeVisible();
});
