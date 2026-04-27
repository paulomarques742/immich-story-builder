# Deploy no Google Cloud Run — Setup inicial

Estes comandos correm **uma única vez** para configurar a infraestrutura.
Substituir os valores em `< >` pelos teus.

```bash
PROJECT_ID=<o-teu-project-id>
REGION=europe-west1
SERVICE=memoire
REPO=memoire
BUCKET=memoire-data
GITHUB_OWNER=<o-teu-github-user>
GITHUB_REPO=immich-story-builder
```

---

## 1. Activar APIs necessárias

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project=$PROJECT_ID
```

---

## 2. Artifact Registry — repositório Docker

```bash
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="Memoire app images" \
  --project=$PROJECT_ID
```

---

## 3. GCS Bucket — persistência do SQLite

```bash
gcloud storage buckets create gs://$BUCKET \
  --location=$REGION \
  --uniform-bucket-level-access \
  --project=$PROJECT_ID
```

---

## 4. Secret Manager — variáveis sensíveis

```bash
# JWT_SECRET (gerar valor seguro)
echo -n "$(openssl rand -base64 48)" | \
  gcloud secrets create memoire-jwt-secret \
    --data-file=- --project=$PROJECT_ID

# URL do servidor Immich
echo -n "http://<immich-ip>:2283" | \
  gcloud secrets create memoire-immich-url \
    --data-file=- --project=$PROJECT_ID

# API Key do Immich
echo -n "<imm-api-key>" | \
  gcloud secrets create memoire-immich-key \
    --data-file=- --project=$PROJECT_ID

# Email do admin
echo -n "<admin@email.com>" | \
  gcloud secrets create memoire-admin-email \
    --data-file=- --project=$PROJECT_ID
```

Para actualizar um secret no futuro:
```bash
echo -n "<novo-valor>" | \
  gcloud secrets versions add memoire-jwt-secret --data-file=- --project=$PROJECT_ID
```

---

## 5. IAM — permissões da Service Account do Cloud Build

```bash
# Service Account do Cloud Build
CB_SA="$(gcloud projects describe $PROJECT_ID \
  --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"

# Permissão para fazer deploy no Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"

# Permissão para fazer push no Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/artifactregistry.writer"

# Permissão para ler secrets durante o deploy
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/secretmanager.secretAccessor"

# Permissão para actuar como a SA do Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"
```

### Permissões da SA do Cloud Run (runtime)

```bash
# Service Account que corre o container no Cloud Run
CR_SA="$(gcloud iam service-accounts list \
  --filter="displayName:Compute Engine default" \
  --format='value(email)' --project=$PROJECT_ID)"

# Acesso de leitura/escrita ao bucket SQLite
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member="serviceAccount:$CR_SA" \
  --role="roles/storage.objectAdmin"

# Acesso aos secrets em runtime
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CR_SA" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 6. Cloud Build trigger (GitHub → deploy automático)

### Ligar o repositório GitHub ao Cloud Build

Na consola GCP → Cloud Build → Triggers → "Connect Repository"
e ligar o repositório `$GITHUB_OWNER/$GITHUB_REPO`.

Ou via CLI (requer o GitHub App já instalado):

```bash
gcloud builds triggers create github \
  --name="memoire-deploy" \
  --repo-name=$GITHUB_REPO \
  --repo-owner=$GITHUB_OWNER \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_REGION=$REGION,_SERVICE=$SERVICE,_REPO=$REPO,_GCS_BUCKET=$BUCKET" \
  --project=$PROJECT_ID
```

---

## 7. Primeiro deploy manual (opcional)

Para testar antes de ligar o trigger:

```bash
gcloud builds submit . \
  --config=cloudbuild.yaml \
  --substitutions="_REGION=$REGION,_SERVICE=$SERVICE,_REPO=$REPO,_GCS_BUCKET=$BUCKET,COMMIT_SHA=manual" \
  --project=$PROJECT_ID
```

---

## Fluxo depois do setup

```
git push origin main
       ↓
Cloud Build detecta o push
       ↓
Build Dockerfile (3 stages: frontend + deps + prod)
       ↓
Push para Artifact Registry (europe-west1)
       ↓
Deploy no Cloud Run com a nova imagem
       ↓
https://$SERVICE-<hash>-ew.a.run.app
```

## Notas importantes

**SQLite no Cloud Run:**
O SQLite é montado via GCS bucket (`/data/db.sqlite`). O Cloud Run Gen2
suporta GCS FUSE natively. Para operações de escrita intensiva considera
migrar para Cloud SQL (PostgreSQL) no futuro.

**Immich acessível a partir do Cloud Run:**
Se o Immich está numa rede local, precisas de:
- VPN/túnel para a rede privada, ou
- Expor o Immich com HTTPS público (com autenticação), ou
- Correr numa VPC partilhada com o Cloud Run via VPC connector
