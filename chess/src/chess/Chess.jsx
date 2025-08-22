import React, { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

import Board from './Board.jsx';
import AIEngine from '../ai/AIEngine.js';
import styles from '../build/Chess.module.css';

const DEFAULT_TIME = 300;
const SOCKET_SERVER = 'http://localhost:5000';
const opp = (c) => (c === 'white' ? 'black' : 'white');

class Chess extends Component {
  constructor(props) {
    super(props);
    const state = props.location?.state || {};

    let playerColor = state.playerColor || null;
    let aiPlayerColor = state.aiPlayerColor || null;
    const mode = state.mode || 'single';

    if (mode === 'single') {
      if (playerColor) aiPlayerColor = opp(playerColor);
      else if (aiPlayerColor) playerColor = opp(aiPlayerColor);
      else { playerColor = 'white'; aiPlayerColor = 'black'; }
    } else {
      playerColor = 'white';
      aiPlayerColor = 'black';
    }

    this.state = {
      gameId: Date.now(),
      mode,
      aiDifficulty: state.aiDifficulty || 10,
      playerColor,
      aiPlayerColor,
      timeLimit: DEFAULT_TIME,
      whiteTime: DEFAULT_TIME,
      blackTime: DEFAULT_TIME,
      winner: null,
      turn: 'white',
      enableUndo: true,
      history: [],
      step: 0,
      isMultiplayer: false,
      socket: null,
      opponent: null,
      roomId: '',
    };

    this.timer = null;
    this.ai = new AIEngine();
  }

  componentDidMount() {
    this.startTimer();
    // If AI is white in single-player, it must move first
    if (this.state.mode === 'single' && this.state.aiPlayerColor === 'white') {
      this.triggerAIMove();
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    if (this.state.socket) this.state.socket.disconnect();
  }

  // ----------------- AI -----------------
  triggerAIMove = () => {
    this.ai.setPosition(
      this.state.history.map((m) => ({
        from: (m.from || '').toLowerCase(),
        to: (m.to || '').toLowerCase(),
      }))
    );

    this.ai.getBestMove((uci) => {
      if (!uci) return;
      const move = {
        from: uci.slice(0, 2).toUpperCase(),
        to: uci.slice(2, 4).toUpperCase(),
      };
      this.boardRef?.makeOpponentMove(move);
    }, this.state.aiDifficulty);
  };

  handleMoveMade = (move) => {
    this.setState((prev) => ({
      history: [...prev.history, move],
      step: prev.history.length + 1,
    }));

    if (this.state.isMultiplayer && this.state.socket) {
      this.state.socket.emit('playerMove', {
        roomId: this.state.roomId,
        move
      });
    }
  };

  handleTurnChange = (nextTurn) => {
    this.setState({ turn: nextTurn }, () => {
      if (this.state.mode === 'single' && nextTurn === this.state.aiPlayerColor) {
        this.triggerAIMove();
      }
    });
  };

  handleGameEnd = (winner, reason) => {
    this.setState({ winner }, () => {
      clearInterval(this.timer);
      if (this.state.isMultiplayer && this.state.socket) {
        this.state.socket.emit('gameEnd', { roomId: this.state.roomId, winner, reason });
      }
    });
  };

  // ----------------- MP (optional) -----------------
  findMatch = () => {
    const socket = io(SOCKET_SERVER, {
      query: { userId: localStorage.getItem('userId') }
    });

    socket.emit('findMatch', { mode: this.state.mode });

    socket.on('matchFound', ({ roomId, color, opponent }) => {
      this.setState({
        isMultiplayer: true,
        socket,
        playerColor: color,
        aiPlayerColor: opp(color),
        opponent,
        roomId
      });
    });

    socket.on('moveMade', (move) => {
      this.boardRef?.makeOpponentMove(move);
    });

    socket.on('gameOver', ({ winner }) => {
      this.setState({ winner });
    });

    this.setState({ socket });
  };

  // ----------------- Clocks -----------------
  startTimer = () => {
    clearInterval(this.timer);
    if (this.state.winner) return;

    this.timer = setInterval(() => {
      const key = this.state.turn === 'white' ? 'whiteTime' : 'blackTime';
      this.setState((prev) => {
        const t = Math.max(prev[key] - 1, 0);
        if (t === 0 && !prev.winner) {
          clearInterval(this.timer);
          return { [key]: 0, winner: prev.turn === 'white' ? 'black' : 'white' };
        }
        return { [key]: t };
      });
    }, 1000);
  };

  startNewGame = () => {
    const { timeLimit } = this.state;
    clearInterval(this.timer);
    this.setState({
      gameId: Date.now(),
      whiteTime: timeLimit,
      blackTime: timeLimit,
      winner: null,
      turn: 'white',
      history: [],
      step: 0
    }, () => {
      this.startTimer();
      if (this.state.mode === 'single' && this.state.aiPlayerColor === 'white') {
        this.triggerAIMove();
      }
    });
  };

  handleTimeLimitChange = (e) => {
    const seconds = parseInt(e.target.value, 10) * 60;
    this.setState({ timeLimit: seconds, whiteTime: seconds, blackTime: seconds });
  };

  formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  render() {
    const {
      gameId, whiteTime, blackTime, winner, turn,
      timeLimit, history, step, playerColor, opponent
    } = this.state;

    return (
      <div className={styles.chessGame}>
        <div className={styles.controls}>
          <h2>Chess</h2>
          <div style={{display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap'}}>
            <button onClick={this.findMatch}>Find Multiplayer Match</button>
            {opponent && <div>Opponent: {opponent}</div>}
            <div style={{padding:'4px 10px', borderRadius:'999px', background:'#0b2239', color:'#cde3ff', fontWeight:600}}>
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
              disabled={winner !== null}
            >
              {[1, 3, 5, 10, 15].map((min) => (
                <option key={min} value={min}>{min} min</option>
              ))}
            </select>

            <button onClick={this.startNewGame}>New Game</button>
          </div>

          <div className={styles.timers}>
            <div className={turn === 'white' ? styles.active : ''}>⬜ White: {this.formatTime(whiteTime)}</div>
            <div className={turn === 'black' ? styles.active : ''}>⬛ Black: {this.formatTime(blackTime)}</div>
          </div>
          {winner && <div className={styles.winner}>🏆 {winner.toUpperCase()} wins!</div>}
        </div>

        <Board
          ref={(ref) => (this.boardRef = ref)}
          key={gameId}
          // gameplay
          gameMode={this.state.mode}
          playerColor={playerColor}
          orientation={playerColor}
          // callbacks
          onMoveMade={this.handleMoveMade}
          onTurnChange={this.handleTurnChange}
          onGameEnd={this.handleGameEnd}
          // review
          history={history}
          step={step}
          enableUndo={this.state.enableUndo}
          onStepChange={(s) => this.setState({ step: s })}
          // clocks
          timeLimit={timeLimit}
          // mp flags
          isMultiplayer={this.state.isMultiplayer}
        />
      </div>
    );
  }
}

export default function ChessWrapper() {
  const location = useLocation();
  return <Chess location={location} />;
}
