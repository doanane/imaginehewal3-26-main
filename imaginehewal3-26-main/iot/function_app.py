# check read me for Additional info
import azure.functions as func
import logging
import json
import urllib.request
import urllib.error

app = func.FunctionApp()
# the webhook url, confirm from Desmond
WEBHOOK_URL = "https://webhook.site/22eb482f-9598-44c2-ad78-d8865aa17051"


# This function is triggered when a new message
#  arrives in the specified Event Hub, deployed on
#  the Azure Function App. No need to hide secrets here
#  as they are stored in local.settings.json and
#  deployed in the Azure Function App settings.


@app.event_hub_message_trigger(
    arg_name="azeventhub",
    event_hub_name="iothub-ehub-hewal3-iot-56146616-948cc7aabb",
    connection="hewal3_RootManageSharedAccessKey_EVENTHUB",
)
def hewaleFunction(azeventhub: func.EventHubEvent):
    print("Python EventHub trigger function processed an event.")
    try:
        body = azeventhub.get_body().decode("utf-8", errors="replace")

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {"payload": body}
            logging.info(f"Received raw message: {body}")

        print("Received payload:", payload)
        logging.info(f"Received payload: {payload}")

        # forward_to_webhook(payload)

    except Exception as e:
        logging.error("Failed to process event: %s", e)


def forward_to_webhook(data: dict):
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            logging.info("Webhook response status: %s", response.getcode())
    except urllib.error.HTTPError as e:
        logging.error("Webhook HTTP error: %s", e.code)
    except urllib.error.URLError as e:
        logging.error("Webhook URL error: %s", e.reason)
