"""
backend/rag/generator.py

Combines corpus evidence (primary, always present) and live evidence
(optional, may be empty) into a single grounded generation call, with the
system prompt requiring the two source types to be cited differently so a
reviewing clinician can tell "vetted guideline" from "live web result"
at a glance.
"""

import json
import os
from typing import List

from openai import OpenAI

GROQ_MODEL = os.environ.get("LLM_MODEL", "qwen/qwen3.8-27b")

SYSTEM_PROMPT = """You are a clinical decision-support assistant synthesizing multimodal ASD assessment findings for a clinician.
You receive structured model outputs (MRI classification, M-CHAT-R behavioral screening, clinical phenotypic severity, SHAP feature drivers) and retrieved evidence.

OUTPUT FORMAT - follow exactly, keep it concise, easy to read, and summarized:

### Multimodal Synthesis & Urgency
- **Overall Picture:** 1 clear sentence summarizing the combined findings across MRI, Behavioral, and Clinical assessments.
- **Agreement / Discrepancy:** 1 sentence stating whether modalities agree or if there is a divergence (if conflict exists, note behavioral data takes clinical priority).
- **Clinical Urgency:** 1 sentence indicating the recommended timeframe or urgency level (e.g. immediate referral, standard developmental surveillance).

### Recommended Next Steps
Write 3-4 short, high-priority action bullet points.
Each bullet must contain: one clear clinical action + one short inline citation tag at the end.
- Cite vetted corpus guidelines as [Guideline: <short title>].
- Cite live web sources as [Web: <short title>].
- Keep each bullet point under 20 words.

RULES:
- If M-CHAT tier is Moderate Risk: recommend M-CHAT-R/F Follow-Up interview first before immediate diagnostic referral.
- Do NOT repeat raw model numbers or dump long paragraphs.
- End with exactly this line:
*Note: Decision-support only — not a formal clinical diagnosis. Clinician review required.*
"""





def _format_evidence(items: List[dict], label: str) -> str:
    if not items:
        return ""
    blocks = []
    for i, r in enumerate(items, start=1):
        tag = f"{label} {i}"
        extra = f", retrieved {r['retrieved_at']}" if r.get("retrieved_at") else ""
        blocks.append(f"[{tag}] {r['title']}{extra}\n{r['text']}")
    return "\n\n".join(blocks)


def generate_recommendations(model_results, corpus_evidence: List[dict],
                              live_evidence: List[dict], client: OpenAI) -> str:
    corpus_block = _format_evidence(corpus_evidence, "Corpus source")
    live_block = _format_evidence(live_evidence, "Live source")

    evidence_section = f"CORPUS EVIDENCE:\n{corpus_block}"
    if live_evidence:
        evidence_section += f"\n\nLIVE EVIDENCE:\n{live_block}"

    model_dict = model_results.model_dump() if hasattr(model_results, "model_dump") else (
        model_results.dict() if hasattr(model_results, "dict") else model_results
    )

    user_prompt = f"""STRUCTURED MODEL RESULTS:
{json.dumps(model_dict, indent=2)}

{evidence_section}

Generate a concise recommendation in exactly the two required sections matching the system prompt:
1. ### Multimodal Synthesis & Urgency (3 bullet points: Overall Picture, Agreement / Discrepancy, and Clinical Urgency)
2. ### Recommended Next Steps (3-4 bullets, each with one inline citation tag)

Be brief and concise. Each bullet max 25 words."""

    model_name = os.environ.get("LLM_MODEL", GROQ_MODEL)

    response = client.chat.completions.create(
        model=model_name,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content

