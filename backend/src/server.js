import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Packet from './models/Packet.js';
import { CaptureManager } from './captureManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const exportsDirectory = path.join(backendRoot, 'exports');
fs.mkdirSync(exportsDirectory, { recursive: true });

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/traffic_analyser';
const TSHARK_PATH = process.env.TSHARK_PATH || 'tshark';
const CAPTURE_INTERFACE = process.env.CAPTURE_INTERFACE || '';

// libpcap capture-filter syntax. Do not change "ip6" to "ipv6".
const CAPTURE_FILTER = String(process.env.CAPTURE_FILTER || 'ip or ip6').replace(/\bipv6\b/gi, 'ip6');

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

let mongoConnected = false;
let captureStatus = {
  running: false,
  interface: CAPTURE_INTERFACE,
  filter: CAPTURE_FILTER,
  error: '',
  packetsCaptured: 0,
};

const recentPackets = [];
const MAX_RECENT_PACKETS = 1000;
const dbQueue = [];
let dbFlushTimer = null;

let bytesInbound = 0;
let bytesOutbound = 0;
let packetsInbound = 0;
let packetsOutbound = 0;
let lastSpeedAt = Date.now();

const captureManager = new CaptureManager({
  tsharkPath: TSHARK_PATH,
  interfaceId: CAPTURE_INTERFACE,
  filter: CAPTURE_FILTER,
  onPacket: handlePacket,
  onStatus: status => {
    captureStatus = { ...captureStatus, ...status };
    io.emit('capture:status', captureStatus);
  }
});

