export const runtime = "nodejs";

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export async function GET() {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching Ollama models:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch models from Ollama" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data: OllamaTagsResponse = await response.json();

    // Transform the models into a simpler format
    const models = data.models.map((model) => ({
      value: model.name,
      label: model.name,
      size: model.size,
      modifiedAt: model.modified_at,
      details: model.details,
    }));

    return new Response(JSON.stringify({ models }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in models route:", error);
    return new Response(
      JSON.stringify({ error: "Failed to connect to Ollama. Make sure Ollama is running on localhost:11434" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

