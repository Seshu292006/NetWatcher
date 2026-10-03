import { spawn, execFile } from 'child_process';
import readline from 'readline';
import util from 'util';

import { getLocalAddresses, classifyDirection } from './utils/localAddresses.js';

const execFileAsync = util.promisify(execFile);

const fields = [
  'frame.time_epoch',
  'frame.len',
  'ip.src',
  'ip.dst',
  'ipv6.src',
  'ipv6.dst',
  'tcp.srcport',
  'tcp.dstport',
  'udp.srcport',
  'udp.dstport',
  '_ws.col.Protocol',
  'ip.proto',
  'tcp.flags',
  'http.host',
  'tls.handshake.extensions_server_name'
];

function normalizeFilter(value) {
  const filter = String(value || 'ip or ip6').trim();
  return filter.replace(/\bipv6\b/gi, 'ip6');
}

export class CaptureManager {
  constructor({ tsharkPath = 'tshark', interfaceId = '', onPacket, onStatus, filter = 'ip or ip6' }) {
    this.tsharkPath = tsharkPath;
    this.interfaceId = interfaceId;
    this.onPacket = onPacket;
    this.onStatus = onStatus;
    this.filter = normalizeFilter(filter);
    this.process = null;
    this.running = false;
    this.localAddresses = new Set();
    this.lastError = '';
  }

  emitStatus(status = {}) {
    this.onStatus?.({
      running: this.running,
      interface: this.interfaceId,
      filter: this.filter,
      ...status
    });
  }

  async refreshLocalAddresses() {
    try {
      this.localAddresses = await getLocalAddresses();
      console.log(`[Capture] Local addresses: ${[...this.localAddresses].join(', ')}`);
    } catch (error) {
      console.error('[Capture] Local address discovery failed:', error.message);
      this.localAddresses = new Set();
    }
  }

  async checkTshark() {
    try {
      await execFileAsync(this.tsharkPath, ['-v'], { timeout: 10000, maxBuffer: 1024 * 1024 });
    } catch (error) {
      const message = error.stderr || error.stdout || error.message;
      throw new Error(`TShark is not available at "${this.tsharkPath}". ${message}`);
    }
  }

