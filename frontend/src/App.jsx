import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Cable,
  ChevronRight,
  CircleStop,
  FileJson,
  FileText,
  Filter,
  Gauge,
  Network,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wifi,
  X
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const MAX_LIVE_PACKETS = 1000;
const MAX_GRAPH_POINTS = 60;

function formatBytes(value = 0) {
  if (!Number.isFinite(value)) return '0 B';
  if (value < 1024) return `${value.toFixed(0)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatRate(value = 0) {
  return `${formatBytes(value)}/s`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], { hour12: false });
}

function safePacketList(value) {
  return Array.isArray(value) ? value : [];
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [packets, setPackets] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [selectedInterface, setSelectedInterface] = useState('');
  const [capture, setCapture] = useState({
    running: false,
    interface: '',
    filter: 'ip or ip6',
    error: '',
    packetsCaptured: 0,
  });
  const [speed, setSpeed] = useState({ download: 0, upload: 0, packetsPerSecond: 0 });
  const [graph, setGraph] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [selectedPacket, setSelectedPacket] = useState(null);
  const socketRef = useRef(null);

  const loadInterfaces = useCallback(async () => {
    setLoadingInterfaces(true);
    try {
      const response = await fetch(`${API_URL}/api/interfaces`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list = Array.isArray(data?.interfaces) ? data.interfaces : [];
      setInterfaces(list);
      if (!selectedInterface && list.length) {
        const preferred = list.find(item => item.name !== 'any' && !/loopback/i.test(`${item.name} ${item.description || ''}`));
        setSelectedInterface(preferred?.id || list[0].id);
      }
    } catch (error) {
      console.error('[UI] Interface load failed:', error);
    } finally {
      setLoadingInterfaces(false);
    }
  }, []);

  const loadInitialPackets = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/packets?limit=500`);
      if (!response.ok) return;
      const data = await response.json();
      setPackets(safePacketList(data?.packets));
    } catch (error) {
      console.warn('[UI] Packet history unavailable:', error.message);
    }
  }, []);

  const checkBackend = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      setBackendOnline(response.ok);
      if (response.ok) {
        const data = await response.json();
        if (data?.capture) setCapture(prev => ({ ...prev, ...data.capture }));
      }
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    loadInterfaces();
    loadInitialPackets();
    checkBackend();

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      setBackendOnline(true);
    });

    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on('capture:status', status => {
      if (status && typeof status === 'object') setCapture(prev => ({ ...prev, ...status }));
    });

    socket.on('packets:snapshot', incoming => {
      setPackets(safePacketList(incoming).slice(0, MAX_LIVE_PACKETS));
    });

    socket.on('packet:new', packet => {
      if (!packet || typeof packet !== 'object') return;
      setPackets(prev => [packet, ...safePacketList(prev)].slice(0, MAX_LIVE_PACKETS));
    });

    socket.on('packets:cleared', () => setPackets([]));

    socket.on('traffic:speed', value => {
      const next = {
        download: Number(value?.download) || 0,
        upload: Number(value?.upload) || 0,
        packetsPerSecond: Number(value?.packetsPerSecond) || 0
      };
      setSpeed(next);
      setGraph(prev => [
        ...prev,
        { time: formatTime(value?.timestamp || Date.now()), download: next.download, upload: next.upload }
      ].slice(-MAX_GRAPH_POINTS));
    });

    const healthTimer = setInterval(checkBackend, 5000);
    return () => {
      clearInterval(healthTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [checkBackend, loadInitialPackets, loadInterfaces]);

  const startCapture = async () => {
    if (!selectedInterface) return;
    setActionBusy(true);
    setCapture(prev => ({ ...prev, error: '' }));
    try {
      const response = await fetch(`${API_URL}/api/capture/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interfaceId: selectedInterface })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setCapture(prev => ({ ...prev, running: true, interface: data.interface || selectedInterface, filter: data.filter || 'ip or ip6', error: '' }));
    } catch (error) {
      setCapture(prev => ({ ...prev, running: false, error: error.message }));
    } finally {
      setActionBusy(false);
    }
  };

  const stopCapture = async () => {
    setActionBusy(true);
    try {
      await fetch(`${API_URL}/api/capture/stop`, { method: 'POST' });
    } catch (error) {
      setCapture(prev => ({ ...prev, error: error.message }));
    } finally {
      setActionBusy(false);
    }
  };

  const testCapture = async () => {
    if (!selectedInterface) return;
    setTesting(true);
    setCapture(prev => ({ ...prev, error: '' }));
    try {
      const response = await fetch(`${API_URL}/api/capture/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interfaceId: selectedInterface })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setCapture(prev => ({ ...prev, error: '' }));
      window.alert(`Capture test passed on ${data.interface}.`);
    } catch (error) {
      setCapture(prev => ({ ...prev, error: error.message }));
    } finally {
      setTesting(false);
    }
  };

  const clearPackets = async () => {
    if (!window.confirm('Clear all stored packet history?')) return;
    try {
      const response = await fetch(`${API_URL}/api/packets`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to clear packets');
      setPackets([]);
    } catch (error) {
      setCapture(prev => ({ ...prev, error: error.message }));
    }
  };

  const filteredPackets = useMemo(() => {
    const list = safePacketList(packets);
    const query = search.trim().toLowerCase();
    return list.filter(packet => {
      if (directionFilter !== 'all' && packet.direction !== directionFilter) return false;
      if (protocolFilter !== 'all' && packet.protocol !== protocolFilter) return false;
      if (!query) return true;
      return [packet.sourceIp, packet.destinationIp, packet.protocol, packet.transport, packet.host, packet.sni, packet.connectionInfo]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });
  }, [packets, search, directionFilter, protocolFilter]);

  const protocols = useMemo(() => {
    const values = new Set(safePacketList(packets).map(packet => packet.protocol).filter(Boolean));
    return [...values].sort();
  }, [packets]);

  const inboundTotal = useMemo(() => safePacketList(packets).filter(p => p.direction === 'inbound').reduce((sum, p) => sum + (Number(p.length) || 0), 0), [packets]);
  const outboundTotal = useMemo(() => safePacketList(packets).filter(p => p.direction === 'outbound').reduce((sum, p) => sum + (Number(p.length) || 0), 0), [packets]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Activity size={20} /></div>
          <div><strong>Traffic</strong><span>Analyser</span></div>
        </div>

        <div className="nav-group">
          <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('dashboard')}>
            <Gauge size={18} /> Dashboard
          </button>
          <button className={page === 'packets' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('packets')}>
            <Network size={18} /> Packet Inspector
          </button>
        </div>

        <div className="sidebar-status">
          <div className="status-title">SYSTEM</div>
          <div className="status-row"><span className={backendOnline ? 'dot online' : 'dot'} /> Backend {backendOnline ? 'online' : 'offline'}</div>
          <div className="status-row"><span className={socketConnected ? 'dot online' : 'dot'} /> Live stream {socketConnected ? 'connected' : 'waiting'}</div>
          <div className="status-row"><span className={capture.running ? 'dot capture' : 'dot'} /> Capture {capture.running ? 'running' : 'stopped'}</div>
        </div>

        <div className="sidebar-footer">TShark packet monitor<br />Local machine traffic</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">NETWORK MONITOR</div>
            <h1>{page === 'dashboard' ? 'Traffic overview' : 'Packet inspector'}</h1>
          </div>
          <div className="top-actions">
            <span className={backendOnline ? 'connection-pill good' : 'connection-pill bad'}>
              <span className="dot" /> {backendOnline ? 'Backend online' : 'Backend offline'}
            </span>
            <button className="icon-button" title="Refresh" onClick={() => { loadInterfaces(); checkBackend(); loadInitialPackets(); }}><RefreshCw size={17} /></button>
          </div>
        </header>

        {capture.error && (
          <div className="error-banner">
            <div><strong>Capture error</strong><span>{capture.error}</span></div>
            <button onClick={() => setCapture(prev => ({ ...prev, error: '' }))}><X size={16} /></button>
          </div>
        )}

        {page === 'dashboard' ? (
          <Dashboard
            capture={capture}
            interfaces={interfaces}
            selectedInterface={selectedInterface}
            setSelectedInterface={setSelectedInterface}
            loadingInterfaces={loadingInterfaces}
            testing={testing}
            actionBusy={actionBusy}
            testCapture={testCapture}
            startCapture={startCapture}
            stopCapture={stopCapture}
            speed={speed}
            graph={graph}
            packets={packets}
            inboundTotal={inboundTotal}
            outboundTotal={outboundTotal}
            setPage={setPage}
          />
        ) : (
          <PacketInspector
            packets={filteredPackets}
            allPackets={packets}
            search={search}
            setSearch={setSearch}
            directionFilter={directionFilter}
            setDirectionFilter={setDirectionFilter}
            protocolFilter={protocolFilter}
            setProtocolFilter={setProtocolFilter}
            protocols={protocols}
            selectedPacket={selectedPacket}
            setSelectedPacket={setSelectedPacket}
            clearPackets={clearPackets}
          />
        )}
      </main>
    </div>
  );
}

