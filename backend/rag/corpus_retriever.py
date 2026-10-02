"""
backend/rag/corpus_retriever.py

Corpus Retriever Layer for Vetted Clinical Guidelines.
Indexes plain text guidelines (.txt) and metadata (.meta.json) from the trusted_corpus directory,
with built-in fallback guidelines (AAP & NICE) embedded directly in code with official reference URLs.
"""

import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any

CORPUS_DIR = Path(__file__).parent.parent / "trusted_corpus"
CHROMA_DIR = Path(__file__).parent.parent / "chroma_db"

# Built-in vetted clinical guidelines embedded directly with official reference URLs
DEFAULT_CLINICAL_GUIDELINES = [
    {
        "title": "AAP Clinical Practice Guidelines for ASD Screening & Management",
        "publisher": "American Academy of Pediatrics (AAP)",
        "url": "https://www.aap.org/en/patient-care/autism/",
        "text": (
            "American Academy of Pediatrics (AAP) recommendations for ASD screening and management: "
            "1. Universal Screening: Perform standardized developmental screening at 9, 18, and 30 months, "
            "with specific ASD screening using M-CHAT-R/F at 18 and 24 months. "
            "2. Immediate Referral: If a child fails screening or shows loss of language/social skills, "
            "refer immediately for comprehensive diagnostic evaluation and early intervention services without waiting. "
            "3. Early Intervention: Initiate evidence-based behavioral intervention (e.g., Applied Behavior Analysis, "
            "Speech and Language Therapy, Occupational Therapy) immediately upon suspicion of ASD. "
            "4. Multimodal Assessment: Comprehensive evaluation must integrate formal developmental testing, "
            "caregiver history, behavioral observation, and sensory assessment."
        ),
    },
    {
        "title": "NICE Guideline CG128: Autism Spectrum Disorder in Under 19s: Recognition, Referral and Diagnosis",
        "publisher": "National Institute for Health and Care Excellence (NICE)",
        "url": "https://www.nice.org.uk/guidance/cg128",
        "text": (
            "NICE Clinical Guideline CG128 key diagnostic principles: "
            "1. Core Triad/Features: Assess persistent deficits in social communication/interaction, alongside "
            "restricted, repetitive patterns of behavior, interests, or activities. "
            "2. Multidisciplinary Evaluation: Diagnostic team should include a developmental pediatrician or child psychiatrist, "
            "speech and language therapist, and occupational therapist. "
            "3. Differential Diagnosis & Co-morbidities: Screen for co-occurring conditions including intellectual disability, "
            "ADHD, anxiety, sensory processing differences, and epilepsy. "
            "4. Individualized Care Plan: Tailor recommendations to family needs, focusing on communication support, "
            "environmental adaptations, structured routines, and caregiver support programs."
        ),
    },
]


def chunk_text(text: str, chunk_words: int = 120, overlap_words: int = 20) -> List[str]:
    """Sliding window word-level chunking."""
    words = re.split(r'\s+', text.strip())
    if not words or not words[0]:
        return []
    
    chunks = []
    step = max(1, chunk_words - overlap_words)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_words])
        if chunk:
            chunks.append(chunk)
        if i + chunk_words >= len(words):
            break
    return chunks


