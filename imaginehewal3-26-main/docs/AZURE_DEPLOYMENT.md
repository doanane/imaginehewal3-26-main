# Azure Deployment Guide

This guide covers deploying the HEWAL3 backend Flask application to Azure App Service using GitHub Actions.

## Overview

The backend is automatically deployed to Azure Web App whenever changes are pushed to the `main` branch. The deployment workflow is configured in [`.github/workflows/main_hewal3-backend-server.yml`](file:///../.github/workflows/main_hewal3-backend-server.yml).

## Deployment Process

### Automatic Deployment

1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: GitHub Actions creates a virtual environment in the `back/` folder and installs dependencies
3. **Artifact**: The `back/` folder (excluding `antenv/`) is packaged and uploaded
4. **Deploy**: Artifact is deployed to Azure App Service `hewal3-backend-server`

### Manual Deployment

You can manually trigger a deployment from GitHub:

1. Go to **Actions** tab in your GitHub repository
2. Select **Build and deploy Python app to Azure Web App - hewal3-backend-server**
3. Click **Run workflow** → Select `main` branch → **Run workflow**

## Azure App Service Configuration

### Environment Variables

The following environment variables **must** be configured in Azure App Service before deployment:

#### Database

```bash
DATABASE_URL=<your-postgresql-connection-string>
LOCAL_DB_URL=<optional-local-db-for-development>
```

#### Azure AI Services

```bash
# Custom Vision
AZURE_CUSTOM_VISION_PREDICTION_ENDPOINT=<endpoint-url>
AZURE_CUSTOM_VISION_PREDICTION_KEY=<prediction-key>

# AI Vision
AZURE_AI_VISION_ENDPOINT=<vision-endpoint>
AZURE_AI_VISION_KEY=<vision-key>

# OpenAI
AZURE_OPENAI_ENDPOINT=<openai-endpoint>
AZURE_OPENAI_KEY=<openai-key>
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
AZURE_OPENAI_API_VERSION=<api-version>
```

#### Gemini AI

```bash
GEMINI_API=<gemini-api-key>
```

#### Security & JWT

```bash
SECRET_KEY=<strong-random-secret-key>
JWT_SECRET_KEY=<jwt-secret-key>
ALGORITHM=HS256
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

#### Email Service (SendGrid)

```bash
SENDGRID_API_KEY=<sendgrid-api-key>
FROM_EMAIL=noreply@hewal3.com
HEWAL3_SUPPORT_EMAIL=support@hewal3.com
```

#### SMS Service (Infobip)

```bash
INFOBIP_API_KEY=<infobip-api-key>
INFOBIP_BASE_URL=<infobip-base-url>
INFOBIP_SENDER_ID=HEWAL3
INFOBIP_SENDER_NUMBER=<sender-phone-number>
```

#### Google OAuth

```bash
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=https://hewal3-backend-server.azurewebsites.net/auth/google/callback
```

#### Storage

```bash
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
AZURE_STORAGE_CONTAINER=food-images
```

#### IoT Hub

```bash
IOT_CONNECTION_STRING=<iot-hub-connection-string>
```

#### CORS & URLs

```bash
CORS_ORIGINS=https://your-frontend.azurewebsites.net,http://localhost:8081
ALLOWED_ORIGINS=["https://your-frontend.azurewebsites.net", "http://localhost:8081"]
BASE_URL=https://hewal3-backend-server.azurewebsites.net
FRONTEND_URL=https://your-frontend.azurewebsites.net
API_PREFIX=
```

#### Application Settings

```bash
ENVIRONMENT=production
RATE_LIMIT_PER_MINUTE=60
MIN_PASSWORD_LENGTH=8
REQUIRE_PASSWORD_SPECIAL_CHARS=true
REQUIRE_PASSWORD_UPPERCASE=true
```

### Setting Environment Variables

#### Via Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **App Services** → **hewal3-backend-server**
3. In the left menu, select **Settings** → **Configuration**
4. Click **+ New application setting**
5. Add each environment variable:
   - **Name**: Variable name (e.g., `DATABASE_URL`)
   - **Value**: Variable value
6. Click **OK** after adding each variable
7. Click **Save** at the top to apply changes
8. Click **Continue** when prompted about restarting the app

#### Via Azure CLI 
    > @ back/docs/azure app settings.txt

## GitHub Secrets

The following secret must be configured in your GitHub repository for deployment:

- `AZUREAPPSERVICE_PUBLISHPROFILE_35965312B00C466D8416787276266D43`: Azure publish profile

### Updating Publish Profile

If you need to update the publish profile:

1. In Azure Portal, go to **App Services** → **hewal3-backend-server**
2. Click **Get publish profile** in the toolbar (download XML file)
3. In GitHub, go to **Settings** → **Secrets and variables** → **Actions**
4. Update the secret `AZUREAPPSERVICE_PUBLISHPROFILE_35965312B00C466D8416787276266D43`
5. Paste the entire contents of the downloaded XML file

## Deployment Workflow Details

The workflow performs the following steps:

### Build Job

1. **Checkout**: Checks out the repository code
2. **Setup Python**: Installs Python 3.12
3. **Install Dependencies**:
   - Creates virtual environment in `back/antenv`
   - Installs packages from `back/requirements.txt`
4. **Upload Artifact**: Packages `back/` folder (excluding `antenv/`)

### Deploy Job

1. **Download Artifact**: Downloads the build artifact
2. **Deploy to Azure**: Uses `azure/webapps-deploy@v3` to deploy to production slot

## Oryx Build System

Azure App Service uses **Oryx** build system by default (controlled by `SCM_DO_BUILD_DURING_DEPLOYMENT=true`). This means:

- Dependencies are installed automatically during deployment
- The workflow excludes the `antenv/` directory to reduce artifact size
- Oryx handles `pip install -r requirements.txt` on the server

### Disabling Oryx

To disable Oryx and use pre-built artifacts:

1. Remove `SCM_DO_BUILD_DURING_DEPLOYMENT` from Azure app settings
2. Modify the workflow to include the virtual environment in the artifact
3. See [Azure workflow samples](https://github.com/Azure/actions-workflow-samples/tree/master/AppService)

## Monitoring & Logs

### View Deployment Logs

**GitHub Actions:**

1. Go to **Actions** tab in GitHub
2. Select the workflow run
3. Click on the **build** or **deploy** job to view logs

**Azure Portal:**

1. Go to **App Services** → **hewal3-backend-server**
2. Select **Deployment** → **Deployment Center**
3. View deployment logs and history

### View Application Logs

1. In Azure Portal, go to **App Services** → **hewal3-backend-server**
2. Select **Monitoring** → **Log stream**
3. Or use Azure CLI:
   ```bash
   az webapp log tail --name hewal3-backend-server --resource-group <your-resource-group>
   ```

## Troubleshooting

### Deployment Fails

- Check GitHub Actions logs for build errors
- Verify all required environment variables are set in Azure
- Check Azure deployment logs in Deployment Center
- Ensure `requirements.txt` is valid and all packages are available

### Application Crashes

- Check application logs in Azure Log Stream
- Verify `DATABASE_URL` is correct and database is accessible
- Ensure all required Azure services (AI Vision, OpenAI, Storage) are properly configured
- Check for missing environment variables in Configuration settings

### Database Connection Issues

- Verify PostgreSQL firewall rules allow Azure services
- Check if database credentials are correct
- Ensure database is running and accessible
- Test connection string format

### CORS Errors

- Update `CORS_ORIGINS` and `ALLOWED_ORIGINS` to include frontend URL
- Restart the app after changing CORS settings

## First-Time Deployment Checklist

- [ ] Create Azure App Service (Python 3.12 runtime)
- [ ] Configure all required environment variables in Azure
- [ ] Set up PostgreSQL database and configure firewall rules
- [ ] Get publish profile and add to GitHub secrets
- [ ] Set up Azure AI services (Custom Vision, AI Vision, OpenAI)
- [ ] Configure Azure Storage Account and create container
- [ ] Set up SendGrid and Infobip accounts (if using email/SMS)
- [ ] Push code to `main` branch to trigger deployment
- [ ] Verify deployment in GitHub Actions
- [ ] Test API endpoints
- [ ] Run database migrations if needed
- [ ] Create superadmin user (see backend README)

## Post-Deployment

After successful deployment:

1. **Test the API**: Visit `https://hewal3-backend-server.azurewebsites.net/docs` for Swagger UI
2. **Health Check**: Check if `/health` endpoint responds
3. **Database Setup**: Run database migrations or initialization scripts
4. **Create Admin User**: Use the superadmin creation script if needed

## Continuous Deployment

Every push to `main` branch automatically triggers:

- ✅ Build validation
- ✅ Dependency installation
- ✅ Artifact creation
- ✅ Deployment to production

To disable auto-deployment, modify the workflow trigger in `.github/workflows/main_hewal3-backend-server.yml`.

## Resources

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
- [Python on Azure App Service](https://docs.microsoft.com/azure/app-service/quickstart-python)
- [Oryx Build System](https://github.com/microsoft/Oryx)
