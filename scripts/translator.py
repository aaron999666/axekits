import os
import json
import google.generativeai as genai

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-lite-preview-06-05",
    system_instruction="You are a translator. Translate tool names and descriptions to Chinese. Respond in JSON only with format: {\"name_zh\": \"...\", \"description_zh\": \"...\"}. Keep technical terms in English if they are widely used.",
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.1,
    ),
)

def translate_batch(tools_batch):
    prompt = "Translate the following tools to Chinese:\n"
    for i, tool in enumerate(tools_batch):
        prompt += f"\n{i+1}. Name: {tool['name']}\n   Description: {tool.get('description', '')}\n"
    prompt += "\nRespond with JSON array: [{\"name_zh\": \"...\", \"description_zh\": \"...\"}, ...]"
    try:
        response = model.generate_content(prompt)
        results = json.loads(response.text)
        if isinstance(results, list):
            return results
        return [results]
    except Exception as e:
        print(f"Translation error: {e}")
        return None

def main():
    with open("data/classified_tools.json", "r", encoding="utf-8") as f:
        tools = json.load(f)

    batch_size = 10
    for i in range(0, len(tools), batch_size):
        batch = tools[i:i+batch_size]
        print(f"Translating batch {i//batch_size + 1}/{(len(tools)-1)//batch_size + 1}")
        translations = translate_batch(batch)
        if translations:
            for j, tool in enumerate(batch):
                if j < len(translations):
                    tool["name_zh"] = translations[j].get("name_zh", tool["name"])
                    tool["description_zh"] = translations[j].get("description_zh", tool.get("description", ""))
                else:
                    tool["name_zh"] = tool["name"]
                    tool["description_zh"] = tool.get("description", "")
        else:
            for tool in batch:
                tool["name_zh"] = tool["name"]
                tool["description_zh"] = tool.get("description", "")

        import time
        if i + batch_size < len(tools):
            time.sleep(4)

    for tool in tools:
        tool.setdefault("name_zh", tool["name"])
        tool.setdefault("description_zh", tool.get("description", ""))
        tool["self_hosted"] = False
        tool["tool_type"] = "html"
        tool["health_status"] = "unknown"
        tool["last_checked"] = ""

    with open("data/tools.json", "w", encoding="utf-8") as f:
        json.dump(tools, f, ensure_ascii=False, indent=2)

    print(f"Translated {len(tools)} tools")

if __name__ == "__main__":
    main()
