import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from '../../App';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  addPointWithHeadingDrag,
  canvasClick,
  canvasDoubleClick,
  getBackgroundImageDragStartPoint,
  getCanvas,
  getCanvasHost,
  getSectionScreenPoint,
  getSelectedSectionRMinHandleScreenPoint,
  getSelectedWaypointRobotHeadingHandleScreenPoint,
  getStageContent,
  setupIntegrationTestLifecycle,
} from './helpers';

setupIntegrationTestLifecycle();

describe('App canvas integration', () => {
  it('renders and drags background image with ROS x-up / y-left mapping', () => {
    render(<App />);

    act(() => {
      useWorkspaceStore.getState().setBackgroundImage({
        url: 'data:image/png;base64,dGVzdA==',
        width: 100,
        height: 50,
        x: 1,
        y: 2,
        scale: 1,
        alpha: 0.5,
      });
    });

    const canvas = getCanvas();
    const dragStart = getBackgroundImageDragStartPoint();
    expect(useWorkspaceStore.getState().ui.backgroundImage).not.toBeNull();
    expect(getCanvasHost().querySelectorAll('canvas').length).toBeGreaterThan(
      0,
    );

    const transformScale = useWorkspaceStore.getState().ui.canvasTransform.k;

    act(() => {
      useWorkspaceStore.getState().setTool('edit-image');
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: dragStart.x,
      clientY: dragStart.y,
      pointerId: 301,
    });
    fireEvent.pointerMove(canvas, {
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 301,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 301,
    });

    const updatedBackground = useWorkspaceStore.getState().ui.backgroundImage;
    expect(updatedBackground).not.toBeNull();
    expect(updatedBackground?.x).toBeCloseTo(1 + 20 / transformScale);
    expect(updatedBackground?.y).toBeCloseTo(2 - 40 / transformScale);
  });

  it.each(['pointercancel', 'pointerleave'] as const)(
    'safely stops background image drag on %s',
    (finishEvent) => {
      render(<App />);

      act(() => {
        useWorkspaceStore.getState().setBackgroundImage({
          url: 'data:image/png;base64,dGVzdA==',
          width: 100,
          height: 50,
          x: 1,
          y: 2,
          scale: 1,
          alpha: 0.5,
        });
      });

      const canvas = getCanvas();
      const stageContent = getStageContent();
      const dragStart = getBackgroundImageDragStartPoint();

      act(() => {
        useWorkspaceStore.getState().setTool('edit-image');
      });

      fireEvent.pointerDown(canvas, {
        button: 0,
        clientX: dragStart.x,
        clientY: dragStart.y,
        pointerId: 304,
      });
      fireEvent.pointerMove(canvas, {
        clientX: dragStart.x + 40,
        clientY: dragStart.y - 20,
        pointerId: 304,
      });

      const draggedBackground = useWorkspaceStore.getState().ui.backgroundImage;
      expect(draggedBackground).not.toBeNull();
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(true);

      if (finishEvent === 'pointercancel') {
        fireEvent.pointerCancel(stageContent, {
          clientX: dragStart.x + 40,
          clientY: dragStart.y - 20,
          pointerId: 304,
        });
      } else {
        fireEvent.pointerLeave(stageContent, {
          clientX: dragStart.x + 40,
          clientY: dragStart.y - 20,
          pointerId: 304,
        });
      }

      expect(useWorkspaceStore.getState().ui.isDragging).toBe(false);

      fireEvent.pointerMove(canvas, {
        clientX: dragStart.x + 80,
        clientY: dragStart.y - 60,
        pointerId: 304,
      });

      expect(useWorkspaceStore.getState().ui.backgroundImage?.x).toBeCloseTo(
        draggedBackground?.x ?? 0,
      );
      expect(useWorkspaceStore.getState().ui.backgroundImage?.y).toBeCloseTo(
        draggedBackground?.y ?? 0,
      );
    },
  );

  it('shows heading point inspector in heading mode and keeps robot heading editable', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 260, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const headingPoint = getSectionScreenPoint(0, 0.35);

    fireEvent.pointerDown(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 73,
    });
    fireEvent.pointerUp(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 73,
    });

    expect(
      screen.getByLabelText('heading point robot heading'),
    ).not.toBeDisabled();
    expect(screen.getByText('On Path')).toBeInTheDocument();
  });

  it('edits a heading point name from the heading point inspector', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 260, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const headingPoint = getSectionScreenPoint(0, 0.35);

    fireEvent.pointerDown(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 91,
    });
    fireEvent.pointerUp(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 91,
    });

    const headingLabelInput =
      await screen.findByLabelText('heading point name');
    fireEvent.change(headingLabelInput, { target: { value: 'Aim In' } });

    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().domain.paths[0]?.headingKeyframes[0]?.name,
      ).toBe('Aim In');
      expect(
        screen.getByRole('button', { name: 'Select heading keyframe Aim In' }),
      ).toBeInTheDocument();
    });
  });

  it('lets you grab the robot heading handle when the heading is auto', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 81,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 81,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const robotHeadingInput = screen.getByLabelText('waypoint robot heading');
    expect(robotHeadingInput.getAttribute('placeholder')).toMatch(/Auto/);

    const handlePoint = getSelectedWaypointRobotHeadingHandleScreenPoint();
    fireEvent.pointerDown(canvas, {
      clientX: handlePoint.x,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 82,
    });
    fireEvent.pointerMove(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      pointerId: 82,
    });
    fireEvent.pointerUp(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 82,
    });

    await waitFor(() => {
      const draggedHeading = Number(
        screen.getByLabelText<HTMLInputElement>('waypoint robot heading').value,
      );
      expect(Number.isFinite(draggedHeading)).toBe(true);
    });
    expect(
      screen.getByRole('button', { name: 'reset robot heading to auto' }),
    ).toBeInTheDocument();
  });

  it('resets a manual robot heading to auto on double click', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const handlePoint = getSelectedWaypointRobotHeadingHandleScreenPoint();
    fireEvent.pointerDown(canvas, {
      clientX: handlePoint.x,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 83,
    });
    fireEvent.pointerMove(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      pointerId: 83,
    });
    fireEvent.pointerUp(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 83,
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'reset robot heading to auto' }),
      ).toBeInTheDocument();
    });

    const updatedHandlePoint =
      getSelectedWaypointRobotHeadingHandleScreenPoint();
    canvasDoubleClick(canvas, updatedHandlePoint.x, updatedHandlePoint.y);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'reset robot heading to auto' }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('waypoint robot heading')).toHaveValue(null);
    });
  });

  it('adds heading points on the curved path geometry in heading mode', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    addPointWithHeadingDrag({
      canvas,
      startX: 240,
      startY: 170,
      endX: 320,
      endY: 170,
      pointerId: 71,
    });

    fireEvent.click(addPointTool);
    addPointWithHeadingDrag({
      canvas,
      startX: 360,
      startY: 240,
      endX: 360,
      endY: 180,
      pointerId: 72,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const curvedHeadingPoint = getSectionScreenPoint(0, 0.3);

    fireEvent.pointerDown(canvas, {
      clientX: curvedHeadingPoint.x,
      clientY: curvedHeadingPoint.y,
      button: 0,
      pointerId: 74,
    });
    fireEvent.pointerUp(canvas, {
      clientX: curvedHeadingPoint.x,
      clientY: curvedHeadingPoint.y,
      button: 0,
      pointerId: 74,
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText('heading point properties'),
      ).toBeInTheDocument();
    });

    const headingPoint =
      useWorkspaceStore.getState().domain.paths[0]?.headingKeyframes[0];
    expect(headingPoint).toBeDefined();
    expect(headingPoint?.sectionRatio).not.toBeCloseTo(0.5, 2);
  });

  it('shows section rMin controls when a section is selected', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);

    const selectTool = screen.getByRole('button', { name: 'tool select' });
    fireEvent.click(selectTool);

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });

    await waitFor(() => {
      const sectionInput = screen.getByLabelText('section r min');
      expect(sectionInput).toBeInTheDocument();
    });
    const sectionInput = screen.getByLabelText('section r min');
    fireEvent.change(sectionInput, { target: { value: '0.077' } });
    expect(sectionInput).toHaveValue(0.077);
  });

  it('updates section rMin by typing into the input field', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);

    const selectTool = screen.getByRole('button', { name: 'tool select' });
    fireEvent.click(selectTool);

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toBeInTheDocument();
    });

    const sectionInput = screen.getByLabelText('section r min');
    expect(sectionInput).toHaveValue(null);
    expect(sectionInput).toHaveAttribute('placeholder');

    fireEvent.change(sectionInput, { target: { value: '0.042' } });

    const refreshedSectionInput = screen.getByLabelText('section r min');
    expect(Number((refreshedSectionInput as HTMLInputElement).value)).toBe(
      0.042,
    );
  });

  it('resets a manual section rMin to auto on double click', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    addPointWithHeadingDrag({
      canvas,
      startX: 240,
      startY: 170,
      endX: 320,
      endY: 170,
      pointerId: 91,
    });

    fireEvent.click(addPointTool);
    addPointWithHeadingDrag({
      canvas,
      startX: 360,
      startY: 240,
      endX: 360,
      endY: 180,
      pointerId: 92,
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    const sectionPoint = getSectionScreenPoint(0, 0.45);
    canvasClick(canvas, sectionPoint.x, sectionPoint.y);

    const sectionInput = await screen.findByLabelText('section r min');
    fireEvent.change(sectionInput, { target: { value: '1.25' } });

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toHaveValue(1.25);
    });

    const handlePoint = getSelectedSectionRMinHandleScreenPoint();
    canvasDoubleClick(canvas, handlePoint.x, handlePoint.y);

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toHaveValue(null);
      expect(
        screen.getByLabelText('section r min').getAttribute('placeholder'),
      ).toMatch(/Auto/);
    });
  });

  it('clears the section inspector when clicking canvas background', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 41,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 41,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('floating inspector')).toBeInTheDocument();
    });

    canvasClick(canvas, 100, 100);

    await waitFor(() => {
      expect(
        screen.queryByLabelText('floating inspector'),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the section radius slider linear within the visible section scale', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 42,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 42,
    });

    const slider = await screen.findByLabelText('section r min slider');
    expect(slider).toHaveAttribute('step', '0.001');
    expect(Number((slider as HTMLInputElement).max)).toBeGreaterThan(1);
  });

  it('commits section slider drag as one undo step', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 43,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 43,
    });

    const slider = await screen.findByLabelText<HTMLInputElement>(
      'section r min slider',
    );
    const undoButton = screen.getByRole('button', { name: 'undo workspace' });
    const initialSliderValue = Number(slider.value);

    act(() => {
      useWorkspaceStore.getState().clear();
    });

    expect(undoButton).toBeDisabled();
    expect(slider.value).toBe(String(initialSliderValue));

    fireEvent.pointerDown(slider, { pointerId: 44, button: 0 });
    fireEvent.change(slider, { target: { value: '1.2' } });
    fireEvent.change(slider, { target: { value: '1.4' } });

    expect(slider.value).toBe('1.4');
    expect(undoButton).toBeDisabled();

    fireEvent.pointerUp(slider, { pointerId: 44, button: 0 });

    expect(undoButton).toBeEnabled();

    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLInputElement>('section r min slider').value,
      ).toBe(String(initialSliderValue));
    });

    expect(useWorkspaceStore.getState().canUndo()).toBe(false);
  });

  it('keeps section hit testing aligned with the visible curve after heading changes', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 55,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 55,
    });

    fireEvent.change(screen.getByLabelText('waypoint path heading'), {
      target: { value: '135' },
    });

    const sectionPoint = getSectionScreenPoint(0, 0.45);

    fireEvent.pointerDown(canvas, {
      clientX: sectionPoint.x,
      clientY: sectionPoint.y,
      button: 0,
      pointerId: 56,
    });
    fireEvent.pointerUp(canvas, {
      clientX: sectionPoint.x,
      clientY: sectionPoint.y,
      button: 0,
      pointerId: 56,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toBeInTheDocument();
    });
  });

  it('keeps auto-selected curved path stable when editing around a boundary-like fixture', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 290);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 360,
      clientY: 290,
      button: 0,
      pointerId: 61,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 360,
      clientY: 290,
      button: 0,
      pointerId: 61,
    });

    fireEvent.change(screen.getByLabelText('waypoint path heading'), {
      target: { value: '90' },
    });

    const curvedSectionPoint = getSectionScreenPoint(0, 0.45);

    fireEvent.pointerDown(canvas, {
      clientX: curvedSectionPoint.x,
      clientY: curvedSectionPoint.y,
      button: 0,
      pointerId: 62,
    });
    fireEvent.pointerUp(canvas, {
      clientX: curvedSectionPoint.x,
      clientY: curvedSectionPoint.y,
      button: 0,
      pointerId: 62,
    });

    const sectionInput = await screen.findByLabelText('section r min');
    expect(sectionInput).toBeInTheDocument();
    expect(sectionInput).toHaveAttribute('placeholder');
  });

  it('previews add point on hover and drags path heading immediately after placement', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    fireEvent.pointerMove(canvas, {
      clientX: 300,
      clientY: 250,
      pointerId: 61,
    });

    expect(screen.getByLabelText('preview waypoint WP 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'tool add point' }),
    ).toHaveAttribute('aria-pressed', 'true');

    addPointWithHeadingDrag({
      canvas,
      startX: 300,
      startY: 250,
      endX: 360,
      endY: 250,
      pointerId: 62,
    });

    expect(
      screen.queryByLabelText('preview waypoint WP 1'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('waypoint path heading')).toHaveValue(270);
    expect(screen.getByRole('button', { name: 'tool select' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
