import { buildSegmentMotionProfile } from '../../domain/pathTimingMotion';

describe('pathTimingMotion', () => {
  it('builds a trapezoidal profile with non-zero start and end velocities', () => {
    const profile = buildSegmentMotionProfile(10, 1, 0.5, 3, {
      acceleration: 1,
      deceleration: 1,
    });

    expect(profile.kind).toBe('bounded');
    expect(profile.startVelocity).toBeCloseTo(1, 9);
    expect(profile.endVelocity).toBeCloseTo(0.5, 9);
    expect(profile.peakVelocity).toBeCloseTo(3, 9);
    expect(profile.accelerationDistance).toBeCloseTo(4, 9);
    expect(profile.cruiseDistance).toBeCloseTo(1.625, 9);
    expect(profile.decelerationDistance).toBeCloseTo(4.375, 9);
    expect(profile.accelerationDuration).toBeCloseTo(2, 9);
    expect(profile.cruiseDuration).toBeCloseTo(1.625 / 3, 9);
    expect(profile.decelerationDuration).toBeCloseTo(2.5, 9);
  });

  it('builds a triangular profile with non-zero start and end velocities on short distances', () => {
    const profile = buildSegmentMotionProfile(3, 1, 0.5, 3, {
      acceleration: 1,
      deceleration: 1,
    });

    expect(profile.kind).toBe('bounded');
    expect(profile.startVelocity).toBeCloseTo(1, 9);
    expect(profile.endVelocity).toBeCloseTo(0.5, 9);
    expect(profile.peakVelocity).toBeCloseTo(Math.sqrt(3.625), 9);
    expect(profile.peakVelocity).toBeLessThan(profile.speedLimit);
    expect(profile.cruiseDistance).toBeCloseTo(0, 9);
    expect(
      profile.accelerationDistance + profile.decelerationDistance,
    ).toBeCloseTo(3, 9);
    expect(profile.accelerationDuration).toBeGreaterThan(0);
    expect(profile.decelerationDuration).toBeGreaterThan(0);
  });
});