  async listInterfaces() {
    await this.checkTshark();

    try {
      const { stdout } = await execFileAsync(this.tsharkPath, ['-D'], {
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });

      return stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const match = line.match(/^(\d+)\.\s+(.+?)(?:\s+\((.*)\))?$/);
          if (!match) return { id: line, name: line, description: '' };
          return { id: match[1], name: match[2], description: match[3] || '' };
        });
    } catch (error) {
      throw new Error(`Unable to list TShark interfaces: ${error.stderr || error.message}`);
    }
  }

  async resolveInterface(requested) {
    const interfaces = await this.listInterfaces();
    if (!interfaces.length) throw new Error('TShark returned no capture interfaces.');

    if (requested) {
      const wanted = String(requested);
      const exact = interfaces.find(item => item.id === wanted || item.name === wanted);
      if (!exact) throw new Error(`Capture interface "${wanted}" was not found by TShark.`);
      return exact.name;
    }

    const usable = interfaces.find(item => {
      const text = `${item.name} ${item.description}`;
      return item.name !== 'any' && !/loopback/i.test(text) && !/remote capture/i.test(text);
    });

    return usable?.name || interfaces[0].name;
  }

  async testCapture(interfaceId = this.interfaceId) {
    const selected = await this.resolveInterface(interfaceId);
    await this.checkTshark();

    console.log(`[Capture] Testing capture on "${selected}"...`);

    try {
      await execFileAsync(this.tsharkPath, [
        '-i', selected,
        '-a', 'duration:2',
        '-Q',
        '-w', '/dev/null'
      ], {
        timeout: 5000,
        maxBuffer: 1024 * 1024
      });

      return {
        success: true,
        interface: selected,
        filter: this.filter,
        message: `TShark can capture on ${selected}.`
      };
    } catch (error) {
      const message = error.stderr || error.stdout || error.message;
      throw new Error(`TShark cannot capture on "${selected}": ${message}`);
    }
  }

  async start(interfaceId = this.interfaceId) {
    if (this.running) return;

    this.lastError = '';
    await this.checkTshark();
    await this.refreshLocalAddresses();

    const selectedInterface = await this.resolveInterface(interfaceId);
    this.interfaceId = selectedInterface;

    const args = [
      '-i', this.interfaceId,
      '-l',
      '-n',
      '-T', 'fields',
      '-E', 'separator=\t',
      '-E', 'quote=n',
      '-E', 'occurrence=f'
    ];

    for (const field of fields) args.push('-e', field);

    args.push('-f', this.filter);

    console.log('[Capture] Starting TShark:');
    console.log(`${this.tsharkPath} ${args.map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(' ')}`);

    this.process = spawn(this.tsharkPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.running = true;
    this.emitStatus({ running: true, error: '' });

    const stdout = readline.createInterface({ input: this.process.stdout, crlfDelay: Infinity });
    stdout.on('line', line => {
      try {
        const packet = this.parseLine(line, this.interfaceId);
        if (packet) this.onPacket?.(packet);
      } catch (error) {
        console.error('[Capture] Packet parse error:', error.message);
      }
    });

    const stderr = readline.createInterface({ input: this.process.stderr, crlfDelay: Infinity });
    stderr.on('line', line => {
      const message = line.trim();
      if (!message) return;
      console.error(`[TShark] ${message}`);

      const informational = /^(Capturing on|File:|Packets captured:|Packets received\/dropped)/i.test(message);
      if (!informational) {
        this.lastError = message;
        this.emitStatus({ error: message });
      }
    });

    this.process.on('error', error => {
      this.lastError = `Capture process error: ${error.message}`;
      this.running = false;
      this.emitStatus({ running: false, error: this.lastError });
      this.process = null;
    });

    this.process.on('close', (code, signal) => {
      console.log(`[Capture] TShark exited. code=${code}, signal=${signal}`);
      this.running = false;

      const normal = code === 0 || signal === 'SIGTERM' || signal === 'SIGINT';
      this.emitStatus({
        running: false,
        error: normal ? '' : (this.lastError || `TShark exited with code ${code}.`)
      });

      this.process = null;
    });
  }

  parseLine(line, interfaceId) {
    if (!line?.trim()) return null;

    const values = line.split('\t');
    while (values.length < fields.length) values.push('');

    const [
      epoch, frameLength,
      ipSrc, ipDst,
      ipv6Src, ipv6Dst,
      tcpSrc, tcpDst,
      udpSrc, udpDst,
      protocolColumn, ipProto,
      tcpFlags, host, sni
    ] = values;

    const sourceIp = ipSrc || ipv6Src || '';
    const destinationIp = ipDst || ipv6Dst || '';
    if (!sourceIp || !destinationIp) return null;

    let transport = '';
    if (tcpSrc || tcpDst) transport = 'TCP';
    else if (udpSrc || udpDst) transport = 'UDP';
    else if (ipProto === '1' || ipProto === '58') transport = 'ICMP';

    const sourcePort = Number(tcpSrc || udpSrc || 0) || undefined;
    const destinationPort = Number(tcpDst || udpDst || 0) || undefined;

    let protocol = protocolColumn || transport || 'IP';
    if (host) protocol = 'HTTP';

    const numericEpoch = Number(epoch);
    const timestamp = Number.isFinite(numericEpoch) ? new Date(numericEpoch * 1000) : new Date();

    return {
      timestamp,
      epoch: Number.isFinite(numericEpoch) ? numericEpoch : Date.now() / 1000,
      direction: classifyDirection(sourceIp, destinationIp, this.localAddresses),
      sourceIp,
      destinationIp,
      sourcePort,
      destinationPort,
      protocol,
      transport,
      length: Number(frameLength) || 0,
      tcpFlags: tcpFlags || '',
      connectionInfo: `${sourceIp}:${sourcePort || ''} → ${destinationIp}:${destinationPort || ''}`,
      host: host || '',
      sni: sni || '',
      interface: interfaceId
    };
  }

  stop() {
    if (!this.process) {
      this.running = false;
      this.emitStatus({ running: false, error: '' });
      return;
    }

    console.log('[Capture] Stopping TShark...');
    const process = this.process;
    this.running = false;
    this.process = null;

    try {
      process.kill('SIGTERM');
    } catch (error) {
      console.warn('[Capture] TShark stop:', error.message);
    }

    this.emitStatus({ running: false, error: '' });
  }
}
