import { AppState, type AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';
import { getAccessToken } from '../services/tokenStorage';
import { refreshSession } from '../api/client';

// The WebSocket server is the API origin without the /api/v1 prefix.
const WS_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;

// Tell the server whether the app is open in the foreground. When it isn't,
// the server sends phone (push) notifications instead of relying on the app.
const isActive = (s: AppStateStatus) => s === 'active';
let appStateSub: { remove: () => void } | null = null;
function reportAppState(state: AppStateStatus = AppState.currentState) {
  socket?.emit('app:state', { active: isActive(state) });
}
function watchAppState() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (st) => reportAppState(st));
}

// Subscribers notified whenever the socket instance changes (connect/disconnect),
// so features like the call manager can (re)attach their listeners.
const changeListeners = new Set<() => void>();
const notify = () => changeListeners.forEach((l) => l());

export function onSocketChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Connect (or reconnect) the realtime socket authenticated with the access token. */
export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(WS_ORIGIN, {
    // Read the LATEST access token on every (re)connect — it rotates every 15 min.
    auth: (cb) => {
      void getAccessToken().then((t) => cb({ token: t ?? token }));
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
  });
  socket.on('connect', () => reportAppState());
  // The server drops sockets with an expired token ("io server disconnect"),
  // which socket.io never retries on its own → renew the token, reconnect.
  const s = socket;
  s.on('disconnect', (reason) => {
    if (reason !== 'io server disconnect') return;
    setTimeout(() => {
      void refreshSession().then((ok) => {
        if (ok && socket === s && !s.connected) s.connect();
      });
    }, 1000);
  });
  watchAppState();
  notify();
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    notify();
  }
}