function Dashboard({ capture, interfaces, selectedInterface, setSelectedInterface, loadingInterfaces, testing, actionBusy, testCapture, startCapture, stopCapture, speed, graph, packets, inboundTotal, outboundTotal, setPage }) {
  return (
    <div className="page-content">
      <section className="control-panel panel">
        <div className="control-heading">
          <div className="panel-icon"><Wifi size={18} /></div>
          <div><strong>Capture interface</strong><span>Choose the network adapter to inspect</span></div>
        </div>
        <div className="capture-controls">
          <select value={selectedInterface} onChange={e => setSelectedInterface(e.target.value)} disabled={capture.running || loadingInterfaces}>
            <option value="">{loadingInterfaces ? 'Loading interfaces...' : 'Select interface'}</option>
            {interfaces.map(item => <option key={item.id} value={item.id}>{item.id} — {item.name}{item.description ? ` (${item.description})` : ''}</option>)}
          </select>
          <button className="button secondary" onClick={testCapture} disabled={!selectedInterface || testing || capture.running}>
            <ShieldCheck size={16} /> {testing ? 'Testing...' : 'Test capture'}
          </button>
          {!capture.running ? (
            <button className="button primary" onClick={startCapture} disabled={!selectedInterface || actionBusy}><Play size={16} /> {actionBusy ? 'Starting...' : 'Start capture'}</button>
          ) : (
            <button className="button danger" onClick={stopCapture} disabled={actionBusy}><CircleStop size={16} /> Stop capture</button>
          )}
        </div>
        <div className="capture-meta">
          <span>Filter: <code>{capture.filter || 'ip or ip6'}</code></span>
          <span>{capture.running ? `Capturing on ${capture.interface}` : 'Capture stopped'}</span>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard icon={<ArrowDownToLine size={18} />} label="Download" value={formatRate(speed.download)} tone="cyan" />
        <MetricCard icon={<ArrowUpFromLine size={18} />} label="Upload" value={formatRate(speed.upload)} tone="blue" />
        <MetricCard icon={<Activity size={18} />} label="Packets / sec" value={(speed.packetsPerSecond || 0).toFixed(1)} tone="violet" />
        <MetricCard icon={<Network size={18} />} label="Captured" value={String(capture.packetsCaptured || packets.length || 0)} tone="green" />
      </section>

      <section className="content-grid">
        <div className="panel graph-panel">
          <div className="panel-header"><div><h2>Traffic flow</h2><span>Live throughput over the last minute</span></div><div className="legend"><span><i className="legend-dot cyan" /> Download</span><span><i className="legend-dot blue" /> Upload</span></div></div>
          <div className="chart-wrap">
            {graph.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graph}>
                  <defs>
                    <linearGradient id="downloadFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27d7ff" stopOpacity={0.26} /><stop offset="100%" stopColor="#27d7ff" stopOpacity={0} /></linearGradient>
                    <linearGradient id="uploadFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4e83ff" stopOpacity={0.2} /><stop offset="100%" stopColor="#4e83ff" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#172738" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: '#60758b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis tick={{ fill: '#60758b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatBytes(v)} width={58} />
                  <Tooltip contentStyle={{ background: '#0b1521', border: '1px solid #1c3248', borderRadius: 10 }} formatter={value => formatRate(Number(value))} />
                  <Area type="monotone" dataKey="download" stroke="#27d7ff" fill="url(#downloadFill)" strokeWidth={2} isAnimationActive={false} />
                  <Area type="monotone" dataKey="upload" stroke="#4e83ff" fill="url(#uploadFill)" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<BarChart3 size={25} />} title="Waiting for traffic" text="Start a capture and generate some network activity." />
            )}
          </div>
        </div>

        <div className="panel summary-panel">
          <div className="panel-header"><div><h2>Session summary</h2><span>Current captured traffic</span></div></div>
          <div className="summary-list">
            <SummaryRow label="Inbound observed" value={formatBytes(inboundTotal)} icon={<ArrowDownToLine size={16} />} />
            <SummaryRow label="Outbound observed" value={formatBytes(outboundTotal)} icon={<ArrowUpFromLine size={16} />} />
            <SummaryRow label="Visible packets" value={packets.length.toLocaleString()} icon={<Activity size={16} />} />
            <SummaryRow label="Capture filter" value="IPv4 + IPv6" icon={<Filter size={16} />} />
          </div>
          <button className="wide-link" onClick={() => setPage('packets')}>Open packet inspector <ChevronRight size={15} /></button>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }) {
  return <div className="metric-card panel"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function SummaryRow({ label, value, icon }) {
  return <div className="summary-row"><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ icon, title, text }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><span>{text}</span></div>;
}

