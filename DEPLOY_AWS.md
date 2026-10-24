# Deploying Oasyn Maps on AWS

Target architecture:

```text
Browser ──HTTPS──> AWS Amplify Hosting (frontend/, static React build)
   │
   └──HTTPS──> ECS Express Mode service (backend/ container on Fargate, behind an ALB)
                  │
                  └──> Cloudflare R2 (graph snapshot + map layers, downloaded at boot)
```

- **Backend** runs as a Docker container on **Amazon ECS Express Mode**. AWS closed App Runner to new customers in 2026 and points to Express Mode instead. You get an HTTPS URL, a load balancer, health checks, autoscaling, logs and automatic rollback.
- **Frontend** runs on **AWS Amplify Hosting**, which builds from GitHub on every push.
- **Data** stays in Cloudflare R2, so you don't need to migrate anything. Only the read credentials move into AWS Secrets Manager.

Every command below is PowerShell, run from the repository root.

---

## 0. Files used by this guide

| File | Purpose |
| --- | --- |
| `backend/Dockerfile`, `backend/.dockerignore` | Production image. Listens on 8080, exits if the snapshot can't load (`REQUIRE_SNAPSHOT=1`). |
| `deploy/aws/push-backend.ps1` | Builds the image, pushes it to ECR, and can roll the service onto it. |
| `deploy/aws/container.template.json` | Container settings: image, env vars, secrets. |
| `deploy/aws/trust-ecs-*.json`, `secrets-policy.template.json`, `scaling.json` | IAM and scaling inputs (files avoid PowerShell JSON-quoting problems). |
| `amplify.yml`, `customHttp.yml` | Amplify build spec (monorepo, `appRoot: frontend`) and cache/security headers. |

The backend's `/healthz` now reports whether the real snapshot loaded:

```json
{"ok":true,"stub":false,"snapshot":{"loaded":true,"source":"r2","nodes":203772,"edges":307238}}
```

---

## 1. Prerequisites (one time)

1. **AWS account**, plus an IAM user or IAM Identity Center login with admin rights for the setup.
2. **AWS CLI v2**:

   ```powershell
   winget install -e --id Amazon.AWSCLI
   # open a NEW terminal afterwards, then:
   aws --version
   aws configure        # access key, secret, region us-east-1, output json
   aws sts get-caller-identity
   ```

3. **Docker Desktop** installed and running (`docker info` should print a server version).
4. **Commit and push** this repo, including the files above, to GitHub. Amplify builds from the branch you connect, usually `main`.
5. Pick a region. This guide uses `us-east-1`, which is close to the Boston data and its users.

   ```powershell
   $region = "us-east-1"
   $acct   = aws sts get-caller-identity --query Account --output text
   ```

---

## 2. Create a read-only R2 token (recommended)

The keys in `backend/.env` are the ones the build script uses to **publish** snapshots, so they can write. The server only needs to read.

1. Cloudflare dashboard → **R2** → **Manage R2 API Tokens** → **Create API token**.
2. Permission: **Object Read only**. Scope it to the `oasyn-maps-graph` bucket only.
3. Copy the **Access Key ID** and **Secret Access Key**.

If you skip this, use the existing values from `backend/.env`. That works, but the server then holds write access.

---

## 3. Store the R2 credentials in Secrets Manager

```powershell
$r2 = @{ R2_ACCESS_KEY_ID = "<access key id>"; R2_SECRET_ACCESS_KEY = "<secret access key>" } | ConvertTo-Json -Compress
[IO.File]::WriteAllText("$env:TEMP\r2-secret.json", $r2)
$secretArn = aws secretsmanager create-secret --name oasyn/r2 --region $region `
  --secret-string "file://$env:TEMP\r2-secret.json" --query ARN --output text
Remove-Item "$env:TEMP\r2-secret.json"
$secretArn   # keep this; looks like arn:aws:secretsmanager:us-east-1:...:secret:oasyn/r2-AbC123
```

---

## 4. Create the IAM roles

Express Mode needs two roles. The **task execution role** pulls the image, writes logs and reads the secret. The **infrastructure role** lets ECS create the load balancer, security groups and scaling.

```powershell
# Task execution role (skip create-role if it says EntityAlreadyExists)
aws iam create-role --role-name ecsTaskExecutionRole `
  --assume-role-policy-document file://deploy/aws/trust-ecs-tasks.json
aws iam attach-role-policy --role-name ecsTaskExecutionRole `
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Allow it to read ONLY the oasyn/r2 secret
(Get-Content deploy/aws/secrets-policy.template.json -Raw) -replace '__SECRET_ARN__', $secretArn |
  Set-Content -Encoding ascii deploy/aws/secrets-policy.json
