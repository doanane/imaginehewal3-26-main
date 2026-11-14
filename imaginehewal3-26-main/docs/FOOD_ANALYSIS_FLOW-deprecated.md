### Des just changed the flow of the food analysis

# Food Analysis Data Flow

This document details the structural data flow of the food analysis feature, focusing on how images and metadata are passed between the frontend and backend.

---

## Data Structure & Flow

### 1. Frontend: Data Preparation

When a user selects an image, the frontend constructs a FormData object. This is the standard way to send files over HTTP.

**Structure of FormData:**

- meal_type: A string (e.g., "breakfast", "lunch").
- file: A special object representing the image:
  - uri: Local path to the image on the device.
  - name: Filename (e.g., "photo.jpg").
  - type: MIME type (e.g., "image/jpeg").

> [!NOTE]
> In React Native, the file object must follow this specific {uri, name, type} structure for the underlying native networking layer to handle the upload correctly.

---

### 2. Backend: API Reception

The FastAPI backend receives this data using Form and UploadFile parameters.

**Endpoint Definition:**

```python
@router.post("/analyze-meal")
async def analyze_meal(
    meal_type: str = Form(...),
    file: UploadFile = File(...)
):
```

- Form(...): Extracts the meal_type string from the multipart request.
- UploadFile: A FastAPI object that provides a file-like interface to the uploaded data. It includes metadata like filename and content_type.

---

### 3. Backend: Internal Processing

To process the image with Azure AI, the backend performs two critical structural transitions:

#### A. Persistence to Disk

Azure's SDK often requires a physical file path or a stream. We first save the uploaded bytes to a temporary location.

- Input: UploadFile object.
- Action: await file.read() extracts raw bytes.
- Output: A temporary file on the server's disk.

#### B. The Stream Transition (Critical Fix)

The Azure Vision API analyze_image_in_stream method requires a stream object, not raw bytes.

- Input: Raw bytes from the temp file.
- Action: io.BytesIO(image_data) wraps the bytes in a stream interface.
- Output: A BytesIO object that mimics a file with .read() and .seek() methods.

---

## Explanations

### For a 9-Year-Old

"Imagine you want to show a picture to a friend who lives far away.

1. You put the picture in a special envelope (FormData) and write what meal it is on the outside.
2. The mailman (the Internet) carries it to your friend's house (the Backend).
3. Your friend takes the picture out, but to use their magic magnifying glass (Azure AI), they have to put the picture on a special sliding tray (BytesIO Stream) so the glass can read it properly."

### For an Interviewer

"The system implements a robust multipart file upload pipeline.

- Frontend: We utilize FormData to encapsulate the image URI and metadata, ensuring compatibility with React Native's fetch implementation.
- Backend: We leverage FastAPI's UploadFile for efficient memory management during the upload.
- Integration: A key technical hurdle was the impedance mismatch between raw byte buffers and the Azure SDK's expectation of a file-like stream. We resolved this by implementing an io.BytesIO wrapper, providing the necessary .read() interface for the analyze_image_in_stream method without redundant disk I/O after the initial persistence."

---

## Summary of Challenges

- Network Binding: Backend must listen on 0.0.0.0 to be reachable by mobile devices on the local network.
- Environment Variables: Expo requires EXPO*PUBLIC* prefix for client-side access.
- Stream Handling: Transitioning from bytes to BytesIO to satisfy SDK requirements.