function PacketInspector({ packets, allPackets, search, setSearch, directionFilter, setDirectionFilter, protocolFilter, setProtocolFilter, protocols, selectedPacket, setSelectedPacket, clearPackets }) {
  return (
    <div className="page-content">
      <section className="panel inspector-toolbar">
        <div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IP, protocol, host, SNI..." /></div>
        <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)}><option value="all">All directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="local">Local</option><option value="unknown">Unknown</option></select>
        <select value={protocolFilter} onChange={e => setProtocolFilter(e.target.value)}><option value="all">All protocols</option>{protocols.map(protocol => <option key={protocol} value={protocol}>{protocol}</option>)}</select>
        <button className="button secondary" onClick={() => window.open(`${API_URL}/api/export/csv`, '_blank')}><FileText size={16} /> CSV</button>
        <button className="button secondary" onClick={() => window.open(`${API_URL}/api/export/json`, '_blank')}><FileJson size={16} /> JSON</button>
        <button className="icon-button danger-icon" title="Clear stored packets" onClick={clearPackets}><Trash2 size={17} /></button>
      </section>

      <section className="panel packet-panel">
        <div className="packet-header"><div><h2>Live packet stream</h2><span>{packets.length.toLocaleString()} shown · {allPackets.length.toLocaleString()} in memory</span></div><span className="live-badge"><span className="pulse" /> LIVE</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Dir</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Length</th><th>Info</th></tr></thead>
            <tbody>
              {packets.length ? packets.map((packet, index) => (
                <tr key={`${packet.epoch || packet.timestamp || index}-${index}`} onClick={() => setSelectedPacket(packet)}>
                  <td className="muted">{formatTime(packet.timestamp)}</td>
                  <td><DirectionBadge direction={packet.direction} /></td>
                  <td className="mono">{packet.sourceIp}{packet.sourcePort ? `:${packet.sourcePort}` : ''}</td>
                  <td className="mono">{packet.destinationIp}{packet.destinationPort ? `:${packet.destinationPort}` : ''}</td>
                  <td><span className="protocol-badge">{packet.protocol || 'IP'}</span></td>
                  <td>{Number(packet.length || 0).toLocaleString()} B</td>
                  <td className="info-cell">{packet.host || packet.sni || packet.connectionInfo || `${packet.sourceIp} → ${packet.destinationIp}`}</td>
                </tr>
              )) : <tr><td colSpan="7"><EmptyState icon={<Network size={25} />} title="No packets yet" text="Start capture and create some traffic." /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPacket && <PacketDrawer packet={selectedPacket} close={() => setSelectedPacket(null)} />}
    </div>
  );
}

