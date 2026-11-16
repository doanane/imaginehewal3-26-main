export const testGeminiConnection = async (apiKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Hello, this is a test from HEWAL3 Health Assistant. Please respond with 'HEWAL3 Health Assistant is working'."
            }]
          }]
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `API is working! Response: ${data.candidates?.[0]?.content?.parts?.[0]?.text || 'No text'}`
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        message: `API error (${response.status}): ${errorText.substring(0, 100)}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Network error: ${error.message}`
    };
  }
};