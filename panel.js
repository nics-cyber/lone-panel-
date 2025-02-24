const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const supervisord = require('supervisord');
const { Client, Intents } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
const WorldEdit = require('worldedit');
const Chart = require('chart.js');
const pm2 = require('pm2');

const app = express();
const port = 3000;

// Middleware to serve static files and parse JSON
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./panel.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      balance INTEGER,
      role TEXT,
      twoFactorEnabled BOOLEAN
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      version TEXT,
      status TEXT,
      cpu INTEGER,
      ram INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serverId INTEGER,
      name TEXT,
      date TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      schedule TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      status TEXT,
      balance INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS economy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId INTEGER,
      transactionType TEXT,
      amount INTEGER,
      date TEXT
    )
  `);
}

// Initialize OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Initialize Discord bot
const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
discordClient.once('ready', () => {
  console.log('Discord bot is ready!');
});
discordClient.login(process.env.DISCORD_BOT_TOKEN);

// Initialize WorldEdit
const worldEdit = new WorldEdit();

// Initialize PM2 for performance monitoring
pm2.connect((err) => {
  if (err) {
    console.error('Error connecting to PM2:', err.message);
  } else {
    console.log('Connected to PM2.');
  }
});

// Black theme CSS
const blackTheme = `
  body { background-color: #000; color: #fff; font-family: Arial, sans-serif; }
  .server { background-color: #222; padding: 10px; margin: 10px; border-radius: 5px; }
  .addon { background-color: #333; padding: 10px; margin: 10px; border-radius: 5px; }
  .theme { background-color: #444; padding: 10px; margin: 10px; border-radius: 5px; }
`;

// Serve the frontend
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lonely Control Panel</title>
      <style>${blackTheme}</style>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
      <div class="container">
        <h1 class="text-center my-4">Lonely Control Panel</h1>
        <h2>Servers</h2>
        <div id="servers" class="row">
          ${servers.map(server => `
            <div class="col-md-4 mb-4">
              <div class="card server">
                <div class="card-body">
                  <h3 class="card-title">${server.name} (${server.type})</h3>
                  <p class="card-text">Status: ${server.status}</p>
                  <p class="card-text">Version: ${server.version}</p>
                  <p class="card-text">Resources: CPU ${server.resources.cpu}%, RAM ${server.resources.ram}MB</p>
                  <button class="btn btn-primary" onclick="startServer('${server.id}')">Start</button>
                  <button class="btn btn-danger" onclick="stopServer('${server.id}')">Stop</button>
                  <button class="btn btn-secondary" onclick="backupServer('${server.id}')">Backup</button>
                  <button class="btn btn-warning" onclick="changeVersion('${server.id}')">Change Version</button>
                  <button class="btn btn-info" onclick="adjustResources('${server.id}')">Adjust Resources</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Addons</h2>
        <div id="addons" class="row">
          ${addons.map(addon => `
            <div class="col-md-4 mb-4">
              <div class="card addon">
                <div class="card-body">
                  <h3 class="card-title">${addon.name} - $${addon.price}</h3>
                  <p class="card-text">${addon.description}</p>
                  <button class="btn btn-success" onclick="installAddon('${addon.id}')">Install</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Themes</h2>
        <div id="themes" class="row">
          ${themes.map(theme => `
            <div class="col-md-4 mb-4">
              <div class="card theme">
                <div class="card-body">
                  <h3 class="card-title">${theme.name} - $${theme.price}</h3>
                  <p class="card-text">${theme.description}</p>
                  <button class="btn btn-success" onclick="purchaseTheme('${theme.id}')">Purchase</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Backups</h2>
        <div id="backups" class="row">
          ${backups.map(backup => `
            <div class="col-md-4 mb-4">
              <div class="card backup">
                <div class="card-body">
                  <h3 class="card-title">${backup.name}</h3>
                  <p class="card-text">${backup.date}</p>
                  <button class="btn btn-warning" onclick="restoreBackup('${backup.id}')">Restore</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Databases</h2>
        <div id="databases" class="row">
          ${databases.map(db => `
            <div class="col-md-4 mb-4">
              <div class="card database">
                <div class="card-body">
                  <h3 class="card-title">${db.name}</h3>
                  <p class="card-text">Type: ${db.type}</p>
                  <button class="btn btn-info" onclick="manageDatabase('${db.id}')">Manage</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Tasks</h2>
        <div id="tasks" class="row">
          ${tasks.map(task => `
            <div class="col-md-4 mb-4">
              <div class="card task">
                <div class="card-body">
                  <h3 class="card-title">${task.name}</h3>
                  <p class="card-text">Schedule: ${task.schedule}</p>
                  <button class="btn btn-primary" onclick="runTask('${task.id}')">Run Now</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Players</h2>
        <div id="players" class="row">
          ${players.map(player => `
            <div class="col-md-4 mb-4">
              <div class="card player">
                <div class="card-body">
                  <h3 class="card-title">${player.name}</h3>
                  <p class="card-text">Status: ${player.status}</p>
                  <p class="card-text">Balance: $${player.balance}</p>
                  <button class="btn btn-danger" onclick="kickPlayer('${player.id}')">Kick</button>
                  <button class="btn btn-danger" onclick="banPlayer('${player.id}')">Ban</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>Logs</h2>
        <div id="logs" class="row">
          ${logs.map(log => `
            <div class="col-md-12 mb-4">
              <div class="card log">
                <div class="card-body">
                  <p class="card-text">${log.message}</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <h2>AI Suggestions</h2>
        <div id="ai-suggestions" class="row">
          <div class="col-md-12 mb-4">
            <button class="btn btn-primary" onclick="getAISuggestions()">Get AI Suggestions</button>
            <div id="ai-suggestions-output" class="mt-3"></div>
          </div>
        </div>
        <h2>World Editing</h2>
        <div id="world-editing" class="row">
          <div class="col-md-12 mb-4">
            <button class="btn btn-primary" onclick="openWorldEditor()">Open World Editor</button>
          </div>
        </div>
        <h2>Player Analytics</h2>
        <div id="player-analytics" class="row">
          <div class="col-md-12 mb-4">
            <canvas id="playerChart" width="400" height="200"></canvas>
          </div>
        </div>
        <h2>Economy System</h2>
        <div id="economy" class="row">
          <div class="col-md-12 mb-4">
            <button class="btn btn-success" onclick="addFunds()">Add Funds</button>
            <button class="btn btn-danger" onclick="removeFunds()">Remove Funds</button>
          </div>
        </div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        async function startServer(id) {
          const response = await fetch('/servers/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function stopServer(id) {
          const response = await fetch('/servers/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function installAddon(id) {
          const response = await fetch('/addons/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function purchaseTheme(id) {
          const response = await fetch('/themes/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function backupServer(id) {
          const response = await fetch('/backups/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function restoreBackup(id) {
          const response = await fetch('/backups/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function changeVersion(id) {
          const version = prompt('Enter new version:');
          if (version) {
            const response = await fetch('/servers/change-version', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, version })
            });
            const result = await response.json();
            alert(result.message);
          }
        }
        async function adjustResources(id) {
          const cpu = prompt('Enter new CPU allocation (%):');
          const ram = prompt('Enter new RAM allocation (MB):');
          if (cpu && ram) {
            const response = await fetch('/servers/adjust-resources', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, cpu, ram })
            });
            const result = await response.json();
            alert(result.message);
          }
        }
        async function manageDatabase(id) {
          const response = await fetch('/databases/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function runTask(id) {
          const response = await fetch('/tasks/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function kickPlayer(id) {
          const response = await fetch('/players/kick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function banPlayer(id) {
          const response = await fetch('/players/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const result = await response.json();
          alert(result.message);
        }
        async function getAISuggestions() {
          const response = await fetch('/ai/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const result = await response.json();
          document.getElementById('ai-suggestions-output').innerText = result.message;
        }
        async function openWorldEditor() {
          const response = await fetch('/world/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const result = await response.json();
          alert(result.message);
        }
        async function addFunds() {
          const playerId = prompt('Enter player ID:');
          const amount = prompt('Enter amount:');
          if (playerId && amount) {
            const response = await fetch('/economy/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId, amount })
            });
            const result = await response.json();
            alert(result.message);
          }
        }
        async function removeFunds() {
          const playerId = prompt('Enter player ID:');
          const amount = prompt('Enter amount:');
          if (playerId && amount) {
            const response = await fetch('/economy/remove', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId, amount })
            });
            const result = await response.json();
            alert(result.message);
          }
        }
        // Player Analytics Chart
        const ctx = document.getElementById('playerChart').getContext('2d');
        const playerChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
            datasets: [{
              label: 'Player Activity',
              data: [65, 59, 80, 81, 56, 55, 40],
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            }]
          },
          options: {
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// API to start a server
app.post('/servers/start', (req, res) => {
  const { id } = req.body;
  const server = servers.find(s => s.id === id);
  if (server) {
    exec(`echo "Starting server ${server.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to start server: ${stderr}` });
      } else {
        server.status = 'Online';
        res.json({ message: `Server ${server.name} started!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Server not found' });
  }
});

// API to stop a server
app.post('/servers/stop', (req, res) => {
  const { id } = req.body;
  const server = servers.find(s => s.id === id);
  if (server) {
    exec(`echo "Stopping server ${server.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to stop server: ${stderr}` });
      } else {
        server.status = 'Offline';
        res.json({ message: `Server ${server.name} stopped!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Server not found' });
  }
});

// API to install an addon
app.post('/addons/install', (req, res) => {
  const { id } = req.body;
  const addon = addons.find(a => a.id === id);
  const user = users[0]; // Simulate a logged-in user
  if (addon) {
    if (user.balance >= addon.price) {
      user.balance -= addon.price;
      user.purchasedAddons.push(addon.id);
      exec(`echo "Installing addon ${addon.name}"`, (error, stdout, stderr) => {
        if (error) {
          res.json({ message: `Failed to install addon: ${stderr}` });
        } else {
          res.json({ message: `Addon ${addon.name} installed!` });
        }
      });
    } else {
      res.status(400).json({ message: 'Insufficient balance' });
    }
  } else {
    res.status(404).json({ message: 'Addon not found' });
  }
});

// API to purchase a theme
app.post('/themes/purchase', (req, res) => {
  const { id } = req.body;
  const theme = themes.find(t => t.id === id);
  const user = users[0]; // Simulate a logged-in user
  if (theme) {
    if (user.balance >= theme.price) {
      user.balance -= theme.price;
      user.purchasedThemes.push(theme.id);
      res.json({ message: `Theme ${theme.name} purchased!` });
    } else {
      res.status(400).json({ message: 'Insufficient balance' });
    }
  } else {
    res.status(404).json({ message: 'Theme not found' });
  }
});

// API to create a backup
app.post('/backups/create', (req, res) => {
  const { id } = req.body;
  const server = servers.find(s => s.id === id);
  if (server) {
    const backup = { id: `backup${backups.length + 1}`, name: `Backup of ${server.name}`, date: new Date().toISOString() };
    backups.push(backup);
    exec(`echo "Creating backup for server ${server.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to create backup: ${stderr}` });
      } else {
        res.json({ message: `Backup created for server ${server.name}!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Server not found' });
  }
});

// API to restore a backup
app.post('/backups/restore', (req, res) => {
  const { id } = req.body;
  const backup = backups.find(b => b.id === id);
  if (backup) {
    exec(`echo "Restoring backup ${backup.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to restore backup: ${stderr}` });
      } else {
        res.json({ message: `Backup ${backup.name} restored!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Backup not found' });
  }
});

// API to change server version
app.post('/servers/change-version', (req, res) => {
  const { id, version } = req.body;
  const server = servers.find(s => s.id === id);
  if (server) {
    server.version = version;
    res.json({ message: `Server ${server.name} version changed to ${version}!` });
  } else {
    res.status(404).json({ message: 'Server not found' });
  }
});

// API to adjust server resources
app.post('/servers/adjust-resources', (req, res) => {
  const { id, cpu, ram } = req.body;
  const server = servers.find(s => s.id === id);
  if (server) {
    server.resources = { cpu, ram };
    res.json({ message: `Server ${server.name} resources adjusted to CPU ${cpu}%, RAM ${ram}MB!` });
  } else {
    res.status(404).json({ message: 'Server not found' });
  }
});

// API to manage a database
app.post('/databases/manage', (req, res) => {
  const { id } = req.body;
  const db = databases.find(d => d.id === id);
  if (db) {
    exec(`echo "Managing database ${db.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to manage database: ${stderr}` });
      } else {
        res.json({ message: `Database ${db.name} managed!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Database not found' });
  }
});

// API to run a task
app.post('/tasks/run', (req, res) => {
  const { id } = req.body;
  const task = tasks.find(t => t.id === id);
  if (task) {
    exec(`echo "Running task ${task.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to run task: ${stderr}` });
      } else {
        res.json({ message: `Task ${task.name} executed!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

// API to kick a player
app.post('/players/kick', (req, res) => {
  const { id } = req.body;
  const player = players.find(p => p.id === id);
  if (player) {
    exec(`echo "Kicking player ${player.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to kick player: ${stderr}` });
      } else {
        res.json({ message: `Player ${player.name} kicked!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Player not found' });
  }
});

// API to ban a player
app.post('/players/ban', (req, res) => {
  const { id } = req.body;
  const player = players.find(p => p.id === id);
  if (player) {
    exec(`echo "Banning player ${player.name}"`, (error, stdout, stderr) => {
      if (error) {
        res.json({ message: `Failed to ban player: ${stderr}` });
      } else {
        res.json({ message: `Player ${player.name} banned!` });
      }
    });
  } else {
    res.status(404).json({ message: 'Player not found' });
  }
});

// API to get AI suggestions
app.post('/ai/suggestions', async (req, res) => {
  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: 'Suggest optimizations for a Minecraft server:',
      max_tokens: 100,
    });
    res.json({ message: response.data.choices[0].text });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get AI suggestions' });
  }
});

// API to open world editor
app.post('/world/edit', (req, res) => {
  worldEdit.openEditor();
  res.json({ message: 'World editor opened!' });
});

// API to add funds to a player's balance
app.post('/economy/add', (req, res) => {
  const { playerId, amount } = req.body;
  const player = players.find(p => p.id === playerId);
  if (player) {
    player.balance += parseInt(amount);
    res.json({ message: `Added $${amount} to ${player.name}'s balance.` });
  } else {
    res.status(404).json({ message: 'Player not found' });
  }
});

// API to remove funds from a player's balance
app.post('/economy/remove', (req, res) => {
  const { playerId, amount } = req.body;
  const player = players.find(p => p.id === playerId);
  if (player) {
    player.balance -= parseInt(amount);
    res.json({ message: `Removed $${amount} from ${player.name}'s balance.` });
  } else {
    res.status(404).json({ message: 'Player not found' });
  }
});

// Add sample servers
servers.push({ id: '1', name: 'Minecraft Server', type: 'Minecraft', version: '1.20.1', status: 'Offline', resources: { cpu: 50, ram: 1024 } });
servers.push({ id: '2', name: 'ARK Server', type: 'ARK', version: '337.16', status: 'Offline', resources: { cpu: 70, ram: 2048 } });
servers.push({ id: '3', name: 'Rust Server', type: 'Rust', version: '2023.10.01', status: 'Offline', resources: { cpu: 60, ram: 1536 } });

// Add sample databases
databases.push({ id: 'db1', name: 'Minecraft DB', type: 'MySQL' });
databases.push({ id: 'db2', name: 'ARK DB', type: 'MariaDB' });

// Add sample tasks
tasks.push({ id: 'task1', name: 'Daily Backup', schedule: '0 0 * * *' });
tasks.push({ id: 'task2', name: 'Weekly Restart', schedule: '0 0 * * 0' });

// Add sample players
players.push({ id: 'player1', name: 'Steve', status: 'Online', balance: 100 });
players.push({ id: 'player2', name: 'Alex', status: 'Offline', balance: 50 });

// Add sample logs
logs.push({ id: 'log1', message: 'Server started successfully.' });
logs.push({ id: 'log2', message: 'Player Steve joined the game.' });

// Start the server
app.listen(port, () => {
  console.log(`Lonely Control Panel running at http://localhost:${port}`);
});

// CLI for advanced users
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', (input) => {
  const [command, ...args] = input.split(' ');
  switch (command) {
    case 'start':
      const server = servers.find(s => s.id === args[0]);
      if (server) {
        server.status = 'Online';
        console.log(`Server ${server.name} started!`);
      } else {
        console.log('Server not found');
      }
      break;
    case 'stop':
      const serverToStop = servers.find(s => s.id === args[0]);
      if (serverToStop) {
        serverToStop.status = 'Offline';
        console.log(`Server ${serverToStop.name} stopped!`);
      } else {
        console.log('Server not found');
      }
      break;
    case 'balance':
      console.log(`User balance: $${users[0].balance}`);
      break;
    case 'rename':
      panelName = args.join(' ') || 'Lonely';
      console.log(`Panel renamed to ${panelName}`);
      break;
    default:
      console.log('Unknown command');
  }
});
