# Deploy FitCore to 3 AWS EC2 instances

Every step, in order. Run commands exactly as shown. Wherever you see `PASTE_...`, replace it with your real value **before** you paste the block into the terminal (edit it in Notepad first).

| Instance | Name tag | Runs | Compose file |
| --- | --- | --- | --- |
| EC2-1 | `fitcore-ec2-1-gateway` | API gateway, registration, login, Nginx load balancer | `compose.gateway.yml` |
| EC2-2 | `fitcore-ec2-2-node-a` | membership, payment, class, booking, trainer, attendance (node-a) | `compose.node.yml` |
| EC2-3 | `fitcore-ec2-3-node-b` | the same six services (node-b) | `compose.node.yml` |

---

## Step 1: Put the code on GitHub (on your laptop)

1. On github.com, create a new **public** repository named `fitcore-gym`. Leave it empty (no README).
2. Open the `fitcore-gym` folder in VS Code, open the terminal (PowerShell), and run:

```powershell
git init
git add .
git commit -m "FitCore gym management microservices"
git branch -M main
git remote add origin https://github.com/PASTE_YOUR_GITHUB_USERNAME/fitcore-gym.git
git push -u origin main
```

`.env` files are in `.gitignore`, so no secrets are uploaded. Check on GitHub that no `.env` file appears (only `.env.*.example`).

## Step 2: Prepare MongoDB Atlas

1. **Database Access → Add New Database User:** username `fitcore`, use **Autogenerate Secure Password** (letters and digits only; avoid `$` and `@`), role **Read and write to any database**. Copy the password.
2. **Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`). The EC2 public IPs change every time the lab restarts, so this is the setting that keeps working.
3. **Database → Connect → Drivers:** copy the connection string and put your password in place of `<db_password>`. It looks like:

```text
mongodb+srv://fitcore:yourPassword123@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

This is your `MONGO_URI`. Leave the database name out: each service picks its own (`fitcore_identity`, `fitcore_membership`, ...).

## Step 3: Create one security group

EC2 → **Security Groups → Create security group**: name `fitcore-sg`, VPC = default. Inbound rules:

| Type | Port range | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | Anywhere-IPv4 (0.0.0.0/0) | EC2 Instance Connect / SSH |
| Custom TCP | 8000 | Anywhere-IPv4 (0.0.0.0/0) | Postman → API gateway |
| Custom TCP | 8003-8008 | Custom: `172.31.0.0/16` | Load balancer (EC2-1) → service nodes, inside the VPC only |

`172.31.0.0/16` is the default VPC range. Check yours under VPC → Your VPCs → IPv4 CIDR. Ports 8003-8008 are **not** open to the internet, so the business services can only be reached through the gateway.

## Step 4: Launch 3 instances

EC2 → **Launch instances**. Use the same settings for all three, changing only the name:

- **Name:** `fitcore-ec2-1-gateway`, `fitcore-ec2-2-node-a`, `fitcore-ec2-3-node-b`
- **AMI:** Ubuntu Server 24.04 LTS
- **Instance type:** t3.micro (t2.micro also works)
- **Key pair:** `vockey` (AWS Academy) or your own
- **Network settings → Select existing security group:** `fitcore-sg`
- **Storage:** 16 GiB gp3

When they are running, write down:

| Value | Where to find it | Used for |
| --- | --- | --- |
| EC2-1 **public** IPv4 | Instance details | Postman `baseUrl` |
| EC2-2 **private** IPv4 | Instance details | `NODE_A_HOST` in EC2-1's `.env` |
| EC2-3 **private** IPv4 | Instance details | `NODE_B_HOST` in EC2-1's `.env` |

## Step 5: Install Docker on all 3 instances

Connect to each instance (select it → **Connect** → **EC2 Instance Connect** → Connect) and run this whole block on **each** of the three:

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh

# 2 GB swap so image builds don't run out of memory on a 1 GB instance
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Get the code
git clone https://github.com/PASTE_YOUR_GITHUB_USERNAME/fitcore-gym.git
cd fitcore-gym

# Check
sudo docker compose version
free -h
```

## Step 6: Generate the two shared secrets (once)

On **EC2-1**, run:

```bash
echo "INTERNAL_API_KEY=$(openssl rand -hex 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
```

Copy both lines into Notepad. **INTERNAL_API_KEY must be identical on all three instances.** JWT_SECRET is only used on EC2-1.

## Step 7: Start service node A (EC2-2)

On **EC2-2**, edit the placeholders, then paste:

```bash
cd ~/fitcore-gym

cat > .env <<'EOF'
NODE_NAME=node-a
MONGO_URI=PASTE_YOUR_ATLAS_URI
INTERNAL_API_KEY=PASTE_INTERNAL_API_KEY
EOF

grep -q PASTE_ .env && echo "STOP: replace the PASTE_ values in .env" || echo ".env looks complete"

sudo docker compose -f compose.node.yml up -d --build
sudo docker compose -f compose.node.yml ps
```

The first build takes a few minutes. Run the `ps` command again until all six containers show `(healthy)`. Then check:

```bash
curl -s localhost:8003/health; echo
```

Expected: `{"service":"membership-service","instance":"node-a","status":"ok","db":"connected",...}`

## Step 8: Start service node B (EC2-3)

On **EC2-3**, run the same as Step 7, with `NODE_NAME=node-b`:

```bash
cd ~/fitcore-gym

cat > .env <<'EOF'
NODE_NAME=node-b
MONGO_URI=PASTE_YOUR_ATLAS_URI
INTERNAL_API_KEY=PASTE_INTERNAL_API_KEY
EOF

grep -q PASTE_ .env && echo "STOP: replace the PASTE_ values in .env" || echo ".env looks complete"

