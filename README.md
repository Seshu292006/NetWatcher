# ⚡ Traffic Analyser

> A real-time network traffic monitoring and packet analysis web application inspired by tools like Wireshark.

**Traffic Analyser** is a full-stack web application designed to monitor inbound and outbound network traffic from a system in real time. It provides a modern dashboard for observing network activity, packet information, IP addresses, traffic speed, and live traffic flow.

The application combines a **React-based frontend**, **Node.js/Express backend**, and **MongoDB database** to create a complete network monitoring platform.

---

## 🚀 Features

### 📡 Real-Time Traffic Monitoring

- Monitor inbound and outbound network traffic.
- Capture network packets in real time.
- Display packet information as it arrives.
- Continuously update the dashboard without refreshing the page.
- Distinguish between incoming and outgoing traffic.

### 🌐 IP Address Monitoring

- Detect source and destination IP addresses.
- Separate inbound and outbound IP traffic.
- Display IP addresses in the dashboard.
- Store observed IP addresses in the backend for later inspection.

### 📊 Live Traffic Graph

The dashboard provides a real-time visualization of network activity.

It can display:

- Download / inbound traffic
- Upload / outbound traffic
- Traffic rate
- Packet activity
- Network activity over time

### ⚡ Network Speed Monitoring

Monitor current traffic speed including:

- ⬇️ Download speed
- ⬆️ Upload speed
- Packet rate
- Total traffic volume

### 📦 Packet Information

The application can expose useful packet-level information such as:

- Timestamp
- Source IP
- Destination IP
- Protocol
- Source port
- Destination port
- Packet size
- Traffic direction

### 💾 Traffic History

Important network information can be stored in MongoDB so that previously observed traffic can be inspected later.

### 🖥️ Modern Dashboard

The frontend is designed with a dark network-monitoring aesthetic:

- Black / dark background
- Light-blue accent colors
- Responsive dashboard
- Live statistics
- Traffic graphs
- Packet tables
- Network activity indicators

---

# 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │       Browser       │
                         │                     │
                         │   React Dashboard   │
                         └──────────┬──────────┘
                                    │
                                    │ HTTP / WebSocket
                                    ▼
                         ┌─────────────────────┐
                         │    Node.js Server   │
                         │      Express        │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
        ┌────────────────┐ ┌────────────────┐ ┌─────────────────┐
        │ Packet Capture │ │ Traffic Engine │ │ REST / Realtime │
        │    Layer       │ │   & Analysis   │ │      API        │
        └────────┬───────┘ └────────────────┘ └─────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Network Interface  │
        │   / OS Packets     │
        └────────────────────┘

                         │
                         ▼

                ┌───────────────────┐
                │      MongoDB      │
                │                   │
                │ Traffic / IP Data │
                └───────────────────┘
```

---

# 🧰 Technology Stack

## Frontend

| Technology       | Purpose                         |
| ---------------- | ------------------------------- |
| React            | User interface                  |
| JavaScript       | Application logic               |
| HTML5            | Application structure           |
| CSS3             | Styling and responsive UI       |
| Charting library | Real-time traffic visualization |

## Backend

| Technology             | Purpose                 |
| ---------------------- | ----------------------- |
| Node.js                | Runtime environment     |
| Express.js             | REST API server         |
| Packet capture library | Network packet capture  |
| WebSocket / Socket.IO  | Real-time communication |
| JavaScript             | Backend logic           |

## Database

| Technology | Purpose                 |
| ---------- | ----------------------- |
| MongoDB    | Persistent traffic data |
| Mongoose   | MongoDB object modeling |

## Development Tools

- npm
- Nodemon
- Git
- GitHub
- Wireshark-style packet filtering concepts

---

# 📁 Project Structure

```text
traffic-analyser-wireshark/
│
├── backend/
│   │
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── utils/
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── .env
│
├── frontend/
│   │
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
├── README.md
└── LICENSE
```

> The exact folder structure may vary slightly depending on the implementation.

---

# ⚙️ Requirements

Before running the project, install:

- **Node.js** 18+
- **npm**
- **MongoDB**
- A supported network interface
- Administrative/root privileges where required by the packet-capture library

Check your installations:

```bash
node --version
npm --version
mongosh --version
```

---

# 🔧 Installation

## 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/traffic-analyser-wireshark.git
```

Move into the project:

```bash
cd traffic-analyser-wireshark
```

---

# 🖥️ Backend Setup

