# Lonely Panel and Wings Setup

This repository contains a combined script to set up **Lonely Panel** (a modified version of Pterodactyl Panel) and **Lonely Wings** (a modified version of Pterodactyl Wings) using Docker. The setup is designed to run entirely within Docker containers, eliminating the need for `systemd` or Docker to be installed on the host system.

---

## Features

### **Lonely Panel Features**
1. **Custom Branding**:
   - Renamed from "Pterodactyl" to "Lonely".
   - Panel color changed to black for a unique look.
2. **Dockerized Setup**:
   - Runs in Docker containers for easy deployment and isolation.
   - Includes MySQL (MariaDB), Redis, and Nginx services.
3. **Automated Installation**:
   - Automatically installs the panel with default admin credentials.
4. **Production-Ready**:
   - Configured for production use with environment variables and optimized settings.

### **Lonely Wings Features**
1. **Custom Branding**:
   - Renamed from "Pterodactyl Wings" to "Lonely Wings".
2. **Dockerized Setup**:
   - Runs in a Docker container with Docker-in-Docker (DinD) support.
   - No need for Docker to be installed on the host system.
3. **Automatic Node Creation**:
   - Automatically creates a node in the Lonely Panel via the API.
4. **Production-Ready**:
   - Configured to connect to the Lonely Panel and manage game servers.

### **Combined Features**
1. **Single Script Setup**:
   - One script to set up both the panel and Wings.
2. **No Host Dependencies**:
   - No need for `systemd` or Docker on the host system.
3. **Customizable**:
   - Easily customize variables like panel URL, admin credentials, and node details.
4. **Scalable**:
   - Designed to support multiple nodes and game servers.

---

## Prerequisites

1. **Docker and Docker Compose**:
   - Ensure Docker and Docker Compose are installed on your system.
   - If not installed, follow the official Docker installation guide: [Docker Installation](https://docs.docker.com/get-docker/).

2. **Git**:
   - Ensure Git is installed to clone the repositories.
   - Install Git using your package manager (e.g., `sudo apt install git`).

3. **jq**:
   - The script uses `jq` to parse JSON responses from the API.
   - Install `jq` using your package manager (e.g., `sudo apt install jq`).

---

## How to Run

### Step 1: Clone the Repository
Clone this repository or copy the script to your local machine.

```bash
git clone https://github.com/your-repo/lonely-panel-wings.git
cd lonely-panel-wings
```

### Step 2: Make the Script Executable
Make the script executable before running it.

```bash
chmod +x setup-lonely.sh
```

### Step 3: Update Variables
Open the script and update the following variables as needed:

- **Panel Variables**:
  - `PANEL_NAME`: Name of the panel container (default: `lonely-panel`).
  - `DB_PASSWORD`: Database password for the panel.
  - `ROOT_DB_PASSWORD`: Root password for the database.
  - `APP_URL`: URL where the panel will be accessible (default: `http://localhost:8000`).
  - `ADMIN_EMAIL`: Admin email for the panel.
  - `ADMIN_USERNAME`: Admin username for the panel.
  - `ADMIN_PASSWORD`: Admin password for the panel.

- **Wings Variables**:
  - `WINGS_NAME`: Name of the Wings container (default: `lonely-wings`).
  - `PANEL_URL`: URL of the Lonely Panel (default: `http://localhost:8000`).
  - `NODE_NAME`: Name of the node to be created in the panel.
  - `NODE_DESCRIPTION`: Description for the node.
  - `NODE_LOCATION`: Location ID for the node (default: `1`).

### Step 4: Run the Script
Execute the script to set up the Lonely Panel and Wings.

```bash
./setup-lonely.sh
```

### Step 5: Access the Panel
Once the script completes, you can access the Lonely Panel at the specified `APP_URL` (default: `http://localhost:8000`).

Use the following default admin credentials to log in:
- **Email**: `admin@example.com`
- **Password**: `password`

---

## Post-Setup Steps

### **Accessing Wings Logs**
To view the logs for Lonely Wings, run the following command:

```bash
docker logs lonely-wings
```

### **Adding More Nodes**
You can add more nodes by running the Wings setup script again with a different `NODE_NAME` and configuration.

### **Scaling Game Servers**
Use the Lonely Panel to create and manage game servers. The panel will automatically communicate with Lonely Wings to deploy and manage the servers.

---

## Troubleshooting

### **Failed to Generate API Key**
- Ensure the `PANEL_URL` is correct and the panel is running.
- Verify that the `ADMIN_EMAIL` and `ADMIN_PASSWORD` match the credentials used during panel setup.

### **Docker Containers Not Starting**
- Check Docker logs for errors:
  ```bash
  docker logs lonely-panel-app
  docker logs lonely-wings
  ```
- Ensure Docker and Docker Compose are installed correctly.

### **Node Creation Failed**
- Verify that the API key was generated successfully.
- Check the `PANEL_URL` and ensure the panel API is accessible.

---

## License
This project is open-source and available under the [MIT License](LICENSE).

---

## Support
For issues or questions, please open an issue on the GitHub repository or contact the maintainers.

---

Enjoy using **Lonely Panel** and **Lonely Wings**! 🚀
