import { describe, expect, it } from 'vitest';
import type { PathModel } from '../../domain/models';
import { sortPathsByDisplayName } from '../../features/sidebar/sidebarPathList';

const makePath = (id: string, name: string): PathModel => ({
  id,
  name,
  color: '#ff0000',
  visible: true,
  waypoints: [],
  headingKeyframes: [],
  sectionRMin: [],
});

describe('sortPathsByDisplayName', () => {
  it('orders paths alphabetically without mutating the source list', () => {
    const paths = [
      makePath('p2', 'Path B'),
      makePath('p1', 'Path A'),
      makePath('p3', 'Path C'),
    ];

    const sortedPaths = sortPathsByDisplayName(paths);

    expect(sortedPaths.map((path) => path.name)).toEqual([
      'Path A',
      'Path B',
      'Path C',
    ]);
    expect(paths.map((path) => path.name)).toEqual([
      'Path B',
      'Path A',
      'Path C',
    ]);
  });

  it('orders paths by gojuon', () => {
    const sortedPaths = sortPathsByDisplayName([
      makePath('p2', 'さくら'),
      makePath('p1', 'あお'),
      makePath('p3', 'たんぽぽ'),
    ]);

    expect(sortedPaths.map((path) => path.name)).toEqual([
      'あお',
      'さくら',
      'たんぽぽ',
    ]);
  });
});
