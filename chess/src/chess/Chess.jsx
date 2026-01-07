import React, { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

import Board from './Board.jsx';
import AIEngine from '../ai/AIEngine.js';
import styles from '../build/Chess.module.css';
import { WS_URL } from '../lib/api';

const DEFAULT_TIME = 300; // 5 minutes in seconds
const opp = (c) => (c === 'white' ? 'black' : 'white'); // helper to swap colors

class Chess extends Component {
  constructor(props) {
    super(props);

    // If coming from multiplayer, the match info is stored here temporarily
    const storedMatch = JSON.parse(sessionStorage.getItem('friendMatch') || 'null');
    const state = storedMatch || props.location?.state || {};

    let playerColor = state.playerColor || null;
    let aiPlayerColor = state.aiPlayerColor || null;
    const mode = state.mode || 'single';

    // Figure out colors based on mode + what the route passed in
    if (mode === 'single') {
      if (playerColor) aiPlayerColor = opp(playerColor);
      else if (aiPlayerColor) playerColor = opp(aiPlayerColor);
      else {
        playerColor = 'white';
        aiPlayerColor = 'black';
      }
    } else {
      // Multiplayer colors get assigned by the server later (default values for now)
      playerColor = 'white';
      aiPlayerColor = 'black';
    }

    this.state = {
      gameId: Date.now(),          // forces Board to reset when it changes
      mode,                        // single / classical / blitz / bullet
      aiDifficulty: state.aiDifficulty || 10,
      playerColor,                 // the human player's color
      aiPlayerColor,               // AI or opponent color
      timeLimit: DEFAULT_TIME,
      whiteTime: DEFAULT_TIME,
      blackTime: DEFAULT_TIME,
      winner: null,
      turn: 'white',
      enableUndo: true,

      history: [],                 // list of moves made so far
      step: 0,                     // current move index for undo/rewind

      isMultiplayer: false,
      socket: null,
      opponent: null,
      roomId: state.roomId || '',
    };

    this.timer = null;            // interval for the clock
    this.ai = new AIEngine();     // local AI engine
  }

  componentDidMount() {
    this.startTimer();

    // If we were redirected from friend match, join that room
    const storedMatch = JSON.parse(sessionStorage.getItem('friendMatch') || 'null');
    if (storedMatch?.roomId) {
      sessionStorage.removeItem('friendMatch');
      this.joinFriendMatch(storedMatch);
    }

    // If AI is white in singleplayer, AI should move first
    if (this.state.mode === 'single' && this.state.aiPlayerColor === 'white') {
      this.triggerAIMove();
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    if (this.state.socket) this.state.socket.disconnect();
  }

  // AI stuff
  triggerAIMove = () => {
    // Feed the current move history into the engine
    const movesForEngine = this.state.history.map((m) => ({
      from: (m.from || '').toLowerCase(),
      to: (m.to || '').toLowerCase(),
    }));

    this.ai.setPosition(movesForEngine);

    // Ask the engine for a move and play it on the board
    this.ai.getBestMove((uci) => {
      if (!uci) return;

      const fromSq = uci.slice(0, 2).toUpperCase();
      const toSq = uci.slice(2, 4).toUpperCase();

      this.boardRef?.makeOpponentMove({ from: fromSq, to: toSq });
    }, this.state.aiDifficulty);
  };

  handleMoveMade = (move) => {
    // Save move to history so AI + undo can use it
    this.setState((prev) => {
      const newHistory = prev.history.concat(move);
      return { history: newHistory, step: newHistory.length };
    });

    // In multiplayer, send the move to the server
    if (this.state.isMultiplayer && this.state.socket) {
      this.state.socket.emit('playerMove', {
        roomId: this.state.roomId,
        move
      });
    }
  };

  handleTurnChange = (nextTurn) => {
    // Update whose turn it is, then trigger AI if needed
    this.setState({ turn: nextTurn }, () => {
      if (this.state.mode === 'single' && nextTurn === this.state.aiPlayerColor) {
        this.triggerAIMove();
      }
    });
  };

  handleGameEnd = (winner, reason) => {
    // Stop the clock and store the winner
    this.setState({ winner }, () => {
      clearInterval(this.timer);

      // Let server know game ended if multiplayer
      if (this.state.isMultiplayer && this.state.socket) {
        this.state.socket.emit('gameEnd', { roomId: this.state.roomId, winner, reason });
      }
    });
  };

  // Multiplayer stuff
  findMatch = () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    // Create socket connection for matchmaking/game events
    const socket = io(WS_URL, {
      query: { userId: user ? user._id : undefined }
    });

    this.setState({ socket });

    // Ask server to match us with someone in this mode
    socket.emit('findMatch', { mode: this.state.mode });

    // Server returns room + our color + opponent username
    socket.on('matchFound', ({ roomId, color, opponent }) => {
      this.setState({
        isMultiplayer: true,
        playerColor: color,
        aiPlayerColor: opp(color),
        opponent,
        roomId
      });
    });

    // Opponent move came in -> apply it to the board
    socket.on('moveMade', (move) => {
      this.boardRef?.makeOpponentMove(move);
    });

    // Server says game is over
    socket.on('gameOver', ({ winner }) => {
      this.setState({ winner });
    });
  };

  joinFriendMatch = ({ roomId, color, opponent, mode }) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    // Connect and join the existing room
    const socket = io(WS_URL, {
      query: { userId: user ? user._id : undefined }
    });

    socket.emit('joinMatch', { roomId });

    socket.on('moveMade', (move) => {
      this.boardRef?.makeOpponentMove(move);
    });

    socket.on('gameOver', ({ winner }) => {
      this.setState({ winner });
    });

    this.setState({
      isMultiplayer: true,
      socket,
      mode: mode || 'classical',
      playerColor: color,
      aiPlayerColor: opp(color),
      opponent,
      roomId
    });
  };

  // Clocks
  startTimer = () => {
    clearInterval(this.timer);
    if (this.state.winner) return; // don't run timer after game ends

    this.timer = setInterval(() => {
      const key = this.state.turn === 'white' ? 'whiteTime' : 'blackTime';

      this.setState((prev) => {
        const nextVal = prev[key] - 1;
        const t = nextVal < 0 ? 0 : nextVal;

        // If time hits 0, other side wins
        if (t === 0 && !prev.winner) {
          clearInterval(this.timer);
          return {
            [key]: 0,
            winner: prev.turn === 'white' ? 'black' : 'white'
          };
        }

        return { [key]: t };
      });
    }, 1000);
  };

  startNewGame = () => {
    const timeLimit = this.state.timeLimit;
    clearInterval(this.timer);

    // Reset state that changes during a game
    this.setState(
      {
        gameId: Date.now(),
        whiteTime: timeLimit,
        blackTime: timeLimit,
        winner: null,
        turn: 'white',
        history: [],
        step: 0
      },
      () => {
        this.startTimer();

        // AI moves first if it's white in singleplayer
        if (this.state.mode === 'single' && this.state.aiPlayerColor === 'white') {
          this.triggerAIMove();
        }
      }
    );
  };

  handleTimeLimitChange = (e) => {
    // dropdown is in minutes, convert to seconds
    const minutes = parseInt(e.target.value, 10);
    const seconds = minutes * 60;
    this.setState({ timeLimit: seconds, whiteTime: seconds, blackTime: seconds });
  };

  // format seconds as M:SS
  formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, '0');
    return m + ':' + sec;
  };

  render() {
    const gameId = this.state.gameId;
    const whiteTime = this.state.whiteTime;
    const blackTime = this.state.blackTime;
    const winner = this.state.winner;
    const turn = this.state.turn;
    const timeLimit = this.state.timeLimit;
    const history = this.state.history;
    const step = this.state.step;
    const playerColor = this.state.playerColor;
    const opponent = this.state.opponent;

    return (
      <div className={styles.chessGame}>
        <div className={styles.controls}>
          <h2>Chess</h2>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={this.findMatch}>Find Multiplayer Match</button>

            {/* Show opponent name once server gives it */}
            {opponent ? <div>Opponent: {opponent}</div> : null}

            {/* Show the user's color */}
            <div
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                background: '#0b2239',
                color: '#cde3ff',
                fontWeight: 600
              }}
            >
              You are: {playerColor.toUpperCase()}
            </div>
          </div>

          <div className={styles.config}>
            <label>Game Mode: </label>
            <select
              value={this.state.mode}
              onChange={(e) => this.setState({ mode: e.target.value })}
            >
              <option value="single">Singleplayer (Local AI)</option>
              <option value="classical">Classical</option>
              <option value="blitz">Blitz</option>
              <option value="bullet">Bullet</option>
            </select>

            <label>Time Limit (minutes): </label>
            <select
              value={timeLimit / 60}
              onChange={this.handleTimeLimitChange}
              disabled={winner !== null} // don't change time mid-game
            >
              {[1, 3, 5, 10, 15].map((min) => (
                <option key={min} value={min}>{min} min</option>
              ))}
            </select>

            <button onClick={this.startNewGame}>New Game</button>
          </div>

          <div className={styles.timers}>
            <div className={turn === 'white' ? styles.active : ''}>
              ⬜ White: {this.formatTime(whiteTime)}
            </div>
            <div className={turn === 'black' ? styles.active : ''}>
              ⬛ Black: {this.formatTime(blackTime)}
            </div>
          </div>

          {/* Winner display */}
          {winner && <div className={styles.winner}>🏆 {winner.toUpperCase()} wins!</div>}
        </div>

        <Board
          ref={(ref) => (this.boardRef = ref)}
          key={gameId} // changing key forces Board to remount
          gameMode={this.state.mode}
          playerColor={playerColor}
          orientation={playerColor}
          onMoveMade={this.handleMoveMade}
          onTurnChange={this.handleTurnChange}
          onGameEnd={this.handleGameEnd}
          history={history}
          step={step}
          enableUndo={this.state.enableUndo}
          onStepChange={(s) => this.setState({ step: s })}
          timeLimit={timeLimit}
          isMultiplayer={this.state.isMultiplayer}
        />
      </div>
    );
  }
}

// Wrapper to pass router location into the class component
export default function ChessWrapper() {
  const location = useLocation();
  return <Chess location={location} />;
}
