import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import styles from '../build/Home.module.css';
import { api, WS_URL } from '../lib/api';

class Home extends Component {
  constructor(props) {
    super(props);

    let u = null;
    try {
      u = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      u = null;
    }

    this.state = {
      socket: null,              // socket connection (set after login)
      friends: [],               // current friend list
      friendRequests: [],        // incoming friend requests
      gameInvites: [],           // incoming match invites
      searchQuery: '',           // text in the search box
      searchResults: [],         // users returned from search
      user: u || null, // logged in user (from localStorage)
      aiDifficulty: 10,          // default singleplayer difficulty
      aiPlayerColor: 'white',    // default singleplayer color
      modeFinding: null,         // which multiplayer mode we're queueing for
    };

    this._mounted = false;
  }

  componentDidMount() {
    this._mounted = true;

    // Only connect sockets / fetch data if someone is logged in
    if (this.state.user) {
      let sock = null;
      try {
        sock = io(WS_URL, {
          query: { userId: this.state.user._id } // server uses this to identify us
        });
      } catch (e) {
        sock = null;
      }

      if (sock) {
        this.setState({ socket: sock });
      }

      // Initial data load
      this.fetchFriends();
      this.fetchFriendRequests();

      if (sock) {
        // Friend request came in -> update list + refresh to stay in sync
        sock.on('friendRequestReceived', (data) => {
          this.setState((prev) => ({
            friendRequests: prev.friendRequests.concat([data])
          }));
          this.fetchFriendRequests();
        });

        // If someone accepted our request, refresh friends
        sock.on('friendRequestAccepted', () => {
          this.fetchFriends();
        });

        // Keeping this event in case we want UI feedback later
        sock.on('friendRequestDeclined', () => {});

        // Someone invited us to a match
        sock.on('friendMatchInvite', (data) => {
          this.setState((prev) => ({
            gameInvites: prev.gameInvites.concat([data])
          }));
        });

        // Opponent declined the invite -> remove it from our list
        sock.on('friendMatchDeclined', ({ by }) => {
          this.setState((prev) => ({
            gameInvites: prev.gameInvites.filter((invite) => invite.fromUserId !== by)
          }));
        });

        // Server found a match -> store info and go to chess page
        sock.on('matchFound', ({ roomId, color, opponent, mode }) => {
          sessionStorage.setItem('friendMatch', JSON.stringify({ roomId, color, opponent, mode }));
          window.location.href = '/chess';
        });
      }
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    // Disconnect so we don't keep listening after leaving the page
    if (this.state.socket) {
      try {
        this.state.socket.disconnect();
      } catch (e) {}
    }
  }

  // ------- API calls -------
  fetchFriends = async () => {
    try {
      const uStr = localStorage.getItem('user');
      const u = uStr ? JSON.parse(uStr) : null;
      if (!u?._id) {
        if (this._mounted) this.setState({ friends: [] });
        return;
      }

      const res = await api.get(`/users/friends/${u._id}`);

      // Backend sometimes returns { friends: [] } or just []
      let friendsArray = [];
      if (Array.isArray(res.data)) friendsArray = res.data;
      else if (res.data && Array.isArray(res.data.friends)) friendsArray = res.data.friends;

      if (this._mounted) this.setState({ friends: friendsArray });
    } catch (err) {
      console.error('Error fetching friends:', err.response?.data || err.message);
      if (this._mounted) this.setState({ friends: [] }); // just show empty list if it fails
    }
  };

  fetchFriendRequests = async () => {
    try {
      const uStr = localStorage.getItem('user');
      const u = uStr ? JSON.parse(uStr) : null;
      if (!u?._id) {
        if (this._mounted) this.setState({ friendRequests: [] });
        return;
      }

      const res = await api.get(`/friends/requests/${u._id}`);

      const requestsArray = Array.isArray(res.data) ? res.data : [];

      // Normalize the request shape so render code is consistent
      const readyList = [];
      for (let i = 0; i < requestsArray.length; i++) {
        const request = requestsArray[i];
        const fromId = request?.from?._id || request?.from;
        readyList.push({
          ...request,
          from: fromId,
          fromUser: request?.from || null
        });
      }

      if (this._mounted) this.setState({ friendRequests: readyList });
    } catch (err) {
      console.error('Error fetching friend requests:', err.response?.data || err.message);
      if (this._mounted) this.setState({ friendRequests: [] });
    }
  };

  handleSearch = async () => {
    try {
      // Search users by username typed in the input
      const res = await api.get('/users/search', {
        params: { username: this.state.searchQuery }
      });
      if (this._mounted) this.setState({ searchResults: res.data || [] });
    } catch (e) {
      console.error(e);
      if (this._mounted) this.setState({ searchResults: [] });
    }
  };

  // ------- Socket helpers -------
  sendFriendRequest = async (toUserId) => {
    const reqData = {
      fromUserId: this.state.user?._id,
      toUserId
    };

    if (!reqData.fromUserId || !reqData.toUserId) return;

    // Use sockets so it sends instantly
    if (this.state.socket) {
      this.state.socket.emit('sendFriendRequest', reqData);
      return;
    }

    // If we don't have a socket, use the REST route instead
    try {
      await api.post('/friends/send', reqData);
    } catch (err) {
      console.error('Error sending friend request:', err.response?.data || err.message);
    }
  };

  acceptFriendRequest = (requesterId) => {
    if (!this.state.socket) return;

    // Tell server to accept + update our UI right away
    this.state.socket.emit('acceptFriendRequest', {
      userId: this.state.user._id,
      requesterId
    });

    // Remove it locally so it disappears immediately
    this.setState((prev) => ({
      friendRequests: prev.friendRequests.filter((req) => req.from !== requesterId)
    }));

    // Refresh friends because accepting adds them
    this.fetchFriends();
  };

  declineFriendRequest = (requesterId) => {
    if (!this.state.socket) return;

    // Tell server decline + remove locally
    this.state.socket.emit('declineFriendRequest', {
      userId: this.state.user._id,
      requesterId
    });

    this.setState((prev) => ({
      friendRequests: prev.friendRequests.filter((req) => req.from !== requesterId)
    }));
  };

  sendGameInvite = (toUserId, mode = 'classical') => {
    if (!this.state.socket) return; // need socket for invites

    this.state.socket.emit('inviteFriendMatch', {
      fromUserId: this.state.user._id,
      toUserId,
      mode
    });
  };

  acceptGameInvite = (invite) => {
    if (!this.state.socket) return;

    // Accept invite and let server set up the match
    this.state.socket.emit('acceptFriendMatch', {
      fromUserId: invite.fromUserId,
      toUserId: this.state.user._id,
      mode: invite.mode || 'classical'
    });

    // Remove this invite from our UI
    this.setState((prev) => ({
      gameInvites: prev.gameInvites.filter((item) => item !== invite)
    }));
  };

  declineGameInvite = (invite) => {
    if (!this.state.socket) return;

    this.state.socket.emit('declineFriendMatch', {
      fromUserId: invite.fromUserId,
      toUserId: this.state.user._id
    });

    this.setState((prev) => ({
      gameInvites: prev.gameInvites.filter((item) => item !== invite)
    }));
  };

  findMatch = (mode) => {
    if (!this.state.socket) return;

    // Highlight which mode we're searching for
    this.setState({ modeFinding: mode });

    // Ask server to queue us for this mode
    this.state.socket.emit('findMatch', { mode });
  };

  logout = () => {
    // Clear auth info and go back to sign in
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/signin';
  };

  render() {
    const {
      friends,
      friendRequests,
      gameInvites,
      searchResults,
      searchQuery,
      aiDifficulty,
      aiPlayerColor,
      modeFinding,
      user
    } = this.state;

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            Welcome to <span className={styles.brand}>Chesss.com</span>
          </h1>
          {/* Shows who is signed in */}
          {user && <div className={styles.me}>Signed in as <strong>{user.username}</strong></div>}
        </header>

        <main className={styles.grid}>

          {/* Friends list + quick "Play" button */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Friends</h2>
            </div>
            <div className={styles.cardBody}>
              {friends.length === 0 && <div className={styles.empty}>No friends yet.</div>}
              <ul className={styles.list}>
                {friends.map((f) => (
                  <li key={f._id} className={styles.listItem}>
                    {/* Simple letter avatar */}
                    <span className={styles.avatar}>{(f.username || '?')[0]?.toUpperCase()}</span>

                    <div className={styles.listMeta}>
                      <div className={styles.username}>{f.username}</div>
                      {/* status class is dynamic (s_online / s_offline / etc) */}
                      <div className={styles.status + ' ' + styles[`s_${f.status || 'offline'}`]}>
                        {f.status || 'offline'}
                      </div>
                    </div>

                    <button
                      className={`${styles.btn} ${styles.ghost}`}
                      onClick={() => this.sendGameInvite(f._id)}
                    >
                      Play
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Incoming game invites */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Game Invites</h2>
            </div>
            <div className={styles.cardBody}>
              {gameInvites.length === 0 && <div className={styles.empty}>No invites yet.</div>}
              <ul className={styles.requestList}>
                {gameInvites.map((invite, idx) => (
                  <li key={idx} className={styles.requestItem}>
                    <div className={styles.reqName}>
                      Match request from <strong>{invite.fromUsername || invite.fromUserId}</strong>
                      {invite.mode && <span> ({invite.mode})</span>}
                    </div>

                    <div className={styles.actions}>
                      <button
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={() => this.acceptGameInvite(invite)}
                      >
                        Accept
                      </button>
                      <button
                        className={`${styles.btn} ${styles.ghost}`}
                        onClick={() => this.declineGameInvite(invite)}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Incoming friend requests */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Friend Requests</h2>
            </div>
            <div className={styles.cardBody}>
              {friendRequests.length === 0 && <div className={styles.empty}>No pending requests.</div>}
              <ul className={styles.requestList}>
                {friendRequests.map((req, idx) => (
                  <li key={idx} className={styles.requestItem}>
                    <div className={styles.reqName}>
                      Request from <strong>{req.fromUser?.username || req.from}</strong>
                    </div>

                    <div className={styles.actions}>
                      <button
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={() => this.acceptFriendRequest(req.fromUser?._id || req.from)}
                      >
                        Accept
                      </button>
                      <button
                        className={`${styles.btn} ${styles.ghost}`}
                        onClick={() => this.declineFriendRequest(req.fromUser?._id || req.from)}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Search users + add friend */}
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
                <button className={`${styles.btn} ${styles.primary}`} onClick={this.handleSearch}>
                  Search
                </button>
              </div>

              <ul className={styles.searchList}>
                {searchResults.map((user) => (
                  <li key={user._id} className={styles.searchItem}>
                    <div className={styles.searchMeta}>
                      <span className={styles.avatar}>{(user.username || '?')[0]?.toUpperCase()}</span>
                      <span className={styles.username}>{user.username}</span>
                    </div>

                    <button
                      className={`${styles.btn} ${styles.ghost}`}
                      onClick={() => this.sendFriendRequest(user._id)}
                    >
                      Add Friend
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Quick matchmaking queue */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Multiplayer</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.pillRow}>
                <button
                  className={`${styles.pill} ${modeFinding === 'classical' ? styles.pillActive : ''}`}
                  onClick={() => this.findMatch('classical')}
                >
                  Classical
                </button>
                <button
                  className={`${styles.pill} ${modeFinding === 'blitz' ? styles.pillActive : ''}`}
                  onClick={() => this.findMatch('blitz')}
                >
                  Blitz
                </button>
                <button
                  className={`${styles.pill} ${modeFinding === 'bullet' ? styles.pillActive : ''}`}
                  onClick={() => this.findMatch('bullet')}
                >
                  Bullet
                </button>
              </div>
              <div className={styles.muted}>We’ll notify you when a match is found.</div>
            </div>
          </section>

          {/* AI settings + link into chess page */}
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

              {/* Passing settings through router state */}
              <Link
                to="/chess"
                state={{ mode: 'single', aiDifficulty, aiPlayerColor }}
                className={styles.linkReset}
              >
                <button className={`${styles.btn} ${styles.primary} ${styles.full}`}>
                  Start Singleplayer
                </button>
              </Link>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <button className={`${styles.btn} ${styles.ghost}`} onClick={this.logout}>
            Logout
          </button>
        </footer>
      </div>
    );
  }
}

export default Home;