function DirectionBadge({ direction }) {
  const label = direction || 'unknown';
  return <span className={`direction ${label}`}><span className="direction-arrow">{label === 'inbound' ? '↓' : label === 'outbound' ? '↑' : '•'}</span>{label}</span>;
}

function PacketDrawer({ packet, close }) {
  const rows = [
    ['Timestamp', new Date(packet.timestamp).toISOString()],
    ['Direction', packet.direction],
    ['Source IP', packet.sourceIp],
    ['Source port', packet.sourcePort ?? '—'],
    ['Destination IP', packet.destinationIp],
    ['Destination port', packet.destinationPort ?? '—'],
    ['Protocol', packet.protocol],
    ['Transport', packet.transport || '—'],
    ['Length', `${packet.length || 0} bytes`],
    ['TCP flags', packet.tcpFlags || '—'],
    ['HTTP host', packet.host || '—'],
    ['TLS SNI', packet.sni || '—'],
    ['Interface', packet.interface || '—']
  ];

  return <div className="drawer-backdrop" onClick={close}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">PACKET DETAIL</span><h2>{packet.protocol || 'IP'} packet</h2></div><button className="icon-button" onClick={close}><X size={17} /></button></div><div className="detail-grid">{rows.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}</div></aside></div>;
}

export default App;