class CorpusRetriever:
    def __init__(self, corpus_dir: Path = CORPUS_DIR, chroma_dir: Path = CHROMA_DIR):
        self.corpus_dir = corpus_dir
        self.chroma_dir = chroma_dir
        self.use_chroma = False
        self.chroma_collection = None
        self.documents = []  # List of {"text": ..., "title": ..., "publisher": ..., "url": ...}
        
        self.load_corpus()

    def load_corpus(self):
        """Loads built-in embedded guidelines and any optional .txt guidelines from corpus_dir."""
        self.documents = []
        
        # 1. Load built-in embedded AAP & NICE guidelines
        for item in DEFAULT_CLINICAL_GUIDELINES:
            chunks = chunk_text(item["text"], chunk_words=120, overlap_words=20)
            for chunk in chunks:
                self.documents.append({
                    "text": chunk,
                    "title": item["title"],
                    "publisher": item["publisher"],
                    "url": item["url"],
                    "source_type": "corpus",
                })

        # 2. Load optional external .txt and .meta.json guidelines if present
        if self.corpus_dir.exists():
            for txt_path in self.corpus_dir.glob("*.txt"):
                meta_path = txt_path.with_suffix(".meta.json")
                meta = {}
                if meta_path.exists():
                    try:
                        with open(meta_path, "r", encoding="utf-8") as f:
                            meta = json.load(f)
                    except Exception:
                        pass

                title = meta.get("title", txt_path.stem.replace("_", " ").title())
                publisher = meta.get("publisher", "Clinical Guideline Corpus")
                url = meta.get("url")

                try:
                    with open(txt_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    chunks = chunk_text(content, chunk_words=120, overlap_words=20)
                    for chunk in chunks:
                        self.documents.append({
                            "text": chunk,
                            "title": title,
                            "publisher": publisher,
                            "url": url,
                            "source_type": "corpus",
                        })
                except Exception as e:
                    print(f"[CorpusRetriever] Error loading {txt_path}: {e}")

        # Always initialize TF-IDF fallback vectorizer for instant availability
        if self.documents:
            self._init_tfidf()

        # Try initializing ChromaDB
        self._init_chroma()

    def _init_chroma(self):
        if not self.documents:
            return
        
        # Check if local ONNX cache file or directory exists
        onnx_cache = Path.home() / ".cache" / "chroma" / "onnx_models" / "all-MiniLM-L6-v2" / "onnx.tar.gz"
        onnx_dir = Path.home() / ".cache" / "chroma" / "onnx_models" / "all-MiniLM-L6-v2" / "onnx"
        is_cached = (onnx_dir.exists()) or (onnx_cache.exists() and onnx_cache.stat().st_size > 70_000_000)
        if not is_cached:
            print("[CorpusRetriever] ChromaDB ONNX model not cached. Using fast TF-IDF vectorizer fallback.")
            self.use_chroma = False
            return

        try:
            import chromadb
            client = chromadb.PersistentClient(path=str(self.chroma_dir))
            collection = client.get_or_create_collection(name="asd_guidelines")
            
            # Re-populate collection if empty
            if collection.count() == 0:
                ids = [f"doc_{i}" for i in range(len(self.documents))]
                texts = [d["text"] for d in self.documents]
                metadatas = [{
                    "title": d["title"],
                    "publisher": d["publisher"],
                    "url": d.get("url") or "",
                    "source_type": "corpus"
                } for d in self.documents]
                
                collection.add(documents=texts, metadatas=metadatas, ids=ids)

            self.chroma_collection = collection
            self.use_chroma = True
            print(f"[CorpusRetriever] ChromaDB active with {collection.count()} chunks.")
        except Exception as e:
            print(f"[CorpusRetriever] ChromaDB initialization skipped ({e}). Using TF-IDF fallback.")
            self.use_chroma = False

    def _init_tfidf(self):
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            corpus_texts = [doc["text"] for doc in self.documents]
            self.tfidf_vectorizer = TfidfVectorizer(stop_words='english')
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus_texts)
        except Exception as e:
            print(f"[CorpusRetriever] TF-IDF init warning: {e}")
            self.tfidf_vectorizer = None
            self.tfidf_matrix = None

    def query(self, query_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Queries guidelines via ChromaDB if active, otherwise via TF-IDF cosine similarity."""
        if not self.documents:
            return []

        # Strategy A: ChromaDB
        if self.use_chroma and self.chroma_collection:
            try:
                results = self.chroma_collection.query(
                    query_texts=[query_text],
                    n_results=min(top_k, len(self.documents))
                )
                formatted = []
                if results and results.get("documents") and results["documents"][0]:
                    docs = results["documents"][0]
                    metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                    for doc_str, meta in zip(docs, metas):
                        formatted.append({
                            "text": doc_str,
                            "title": meta.get("title", "Clinical Guideline"),
                            "publisher": meta.get("publisher", "Trusted Source"),
                            "url": meta.get("url") if meta.get("url") else None,
                            "source_type": "corpus"
                        })
                return formatted
            except Exception as e:
                print(f"[CorpusRetriever] ChromaDB query failed ({e}). Falling back to TF-IDF.")

        # Strategy B: TF-IDF + Cosine Similarity Fallback
        if hasattr(self, 'tfidf_vectorizer') and self.tfidf_vectorizer is not None:
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                query_vec = self.tfidf_vectorizer.transform([query_text])
                similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
                top_indices = similarities.argsort()[::-1][:top_k]
                
                results = []
                for idx in top_indices:
                    if similarities[idx] > 0.05:  # Relevance threshold
                        doc = self.documents[idx].copy()
                        results.append(doc)
                return results
            except Exception as e:
                print(f"[CorpusRetriever] TF-IDF query error: {e}")

        # Fallback Strategy C: Simple word matching
        keywords = set(re.findall(r'\w+', query_text.lower()))
        scored_docs = []
        for doc in self.documents:
            doc_words = set(re.findall(r'\w+', doc["text"].lower()))
            overlap = len(keywords.intersection(doc_words))
            if overlap > 0:
                scored_docs.append((overlap, doc))
        
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs[:top_k]]
