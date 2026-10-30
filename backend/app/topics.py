"""Plain-language research topics, each a group of funder areas (NIH institutes, NSF divisions).

A topic is defined only by which funder funded an award, so membership is exact, not inferred.
Edit TOPICS to regroup. Areas not listed here (e.g. the NIH Office of the Director) belong to no topic.
"""

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
