import { io } from 'socket.io-client';
import { tokenStore } from './client.js';

// One live connection to the backend (Socket.IO), opened when a page first needs it.
// It carries the login token so the server knows which center / customer to notify.
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ORIGIN = new URL(API).origin;

let socket = null;
let socketToken = null;

export function getSocket() {
  const token = tokenStore.get();
  if (socket && socketToken !== token) {
    socket.disconnect(); // logged in as someone else: reconnect with the new token
    socket = null;
  }
  if (!socket) {
    socketToken = token;
    socket = io(ORIGIN, { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
