# Hewal3 IoT Functions

## Project Overview

- **Setup transferred** to Desmond’s directory in azure portal
- **IoT Hub** already exists
- **Device created** in the hub: `Hewal3_device`
- **Dummy function** created to test device can receive data from watch (worked gracefully)
  - Copied the connection string of the device (currently being used in the dummy watch script)

## Azure Trigger Functions

- When data hits the hub, the **Azure Function is triggered**
- The function prints the data to the terminal and forwards it to the webhook
- _Checks like "if blood pressure above normal—> call doctor" are **not** added due to cost_
- The function is written in **Python**
- Used the **VS Code Azure extension** to create the function(currently exist as a resource group in Azure portal)
- **Event Hub compatible name and endpoint** copied and replaced in code manually (**NO ENV**)
- Run the **fake watch simulator** and watch the terminal
- All seems to be working fine

---

## Setup Instructions (For First Timers)

1. **Create an Azure Function App** in the Azure Portal (or install the Azure Functions extension in VS Code, then press <kbd>Ctrl+Shift+P</kbd> → `Azure Functions: Create New Project...` and follow the prompts)
2. **Create an IoT Hub** in the Azure Portal (if not already created)
3. In the IoT Hub, navigate to **Built-in endpoints** under **Settings** to find the Event Hub-compatible endpoint and name
4. In your Function App project, open the `local.settings.json` file and add the Event Hub connection string as shown below. Replace `<your-event-hub-compatible-connection-string>` with the actual connection string from your IoT Hub's built-in endpoints
5. In your function code, replace `<your-event-hub-compatible-name>` with the actual Event Hub-compatible name from your IoT Hub

> **Now, anytime data is sent to the IoT Hub, the function will be triggered.**

---

**Note:**

- The name should be the same as the **entity path** in the connection string.
