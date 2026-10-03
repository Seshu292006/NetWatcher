# Traffic Analyser — Wireshark-style MERN application

A local full-stack traffic analyser using React/Vite, Node/Express, Socket.IO, MongoDB, and TShark.

## Features

- Live IPv4 + IPv6 packet capture through TShark/libpcap
- Inbound/outbound/local/unknown direction classification
- Live download/upload rate and packets/sec
- Live traffic graph
- Packet inspector with search and filters
- Packet detail drawer
- MongoDB packet history when MongoDB is available
- CSV and JSON export
- CSV and JSON packet export for analysis and archiving
- Capture test before starting
- Automatic Socket.IO reconnection
- Frontend remains usable when backend or MongoDB is temporarily unavailable

## Requirements

- Node.js 18+
- MongoDB (optional for live capture, required for persistent history/export)
- Wireshark/TShark with working packet-capture permissions

On Arch Linux:

```bash
sudo pacman -S wireshark-cli
sudo gpasswd -a $USER wireshark
```

Log out/in, or run `newgrp wireshark` for the current shell.

Verify capture before starting the app:

```bash
tshark -D
tshark -i wlan0 -c 5
dumpcap -i wlan0 -c 5
```

Do not run the Node server with `sudo`. Configure capture permissions through Wireshark/dumpcap.

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Default backend: `http://localhost:5000`

The default capture filter is:

```text
ip or ip6
```

This is intentionally a libpcap capture filter. Do not change `ip6` to `ipv6`.

## Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## MongoDB

Default URI:

```text
mongodb://127.0.0.1:27017/traffic_analyser
```

If MongoDB is unavailable, live TShark capture still works. Packets are kept in the live UI but are not persisted until MongoDB is available.

## Capture flow

```text
Network interface
      ↓
   libpcap
      ↓
    TShark
      ├── packet fields → Node.js → Socket.IO → React
      └── packet metadata → MongoDB
```

The app captures packet metadata. HTTPS/TLS payload contents remain encrypted unless you separately configure decryption keys and an appropriate Wireshark workflow.
