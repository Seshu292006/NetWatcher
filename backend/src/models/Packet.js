import mongoose from 'mongoose';

const packetSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, index: true },
    epoch: { type: Number, index: true },
    direction: {
      type: String,
      enum: ['inbound', 'outbound', 'local', 'unknown'],
      default: 'unknown',
      index: true
    },
    sourceIp: { type: String, required: true, index: true },
    destinationIp: { type: String, required: true, index: true },
    sourcePort: Number,
    destinationPort: Number,
    protocol: { type: String, default: 'IP', index: true },
    transport: { type: String, default: '' },
    length: { type: Number, default: 0 },
    tcpFlags: { type: String, default: '' },
    connectionInfo: { type: String, default: '' },
    host: { type: String, default: '' },
    sni: { type: String, default: '' },
    interface: { type: String, default: '' }
  },
  { versionKey: false }
);

export default mongoose.model('Packet', packetSchema);
