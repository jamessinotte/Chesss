import React, { Component } from 'react';
import { Rook, Bishop, Queen, King, Knight, Pawn } from './Pieces.jsx';
import styles from '../build/Board.module.css';
import moveSoundFile from './assets/move-self.mp3';
import captureSoundFile from './assets/capture.mp3';

class Square {
  constructor(piece = null) {
    this.piece = piece;        // piece on this square (or null)
    this.highlight = null;     // used for showing legal moves
  }
}

export default class Board extends Component {
  constructor(props) {
    super(props);
    this.state = {
      turn: 'white',                 // whose turn it is
      selected: null,                // currently selected square [row, col]
      map: this.createEmptyBoard(),  // UI board (Squares)
      logicMap: this.createEmptyLogicMap(), // raw piece board for move logic
      moveset: {},                   // legal moves for selected piece (keyed by "r,c")
      captured: { white: [], black: [] }, // captured pieces by team
      check: false,                  // whether the current side is in check
      pendingPromotion: null,        // used for pawn promotion UI
    };

    // sounds for move/capture feedback
    this.moveSound = new Audio(moveSoundFile);
    this.captureSound = new Audio(captureSoundFile);
  }

  componentDidMount() {
    this.setupPieces(); // place all pieces at start
  }

  componentDidUpdate(prevProps) {
    // If parent changed the step (undo/rewind), rebuild the board to that point
    if (this.props.enableUndo && prevProps.step !== this.props.step) {
      this.replayMoves(this.props.step);
    }
  }

  // orientation controls whether the board is flipped for black
  getOrientation = () =>
    (this.props.orientation || this.props.playerColor || 'white') === 'black' ? 'black' : 'white';

  // Convert clicked screen coords -> internal board coords
  viewToModel = (r, c) =>
    this.getOrientation() === 'white' ? [r, c] : [7 - r, 7 - c];

  // Convert internal board coords -> screen coords
  modelToView = (r, c) =>
    this.getOrientation() === 'white' ? [r, c] : [7 - r, 7 - c];

  // Build an 8x8 board of Square objects (UI version)
  createEmptyBoard() {
    return Array(8)
      .fill(null)
      .map(() => Array(8).fill(null).map(() => new Square()));
  }

  // Build an 8x8 board of just pieces/null (logic version)
  createEmptyLogicMap() {
    return Array(8)
      .fill(null)
      .map(() => Array(8).fill(null));
  }

  setupPieces() {
    const map = this.createEmptyBoard();
    const logicMap = this.createEmptyLogicMap();
    this.setupPiecesOnMap(map, logicMap);
    this.setState({ map, logicMap });
  }

  setupPiecesOnMap(map, logicMap) {
    // helper for placing a piece in both maps
    const place = (row, col, piece) => {
      piece.coord = [row, col];
      map[row][col] = new Square(piece);
      logicMap[row][col] = piece;
    };

    // white pieces
    place(7, 0, new Rook('white'));
    place(7, 1, new Knight('white'));
    place(7, 2, new Bishop('white'));
    place(7, 3, new Queen('white'));
    place(7, 4, new King('white'));
    place(7, 5, new Bishop('white'));
    place(7, 6, new Knight('white'));
    place(7, 7, new Rook('white'));
    for (let i = 0; i < 8; i++) place(6, i, new Pawn('white'));

    // black pieces
    place(0, 0, new Rook('black'));
    place(0, 1, new Knight('black'));
    place(0, 2, new Bishop('black'));
    place(0, 3, new Queen('black'));
    place(0, 4, new King('black'));
    place(0, 5, new Bishop('black'));
    place(0, 6, new Knight('black'));
    place(0, 7, new Rook('black'));
    for (let i = 0; i < 8; i++) place(1, i, new Pawn('black'));
  }

