# Structured Output (LLM)

Force an LLM to return valid, schema-compliant JSON using OpenAI's structured outputs feature and Pydantic model validation.

## Overview

Structured outputs guarantee the model's response matches a declared JSON Schema. Use this when downstream code parses the response directly — no regex, no `json.loads` guessing.

## Pydantic Schema Definition

```python
from pydantic import BaseModel, Field
from typing import Literal

class ExtractedEntity(BaseModel):
    name:        str
    entity_type: Literal["person", "org", "location", "product", "other"]
    confidence:  float = Field(ge=0.0, le=1.0, description="Extraction confidence 0–1.")

class ExtractionResult(BaseModel):
    entities:    list[ExtractedEntity]
    summary:     str = Field(description="One-sentence summary of the text.")
    language:    str = Field(description="ISO 639-1 language code, e.g. 'en'.")
```

## Structured Call

```python
from openai import OpenAI

client = OpenAI()

def extract_entities(text: str) -> ExtractionResult:
    response = client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06",  # structured outputs require this model or newer
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an entity extraction engine. "
                    "Extract all named entities from the provided text. "
                    "Return results in the exact schema provided."
                )
            },
            {"role": "user", "content": text}
        ],
        response_format=ExtractionResult,
    )
    return response.choices[0].message.parsed
```

## Usage

```python
text = """
OpenAI released GPT-4o in May 2024. Sam Altman announced the model
at a San Francisco press event attended by Satya Nadella of Microsoft.
"""

result = extract_entities(text)

for entity in result.entities:
    print(f"{entity.entity_type:10} | {entity.confidence:.0%} | {entity.name}")

print(f"\nSummary: {result.summary}")
print(f"Language: {result.language}")
```

## Output

```
person     | 90% | Sam Altman
person     | 88% | Satya Nadella
org        | 95% | OpenAI
org        | 92% | Microsoft
product    | 97% | GPT-4o
location   | 85% | San Francisco
```

## Refusal Handling

```python
message = response.choices[0].message

if message.refusal:
    # Model declined to produce structured output
    raise ValueError(f"Model refused: {message.refusal}")

result = message.parsed
```

## Notes

- `client.beta.chat.completions.parse()` auto-validates the response against the Pydantic model.
- If the model returns content that doesn't match the schema, the SDK raises `ValidationError`.
- Use `model_json_schema()` to inspect the schema the SDK sends to the API.
- For streaming structured outputs, use `.stream()` with `.get_final_completion()`.
