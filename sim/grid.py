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

    def __getitem__(self, pos):
        r, c = pos
        return self.grid[r][c]

    def __setitem__(self, pos, val):
        r, c = pos
        self.grid[r][c] = val

    def __iter__(self):
        for r in range(self.rows):
            for c in range(self.cols):
                yield self.grid[r][c]
