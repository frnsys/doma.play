import math

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

def distance(a, b):
    """2D euclidean distance"""
    return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

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

    def __getitem__(self, pos):
        r, c = pos
        return self.grid[r][c]

    def __setitem__(self, pos, val):
        r, c = pos
        self.grid[r][c] = val

    def __iter__(self):
        for r in range(self.rows):
            yield self.grid[r]

    @property
    def cells(self):
        for r in range(self.rows):
            for c in range(self.cols):
                yield self.grid[r][c]

    def path(self, start, end, valid_pos=lambda pos: True):
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