  replayMoves(step) {
    // reset the board to starting position first
    const map = this.createEmptyBoard();
    const logicMap = this.createEmptyLogicMap();
    this.setupPiecesOnMap(map, logicMap);

    // apply moves up to "step"
    for (let i = 0; i < step; i++) {
      const move = this.props.history[i];
      const [fr, fc] = this.fromChessNotation(move.from);
      const [tr, tc] = this.fromChessNotation(move.to);

      // rebuild the moving piece from saved move info
      const PieceClass = { Pawn, Rook, Knight, Bishop, Queen, King }[move.piece];
      const movingPiece = new PieceClass(move.team);
      movingPiece.coord = [tr, tc];

      map[tr][tc] = new Square(movingPiece);
      logicMap[tr][tc] = movingPiece;

      map[fr][fc] = new Square(null);
      logicMap[fr][fc] = null;
    }

    // step parity tells whose turn it is
    this.setState({
      map,
      logicMap,
      turn: step % 2 === 0 ? 'white' : 'black',
    });
  }

  // clicks
  handleSquareClick = (viewRow, viewCol) => {
    // Only allow clicks when it's the human player's turn
    const human = this.props.playerColor || 'white';
    if (this.state.turn !== human) return;

    const arr = this.viewToModel(viewRow, viewCol);
    const row = arr[0];
    const col = arr[1];

    const clickedSquare = this.state.map[row][col];
    const clickedPiece = clickedSquare ? clickedSquare.piece : null;

    const key = row + ',' + col;

    // If a piece is selected and this square is legal, move there
    if (this.state.selected && this.state.moveset && this.state.moveset[key]) {
      this.makeMove(this.state.selected, [row, col]);
      this.clearSelection();
      return;
    }

    // Select your own piece to see legal moves
    if (clickedPiece && clickedPiece.team === this.state.turn) {
      this.selectPiece(row, col, clickedPiece);
      return;
    }

    // Clicking empty / enemy square clears selection
    this.clearSelection();
  };

  makeOpponentMove(move) {
    // Used by AI and multiplayer to apply a move directly
    const start = this.fromChessNotation(move.from);
    const end = this.fromChessNotation(move.to);
    this.makeMove([start[0], start[1]], [end[0], end[1]]);
  }

  selectPiece(row, col, piece) {
    // Start with raw moves from the piece rules
    const rawMoves = piece.moveset(this.state.logicMap);
    const legalMoves = {};
    const startRow = piece.coord[0];
    const startCol = piece.coord[1];

    // Filter out moves that would leave your king in check
    for (let i = 0; i < rawMoves.length; i++) {
      const r = rawMoves[i][0];
      const c = rawMoves[i][1];

      const testBoard = this.state.logicMap.map((row) => row.slice());
      testBoard[r][c] = piece;
      testBoard[startRow][startCol] = null;

      if (!this.isInCheck(piece.team, testBoard)) {
        legalMoves[r + ',' + c] = 'move';
      }
    }

    this.setState(
      { selected: [row, col], moveset: legalMoves },
      () => this.highlightSquares(legalMoves)
    );
  }

  clearSelection() {
    // clears selected square + highlighted moves
    this.setState({ selected: null, moveset: {} }, this.clearHighlights);
  }

  // Convert internal coords to something like "E2"
  toChessNotation(row, col) {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return files[col] + (8 - row);
  }