io.on('connection', socket => {
  console.log(`[Socket.IO] Connected: ${socket.id}`);
  socket.emit('capture:status', captureStatus);
  socket.emit('packets:snapshot', recentPackets);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Disconnected: ${socket.id}`);
  });
});

async function handlePacket(packet) {
  captureStatus.packetsCaptured += 1;

  recentPackets.unshift(packet);
  if (recentPackets.length > MAX_RECENT_PACKETS) recentPackets.pop();

  if (packet.direction === 'inbound') {
    bytesInbound += packet.length;
    packetsInbound += 1;
  } else if (packet.direction === 'outbound') {
    bytesOutbound += packet.length;
    packetsOutbound += 1;
  }

  io.emit('packet:new', packet);

  if (mongoConnected) {
    dbQueue.push(packet);
  }
}

async function flushDatabaseQueue() {
  if (!mongoConnected || dbQueue.length === 0) return;

  const batch = dbQueue.splice(0, Math.min(dbQueue.length, 500));
  try {
    await Packet.insertMany(batch, { ordered: false });
  } catch (error) {
    console.error('[MongoDB] Batch insert failed:', error.message);
  }
}

dbFlushTimer = setInterval(flushDatabaseQueue, 1000);

dbFlushTimer.unref?.();

setInterval(() => {
  const now = Date.now();
  const seconds = Math.max((now - lastSpeedAt) / 1000, 0.001);

  io.emit('traffic:speed', {
    download: bytesInbound / seconds,
    upload: bytesOutbound / seconds,
    packetsPerSecond: (packetsInbound + packetsOutbound) / seconds,
    inboundPackets: packetsInbound,
    outboundPackets: packetsOutbound,
    timestamp: new Date()
  });

  bytesInbound = 0;
  bytesOutbound = 0;
  packetsInbound = 0;
  packetsOutbound = 0;
  lastSpeedAt = now;
}, 1000);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    tshark: TSHARK_PATH,
    capture: captureStatus
  });
});

app.get('/api/interfaces', async (req, res) => {
  try {
    const interfaces = await captureManager.listInterfaces();
    res.json({ interfaces });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/capture/status', (req, res) => {
  res.json(captureStatus);
});

app.post('/api/capture/test', async (req, res) => {
  try {
    const interfaceId = req.body?.interfaceId || captureStatus.interface || CAPTURE_INTERFACE || '';
    if (!interfaceId) return res.status(400).json({ success: false, error: 'No capture interface selected.' });

    const result = await captureManager.testCapture(interfaceId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/capture/start', async (req, res) => {
  try {
    const requested = req.body?.interfaceId || CAPTURE_INTERFACE || '';
    if (!requested) return res.status(400).json({ success: false, error: 'No capture interface selected.' });

    captureManager.filter = CAPTURE_FILTER;
    captureManager.interfaceId = String(requested);

    captureStatus = {
      ...captureStatus,
      running: false,
      interface: String(requested),
      filter: CAPTURE_FILTER,
      error: '',
      packetsCaptured: 0,
        };

    recentPackets.length = 0;
    io.emit('packets:cleared');
    io.emit('capture:status', captureStatus);

    await captureManager.start(String(requested));

    res.json({
      success: true,
      running: true,
      interface: captureManager.interfaceId,
      filter: CAPTURE_FILTER
    });
  } catch (error) {
    captureStatus = { ...captureStatus, running: false, error: error.message };
    io.emit('capture:status', captureStatus);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/capture/stop', (req, res) => {
  captureManager.stop();
  captureStatus = { ...captureStatus, running: false, error: '' };
  io.emit('capture:status', captureStatus);
  res.json({ success: true, running: false });
});

app.get('/api/packets', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 5000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.direction && ['inbound', 'outbound', 'local', 'unknown'].includes(req.query.direction)) {
      query.direction = req.query.direction;
    }

    if (req.query.protocol) query.protocol = req.query.protocol;

    if (req.query.ip) {
      const escaped = String(req.query.ip).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { sourceIp: { $regex: escaped, $options: 'i' } },
        { destinationIp: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [packets, total] = await Promise.all([
      Packet.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Packet.countDocuments(query)
    ]);

    res.json({ packets, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/packets', async (req, res) => {
  try {
    const result = await Packet.deleteMany({});
    recentPackets.length = 0;
    captureStatus.packetsCaptured = 0;
    io.emit('packets:cleared');
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

app.get('/api/export/:format', async (req, res) => {
  try {
    const format = String(req.params.format).toLowerCase();
    if (!['csv', 'json'].includes(format)) return res.status(400).json({ error: 'Use csv or json.' });

    const packets = await Packet.find({}).sort({ timestamp: 1 }).lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="traffic-${Date.now()}.json"`);
      return res.send(JSON.stringify(packets, null, 2));
    }

    const headers = ['timestamp', 'direction', 'sourceIp', 'sourcePort', 'destinationIp', 'destinationPort', 'protocol', 'transport', 'length', 'tcpFlags', 'host', 'sni', 'interface'];
    const rows = [headers.join(',')];
    for (const p of packets) {
      rows.push([
        p.timestamp, p.direction, p.sourceIp, p.sourcePort, p.destinationIp, p.destinationPort,
        p.protocol, p.transport, p.length, p.tcpFlags, p.host, p.sni, p.interface
      ].map(csvEscape).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="traffic-${Date.now()}.csv"`);
    return res.send(rows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

async function connectMongo() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    mongoConnected = true;
    console.log('MongoDB connected');
  } catch (error) {
    mongoConnected = false;
    console.warn(`MongoDB unavailable: ${error.message}`);
    console.warn('Live packet capture will still work; database persistence is disabled until MongoDB is available.');
  }
}

async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down...`);
  clearInterval(dbFlushTimer);
  await flushDatabaseQueue();
  captureManager.stop();
  await mongoose.disconnect().catch(() => {});
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await connectMongo();

httpServer.listen(PORT, () => {
  console.log(`Traffic Analyser backend: http://localhost:${PORT}`);
  console.log(`TShark: ${TSHARK_PATH}`);
  console.log(`Capture filter: ${CAPTURE_FILTER}`);
  console.log(`Default interface: ${CAPTURE_INTERFACE || 'auto-detect'}`);
});