aws iam put-role-policy --role-name ecsTaskExecutionRole --policy-name OasynReadR2Secret `
  --policy-document file://deploy/aws/secrets-policy.json

# Infrastructure role for Express Mode
aws iam create-role --role-name ecsInfrastructureRoleForExpressServices `
  --assume-role-policy-document file://deploy/aws/trust-ecs-infra.json
aws iam attach-role-policy --role-name ecsInfrastructureRoleForExpressServices `
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices
```

New roles take about a minute to become usable. If step 6 fails with *Unable to assume the service linked role*, wait a minute and retry.

Your account also needs a **default VPC** in the region. Most accounts have one. Check under VPC console → Your VPCs.

---

## 5. Build and push the backend image

```powershell
powershell -ExecutionPolicy Bypass -File deploy/aws/push-backend.ps1 -Region $region
```

The script creates the `oasyn-backend` ECR repository if needed, logs Docker in, builds for `linux/amd64`, pushes, and prints:

```text
IMAGE_URI=<acct>.dkr.ecr.us-east-1.amazonaws.com/oasyn-backend:<git-sha>
```

```powershell
$image = "<paste the IMAGE_URI value>"
```

Now fill in the container settings. Use the **exact** `R2_ENDPOINT` and `R2_BUCKET` values from `backend/.env`. They're not secret, but they must match.

```powershell
$r2Account = "<R2_ACCOUNT_ID from backend/.env>"
(Get-Content deploy/aws/container.template.json -Raw) `
  -replace '__IMAGE_URI__', $image `
  -replace '__R2_ACCOUNT_ID__', $r2Account `
  -replace '__SECRET_ARN__', $secretArn |
  Set-Content -Encoding ascii deploy/aws/container.json
Get-Content deploy/aws/container.json   # sanity check: no __PLACEHOLDERS__ left
```

`CORS_ORIGIN` starts as `*` because the Amplify domain doesn't exist yet. You'll lock it down in step 8. `container.json` is gitignored.

---

## 6. Create the ECS Express Mode service

```powershell
aws ecs create-express-gateway-service --region $region `
  --service-name oasyn-backend `
  --execution-role-arn "arn:aws:iam::${acct}:role/ecsTaskExecutionRole" `
  --infrastructure-role-arn "arn:aws:iam::${acct}:role/ecsInfrastructureRoleForExpressServices" `
  --primary-container file://deploy/aws/container.json `
  --health-check-path /healthz `
  --cpu 512 --memory 1024 `
  --scaling-target file://deploy/aws/scaling.json `
  --monitor-resources
```

- **Size:** 0.5 vCPU / 1 GB. Measured locally, the container uses about 230 MiB with the full graph, every layer cached and a plan computed.
- **Health check:** `/healthz` only answers once the snapshot has loaded. With bad credentials the container exits and the deploy fails instead of serving sample data.
- **Duration:** a few minutes. When it reaches `ACTIVE`, find the URL with:

```powershell
$serviceArn = "arn:aws:ecs:${region}:${acct}:service/default/oasyn-backend"
aws ecs describe-express-gateway-service --service-arn $serviceArn --region $region `
  --query "service.activeConfigurations[0].ingressPaths[0].endpoint" --output text
```

If that query returns nothing, open the **ECS console → Clusters → default → oasyn-backend**. The **Application URL** is shown there, in the form `https://<name>.ecs.us-east-1.on.aws`.

Verify it:

```powershell
$api = "https://<your application url>"     # no trailing slash
Invoke-RestMethod "$api/healthz"            # snapshot.loaded must be True, stub False
(Invoke-RestMethod "$api/api/layers/places").features.Count   # ~348, not 0
```

Logs are in **CloudWatch → Log groups**, under the group named after the cluster and service. A healthy boot shows:

```text
[oasyn] snapshot loaded: 203772 nodes, 307238 edges (r2)
[oasyn] backend listening on :8080
```

---

## 7. Deploy the frontend on Amplify Hosting

1. Open the **Amplify console** → **Create new app** → **GitHub** → authorize, then pick the `Oasyn-Maps` repo and your branch (`main`).
2. Tick **My app is a monorepo** and set the root directory to **`frontend`**.
3. Amplify detects `amplify.yml` at the repo root. Leave the build settings as they are.
4. Under **Advanced settings → Environment variables**, add:

   | Key | Value |
   | --- | --- |
   | `VITE_API_MODE` | `live` |
   | `VITE_API_BASE` | your step 6 URL, e.g. `https://oasyn-backend.ecs.us-east-1.on.aws` (no trailing slash) |
   | `VITE_CARTO_API_KEY` | your CARTO basemap key (without it, tiles show an "API KEY REQUIRED" watermark) |

   The build **fails on purpose** if `VITE_API_MODE` isn't `live` or `VITE_API_BASE` is empty, so you can't ship a sample-data build by accident.