Move into the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/traffic_analyser
```

Then start the backend:

```bash
npm run dev
```

For production:

```bash
npm start
```

The backend should become available at:

```text
http://localhost:5000
```

---

# 🎨 Frontend Setup

Open another terminal.

Move into the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

Open the displayed URL in your browser.

---

# 🔐 Packet Capture Permissions

Network packet capture generally requires elevated privileges depending on the operating system and capture library.

### Linux

You may need:

```bash
sudo npm run dev
```

or configure the packet-capture utility with the appropriate capabilities instead of running the entire application as root.

### macOS

Depending on the capture mechanism and interface permissions, administrator privileges or appropriate packet-capture permissions may be required.

### Windows

Packet capture typically requires a supported packet-capture driver such as **Npcap**.

Install Npcap and make sure the required network interface is available to the capture library.

---

# 🌐 Capture Filter

The project captures IP traffic using an IP-level filter.

The default capture expression is conceptually:

```text
ip or ip6
```

This allows the application to observe both:

- IPv4 traffic
- IPv6 traffic

The filtering layer can be extended later to support protocol-specific filtering such as:

```text
tcp
udp
icmp
dns
http
https
```

---

# 📊 Dashboard

The dashboard is designed around several key monitoring areas.

### Network Overview

Displays high-level information such as:

```text
┌─────────────────────────────────────────────┐
│             NETWORK OVERVIEW                │
├─────────────────────────────────────────────┤
│                                             │
│  ↓ Download       ↑ Upload       Packets    │
│   12.4 MB/s        2.8 MB/s       8,421     │
│                                             │
└─────────────────────────────────────────────┘
```

### Live Traffic

The graph continuously represents network activity:

```text
Traffic
  │
  │        ╭──╮
  │    ╭───╯  ╰──╮
  │ ───╯         ╰────╮
  │                    ╰──
  └──────────────────────────► Time
```

### Packet Monitor

A packet table can contain information similar to:

| Time     | Source       | Destination  | Protocol |   Size |
| -------- | ------------ | ------------ | -------- | -----: |
| 12:41:02 | 192.168.1.10 | 142.250.x.x  | TCP      | 1.2 KB |
| 12:41:03 | 142.250.x.x  | 192.168.1.10 | TCP      | 3.8 KB |
| 12:41:04 | 192.168.1.10 | 8.8.8.8      | UDP      |  512 B |

---

# 🔄 Data Flow

The application follows this general pipeline:

```text
Network Interface
       │
       ▼
Packet Capture
       │
       ▼
Packet Parser
       │
       ▼
Traffic Classification
       │
       ├───────────────┐
       │               │
       ▼               ▼
Inbound           Outbound
Traffic           Traffic
       │               │
       └───────┬───────┘
               ▼
        Traffic Statistics
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
   Live Client       MongoDB
       │                │
       ▼                ▼
   Dashboard        History
```

---

# 🔌 API

The backend exposes API endpoints for interacting with traffic information.

Typical endpoint structure:

```text
GET /api/traffic
GET /api/traffic/inbound
GET /api/traffic/outbound
GET /api/ip
GET /api/ip/inbound
GET /api/ip/outbound
```

The exact endpoints depend on the current backend implementation.

---

# ⚡ Real-Time Communication

For live monitoring, the frontend receives traffic updates from the backend without requiring continuous page refreshes.

Conceptually:

```text
Packet Captured
      │
      ▼
Backend Processing
      │
      ▼
Traffic Event
      │
      ▼
WebSocket / Socket.IO
      │
      ▼
React Dashboard
      │
      ├── Update graph
      ├── Update speed
      ├── Update counters
      └── Update packet table
```

This architecture allows the interface to behave like a live network monitoring console.

---

# 🗄️ Database

MongoDB stores persistent network information.

Example traffic document:

```json
{
  "timestamp": "2026-10-03T17:30:00.000Z",
  "sourceIp": "192.168.1.10",
  "destinationIp": "8.8.8.8",
  "protocol": "UDP",
  "sourcePort": 54321,
  "destinationPort": 53,
  "packetSize": 512,
  "direction": "outbound"
}
```

The database structure can be extended with additional metadata as the project evolves.

---

# 🧪 Development

Start backend development server:

```bash
cd backend
npm run dev
```

Start frontend development server:

```bash
cd frontend
npm run dev
```

For a clean reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

> On Windows, remove `node_modules` and `package-lock.json` manually or use an equivalent command.

---

# 🛡️ Security Considerations

Traffic monitoring is a privileged operation.

This project should only be used on systems and networks where you have authorization to inspect network traffic.

Important considerations:

- Do not capture traffic on networks without permission.
- Avoid storing sensitive payload information unnecessarily.
- Protect stored IP addresses and traffic metadata.
- Do not expose the monitoring API publicly without authentication.
- Use environment variables for secrets.
- Never commit `.env` files.
- Restrict MongoDB access.
- Consider HTTPS for production deployments.
- Apply authentication and authorization before exposing monitoring functionality beyond localhost.

---

# 🚫 Sensitive Data

Packet captures can contain sensitive information.

Depending on the capture implementation, network traffic may reveal:

- IP addresses
- DNS requests
- Connection metadata
- Ports
- Protocol information
- Potentially sensitive application data

This project should therefore be treated as a **security-sensitive monitoring application**.

For production use, consider:

```text
Data minimization
       ↓
