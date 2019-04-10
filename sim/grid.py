import math
from itertools import chain

oddAdjacentPositions = [
  (-1,  0), # upper left
  (-1,  1), # upper right
  ( 0, -1), # left
  ( 0,  1), # right
  ( 1,  0), # bottom left
  ( 1,  1)  # bottom right
]

evenAdjacentPositions = [
  (-1, -1), # upper left
  (-1,  0), # upper right
  ( 0, -1), # left
  ( 0,  1), # right
  ( 1, -1), # bottom left
  ( 1,  0)  # bottom right
]

class HexGrid:
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols

        # Initialize grid structure
        self.grid = []
        for r in range(self.rows):
            row = [None for c in range(self.cols)]
            self.grid.append(row)

    def adjacent(self, pos):
        """Positions adjacent to specified position"""
        row, col = pos
        shifts = evenAdjacentPositions if row % 2 == 0 else oddAdjacentPositions
        adjs = [(row+r, col+c) for r, c in shifts]
        return [(r, c) for r, c in adjs if r >=0 and r < self.rows and c >= 0 and c < self.cols]

    def radius(self, pos, r):
        """Positions within a radius of the specified position"""
        rad = set()
        next = [pos]
        for _ in range(r):
            adj = set(chain.from_iterable(self.adjacent(p) for p in next))
            rad.update(adj)
            next = adj
        return list(rad)

    def __getitem__(self, pos):
        """Return data at position"""
        r, c = pos
        return self.grid[r][c]

    def __setitem__(self, pos, val):
        """Set data at position"""
        r, c = pos
        self.grid[r][c] = val

    def __iter__(self):
        """Iterate over rows"""
        for r in range(self.rows):
            yield self.grid[r]

    @property
    def cells(self):
        """Iterate over cells"""
        for r in range(self.rows):
            for c in range(self.cols):
                yield self.grid[r][c]

    def path(self, start, end, valid_pos=lambda pos: True):
        """Find path from start to end position.
        Optionally specify a predicate determining
        if a position is a valid successor"""
        seen = set()
        fringe = [[start]]
        while fringe:
            path = fringe.pop(0)
            pos = path[-1]

            if pos == end:
                break

            # Don't revisit nodes
            if pos in seen: continue
            seen.add(pos)

            successors = filter(valid_pos, self.adjacent(pos))
            fringe = [path + [succ] for succ in successors] + fringe
            fringe = sorted(fringe, key=lambda path: len(path))
        return path

    def distance(self, a, b):
        """2D euclidean distance"""
        return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)
