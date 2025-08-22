// src/chess/ai/AIChess.jsx
import React, { Component } from "react";
import Board from "../Board.jsx";
import styles from "../../build/Chess.module.css";
import AIEngine from "../../ai/AIEngine";

const DEFAULT_TIME = 300;
const toUci = (sq) => (sq || "").toLowerCase();
const toBoard = (uci) => ({
  from: (uci || "").slice(0, 2).toUpperCase(),
  to: (uci || "").slice(2, 4).toUpperCase(),
});

export default class AIChess extends Component {
  state = {
    gameId: Date.now(),
    timeLimit: DEFAULT_TIME,
    whiteTime: DEFAULT_TIME,
    blackTime: DEFAULT_TIME,
    winner: null,
    turn: "white",
    enableUndo: true,
    history: [],
    step: 0,
    aiColor: "black", // player is the opposite color
  };

  componentDidMount() {
    this.engine = new AIEngine();

    // Safety: also react to bestmove lines
    this.unsub = this.engine.addMessageListener((line) => {
      if (typeof line === "string" && line.startsWith("bestmove")) {
        const uci = line.split(/\s+/)[1];
        if (uci?.length >= 4) this.makeAIMove(uci);
      }
    });

    this.startTimer();
    this.engine.newGame();

    // If AI is white, move first
    if (this.state.aiColor === "white" && this.state.turn === "white") {
      this.triggerAIMove();
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.unsub?.();
    this.engine?.terminate();
  }

  // ---------- clocks ----------
  startTimer = () => {
    clearInterval(this.timer);
    if (this.state.winner) return;

    this.timer = setInterval(() => {
      const key = this.state.turn === "white" ? "whiteTime" : "blackTime";
      this.setState((prev) => {
        const t = Math.max(prev[key] - 1, 0);
        if (t === 0 && !prev.winner) {
          clearInterval(this.timer);
          return { [key]: 0, winner: prev.turn === "white" ? "black" : "white" };
        }
        return { [key]: t };
      });
    }, 1000);
  };

  handleGameEnd = (winner) => this.setState({ winner }, () => clearInterval(this.timer));

  // Board tells us whose turn is next after each move
  handleTurnChange = (nextTurn) => {
    this.setState({ turn: nextTurn }, () => {
      if (nextTurn === this.state.aiColor) this.triggerAIMove();
    });
  };

  // Full move details from the board
  handleMoveMade = (move) => {
    this.setState(
      (prev) => ({
        history: [...prev.history, move],
        step: prev.history.length + 1,
      }),
      () => {
        // If human just moved, it's now AI's turn
        if (move.team !== this.state.aiColor) {
          this.triggerAIMove();
        }
      }
    );
  };

  // ---------- engine ----------
  triggerAIMove = () => {
    // Keep engine in sync with current history
    this.engine.setPosition(this.state.history);

    // Depth can be configured; 8–12 is a nice range
    this.engine.getBestMove((uci) => {
      if (uci) this.makeAIMove(uci);
    }, 10);
  };

  makeAIMove = (uci) => {
    const { from, to } = toBoard(uci);
    // Apply on the board; board will emit onMoveMade/onTurnChange to keep state in sync
    this.boardRef?.makeOpponentMove({ from, to });
  };

  // ---------- UI ----------
  startNewGame = () => {
    clearInterval(this.timer);
    this.setState(
      {
        gameId: Date.now(),
        whiteTime: this.state.timeLimit,
        blackTime: this.state.timeLimit,
        winner: null,
        turn: "white",
        history: [],
        step: 0,
      },
      () => {
        this.startTimer();
        this.engine.newGame();
        if (this.state.aiColor === "white") this.triggerAIMove();
      }
    );
  };

  handleTimeLimitChange = (e) => {
    const seconds = parseInt(e.target.value, 10) * 60;
    this.setState({ timeLimit: seconds, whiteTime: seconds, blackTime: seconds });
  };

  toggleAIColor = () => {
    this.setState(
      (p) => ({ aiColor: p.aiColor === "black" ? "white" : "black" }),
      () => { if (this.state.turn === this.state.aiColor) this.triggerAIMove(); }
    );
  };

  formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  render() {
    const { gameId, whiteTime, blackTime, winner, turn, timeLimit, history, step, aiColor } = this.state;

    return (
      <div className={styles.chessGame}>
        <div className={styles.controls}>
          <h2>Chess vs AI</h2>
          <div className={styles.config}>
            <label>Time Limit (minutes): </label>
            <select value={timeLimit / 60} onChange={this.handleTimeLimitChange} disabled={winner !== null}>
              {[1, 3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
            <button className={styles.button} onClick={this.startNewGame}>New Game</button>
            <button className={styles.button} onClick={this.toggleAIColor}>
              Switch AI Color (AI: {aiColor})
            </button>
          </div>

          <div className={styles.timers}>
            <div className={turn === "white" ? styles.active : ""}>⬜ White: {this.formatTime(whiteTime)}</div>
            <div className={turn === "black" ? styles.active : ""}>⬛ Black: {this.formatTime(blackTime)}</div>
          </div>

          {winner && <div className={styles.winner}>🏆 {winner.toUpperCase()} wins!</div>}
        </div>

        <Board
          ref={(r) => (this.boardRef = r)}
          key={gameId}
          gameMode="single"
          timeLimit={timeLimit}
          onGameEnd={this.handleGameEnd}
          onTurnChange={this.handleTurnChange}
          onMoveMade={this.handleMoveMade}
          history={history}
          step={step}
          enableUndo={true}
          onStepChange={(s) => this.setState({ step: s })}
          isMultiplayer={false}
          // Human plays the opposite of AI
          playerColor={aiColor === "white" ? "black" : "white"}
        />
      </div>
    );
  }
}
