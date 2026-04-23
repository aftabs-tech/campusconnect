import { io } from 'socket.io-client';
import { BASE_URL } from './axios';

const socket = io(BASE_URL, {
  autoConnect: false // Don't connect until needed
});

export default socket;