Filtering
       ↓
Anonymization
       ↓
Access control
       ↓
Encryption
       ↓
Audit logging
```

---

# 🧠 Project Goals

The project was created to explore how a modern web application can combine:

- Network programming
- Packet analysis
- Full-stack development
- Real-time data processing
- Data visualization
- Database persistence
- REST APIs
- WebSockets
- System-level networking

Rather than simply displaying static information, the application creates a bridge between **low-level network activity** and a **high-level web interface**.

---

# 🛣️ Roadmap

Future versions can introduce:

- [ ] Advanced packet filtering
- [ ] TCP stream analysis
- [ ] UDP traffic analysis
- [ ] DNS monitoring
- [ ] HTTP/HTTPS metadata analysis
- [ ] Protocol distribution charts
- [ ] Per-application traffic detection
- [ ] Network interface selector
- [ ] Historical traffic analytics
- [ ] Traffic export to CSV
- [ ] PCAP export
- [ ] Dark/light theme switching
- [ ] User authentication
- [ ] Role-based access control
- [ ] Network anomaly detection
- [ ] Traffic alerts
- [ ] Bandwidth threshold notifications
- [ ] GeoIP visualization
- [ ] Docker deployment
- [ ] Production deployment
- [ ] Automated testing
- [ ] Performance monitoring

---

# 🔬 Educational Value

This project provides practical experience with several layers of modern computing:

```text
┌─────────────────────────────┐
│       User Interface        │
│        React / CSS          │
├─────────────────────────────┤
│      Real-Time Layer        │
│     WebSocket / Events      │
├─────────────────────────────┤
│       Backend Layer         │
│      Node.js / Express      │
├─────────────────────────────┤
│      Data Processing        │
│   Packet Parsing / Metrics  │
├─────────────────────────────┤
│       Network Layer         │
│      TCP / UDP / IP         │
├─────────────────────────────┤
│        Operating System     │
│     Network Interfaces      │
└─────────────────────────────┘
```

The project therefore demonstrates how data can travel from a physical/network interface all the way to a browser-based visualization.

---

# 🐛 Troubleshooting

## Backend does not start

Check:

```bash
node --version
npm --version
```

Then reinstall dependencies:

```bash
npm install
```

Check that the configured port is not already being used.

---

## MongoDB connection fails

Make sure MongoDB is running.

Verify your `.env` configuration:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/traffic_analyser
```

Then restart the backend.

---

## No packets appear

Check:

1. The correct network interface is available.
2. Packet capture permissions are configured.
3. The capture library is installed correctly.
4. The operating system allows packet capture.
5. The capture filter is valid.
6. The backend is actually receiving packets.

---

## Frontend shows a blank screen

Check the browser developer console.

Then verify:

```text
Frontend
   │
   ├── React application loaded
   ├── API URL is correct
   └── Backend is running
```

Also check the terminal for build/runtime errors.

---

# 🤝 Contributing

Contributions are welcome.

### 1. Fork the repository

```bash
git clone https://github.com/YOUR_USERNAME/traffic-analyser-wireshark.git
```

### 2. Create a feature branch

```bash
git checkout -b feature/my-feature
```

### 3. Make your changes

Implement and test the feature.

### 4. Commit

```bash
git add .
git commit -m "feat: add network traffic feature"
```

### 5. Push

```bash
git push origin feature/my-feature
```

### 6. Open a Pull Request

Describe:

- What changed
- Why it changed
- How it was tested
- Any limitations

---

# 📜 License

This project is released under the **MIT License** unless otherwise specified.

See [`LICENSE`](LICENSE) for details.

---

# 👨‍💻 Author

**Your Name**

GitHub: `https://github.com/YOUR_USERNAME`

---

# ⭐ Support

If you find this project useful:

⭐ Star the repository
🍴 Fork the project
🐛 Report issues
💡 Suggest improvements
🤝 Contribute

---

# 📌 Disclaimer

Traffic Analyser is intended for **authorized network monitoring, learning, development, and security research**.

Only capture or inspect network traffic on systems and networks where you have appropriate permission.

The developers are not responsible for misuse of this software.

---

## ⚡ Final Overview

Traffic Analyser transforms raw network activity into an interactive monitoring experience:

```text
                RAW NETWORK TRAFFIC
                         │
                         ▼
                 ┌───────────────┐
                 │ Packet Capture│
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Packet Parser │
                 └───────┬───────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Traffic Classification│
              └──────────┬───────────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
        INBOUND TRAFFIC        OUTBOUND TRAFFIC
             │                       │
             └───────────┬───────────┘
                         ▼
                  REAL-TIME ENGINE
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        React Dashboard          MongoDB
              │                     │
              ▼                     ▼
        Live Visualization      History
```

**Traffic Analyser — turning packets into insight. ⚡**