  // Convert "E2" back into [row, col]
  fromChessNotation(notation) {
    const files = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };
    const col = files[notation[0]];
    const row = 8 - parseInt(notation[1], 10);
    return [row, col];
  }

  makeMove(start, end) {
    const startRow = start[0];
    const startCol = start[1];
    const endRow = end[0];
    const endCol = end[1];

    const piece = this.state.map[startRow][startCol]
      ? this.state.map[startRow][startCol].piece
      : null;

    const target = this.state.map[endRow][endCol]
      ? this.state.map[endRow][endCol].piece
      : null;

    if (!piece) return;

    // clone boards so we can update without mutating old state
    const newMap = this.state.map.map((row) =>
      row.map((sq) => new Square(sq.piece))
    );
    const newLogicMap = this.state.logicMap.map((row) => row.slice());

    // en passant capture
    if (piece.constructor.name === 'Pawn' && startCol !== endCol && target == null) {
      const capturedPawn = this.state.logicMap[startRow][endCol];
      if (
        capturedPawn &&
        capturedPawn.constructor.name === 'Pawn' &&
        capturedPawn.team !== piece.team &&
        capturedPawn.justMovedTwo
      ) {
        newMap[startRow][endCol].piece = null;
        newLogicMap[startRow][endCol] = null;

        const captured = { ...this.state.captured };
        captured[capturedPawn.team].push(capturedPawn);
        this.setState({ captured });

        this.captureSound.play().catch(() => {});
      }
    }

    // normal capture vs normal move (sound + captured list)
    if (target && target.team !== piece.team) {
      const captured = { ...this.state.captured };
      captured[target.team].push(target);
      this.setState({ captured });
      this.captureSound.play().catch(() => {});
    } else {
      this.moveSound.play().catch(() => {});
    }

    // move the piece on both maps
    newMap[endRow][endCol].piece = piece;
    newMap[startRow][startCol].piece = null;
    newLogicMap[endRow][endCol] = piece;
    newLogicMap[startRow][startCol] = null;

    // update piece state
    piece.coord = [endRow, endCol];
    piece.hasMoved = true;
    if (piece.constructor.name === 'Pawn') {
      piece.justMovedTwo = Math.abs(endRow - startRow) === 2;
    }

    const nextTurn = this.state.turn === 'white' ? 'black' : 'white';

    this.setState(
      {
        map: newMap,
        logicMap: newLogicMap,
        turn: nextTurn,
        selected: null,
        moveset: {},
        check: this.isInCheck(nextTurn, newLogicMap),
      },
      () => {
        // tell parent about the move (for history/AI/multiplayer)
        if (this.props.onMoveMade) {
          this.props.onMoveMade({
            team: piece.team,
            piece: piece.constructor.name,
            from: this.toChessNotation(startRow, startCol),
            to: this.toChessNotation(endRow, endCol),
            captured: target ? target.constructor.name : null,
          });
        }

        // check for checkmate/stalemate
        const noMoves = !this.hasAnyLegalMove(nextTurn, newLogicMap);
        if (noMoves) {
          const inCheck = this.isInCheck(nextTurn, newLogicMap);
          if (inCheck) {
            const winner = piece.team;
            if (this.props.onGameEnd) this.props.onGameEnd(winner, 'checkmate');
          } else {
            if (this.props.onGameEnd) this.props.onGameEnd(null, 'stalemate');
          }
        }

        if (this.props.onTurnChange) this.props.onTurnChange(nextTurn);
      }
    );
  }

  // find the king so we can test check
  findKingPosition(team, board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.constructor.name === 'King' && p.team === team) {
          return [r, c];
        }
      }
    }
    return null;
  }

  // check = any enemy move can hit the king square
  isInCheck(team, board) {
    const opp = team === 'white' ? 'black' : 'white';
    const kingPos = this.findKingPosition(team, board);
    if (!kingPos) return false;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.team === opp) {
          const moves = p.moveset(board);
          for (let i = 0; i < moves.length; i++) {
            const mr = moves[i][0];
            const mc = moves[i][1];
            if (mr === kingPos[0] && mc === kingPos[1]) return true;
          }
        }
      }
    }
    return false;
  }

  // used to detect mate/stalemate
  hasAnyLegalMove(team, board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.team !== team) continue;

        const moves = p.moveset(board);
        for (let i = 0; i < moves.length; i++) {
          const tr = moves[i][0];
          const tc = moves[i][1];

          const test = board.map((row) => row.slice());
          test[tr][tc] = p;
          test[r][c] = null;

          if (!this.isInCheck(team, test)) return true;
        }
      }
    }
    return false;
  }

  // highlights legal move squares for the selected piece
  highlightSquares(moveset) {
    const newMap = this.state.map.map((row, r) =>
      row.map((sq, c) => {
        const ns = new Square(sq.piece);
        const key = r + ',' + c;
        ns.highlight = moveset[key] || null;
        return ns;
      })
    );
    this.setState({ map: newMap });
  }

  clearHighlights() {
    const cleared = this.state.map.map((row) =>
      row.map((sq) => {
        const ns = new Square(sq.piece);
        ns.highlight = null;
        return ns;
      })
    );
    this.setState({ map: cleared });
  }

  renderSquare(modelRow, modelCol) {
    // convert model coords -> view coords for stable React keys
    const pos = this.modelToView(modelRow, modelCol);
    const viewRow = pos[0];
    const viewCol = pos[1];

    const square = this.state.map[modelRow][modelCol];
    const isDark = (modelRow + modelCol) % 2 === 1;

    // build class list based on square state
    let classes = styles.square + ' ';
    if (isDark) classes += styles.dark + ' ';
    else classes += styles.light + ' ';

    if (square.highlight === 'move') classes += styles.highlight + ' ';
    if (
      this.state.selected &&
      this.state.selected[0] === modelRow &&
      this.state.selected[1] === modelCol
    ) {
      classes += styles.selected;
    }

    // unicode pieces for display
    const symbols = {
      Pawn: { white: '♙', black: '♟' },
      Rook: { white: '♖', black: '♜' },
      Knight: { white: '♘', black: '♞' },
      Bishop: { white: '♗', black: '♝' },
      Queen: { white: '♕', black: '♛' },
      King: { white: '♔', black: '♚' },
    };

    let display = '';
    let pieceClass = styles.piece;

    if (square.piece) {
      const team = square.piece.team;
      display = symbols[square.piece.constructor.name][team];
      pieceClass += ' ' + (team === 'white' ? styles.whitePiece : styles.blackPiece);
    }

    return (
      <div
        key={viewRow + '-' + viewCol}
        className={classes}
        onClick={() => this.handleSquareClick(viewRow, viewCol)}
      >
        <span className={pieceClass} aria-hidden="true">{display}</span>
      </div>
    );
  }

  renderMoveHistory() {
    return (
      <div className={styles.moveHistory}>
        <h3>Move History</h3>

        {/* clicking a move jumps the board back to that step */}
        {this.props.history.map((move, index) => (
          <div
            key={index}
            className={index + 1 === this.props.step ? styles.activeMove : ''}
            onClick={() => this.props.onStepChange?.(index + 1)}
          >
            {index + 1}. {move.team} {move.piece}: {move.from} → {move.to}
          </div>
        ))}
      </div>
    );
  }

  renderCaptured() {
    const symbols = {
      Pawn: { white: '♙', black: '♟' },
      Rook: { white: '♖', black: '♜' },
      Knight: { white: '♘', black: '♞' },
      Bishop: { white: '♗', black: '♝' },
      Queen: { white: '♕', black: '♛' },
      King: { white: '♔', black: '♚' },
    };

    return (
      <div className={styles.capturedSection}>
        <div>
          <strong>White captured:</strong>
          {/* pieces black lost */}
          {this.state.captured.black.map((p, i) => (
            <span key={i} className={styles.whitePiece}>
              {symbols[p.constructor.name].black}
            </span>
          ))}
        </div>

        <div>
          <strong>Black captured:</strong>
          {/* pieces white lost */}
          {this.state.captured.white.map((p, i) => (
            <span key={i} className={styles.blackPiece}>
              {symbols[p.constructor.name].white}
            </span>
          ))}
        </div>
      </div>
    );
  }

  render() {
    const squares = [];

    // build 64 squares based on view coords, then convert to model coords
    for (let vr = 0; vr < 8; vr++) {
      for (let vc = 0; vc < 8; vc++) {
        const model = this.viewToModel(vr, vc);
        squares.push(this.renderSquare(model[0], model[1]));
      }
    }

    const human = this.props.playerColor || 'white';
    const yourTurn = this.state.turn === human;

    return (
      <div className={styles.chessContainer}>
        <div>
          <div className={styles.turnIndicator}>
            <span style={{ marginRight: 8 }}>
              Turn: <strong>{this.state.turn}</strong>
            </span>

            {/* quick indicator for when you can move */}
            <span
              style={{
                padding: '2px 8px',
                marginLeft: 8,
                borderRadius: 999,
                fontWeight: 700,
                background: yourTurn ? '#163d1a' : '#3a2439',
                color: yourTurn ? '#9ff3ab' : '#f0c9ff',
              }}
            >
              {yourTurn ? 'Your move' : "Opponent's move"}
            </span>
          </div>

          <div className={styles.board}>{squares}</div>

          {/* pawn promotion popup */}
          {this.state.pendingPromotion && (
            <div className={styles.promotionDialog}>
              <div>Promote to:</div>
              {['Queen', 'Rook', 'Bishop', 'Knight'].map((type) => (
                <button key={type} onClick={() => this.handlePromotionChoice(type)}>
                  {type}
                </button>
              ))}
            </div>
          )}

          {this.renderCaptured()}
        </div>

        {this.renderMoveHistory()}
      </div>
    );
  }
}
