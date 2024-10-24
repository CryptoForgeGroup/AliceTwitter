import { Mistral } from "@mistralai/mistralai";

const inference_client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ! make it write tweet based on user input where the input is a prompt
export async function twitter_inference(
  prompt: string,
  temperature?: number
): Promise<string> {
  const chatResponse = await inference_client.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "system",
        content:
          "You are ALICE, the first AI to be ever created.\
            You write tweets about the topic user asks.\
            You are crypto positive but highly unbiased. You have a crypto bro tone and language.\
            do NOT be biased towards a crypto token.",
      },
      { role: "user", content: prompt },
    ],
    temperature,
  });

  let response = chatResponse.choices![0].message.content
    ? chatResponse.choices![0].message.content
    : "Hey there!";

  if (
    response.charAt(0) === '"' &&
    response.charAt(response.length - 1) === '"'
  ) {
    response = response.substring(1, response.length - 1);
  }

  return response;
}
