#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-regal-campus-198sv}"
GITHUB_REPO="${GITHUB_REPO:-backtonemesis-cpu/MV}"
POOL_ID="${POOL_ID:-github}"
PROVIDER_ID="${PROVIDER_ID:-mv}"
DEPLOYER_SA_NAME="${DEPLOYER_SA_NAME:-mv-github-deployer}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-mv-runtime}"
FIRESTORE_LOCATION="${MV_FIRESTORE_LOCATION:-}"

echo "MV Google Cloud production bootstrap"
echo "Project: $PROJECT_ID"
echo "GitHub repository: $GITHUB_REPO"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n1)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "ERROR: No active gcloud account. Authenticate in Cloud Shell and retry." >&2
  exit 1
fi

echo "Active Google account: $ACTIVE_ACCOUNT"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "Enabling required Google Cloud APIs..."
gcloud services enable   run.googleapis.com   cloudbuild.googleapis.com   artifactregistry.googleapis.com   iamcredentials.googleapis.com   sts.googleapis.com   serviceusage.googleapis.com   firestore.googleapis.com   firebaserules.googleapis.com   identitytoolkit.googleapis.com   securetoken.googleapis.com   firebase.googleapis.com   --project="$PROJECT_ID"   --quiet

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
if [ -z "$PROJECT_NUMBER" ]; then
  echo "ERROR: Could not determine project number." >&2
  exit 1
fi

DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

if ! gcloud firestore databases describe   --project="$PROJECT_ID"   --database="(default)" >/dev/null 2>&1; then
  if [ -z "$FIRESTORE_LOCATION" ]; then
    cat >&2 <<EOF
ERROR: Firestore (default) does not exist.

Its location is a long-lived production decision, so this script will not guess it.
Choose the production Firestore location, then rerun with for example:

  MV_FIRESTORE_LOCATION=YOUR_CHOSEN_LOCATION bash scripts/bootstrap-production-gcp.sh
EOF
    exit 1
  fi

  echo "Creating Firestore (default) in explicitly selected location: $FIRESTORE_LOCATION"
  gcloud firestore databases create     --project="$PROJECT_ID"     --database="(default)"     --location="$FIRESTORE_LOCATION"     --type=firestore-native     --quiet
fi

echo "Confirmed Firestore (default):"
gcloud firestore databases describe   --project="$PROJECT_ID"   --database="(default)"   --format='yaml(name,locationId,type)'

if ! gcloud iam service-accounts describe "$DEPLOYER_SA"   --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating deployment service account: $DEPLOYER_SA"
  gcloud iam service-accounts create "$DEPLOYER_SA_NAME"     --project="$PROJECT_ID"     --display-name="MV GitHub production deployer"
fi

if ! gcloud iam service-accounts describe "$RUNTIME_SA"   --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating runtime service account: $RUNTIME_SA"
  gcloud iam service-accounts create "$RUNTIME_SA_NAME"     --project="$PROJECT_ID"     --display-name="MV Cloud Run runtime"
fi

echo "Granting deployment service account project roles..."
for role in   roles/run.sourceDeveloper   roles/serviceusage.serviceUsageConsumer   roles/firebaserules.admin   roles/datastore.viewer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID"     --member="serviceAccount:$DEPLOYER_SA"     --role="$role"     --condition=None     --quiet >/dev/null
  echo "  $role"
done

echo "Granting runtime service account project roles..."
for role in   roles/datastore.user   roles/firebaseauth.viewer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID"     --member="serviceAccount:$RUNTIME_SA"     --role="$role"     --condition=None     --quiet >/dev/null
  echo "  $role"
done

echo "Allowing deployer to attach the runtime identity..."
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA"   --project="$PROJECT_ID"   --member="serviceAccount:$DEPLOYER_SA"   --role="roles/iam.serviceAccountUser"   --quiet >/dev/null

if gcloud iam service-accounts describe "$COMPUTE_SA"   --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Granting Cloud Run Builder to Compute Engine default service account..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID"     --member="serviceAccount:$COMPUTE_SA"     --role="roles/run.builder"     --condition=None     --quiet >/dev/null
else
  echo "WARNING: Compute Engine default service account $COMPUTE_SA was not found."
  echo "Cloud Run source deployment may require an administrator to configure the project's build service account."
fi

if ! gcloud iam workload-identity-pools describe "$POOL_ID"   --project="$PROJECT_ID"   --location=global >/dev/null 2>&1; then
  echo "Creating Workload Identity Pool: $POOL_ID"
  gcloud iam workload-identity-pools create "$POOL_ID"     --project="$PROJECT_ID"     --location=global     --display-name="GitHub Actions"
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID"   --project="$PROJECT_ID"   --location=global   --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  echo "Creating repository-scoped GitHub OIDC provider: $PROVIDER_ID"
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID"     --project="$PROJECT_ID"     --location=global     --workload-identity-pool="$POOL_ID"     --display-name="MV GitHub Actions"     --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref"     --attribute-condition="assertion.repository == '$GITHUB_REPO' && (assertion.ref == 'refs/heads/deploy-production' || assertion.ref == 'refs/heads/main')"     --issuer-uri="https://token.actions.githubusercontent.com"
fi

POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID"   --project="$PROJECT_ID"   --location=global   --format='value(name)')"

PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID"   --project="$PROJECT_ID"   --location=global   --workload-identity-pool="$POOL_ID"   --format='value(name)')"

PRINCIPAL_SET="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

echo "Allowing only this GitHub repository to impersonate the deployer..."
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA"   --project="$PROJECT_ID"   --role="roles/iam.workloadIdentityUser"   --member="$PRINCIPAL_SET"   --quiet >/dev/null

echo
echo "Bootstrap complete."
echo
echo "Set these GitHub production environment/repository variables exactly:"
echo
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=$PROVIDER_NAME"
echo "GCP_DEPLOY_SERVICE_ACCOUNT=$DEPLOYER_SA"
echo
echo "Runtime service account already expected by the deployment workflow:"
echo "RUNTIME_SERVICE_ACCOUNT=$RUNTIME_SA"
echo
echo "Then move deploy-production to the verified main commit again to trigger deployment."
