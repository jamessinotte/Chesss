import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import styles from '../build/Home.module.css';

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      socket: null,
      friends: [],
      friendRequests: [],
      searchQuery: '',
      searchResults: [],
      user: JSON.parse(localStorage.getItem('user')) || null,
      aiDifficulty: 10,
      aiPlayerColor: 'white',
      modeFinding: null,
    };
  }

  componentDidMount() {
    if (this.state.user) {
      const socket = io('http://localhost:5000', {
        query: { userId: this.state.user._id }
      });
      this.setState({ socket });

      this.fetchFriends();
      this.fetchFriendRequests();

      socket.on('friendRequestReceived', (data) => {
        this.setState((prev) => ({
          friendRequests: [...prev.friendRequests, data]
        }));
      });

      socket.on('friendRequestAccepted', () => {
        this.fetchFriends();
      });

      socket.on('friendRequestDeclined', () => {});
    }
  }

  componentWillUnmount() {
    this.state.socket?.disconnect();
  }

  // ------- API calls -------
  fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const u = JSON.parse(localStorage.getItem('user'));
      const res = await axios.get(`/api/users/friends/${u._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const friendsArray = Array.isArray(res.data) ? res.data : (res.data.friends || []);
      this.setState({ friends: friendsArray });
    } catch (err) {
      console.error('Error fetching friends:', err.response?.data || err.message);
      this.setState({ friends: [] });
    }
  };

  fetchFriendRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const u = JSON.parse(localStorage.getItem('user'));
      const res = await axios.get(`/api/friends/requests/${u._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const requestsArray = Array.isArray(res.data) ? res.data : [];
      this.setState({ friendRequests: requestsArray });
    } catch (err) {
      console.error('Error fetching friend requests:', err.response?.data || err.message);
      this.setState({ friendRequests: [] });
    }
  };

  handleSearch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/users/search?username=${this.state.searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      this.setState({ searchResults: res.data || [] });
    } catch (e) {
      console.error(e);
      this.setState({ searchResults: [] });
    }
  };

  // ------- Socket helpers -------
  sendFriendRequest = (toUserId) => {
    this.state.socket.emit('sendFriendRequest', {
      fromUserId: this.state.user._id,
      toUserId
    });
  };

  acceptFriendRequest = (requesterId) => {
    this.state.socket.emit('acceptFriendRequest', {
      userId: this.state.user._id,
      requesterId
    });
    this.setState((prev) => ({
      friendRequests: prev.friendRequests.filter((req) => req.from !== requesterId)
    }));
    this.fetchFriends();
  };

  declineFriendRequest = (requesterId) => {
    this.state.socket.emit('declineFriendRequest', {
      userId: this.state.user._id,
      requesterId
    });
    this.setState((prev) => ({
      friendRequests: prev.friendRequests.filter((req) => req.from !== requesterId)
    }));
  };

  findMatch = (mode) => {
    this.setState({ modeFinding: mode });
    this.state.socket.emit('findMatch', { mode });
    // The board screen listens for `matchFound`
  };

  logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/signin';
  };

  render() {
    const { friends, friendRequests, searchResults, searchQuery, aiDifficulty, aiPlayerColor, modeFinding, user } = this.state;

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Welcome to <span className={styles.brand}>Chesss.com</span></h1>
          {user && <div className={styles.me}>Signed in as <strong>{user.username}</strong></div>}
        </header>

        <main className={styles.grid}>
          {/* Friends */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Friends</h2>
            </div>
            <div className={styles.cardBody}>
              {friends.length === 0 && <div className={styles.empty}>No friends yet.</div>}
              <ul className={styles.list}>
                {friends.map((f) => (
                  <li key={f._id} className={styles.listItem}>
                    <span className={styles.avatar}>{(f.username||'?')[0]?.toUpperCase()}</span>
                    <div className={styles.listMeta}>
                      <div className={styles.username}>{f.username}</div>
                      <div className={styles.status + ' ' + styles[`s_${f.status||'offline'}`]}>
                        {f.status || 'offline'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Friend Requests */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Friend Requests</h2>
            </div>
            <div className={styles.cardBody}>
              {friendRequests.length === 0 && <div className={styles.empty}>No pending requests.</div>}
              <ul className={styles.requestList}>
                {friendRequests.map((req, idx) => (
                  <li key={idx} className={styles.requestItem}>
                    <div className={styles.reqName}>Request from <strong>{req.from}</strong></div>
                    <div className={styles.actions}>
                      <button className={`${styles.btn} ${styles.primary}`} onClick={() => this.acceptFriendRequest(req.from)}>Accept</button>
                      <button className={`${styles.btn} ${styles.ghost}`} onClick={() => this.declineFriendRequest(req.from)}>Decline</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Search */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Find Players</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.searchRow}>
                <input
                  type="text"
                  placeholder="Search users…"
                  value={searchQuery}
                  onChange={(e) => this.setState({ searchQuery: e.target.value })}
                  className={styles.input}
                />
                <button className={`${styles.btn} ${styles.primary}`} onClick={this.handleSearch}>Search</button>
              </div>

              <ul className={styles.searchList}>
                {searchResults.map((user) => (
                  <li key={user._id} className={styles.searchItem}>
                    <div className={styles.searchMeta}>
                      <span className={styles.avatar}>{(user.username||'?')[0]?.toUpperCase()}</span>
                      <span className={styles.username}>{user.username}</span>
                    </div>
                    <button className={`${styles.btn} ${styles.ghost}`} onClick={() => this.sendFriendRequest(user._id)}>
                      Add Friend
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Multiplayer */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Multiplayer</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.pillRow}>
                <button
                  className={`${styles.pill} ${modeFinding==='classical' ? styles.pillActive : ''}`}
                  onClick={() => this.findMatch('classical')}
                >Classical</button>
                <button
                  className={`${styles.pill} ${modeFinding==='blitz' ? styles.pillActive : ''}`}
                  onClick={() => this.findMatch('blitz')}
                >Blitz</button>
                <button
                  className={`${styles.pill} ${modeFinding==='bullet' ? styles.pillActive : ''}`}
                  onClick={() => this.findMatch('bullet')}
                >Bullet</button>
              </div>
              <div className={styles.muted}>We’ll notify you when a match is found.</div>
            </div>
          </section>

          {/* Singleplayer */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Singleplayer</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.row}>
                <label>AI Difficulty</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => this.setState({ aiDifficulty: parseInt(e.target.value, 10) })}
                  className={styles.select}
                >
                  <option value="1">Beginner</option>
                  <option value="5">Intermediate</option>
                  <option value="10">Advanced</option>
                  <option value="15">Master</option>
                  <option value="20">Grandmaster</option>
                </select>
              </div>

              <div className={styles.row}>
                <label>Play as</label>
                <select
                  value={aiPlayerColor}
                  onChange={(e) => this.setState({ aiPlayerColor: e.target.value })}
                  className={styles.select}
                >
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </div>

              <Link
                to="/chess"
                state={{ mode: 'single', aiDifficulty, aiPlayerColor }}
                className={styles.linkReset}
              >
                <button className={`${styles.btn} ${styles.primary} ${styles.full}`}>Start Singleplayer</button>
              </Link>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <button className={`${styles.btn} ${styles.ghost}`} onClick={this.logout}>Logout</button>
        </footer>
      </div>
    );
  }
}

export default Home;
