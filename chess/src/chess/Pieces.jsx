

export class Piece {
  constructor(color) {
    this.team = color;
    this.coord = null;
    this.hasMoved = false;
  }

  setcoord(coord) {
    this.coord = coord;
  }
}

export class Rook extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;

    
    for (let r = row + 1; r <= 7; r++) {
      if (!board[r][col]) result.push([r, col]);
      else {
        if (board[r][col].team !== this.team) result.push([r, col]);
        break;
      }
    }


    for (let r = row - 1; r >= 0; r--) {
      if (!board[r][col]) result.push([r, col]);
      else {
        if (board[r][col].team !== this.team) result.push([r, col]);
        break;
      }
    }


    for (let c = col - 1; c >= 0; c--) {
      if (!board[row][c]) result.push([row, c]);
      else {
        if (board[row][c].team !== this.team) result.push([row, c]);
        break;
      }
    }

  
    for (let c = col + 1; c <= 7; c++) {
      if (!board[row][c]) result.push([row, c]);
      else {
        if (board[row][c].team !== this.team) result.push([row, c]);
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

   
    for (let i = 1; i <= 7; i++) {
      if (row + i > 7 || col + i > 7) break;
      if (!board[row + i][col + i]) result.push([row + i, col + i]);
      else {
        if (board[row + i][col + i].team !== this.team) result.push([row + i, col + i]);
        break;
      }
    }

    for (let i = 1; i <= 7; i++) {
      if (row - i < 0 || col + i > 7) break;
      if (!board[row - i][col + i]) result.push([row - i, col + i]);
      else {
        if (board[row - i][col + i].team !== this.team) result.push([row - i, col + i]);
        break;
      }
    }

    for (let i = 1; i <= 7; i++) {
      if (row + i > 7 || col - i < 0) break;
      if (!board[row + i][col - i]) result.push([row + i, col - i]);
      else {
        if (board[row + i][col - i].team !== this.team) result.push([row + i, col - i]);
        break;
      }
    }

    for (let i = 1; i <= 7; i++) {
      if (row - i < 0 || col - i < 0) break;
      if (!board[row - i][col - i]) result.push([row - i, col - i]);
      else {
        if (board[row - i][col - i].team !== this.team) result.push([row - i, col - i]);
        break;
      }
    }

    return result;
  }
}

export class Queen extends Piece {
  moveset(board) {
    const rookMoves = new Rook(this.team);
    const bishopMoves = new Bishop(this.team);
    rookMoves.coord = this.coord;
    bishopMoves.coord = this.coord;

    return [...rookMoves.moveset(board), ...bishopMoves.moveset(board)];
  }
}

export class Knight extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;
    const offsets = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2]
    ];

    for (let [dr, dc] of offsets) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        if (!board[r][c] || board[r][c].team !== this.team) {
          result.push([r, c]);
        }
      }
    }

    return result;
  }
}

export class King extends Piece {
  moveset(board) {
    const result = [];
    const [row, col] = this.coord;
    const directions = [
      [1, 0], [-1, 0],
      [0, 1], [0, -1],
      [1, 1], [-1, -1],
      [1, -1], [-1, 1]
    ];

    for (let [dr, dc] of directions) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        if (!board[r][c] || board[r][c].team !== this.team) {
          result.push([r, c]);
        }
      }
    }

    
    if (!this.hasMoved) {
      
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
    this.justMovedTwo = false; 
  }

  moveset(board) {
    const result = [];
    const [row, col] = this.coord;
    const direction = this.team === 'white' ? -1 : 1;
    const startRow = this.team === 'white' ? 6 : 1;
    const lastRow = this.team === 'white' ? 0 : 7;

    const oneStep = row + direction;
    const twoStep = row + direction * 2;

 
    if (board[oneStep]?.[col] == null) {
      result.push([oneStep, col]);

     
      if (row === startRow && board[twoStep][col] == null) {
        result.push([twoStep, col]);
      }
    }

    
    for (let dc of [-1, 1]) {
      const c = col + dc;
      if (c >= 0 && c <= 7 && oneStep >= 0 && oneStep <= 7) {
        const target = board[oneStep][c];

       
        if (target && target.team !== this.team) {
          result.push([oneStep, c]);
        }

        
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
    }

    return result;
  }
}