5. **Save and deploy.** The site URL looks like `https://main.<appId>.amplifyapp.com`.
6. **SPA rewrite (required).** Without it, `/app` and `/lab` return 404 on refresh. Go to **Hosting → Rewrites and redirects → Manage redirects → Open text editor** and paste:

   ```json
   [
     {
       "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|webp)$)([^.]+$)/>",
       "status": "200",
       "target": "/index.html"
     }
   ]
   ```

`VITE_*` values are baked in at build time. After changing any of them, run **Redeploy this version** on the branch.

---

## 8. Lock CORS to your frontend domain

Edit `deploy/aws/container.json` and set `CORS_ORIGIN` to your Amplify URL. You can list several origins, comma-separated, e.g. a custom domain as well:

```json
{ "name": "CORS_ORIGIN", "value": "https://main.<appId>.amplifyapp.com" }
```

Then roll it out. This rebuilds, pushes and updates the service with zero downtime:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/aws/push-backend.ps1 -Region $region -ServiceArn $serviceArn
```

---

## 9. End-to-end check

Open `https://main.<appId>.amplifyapp.com/app` with DevTools → Network open:

- [ ] Requests go to your ECS URL. `/api/layers/places`, `parks` and `trees` return **200** with **no `X-Oasyn-Stub` header**.
- [ ] No **SAMPLE DATA** badge. Data badges show real OSM / Boston GIS provenance.
- [ ] The map shows parks, trees, water and cooling points around Boston.
- [ ] Typing in **Start** and **Destination** lists place names. Picking both draws routes.
- [ ] Refreshing on `/app` doesn't 404 (rewrite rule).
- [ ] The console shows no CORS errors.

---

## 10. Day-2 operations

| Task | How |
| --- | --- |
| Deploy backend changes | `push-backend.ps1 -Region $region -ServiceArn $serviceArn` |
| Deploy frontend changes | `git push` to the connected branch; Amplify builds automatically |
| Publish a new data snapshot | Run the existing `build-data` / `bake-shade` scripts (they update the R2 `latest` pointer), then force a new deployment: ECS console → service → **Update** → **Force new deployment** |
| Rotate R2 keys | Update the `oasyn/r2` secret in Secrets Manager, then force a new deployment |
| Turn off Render | After step 9 passes, suspend or delete the Render service |

### Approximate monthly cost (us-east-1, always-on)

- **Fargate**, 0.5 vCPU / 1 GB × 1 task: about $18
- **Application Load Balancer:** about $16–20, plus usage
- **Secrets Manager**, 1 secret: $0.40
- **ECR** storage: cents
- **Amplify** build minutes and data transfer: low for a demo. Check the Amplify pricing page.

Set a budget alert under **Billing → Budgets** (for example $50/month). To tear everything down: delete the Express service (ECS console), the ECR repo, the `oasyn/r2` secret and the Amplify app.

### Security notes

- The API is public and unauthenticated by design: stateless, no user data stored, no cookies. CORS stops other websites from calling it from a browser, but it doesn't stop scripts. If abuse becomes a concern, attach **AWS WAF** with a rate-based rule to the service's load balancer.
- Never put R2 keys in `container.json`, `amplify.yml` or any committed file. They live only in Secrets Manager.

---

## 11. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Deploy never becomes healthy; logs show `FATAL: snapshot load failed (Missing R2 env vars...)` | `container.json` is missing an R2 variable or the secrets block. Recheck step 5. |
| Tasks stop with `ResourceInitializationError: unable to pull secrets` | The execution role can't read the secret. Recheck the `put-role-policy` in step 4 and that `$secretArn` matches. |
| Logs show `AccessDenied` / `NoSuchKey` from R2 | Wrong token scope, bucket or `R2_LATEST_POINTER`. Compare with `backend/.env`. |
| `Unable to assume the service linked role` | IAM propagation delay. Wait a minute and retry. |
| Amplify build fails with `ERROR: set VITE_API_MODE=live` | Add the environment variables from step 7.4, then redeploy. |
| Site shows a "backend unreachable" notice | `VITE_API_BASE` is wrong, or `CORS_ORIGIN` doesn't exactly match the site origin (scheme + host, no path). |
| 404 when refreshing `/app` | The rewrite rule from step 7.6 is missing. |
| Watermarked map tiles | `VITE_CARTO_API_KEY` is missing or invalid. |
| Returning visitors still see the old site once | The old service worker served a cached page. It updates itself on that visit, and the next load is the new build. |
