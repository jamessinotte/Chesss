export class Piece {
  constructor(color) {
    this.team = color;     // "white" or "black"
    this.coord = null;     // current [row, col]
    this.hasMoved = false; // used for castling + pawn first move
  }

  setcoord(coord) {
    this.coord = coord; // update piece position
  }
}

export class Rook extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;

    // move down
    for (let r = row + 1; r <= 7; r++) {
      const spot = board[r][col];
      if (!spot) {
        result.push([r, col]); // empty square
      } else {
        if (spot.team !== this.team) result.push([r, col]); // capture
        break; // rook can't go past pieces
      }
    }

    // move up
    for (let r = row - 1; r >= 0; r--) {
      const spot = board[r][col];
      if (!spot) {
        result.push([r, col]);
      } else {
        if (spot.team !== this.team) result.push([r, col]);
        break;
      }
    }

    // move left
    for (let c = col - 1; c >= 0; c--) {
      const spot = board[row][c];
      if (!spot) {
        result.push([row, c]);
      } else {
        if (spot.team !== this.team) result.push([row, c]);
        break;
      }
    }

    // move right
    for (let c = col + 1; c <= 7; c++) {
      const spot = board[row][c];
      if (!spot) {
        result.push([row, c]);
      } else {
        if (spot.team !== this.team) result.push([row, c]);
        break;
      }
    }

    return result;
  }
}

export class Bishop extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;

    // down-right diagonal
    for (let i = 1; i <= 7; i++) {
      const r = row + i;
      const c = col + i;
      if (r > 7 || c > 7) break;

      const spot = board[r][c];
      if (!spot) {
        result.push([r, c]);
      } else {
        if (spot.team !== this.team) result.push([r, c]);
        break;
      }
    }

    // up-right diagonal
    for (let i = 1; i <= 7; i++) {
      const r = row - i;
      const c = col + i;
      if (r < 0 || c > 7) break;

      const spot = board[r][c];
      if (!spot) {
        result.push([r, c]);
      } else {
        if (spot.team !== this.team) result.push([r, c]);
        break;
      }
    }

    // down-left diagonal
    for (let i = 1; i <= 7; i++) {
      const r = row + i;
      const c = col - i;
      if (r > 7 || c < 0) break;

      const spot = board[r][c];
      if (!spot) {
        result.push([r, c]);
      } else {
        if (spot.team !== this.team) result.push([r, c]);
        break;
      }
    }

    // up-left diagonal
    for (let i = 1; i <= 7; i++) {
      const r = row - i;
      const c = col - i;
      if (r < 0 || c < 0) break;

      const spot = board[r][c];
      if (!spot) {
        result.push([r, c]);
      } else {
        if (spot.team !== this.team) result.push([r, c]);
        break;
      }
    }

    return result;
  }
}

export class Queen extends Piece {
  moveset(board) {
    // queen = rook moves + bishop moves
    const rookMoves = new Rook(this.team);
    const bishopMoves = new Bishop(this.team);

    // reuse the same coord for both
    rookMoves.coord = this.coord;
    bishopMoves.coord = this.coord;

    const a = rookMoves.moveset(board);
    const b = bishopMoves.moveset(board);

    return a.concat(b);
  }
}

export class Knight extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;

    // all L-shaped moves
    const offsets = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2]
    ];

    for (let i = 0; i < offsets.length; i++) {
      const dr = offsets[i][0];
      const dc = offsets[i][1];

      const r = row + dr;
      const c = col + dc;

      // stay inside the board
      if (r < 0 || r > 7 || c < 0 || c > 7) continue;

      const spot = board[r][c];
      // can move if empty or enemy piece
      if (!spot || spot.team !== this.team) {
        result.push([r, c]);
      }
    }

    return result;
  }
}

export class King extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;

    // king moves one square in any direction
    const directions = [
      [1, 0], [-1, 0],
      [0, 1], [0, -1],
      [1, 1], [-1, -1],
      [1, -1], [-1, 1]
    ];

    for (let i = 0; i < directions.length; i++) {
      const dr = directions[i][0];
      const dc = directions[i][1];

      const r = row + dr;
      const c = col + dc;

      if (r < 0 || r > 7 || c < 0 || c > 7) continue;

      const spot = board[r][c];
      if (!spot || spot.team !== this.team) {
        result.push([r, c]);
      }
    }

    // castling checks (doesn't check for check here, just board/hasMoved)
    if (!this.hasMoved) {
      // king-side castle
      const rook = board[row][7];
      if (
        rook &&
        rook.constructor.name === 'Rook' &&
        rook.team === this.team &&
        !rook.hasMoved &&
        !board[row][5] &&
        !board[row][6]
      ) {
        result.push([row, 6]);
      }

      // queen-side castle
      const qRook = board[row][0];
      if (
        qRook &&
        qRook.constructor.name === 'Rook' &&
        qRook.team === this.team &&
        !qRook.hasMoved &&
        !board[row][1] &&
        !board[row][2] &&
        !board[row][3]
      ) {
        result.push([row, 2]);
      }
    }

    return result;
  }
}

export class Pawn extends Piece {
  constructor(color) {
    super(color);
    this.justMovedTwo = false; // used for en passant
  }

  moveset(board) {
    const result = [];
    const [row, col] = this.coord;

    // white goes up (-1), black goes down (+1)
    const direction = this.team === 'white' ? -1 : 1;
    const startRow = this.team === 'white' ? 6 : 1;

    const oneStep = row + direction;
    const twoStep = row + direction * 2;

    // forward move (only if empty)
    if (board[oneStep]?.[col] == null) {
      result.push([oneStep, col]);

      // first move can be 2 squares if both are empty
      if (row === startRow && board[twoStep]?.[col] == null) {
        result.push([twoStep, col]);
      }
    }

    // diagonal captures (and en passant)
    for (let dc of [-1, 1]) {
      const c = col + dc;

      if (c < 0 || c > 7) continue;
      if (oneStep < 0 || oneStep > 7) continue;

      const target = board[oneStep][c];

      // normal capture
      if (target && target.team !== this.team) {
        result.push([oneStep, c]);
      }

      // en passant: capture pawn that just moved two
      const sidePiece = board[row][c];
      if (
        sidePiece &&
        sidePiece.constructor.name === 'Pawn' &&
        sidePiece.team !== this.team &&
        sidePiece.justMovedTwo
      ) {
        result.push([oneStep, c]);
      }
    }

    return result;
  }
}