sudo docker compose -f compose.node.yml up -d --build
sudo docker compose -f compose.node.yml ps
curl -s localhost:8003/health; echo
```

## Step 9: Start the gateway node (EC2-1)

On **EC2-1**:

```bash
cd ~/fitcore-gym

cat > .env <<'EOF'
MONGO_URI=PASTE_YOUR_ATLAS_URI
INTERNAL_API_KEY=PASTE_INTERNAL_API_KEY
JWT_SECRET=PASTE_JWT_SECRET
SEED_ADMIN_NAME=FitCore Admin
SEED_ADMIN_EMAIL=admin@fitcore.com
SEED_ADMIN_PASSWORD=Admin@12345
NODE_A_HOST=PASTE_EC2_2_PRIVATE_IP
NODE_B_HOST=PASTE_EC2_3_PRIVATE_IP
EOF

grep -q PASTE_ .env && echo "STOP: replace the PASTE_ values in .env" || echo ".env looks complete"

# EC2-1 must reach both nodes before the load balancer can use them
curl -s -m 5 http://$(grep NODE_A_HOST .env | cut -d= -f2):8003/health; echo
curl -s -m 5 http://$(grep NODE_B_HOST .env | cut -d= -f2):8003/health; echo

sudo docker compose -f compose.gateway.yml up -d --build
sudo docker compose -f compose.gateway.yml ps
```

When all four containers are `(healthy)`, test the load balancer from EC2-1:

```bash
for i in 1 2 3 4; do curl -s localhost:8000/api/health/class; echo; done
```

`"instance"` must alternate between `node-a` and `node-b`.

## Step 10: Test everything with Postman

1. Postman → **Import** → `postman/FitCore-Gym.postman_collection.json`.
2. Click the collection → **Variables** tab. Set `baseUrl` to `http://PASTE_EC2_1_PUBLIC_IP:8000` (use `http`, not `https`). If you changed the seed admin, also set `adminEmail` and `adminPassword`. Save.
3. Run the folders **in order, 0 to 12**. You can click each request one by one (best for screenshots) or use **Run collection**. Every request saves the tokens and ids the next one needs.
4. Take your MongoDB screenshots in Atlas (**Browse Collections**) now, while the demo data exists.
5. Run folder **13. Cleanup** last. It demonstrates every DELETE endpoint and removes the demo data.

### What to screenshot

- Each request in Postman with the **EC2-1 public IP visible in the URL bar** and the response body.
- For the load balancer: the 4 `LB check` responses (look at `"instance"`) and the **Headers** tab showing `X-Served-By` and `X-Upstream-Addr`.
- Atlas → Browse Collections: one screenshot per database (`fitcore_identity`, `fitcore_membership`, `fitcore_payment`, `fitcore_class`, `fitcore_booking`, `fitcore_trainer`, `fitcore_attendance`).
- `sudo docker compose -f <file> ps` on each EC2 instance, showing the containers as healthy.
- The load-balancer code: `nginx/templates/default.conf.template` and the `*_URL` lines in `compose.gateway.yml`.

## Step 11: Failover demo (load balancer with one node down)

1. On **EC2-2**: `sudo docker compose -f compose.node.yml stop`
2. In Postman, run the 4 `LB check` requests again. Every one is answered by `node-b`. On the first requests, `X-Upstream-Addr` lists **both** addresses: Nginx tried node-a, failed, and retried on node-b. Members can keep booking and checking in.
3. On **EC2-2**: `sudo docker compose -f compose.node.yml start`. After about 10 seconds, requests alternate between node-a and node-b again.

## When the AWS Academy lab restarts

The instances stop when the lab session ends. When you start the lab again:

- Containers start automatically (`restart: unless-stopped`).
- **EC2-1's public IP changes.** Update `baseUrl` in Postman.
- Private IPs stay the same, so `NODE_A_HOST` / `NODE_B_HOST` stay valid.
- Login tokens expire after 2 hours; run the login requests again.

## Updating the code later

Push your change to GitHub, then on each affected instance:

```bash
cd ~/fitcore-gym
git pull
sudo docker compose -f compose.node.yml up -d --build      # on EC2-2 / EC2-3
sudo docker compose -f compose.gateway.yml up -d --build   # on EC2-1
```

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| A container keeps restarting or shows `unhealthy` | `sudo docker compose -f <file> logs --tail=50 <service-name>` |
| Log says `Missing required environment variable: X` | Add `X` to `.env`, then `sudo docker compose -f <file> up -d` |
| Log says `MongoServerSelectionError` or `bad auth` | Atlas → Network Access must include `0.0.0.0/0`; check the user and password inside `MONGO_URI` |
| Postman hangs or times out | Use EC2-1's **public** IP, `http://`, port `8000`; security group must allow 8000 |
| `401 Direct access is not allowed` | `INTERNAL_API_KEY` is different between EC2-1 and a node. Make them identical, then `up -d` on that instance |
| `502 ... service is unavailable` or `/api/status` shows `degraded` | From EC2-1: `curl http://<node private IP>:8003/health`. If it hangs, fix the 8003-8008 rule in `fitcore-sg`; if refused, start the node's containers. Check `NODE_A_HOST`/`NODE_B_HOST` are **private** IPs |
| `401 Invalid token: jwt expired` | Tokens last 2 hours. Run the login requests again |
| `429 Too many requests` | Rate limiter (300 requests/min, 20 logins/min per IP). Wait one minute |
| Build stops with `Killed` | Out of memory: make sure the swap step ran (`free -h` shows 2.0Gi swap) |
| `permission denied ... docker.sock` | Put `sudo` in front of `docker` |
