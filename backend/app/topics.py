"""Plain-language research topics, each a group of funder areas (NIH institutes, NSF divisions).

A topic is defined only by which funder funded an award, so membership is exact, not inferred.
Edit TOPICS to regroup. Areas not listed here (e.g. the NIH Office of the Director) belong to no topic.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Topic:
    id: str
    name: str
    blurb: str
    areas: tuple[str, ...]
    image: str | None = None  # path under frontend/public


TOPICS: tuple[Topic, ...] = (
    Topic("heart-lung-blood", "Heart, lung & blood", "Cardiovascular, pulmonary and blood research.",
          ("nhlbi",), "/images/topics/heart.jpg"),
    Topic("addiction", "Drug use & addiction", "Substance use, alcohol and addiction research.",
          ("nida", "niaaa"), "/images/topics/addiction.jpg"),
    Topic("mental-health", "Mental health", "Mental illness, mood, anxiety and behavioral health.",
          ("nimh",), "/images/topics/mental-health.jpg"),
    Topic("brain", "Brain & nervous system", "Neurological disorders, stroke, hearing, vision and the brain.",
          ("ninds", "nidcd", "nei"), "/images/topics/brain.jpg"),
    Topic("cancer", "Cancer", "Cancer biology, prevention and treatment.",
          ("nci",)),
    Topic("aging", "Aging & Alzheimer's", "Aging, dementia and Alzheimer's disease.",
          ("nia",)),
    Topic("infection-immunity", "Infection & immunity", "Infectious disease, HIV and the immune system.",
          ("niaid",)),
    Topic("child-health", "Child health & development", "Pregnancy, children and human development.",
          ("nichd",)),
    Topic("metabolism", "Diabetes, kidney & musculoskeletal", "Metabolic, digestive, kidney, bone and skin disease.",
          ("niddk", "niams")),
    Topic("oral-health", "Oral & dental health", "Dental, oral and craniofacial research.",
          ("nidcr",)),
    Topic("health-equity", "Health equity & community health", "Health disparities, nursing, injury, occupational and environmental health.",
          ("nimhd", "ninr", "ncipc", "niosh", "ahrq", "niehs", "nccih")),
    Topic("life-sciences", "Biology & life sciences", "Cell, molecular and organismal biology, genomics and biological tools.",
          ("nigms", "nhgri", "nsf-mcb", "nsf-cdp", "nsf-dbi", "nsf-ios", "nsf-oie", "nsf-epp", "nsf-deb"),
          "/images/topics/biology.jpg"),
    Topic("chemistry-materials", "Chemistry & materials", "Chemistry, materials science and condensed matter.",
          ("nsf-che", "nsf-dmr", "nsf-mrs"), "/images/topics/materials.jpg"),
    Topic("engineering", "Engineering & energy", "Chemical, mechanical, electrical, biomedical and manufacturing engineering.",
          ("nsf-cbet", "nsf-cmmi", "nsf-eccs", "nsf-eec", "nsf-et", "nsf-ite", "nibib"), "/images/topics/engineering.jpg"),
    Topic("computing-ai", "Computing & AI", "Computer systems, AI, software, cybersecurity and research computing.",
          ("nsf-cns", "nsf-ccf", "nsf-caif", "nsf-ssf", "nsf-iis", "nsf-oac", "nsf-cpis", "nsf-ccp", "nsf-hcce",
           "nsf-iic", "nlm"), "/images/topics/computing.jpg"),
    Topic("math-physics", "Math & physics", "Mathematics, statistics and physics.",
          ("nsf-mms", "nsf-dms", "nsf-phy"), "/images/topics/physics.jpg"),
    Topic("earth-environment", "Earth, ocean & polar science", "Geoscience, oceans, polar regions and the environment.",
          ("nsf-opp", "nsf-gcp", "nsf-ear", "nsf-oce")),
    Topic("stem-education", "STEM education", "Teaching, learning, scholarships and training in science and engineering.",
          ("nsf-drl", "nsf-sft", "nsf-eit", "nsf-due", "nsf-dge")),
    Topic("society-behavior", "Society & behavior", "Social, economic, behavioral and cognitive science.",
          ("nsf-ses", "nsf-bcs", "nsf-sma")),
)

BY_ID = {t.id: t for t in TOPICS}
AREA_TO_TOPIC = {area: t.id for t in TOPICS for area in t.areas}

# Records without a funding institute (trials, publications, other federal grants) are matched to topics
# by words in their title and subject terms. Weaker than funder-based membership, and stored as 'keywords'.
KEYWORDS: dict[str, str] = {
    "heart-lung-blood": r"cardi\w*|heart|coronary|atrial|hypertension|vascular|lung|pulmonary|asthma|copd|anemia|"
                        r"sickle|thromb\w*|aort\w*",
    "addiction": r"opioid\w*|addiction|substance use|alcohol\w*|cocaine|cannabi\w*|nicotine|smoking|tobacco|"
                 r"overdose|fentanyl",
    "mental-health": r"depress\w*|anxiety|schizophren\w*|bipolar|psychiatr\w*|ptsd|mental health|suicid\w*",
    "brain": r"brain|neuro\w*|stroke|epilep\w*|parkinson\w*|spinal cord|hearing loss|retina\w*|multiple sclerosis|"
             r"migraine",
    "cancer": r"cancer\w*|tumou?r\w*|carcinoma|leukemia|lymphoma|melanoma|oncolog\w*|glioma|sarcoma|metasta\w*",
    "aging": r"aging|ageing|alzheimer\w*|dementia|older adults",
    "infection-immunity": r"hiv|infect\w*|virus\w*|viral|covid\w*|sars-cov-2|bacteri\w*|immun\w*|vaccin\w*|"
                          r"hepatitis|tuberculosis|sepsis",
    "child-health": r"pediatric\w*|paediatric\w*|child\w*|infant\w*|neonat\w*|pregnan\w*|maternal|adolescen\w*",
    "metabolism": r"diabet\w*|obesity|kidney|renal|liver|metabolic|osteo\w*|arthritis|gastro\w*|bowel",
    "oral-health": r"dental|oral health|periodont\w*|teeth|craniofacial",
    "health-equity": r"disparit\w*|health equity|community health|underserved|social determinants|health services|"
                     r"nursing|injury prevention",
    "life-sciences": r"protein\w*|genom\w*|gene expression|molecular biology|enzyme\w*|evolution\w*|ecolog\w*|"
                     r"microbio\w*",
    "chemistry-materials": r"chemi\w*|catalys\w*|polymer\w*|materials?|crystal\w*|spectroscop\w*",
    "engineering": r"engineer\w*|robot\w*|batter(y|ies)|energy storage|sensors?|manufactur\w*|biomechan\w*",
    "computing-ai": r"machine learning|deep learning|artificial intelligence|\bai\b|neural networks?|algorithm\w*|"
                    r"comput\w*|software|data science|cybersecurity",
    "math-physics": r"mathemat\w*|statistic\w*|physics|quantum|particle|astrophys\w*|cosmolog\w*|optical",
    "earth-environment": r"climate|ocean\w*|geolog\w*|environmental|polar|arctic|antarctic|watershed|sediment\w*",
    "stem-education": r"education\w*|teaching|teachers?|students?|curricul\w*|\bstem\b(?! cells?)",
    "society-behavior": r"social|economic\w*|behaviou?r\w*|policy|psycholog\w*|survey|urban|political",
}
_KEYWORD_PATTERNS = {t: re.compile(rf"\b(?:{p})\b", re.IGNORECASE) for t, p in KEYWORDS.items()}


def topics_from_text(title: str, terms: str, limit: int = 2) -> list[str]:
    """Best-matching topics for a record: title matches count three times as much as subject terms."""
    scores = {}
    for topic, pattern in _KEYWORD_PATTERNS.items():
        score = 3 * len(pattern.findall(title or "")) + len(pattern.findall(terms or ""))
        if score >= 2:
            scores[topic] = score
    return [t for t, _ in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:limit]]
